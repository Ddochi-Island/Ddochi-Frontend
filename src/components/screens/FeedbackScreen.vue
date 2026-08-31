<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useApi } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'

const router = useRouter()
const auth = useAuthStore()
const { callApiPromise } = useApi()
const { showAppAlert } = usePopup()

const slots = ref([])
const loading = ref(false)

const showCreateModal = ref(false)
const newDate = ref('')
const newStartTime = ref('10:00')
const newDuration = ref(60)
const newMemo = ref('')
const creating = ref(false)

const DATE_OPTIONS = (() => {
    const opts = []
    const days = ['일', '월', '화', '수', '목', '금', '토']
    for (let i = 0; i < 7; i++) {
        const d = new Date()
        d.setDate(d.getDate() + i)
        const yyyy = d.getFullYear()
        const mm = String(d.getMonth() + 1).padStart(2, '0')
        const dd = String(d.getDate()).padStart(2, '0')
        opts.push({ value: `${yyyy}-${mm}-${dd}`, label: `${mm}월 ${dd}일 (${days[d.getDay()]})` })
    }
    return opts
})()

const TIME_OPTIONS = (() => {
    const opts = []
    for (let h = 9; h <= 23; h++) {
        for (let m = 0; m < 60; m += 15) {
            opts.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
        }
    }
    return opts
})()

const DURATION_OPTIONS = [
    { label: '15분 (1개)', minutes: 15 },
    { label: '30분 (2개)', minutes: 30 },
    { label: '1시간 (4개)', minutes: 60 },
    { label: '1시간 30분 (6개)', minutes: 90 },
    { label: '2시간 (8개)', minutes: 120 },
    { label: '3시간 (12개)', minutes: 180 },
    { label: '4시간 (16개)', minutes: 240 },
]

const slotPreview = computed(() => {
    if (!newDate.value || !newStartTime.value) return ''
    const times = computeSlotTimes(newDate.value, newStartTime.value, newDuration.value)
    if (!times.length) return ''
    const last = times[times.length - 1]
    const [lh, lm] = last.split(' ')[1].split(':')
    const endMin = parseInt(lh) * 60 + parseInt(lm) + 15
    const endH = Math.floor(endMin / 60)
    const endM = endMin % 60
    const endStr = `${String(endH).padStart(2,'0')}:${String(endM).padStart(2,'0')}`
    return `${newStartTime.value} ~ ${endStr}, 총 ${times.length}개 슬롯`
})

function computeSlotTimes(date, startTime, durationMinutes) {
    const count = Math.floor(durationMinutes / 15)
    const [h, m] = startTime.split(':').map(Number)
    const times = []
    for (let i = 0; i < count; i++) {
        const totalMin = h * 60 + m + i * 15
        const hh = Math.floor(totalMin / 60)
        const mm = totalMin % 60
        if (hh >= 24) break
        times.push(`${date} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`)
    }
    return times
}

// 결과 입력 모달
const showResultModal = ref(false)
const resultSlotId = ref(null)
const resultSlotInfo = ref(null)
const savingResult = ref(false)

// 합격자 명단 모달
const showPassList = ref(false)
const passListLoading = ref(false)
const passRows = ref([])
const copyToast = ref(false)
let toastTimer = null

const passGrouped = computed(() => {
    const map = {}
    for (const row of passRows.value) {
        const key = row.team_name || '미배정'
        if (!map[key]) map[key] = []
        map[key].push(row)
    }
    return map
})

function copyTeam(rows) {
    const text = rows.map(r => `${r.team_name} ${r.area_name} ${r.booker_name}`).join('\n')
    navigator.clipboard.writeText(text)
    copyToast.value = true
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => { copyToast.value = false }, 2000)
}

const isHost = computed(() => {
    const r = auth.currentUserRole || ''
    return ['팀장', '팀전도교관', '지역장', '임원', '지역총무'].some(k => r.includes(k))
})

function parseTs(ts) {
    return ts ? new Date(String(ts).replace('Z', '')) : null
}

function formatDate(ts) {
    if (!ts) return ''
    const d = parseTs(ts)
    const days = ['일', '월', '화', '수', '목', '금', '토']
    return `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`
}

function formatTime(ts) {
    if (!ts) return ''
    const d = parseTs(ts)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatShortDate(ts) {
    if (!ts) return ''
    const d = parseTs(ts)
    return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

function isPast(ts) {
    return parseTs(ts) < new Date()
}

function slotState(slot) {
    if (slot.result === '합격') return 'pass'
    if (slot.result === '불합격') return 'fail'
    if (slot.booker_sabun && slot.host_sabun === auth.currentSabun) return 'need-result'
    if (isPast(slot.slot_time)) return 'past'
    if (!slot.booker_sabun) return 'open'
    if (slot.booker_sabun === auth.currentSabun) return 'mine'
    return 'taken'
}

const grouped = computed(() => {
    const map = {}
    for (const s of slots.value) {
        const key = formatDate(s.slot_time)
        if (!map[key]) map[key] = []
        map[key].push(s)
    }
    return map
})

async function loadSlots() {
    loading.value = true
    try {
        const r = await callApiPromise('/api/feedback-slots/list', {})
        if (r.success) slots.value = r.slots || []
        else showAppAlert(r.message || '로드 실패')
    } catch (e) {
        showAppAlert('로드 실패: ' + e.message)
    } finally {
        loading.value = false
    }
}

async function createSlot() {
    if (!newDate.value) return showAppAlert('날짜를 선택해주세요.')
    const slotTimes = computeSlotTimes(newDate.value, newStartTime.value, newDuration.value)
    if (!slotTimes.length) return showAppAlert('슬롯 시간을 확인해주세요.')
    creating.value = true
    try {
        const r = await callApiPromise('/api/feedback-slots/create', { slotTimes, memo: newMemo.value })
        if (r.success) {
            showCreateModal.value = false
            newDate.value = ''
            showAppAlert(`${r.created}개 슬롯이 개설됐어요!`)
            await loadSlots()
        } else {
            showAppAlert(r.message || '개설 실패')
        }
    } catch (e) {
        showAppAlert('오류: ' + e.message)
    } finally {
        creating.value = false
    }
}

async function deleteSlot(slot) {
    if (!confirm(`${formatTime(slot.slot_time)} 슬롯을 삭제할까요?`)) return
    try {
        const r = await callApiPromise('/api/feedback-slots/delete', { slotId: slot.slot_id })
        if (r.success) await loadSlots()
        else showAppAlert(r.message || '삭제 실패')
    } catch (e) {
        showAppAlert('오류: ' + e.message)
    }
}

async function bookSlot(slot) {
    if (!confirm(`${slot.host_name}와 ${formatTime(slot.slot_time)} 15분 피드백을 신청할까요?`)) return
    try {
        const r = await callApiPromise('/api/feedback-slots/book', { slotId: slot.slot_id })
        if (r.success) await loadSlots()
        else showAppAlert(r.message || '신청 실패')
    } catch (e) {
        showAppAlert('오류: ' + e.message)
    }
}

async function cancelBook(slot) {
    if (!confirm('예약을 취소할까요?')) return
    try {
        const r = await callApiPromise('/api/feedback-slots/cancel', { slotId: slot.slot_id })
        if (r.success) await loadSlots()
        else showAppAlert(r.message || '취소 실패')
    } catch (e) {
        showAppAlert('오류: ' + e.message)
    }
}

function openResultModal(slot) {
    resultSlotId.value = slot.slot_id
    resultSlotInfo.value = slot
    showResultModal.value = true
}

async function saveResult(value) {
    savingResult.value = true
    try {
        const r = await callApiPromise('/api/feedback-slots/result', {
            slotId: resultSlotId.value,
            result: value
        })
        if (r.success) {
            showResultModal.value = false
            await loadSlots()
        } else {
            showAppAlert(r.message || '저장 실패')
        }
    } catch (e) {
        showAppAlert('오류: ' + e.message)
    } finally {
        savingResult.value = false
    }
}

async function openPassList() {
    showPassList.value = true
    passListLoading.value = true
    try {
        const r = await callApiPromise('/api/feedback-slots/pass-list', {})
        if (r.success) passRows.value = r.list || []
        else showAppAlert(r.message || '로드 실패')
    } catch (e) {
        showAppAlert('오류: ' + e.message)
    } finally {
        passListLoading.value = false
    }
}

// 화면 켜지면 "지금"에 가장 가까운(아직 안 지난) 슬롯으로 스크롤 이동.
// slots 는 서버에서 SLOT_TIME ASC 로 오니까 첫 번째 !isPast 항목이 곧 현재 시각 위치.
function scrollToNow() {
    const target = slots.value.find(s => !isPast(s.slot_time))
    if (!target) return
    const el = document.getElementById('fb-slot-' + target.slot_id)
    if (el) el.scrollIntoView({ block: 'center' })
}

onMounted(async () => {
    await loadSlots()
    await nextTick()
    scrollToNow()
})
</script>

<template>
    <div class="screen">
        <div class="fb-header">
            <button class="fb-back" @click="router.back()">←</button>
            <h2 class="fb-title">⏱️ 15분 피드백</h2>
            <button v-if="isHost" class="fb-add-btn" @click="showCreateModal = true">+</button>
            <div v-else class="fb-add-placeholder"></div>
        </div>

        <div class="fb-notice">
            <div class="fb-notice-title">📋 피드백 안내</div>
            <ol class="fb-notice-list">
                <li>피드백 장소는 활동지입니다.</li>
                <li>멘트의 핵심이 모두 포함되면 통과입니다.</li>
                <li>신청은 하나씩만 할 수 있으며, 불통과 일때는 재신청이 가능합니다.</li>
                <li>피드백은 15분, 멘트 안에서 특정 구간을 임의로 지정해서 테스트합니다.</li>
            </ol>
        </div>

        <div class="fb-pass-btn-wrap">
            <button class="fb-pass-list-btn" @click="openPassList">🏆 합격자 명단</button>
        </div>

        <div v-if="loading" class="fb-empty">로딩 중...</div>
        <div v-else-if="!slots.length" class="fb-empty">개설된 슬롯이 없어요.</div>

        <div v-else class="fb-list">
            <div v-for="(daySlots, date) in grouped" :key="date" class="fb-day-group">
                <div class="fb-day-label">{{ date }}</div>
                <div v-for="slot in daySlots" :key="slot.slot_id" :id="'fb-slot-' + slot.slot_id" class="fb-card" :class="`state-${slotState(slot)}`">
                    <div class="fb-card-left">
                        <div class="fb-time-row">
                            <span class="fb-time">{{ formatTime(slot.slot_time) }}</span>
                            <span v-if="slotState(slot) === 'pass'" class="fb-result-badge pass">✅ 합격</span>
                            <span v-else-if="slotState(slot) === 'fail'" class="fb-result-badge fail">❌ 불합격</span>
                        </div>
                        <div class="fb-host">{{ slot.host_name }}</div>
                        <div v-if="slot.memo" class="fb-memo">{{ slot.memo }}</div>
                        <div v-if="slot.booker_name && slot.booker_sabun !== auth.currentSabun" class="fb-booker">신청자: {{ slot.booker_name }}</div>
                        <div v-else-if="slotState(slot) === 'mine'" class="fb-booker">내가 신청함</div>
                    </div>
                    <div class="fb-card-right">
                        <button v-if="slotState(slot) === 'open'" class="fb-btn book" @click="bookSlot(slot)">신청하기</button>
                        <button v-else-if="slotState(slot) === 'mine'" class="fb-btn cancel" @click="cancelBook(slot)">취소</button>
                        <button v-if="slotState(slot) === 'need-result' && slot.booker_sabun === auth.currentSabun" class="fb-btn cancel" @click="cancelBook(slot)">취소</button>
                        <button
                            v-if="['need-result','pass','fail'].includes(slotState(slot)) && slot.host_sabun === auth.currentSabun"
                            class="fb-btn result" @click="openResultModal(slot)"
                        >결과 입력</button>
                        <button
                            v-if="isHost && slot.host_sabun === auth.currentSabun && ['open','past','need-result','pass','fail'].includes(slotState(slot))"
                            class="fb-btn delete" @click="deleteSlot(slot)"
                        >삭제</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- 슬롯 개설 모달 -->
        <teleport to="body">
            <div v-if="showCreateModal" class="fb-overlay" @click.self="showCreateModal = false">
                <div class="fb-modal">
                    <div class="fb-modal-header">
                        <span>슬롯 개설</span>
                        <span class="fb-modal-close" @click="showCreateModal = false">×</span>
                    </div>
                    <div class="fb-modal-body">
                        <label class="fb-label">날짜</label>
                        <select v-model="newDate" class="fb-input">
                            <option value="">날짜를 선택해주세요</option>
                            <option v-for="d in DATE_OPTIONS" :key="d.value" :value="d.value">{{ d.label }}</option>
                        </select>
                        <label class="fb-label">시작 시각</label>
                        <select v-model="newStartTime" class="fb-input">
                            <option v-for="t in TIME_OPTIONS" :key="t" :value="t">{{ t }}</option>
                        </select>
                        <label class="fb-label">피드백 총 시간</label>
                        <select v-model="newDuration" class="fb-input">
                            <option v-for="d in DURATION_OPTIONS" :key="d.minutes" :value="d.minutes">{{ d.label }}</option>
                        </select>
                        <div v-if="slotPreview" class="fb-preview">📅 {{ slotPreview }}</div>
                        <label class="fb-label">메모 (선택)</label>
                        <input type="text" v-model="newMemo" class="fb-input" placeholder="예: 자유 신청 가능" />
                        <button class="fb-btn book" style="width:100%;margin-top:16px;" :disabled="creating" @click="createSlot">
                            {{ creating ? '개설 중...' : '개설하기' }}
                        </button>
                    </div>
                </div>
            </div>
        </teleport>

        <!-- 결과 입력 모달 -->
        <teleport to="body">
            <div v-if="showResultModal" class="fb-overlay" @click.self="showResultModal = false">
                <div class="fb-modal">
                    <div class="fb-modal-header">
                        <span>결과 입력</span>
                        <span class="fb-modal-close" @click="showResultModal = false">×</span>
                    </div>
                    <div class="fb-modal-body">
                        <div v-if="resultSlotInfo?.booker_name" class="fb-result-target">
                            신청자: <strong>{{ resultSlotInfo.booker_name }}</strong>
                        </div>
                        <div class="fb-result-btns">
                            <button class="fb-result-choice pass" :disabled="savingResult" @click="saveResult('합격')">✅ 합격</button>
                            <button class="fb-result-choice fail" :disabled="savingResult" @click="saveResult('불합격')">❌ 불합격</button>
                        </div>
                    </div>
                </div>
            </div>
        </teleport>

        <!-- 합격자 명단 모달 -->
        <teleport to="body">
            <div v-if="showPassList" class="fb-overlay" @click.self="showPassList = false">
                <div class="fb-modal fb-modal-tall">
                    <div class="fb-modal-header">
                        <span>🏆 합격자 명단</span>
                        <span class="fb-modal-close" @click="showPassList = false">×</span>
                    </div>
                    <transition name="fb-toast">
                        <div v-if="copyToast" class="fb-copy-toast">복사됐어요!</div>
                    </transition>
                    <div class="fb-modal-body fb-passlist-body">
                        <div v-if="passListLoading" class="fb-empty">로딩 중...</div>
                        <div v-else-if="!passRows.length" class="fb-empty" style="padding:30px 0">아직 합격자가 없어요.</div>
                        <div v-else class="fb-passlist">
                            <div v-for="(rows, team) in passGrouped" :key="team" class="fb-passlist-group">
                                <div class="fb-passlist-group-header">
                                    <span class="fb-passlist-team">{{ team }}</span>
                                    <button class="fb-copy-btn" @click="copyTeam(rows)">복사</button>
                                </div>
                                <div v-for="(row, i) in rows" :key="i" class="fb-passlist-row">
                                    {{ row.team_name }} {{ row.area_name }} {{ row.booker_name }}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </teleport>
    </div>
</template>

<style scoped>
.screen { background: #f7f8fa; min-height: 100vh; }

.fb-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 16px 8px;
    background: #fff;
    border-bottom: 1px solid #eee;
    position: sticky; top: 0; z-index: 10;
}
.fb-back { background: none; border: none; font-size: 20px; cursor: pointer; color: #555; padding: 0 8px 0 0; }
.fb-title { font-size: 17px; font-weight: 700; flex: 1; text-align: center; margin: 0; }
.fb-add-btn {
    width: 34px; height: 34px; border-radius: 50%; background: #3182F6; color: #fff;
    border: none; font-size: 22px; cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.fb-add-placeholder { width: 34px; }

.fb-notice {
    margin: 12px 16px 0;
    background: #FFF8E1; border: 1px solid #FFE082; border-radius: 12px;
    padding: 12px 16px;
}
.fb-notice-title { font-size: 13px; font-weight: 700; color: #F57F17; margin-bottom: 8px; }
.fb-notice-list {
    margin: 0; padding-left: 18px;
    display: flex; flex-direction: column; gap: 5px;
}
.fb-notice-list li { font-size: 13px; color: #555; line-height: 1.5; }

.fb-pass-btn-wrap { padding: 10px 16px 0; }
.fb-pass-list-btn {
    width: 100%; padding: 10px; border-radius: 10px;
    background: #E8F5E9; border: 1px solid #A5D6A7;
    color: #2E7D32; font-size: 14px; font-weight: 700; cursor: pointer;
}

.fb-empty { text-align: center; color: #aaa; padding: 60px 20px; font-size: 14px; }

.fb-list { padding: 12px 16px 80px; }
.fb-day-group { margin-bottom: 20px; }
.fb-day-label {
    display: flex; align-items: center; gap: 8px;
    font-size: 13px; font-weight: 700; color: #666; margin-bottom: 8px;
}
.fb-day-label::before, .fb-day-label::after { content: ''; flex: 1; height: 1px; background: #ddd; }

.fb-card {
    background: #fff; border-radius: 14px; padding: 14px 16px;
    margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;
    border-left: 4px solid #ddd; box-shadow: 0 1px 4px rgba(0,0,0,.06);
}
.fb-card.state-open        { border-left-color: #90caf9; }
.fb-card.state-mine        { border-left-color: #66bb6a; }
.fb-card.state-taken       { border-left-color: #ef9a9a; opacity: .7; }
.fb-card.state-need-result { border-left-color: #ffd54f; }
.fb-card.state-pass        { border-left-color: #43a047; background: #F1F8E9; }
.fb-card.state-fail        { border-left-color: #e53935; background: #FFF3F3; }
.fb-card.state-past        { border-left-color: #e0e0e0; opacity: .6; }

.fb-card-left { flex: 1; }
.fb-time-row { display: flex; align-items: center; gap: 8px; }
.fb-time   { font-size: 18px; font-weight: 700; color: #222; }
.fb-host   { font-size: 13px; color: #555; margin-top: 2px; }
.fb-memo   { font-size: 12px; color: #999; margin-top: 2px; }
.fb-booker { font-size: 12px; color: #888; margin-top: 4px; }

.fb-result-badge {
    display: inline-block;
    font-size: 12px; font-weight: 700; padding: 3px 8px; border-radius: 20px;
}
.fb-result-badge.pass { background: #C8E6C9; color: #1B5E20; }
.fb-result-badge.fail { background: #FFCDD2; color: #B71C1C; }

.fb-card-right { display: flex; flex-direction: column; gap: 6px; align-items: flex-end; }

.fb-btn {
    padding: 7px 14px; border-radius: 20px; border: none; font-size: 13px;
    font-weight: 700; cursor: pointer; white-space: nowrap;
}
.fb-btn.book   { background: #3182F6; color: #fff; }
.fb-btn.cancel { background: #e8f0fe; color: #3182F6; }
.fb-btn.result { background: #fff8e1; color: #f57f17; border: 1px solid #ffd54f; }
.fb-btn.delete { background: #fce4ec; color: #c62828; font-size: 11px; padding: 4px 10px; }
.fb-btn:disabled { opacity: .5; }

.fb-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 9999;
    display: flex; align-items: flex-end; justify-content: center;
}
.fb-modal {
    background: #fff; width: 100%; max-width: 500px;
    border-radius: 20px 20px 0 0; padding-bottom: 24px; position: relative;
}
.fb-modal-tall { max-height: 80vh; display: flex; flex-direction: column; }
.fb-modal-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 18px 20px 12px; font-size: 16px; font-weight: 700;
    border-bottom: 1px solid #eee; flex-shrink: 0;
}
.fb-modal-close { font-size: 24px; cursor: pointer; color: #aaa; }
.fb-modal-body  { padding: 16px 20px; }
.fb-label { display: block; font-size: 13px; color: #666; margin: 12px 0 4px; }
.fb-input {
    width: 100%; box-sizing: border-box; padding: 10px 12px;
    border: 1px solid #ddd; border-radius: 10px; font-size: 15px; outline: none;
}
.fb-preview {
    background: #E3F2FD; border-radius: 8px; padding: 10px 12px;
    font-size: 13px; color: #1565C0; font-weight: 600; margin-top: 8px;
}

.fb-result-target {
    font-size: 15px; color: #444; margin-bottom: 20px; text-align: center;
}
.fb-result-btns {
    display: flex; gap: 12px;
}
.fb-result-choice {
    flex: 1; padding: 16px; border-radius: 14px; border: 2px solid transparent;
    font-size: 16px; font-weight: 700; cursor: pointer;
}
.fb-result-choice.pass { background: #E8F5E9; border-color: #43a047; color: #2E7D32; }
.fb-result-choice.fail { background: #FFEBEE; border-color: #e53935; color: #B71C1C; }
.fb-result-choice:disabled { opacity: .5; }

.fb-copy-toast {
    position: absolute; top: 70px; left: 50%; transform: translateX(-50%);
    background: rgba(0,0,0,.75); color: #fff; font-size: 13px; font-weight: 600;
    padding: 8px 18px; border-radius: 20px; white-space: nowrap; z-index: 10;
}
.fb-toast-enter-active, .fb-toast-leave-active { transition: opacity .2s; }
.fb-toast-enter-from, .fb-toast-leave-to { opacity: 0; }

.fb-passlist-body { overflow-y: auto; flex: 1; }
.fb-passlist { font-size: 14px; }
.fb-passlist-group { margin-bottom: 16px; }
.fb-passlist-group-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 6px 0; border-bottom: 2px solid #eee; margin-bottom: 4px;
}
.fb-passlist-team { font-size: 13px; font-weight: 700; color: #888; }
.fb-copy-btn {
    font-size: 12px; padding: 3px 10px; border-radius: 20px;
    background: #E3F2FD; border: 1px solid #90CAF9; color: #1565C0;
    cursor: pointer; font-weight: 700;
}
.fb-passlist-row { padding: 7px 0; border-bottom: 1px solid #f0f0f0; color: #222; }
</style>
