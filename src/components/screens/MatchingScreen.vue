<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useTmStore } from '@/stores/tm'
import { useUiStore } from '@/stores/ui'
import { useApi } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'
import { useFormatters } from '@/composables/useFormatters'
import { MATCH_RESULT_HIDE_MS, REJECT_HIDE_MS } from '@/constants'
import HabjaeyangViewPopup from './popups/HabjaeyangViewPopup.vue'
import MatchResultPopup from './popups/MatchResultPopup.vue'
import TeacherEditPopup from './popups/TeacherEditPopup.vue'
import TtagiFormPopup from './popups/TtagiFormPopup.vue'
import TtagiViewPopup from './popups/TtagiViewPopup.vue'

const router = useRouter()
const auth = useAuthStore()
const tm = useTmStore()
const ui = useUiStore()
const { callApi } = useApi()
const { showPopup, closePopup, showAppAlert, showAppConfirm } = usePopup()
const { getDay } = useFormatters()

const loading = ref(true)
const noData = ref(false)
const selectedAccordionId = ref(null)
const isDesktop = ref(window.innerWidth >= 1024)

// 합재양 보기 popup state (legacy viewHabjaeyangPopup 컴포넌트화)
const habjaeyangViewIdx = ref(null)

// 결과 입력 popup state (legacy inputMatchResult 컴포넌트화 — window.__ 제거)
const matchResultIdx = ref(null)

const searchQuery = ref('')
const ttagiViewIdx = ref(null)
const ttagiFormIdx = ref(null)
const teacherEditIdx = ref(null)
const subGuideMenuIdx = ref(null)

// 매 분 갱신 — 매칭 시간 경과 여부 실시간 반영
const nowTick = ref(new Date())
let _nowTimer = null
function _onResize() { isDesktop.value = window.innerWidth >= 1024 }
onMounted(() => {
    _nowTimer = setInterval(() => { nowTick.value = new Date() }, 30000)
    window.addEventListener('resize', _onResize)
})
onUnmounted(() => {
    clearInterval(_nowTimer)
    window.removeEventListener('resize', _onResize)
})

// --- Computed: display list with ghosts ---
const displayGroups = computed(() => {
    const now = new Date()

    // 1. Filter raw list
    const rawList = tm.tmDataList.filter(item => {
        if (searchQuery.value) {
            const q = searchQuery.value.trim()
            const nameMatch = item.name?.includes(q) || item.habjaeyang?.subName?.includes(q)
            if (!nameMatch) return false
        }
        const isManPix = item.tmResultDetail === '\uB9CC\uB0A8\uD53D\uC2A4'
        const isAppr = item.approvalStatus === '\uC7AC\uAC00' || item.approvalStatus === '\uBC18\uB824'
        const isResultEncoded = !!item.matchResultDetail
        const isShed = (item.path || '').startsWith('shed_')

        // shed prospect\uB294 \uC774\uAD00 \uC9C1\uD6C4 approved\uB85C \uC0DD\uC131\uB418\uBBC0\uB85C \uC7AC\uAC00 \uB2E8\uB3C5 \uC870\uAC74 \uC81C\uC678
        if (isShed ? (!isManPix && !isResultEncoded) : (!isManPix && !isAppr && !isResultEncoded)) return false

        // Hide rejected items after 3 hours
        if (item.approvalStatus === '\uBC18\uB824') {
            let rejectTime = null
            if (item.logs) {
                const lines = item.logs.split('\n')
                for (let line of lines) {
                    if (line.includes('\uBC18\uB824')) {
                        const p = line.split('|')[0].trim().split(/[. :]/)
                        if (p.length >= 5) {
                            rejectTime = new Date(2000 + parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]), parseInt(p[3]), parseInt(p[4]))
                            break
                        }
                    }
                }
            }
            if (!rejectTime || now - rejectTime > REJECT_HIDE_MS) return false
        }

// Hide results after 48 hours \u2014 \uBC00\uB9BC/2\uCC28 \uC774\uB825\uC740 \uBA74\uC81C
        if (item.matchResultDetail) {
            const isMilrim2cha = item.matchResultDetail.includes('\uBC00\uB9BC') || item.matchResultDetail.includes('2\uCC28')
            if (!isMilrim2cha) {
                let resultTime = null
                if (item.logs) {
                    const lines = item.logs.split('\n')
                    for (let line of lines) {
                        if (line.includes('\uACB0\uACFC\uCC98\uB9AC') || line.includes('\uB9E4\uCE6D\uACB0\uACFC') || line.includes('\uB9E4\uCE6D\uCDE8\uC18C')) {
                            const p = line.split('|')[0].trim().split(/[. :]/)
                            if (p.length >= 5) {
                                resultTime = new Date(2000 + parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]), parseInt(p[3]), parseInt(p[4]))
                                break
                            }
                        }
                    }
                }
                if (resultTime && (now - resultTime > MATCH_RESULT_HIDE_MS)) return false
            }
        }
        return true
    })

    // 2. V3.19 사람 1행 + 미팅 N행 — meetings 시계열 기반 카드 생성.
    //    마커(⭕️2차만남) 미팅 = 이력 ghost 카드 (_nextDate = 다음 미팅 날짜|'미정'),
    //    최신 미팅이 마커 & 후속 없음 = 미정 대기 → 활성 카드를 '미정' 그룹으로.
    const POSTPONE_MARKERS = ['⭕️2차만남', '❌밀림']
    let displayList = []
    rawList.forEach(item => {
        const meetings = item.meetings || []
        const last = meetings[meetings.length - 1]
        const isMijung = !!(last && POSTPONE_MARKERS.includes(last.outcome))

        // 미정 대기 상태이면 ghost 카드 생략 — 미정 활성 카드 한 장만 표시
        if (!isMijung) {
            meetings.forEach((mt, mi) => {
                if (!POSTPONE_MARKERS.includes(mt.outcome)) return
                const next = meetings[mi + 1]
                displayList.push({
                    ...item,
                    habjaeyang: { ...(item.habjaeyang || {}), mtDate: mt.date, mtTime: mt.time, isSecondMeet: mt.isSecondMeet },
                    matchResultDetail: mt.outcome,
                    isGhost: true,
                    _cardKey: item.docId + ':m' + mt.meetingId,
                    _nextDate: next ? next.date : '미정',
                })
            })
        }

        if (isMijung) {
            // 미정 대기 — 새 날짜가 아직 없으므로 활성 카드는 날짜 미정 그룹에 표시
            displayList.push({
                ...item,
                habjaeyang: { ...(item.habjaeyang || {}), mtDate: '미정', mtTime: '' },
                matchResultDetail: '',
                _cardKey: item.docId,
            })
        } else {
            displayList.push({ ...item, _cardKey: item.docId })
        }
    })

    // 3. Group by date
    const groups = {}
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const twoDaysAgo = new Date(today)
    twoDaysAgo.setDate(today.getDate() - 2)

    displayList.forEach(item => {
        const mtDate = item.habjaeyang && item.habjaeyang.mtDate
        const dateStr = (mtDate && mtDate !== '\uBBF8\uC815') ? mtDate : '\uBBF8\uC815'

        let resDisp = item.matchResultDetail || ''
        if ((item.approvalStatus === '\uBC18\uB824' || item.approvalStatus === '\uCDE8\uC18C') &&
            !resDisp.includes('\u2B55\uFE0F') && !resDisp.includes('\u274C')) {
            resDisp = item.approvalStatus
        }

        const isDone = resDisp.includes('\u2B55\uFE0F') || resDisp.includes('\u274C') || resDisp.includes('\uC0C1\uB2F4\uB530\uAE30') || resDisp.includes('2\uCC28') || resDisp.includes('\uBC18\uB824') || resDisp.includes('\uCDE8\uC18C') || resDisp === '\uACB0\uACFC \uB300\uAE30'
        const isPending = resDisp.includes('\uC694\uCCAD\uC911')
        const isHistoryRecord = resDisp.includes('\uBC00\uB9BC') || resDisp.includes('2\uCC28')

        if (dateStr !== '\uBBF8\uC815') {
            const itemDate = new Date(dateStr)
            itemDate.setHours(0, 0, 0, 0)
            // \uBC00\uB9BC/2\uCC28 \uC774\uB825 \uCE74\uB4DC\uB294 \uC624\uB798\uB41C \uB0A0\uC9DC\uC5EC\uB3C4 \uACC4\uC18D \uD45C\uC2DC
            if (itemDate < twoDaysAgo && !isHistoryRecord) {
                if (item.isGhost || (isDone && !isPending)) return
            }
        }
        // \uBBF8\uC815: \uD56D\uC0C1 \uD45C\uC2DC (\uB808\uAC70\uC2DC \uC815\uD569)

        if (!groups[dateStr]) groups[dateStr] = []
        groups[dateStr].push(item)
    })

    // 4. Sort dates and items within each group
    const dates = Object.keys(groups).sort()
    const result = dates.map(date => {
        const items = groups[date]
        items.sort((a, b) => {
            const ta = (a.habjaeyang && a.habjaeyang.mtTime) || '00:00'
            const tb = (b.habjaeyang && b.habjaeyang.mtTime) || '00:00'
            return ta.localeCompare(tb)
        })

        let dateDisplay = date
        let isToday = false
        let targetDateObj = null

        if (date !== '\uBBF8\uC815' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
            targetDateObj = new Date(date)
            targetDateObj.setHours(0, 0, 0, 0)
            const mm = (targetDateObj.getMonth() + 1).toString().padStart(2, '0')
            const dd = targetDateObj.getDate().toString().padStart(2, '0')
            const dayOfWeek = getDay(date)
            dateDisplay = `${mm}/${dd}(${dayOfWeek})`

            if (targetDateObj.getTime() === today.getTime()) {
                isToday = true
                dateDisplay = `\uC624\uB298 - ${dateDisplay}`
            }
        } else if (date === '\uBBF8\uC815') {
            dateDisplay = '\uB0A0\uC9DC \uBBF8\uC815'
        }

        return {
            date,
            dateDisplay,
            isToday,
            targetDateObj,
            items: items.map((item, loopIndex) => ({
                ...item,
                _loopIndex: loopIndex,
                _realIdx: item.isGhost ? -1 : tm.tmDataList.findIndex(x => x.docId === item.docId),
                _accordionId: `meet-${date.replace(/[^\w\uAC00-\uD7A3]/g, '')}-${loopIndex}`,
                _targetDateObj: targetDateObj
            }))
        }
    })

    return result
})

const selectedItem = computed(() => {
    if (!selectedAccordionId.value) return null
    for (const group of displayGroups.value) {
        const found = group.items.find(i => i._accordionId === selectedAccordionId.value)
        if (found) return found
    }
    return null
})

// --- Methods ---
function toggleDetail(id) {
    selectedAccordionId.value = id
    if (!isDesktop.value) {
        if (tm.currentlyExpandedId && tm.currentlyExpandedId !== id) {
            tm.currentlyExpandedId = null
        }
        tm.currentlyExpandedId = (tm.currentlyExpandedId === id) ? null : id
    }
}

function isDetailVisible(id) {
    return tm.currentlyExpandedId === id
}

function getResDisplay(item) {
    let resDisp = item.matchResultDetail || ''
    // \u2B55\uFE0F/\u274C \uACB0\uACFC\uAC00 \uC774\uBBF8 \uC788\uC73C\uBA74 approvalStatus \uB85C \uB36E\uC5B4\uC4F0\uC9C0 \uC54A\uC74C (2\uCC28\uB9CC\uB0A8/\uCDE8\uC18C\uCC98\uB9AC \uB4F1 \uACB0\uACFC \uBCF4\uC874)
    if ((item.approvalStatus === '\uBC18\uB824' || item.approvalStatus === '\uCDE8\uC18C') &&
        !resDisp.includes('\u2B55\uFE0F') && !resDisp.includes('\u274C')) {
        resDisp = item.approvalStatus
    }
    return resDisp
}

function getNameDisplay(item) {
    return (item.habjaeyang && item.habjaeyang.subName) || item.name || ''
}

function getTeacherDisplay(item) {
    const isAssigned = item.teacher && item.teacher.trim() !== '' && item.teacher !== '-'
    if (!isAssigned) return '<span style="color:red; font-weight:bold;">\u203C\uFE0F</span>'
    return item.teacher.replace('(', '<br>(')
}

function isTeacherAssigned(item) {
    return item.teacher && item.teacher.trim() !== '' && item.teacher !== '-'
}

function getMilrimNewDate(item) {
    // V3.19: 다음 미팅 날짜는 meetings 시계열에서 계산된 _nextDate 사용
    const nd = item._nextDate
    if (!nd) return null
    if (nd === '미정') return '미정'
    const m = nd.match(/^(\d{4})-(\d{2})-(\d{2})/)
    return m ? `${parseInt(m[2])}/${parseInt(m[3])}` : null
}

function getRightStatusHtml(item) {
    const now = new Date()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const resDisp = getResDisplay(item)
    const hj = item.habjaeyang || {}
    const approval = item.approvalStatus
    const isGhost = item.isGhost

    if (isGhost) {
        if (resDisp === '\u2B55\uFE0F\uBC00\uB9BC') {
            const newDate = getMilrimNewDate(item)
            const display = '\u274C\uBC00\uB9BC' + (newDate ? `\n(${newDate})` : '')
            return `<span style="color:#795548; font-weight:bold; white-space: pre-wrap;">${display}</span>`
        }
        if (resDisp === '\u2B55\uFE0F2\uCC28\uB9CC\uB0A8') {
            const newDate = getMilrimNewDate(item)
            const display = '\u2B55\uFE0F2\uCC28\uB9CC\uB0A8' + (newDate ? `\n(${newDate})` : '')
            return `<span style="color:#9C27B0; font-weight:bold; white-space: pre-wrap;">${display}</span>`
        }
        let ghostColor = '#888'
        if (resDisp.includes('\u274C')) ghostColor = '#795548'
        else if (resDisp.includes('\u2B55\uFE0F')) ghostColor = '#9C27B0'
        return `<span style="color:${ghostColor}; font-weight:bold; white-space: pre-wrap;">${resDisp.replace('(', '<br>(')}</span>`
    }

    if (approval === '\uBC18\uB824') {
        return `<span class="status-reject">\u2796\uBC18\uB824</span>`
    }

    if (approval === '\uCDE8\uC18C') {
        let color = '#795548'
        if (resDisp.includes('\u2B55\uFE0F')) color = '#9C27B0'
        return `<span style="color:${color}; font-weight:bold; white-space:pre-wrap;">${resDisp || '\uCDE8\uC18C'}</span>`
    }

    if (approval !== '\uC7AC\uAC00') {
        const hjBothOn = !!(hj.replied && hj.windowOpened)
        if (!hjBothOn) {
            return `<button class="btn-locked" data-action="showLockedMenu" data-idx="${item._realIdx}">\uD83D\uDD12</button>`
        }
        if (item._targetDateObj) {
            const diffTime = item._targetDateObj - today
            const diffDays = diffTime / (1000 * 60 * 60 * 24)
            if (diffDays > 3) return `<button class="btn-locked" data-action="showLocked">\uD83D\uDD12</button>`
        }
        return `<button class="btn-approve" data-action="approve" data-idx="${item._realIdx}">\uC7AC\uAC00</button>`
    }

    // approval === '재가'
    if (resDisp) {
        let resColor = '#333'
        if (resDisp.includes('\u274C')) resColor = '#795548'
        else if (resDisp.includes('2\uCC28')) resColor = '#9C27B0'
        else if (resDisp.includes('\uC0C1\uB2F4\uB530\uAE30')) resColor = '#1A237E'
        else if (resDisp.includes('\uC694\uCCAD\uC911')) resColor = '#FF9800'
        return `<span style="color:${resColor}; font-weight:bold; white-space: pre-wrap;">${resDisp.replace('(', '<br>(')}</span>`
    }

    if (!isTeacherAssigned(item)) {
        return `<span style="color:#FBC02D; font-weight:bold;">\uAD50\uC0AC\uAD6C\uD568</span>`
    }

    let isOverdue = false
    if (hj.mtDate && hj.mtTime) {
        const mt = new Date(hj.mtDate + 'T' + hj.mtTime)
        if (mt < nowTick.value) isOverdue = true
    }
    if (isOverdue) return `<span style="color:#FF9800; font-weight:bold;">\uACB0\uACFC\uB300\uAE30</span>`
    return `<span style="color:#4CAF50; font-weight:bold;">\uC900\uBE44\uC644\uB8CC</span>`
}

function getBottomAreaType(item) {
    const resDisp = getResDisplay(item)

    if (item.isGhost) return 'ghost'
    if (resDisp.includes('\uC694\uCCAD\uC911')) return 'pending'
    if (item.approvalStatus !== '\uC7AC\uAC00') return 'viewHj'

    const hj = item.habjaeyang || {}
    if (hj.mtDate && hj.mtTime) {
        const mt = new Date(hj.mtDate + 'T' + hj.mtTime)
        if (mt < nowTick.value) return 'resultInput'
    }

    if (!isTeacherAssigned(item)) return 'teacherNeeded'

    return 'readyToMeet'
}

function showHasConsultBtn(item) {
    const resDisp = getResDisplay(item)
    return !item.isGhost && resDisp.includes('\uC0C1\uB2F4\uB530\uAE30')
}

// --- Format logs ---
// entries: [{id, source, text}] \u2014 id+source \uB294 \uC0AD\uC81C \uC2DC \uC11C\uBC84\uAC00 \uC815\uD655\uD55C \uC6D0\uBCF8 \uD589\uC744 \uCC3E\uAE30 \uC704\uD55C \uC548\uC815\uC801 \uD0A4.
function formatLogs(entries, docId) {
    if (!entries || !entries.length) return '<div style="padding:10px;text-align:center;color:#aaa;">\uAE30\uB85D \uC5C6\uC74C</div>'
    let html = ''

    entries.forEach((entry) => {
        const line = entry.text || ''
        if (!line.trim()) return
        let cssClass = 'log-card'
        if (line.includes('[\uCD5C\uCD08\uC815\uBCF4]')) cssClass += ' log-initial'

        const parts = line.split('|')
        const delBtnHtml = `<span class="log-del-btn" data-action="deleteLog" data-row-id="${docId}" data-log-id="${entry.id}" data-log-source="${entry.source}">[x]</span>`

        if (parts.length >= 3) {
            const dateRaw = parts[0].trim()
            const type = parts[1].trim()
            const content = parts[2].trim()
            const author = parts[3] ? parts[3].trim() : ''
            const shortDate = dateRaw.length > 3 ? dateRaw.substring(3) : dateRaw
            const authorHtml = author ? `<span style="font-size:10px; color:#888; margin-right:5px;">(${author})</span>` : ''

            html += `<div class="${cssClass}"><div class="log-header"><span>${shortDate}</span><span>${authorHtml}${delBtnHtml}</span></div><div class="log-result">${type}</div><div class="log-content">${content}</div></div>`
        } else {
            html += `<div class="${cssClass}"><div class="log-content">${line} ${delBtnHtml}</div></div>`
        }
    })
    return html
}

// --- Action handlers ---
function handleContainerClick(event) {
    const target = event.target
    if (target.dataset.action === 'deleteLog') {
        deleteLog(target.dataset.rowId, target.dataset.logId, target.dataset.logSource)
    }
    if (target.dataset.action === 'showLocked') {
        event.stopPropagation()
        showAppAlert('3\uC77C \uB0B4\uB85C \uB4E4\uC5B4\uC624\uB294 \uB0A0\uC5D0 \uC7AC\uAC00\uD560 \uC218 \uC788\uC5B4! \uD83D\uDCC5')
    }
    if (target.dataset.action === 'showLockedMenu') {
        event.stopPropagation()
        const idx = parseInt(target.dataset.idx)
        showPopup('appConfirm', '\uC54C\uB9BC \uD83E\uDD94', null, (yes) => {
            if (yes) showApprDecisionPopup(idx)
        }, { message: '\uD83D\uDCAC \uB2F5\uC7A5\uACFC \uD83D\uDEAA \uCC3D\uAC1C\uC124 \uB458 \uB2E4 \uCCB4\uD06C\uD574\uC57C \uC7AC\uAC00\uD560 \uC218 \uC788\uC5B4!<br>\uBC18\uB824\uD558\uB824\uBA74 \uC751! \uB20C\uB7EC\uC918.' })
    }
    if (target.dataset.action === 'approve') {
        event.stopPropagation()
        const idx = parseInt(target.dataset.idx)
        handleApprStatusClick(idx)
    }
}

function deleteLog(rowId, logId, source) {
    showAppConfirm('기록을 삭제할거야?', (yes) => {
        if (!yes) return
        callApi('/api/delete-log', {
            sabun: auth.currentSabun,
            rowIndex: rowId,
            id: logId,
            source
        }, () => {
            loadMatchingData()
        })
    })
}

function handleApprStatusClick(idx) {
    const item = tm.tmDataList[idx]
    if (!item) return
    if (item.approvalStatus === '\uC7AC\uAC00' || item.approvalStatus === '\uBC18\uB824' || item.approvalStatus === '\uCDE8\uC18C') {
        showPopup('redecideAppr', '\uC774\uBBF8 \uACB0\uC815\uB41C \uD56D\uBAA9\uC774\uC57C!', '\uC218\uC815\uD574\uC57C\uD558\uB294\uAC70\uC57C?', (res) => {
            if (res.proceed) showApprDecisionPopup(idx)
        })
    } else {
        showApprDecisionPopup(idx)
    }
}

function showApprDecisionPopup(idx) {
    showPopup('decision', '\uC7AC\uAC00\uD558\uC5EC \uC8FC\uC2DC\uC635\uC18C\uC11C.', '\uD569\uC7AC\uC591 \uD655\uC778 \uD558\uC168\uC8E0?\uD83E\uDD14', (res) => {
        if (res.choice === 'approve') {
            showPopup('approveConfirm', '\uC624\uC608! \uC815\uB9D0\uC694!?', '\uBE44\uD569\uC0AC\uC720\uB97C \uBAA8\uB450 \uD655\uC778\uD558\uC168\uB098\uC694?', (res2) => {
                if (!res2.proceed) return
                const item = tm.tmDataList[idx]
                callApi('/api/update-approval', {
                    sabun: auth.currentSabun,
                    rowIndex: item.docId,
                    status: '\uC7AC\uAC00'
                }, r => {
                    showAppAlert(r.message || '\uC7AC\uAC00 \uC644\uB8CC!')
                    loadMatchingData()
                })
            })
        } else {
            showPopup('reason', '\uB108\uBB34 \uC2AC\uD37C\uC694..', '\uC0AC\uC720\uAC00 \uC5B4\uB5A4\uAC74\uAC00\uC694?', (res3) => {
                if (!res3 || !res3.reasonType) return
                const item = tm.tmDataList[idx]
                if (res3.reasonType === '\uB9E4\uCE6D\uCDE8\uC18C') {
                    showPopup('reason', '\uB9E4\uCE6D\uCDE8\uC18C', '', (res4) => {
                        if (!res4 || !res4.reasonType) return
                        const reasonText = res4.reason ? `\uB9E4\uCE6D\uCDE8\uC18C(${res4.reasonType}) / ${res4.reason}` : `\uB9E4\uCE6D\uCDE8\uC18C(${res4.reasonType})`
                        callApi('/api/update-approval', {
                            sabun: auth.currentSabun,
                            rowIndex: item.docId,
                            status: '\uBC18\uB824',
                            reason: reasonText
                        }, r => {
                            showAppAlert(r.message || '\uBC18\uB824 \uCC98\uB9AC \uC644\uB8CC!')
                            loadMatchingData()
                        })
                    }, { options: ['\uC758\uC2EC/\uACBD\uACC4', '\uAC70\uB9AC\uBD80\uB2F4', '\uB300\uBA74\uBD80\uB2F4', '\uBA54\uB9AC\uD2B8\uBD80\uC871', '\uB2F5\uC7A5\uC548\uC634'] })
                } else {
                    const reasonText = res3.reason ? `${res3.reasonType} / ${res3.reason}` : res3.reasonType
                    callApi('/api/update-approval', {
                        sabun: auth.currentSabun,
                        rowIndex: item.docId,
                        status: '\uBC18\uB824',
                        reason: reasonText
                    }, r => {
                        showAppAlert(r.message || '\uBC18\uB824 \uCC98\uB9AC \uC644\uB8CC!')
                        loadMatchingData()
                    })
                }
            }, { options: ['\uB9E4\uCE6D\uCDE8\uC18C', '\uD658\uACBD\uBC18\uB824', '\uC778\uC131\uBC18\uB824', '\uC911\uC12D\uBC18\uB824', '\uB2F5\uC7A5\uC548\uC634', '\uC798\uBABB\uC62C\uB9BC'] })
        }
    })
}

function editMatchAction(event, idx, type) {
    event.stopPropagation()
    const item = tm.tmDataList[idx]
    if (!item) return

    if (type === 'date') {
        showPopup('dateCheck', '\uB0A0\uC9DC \uC218\uC815', '\uBC00\uB9B0\uAC70 \uC544\uB2C8\uC8E0?!', (dateCheckRes) => {
            if (!dateCheckRes.proceed) return
            showPopup('date', '\uB0A0\uC9DC\uC218\uC815', '\uC5B8\uC81C\uB85C \uBC14\uAFC0\uAE4C?', (res) => {
                callApi('/api/edit-match', {
                    sabun: auth.currentSabun,
                    rowIndex: item.docId,
                    type: 'date',
                    value: res.date
                }, r => {
                    showAppAlert(r.message)
                    loadMatchingData()
                })
            })
        })
    } else if (type === 'subGuide') {
        subGuideMenuIdx.value = idx
    } else if (type === 'teacher') {
        teacherEditIdx.value = idx
    }
}

function toggleHjStatus(idx, field) {
    const item = tm.tmDataList[idx]
    if (!item) return
    callApi('/api/toggle-hj-status', { docId: item.docId, field }, r => {
        if (r.success) loadMatchingData()
        else showAppAlert(r.message || '오류가 발생했어')
    })
}

// 합재양 보기 — CenterScreen 의 HabjaeyangViewPopup 재사용 (read-only).
// legacy viewHabjaeyangPopup 의 20+ field (인적/환경/내면/태도) 전부 노출.
// 인라인 편집 (editHjField) 은 별도 phase.
function viewHabjaeyangPopup(idx) {
    if (!tm.tmDataList[idx]) return
    habjaeyangViewIdx.value = idx
}

// \uACB0\uACFC \uC785\uB825 6 \uC635\uC158 grid popup \u2014 MatchResultPopup \uCEF4\uD3EC\uB10C\uD2B8\uD654 (window.__ \uC81C\uAC70).
// legacy inputMatchResult / handleMatchRes \uC815\uD569.
function inputMatchResult(idx) {
    if (!tm.tmDataList[idx]) return
    const item = tm.tmDataList[idx]
    const resDisp = getResDisplay(item)
    const hasResult = resDisp.includes('⭕️') || resDisp.includes('❌') || resDisp.includes('상담따기') || resDisp.includes('안만남')
    if (hasResult) {
        showAppConfirm(`이미 "${resDisp}" 결과가 있어!\n덮어쓸거야?`, (yes) => {
            if (yes) matchResultIdx.value = idx
        })
        return
    }
    matchResultIdx.value = idx
}

// MatchResultPopup \uC758 'pick' emit \uD578\uB4E4\uB7EC. legacy handleMatchRes \uC758 \uBD84\uAE30 \uC815\uD569.
function handleMatchResultPick(resultType) {
    const idx = matchResultIdx.value
    if (idx === null) return
    matchResultIdx.value = null

    const item = tm.tmDataList[idx]
    if (!item) return

    // \uAD50\uC0AC \uBBF8\uC9C0\uC815 \uAC00\uB4DC \u2014 \uC0C1\uB2F4\uB530\uAE30/2\uCC28\uB9CC\uB0A8 \uC740 \uAD50\uC0AC \uD544\uC694 (legacy \uC815\uD569)
    const isTeacherAssigned = item.teacher && String(item.teacher).trim() !== '' && item.teacher !== '-'
    if (!isTeacherAssigned && (resultType === '\uC0C1\uB2F4\uB530\uAE30' || resultType === '2\uCC28\uB9CC\uB0A8')) {
        showAppAlert('\uAD50\uC0AC\uAC00 \uC9C0\uC815\uB418\uC9C0 \uC54A\uC558\uC5B4! \uD83E\uDD7A\n\uAD50\uC0AC\uB2D8\uC744 \uBA3C\uC800 \uC9C0\uC815\uD574\uC918!')
        return
    }

    if (resultType === '\uCDE8\uC18C\uCC98\uB9AC' || resultType === '\uBE44\uD569\uCC98\uB9AC' || resultType === '\uD0C8\uB77D\uCC98\uB9AC') {
        // 1. \uCDE8\uC18C/\uBE44\uD569/\uD0C8\uB77D \u2192 reason popup (subcategory grid + \uC790\uC720 \uC0AC\uC720)
        let opts = []
        if (resultType === '\uCDE8\uC18C\uCC98\uB9AC') opts = ['\uACBD\uACC4\uCDE8\uC18C', '\uAC08\uBD80\uCDE8\uC18C', '\uD658\uACBD\uCDE8\uC18C', '\uC5F0\uB450\uCDE8\uC18C']
        else if (resultType === '\uBE44\uD569\uCC98\uB9AC') opts = ['\uD658\uACBD\uBE44\uD569', '\uC778\uC131\uBE44\uD569', '\uC815\uC2E0\uC9C8\uD658', '\uAC74\uAC15\uBE44\uD569']
        else opts = ['\uACBD\uACC4\uD0C8\uB77D', '\uAC08\uBD80\uD0C8\uB77D']

        showPopup('reason', resultType, '', (res) => {
            if (!res || !res.reasonType) return
            const icon = resultType === '\uCDE8\uC18C\uCC98\uB9AC' ? '\u274C' : '\u2B55\uFE0F'
            const uColText = `${icon}${res.reasonType}`
            const reasonText = res.reason || '-'
            const logText = `${icon}${res.reasonType}(${reasonText})`
            updateMatchStatus(idx, item.approvalStatus, {
                matchResult: uColText,
                logType: '\uACB0\uACFC\uCC98\uB9AC',
                logContent: logText,
                tmFail: true,
            })
        }, { options: opts })
        return
    }

    if (resultType === '\uBC00\uB9BC\uCC98\uB9AC' || resultType === '2\uCC28\uB9CC\uB0A8') {
        // 2. \uBC00\uB9BC/2\uCC28 \u2192 date popup \u2192 /api/postpone-meeting (V3.19: \uBBF8\uD305 \uB9C8\uD0B9 + \uC0C8 \uBBF8\uD305\uD589)
        const promptTitle = resultType === '\uBC00\uB9BC\uCC98\uB9AC' ? '\uC5B8\uC81C\uB85C \uBC00\uB838\uC5B4?\u3160' : '\uC218\uACE0\uD588\uC5B4! 2\uCC28\uB294 \uC5B8\uC81C\uC57C?'
        showPopup('date', promptTitle, '', (res) => {
            if (!res || !res.date) return
            const hj = item.habjaeyang || {}
            const oldDateInfo = `${hj.mtDate || '-'} ${hj.mtTime || '00:00'}`
            const safeReason = res.reason || '-'
            callApi('/api/postpone-meeting', {
                sabun: auth.currentSabun,
                rowIndex: item.docId,
                newDate: res.date,
                logType: resultType,
                logContent: safeReason,
                oldDateInfo,
            }, r => {
                showAppAlert(r.message, () => loadMatchingData())
            })
        })
        return
    }

    if (resultType === '\uC0C1\uB2F4\uB530\uAE30') {
        // 3. \uC0C1\uB2F4\uB530\uAE30 \u2192 /api/update-match type='status', matchResult='\u2B55\uFE0F\uC0C1\uB2F4\uB530\uAE30'
        const resultStr = '\u2B55\uFE0F\uC0C1\uB2F4\uB530\uAE30'
        callApi('/api/update-match', {
            sabun: auth.currentSabun,
            rowIndex: item.docId,
            type: 'status',
            data: {
                rowIndex: item.docId,
                matchResult: resultStr,
                logType: '\uB9E4\uCE6D\uACB0\uACFC',
                logContent: resultStr,
            },
        }, () => {
            showAppAlert('\uC0C1\uB2F4\uB530\uAE30\uB85C \uACB0\uACFC\uAC00 \uC785\uB825\uB418\uC5C8\uC5B4! \uD83C\uDF89', () => {
                item.matchResultDetail = resultStr
                loadMatchingData()
            })
        })
    }
}

// updateMatchStatus \uD5EC\uD37C \u2014 legacy \uC640 \uB3D9\uC77C shape \uC758 /api/update-match type='status' \uD638\uCD9C.
// payload: { rowIndex, approvalStatus, ...extra }  \u2014 extra \uC5D0 matchResult/logType/logContent/tmFail \uB4F1.
function updateMatchStatus(idx, status, extra = {}, skipAlert = false) {
    const item = tm.tmDataList[idx]
    if (!item) return
    if (!extra.logContent) {
        extra.logContent = `${status} \uC0C1\uD0DC\uB85C \uBCC0\uACBD`
        extra.matchResult = ''
    }
    const payload = { rowIndex: item.docId, approvalStatus: status, ...extra }
    callApi('/api/update-match', {
        sabun: auth.currentSabun, rowIndex: item.docId, type: 'status', data: payload,
    }, r => {
        const apply = () => {
            item.approvalStatus = status
            if (extra.matchResult !== undefined) item.matchResultDetail = extra.matchResult
            loadMatchingData()
        }
        if (skipAlert) apply()
        else showAppAlert(r.message, apply)
    })
}

function editSubName(idx) {
    subGuideMenuIdx.value = null
    showPopup('text', '\uC12D\uC678\uC790 \uC218\uC815', '\uC12D\uC678\uC790 \uC774\uB984\uC744 \uC785\uB825\uD574\uC918', (res) => {
        const item = tm.tmDataList[idx]
        callApi('/api/edit-match', {
            sabun: auth.currentSabun,
            rowIndex: item.docId,
            type: 'subGuide',
            value: res.text + ','
        }, r => {
            showAppAlert(r.message)
            loadMatchingData()
        })
    })
}

function editGuideName(idx) {
    subGuideMenuIdx.value = null
    showPopup('text', '\uC778\uB3C4\uC790 \uC218\uC815', '\uC778\uB3C4\uC790 \uC774\uB984\uC744 \uC785\uB825\uD574\uC918', (res) => {
        const item = tm.tmDataList[idx]
        callApi('/api/edit-match', {
            sabun: auth.currentSabun,
            rowIndex: item.docId,
            type: 'subGuide',
            value: ',' + res.text
        }, r => {
            showAppAlert(r.message)
            loadMatchingData()
        })
    })
}

function handleTeacherSubmit({ docId, finalName }) {
    teacherEditIdx.value = null
    callApi('/api/edit-match', {
        sabun: auth.currentSabun,
        rowIndex: docId,
        type: 'teacher',
        value: finalName
    }, r => {
        showAppAlert(r.message)
        loadMatchingData()
    })
}

function viewTtagiReport(idx) {
    const item = tm.tmDataList[idx]
    if (!item) return
    const data = item.ttagiReport || {}
    if (Object.keys(data).length === 0) {
        ttagiFormIdx.value = idx
    } else {
        ttagiViewIdx.value = idx
    }
}

function handleTtagiFormSubmit({ docId, data }) {
    callApi('/api/update-match', {
        sabun: auth.currentSabun, rowIndex: docId, type: 'ttagi', data
    }, () => {
        ttagiFormIdx.value = null
        showAppAlert('따기보고 저장 완료!', () => { loadMatchingData() })
    })
}

// --- Load data ---
function loadMatchingData() {
    loading.value = true
    noData.value = false
    tm.currentlyExpandedId = null

    callApi('/api/get-assets', { sabun: auth.currentSabun }, r => {
        loading.value = false
        if (!r.success) {
            noData.value = true
            return
        }
        tm.setTmData(r.list)

        if (displayGroups.value.length === 0) {
            noData.value = true
        }

        // Scroll to today
        nextTick(() => {
            scrollToToday()
        })
    })
}

function scrollToToday() {
    const todayGroup = displayGroups.value.find(g => g.isToday)
    if (todayGroup) {
        const el = document.getElementById(`header-${todayGroup.date}`)
        if (el) {
            const y = el.getBoundingClientRect().top + window.pageYOffset - 55
            window.scrollTo({ top: y, behavior: 'smooth' })
        }
    }
}

// 텔레그램 버튼(답장/창개설/재가)이 바꾼 상태를 화면에도 반영 — 실시간 푸시 인프라가
// 없어서 짧은 주기 폴링으로 대체. 로딩 스피너/펼친 카드 상태를 안 건드리도록 setTmData만 호출.
function pollMatchingData() {
    callApi('/api/get-assets', { sabun: auth.currentSabun }, r => {
        if (!r.success) return
        tm.setTmData(r.list)
    })
}

let _pollTimer = null
onMounted(() => {
    loadMatchingData()
    _pollTimer = setInterval(pollMatchingData, 5000)
})
onUnmounted(() => {
    clearInterval(_pollTimer)
})
</script>

<template>
    <div class="screen">
        <div class="match-layout" style="margin-top:10px;">
            <!-- LEFT: search + list -->
            <div class="match-left">
                <div style="padding:8px 12px 4px; display:flex; gap:6px; align-items:center;">
                    <div class="search-box" style="flex:1;">
                        <span class="search-icon">🔍</span>
                        <input v-model="searchQuery" type="text" placeholder="섭외자/인도자 이름으로 검색" class="search-input" />
                    </div>
                    <button class="btn-history" @click="router.push('/matching-history')">📋 히스토리</button>
                </div>
                <div class="timeline-container" @click="handleContainerClick">
                    <div v-if="loading" style="text-align:center;padding:20px;">로딩 중...</div>
                    <div v-else-if="noData" style="text-align:center;padding:20px;">예정된 만남이 없어 😶</div>

                    <div v-else v-for="group in displayGroups" :key="group.date" class="date-group">
                        <div
                            class="timeline-header"
                            :id="'header-' + group.date"
                            :style="group.isToday ? { background: '#E3F2FD', color: '#1565C0', border: '2px solid #90CAF9' } : {}"
                        >{{ group.dateDisplay }}</div>

                        <div v-for="item in group.items" :key="item._accordionId"
                             class="meeting-item"
                             :class="{ 'is-selected': selectedAccordionId === item._accordionId }">
                            <div class="meeting-summary" @click="toggleDetail(item._accordionId)">
                                <div>{{ (item.habjaeyang && item.habjaeyang.mtTime) ? ((item.habjaeyang.isSecondMeet ? '✌️' : '') + item.habjaeyang.mtTime) : '-' }}</div>
                                <div style="color:black; font-weight:bold;">{{ getNameDisplay(item) }}</div>
                                <div>{{ (item.habjaeyang && item.habjaeyang.guide) || item.manager }}</div>
                                <div style="line-height:1.2;" v-html="getTeacherDisplay(item)"></div>
                                <div v-html="getRightStatusHtml(item)"></div>
                            </div>

                            <!-- Mobile accordion (hidden on desktop) -->
                            <div v-show="!isDesktop && isDetailVisible(item._accordionId)" class="tm-details">
                                <div v-if="!item.isGhost" class="log-container" style="max-height:100px;" v-html="formatLogs(item.logEntries, item.docId)"></div>
                                <div v-if="!item.isGhost" class="action-row">
                                    <button class="action-btn" @click="editMatchAction($event, item._realIdx, 'date')">날짜수정</button>
                                    <button class="action-btn" @click="editMatchAction($event, item._realIdx, 'subGuide')">섭/인수정</button>
                                    <button class="action-btn" style="background:#EFEBE9; color:#5D4037; font-weight:bold;" @click="viewHabjaeyangPopup(item._realIdx)">합재양</button>
                                    <button class="action-btn" @click="editMatchAction($event, item._realIdx, 'teacher')">교사입력</button>
                                </div>
                                <div v-if="getBottomAreaType(item) === 'ghost'" style="text-align:center;color:#888;margin:10px;font-size:12px;">📋 기록된 이력입니다</div>
                                <div v-else-if="getBottomAreaType(item) === 'pending'" style="text-align:center;color:#FF9800;margin:10px;font-weight:bold;">🙏 따기보고 요청 중</div>
                                <div v-else-if="getBottomAreaType(item) === 'viewHj'" style="margin-top:5px;">
                                    <div style="display:flex;gap:4px;margin-bottom:4px;">
                                        <button class="hj-toggle-btn" :class="{ 'hj-toggle-on': item.habjaeyang && item.habjaeyang.replied }" @click.stop="toggleHjStatus(item._realIdx, 'replied')">
                                            {{ item.habjaeyang && item.habjaeyang.replied ? '✅ 답장' : '💬 답장' }}
                                        </button>
                                        <button class="hj-toggle-btn" :class="{ 'hj-toggle-on': item.habjaeyang && item.habjaeyang.windowOpened }" @click.stop="toggleHjStatus(item._realIdx, 'windowOpened')">
                                            {{ item.habjaeyang && item.habjaeyang.windowOpened ? '✅ 창개설' : '🚪 창개설' }}
                                        </button>
                                    </div>
                                    <button class="btn btn-sm" style="width:100%;background:#6D4C41;" @click="viewHabjaeyangPopup(item._realIdx)">합재양 보기</button>
                                </div>
                                <div v-else-if="getBottomAreaType(item) === 'teacherNeeded'" style="margin-top:5px;">
                                    <div style="text-align:center;color:#FBC02D;font-weight:bold;margin-bottom:4px;">교사구함</div>
                                    <button class="result-btn-big" @click="inputMatchResult(item._realIdx)">결과입력</button>
                                </div>
                                <div v-else-if="getBottomAreaType(item) === 'readyToMeet'" style="margin-top:5px;">
                                    <div style="text-align:center;color:#4CAF50;font-weight:bold;margin-bottom:4px;">준비완료</div>
                                    <button class="result-btn-big" @click="inputMatchResult(item._realIdx)">결과입력</button>
                                </div>
                                <div v-else-if="getBottomAreaType(item) === 'resultInput'" style="margin-top:5px;">
                                    <button class="result-btn-big" @click="inputMatchResult(item._realIdx)">결과입력</button>
                                </div>
                                <button v-if="showHasConsultBtn(item)" class="btn btn-sm" style="width:100%;margin-top:5px;background:#B3E5FC;color:#0277BD" @click="viewTtagiReport(item._realIdx)">따기보고 보기</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- RIGHT: detail panel (desktop only) -->
            <div class="match-right">
                <div v-if="!selectedItem" class="match-right-empty">
                    카드를 선택하면<br>상세 정보가 표시돼요
                </div>
                <div v-else class="tm-details" @click="handleContainerClick">
                    <div class="match-right-header">
                        <div>
                            <strong style="font-size:16px;">{{ getNameDisplay(selectedItem) }}</strong>
                            <div style="color:#888;font-size:12px;margin-top:2px;">{{ (selectedItem.habjaeyang && selectedItem.habjaeyang.mtDate) || '-' }} {{ (selectedItem.habjaeyang && selectedItem.habjaeyang.mtTime) ? ((selectedItem.habjaeyang.isSecondMeet ? '✌️' : '') + selectedItem.habjaeyang.mtTime) : '' }}</div>
                        </div>
                        <div v-html="getRightStatusHtml(selectedItem)"></div>
                    </div>
                    <div class="log-container" v-html="formatLogs(selectedItem.logEntries, selectedItem.docId)"></div>
                    <div v-if="!selectedItem.isGhost" class="action-row">
                        <button class="action-btn" @click="editMatchAction($event, selectedItem._realIdx, 'date')">날짜수정</button>
                        <button class="action-btn" @click="editMatchAction($event, selectedItem._realIdx, 'subGuide')">섭/인수정</button>
                        <button class="action-btn" style="background:#EFEBE9; color:#5D4037; font-weight:bold;" @click="viewHabjaeyangPopup(selectedItem._realIdx)">합재양</button>
                        <button class="action-btn" @click="editMatchAction($event, selectedItem._realIdx, 'teacher')">교사입력</button>
                    </div>
                    <div v-if="getBottomAreaType(selectedItem) === 'ghost'" style="text-align:center;color:#888;margin:10px;font-size:12px;">📋 기록된 이력입니다</div>
                    <div v-else-if="getBottomAreaType(selectedItem) === 'pending'" style="text-align:center;color:#FF9800;margin:10px;font-weight:bold;">🙏 따기보고 요청 중</div>
                    <div v-else-if="getBottomAreaType(selectedItem) === 'done'" style="text-align:center;color:#888;margin:10px;">이미 처리됨</div>
                    <div v-else-if="getBottomAreaType(selectedItem) === 'viewHj'" style="margin-top:5px;">
                        <div style="display:flex;gap:4px;margin-bottom:4px;">
                            <button class="hj-toggle-btn" :class="{ 'hj-toggle-on': selectedItem.habjaeyang && selectedItem.habjaeyang.replied }" @click.stop="toggleHjStatus(selectedItem._realIdx, 'replied')">
                                {{ selectedItem.habjaeyang && selectedItem.habjaeyang.replied ? '✅ 답장' : '💬 답장' }}
                            </button>
                            <button class="hj-toggle-btn" :class="{ 'hj-toggle-on': selectedItem.habjaeyang && selectedItem.habjaeyang.windowOpened }" @click.stop="toggleHjStatus(selectedItem._realIdx, 'windowOpened')">
                                {{ selectedItem.habjaeyang && selectedItem.habjaeyang.windowOpened ? '✅ 창개설' : '🚪 창개설' }}
                            </button>
                        </div>
                        <button class="btn btn-sm" style="width:100%;background:#6D4C41;" @click="viewHabjaeyangPopup(selectedItem._realIdx)">합재양 보기</button>
                    </div>
                    <div v-else-if="getBottomAreaType(selectedItem) === 'teacherNeeded'" style="margin-top:5px;">
                        <div style="text-align:center;color:#FBC02D;font-weight:bold;margin-bottom:4px;">교사구함</div>
                        <button class="result-btn-big" @click="inputMatchResult(selectedItem._realIdx)">결과입력</button>
                    </div>
                    <div v-else-if="getBottomAreaType(selectedItem) === 'readyToMeet'" style="margin-top:5px;">
                        <div style="text-align:center;color:#4CAF50;font-weight:bold;margin-bottom:4px;">준비완료</div>
                        <button class="result-btn-big" @click="inputMatchResult(selectedItem._realIdx)">결과입력</button>
                    </div>
                    <div v-else-if="getBottomAreaType(selectedItem) === 'resultInput'" style="margin-top:5px;">
                        <button class="result-btn-big" @click="inputMatchResult(selectedItem._realIdx)">결과입력</button>
                    </div>
                    <button v-if="showHasConsultBtn(selectedItem)" class="btn btn-sm" style="width:100%;margin-top:5px;background:#B3E5FC;color:#0277BD" @click="viewTtagiReport(selectedItem._realIdx)">따기보고 보기</button>
                </div>
            </div>
        </div>

        <!-- 섭/인 개별 선택 메뉴 -->
        <Teleport to="body">
            <div v-if="subGuideMenuIdx !== null" class="modal-overlay" @click.self="subGuideMenuIdx = null">
                <div class="modal-card">
                    <span class="modal-close" @click="subGuideMenuIdx = null">&times;</span>
                    <div class="modal-title">어느 걸 수정할까?</div>
                    <div class="btn-group">
                        <button class="btn-pos" @click="editSubName(subGuideMenuIdx)">섭외자</button>
                        <button class="btn-neg" @click="editGuideName(subGuideMenuIdx)">인도자</button>
                    </div>
                </div>
            </div>
        </Teleport>

        <!-- 교사 입력 (타지역 체크박스 포함) -->
        <TeacherEditPopup
            v-if="teacherEditIdx !== null"
            :item="tm.tmDataList[teacherEditIdx]"
            :skipConfirm="true"
            @submit="handleTeacherSubmit"
            @close="teacherEditIdx = null"
        />

        <!-- 따기보고 입력 -->
        <TtagiFormPopup
            v-if="ttagiFormIdx !== null"
            :item="tm.tmDataList[ttagiFormIdx]"
            @submit="handleTtagiFormSubmit"
            @close="ttagiFormIdx = null"
        />

        <!-- 따기보고 보기 -->
        <TtagiViewPopup
            v-if="ttagiViewIdx !== null"
            :item="tm.tmDataList[ttagiViewIdx]"
            @close="ttagiViewIdx = null"
        />

        <!-- 합재양 보기 — CenterScreen 과 같은 컴포넌트 재사용 (read-only, 20+ field) -->
        <HabjaeyangViewPopup
            v-if="habjaeyangViewIdx !== null"
            :item="tm.tmDataList[habjaeyangViewIdx]"
            @back="habjaeyangViewIdx = null"
            @close="habjaeyangViewIdx = null"
            @fieldSaved="loadMatchingData"
        />

        <!-- 결과 입력 6 옵션 (취소/밀림/비합/탈락/2차/상담따기) -->
        <MatchResultPopup
            v-if="matchResultIdx !== null"
            @pick="handleMatchResultPick"
            @close="matchResultIdx = null"
        />
    </div>
</template>

<style scoped>
.search-box {
    display: flex;
    align-items: center;
    background: white;
    border-radius: 12px;
    padding: 10px 14px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.1);
    gap: 8px;
}

.search-icon {
    font-size: 16px;
    flex-shrink: 0;
}

.search-input {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    font-size: 14px;
    color: #333;
}

.search-input::placeholder {
    color: #aaa;
}

.btn-history {
    flex-shrink: 0;
    padding: 8px 10px;
    background: #E8EAF6;
    color: #3949AB;
    border: none;
    border-radius: 10px;
    font-size: 13px;
    font-family: 'Jua', sans-serif;
    cursor: pointer;
    white-space: nowrap;
}

.timeline-container {
    position: relative;
}

.timeline-header {
    position: sticky;
    top: 45px;
    background: #EFEBE9;
    padding: 8px 15px;
    font-weight: bold;
    color: #5D4037;
    z-index: 10;
    border-radius: 0 0 10px 10px;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
    margin-bottom: 10px;
    text-align: center;
}

.meeting-item {
    background: white;
    margin-bottom: 6px;
    border-radius: 12px;
    box-shadow: var(--shadow);
}


.meeting-summary {
    padding: 6px 5px;
    display: grid;
    grid-template-columns: 0.7fr 0.9fr 0.9fr 0.8fr 1.2fr;
    gap: 2px;
    align-items: center;
    cursor: pointer;
    font-size: 13px;
    text-align: center;
    min-height: 44px;
    border-bottom: 1px solid transparent;
}

.tm-details {
    padding: 15px;
    background: #FAFAFA;
    font-size: 14px;
}

.log-container {
    max-height: 200px;
    overflow-y: auto;
    margin-bottom: 15px;
}

:deep(.log-card) {
    background: white;
    border: 1px solid #eee;
    border-radius: 8px;
    padding: 10px;
    margin-bottom: 8px;
    font-family: 'Noto Sans KR', sans-serif;
    font-size: 13px;
}

:deep(.log-header) {
    display: flex;
    justify-content: space-between;
    color: #888;
    font-size: 11px;
    margin-bottom: 4px;
    align-items: center;
}

:deep(.log-result) {
    font-weight: bold;
    color: var(--btn-color);
    margin-bottom: 2px;
}

:deep(.log-content) {
    color: #333;
    line-height: 1.4;
    white-space: nowrap;
    overflow-x: auto;
}

:deep(.log-initial) {
    border-left: 3px solid var(--accent-color);
    background: #FFFDE7;
}

:deep(.log-del-btn) {
    color: #FF5252;
    cursor: pointer;
    font-size: 12px;
    margin-left: 5px;
    font-weight: bold;
}

.status-reject {
    color: #EF6C00;
    font-weight: bold;
}

:deep(.btn-approve) {
    background: #E8F5E9;
    color: #2E7D32;
    border: 1px solid #C8E6C9;
    padding: 5px 10px;
    border-radius: 6px;
    font-weight: bold;
    cursor: pointer;
    font-family: 'Jua';
}

:deep(.btn-locked) {
    background: #EEE;
    border: 1px solid #ddd;
    padding: 5px 10px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
}

.hj-toggle-btn {
    flex: 1;
    padding: 6px 4px;
    font-size: 13px;
    border: 1px solid #ddd;
    border-radius: 6px;
    background: #f5f5f5;
    cursor: pointer;
    font-family: 'Jua', sans-serif;
}

.hj-toggle-on {
    background: #E8F5E9;
    border-color: #4CAF50;
    color: #2E7D32;
    font-weight: bold;
}

:deep(.res-btn-cancel) { background: #D7CCC8; color: #5D4037; }
:deep(.res-btn-delay) { background: #FFF9C4; color: #F57F17; }
:deep(.res-btn-bi) { background: #FFE0B2; color: #EF6C00; }
:deep(.res-btn-drop) { background: #FFCDD2; color: #C62828; }
:deep(.res-btn-2nd) { background: #C8E6C9; color: #2E7D32; }
:deep(.res-btn-consult) { background: #B3E5FC; color: #0277BD; }

.is-selected {
    border: 2px solid #90CAF9;
}

.match-right {
    display: none;
}

.match-right-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
    padding-bottom: 10px;
    border-bottom: 1px solid #eee;
}

.match-right-empty {
    text-align: center;
    color: #bbb;
    padding: 50px 20px;
    font-size: 14px;
    line-height: 2;
}

@media (min-width: 1024px) {
    .match-layout {
        display: grid;
        grid-template-columns: 5fr 4fr;
        gap: 16px;
        align-items: start;
    }

    .match-right {
        display: block;
        position: sticky;
        top: 55px;
        max-height: calc(100vh - 70px);
        overflow-y: auto;
        background: white;
        border-radius: 12px;
        box-shadow: var(--shadow);
        min-height: 160px;
    }

    .match-right .tm-details {
        background: transparent;
        max-height: none;
    }

    .match-right .log-container {
        max-height: calc(100vh - 420px);
        overflow-y: auto;
    }
}
</style>
