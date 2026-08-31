<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useApi } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'

// [2026-04-22] index2.html openActivityCoordSetting / loadActivityCoordConfig /
// saveActivityCoordConfig / triggerActivityCoordNow (L9442-9571) 이식.
// 활동소통 (대학 너 나와) 설정 — 신규 기능.

const emit = defineEmits(['close'])
const { callApi } = useApi()
const { showAppAlert } = usePopup()

const step = ref('teamSelect') // teamSelect | config
const teams = ref([])
const selectedTeam = ref('')
const hasChatId = ref(false)

const form = reactive({
    mode: 'none',        // none | time
    preset: 'custom',    // custom | preset1 | preset2
    boreumTitle: '보름달 모임(21-22) - 미달성 모임',
    customContent: '',
    sendTimes: ''        // HH:MM
})

function loadTeams() {
    callApi('/api/get-teams', {}, (r) => {
        if (!r || !r.success || !r.list?.length) return showAppAlert('팀 정보를 불러오지 못했어.')
        teams.value = r.list
    })
}

function pickTeam(team) {
    selectedTeam.value = team
    callApi('/api/get-teams', {}, (r) => {
        const configs = (r && r.configs) || {}
        const tc = configs[team] || {}
        form.mode = tc.activityCoordMode || 'none'
        form.preset = tc.activityCoordPreset || 'custom'
        form.boreumTitle = tc.activityCoordBoreumTitle || '보름달 모임(21-22) - 미달성 모임'
        form.customContent = tc.activityCoordCustomContent || ''
        form.sendTimes = tc.activityCoordTimes || ''
        hasChatId.value = !!tc.activityCoordChatId
        step.value = 'config'
        refreshPreview()
    })
}

function backToTeamSelect() {
    step.value = 'teamSelect'
    selectedTeam.value = ''
}

function saveConfig() {
    const team = selectedTeam.value
    if (!team) return
    callApi('/api/save-activity-coord-config', {
        team,
        mode: form.mode,
        preset: form.preset,
        boreumTitle: form.boreumTitle,
        customContent: form.customContent,
        sendTimes: form.sendTimes
    }, (r) => {
        showAppAlert((r && r.message) || '저장 완료', () => refreshPreview())
    })
}

function triggerNow() {
    const team = selectedTeam.value
    if (!team) return
    showAppAlert('전송 중...')
    callApi('/api/trigger-activity-coord', { team }, (r) => {
        showAppAlert((r && r.message) || '전송 시도 완료')
    })
}

// ── 미리보기 — backend /api/preview-activity-coord 호출.
// 실제 발송될 메시지와 동일 (generateActivityCoordMessage).
const previewText = ref('')
const previewLoading = ref(false)
const previewError = ref('')
function refreshPreview() {
    const team = selectedTeam.value
    if (!team) return
    previewLoading.value = true
    previewError.value = ''
    callApi('/api/preview-activity-coord', { team }, (r) => {
        previewLoading.value = false
        if (!r?.success) {
            previewError.value = r?.message || '미리보기를 불러오지 못했어'
            return
        }
        previewText.value = r.text || ''
    })
}

onMounted(loadTeams)
</script>

<template>
    <Teleport to="body">
        <div class="modal-overlay" @click.self="emit('close')">
            <div class="admin-modal-card">
                <div class="modal-header-sticky">
                    <div class="modal-title" style="margin:0; text-align:center; width:100%;">🫵 활동소통 설정</div>
                    <span class="modal-close-sticky" style="position:absolute; right:20px;" @click="emit('close')">×</span>
                </div>

                <div class="modal-content-scroll">
                    <!-- 팀 선택 -->
                    <template v-if="step === 'teamSelect'">
                        <div style="text-align:center; margin-bottom:15px; font-size:13px; color:#666;">설정할 팀을 선택해줘!</div>
                        <div v-if="!teams.length" style="text-align:center; padding:20px; color:#888;">팀 정보 불러오는 중...</div>
                        <div v-else class="btn-col">
                            <button v-for="team in teams" :key="team"
                                class="btn-pos" style="background:#E91E63; margin-bottom:8px;"
                                @click="pickTeam(team)">{{ team }}</button>
                        </div>
                    </template>

                    <!-- 설정 -->
                    <template v-else>
                        <div style="font-size:15px; font-weight:bold; color:#5D4037; margin-bottom:15px;">🫵 {{ selectedTeam }} 활동소통 설정</div>

                        <div v-if="!hasChatId"
                            style="font-size:12px; color:#E65100; background:#FFF3E0; padding:10px; border-radius:8px; margin-bottom:15px; line-height:1.5;">
                            💡 텔레그램 연결 화면에서 '활동소통' 채팅방을 먼저 연결해줘!
                        </div>

                        <label style="font-size:12px; color:#888; font-weight:bold;">발송 방식</label>
                        <div class="input-card" style="margin-bottom:15px;">
                            <select v-model="form.mode"
                                style="width:100%; padding:10px; font-size:14px; font-family:'Jua'; border:none; background:transparent; color:#333;">
                                <option value="none">전송 안함 (수동만)</option>
                                <option value="time">⏰ 시간 기반 (정해진 시각)</option>
                            </select>
                        </div>

                        <div v-if="form.mode === 'time'">
                            <label style="font-size:12px; color:#888; font-weight:bold;">전송 시각 (하루 1회)</label>
                            <div class="input-card" style="margin-bottom:15px;">
                                <input type="time" v-model="form.sendTimes"
                                    style="width:100%; padding:10px; font-size:14px; font-family:'Jua'; border:none; background:transparent; color:#333;">
                            </div>
                        </div>

                        <label style="font-size:12px; color:#888; font-weight:bold;">이외 활동 섹션 타이틀</label>
                        <div class="input-card" style="margin-bottom:15px;">
                            <input type="text" v-model="form.boreumTitle"
                                style="width:100%; padding:10px; font-size:14px; font-family:'Jua'; border:none; background:transparent; color:#333;">
                        </div>

                        <label style="font-size:12px; color:#888; font-weight:bold;">이외 활동 섹션 표시 방식</label>
                        <div class="input-card" style="margin-bottom:10px;">
                            <select v-model="form.preset"
                                style="width:100%; padding:10px; font-size:14px; font-family:'Jua'; border:none; background:transparent; color:#333;">
                                <option value="custom">✏️ 직접 입력</option>
                                <option value="preset1">🍎 프리셋1 — 오프라인 미편성자 (사유 확인)</option>
                                <option value="preset2">🌙 프리셋2 — 추가 활동 가능자 (저녁 공백)</option>
                            </select>
                        </div>

                        <div v-if="form.preset === 'preset1'"
                            style="background:#FFEBEE; border-radius:8px; padding:10px; margin-bottom:15px; font-size:11px; color:#C62828; line-height:1.5;">
                            🍎 오늘 일정에 오프라인/인도 블록이 <b>하나도 없는</b> 팀원을 자동 나열해.<br>
                            이름 뒤 <code>/</code> 는 비워두니 단톡방에서 사유를 채워 넣으면 돼.
                        </div>

                        <div v-if="form.preset === 'preset2'"
                            style="background:#E8EAF6; border-radius:8px; padding:10px; margin-bottom:15px; font-size:11px; color:#283593; line-height:1.5;">
                            🌙 오프라인/인도 계획은 있지만 <b>18시 이후가 비어있는</b> 팀원을 자동 나열해.<br>
                            저녁 추가 활동 가능 여부를 확인할 대상이야.
                        </div>

                        <div v-if="form.preset === 'custom'">
                            <label style="font-size:12px; color:#888; font-weight:bold;">직접 입력 내용</label>
                            <div class="input-card" style="margin-bottom:15px;">
                                <textarea v-model="form.customContent" rows="6"
                                    placeholder="예: 1/홍길동(직장 매칭)&#10;2/ 홍길동&#10;..."
                                    style="width:100%; padding:10px; font-size:13px; font-family:'Jua'; border:none; background:transparent; color:#333; resize:vertical;"></textarea>
                            </div>
                        </div>

                        <button class="btn-pos" style="width:100%; background:#E91E63; margin-bottom:10px;" @click="saveConfig">💾 설정 저장</button>

                        <div style="border-top:1px dashed #ccc; margin:15px 0; padding-top:15px;">
                            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
                                <div style="font-size:12px; color:#888; font-weight:bold;">📨 전송 미리보기</div>
                                <button class="ac-refresh" @click="refreshPreview">🔄</button>
                            </div>
                            <div v-if="previewLoading" class="ac-preview ac-loading">불러오는 중... ⏳</div>
                            <div v-else-if="previewError" class="ac-preview ac-err">⛔ {{ previewError }}</div>
                            <pre v-else class="ac-preview">{{ previewText || '(미리보기 비어있음)' }}</pre>
                            <div style="font-size:11px; color:#888; text-align:center; margin-bottom:8px; margin-top:8px;">수동 전송은 아래 버튼으로 언제든 가능</div>
                            <button class="btn-pos" style="width:100%; background:#AD1457;" @click="triggerNow">📤 지금 바로 전송</button>
                        </div>

                        <div class="btn-group" style="margin-top:15px;">
                            <button class="btn-neg" @click="backToTeamSelect">팀 다시 선택</button>
                        </div>
                    </template>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
.ac-preview {
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
    margin: 0 0 6px 0;
}
.ac-preview.ac-loading { color: #888; text-align: center; }
.ac-preview.ac-err { color: #C62828; }
.ac-refresh {
    background: none;
    border: 1px solid #ddd;
    border-radius: 6px;
    padding: 3px 8px;
    cursor: pointer;
    font-family: inherit;
    font-size: 12px;
}
.ac-refresh:hover { background: #f5f5f5; }
</style>
