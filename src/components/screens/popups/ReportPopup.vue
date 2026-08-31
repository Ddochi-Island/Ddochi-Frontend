<script setup>
import { reactive, ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { usePopup } from '@/composables/usePopup'
import { useFormatters } from '@/composables/useFormatters'

// CenterScreen 의 양육일지 작성 팝업 — 메인/날짜/회차/방식 4 sub-step.
// legacy: handleReportBtn / renderReportPopup / __openDateSelect / __openRoundSelect /
//         __openMethodSelect / __submitReport / __updateReportState 정합.
// 특징:
//   - 'reportState' 는 reactive — input v-model 로 자동 양방향 바인딩
//   - localStorage draft 는 watch + onMounted/onUnmounted 로 자동 저장/복원
//   - subStep 'main' 에서 폼 영역은 v-show 유지 (DOM 보존, 스크롤 위치 살림)
//   - 상따 회차 선택 시 부모에 emit('switchToTtagi') — 부모가 ttagi form 으로 전환

const props = defineProps({
    item: { type: Object, required: true },
})

const emit = defineEmits(['close', 'submit', 'switchToTtagi'])

const { showAppAlert, showAppConfirm } = usePopup()
const { autoResize } = useFormatters()

const draftKey = `report_draft_${props.item.docId}`

const reportState = reactive({
    date: '',
    round: '',
    method: '',
    title: '',
    reaction: '',
    reflection: '',
    scrollTop: 0,
})

// localStorage draft 복원
try {
    const saved = localStorage.getItem(draftKey)
    if (saved) Object.assign(reportState, JSON.parse(saved))
} catch (_) { /* no-op */ }

const subStep = ref('main')   // 'main' | 'date' | 'round' | 'method'
const tempDate = ref(todayLocalIsoString())
const scrollAreaRef = ref(null)
const reactionRef = ref(null)
const reflectionRef = ref(null)

function todayLocalIsoString() {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const roundInfo = computed(() => {
    const logs = props.item.nurtureLogs || []
    let hasSungTta = false, maxRegularRound = 0
    logs.forEach(log => {
        if (log.round === '성따') hasSungTta = true
        if (log.round && log.round.match(/^\d+회차$/)) {
            const num = parseInt(log.round.replace('회차', ''), 10)
            if (num > maxRegularRound) maxRegularRound = num
        }
    })
    if (hasSungTta) return { isRegular: true, nextRound: `${maxRegularRound + 1}회차` }
    return { isRegular: false }
})

// 정규 회차 모드면 자동으로 다음 회차 prefill
if (roundInfo.value.isRegular && !reportState.round) {
    reportState.round = roundInfo.value.nextRound
}

// 상태 변경 시마다 localStorage 갱신 (autosave)
watch(reportState, () => {
    try { localStorage.setItem(draftKey, JSON.stringify(reportState)) } catch (_) { /* no-op */ }
}, { deep: true })

onMounted(() => {
    nextTick(() => {
        if (scrollAreaRef.value) scrollAreaRef.value.scrollTop = reportState.scrollTop
        if (reactionRef.value) autoResize(reactionRef.value)
        if (reflectionRef.value) autoResize(reflectionRef.value)
    })
})

onUnmounted(() => {
    // scroll position 한 번 더 저장 (마지막 state)
    if (scrollAreaRef.value) {
        reportState.scrollTop = scrollAreaRef.value.scrollTop
        try { localStorage.setItem(draftKey, JSON.stringify(reportState)) } catch (_) { /* no-op */ }
    }
})

function captureScroll() {
    if (scrollAreaRef.value) reportState.scrollTop = scrollAreaRef.value.scrollTop
}

// ── sub-step 전환 ──
function openDateSelect() {
    captureScroll()
    tempDate.value = todayLocalIsoString()
    subStep.value = 'date'
}

function openRoundSelect() {
    if (roundInfo.value.isRegular) return
    captureScroll()
    subStep.value = 'round'
}

function openMethodSelect() {
    captureScroll()
    subStep.value = 'method'
}

function backToMain() {
    subStep.value = 'main'
}

function confirmDate() {
    if (!tempDate.value) {
        showAppAlert('날짜를 선택해줘!')
        return
    }
    const d = new Date(tempDate.value)
    const week = ['일', '월', '화', '수', '목', '금', '토']
    reportState.date = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}(${week[d.getDay()]})`
    subStep.value = 'main'
}

function setRound(val) {
    if (val === '상따') {
        // 상따 → ttagi form 전환 (draft 삭제)
        try { localStorage.removeItem(draftKey) } catch (_) { /* no-op */ }
        emit('switchToTtagi')
        return
    }
    reportState.round = val
    subStep.value = 'main'
}

function setMethod(val) {
    reportState.method = val
    subStep.value = 'main'
}

function onTextareaInput(event) {
    autoResize(event.target)
}

function handleSubmit() {
    if (!reportState.date || !reportState.round || !reportState.method || !reportState.title || !reportState.reaction || !reportState.reflection) {
        showAppAlert('빈칸을 모두 채워줘!')
        return
    }
    showAppConfirm('정말 제출할까?', (yes) => {
        if (!yes) return
        const payload = {
            date: reportState.date,
            round: reportState.round,
            method: reportState.method,
            title: reportState.title,
            reaction: reportState.reaction,
            reflection: reportState.reflection,
            timestamp: new Date().toISOString(),
        }
        emit('submit', { docId: props.item.docId, payload, draftKey })
    })
}

const dateText = computed(() => reportState.date || '수업일')
const roundText = computed(() => reportState.round || '회차선택')
const methodText = computed(() => reportState.method || '방식')
</script>

<template>
    <Teleport to="body">
        <div class="modal-overlay" @click.self="emit('close')">
            <!-- main + form (v-show 로 DOM 보존 → 스크롤/입력값 유지) -->
            <div class="modal-card" style="height:80vh; padding:0;" v-show="subStep === 'main'">
                <div class="modal-header-sticky">
                    <div style="font-weight:bold; font-size:18px;">양육일지 작성</div>
                    <span class="modal-close-sticky" @click="emit('close')">X</span>
                </div>
                <div ref="scrollAreaRef" class="modal-content-scroll">
                    <div class="report-header-grid">
                        <button
                            :class="['report-btn', { selected: !!reportState.date }]"
                            @click="openDateSelect"
                        >{{ dateText }}</button>
                        <button
                            :class="['report-btn', { selected: !!reportState.round }]"
                            :style="roundInfo.isRegular ? 'background:#E0E0E0; color:#757575; cursor:default;' : ''"
                            @click="openRoundSelect"
                        >{{ roundText }}</button>
                        <button
                            :class="['report-btn', { selected: !!reportState.method }]"
                            @click="openMethodSelect"
                        >{{ methodText }}</button>
                    </div>
                    <span class="report-label">제목</span>
                    <input v-model="reportState.title" type="text" class="report-input" placeholder="제목을 입력해" />
                    <span class="report-label">수강생 반응 (구체적 워딩)</span>
                    <textarea
                        ref="reactionRef"
                        v-model="reportState.reaction"
                        class="report-textarea auto-resize-box"
                        placeholder="구체적인 워딩으로 적어줘!"
                        @input="onTextareaInput"
                    />
                    <span class="report-label">수업 느낀점</span>
                    <textarea
                        ref="reflectionRef"
                        v-model="reportState.reflection"
                        class="report-textarea auto-resize-box"
                        placeholder="느낀점을 적어줘!"
                        @input="onTextareaInput"
                    />
                    <div class="btn-group">
                        <button class="btn-pos" @click="handleSubmit">제출하기</button>
                    </div>
                </div>
            </div>

            <!-- date sub-popup -->
            <div v-if="subStep === 'date'" class="modal-card" style="position:absolute;">
                <span class="modal-close" @click="backToMain">&times;</span>
                <div class="modal-title">수업일을 선택해줘</div>
                <div class="input-card">
                    <input v-model="tempDate" type="date" class="popup-text-input" style="text-align:center;" />
                </div>
                <div class="btn-group">
                    <button class="btn-pos" @click="confirmDate">확인</button>
                    <button class="btn-neg" @click="backToMain">취소</button>
                </div>
            </div>

            <!-- round sub-popup -->
            <div v-else-if="subStep === 'round'" class="modal-card" style="position:absolute;">
                <span class="modal-close" @click="backToMain">&times;</span>
                <div class="modal-title">회차를 선택해줘</div>
                <div class="btn-group" style="margin-top:0; display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
                    <button class="btn-pos" style="background:#9C27B0;" @click="setRound('상따')">상따</button>
                    <button class="btn-pos" style="background:#795548;" @click="setRound('성흘')">성흘</button>
                    <button class="btn-pos" style="background:#1A237E;" @click="setRound('성따')">성따</button>
                    <button class="btn-pos" style="background:#4CAF50;" @click="setRound('다지기')">다지기</button>
                </div>
                <div class="btn-group">
                    <button class="btn-neg" @click="backToMain">취소</button>
                </div>
            </div>

            <!-- method sub-popup -->
            <div v-else-if="subStep === 'method'" class="modal-card" style="position:absolute;">
                <span class="modal-close" @click="backToMain">&times;</span>
                <div class="modal-title">수업 방식을 선택해줘</div>
                <div class="btn-group" style="margin-top:0;">
                    <button class="btn-pos" @click="setMethod('대면')">대면</button>
                    <button class="btn-pos" style="background:#0288D1;" @click="setMethod('줌')">줌</button>
                </div>
                <div class="btn-group">
                    <button class="btn-neg" @click="backToMain">취소</button>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
.modal-header-sticky {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 16px 12px;
    border-bottom: 1px solid #eee;
    font-weight: bold;
    font-size: 17px;
}
.modal-close-sticky {
    font-size: 20px;
    color: #aaa;
    cursor: pointer;
    line-height: 1;
}
.modal-content-scroll {
    overflow-y: auto;
    flex: 1;
    padding: 12px 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 4px;
}
.report-header-grid {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
}
.report-btn {
    flex: 1;
    padding: 8px 6px;
    border: 1.5px solid #ddd;
    border-radius: 20px;
    background: #f5f5f5;
    color: #777;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.report-btn.selected {
    background: var(--btn-color, #5D4037);
    color: white;
    border-color: transparent;
}
.report-label {
    display: block;
    font-weight: bold;
    font-size: 13px;
    color: #555;
    margin-top: 10px;
    margin-bottom: 4px;
}
.report-input {
    width: 100%;
    box-sizing: border-box;
    padding: 10px 12px;
    border: 1px solid #ddd;
    border-radius: 8px;
    font-size: 14px;
    font-family: inherit;
    outline: none;
}
.report-input:focus {
    border-color: var(--btn-color, #5D4037);
}
.report-textarea {
    width: 100%;
    box-sizing: border-box;
    padding: 10px 12px;
    border: 1px solid #ddd;
    border-radius: 8px;
    font-size: 14px;
    font-family: inherit;
    resize: none;
    min-height: 80px;
    outline: none;
}
.report-textarea:focus {
    border-color: var(--btn-color, #5D4037);
}
</style>
