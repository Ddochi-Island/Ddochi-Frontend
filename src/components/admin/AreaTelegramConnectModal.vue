<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { useApi } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'

const emit = defineEmits(['close'])
const { callApi } = useApi()
const { showAppAlert, showToast } = usePopup()

const CHANNEL_TYPE = 'areaDashboard'
const TEAM_CHANNEL_TYPE = 'teamDashboard'

const teams = ref([])        // [{ teamId, teamName, teamChatId, teamChatTitle, areas: [...] }]
const activeTabIndex = ref(0)
const loading = ref(true)

// pairing 상태: key = `${teamName}__${areaId}` 또는 `${teamName}__team`
const pairing = ref({})
const timers = {}

// chatIds / chatTitles: key = `${teamName}__${areaId}` 또는 `${teamName}__team`
const chatIds = reactive({})
const chatTitles = reactive({})

function rowKey(teamName, areaId) { return `${teamName}__${areaId}` }
function teamRowKey(teamName) { return `${teamName}__team` }

function load() {
    loading.value = true
    callApi('/api/score/area-pairs', {}, (r) => {
        loading.value = false
        if (!r?.success) { showAppAlert(r?.message || '불러오기 실패'); return }
        teams.value = r.teams || []
        for (const t of teams.value) {
            const tk = teamRowKey(t.teamName)
            chatIds[tk] = t.teamChatId || ''
            chatTitles[tk] = t.teamChatTitle || ''
            for (const a of t.areas) {
                const k = rowKey(t.teamName, a.areaId)
                chatIds[k] = a.chatId || ''
                chatTitles[k] = a.chatTitle || ''
            }
        }
    })
}

function startPairing(team, area) {
    const k = rowKey(team.teamName, area.areaId)
    callApi('/api/telegram-pair/start', { team: team.teamName, channelType: CHANNEL_TYPE, areaId: area.areaId }, (r) => {
        if (!r?.success) { showAppAlert(r?.message || '코드 생성 실패'); return }
        pairing.value = { ...pairing.value, [k]: { active: true, code: r.code, command: r.command, state: 'pending' } }
        startPolling(team, area)
    })
}

function startPolling(team, area) {
    const k = rowKey(team.teamName, area.areaId)
    if (timers[k]) clearInterval(timers[k])
    timers[k] = setInterval(() => pollStatus(team, area), 3000)
}

function pollStatus(team, area) {
    const k = rowKey(team.teamName, area.areaId)
    if (!pairing.value[k]?.active) { clearInterval(timers[k]); return }
    callApi('/api/telegram-pair/status', { team: team.teamName, channelType: CHANNEL_TYPE, areaId: area.areaId }, (r) => {
        if (!r?.success) return
        if (r.state === 'completed') {
            clearInterval(timers[k])
            chatIds[k] = r.chatId || ''
            chatTitles[k] = r.chatTitle || ''
            pairing.value = { ...pairing.value, [k]: { active: false, state: 'completed' } }
            showToast(`✅ ${area.areaName} 연결됨!`)
        } else if (r.state === 'expired') {
            clearInterval(timers[k])
            pairing.value = { ...pairing.value, [k]: { active: false, state: 'expired' } }
        }
    })
}

function cancelPairing(team, area) {
    const k = rowKey(team.teamName, area.areaId)
    clearInterval(timers[k])
    pairing.value = { ...pairing.value, [k]: { active: false } }
    callApi('/api/telegram-pair/cancel', { team: team.teamName, channelType: CHANNEL_TYPE, areaId: area.areaId }, () => {})
}

function disconnect(team, area) {
    showAppAlert(`${area.areaName} 연결을 해제할까요?`, () => {
        callApi('/api/telegram-pair/disconnect', { team: team.teamName, channelType: CHANNEL_TYPE, areaId: area.areaId }, (r) => {
            if (!r?.success) { showAppAlert(r?.message || '해제 실패'); return }
            const k = rowKey(team.teamName, area.areaId)
            chatIds[k] = ''
            chatTitles[k] = ''
            showToast(`${area.areaName} 연결 해제 완료`)
        })
    }, { confirm: true })
}

function copyCommand(team, area) {
    const k = rowKey(team.teamName, area.areaId)
    const cmd = pairing.value[k]?.command
    if (!cmd) return
    navigator.clipboard.writeText(cmd).then(() => showToast('📋 복사됐어!')).catch(() => {
        showAppAlert(`복사할 명령어:\n${cmd}`)
    })
}

// ── 팀전체 채널 ──────────────────────────────────────────────────────
function startTeamPairing(team) {
    const k = teamRowKey(team.teamName)
    callApi('/api/telegram-pair/start', { team: team.teamName, channelType: TEAM_CHANNEL_TYPE }, (r) => {
        if (!r?.success) { showAppAlert(r?.message || '코드 생성 실패'); return }
        pairing.value = { ...pairing.value, [k]: { active: true, code: r.code, command: r.command, state: 'pending' } }
        if (timers[k]) clearInterval(timers[k])
        timers[k] = setInterval(() => pollTeamStatus(team), 3000)
    })
}

function pollTeamStatus(team) {
    const k = teamRowKey(team.teamName)
    if (!pairing.value[k]?.active) { clearInterval(timers[k]); return }
    callApi('/api/telegram-pair/status', { team: team.teamName, channelType: TEAM_CHANNEL_TYPE }, (r) => {
        if (!r?.success) return
        if (r.state === 'completed') {
            clearInterval(timers[k])
            chatIds[k] = r.chatId || ''
            chatTitles[k] = r.chatTitle || ''
            pairing.value = { ...pairing.value, [k]: { active: false, state: 'completed' } }
            showToast(`✅ ${team.teamName} 지역전체 연결됨!`)
        } else if (r.state === 'expired') {
            clearInterval(timers[k])
            pairing.value = { ...pairing.value, [k]: { active: false, state: 'expired' } }
        }
    })
}

function cancelTeamPairing(team) {
    const k = teamRowKey(team.teamName)
    clearInterval(timers[k])
    pairing.value = { ...pairing.value, [k]: { active: false } }
    callApi('/api/telegram-pair/cancel', { team: team.teamName, channelType: TEAM_CHANNEL_TYPE }, () => {})
}

function disconnectTeam(team) {
    showAppAlert(`${team.teamName} 지역전체 연결을 해제할까요?`, () => {
        callApi('/api/telegram-pair/disconnect', { team: team.teamName, channelType: TEAM_CHANNEL_TYPE }, (r) => {
            if (!r?.success) { showAppAlert(r?.message || '해제 실패'); return }
            const k = teamRowKey(team.teamName)
            chatIds[k] = ''
            chatTitles[k] = ''
            showToast(`${team.teamName} 지역전체 연결 해제 완료`)
        })
    }, { confirm: true })
}

function copyTeamCommand(team) {
    const k = teamRowKey(team.teamName)
    const cmd = pairing.value[k]?.command
    if (!cmd) return
    navigator.clipboard.writeText(cmd).then(() => showToast('📋 복사됐어!')).catch(() => {
        showAppAlert(`복사할 명령어:\n${cmd}`)
    })
}

onMounted(load)
onUnmounted(() => { for (const id of Object.values(timers)) clearInterval(id) })
</script>

<template>
    <Teleport to="body">
        <div class="modal-overlay" @click.self="emit('close')">
            <div class="admin-modal-card">
                <div class="modal-header-sticky">
                    <div style="display:flex;align-items:center;justify-content:center;width:100%;">
                        <div class="modal-title" style="margin:0;">💬 구역 텔레그램 연결</div>
                    </div>
                    <span class="modal-close-sticky" style="position:absolute;right:20px;" @click="emit('close')">×</span>
                </div>

                <div class="modal-content-scroll">
                    <div class="help-banner">
                        <b>📋 연결 방법</b><br>
                        1. 봇 <b>@logDdochi_Bot</b> 을 연결할 구역 방에 초대해.<br>
                        2. 아래 구역의 <b>"연결"</b> 버튼을 눌러 명령어를 복사해.<br>
                        3. 그 방에 명령어를 붙여넣으면 자동으로 등록돼!
                    </div>

                    <div v-if="loading" style="text-align:center;padding:20px;">불러오는 중...</div>

                    <template v-else>
                        <!-- 팀 탭 -->
                        <div style="display:flex;overflow-x:auto;gap:5px;margin-bottom:15px;padding-bottom:5px;">
                            <div v-for="(team, i) in teams" :key="team.teamId"
                                class="sheet-tab-btn" :class="{ active: activeTabIndex === i }"
                                @click="activeTabIndex = i">
                                {{ team.teamName }}
                            </div>
                        </div>

                        <div v-for="(team, i) in teams" :key="team.teamId" v-show="activeTabIndex === i" class="team-panel">
                            <div class="team-panel-title">{{ team.teamName }} 구역</div>

                            <!-- 팀전체 행 -->
                            <div class="channel-row team-whole-row">
                                <span class="channel-label team-whole-label">지역전체</span>
                                <template v-if="pairing[teamRowKey(team.teamName)]?.active">
                                    <div class="pair-box">
                                        <span class="pair-code">{{ pairing[teamRowKey(team.teamName)].command }}</span>
                                        <button class="row-btn copy" @click="copyTeamCommand(team)">📋 복사</button>
                                        <button class="row-btn cancel" @click="cancelTeamPairing(team)">취소</button>
                                    </div>
                                    <div class="pair-hint">⏳ 방에 명령어를 붙여넣으면 자동으로 등록돼</div>
                                </template>
                                <template v-else-if="pairing[teamRowKey(team.teamName)]?.state === 'expired'">
                                    <span class="channel-value muted">⏰ 코드 만료됨</span>
                                    <button class="row-btn connect" @click="startTeamPairing(team)">재발급</button>
                                </template>
                                <template v-else-if="chatIds[teamRowKey(team.teamName)]">
                                    <span class="channel-value completed" :title="chatIds[teamRowKey(team.teamName)]">
                                        ✅ {{ chatTitles[teamRowKey(team.teamName)] || chatIds[teamRowKey(team.teamName)] }}
                                    </span>
                                    <button class="row-btn rebind" @click="startTeamPairing(team)">🔄 재연결</button>
                                    <button class="row-btn disconnect" @click="disconnectTeam(team)">해제</button>
                                </template>
                                <template v-else>
                                    <span class="channel-value muted">미연결</span>
                                    <button class="row-btn connect" @click="startTeamPairing(team)">연결</button>
                                </template>
                            </div>

                            <div class="team-area-divider"></div>

                            <div v-if="team.areas.length === 0" class="no-areas">등록된 구역이 없어요</div>

                            <div v-for="area in team.areas" :key="area.areaId" class="channel-row">
                                <span class="channel-label">{{ area.areaName }}</span>

                                <!-- 페어링 진행 중 -->
                                <template v-if="pairing[rowKey(team.teamName, area.areaId)]?.active">
                                    <div class="pair-box">
                                        <span class="pair-code">{{ pairing[rowKey(team.teamName, area.areaId)].command }}</span>
                                        <button class="row-btn copy" @click="copyCommand(team, area)">📋 복사</button>
                                        <button class="row-btn cancel" @click="cancelPairing(team, area)">취소</button>
                                    </div>
                                    <div class="pair-hint">⏳ 방에 명령어를 붙여넣으면 자동으로 등록돼</div>
                                </template>

                                <!-- 코드 만료 -->
                                <template v-else-if="pairing[rowKey(team.teamName, area.areaId)]?.state === 'expired'">
                                    <span class="channel-value muted">⏰ 코드 만료됨</span>
                                    <button class="row-btn connect" @click="startPairing(team, area)">재발급</button>
                                </template>

                                <!-- 연결됨 -->
                                <template v-else-if="chatIds[rowKey(team.teamName, area.areaId)]">
                                    <span class="channel-value completed" :title="chatIds[rowKey(team.teamName, area.areaId)]">
                                        ✅ {{ chatTitles[rowKey(team.teamName, area.areaId)] || chatIds[rowKey(team.teamName, area.areaId)] }}
                                    </span>
                                    <button class="row-btn rebind" @click="startPairing(team, area)">🔄 재연결</button>
                                    <button class="row-btn disconnect" @click="disconnect(team, area)">해제</button>
                                </template>

                                <!-- 미연결 -->
                                <template v-else>
                                    <span class="channel-value muted">미연결</span>
                                    <button class="row-btn connect" @click="startPairing(team, area)">연결</button>
                                </template>
                            </div>
                        </div>
                    </template>

                    <div class="btn-group" style="margin-top:15px;">
                        <button class="btn-neg" @click="emit('close')">닫기</button>
                    </div>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
.help-banner {
    font-size: 13px; color: #555; background: #E3F2FD; padding: 15px;
    border-radius: 10px; border: 1px solid #BBDEFB; line-height: 1.6; margin-bottom: 15px;
}
.team-panel { background: #fff; padding: 15px; border-radius: 12px; border: 1px solid #eee; box-shadow: 0 2px 5px rgba(0,0,0,.05); }
.team-panel-title { font-weight: bold; color: #333; margin-bottom: 15px; font-size: 16px; border-bottom: 2px solid #f0f0f0; padding-bottom: 5px; }
.no-areas { font-size: 13px; color: #999; padding: 8px 0; }
.channel-row { display: flex; gap: 6px; margin-bottom: 8px; align-items: flex-start; flex-wrap: wrap; }
.channel-label { font-size: 12px; min-width: 60px; font-weight: bold; color: #3182f6; flex-shrink: 0; padding-top: 10px; }
.channel-value { flex: 1; font-size: 13px; padding: 8px 10px; border-radius: 8px; background: #f5f5f5; min-height: 36px; box-sizing: border-box; display: flex; align-items: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.channel-value.muted { color: #999; font-style: italic; }
.channel-value.completed { background: #E8F5E9; color: #1B5E20; border: 1px solid #C8E6C9; font-weight: 600; }
.pair-box { flex: 1; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.pair-code { flex: 1; font-family: monospace; font-size: 12px; background: #FFF8E1; border: 1px solid #FFE082; border-radius: 8px; padding: 8px 10px; color: #5D4037; word-break: break-all; min-width: 0; }
.pair-hint { width: 100%; font-size: 11px; color: #888; padding-left: 66px; margin-top: -4px; }
.row-btn { border: none; height: 36px; padding: 0 12px; min-width: 50px; border-radius: 8px; font-family: 'Jua'; font-size: 13px; color: #fff; cursor: pointer; flex-shrink: 0; }
.row-btn.connect, .row-btn.rebind { background: #3182f6; }
.row-btn.copy { background: #3182f6; }
.row-btn.cancel { background: #9E9E9E; }
.row-btn.disconnect { background: #EF5350; }
.team-whole-row { background: #F3F4FF; border-radius: 8px; padding: 4px 6px; margin-bottom: 4px; }
.team-whole-label { color: #5B21B6 !important; font-size: 13px !important; }
.team-area-divider { border-top: 1px solid #eee; margin: 6px 0 10px; }
</style>
