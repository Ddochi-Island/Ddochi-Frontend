<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useApi } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'

// [2026-04-22] index2.html openSemesterCalendar / renderSemesterCalendarView /
// moveCalMonth (L9702-9900) 이식. 사용자용 개강 달력 — 주차별 배경 + 마팔/신카/개강/활동지 뱃지.

const emit = defineEmits(['close'])
const { callApi } = useApi()
const { showAppAlert } = usePopup()

const viewDate = ref(new Date())
const loading = ref(true)
const sch = reactive({}) // 서버에서 불러온 schedule data

const monthKey = computed(() => {
    const y = viewDate.value.getFullYear()
    const m = String(viewDate.value.getMonth() + 1).padStart(2, '0')
    return `${y}-${m}`
})
const monthNum = computed(() => viewDate.value.getMonth() + 1)

function load() {
    loading.value = true
    callApi('/api/get-semester-schedule', { monthKey: monthKey.value }, (r) => {
        loading.value = false
        Object.keys(sch).forEach(k => delete sch[k])
        const data = (r && r.data) || {}
        Object.assign(sch, data)
    })
}

function moveMonth(offset) {
    const d = new Date(viewDate.value)
    d.setMonth(d.getMonth() + offset)
    viewDate.value = d
    load()
}

// --- 달력 계산 ---
function pad2(n) { return String(n).padStart(2, '0') }
function ymd(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` }

const today = new Date()
const todayStr = ymd(today)

function parseDate(s) { return s ? new Date(s) : null }

function getMidDate(s, e) {
    if (!s || !e) return null
    const d1 = new Date(s)
    const d2 = new Date(e)
    const diffTime = Math.abs(d2 - d1)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    d1.setDate(d1.getDate() + Math.floor(diffDays / 2))
    return ymd(d1)
}

// 화면에 표시할 날짜 범위 (startDate~endDate, 일요일 시작 ~ 토요일 끝)
const calendarCells = computed(() => {
    const y = viewDate.value.getFullYear()
    const m = viewDate.value.getMonth()

    let startDate = sch.w1_s ? new Date(sch.w1_s) : new Date(y, m, 1)
    let endDate
    if (sch.opening) endDate = new Date(sch.opening)
    else if (sch.w5_e) endDate = new Date(sch.w5_e)
    else if (sch.w4_e) endDate = new Date(sch.w4_e)
    else endDate = new Date(y, m + 1, 0)

    if (endDate < startDate) {
        startDate = new Date(y, m, 1)
        endDate = new Date(y, m + 1, 0)
    }

    // 주 경계 맞추기: startDate 는 월요일, endDate 는 일요일.
    // getDay() 는 0=일~6=토. 월요일 시작 grid 에서 컬럼 인덱스는 (getDay()+6)%7
    // → 일요일=6, 월요일=0, 화요일=1, ..., 토요일=5.
    const startCol = (startDate.getDay() + 6) % 7  // 월=0
    startDate.setDate(startDate.getDate() - startCol)
    const endCol = (endDate.getDay() + 6) % 7      // 월=0
    endDate.setDate(endDate.getDate() + (6 - endCol))

    const midDates = {
        w1: getMidDate(sch.w1_s, sch.w1_e),
        w2: getMidDate(sch.w2_s, sch.w2_e),
        w3: getMidDate(sch.w3_s, sch.w3_e),
        w4: getMidDate(sch.w4_s, sch.w4_e),
        w5: getMidDate(sch.w5_s, sch.w5_e)
    }

    function getWeekInfo(dateStr) {
        if (!dateStr) return null
        const check = (start, end, mid, cls, label) => {
            if (!start || !end) return null
            if (dateStr < start || dateStr > end) return null
            let renderType = 'dash'
            if (dateStr === start) renderType = 'start'
            else if (dateStr === end) renderType = 'end'
            else if (dateStr === mid) renderType = 'label'
            if (start === mid && dateStr === start) renderType = 'start_label'
            else if (end === mid && dateStr === end) renderType = 'end_label'
            else if (start === end && dateStr === start) renderType = 'single'
            return { cls, label, renderType }
        }
        return (
            check(sch.w1_s, sch.w1_e, midDates.w1, 'bg-w1', '1주차') ||
            check(sch.w2_s, sch.w2_e, midDates.w2, 'bg-w2', '2주차') ||
            check(sch.w3_s, sch.w3_e, midDates.w3, 'bg-w3', '3주차') ||
            check(sch.w4_s, sch.w4_e, midDates.w4, 'bg-w4', '4주차') ||
            check(sch.w5_s, sch.w5_e, midDates.w5, 'bg-w5', '5주차')
        )
    }

    const cells = []
    let loopDate = new Date(startDate)
    let safe = 0
    while (loopDate <= endDate && safe < 100) {
        const dateStr = ymd(loopDate)
        const dNum = loopDate.getDate()
        const isFirstOfMonth = dNum === 1 || loopDate.getTime() === startDate.getTime()
        const dDisp = isFirstOfMonth ? `${loopDate.getMonth() + 1}/${dNum}` : String(dNum)
        const dayOfWeek = loopDate.getDay()
        const isToday = dateStr === todayStr

        const wInfo = getWeekInfo(dateStr)

        let weekTextContent = ''
        let weekTextClass = ''
        if (wInfo) {
            let cssClass = 'cal-week-text'
            let content = ''
            if (wInfo.renderType === 'start') { content = '<'; cssClass += ' arrow' }
            else if (wInfo.renderType === 'end') { content = '>'; cssClass += ' arrow' }
            else if (wInfo.renderType === 'label') { content = wInfo.label; cssClass += ' bold-label' }
            else if (wInfo.renderType === 'single') { content = `< ${wInfo.label} >`; cssClass += ' bold-label' }
            else if (wInfo.renderType === 'dash') { content = '- - -' }
            else { content = wInfo.label; cssClass += ' bold-label' }
            weekTextContent = content
            weekTextClass = cssClass
        }

        const badges = []
        if (sch.mapal === dateStr) badges.push({ cls: 'badge-mapal', label: '마팔' })
        if (sch.shinka === dateStr) badges.push({ cls: 'badge-shinka', label: '신카' })
        if (sch.opening === dateStr) badges.push({ cls: 'badge-opening', label: '개강' })
        if (sch.activities && sch.activities[dateStr]) {
            badges.push({ cls: 'badge-activity', label: String(sch.activities[dateStr]) })
        }

        cells.push({
            dateStr,
            dDisp,
            isSun: dayOfWeek === 0,
            isSat: dayOfWeek === 6,
            isToday,
            weekClass: wInfo ? wInfo.cls : '',
            weekTextContent,
            weekTextClass,
            badges
        })

        loopDate.setDate(loopDate.getDate() + 1)
        safe++
    }

    return cells
})

onMounted(load)
</script>

<template>
    <Teleport to="body">
        <div class="modal-overlay" @click.self="emit('close')">
            <div class="admin-modal-card">
                <div class="modal-header-sticky">
                    <div class="modal-title" style="margin:0; text-align:center; width:100%;">📅 개강 일정 달력</div>
                    <span class="modal-close-sticky" style="position:absolute; right:20px;" @click="emit('close')">×</span>
                </div>

                <div class="modal-content-scroll">
                    <div class="cal-wrapper">
                        <div class="cal-nav">
                            <button class="cal-nav-btn" @click="moveMonth(-1)">◀</button>
                            <span class="cal-title">{{ monthNum }}월 일정</span>
                            <button class="cal-nav-btn" @click="moveMonth(1)">▶</button>
                        </div>

                        <div v-if="loading" style="text-align:center; padding:30px;">일정 불러오는 중...</div>

                        <div v-else class="cal-grid-container">
                            <div class="cal-grid">
                                <div class="cal-header">월</div>
                                <div class="cal-header">화</div>
                                <div class="cal-header">수</div>
                                <div class="cal-header">목</div>
                                <div class="cal-header">금</div>
                                <div class="cal-header cal-sat">토</div>
                                <div class="cal-header cal-sun">일</div>

                                <div v-for="cell in calendarCells" :key="cell.dateStr"
                                    :class="['cal-cell', cell.weekClass, cell.isToday ? 'cal-today' : '']">
                                    <div :class="['cal-date-num', cell.isSun ? 'cal-sun' : '', cell.isSat ? 'cal-sat' : '']">
                                        {{ cell.dDisp }}
                                    </div>
                                    <div>
                                        <span v-for="(b, i) in cell.badges" :key="i"
                                            :class="['cal-badge', b.cls]">{{ b.label }}</span>
                                    </div>
                                    <div v-if="cell.weekTextContent" :class="cell.weekTextClass">
                                        {{ cell.weekTextContent }}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="btn-group" style="margin-top:15px;">
                            <button class="btn-neg" @click="emit('close')">닫기</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </Teleport>
</template>
