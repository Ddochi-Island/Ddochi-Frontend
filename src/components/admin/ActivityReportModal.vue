<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useApi } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'

// [2026-04-22] index2.html openActivityReportSetting / loadActivityReportConfig /
// saveActivityReportMode / testActivityReport (L11066-11201) 이식.
// 활동 현황 전송 설정 (텍스트/이미지/이미지만) — 신규 기능.

const emit = defineEmits(['close'])
const { callApi, callApiPromise } = useApi()
const { showAppAlert } = usePopup()

const step = ref('teamSelect') // teamSelect | config
const teams = ref([])
const selectedTeam = ref('')

const form = reactive({
    mode: 'none',          // none | text | image | image_only
    trigger: 'time',       // time | hourly | event
    time: '22:00',
    rangeStart: '09:00',
    rangeEnd: '23:59'      // 24:00 은 표시/저장 시 변환
})

function loadTeams() {
    callApi('/api/get-teams', {}, (r) => {
        if (!r || !r.success || !r.list?.length) return showAppAlert('팀 정보를 불러오지 못했어.')
        teams.value = r.list
    })
}

async function pickTeam(team) {
    selectedTeam.value = team
    try {
        const [modeRes, teamsRes] = await Promise.all([
            callApiPromise('/api/team-setting/get', { team, key: 'activityReportMode' }),
            callApiPromise('/api/get-teams', {})
        ])
        form.mode = (modeRes && modeRes.value) || 'none'
        const configs = (teamsRes && teamsRes.configs) || {}
        const tc = configs[team] || {}
        form.time = tc.activityReportTime || '22:00'
        form.trigger = tc.activityReportTrigger || 'time'
        form.rangeStart = tc.activityReportRangeStart || '09:00'
        const endSaved = tc.activityReportRangeEnd || '24:00'
        form.rangeEnd = endSaved === '24:00' ? '23:59' : endSaved
        step.value = 'config'
        refreshPreview()
    } catch (err) {
        showAppAlert('설정 로딩 실패: ' + err.message)
    }
}

function backToTeamSelect() {
    step.value = 'teamSelect'
    selectedTeam.value = ''
}

function saveConfig() {
    const team = selectedTeam.value
    if (!team) return
    let rangeEnd = form.rangeEnd || '23:59'
    if (rangeEnd === '23:59') rangeEnd = '24:00'

    // 1) 모드 호환 저장 (team-setting/set)
    callApi('/api/team-setting/set', { team, key: 'activityReportMode', value: form.mode }, () => {})

    // 2) 통합 저장
    callApi('/api/save-activity-report-schedule', {
        team,
        time: form.time,
        trigger: form.trigger,
        mode: form.mode,
        rangeStart: form.rangeStart,
        rangeEnd
    }, (r) => {
        showAppAlert((r && r.message) || '저장 완료', () => refreshPreview())
    })
}

// ── 미리보기 — backend /api/preview-activity-report 호출.
// mode='text'  → previewText 채움
// mode='image' / 'image_only' → previewImageUrl 채움 (렌더 5-10초). previewText 도 같이 옴 (참고용).
const previewText = ref('')
const previewImageUrl = ref('')
const previewLoading = ref(false)
const previewError = ref('')
const previewIsDummy = ref(false)
function refreshPreview() {
    const team = selectedTeam.value
    if (!team) return
    if (form.mode === 'none') {
        previewText.value = ''
        previewImageUrl.value = ''
        previewError.value = ''
        return
    }
    previewLoading.value = true
    previewError.value = ''
    previewImageUrl.value = ''
    callApi('/api/preview-activity-report', {
        team,
        mode: form.mode,
        rangeStart: form.rangeStart,
        rangeEnd: form.rangeEnd,
    }, (r) => {
        previewLoading.value = false
        if (!r?.success) {
            previewError.value = r?.message || '미리보기를 불러오지 못했어'
            return
        }
        previewText.value = r.text || ''
        previewImageUrl.value = r.imageUrl || ''
        previewIsDummy.value = !!r.isDummy
        if (!r.imageUrl && (form.mode === 'image' || form.mode === 'image_only')) {
            // 렌더 실패한 경우 reason 표시
            previewError.value = r.reason ? '이미지 렌더 실패: ' + r.reason : ''
        }
    })
}

function testSend(mode) {
    const team = selectedTeam.value
    if (!team) return
    const now = new Date()
    const y = now.getFullYear().toString().slice(2)
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    const dateStr = `${y}-${m}-${d}`
    showAppAlert('전송 중... 잠시만 기다려줘!')
    callApi('/api/test-activity-report', { team, mode, dateStr }, (r) => {
        showAppAlert((r && r.message) || '완료')
    })
}

onMounted(loadTeams)
</script>

<template>
    <Teleport to="body">
        <div class="modal-overlay" @click.self="emit('close')">
            <div class="admin-modal-card">
                <div class="modal-header-sticky">
                    <div class="modal-title" style="margin:0; text-align:center; width:100%;">📊 활동 현황 전송 설정</div>
                    <span class="modal-close-sticky" style="position:absolute; right:20px;" @click="emit('close')">×</span>
                </div>

                <div class="modal-content-scroll">
                    <!-- 팀 선택 -->
                    <template v-if="step === 'teamSelect'">
                        <div style="text-align:center; margin-bottom:15px; font-size:13px; color:#666;">설정할 팀을 선택해줘!</div>
                        <div v-if="!teams.length" style="text-align:center; padding:20px; color:#888;">팀 정보 불러오는 중...</div>
                        <div v-else class="btn-col">
                            <button v-for="team in teams" :key="team"
                                class="btn-pos" style="background:#37474F; margin-bottom:8px;"
                                @click="pickTeam(team)">{{ team }}</button>
                        </div>
                    </template>

                    <!-- 설정 -->
                    <template v-else>
                        <div style="font-size:15px; font-weight:bold; color:#5D4037; margin-bottom:15px;">📊 {{ selectedTeam }} 활동 현황 설정</div>

                        <label style="font-size:12px; color:#888; font-weight:bold;">전송 모드</label>
                        <div class="input-card" style="margin-bottom:15px;">
                            <select v-model="form.mode"
                                style="width:100%; padding:10px; font-size:14px; font-family:'Jua'; border:none; background:transparent; color:#333;">
                                <option value="none">보내지 않기</option>
                                <option value="text">텍스트 + 복사 버튼</option>
                                <option value="image">이미지 + 복사 버튼</option>
                                <option value="image_only">이미지만 보내기</option>
                            </select>
                        </div>

                        <label style="font-size:12px; color:#888; font-weight:bold;">발송 트리거</label>
                        <div class="input-card" style="margin-bottom:15px;">
                            <select v-model="form.trigger"
                                style="width:100%; padding:10px; font-size:14px; font-family:'Jua'; border:none; background:transparent; color:#333;">
                                <option value="time">⏰ 시간 기반 (정해진 시각)</option>
                                <option value="hourly">🔁 시간당 (매시 정각)</option>
                                <option value="event">⚡ 이벤트 기반 (일정 변동 시)</option>
                            </select>
                        </div>

                        <div v-if="form.trigger === 'time'">
                            <label style="font-size:12px; color:#888; font-weight:bold;">전송 시간 (HH:mm)</label>
                            <div class="input-card" style="margin-bottom:15px;">
                                <input type="time" v-model="form.time"
                                    style="width:100%; padding:10px; font-size:14px; font-family:'Jua'; border:none; background:transparent; color:#333;">
                            </div>
                        </div>

                        <div v-if="form.trigger === 'event'"
                            style="background:#FFF3E0; border-radius:8px; padding:12px; margin-bottom:15px; font-size:12px; color:#E65100; line-height:1.5;">
                            ⚡ 일정 변동(수정) 발생 시 자동으로 발송돼.<br>5분 이내 중복 발송은 무시돼.
                        </div>

                        <div v-if="form.trigger === 'hourly'"
                            style="background:#E8F5E9; border-radius:8px; padding:12px; margin-bottom:15px; font-size:12px; color:#2E7D32; line-height:1.5;">
                            🔁 매시 정각마다 오늘 활동 현황이 발송돼. (09:00 ~ 22:00)
                        </div>

                        <label style="font-size:12px; color:#888; font-weight:bold;">기준 시간 (집계 범위)</label>
                        <div style="display:flex; gap:8px; align-items:center; margin-bottom:5px;">
                            <div class="input-card" style="flex:1; margin:0;">
                                <input type="time" v-model="form.rangeStart"
                                    style="width:100%; padding:10px; font-size:14px; font-family:'Jua'; border:none; background:transparent; color:#333;">
                            </div>
                            <span style="color:#888; font-size:14px;">~</span>
                            <div class="input-card" style="flex:1; margin:0;">
                                <input type="time" v-model="form.rangeEnd"
                                    style="width:100%; padding:10px; font-size:14px; font-family:'Jua'; border:none; background:transparent; color:#333;">
                            </div>
                        </div>
                        <div style="font-size:11px; color:#888; margin-bottom:15px;">일정이 이 시간 범위 안에 있는 것만 집계돼요</div>

                        <button class="btn-pos" style="width:100%; background:#37474F; margin-bottom:10px;" @click="saveConfig">💾 설정 저장</button>

                        <div v-if="form.mode !== 'none'" style="border-top:1px dashed #ccc; margin:15px 0; padding-top:15px;">
                            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
                                <div style="font-size:12px; color:#888; font-weight:bold;">📨 전송 미리보기</div>
                                <button class="ar-refresh" @click="refreshPreview">🔄</button>
                            </div>
                            <div v-if="previewLoading" class="ar-preview ar-loading">
                                {{ form.mode === 'text' ? '불러오는 중... ⏳' : '🖼️ 이미지 렌더링 중... (5-10초)' }}
                            </div>
                            <div v-else-if="previewError" class="ar-preview ar-err">⛔ {{ previewError }}</div>
                            <template v-else>
                                <div v-if="previewIsDummy" class="ar-dummy-banner">
                                    🧪 해당 날짜에 등록된 일정이 없어. 샘플 데이터로 미리 보여줄게.
                                </div>
                                <img v-if="previewImageUrl" :src="previewImageUrl" class="ar-preview-img" />
                                <pre v-if="previewText && form.mode === 'text'" class="ar-preview">{{ previewText }}</pre>
                                <pre v-else-if="previewText && form.mode === 'image'" class="ar-preview ar-preview-collapsed">{{ previewText }}</pre>
                            </template>
                        </div>

                        <div style="border-top:1px dashed #ccc; margin:15px 0; padding-top:15px;">
                            <div style="font-size:13px; color:#666; text-align:center; margin-bottom:10px;">테스트 전송 (오늘 일정 기준)</div>
                            <div class="btn-col" style="gap:8px;">
                                <button class="btn-pos" style="background:#1976D2;" @click="testSend('text')">📝 텍스트 테스트</button>
                                <button class="btn-pos" style="background:#7B1FA2;" @click="testSend('image')">🖼️ 이미지 + 복사 버튼</button>
                                <button class="btn-pos" style="background:#5E35B1;" @click="testSend('image_only')">🖼️ 이미지만</button>
                            </div>
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
.ar-preview {
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
.ar-preview.ar-loading { color: #888; text-align: center; }
.ar-preview.ar-err { color: #C62828; }
.ar-preview.ar-preview-collapsed { max-height: 120px; opacity: 0.7; }
.ar-preview-img {
    width: 100%;
    border-radius: 8px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.1);
    margin-bottom: 8px;
}
.ar-refresh {
    background: none;
    border: 1px solid #ddd;
    border-radius: 6px;
    padding: 3px 8px;
    cursor: pointer;
    font-family: inherit;
    font-size: 12px;
}
.ar-refresh:hover { background: #f5f5f5; }
.ar-dummy-banner {
    background: #FFF8E1;
    border: 1px dashed #F9A825;
    color: #6D4C41;
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 12px;
    margin-bottom: 8px;
}
</style>
