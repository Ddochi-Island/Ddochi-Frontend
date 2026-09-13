<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { useApi } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'

const emit = defineEmits(['close'])
const { callApi } = useApi()
const { showAppAlert, showToast } = usePopup()

const CHANNEL_DEFS = [
    { key: 'dashboard',       field: 'chatId',                label: '대시보드',   color: '#5D4037' },
    { key: 'stats',           field: 'statsChatId',           label: '통계방',     color: '#1565C0' },
    { key: 'schedule',        field: 'scheduleChatId',        label: '일정방',     color: '#FF9800' },
    { key: 'activityReport',  field: 'activityReportChatId',  label: '일정통계',   color: '#37474F' },
    { key: 'currentSchedule', field: 'currentScheduleChatId', label: '현재일정',   color: '#6A1B9A' },
    { key: 'matching',        field: 'matchingChatId',        label: '매칭현황판', color: '#00838F' },
    { key: 'prospect',        field: 'prospectChatId',        label: '찾기현황',   color: '#E65100' },
    { key: 'feedback',        field: 'feedbackChatId',        label: '매칭피드',   color: '#827717' },
    { key: 'prayer',          field: 'prayerChatId',          label: '기도문',     color: '#9C27B0' },
    { key: 'returnHome',      field: 'returnHomeChatId',      label: '귀소할일',   color: '#4CAF50' },
    { key: 'community',       field: 'communityChatId',       label: '커뮤니티',   color: '#009688' },
    { key: 'activityCoord',   field: 'activityCoordChatId',   label: '활동소통',   color: '#E91E63' },
    { key: 'sheetDashboard',  field: 'sheetDashboardChatId',  label: '섭외명단',   color: '#3949AB' },
    { key: 'talkDashboard',   field: 'talkDashboardChatId',   label: '말걸기',     color: '#00695C' }
]

const SHED_CHANNEL_DEFS = [
    { key: 'tmDash',       field: 'tmDashChatId',       label: 'Shed TM현황',     color: '#B71C1C' },
    { key: 'shedUnified',  field: 'shedUnifiedChatId',  label: '통합현황판',       color: '#1B5E20' },
    { key: 'schedDash',    field: 'schedDashChatId',    label: '예약타임테이블',    color: '#0277BD' },
]

const teams = ref([])
const teamIdMap = ref({})   // displayName → team_id
const activeTabIndex = ref(0)
const loading = ref(true)

// 팀별 발송 잡 ON/OFF
const JOB_LABELS = {
    sendMorningBriefing:   '📋 아침 브리핑',
    sendStats:             '📊 지역 통계',
    sendMatchingDashboard: '🛡️ 매칭 현황판',
    sendProspectDashboard: '🔎 찾기 현황판',
    sendFeedbackDashboard: '💬 매칭 피드백',
    sendCheckin:           '✅ 점호 DM',
    sendPrayer:            '🙏 기도문',
    sendReturnHome:        '🏠 귀가 알림',
    sendCurrentSchedule:   '📅 현재 일정',
    sendSheetDashboard:    '📋 섭외명단 대시보드',
    sendTalkDashboard:     '🗣️ 말걸기 대시보드',
}

const SHED_JOB_LABELS = {
    sendShedTmDashboard:        '🐾📞 TM현황 발송',
    updateShedTmDashboard:      '🔄 TM현황 갱신',
    sendShedUnifiedDashboard:   '📢 통합현황판 발송',
    updateShedUnifiedDashboard: '🔄 통합현황판 갱신',
}

const SHED246_JOB_LABELS = {
    sendShed246TmDashboard:        '🐾📞 TM현황 발송',
    updateShed246TmDashboard:      '🔄 TM현황 갱신',
    sendShed246Dashboard:          '📢 통합현황판 발송',
    updateShed246Dashboard:        '🔄 통합현황판 갱신',
    sendShed246SchedDashboard:     '📅 예약타임테이블 발송',
    updateShed246SchedDashboard:   '🔄 예약타임테이블 갱신',
}

function getChannelDefs(team) {
    if (team === '135 연합' || team === '246 연합') return SHED_CHANNEL_DEFS
    return CHANNEL_DEFS
}

function getJobLabels(team) {
    if (team === '135 연합') return SHED_JOB_LABELS
    if (team === '246 연합') return SHED246_JOB_LABELS
    return JOB_LABELS
}
// teamCronJobs[teamId][handler] = boolean (true=ON)
const teamCronJobs = ref({})
const cronLoading = ref(false)

function loadTeamCronConfig() {
    cronLoading.value = true
    callApi('/api/get-team-cron-config', {}, (r) => {
        cronLoading.value = false
        if (!r?.success) return
        // 백엔드 응답은 team_id 키 → display name 키로 변환
        const byId = r.teams || {}
        const map = {}
        for (const [teamId, info] of Object.entries(byId)) {
            const name = info.name
            map[name] = info.cronJobs || {}
        }
        teamCronJobs.value = map
    })
}

function isJobEnabled(teamName, handler) {
    return teamCronJobs.value[teamName]?.[handler] !== false
}

function toggleTeamJob(teamName, handler) {
    const next = !isJobEnabled(teamName, handler)
    const teamId = teamIdMap.value[teamName] || teamName
    callApi('/api/set-team-cron-job', { teamId, handler, enabled: next }, (r) => {
        if (!r?.success) { showAppAlert(r?.message || '변경 실패'); return }
        if (!teamCronJobs.value[teamName]) teamCronJobs.value[teamName] = {}
        teamCronJobs.value[teamName][handler] = next
        showToast(`${JOB_LABELS[handler]} ${next ? 'ON ✅' : 'OFF ⏸'}`)
    })
}
// chatIds[team][channelKey] = string
const chatIds = reactive({})
// chatTitles[team][channelKey] = string (방 이름)
const chatTitles = reactive({})
// pairing[team__key] = { active, code, command, state: null|'pending'|'completed'|'expired' }
const pairing = ref({})
// timers per key
const timers = {}

function rowKey(team, chKey) { return `${team}__${chKey}` }

function loadTeams() {
    loading.value = true
    callApi('/api/get-teams', {}, (r) => {
        loading.value = false
        if (!r || !r.success) { showAppAlert('지역 정보를 불러오지 못했어.'); return }
        teams.value = r.list || []
        const map = {}
        for (const t of (r.teams || [])) map[t.name] = t.id
        teamIdMap.value = map
        const srcConfigs = r.configs || {}
        for (const team of teams.value) {
            const tc = srcConfigs[team] || {}
            chatIds[team] = {}
            chatTitles[team] = {}
            const defs = getChannelDefs(team)
            for (const ch of defs) {
                chatIds[team][ch.key] = tc[ch.field] || ''
                chatTitles[team][ch.key] = tc[ch.field.replace(/Id$/, 'Title')] || ''
            }
        }
    })
}

function startPairing(team, ch) {
    const k = rowKey(team, ch.key)
    callApi('/api/telegram-pair/start', { team, channelType: ch.key }, (r) => {
        if (!r || !r.success) { showAppAlert(r?.message || '코드 생성 실패'); return }
        pairing.value = { ...pairing.value, [k]: { active: true, code: r.code, command: r.command, state: 'pending' } }
        startPolling(team, ch)
    })
}

function startPolling(team, ch) {
    const k = rowKey(team, ch.key)
    if (timers[k]) clearInterval(timers[k])
    timers[k] = setInterval(() => pollStatus(team, ch), 3000)
}

function pollStatus(team, ch) {
    const k = rowKey(team, ch.key)
    if (!pairing.value[k]?.active) { clearInterval(timers[k]); return }
    callApi('/api/telegram-pair/status', { team, channelType: ch.key }, (r) => {
        if (!r || !r.success) return
        if (r.state === 'completed') {
            clearInterval(timers[k])
            chatIds[team][ch.key] = r.chatId || ''
            chatTitles[team][ch.key] = r.chatTitle || ''
            pairing.value = { ...pairing.value, [k]: { active: false, state: 'completed' } }
            showToast(`✅ ${ch.label} 연결됨!`)
        } else if (r.state === 'expired') {
            clearInterval(timers[k])
            pairing.value = { ...pairing.value, [k]: { active: false, state: 'expired' } }
        }
    })
}

function disconnect(team, ch) {
    showAppAlert(`${ch.label} 연결을 해제할까요?`, () => {
        callApi('/api/telegram-pair/disconnect', { team, channelType: ch.key }, (r) => {
            if (!r?.success) { showAppAlert(r?.message || '해제 실패'); return }
            chatIds[team][ch.key] = ''
            chatTitles[team][ch.key] = ''
            showToast(`${ch.label} 연결 해제 완료`)
        })
    }, { confirm: true })
}

function cancelPairing(team, ch) {
    const k = rowKey(team, ch.key)
    clearInterval(timers[k])
    pairing.value = { ...pairing.value, [k]: { active: false } }
    callApi('/api/telegram-pair/cancel', { team, channelType: ch.key }, () => {})
}

function copyCommand(team, ch) {
    const k = rowKey(team, ch.key)
    const cmd = pairing.value[k]?.command
    if (!cmd) return
    navigator.clipboard.writeText(cmd).then(() => showToast('📋 복사됐어!')).catch(() => {
        showAppAlert(`복사할 명령어:\n${cmd}`)
    })
}

onMounted(() => { loadTeams(); loadTeamCronConfig() })
onUnmounted(() => {
    for (const id of Object.values(timers)) clearInterval(id)
})
</script>

<template>
    <Teleport to="body">
        <div class="modal-overlay" @click.self="emit('close')">
            <div class="admin-modal-card">
                <div class="modal-header-sticky">
                    <div style="display:flex; align-items:center; justify-content:center; width:100%;">
                        <div class="modal-title" style="margin:0;">💬 텔레그램 설정</div>
                    </div>
                    <span class="modal-close-sticky" style="position:absolute; right:20px;" @click="emit('close')">×</span>
                </div>

                <div class="modal-content-scroll">
                    <div class="help-banner">
                        <b>📋 채널 연결 방법</b><br>
                        1. 봇 <b>@logDdochi_Bot</b> 을 연결할 채널/단톡방에 초대해.<br>
                        2. 아래 채널의 <b>"연결"</b> 버튼을 눌러 명령어를 복사해.<br>
                        3. 그 방에 명령어를 붙여넣으면 자동으로 등록돼!
                    </div>

                    <div v-if="loading" style="text-align:center; padding:20px;">지역 정보 불러오는 중...</div>

                    <template v-else>
                        <div style="display:flex; overflow-x:auto; gap:5px; margin-bottom:15px; padding-bottom:5px;">
                            <div v-for="(team, i) in teams" :key="team" class="sheet-tab-btn"
                                :class="{ active: activeTabIndex === i }" @click="activeTabIndex = i">
                                {{ team }}
                            </div>
                        </div>

                        <div v-for="(team, i) in teams" :key="team" v-show="activeTabIndex === i" class="team-panel">
                            <div class="team-panel-title">{{ team }} 설정</div>

                            <!-- 팀별 발송 잡 ON/OFF -->
                            <div class="cron-section-inline">
                                <div class="cron-section-title">⏰ 발송 잡 ON/OFF</div>
                                <div v-if="cronLoading" class="cron-loading">불러오는 중...</div>
                                <div v-else class="cron-grid">
                                    <button
                                        v-for="(label, handler) in getJobLabels(team)" :key="handler"
                                        class="cron-chip"
                                        :class="isJobEnabled(team, handler) ? 'on' : 'off'"
                                        @click="toggleTeamJob(team, handler)"
                                    >{{ label }}</button>
                                </div>
                            </div>

                            <div v-for="ch in getChannelDefs(team)" :key="ch.key" class="channel-row">
                                <span class="channel-label" :style="{ color: ch.color }">{{ ch.label }}</span>

                                <!-- 페어링 진행 중 -->
                                <template v-if="pairing[rowKey(team, ch.key)]?.active">
                                    <div class="pair-box">
                                        <span class="pair-code">{{ pairing[rowKey(team, ch.key)].command }}</span>
                                        <button class="row-btn copy" :style="{ background: ch.color }"
                                            @click="copyCommand(team, ch)">📋 복사</button>
                                        <button class="row-btn cancel" @click="cancelPairing(team, ch)">취소</button>
                                    </div>
                                    <div class="pair-hint">⏳ 방에 명령어를 붙여넣으면 자동으로 등록돼</div>
                                </template>

                                <!-- 코드 만료 -->
                                <template v-else-if="pairing[rowKey(team, ch.key)]?.state === 'expired'">
                                    <span class="channel-value muted">⏰ 코드 만료됨</span>
                                    <button class="row-btn connect" :style="{ background: ch.color }"
                                        @click="startPairing(team, ch)">재발급</button>
                                </template>

                                <!-- 연결됨 -->
                                <template v-else-if="chatIds[team]?.[ch.key]">
                                    <span class="channel-value completed"
                                        :title="chatIds[team][ch.key]">
                                        ✅ {{ chatTitles[team]?.[ch.key] || chatIds[team][ch.key] }}
                                    </span>
                                    <button class="row-btn rebind" :style="{ background: ch.color }"
                                        @click="startPairing(team, ch)">🔄 재연결</button>
                                    <button class="row-btn disconnect"
                                        @click="disconnect(team, ch)">해제</button>
                                </template>

                                <!-- 미연결 -->
                                <template v-else>
                                    <span class="channel-value muted">미연결</span>
                                    <button class="row-btn connect" :style="{ background: ch.color }"
                                        @click="startPairing(team, ch)">연결</button>
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
    font-size: 13px;
    color: #555;
    background: #E3F2FD;
    padding: 15px;
    border-radius: 10px;
    border: 1px solid #BBDEFB;
    text-align: left;
    line-height: 1.6;
    margin-bottom: 15px;
}
.team-panel {
    background: #fff;
    padding: 15px;
    border-radius: 12px;
    border: 1px solid #eee;
    box-shadow: 0 2px 5px rgba(0,0,0,0.05);
}
.team-panel-title {
    font-weight: bold;
    color: #333;
    margin-bottom: 15px;
    font-size: 16px;
    border-bottom: 2px solid #f0f0f0;
    padding-bottom: 5px;
}
.channel-row {
    display: flex;
    gap: 6px;
    margin-bottom: 8px;
    align-items: flex-start;
    flex-wrap: wrap;
}
.channel-label {
    font-size: 12px;
    width: 55px;
    font-weight: bold;
    flex-shrink: 0;
    padding-top: 10px;
}
.channel-value {
    flex: 1;
    font-size: 13px;
    padding: 8px 10px;
    border-radius: 8px;
    background: #f5f5f5;
    min-height: 36px;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.channel-value.muted { color: #999; font-style: italic; }
.channel-value.completed {
    background: #E8F5E9;
    color: #1B5E20;
    border: 1px solid #C8E6C9;
    font-weight: 600;
}
.pair-box {
    flex: 1;
    display: flex;
    gap: 6px;
    align-items: center;
    flex-wrap: wrap;
}
.pair-code {
    flex: 1;
    font-family: monospace;
    font-size: 12px;
    background: #FFF8E1;
    border: 1px solid #FFE082;
    border-radius: 8px;
    padding: 8px 10px;
    color: #5D4037;
    word-break: break-all;
    min-width: 0;
}
.pair-hint {
    width: 100%;
    font-size: 11px;
    color: #888;
    padding-left: 61px;
    margin-top: -4px;
}
.row-btn {
    border: none;
    height: 36px;
    padding: 0 12px;
    min-width: 50px;
    border-radius: 8px;
    font-family: 'Jua';
    font-size: 13px;
    color: #fff;
    cursor: pointer;
    flex-shrink: 0;
}
.row-btn.cancel { background: #9E9E9E; }
.row-btn.disconnect { background: #EF5350; }
.row-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.cron-section-inline {
    background: #F9FBE7;
    border: 1px solid #F0F4C3;
    border-radius: 10px;
    padding: 10px 12px;
    margin-bottom: 12px;
}
.cron-section-title {
    font-size: 12px;
    font-weight: bold;
    color: #558B2F;
    margin-bottom: 8px;
}
.cron-loading { font-size: 12px; color: #999; }
.cron-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}
.cron-chip {
    border: none;
    border-radius: 20px;
    padding: 5px 10px;
    font-family: 'Jua';
    font-size: 12px;
    cursor: pointer;
    transition: opacity 0.15s;
}
.cron-chip.on  { background: #4CAF50; color: #fff; }
.cron-chip.off { background: #e0e0e0; color: #888; text-decoration: line-through; }
</style>
