<script setup>
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useCenterStore } from '@/stores/center'
import { useUiStore } from '@/stores/ui'
import { useApi } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'
import { useFormatters } from '@/composables/useFormatters'
import { phaseOrder, statusColors, statusTextMap, ttagiFields, pathMap, phaseColorMap } from '@/constants'
import LeafListPopup from './popups/LeafListPopup.vue'
import LeafDatePopup from './popups/LeafDatePopup.vue'
import TeacherEditPopup from './popups/TeacherEditPopup.vue'
import StatusColorPopup from './popups/StatusColorPopup.vue'
import LogsPopup from './popups/LogsPopup.vue'
import StrategyPopup from './popups/StrategyPopup.vue'
import FinalResultPopup from './popups/FinalResultPopup.vue'
import DropoutReasonPopup from './popups/DropoutReasonPopup.vue'
import MatchingInfoPopup from './popups/MatchingInfoPopup.vue'
import HabjaeyangViewPopup from './popups/HabjaeyangViewPopup.vue'
import SchedulePopup from './popups/SchedulePopup.vue'
import NurtureLogDetailPopup from './popups/NurtureLogDetailPopup.vue'
import TtagiFormPopup from './popups/TtagiFormPopup.vue'
import TtagiViewPopup from './popups/TtagiViewPopup.vue'
import ReportPopup from './popups/ReportPopup.vue'

const auth = useAuthStore()
const center = useCenterStore()
const ui = useUiStore()
const { callApi, callApiPromise } = useApi()
const { showPopup, closePopup, showAppAlert, showAppConfirm, showToast } = usePopup()
const { getDay, autoResize, copyText } = useFormatters()

// ---- Local reactive state ----
const loading = ref(false)

// ---- Leaf popup state (Phase 1: legacy window.__handleLeafInput 정합 — Vue idiom) ----
// shape: null | { phase: 'list', idx } | { phase: 'date', idx, type, name }
const leafState = ref(null)

// ---- Phase 2 popup states (legacy window.__* 콜백 chain 컴포넌트화) ----
const teacherPopupIdx = ref(null)   // null | number
const statusPopupIdx = ref(null)
const logsPopupIdx = ref(null)

// Phase 2-b: Strategy / FinalResult / MatchingInfo+Habjaeyang
const strategyState = ref(null)         // null | { idx, step: 'menu'|'input'|'success' }
const finalResultState = ref(null)      // null | { idx, sub: 'main'|'dropout' }
const matchingState = ref(null)         // null | { idx, view: 'menu'|'habjaeyang' }
const strategyPopupRef = ref(null)

// Phase 4: Schedule
const schedulePopupIdx = ref(null)      // null | number

// Phase 5: Nurture log detail / Ttagi form / Ttagi view
const nurtureLogPopup = ref(null)       // null | { idx, logIdx }
const ttagiFormPopupIdx = ref(null)
const ttagiViewPopupIdx = ref(null)

// Phase 6: Report (양육일지 작성) — `currentReportState` lift to popup component (draft autosave 도 컴포넌트 안에서)
const reportPopupIdx = ref(null)

// ---- Computed ----
const sortedList = computed(() => center.centerDataList.value ?? center.centerDataList)

// ---- Phase color mapping (constants/index.js phaseColorMap 단일 소스) ----
function phaseColor(ph) {
    return phaseColorMap[ph] || '#333'
}


// ---- Data Loading ----
function loadCenterAssets() {
    loading.value = true
    callApi('/api/get-center-assets', { sabun: auth.currentSabun }, r => {
        if (!r.success) { loading.value = false; return }

        const list = r.list.map(item => {
            let phase = '매칭'
            let has1st = false, hasSungTta = false, hasSungHeul = false

            if (item.nurtureLogs && Array.isArray(item.nurtureLogs)) {
                item.nurtureLogs.forEach(log => {
                    if (log.round === '1회차') has1st = true
                    if (log.round === '성따') hasSungTta = true
                    if (log.round === '성흘') hasSungHeul = true
                })
            }

            if (item.finalResultState === '탈락') phase = '탈락'
            else if (item.finalResultState === '센터') phase = '센터'
            else if (has1st) phase = '복등'
            else if (hasSungTta) phase = '성따'
            else if (hasSungHeul) phase = '성흘'
            else if (item.logs && item.logs.includes('상담따기')) phase = '상따'

            let color = '⚪️'
            if (item.logs) {
                const lines = item.logs.split('\n')
                for (let line of lines) {
                    if (line.includes('진행상태')) {
                        const match = line.match(/(🔴|🟠|🟡|🟢|🔵|⚪️)/)
                        if (match) { color = match[1]; break }
                    }
                }
            }

            return { ...item, computedPhase: phase, computedColor: color }
        })

        center.setCenterData(list)
        applyCenterSort()
        loading.value = false
    })
}

// ---- Sorting ----
function applyCenterSort() {
    const key = center.centerSortState.key
    const asc = center.centerSortState.asc
    const colorOrder = { '🔴': 1, '🟠': 2, '🟡': 3, '🟢': 4, '🔵': 5, '⚪️': 0 }

    center.centerDataList.sort((a, b) => {
        let valA, valB
        if (key === 'phase') { valA = phaseOrder[a.computedPhase] || 0; valB = phaseOrder[b.computedPhase] || 0 }
        else if (key === 'name') { valA = a.name || ''; valB = b.name || '' }
        else if (key === 'teacher') { valA = a.teacher || ''; valB = b.teacher || '' }
        else if (key === 'status') { valA = colorOrder[a.computedColor] || 0; valB = colorOrder[b.computedColor] || 0 }
        if (valA < valB) return asc ? -1 : 1
        if (valA > valB) return asc ? 1 : -1
        return 0
    })
}

function handleSort(key) {
    center.toggleCenterSort(key)
    applyCenterSort()
}

// ---- Accordion toggle ----
const openItems = ref({})
function toggleDetail(idx) {
    openItems.value[idx] = !openItems.value[idx]
}

// ---- Schedule button text ----
function schedBtnText(item) {
    if (item.note && item.note.schedule) {
        const days = ['월', '화', '수', '목', '금', '토', '일']
        const savedDays = Object.keys(item.note.schedule)
        const sorted = savedDays.sort((a, b) => days.indexOf(a) - days.indexOf(b))
        if (sorted.length > 0) return sorted.join('')
    }
    return '📅 일정설정'
}

// ---- Final result button style/text ----
function finalBtnText(item) { return item.finalResultState || '최종결과' }
function finalBtnStyle(item) {
    const r = item.finalResultState
    if (r === '센터') return 'background:#E8F5E9; color:#2E7D32; border:1px solid #C8E6C9; font-weight:bold;'
    if (r === '탈락') return 'background:#FFEBEE; color:#C62828; border:1px solid #FFCDD2; font-weight:bold;'
    return ''
}

// ---- Merged logs for nurture table ----
function getMergedLogs(item) {
    let mergedLogs = []
    if (item.nurtureLogs && Array.isArray(item.nurtureLogs)) {
        item.nurtureLogs.forEach((log, logIdx) => {
            mergedLogs.push({ type: 'normal', data: log, originalIdx: logIdx, dateStr: log.date })
        })
    }
    if (item.logs && (item.logs.includes('상담따기') || item.logs.includes('따기보고작성'))) {
        let ttagiDate = '-'
        const lines = item.logs.split('\n')
        for (let l of lines) {
            if (l.includes('상담따기') || l.includes('따기보고')) {
                const parts = l.split('|')
                if (parts[0]) {
                    const rawD = parts[0].trim()
                    if (rawD.length >= 8) {
                        const m = rawD.substring(3, 5)
                        const d = rawD.substring(6, 8)
                        const y = '20' + rawD.substring(0, 2)
                        const fullD = new Date(`${y}-${m}-${d}`)
                        const w = ['일', '월', '화', '수', '목', '금', '토']
                        if (!isNaN(fullD)) ttagiDate = `${m}/${d}(${w[fullD.getDay()]})`
                        else ttagiDate = `${m}/${d}`
                    }
                }
                break
            }
        }
        mergedLogs.push({ type: 'ttagi', dateStr: ttagiDate, data: { round: '상따', title: '상담따기', method: '대면' } })
    }
    mergedLogs.sort((a, b) => a.dateStr.localeCompare(b.dateStr))
    return mergedLogs
}

// ---- Teacher change (Vue idiom — legacy editCenterTeacher 정합) ----
function editCenterTeacher(e, idx) {
    e.stopPropagation()
    teacherPopupIdx.value = idx
}

function handleTeacherSubmit({ docId, finalName }) {
    callApi('/api/update-match', {
        sabun: auth.currentSabun, rowIndex: docId, type: 'teacherChange', data: finalName
    }, r => {
        teacherPopupIdx.value = null
        showAppAlert(r.message, () => { loadCenterAssets() })
    })
}

// ---- Status color change (Vue idiom — legacy changeCenterStatus 정합) ----
function changeCenterStatus(e, idx) {
    e.stopPropagation()
    statusPopupIdx.value = idx
}

function handleStatusSubmit({ docId, color, text, reason }) {
    callApi('/api/update-match', {
        sabun: auth.currentSabun, rowIndex: docId, type: 'condition',
        data: { color, text, reason }
    }, () => {
        statusPopupIdx.value = null
        showAppAlert('상태가 변경되었어!', () => { loadCenterAssets() })
    })
}

// ---- Logs popup (Vue idiom — legacy showCenterLogs / __deleteCenterLog 정합) ----
function showCenterLogs(idx) {
    logsPopupIdx.value = idx
}

function handleLogDelete({ id, source }) {
    const idx = logsPopupIdx.value
    if (idx === null) return
    showAppConfirm('이 기록을 삭제할거야?', (yes) => {
        if (!yes) return
        const item = center.centerDataList[idx]
        callApi('/api/delete-log', { sabun: auth.currentSabun, rowIndex: item.docId, id, source }, res => {
            logsPopupIdx.value = null
            showAppAlert(res.message, () => { loadCenterAssets() })
        })
    })
}

// ---- Leaf popup (Vue idiom — legacy window.__handleLeafInput / __submitLeafDate 정합) ----
function showCenterLeaf(idx) {
    leafState.value = { phase: 'list', idx }
}

function handleLeafPick(type) {
    if (!leafState.value) return
    const { idx } = leafState.value
    showPopup('text', `${type} - 이름 입력`, '누가 해줬어?', (resName) => {
        if (!resName || resName.text === undefined) return
        const name = String(resName.text).trim()
        if (!name) return
        if (!auth.validNames.includes(name)) {
            // 알림 후 leaf list 로 복귀 (legacy 의 재호출 패턴 정합)
            showAppAlert(`[${name}]님은 명단에 없어! 이름을 확인해줘.`)
            return
        }
        leafState.value = { phase: 'date', idx, type, name }
    })
}

function handleLeafDateSubmit({ logContent }) {
    if (!leafState.value || leafState.value.phase !== 'date') return
    const { idx, type } = leafState.value
    const item = center.centerDataList[idx]
    const newLeafMap = { ...(item.note?.leafMap || {}), [type]: logContent }
    callApi('/api/update-match', {
        sabun: auth.currentSabun, rowIndex: item.docId, type: 'log',
        data: { logType: type, logContent, leafMap: newLeafMap }
    }, () => {
        if (!item.note) item.note = {}
        item.note.leafMap = newLeafMap
        showAppAlert('저장 완료! 🌱', () => {
            leafState.value = { phase: 'list', idx }
            loadCenterAssets()
        })
    })
}

function handleLeafDateCancel() {
    if (!leafState.value) return
    // 날짜 단계 취소 시 list 로 복귀 (legacy 의 __closePopup 은 popup 1단만 닫지만 UX 일관성 위해 list 로)
    leafState.value = { phase: 'list', idx: leafState.value.idx }
}

// ---- Schedule popup (Vue idiom — legacy openSchedulePopup / __submitSchedule 정합) ----
function openSchedulePopup(idx) {
    schedulePopupIdx.value = idx
}

function handleScheduleSubmit({ docId, summary, details, isClear }) {
    callApi('/api/update-match', {
        sabun: auth.currentSabun, rowIndex: docId, type: 'schedule',
        data: { summary, details },
    }, () => {
        const msg = isClear ? '일정이 초기화되었어!' : '일정 설정 완료! 📅'
        showAppAlert(msg, () => {
            schedulePopupIdx.value = null
            loadCenterAssets()
        })
    })
}

// ---- Strategy ----
// ---- Strategy popup (Vue idiom — legacy openStrategyInput / openStrategyMenu 정합) ----
function handleStrategyBtn(idx) {
    const item = center.centerDataList[idx]
    const initialStep = (item.strategyLink && item.strategyLink.trim() !== '') ? 'menu' : 'input'
    strategyState.value = { idx, step: initialStep }
}

function handleStrategySubmit({ docId, link }) {
    callApi('/api/update-match', {
        sabun: auth.currentSabun, rowIndex: docId, type: 'strategy', data: { link }
    }, () => {
        // 등록 완료 후 success step 으로 전환 (자식 컴포넌트의 ref expose 호출)
        if (strategyPopupRef.value && typeof strategyPopupRef.value.showSuccess === 'function') {
            strategyPopupRef.value.showSuccess()
        }
    })
}

function handleStrategyReload() {
    loadCenterAssets()
}

// ---- Report (nurture log) writing — Vue idiom (legacy handleReportBtn / renderReportPopup 정합) ----
function handleReportBtn(idx) {
    reportPopupIdx.value = idx
}

function handleReportSubmit({ docId, payload, draftKey }) {
    callApi('/api/update-match', {
        sabun: auth.currentSabun, rowIndex: docId, type: 'nurtureLog', data: payload
    }, () => {
        try { localStorage.removeItem(draftKey) } catch (_) { /* no-op */ }
        reportPopupIdx.value = null
        showAppAlert('양육일지 저장 완료!', () => { loadCenterAssets() })
    })
}

function handleReportSwitchToTtagi() {
    // 상따 회차 선택 → 따기보고 작성 폼으로 전환
    const idx = reportPopupIdx.value
    reportPopupIdx.value = null
    if (idx !== null) ttagiFormPopupIdx.value = idx
}

// ---- Nurture log detail popup ----
// ---- Nurture log detail (Vue idiom — legacy openNurtureLogDetail 정합) ----
function openNurtureLogDetail(idx, logIdx) {
    nurtureLogPopup.value = { idx, logIdx }
}

function handleNurtureLogSubmit({ docId, logIndex, updatedLog }) {
    callApi('/api/update-match', {
        sabun: auth.currentSabun, rowIndex: docId, type: 'nurtureLogUpdate', logIndex, data: { logIndex, updatedLog }
    }, () => {
        nurtureLogPopup.value = null
        showAppAlert('수정 완료!', () => { loadCenterAssets() })
    })
}

// ---- Ttagi report write (Vue idiom — legacy showTtagiFormForCenter 정합) ----
function showTtagiFormForCenter(idx) {
    ttagiFormPopupIdx.value = idx
}

function handleTtagiFormSubmit({ docId, data }) {
    callApi('/api/update-match', {
        sabun: auth.currentSabun, rowIndex: docId, type: 'ttagi', data
    }, () => {
        ttagiFormPopupIdx.value = null
        showAppAlert('따기보고 저장 완료!', () => { loadCenterAssets() })
    })
}

// ---- View ttagi report (Vue idiom — legacy viewTtagiReportForCenter 정합) ----
function viewTtagiReportForCenter(idx) {
    const item = center.centerDataList[idx]
    const data = item.ttagiReport || {}
    if (Object.keys(data).length === 0) {
        showAppAlert('작성된 따기보고가 없어!')
        return
    }
    ttagiViewPopupIdx.value = idx
}

// ---- Feedback ----
function handleFeedbackBtn() { showAppAlert('아직 준비 중이야!') }

// ---- Matching info popup (Vue idiom — legacy openMatchingInfoPopup / viewHabjaeyangPopupForCenter 정합) ----
function openMatchingInfoPopup(idx) {
    matchingState.value = { idx, view: 'menu' }
}

function handleMatchingViewHabjaeyang() {
    if (!matchingState.value) return
    matchingState.value = { ...matchingState.value, view: 'habjaeyang' }
}

function handleMatchingBack() {
    if (!matchingState.value) return
    matchingState.value = { ...matchingState.value, view: 'menu' }
}

// ---- Final result (Vue idiom — legacy handleFinalResultBtn 정합) ----
function handleFinalResultBtn(idx) {
    finalResultState.value = { idx, sub: 'main' }
}

function submitFinalResult(idx, result, reason) {
    if (ui.isProcessing) return
    const itm = center.centerDataList[idx]
    if (itm.finalResultState === result) {
        showAppAlert('이미 반영된 결과야!')
        return
    }
    const dataPayload = { result }
    if (reason) dataPayload.reason = reason
    ui.setProcessing(true)
    callApi('/api/update-match', {
        sabun: auth.currentSabun, rowIndex: itm.docId, type: 'finalResult', data: dataPayload
    }, () => {
        showAppAlert(`[${result}] 처리 완료!`, () => {
            ui.setProcessing(false)
            finalResultState.value = null
            loadCenterAssets()
        })
    })
}

function handleFinalCenter() {
    if (!finalResultState.value) return
    submitFinalResult(finalResultState.value.idx, '센터', '-')
}

function handleFinalDropoutPick() {
    if (!finalResultState.value) return
    finalResultState.value = { ...finalResultState.value, sub: 'dropout' }
}

function handleDropoutSubmit(reason) {
    if (!finalResultState.value) return
    submitFinalResult(finalResultState.value.idx, '탈락', reason)
}

function handleDropoutBack() {
    if (!finalResultState.value) return
    finalResultState.value = { ...finalResultState.value, sub: 'main' }
}

// ---- Lifecycle ----
onMounted(() => { loadCenterAssets() })
</script>

<template>
    <div class="screen">
        <div class="header">
            <h3>센터 가보자!</h3>
            <p>돌처럼 하나되자!</p>
        </div>

        <div id="centerListContainer">
            <!-- Loading -->
            <div v-if="loading" style="text-align:center;padding:20px;">데이터 불러오는 중...</div>

            <!-- Content -->
            <template v-else>
                <!-- Sort header -->
                <div class="sort-header center-grid-style">
                    <div @click="handleSort('phase')" style="cursor:pointer;">단계 ↕</div>
                    <div @click="handleSort('name')" style="cursor:pointer;">이름 ↕</div>
                    <div @click="handleSort('teacher')" style="cursor:pointer;">교사 ↕</div>
                    <div @click="handleSort('status')" style="cursor:pointer;">상태 ↕</div>
                </div>

                <div v-if="center.centerDataList.length === 0" style="text-align:center;padding:20px;color:#888;">
                    표시할 자산이 없어
                </div>

                <!-- Items -->
                <div v-for="(item, idx) in center.centerDataList" :key="idx" class="tm-item">
                    <!-- Summary row -->
                    <div class="tm-summary center-grid-style" style="padding:8px 5px;" @click="toggleDetail(idx)">
                        <div :style="{ fontWeight: 'bold', color: phaseColor(item.computedPhase) }">{{ item.computedPhase }}</div>
                        <div style="font-weight:bold;">{{ item.name }}</div>
                        <div style="text-decoration:underline; cursor:pointer; color:#555;" @click.stop="editCenterTeacher($event, idx)">{{ item.teacher }}</div>
                        <div style="font-size:18px; cursor:pointer;" @click.stop="changeCenterStatus($event, idx)">{{ item.computedColor }}</div>
                    </div>

                    <!-- Detail panel -->
                    <div v-show="openItems[idx]" class="tm-details">
                        <!-- Menu buttons -->
                        <div class="center-menu-grid">
                            <button class="center-menu-btn" @click="showCenterLogs(idx)">📜 기록</button>
                            <button class="center-menu-btn" @click="showCenterLeaf(idx)">🌱 잎사귀</button>
                            <button class="center-menu-btn" @click="openSchedulePopup(idx)">{{ schedBtnText(item) }}</button>
                            <button class="center-menu-btn" @click="handleStrategyBtn(idx)">🧠 전략창</button>

                            <button class="center-menu-btn" style="grid-column: span 2;" @click="handleReportBtn(idx)">📝 보고작성</button>
                            <button class="center-menu-btn" @click="handleFeedbackBtn()">🔥 피드백지</button>
                            <button class="center-menu-btn" style="background:#E3F2FD; color:#1565C0; border:1px solid #BBDEFB; font-weight:bold;" @click="openMatchingInfoPopup(idx)">🐑 매칭정보</button>

                            <button class="center-menu-btn" style="grid-column: span 2;" :style="finalBtnStyle(item)" @click="handleFinalResultBtn(idx)">{{ finalBtnText(item) }}</button>
                        </div>

                        <!-- Nurture log table -->
                        <div class="nl-header" style="margin-top:10px; border-radius: 8px 8px 0 0;">양육 일지</div>
                        <div class="nl-container" style="margin-top:0; border-top:none; border-radius: 0 0 8px 8px;">
                            <table class="nl-table">
                                <thead>
                                    <tr>
                                        <th class="nl-th col-date">날짜</th>
                                        <th class="nl-th col-round">회차</th>
                                        <th class="nl-th col-method">방식</th>
                                        <th class="nl-th col-title">제목</th>
                                        <th class="nl-th col-btn">보고</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-if="getMergedLogs(item).length === 0">
                                        <td colspan="5" style="padding:15px;text-align:center;color:#aaa;font-size:12px;">아직 작성된 일지가 없어</td>
                                    </tr>
                                    <tr v-for="(logItem, logI) in getMergedLogs(item)" :key="logI">
                                        <td class="nl-td">{{ logItem.dateStr }}</td>
                                        <td class="nl-td">{{ logItem.data.round }}</td>
                                        <td class="nl-td">{{ logItem.data.method }}</td>
                                        <td class="nl-td" style="text-align:left;">{{ logItem.data.title }}</td>
                                        <td class="nl-td">
                                            <button v-if="logItem.type === 'normal'" class="btn-search" @click="openNurtureLogDetail(idx, logItem.originalIdx)">🔍</button>
                                            <button v-else class="btn-search" @click="viewTtagiReportForCenter(idx)">🔍</button>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </template>
        </div>

        <!-- Leaf popup chain (Phase 1 정합) -->
        <LeafListPopup
            v-if="leafState && leafState.phase === 'list'"
            :item="center.centerDataList[leafState.idx]"
            @pick="handleLeafPick"
            @close="leafState = null"
        />
        <LeafDatePopup
            v-else-if="leafState && leafState.phase === 'date'"
            :type="leafState.type"
            :name="leafState.name"
            @submit="handleLeafDateSubmit"
            @cancel="handleLeafDateCancel"
        />

        <!-- Phase 2 popups -->
        <TeacherEditPopup
            v-if="teacherPopupIdx !== null"
            :item="center.centerDataList[teacherPopupIdx]"
            @submit="handleTeacherSubmit"
            @close="teacherPopupIdx = null"
        />
        <StatusColorPopup
            v-if="statusPopupIdx !== null"
            :item="center.centerDataList[statusPopupIdx]"
            @submit="handleStatusSubmit"
            @close="statusPopupIdx = null"
        />
        <LogsPopup
            v-if="logsPopupIdx !== null"
            :entries="center.centerDataList[logsPopupIdx]?.logEntries || []"
            @delete="handleLogDelete"
            @close="logsPopupIdx = null"
        />

        <!-- Phase 2-b popups -->
        <StrategyPopup
            v-if="strategyState"
            ref="strategyPopupRef"
            :item="center.centerDataList[strategyState.idx]"
            :initial-step="strategyState.step"
            @submit="handleStrategySubmit"
            @reload="handleStrategyReload"
            @close="strategyState = null"
        />
        <FinalResultPopup
            v-if="finalResultState && finalResultState.sub === 'main'"
            :item="center.centerDataList[finalResultState.idx]"
            @pick-center="handleFinalCenter"
            @pick-dropout="handleFinalDropoutPick"
            @close="finalResultState = null"
        />
        <DropoutReasonPopup
            v-else-if="finalResultState && finalResultState.sub === 'dropout'"
            @submit="handleDropoutSubmit"
            @back="handleDropoutBack"
        />
        <MatchingInfoPopup
            v-if="matchingState && matchingState.view === 'menu'"
            @view-habjaeyang="handleMatchingViewHabjaeyang"
            @close="matchingState = null"
        />
        <HabjaeyangViewPopup
            v-else-if="matchingState && matchingState.view === 'habjaeyang'"
            :item="center.centerDataList[matchingState.idx]"
            @back="handleMatchingBack"
            @close="matchingState = null"
            @fieldSaved="loadCenterAssets"
        />

        <!-- Phase 4 popup -->
        <SchedulePopup
            v-if="schedulePopupIdx !== null"
            :item="center.centerDataList[schedulePopupIdx]"
            @submit="handleScheduleSubmit"
            @close="schedulePopupIdx = null"
        />

        <!-- Phase 5 popups -->
        <NurtureLogDetailPopup
            v-if="nurtureLogPopup"
            :item="center.centerDataList[nurtureLogPopup.idx]"
            :log-idx="nurtureLogPopup.logIdx"
            @submit="handleNurtureLogSubmit"
            @close="nurtureLogPopup = null"
        />
        <TtagiFormPopup
            v-if="ttagiFormPopupIdx !== null"
            :item="center.centerDataList[ttagiFormPopupIdx]"
            @submit="handleTtagiFormSubmit"
            @close="ttagiFormPopupIdx = null"
        />
        <TtagiViewPopup
            v-if="ttagiViewPopupIdx !== null"
            :item="center.centerDataList[ttagiViewPopupIdx]"
            @close="ttagiViewPopupIdx = null"
        />

        <!-- Phase 6 popup -->
        <ReportPopup
            v-if="reportPopupIdx !== null"
            :item="center.centerDataList[reportPopupIdx]"
            @submit="handleReportSubmit"
            @switch-to-ttagi="handleReportSwitchToTtagi"
            @close="reportPopupIdx = null"
        />
    </div>
</template>

<style scoped>
/* Center-specific styles NOT in global.css */
.center-dot {
    display: inline-block;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    margin-right: 5px;
}
.dot-red { background-color: #FF5252; }
.dot-orange { background-color: #FF9800; }
.dot-yellow { background-color: #FFEB3B; }
.dot-green { background-color: #4CAF50; }
.dot-blue { background-color: #2196F3; }
.dot-white { background-color: #EEEEEE; border: 1px solid #ccc; }

.status-dot-btn {
    font-size: 24px;
    padding: 10px;
    border-radius: 50%;
    cursor: pointer;
    border: 2px solid transparent;
    background: #fff;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
    width: 50px;
    height: 50px;
    display: flex;
    justify-content: center;
    align-items: center;
}
.status-dot-btn:active { transform: scale(0.95); }

.center-grid-style {
    display: grid;
    grid-template-columns: 0.8fr 1fr 1fr 0.8fr;
    gap: 5px;
    align-items: center;
    text-align: center;
}

.center-menu-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr;
    gap: 8px;
    margin-top: 5px;
    margin-bottom: 5px;
}

.center-menu-btn {
    padding: 12px 5px;
    font-size: 13px;
    background: #F5F5F5;
    border: 1px solid #E0E0E0;
    border-radius: 10px;
    cursor: pointer;
    color: #424242;
    font-family: 'Jua';
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    transition: all 0.2s;
}
.center-menu-btn:active { background: #E0E0E0; transform: translateY(2px); }

.leaf-grid { display: grid; gap: 8px; }
.leaf-row {
    display: flex;
    align-items: center;
    background: white;
    padding: 12px 15px;
    border: 1px solid #eee;
    border-radius: 10px;
    cursor: pointer;
    justify-content: space-between;
}
.leaf-label { font-weight: bold; color: #5D4037; font-size: 15px; }
.leaf-input-area { text-align: right; color: #888; font-size: 14px; display: flex; gap: 5px; align-items: center; }
.leaf-val-filled {
    color: #333;
    font-family: 'Noto Sans KR', sans-serif;
    font-size: 13px;
    line-height: 1.4;
    font-weight: normal;
}

.sch-container { display: flex; flex-direction: column; gap: 10px; max-height: 50vh; overflow-y: auto; padding-right: 5px; }
.sch-row { display: flex; align-items: center; gap: 15px; }
.sch-btn {
    width: 50px; height: 50px; border-radius: 50%; border: 2px solid #E0E0E0; background: white;
    color: #757575; font-weight: bold; font-size: 16px; cursor: pointer;
    display: flex; justify-content: center; align-items: center; transition: all 0.2s; font-family: 'Jua';
}
.sch-btn.active { background: var(--accent-color); color: white; border-color: var(--accent-color); box-shadow: 0 2px 5px rgba(255, 183, 77, 0.4); }
.sch-time-box {
    flex: 1; padding: 12px; background: #F5F5F5; border-radius: 10px; text-align: center;
    color: #333; font-weight: bold; font-size: 14px; border: 1px solid #EEEEEE;
    min-height: 45px; display: flex; align-items: center; justify-content: center;
}

.report-header-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 10px; }
.report-btn {
    padding: 10px 5px; border: 1px solid #ddd; background: white; border-radius: 8px;
    font-size: 13px; color: #555; cursor: pointer; font-family: 'Jua';
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.report-btn.selected { background: #FFF3E0; color: #EF6C00; border-color: #FFB74D; font-weight: bold; }
.report-label { font-size: 14px; font-weight: bold; color: #5D4037; margin-top: 15px; margin-bottom: 5px; display: block; text-align: left; }
.report-input { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 8px; font-family: 'Jua'; font-size: 15px; outline: none; }
.report-textarea {
    width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 8px;
    font-family: 'Noto Sans KR', sans-serif; font-size: 14px; outline: none; resize: none; min-height: 100px; line-height: 1.5;
}

.nl-container { margin-top: 15px; border: 1px solid #eee; border-radius: 8px; overflow-x: auto; background: #fff; }
.nl-header { background: #EFEBE9; padding: 8px; font-size: 13px; font-weight: bold; color: #5D4037; text-align: center; border-bottom: 1px solid #ddd; }
.nl-table { width: 100%; border-collapse: collapse; min-width: 320px; table-layout: fixed; }
.nl-th { background: #fafafa; font-size: 11px; padding: 6px; color: #888; border-bottom: 1px solid #eee; text-align: center; white-space: nowrap; }
.nl-td { font-size: 12px; padding: 8px 4px; border-bottom: 1px solid #eee; color: #333; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.col-date { width: 70px; }
.col-round { width: 50px; }
.col-method { width: 40px; }
.col-title { width: auto; text-align: left; padding-left: 5px; }
.nl-th.col-title { text-align: center; }
.col-btn { width: 40px; }
.btn-search { background: none; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; font-size: 12px; padding: 2px 6px; }

.tm-item { margin-bottom: 6px; background: white; border-radius: 12px; box-shadow: var(--shadow); overflow: hidden; }
.tm-summary { cursor: pointer; padding: 8px 5px; }
.tm-details { padding: 5px 10px 15px; }
</style>
