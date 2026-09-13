<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useApi } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'

// [2026-04-22] index2.html openCurrentScheduleSetting / loadCurrentScheduleConfig /
// saveCurrentScheduleConfig / triggerCurrentScheduleNow (L9238-9333) 이식.
// "지금 우리 시온산은" 현재일정 설정 — 신규 기능.

const emit = defineEmits(['close'])
const { callApi } = useApi()
const { showAppAlert } = usePopup()

const step = ref('teamSelect') // teamSelect | config
const teams = ref([])
const selectedTeam = ref('')

const form = reactive({
    mode: 'none',    // none | time | hourly | event
    times: ''        // "HH:mm,HH:mm,..."
})

function loadTeams() {
    callApi('/api/get-teams', {}, (r) => {
        if (!r || !r.success || !r.list?.length) return showAppAlert('지역 정보를 불러오지 못했어.')
        teams.value = r.list
    })
}

function pickTeam(team) {
    selectedTeam.value = team
    callApi('/api/get-teams', {}, (r) => {
        const configs = (r && r.configs) || {}
        const tc = configs[team] || {}
        form.mode = tc.currentScheduleMode || 'none'
        form.times = tc.currentScheduleTimes || ''
        step.value = 'config'
        refreshPreview()
    })
}

// ── 미리보기 — backend /api/preview-current-schedule (현재 시각 기준).
const previewText = ref('')
const previewLoading = ref(false)
const previewError = ref('')
const previewHtml = ref(false)
function refreshPreview() {
    const team = selectedTeam.value
    if (!team) return
    previewLoading.value = true
    previewError.value = ''
    callApi('/api/preview-current-schedule', { team }, (r) => {
        previewLoading.value = false
        if (!r?.success) {
            previewError.value = r?.message || '미리보기를 불러오지 못했어'
            return
        }
        previewText.value = r.text || ''
        previewHtml.value = !!r.html
    })
}

function backToTeamSelect() {
    step.value = 'teamSelect'
    selectedTeam.value = ''
}

function saveConfig() {
    const team = selectedTeam.value
    if (!team) return
    callApi('/api/save-current-schedule-config', {
        team,
        mode: form.mode,
        times: (form.times || '').trim()
    }, (r) => {
        showAppAlert((r && r.message) || '저장 완료', () => refreshPreview())
    })
}

function triggerNow() {
    const team = selectedTeam.value
    if (!team) return
    showAppAlert('전송 중...')
    callApi('/api/trigger-current-schedule', { team }, (r) => {
        showAppAlert((r && r.message) || '전송 시도 완료')
    })
}

onMounted(loadTeams)
</script>

<template>
    <Teleport to="body">
        <div class="modal-overlay" @click.self="emit('close')">
            <div class="admin-modal-card">
                <div class="modal-header-sticky">
                    <div class="modal-title" style="margin:0; text-align:center; width:100%;">⛰️ 지금 우리 시온산은 설정</div>
                    <span class="modal-close-sticky" style="position:absolute; right:20px;" @click="emit('close')">×</span>
                </div>

                <div class="modal-content-scroll">
                    <!-- 팀 선택 -->
                    <template v-if="step === 'teamSelect'">
                        <div style="text-align:center; margin-bottom:15px; font-size:13px; color:#666;">설정할 지역을 선택해줘!</div>
                        <div v-if="!teams.length" style="text-align:center; padding:20px; color:#888;">지역 정보 불러오는 중...</div>
                        <div v-else class="btn-col">
                            <button v-for="team in teams" :key="team"
                                class="btn-pos" style="background:#6A1B9A; margin-bottom:8px;"
                                @click="pickTeam(team)">{{ team }}</button>
                        </div>
                    </template>

                    <!-- 설정 -->
                    <template v-else>
                        <div style="font-size:15px; font-weight:bold; color:#5D4037; margin-bottom:10px;">⛰️ {{ selectedTeam }} 시온산은 설정</div>
                        <div style="font-size:13px; color:#666; text-align:center; margin-bottom:20px;">
                            현재 시각의 일정/변동 내역을 텔레그램으로 자동 발송해!
                        </div>

                        <label style="font-size:12px; color:#888; font-weight:bold;">발송 방식</label>
                        <div class="input-card" style="margin-bottom:15px;">
                            <select v-model="form.mode"
                                style="width:100%; padding:10px; font-size:14px; font-family:'Jua'; border:none; background:transparent; color:#333;">
                                <option value="none">전송 안함</option>
                                <option value="time">⏰ 시간 기반 (정해진 시각)</option>
                                <option value="hourly">🔁 시간당 (매시 정각)</option>
                                <option value="event">⚡ 이벤트 기반 (일정 변동 시)</option>
                            </select>
                        </div>

                        <div v-if="form.mode === 'time'">
                            <label style="font-size:12px; color:#888; font-weight:bold;">전송 시각 (콤마로 구분)</label>
                            <div class="input-card" style="margin-bottom:5px;">
                                <input type="text" v-model="form.times" placeholder="HH:mm,HH:mm,..."
                                    style="width:100%; padding:10px; font-size:14px; font-family:'Jua'; border:none; background:transparent; color:#333;">
                            </div>
                            <div style="font-size:11px; color:#888; margin-bottom:15px;">예: 09:00,12:00,15:00,18:00</div>
                        </div>

                        <div v-if="form.mode === 'hourly'"
                            style="background:#E8F5E9; border-radius:8px; padding:12px; margin-bottom:15px; font-size:12px; color:#2E7D32; line-height:1.5;">
                            🔁 매시 정각마다 자동으로 발송돼. (09:00 ~ 22:00)
                        </div>

                        <div v-if="form.mode === 'event'"
                            style="background:#FFF3E0; border-radius:8px; padding:12px; margin-bottom:15px; font-size:12px; color:#E65100; line-height:1.5;">
                            ⚡ 일정 변동(수정)이 발생할 때마다 자동으로 발송돼.<br>너무 자주 발송되지 않도록 5분 이내 중복은 무시돼.
                        </div>

                        <button class="btn-pos" style="width:100%; background:#6A1B9A; margin-bottom:10px;" @click="saveConfig">💾 설정 저장</button>

                        <div style="border-top:1px dashed #ccc; margin:15px 0; padding-top:15px;">
                            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
                                <div style="font-size:12px; color:#888; font-weight:bold;">📨 전송 미리보기 (현재 시각 기준)</div>
                                <button class="cs-refresh" @click="refreshPreview">🔄</button>
                            </div>
                            <div v-if="previewLoading" class="cs-preview cs-loading">불러오는 중... ⏳</div>
                            <div v-else-if="previewError" class="cs-preview cs-err">⛔ {{ previewError }}</div>
                            <pre v-else-if="previewHtml" class="cs-preview" v-html="previewText"></pre>
                            <pre v-else class="cs-preview">{{ previewText || '(미리보기 비어있음)' }}</pre>
                        </div>

                        <div style="border-top:1px dashed #ccc; margin:15px 0; padding-top:15px;">
                            <button class="btn-pos" style="width:100%; background:#8E24AA;" @click="triggerNow">📤 지금 바로 테스트 전송</button>
                        </div>

                        <div class="btn-group" style="margin-top:15px;">
                            <button class="btn-neg" @click="backToTeamSelect">지역 다시 선택</button>
                        </div>
                    </template>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
.cs-preview {
    background: #FAFAFA;
    border: 1px solid #eee;
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 12px;
    line-height: 1.5;
    color: #333;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: inherit;
    max-height: 320px;
    overflow-y: auto;
    margin: 0;
}
.cs-preview.cs-loading { color: #888; text-align: center; }
.cs-preview.cs-err { color: #C62828; }
.cs-preview :deep(b) { font-weight: bold; }
.cs-preview :deep(code) {
    background: #ECEFF1;
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 11px;
}
.cs-refresh {
    background: none;
    border: 1px solid #ddd;
    border-radius: 6px;
    padding: 3px 8px;
    cursor: pointer;
    font-family: inherit;
    font-size: 12px;
}
.cs-refresh:hover { background: #f5f5f5; }
</style>
