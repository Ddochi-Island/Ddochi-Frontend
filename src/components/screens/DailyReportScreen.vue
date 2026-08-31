<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useApi } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'
import { useUiStore } from '@/stores/ui'
import TimeBlockPainter from '@/components/common/TimeBlockPainter.vue'
import DailyReportMergePreviewModal from '@/components/screens/DailyReportMergePreviewModal.vue'
import { leafOptions } from '@/constants'

const router = useRouter()
const auth = useAuthStore()
const { callApi, callApiPromise } = useApi()
const { showAppAlert, showToast } = usePopup()
const ui = useUiStore()

// 시간블록 도화지
const painterRef = ref(null)
const timeBlocks = ref({})
const copyLoading = ref('')

function onBlocksUpdate(blocks) {
    timeBlocks.value = blocks
    saveDraft()
}

// ── KST 시간 헬퍼 (legacy getClientKstNow / fmtKstKey / fmtKstLabel 정합) ──
function getClientKstNow() {
    const utc = Date.now() + (new Date().getTimezoneOffset() * 60000)
    return new Date(utc + 9 * 3600000)
}
function fmtKstKey(d) {
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function fmtKstLabel(d) {
    const dow = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()]
    return `${d.getMonth() + 1}월 ${d.getDate()}일 (${dow})`
}

function getTomorrowDate() {
    const d = getClientKstNow()
    d.setDate(d.getDate() + 1)
    return fmtKstKey(d)
}
function getTodayDate() {
    return fmtKstKey(getClientKstNow())
}
// 영업일 키 — 22시 이후 +1일 (legacy currentReportDateKey 정합)
function currentReportDateKey() {
    const d = getClientKstNow()
    if (d.getHours() >= 22) d.setDate(d.getDate() + 1)
    return fmtKstKey(d)
}
// 22시 이후 여부 — 라벨 색상 분기
const isLate = ref(getClientKstNow().getHours() >= 22)
const selectedDateKey = ref(null) // 22시 이후 진입 시 선택한 날짜 키

async function loadYesterdayPlan() {
    copyLoading.value = 'yesterday'
    const r = await callApiPromise('/api/get-my-plan', { sabun: auth.currentSabun, targetDate: getTodayDate() })
    copyLoading.value = ''
    if (r.success && r.plans.length > 0) {
        const data = {}
        r.plans.forEach(p => { data[p.time] = { name: p.name, color: p.color, type: p.type, memo: p.memo || '' } })
        painterRef.value?.setBlocks(data)
        showToast('어제 계획을 싹 불러왔어! 🎨')
    } else {
        showAppAlert('저장된 어제 계획이 없어!')
    }
}

async function loadLastWeekPlan() {
    copyLoading.value = 'lastweek'
    const now = new Date()
    now.setDate(now.getDate() - 6)
    const targetDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const r = await callApiPromise('/api/get-my-plan', { sabun: auth.currentSabun, targetDate })
    copyLoading.value = ''
    if (r.success && r.plans.length > 0) {
        const data = {}
        r.plans.forEach(p => { data[p.time] = { name: p.name, color: p.color, type: p.type, memo: p.memo || '' } })
        painterRef.value?.setBlocks(data)
        showToast('지난주 동일 요일의 계획을 불러왔어! 📅')
    } else {
        showAppAlert('지난주 이 요일엔 저장된 계획이 없어!')
    }
}

// 스루 패스 (미보고 내역)
const missedList = ref([])

function loadMissedExecutions() {
    callApi('/api/get-missed-executions', { sabun: auth.currentSabun }, (r) => {
        if (r.success && r.list) {
            missedList.value = r.list
        }
    })
}

function handleMissedAction(id, action) {
    const item = missedList.value.find(m => m.id === id)
    if (item) item._processing = true

    callApi('/api/batch-update-executions', { updates: [{ id, action }] }, (r) => {
        if (r.success) {
            missedList.value = missedList.value.filter(m => m.id !== id)
            showToast(action === 'ok' ? '⭕ 완료 처리!' : '❌ 못함 처리!')
        } else {
            if (item) item._processing = false
            showAppAlert('처리 실패')
        }
    })
}

function resolveAllMissed() {
    const updates = missedList.value.map(m => ({ id: m.id, action: 'ok' }))
    if (updates.length === 0) return showAppAlert('처리할 항목이 없어!')

    callApi('/api/batch-update-executions', { updates }, (r) => {
        if (r.success) {
            missedList.value = []
            showToast('모든 미보고 내역 정리 완료!')
        } else {
            showAppAlert('처리 실패: ' + r.message)
        }
    })
}

const reportName = ref('')
const activity = ref('활동을 하지 못했어..')
const talkCount = ref('')
const dmRows = reactive([{ count: '', path: '', tool: '' }])
const qrRows = reactive([{ count: '', path: '', tool: '' }])
const onlineIntakeRows = reactive([{ count: '', path: '', tool: '' }])
const univRows = reactive([{ name: '', path: '', tool: '' }])
const leafRows = reactive([{ val: '-', date: '' }])

// pathPrefs: 날짜 무관 영구 저장 (행 수 + 경로·도구, count/name 제외)
function loadPathPrefs() {
    try {
        const raw = localStorage.getItem('dailyReportPathPrefs')
        if (!raw) return
        const prefs = JSON.parse(raw)
        if (prefs.dmRows?.length) dmRows.splice(0, dmRows.length, ...prefs.dmRows.map(r => ({ count: '', path: r.path || '', tool: r.tool || '' })))
        if (prefs.qrRows?.length) qrRows.splice(0, qrRows.length, ...prefs.qrRows.map(r => ({ count: '', path: r.path || '', tool: r.tool || '' })))
        if (prefs.onlineIntakeRows?.length) onlineIntakeRows.splice(0, onlineIntakeRows.length, ...prefs.onlineIntakeRows.map(r => ({ count: '', path: r.path || '', tool: r.tool || '' })))
        if (prefs.univRows?.length) univRows.splice(0, univRows.length, ...prefs.univRows.map(r => ({ name: '', path: r.path || '', tool: r.tool || '' })))
    } catch (_) {}
}
function savePathPrefs() {
    const prefs = {
        dmRows: dmRows.map(r => ({ path: r.path, tool: r.tool })),
        qrRows: qrRows.map(r => ({ path: r.path, tool: r.tool })),
        onlineIntakeRows: onlineIntakeRows.map(r => ({ path: r.path, tool: r.tool })),
        univRows: univRows.map(r => ({ path: r.path, tool: r.tool })),
    }
    localStorage.setItem('dailyReportPathPrefs', JSON.stringify(prefs))
}
function onPathToolChange() { savePathPrefs(); saveDraft() }
const mood = ref(5)
const isFinal = ref(false)
const finalWarning = ref(false)
const reflection = ref('')

// ── 홍보 학교 경로/도구 드롭다운 옵션 (경로관리/도구관리 재사용, 팀 필터) ──
const pathOptions = ref([])
const toolOptions = ref([])
function isOwnTeamOrPublic(o) {
    const team = (o.team || '').trim()
    return !team || team === '전체' || team === auth.currentUserTeam
}
async function loadPromoOptions() {
    try {
        const [pathRes, toolRes] = await Promise.all([
            callApiPromise('/api/get-path-configs', {}),
            callApiPromise('/api/get-tool-configs', {}),
        ])
        if (pathRes?.success) pathOptions.value = (pathRes.list || []).filter(isOwnTeamOrPublic)
        if (toolRes?.success) toolOptions.value = (toolRes.list || []).filter(isOwnTeamOrPublic)
    } catch (_) { /* 옵션 로드 실패는 조용히 무시 — 빈 드롭다운으로 표시 */ }
}

// 홍보학교 항목 표시용 문자열 — "학교명/경로(도구)". 도구 없으면 "학교명/경로". 백엔드와 동일 포맷.
function formatPromoItem(row) {
    const school = (row.name || '').trim()
    const path = (row.path || '').trim()
    const tool = (row.tool || '').trim()
    const pathPart = tool ? `${path}(${tool})` : path
    return pathPart ? `${school}/${pathPart}` : school
}

// ── 보고 대상자 autocomplete ──────────────────────────────────────────
// /api/daily-report/list-names 에서 가져온 (사번, 이름) — 같은 팀 + 이미
// 같은 dateKey 에 보고서를 작성한 다른 팀 사용자도 포함. 본인은 항상 포함.
const reportNameOptions = ref([])

const showSuggestions = ref(false)
const reportNameList = computed(() => {
    const set = new Set()
    reportNameOptions.value.forEach((o) => o.name && set.add(o.name))
    if (auth.currentUserName) set.add(auth.currentUserName)
    // SPA 가 이미 보유한 validNames (legacy 호환) 도 fallback 추가
    ;(auth.validNames || []).forEach((n) => set.add(n))
    return Array.from(set).sort()
})
const filteredSuggestions = computed(() => {
    const f = String(reportName.value || '').trim().toLowerCase()
    return reportNameList.value.filter((n) => !f || n.toLowerCase().includes(f))
})
function openSuggestions() { showSuggestions.value = true }
function closeSuggestionsSoon() { setTimeout(() => { showSuggestions.value = false }, 200) }
function toggleSuggestions(e) { e?.preventDefault(); e?.stopPropagation(); showSuggestions.value = !showSuggestions.value }
function pickSuggestion(name) {
    reportName.value = name
    showSuggestions.value = false
    saveDraft()
    loadReportForName(name)
}

// ── 다른 사용자의 보고서 prefill (Phase 2-B) ─────────────────────────
function resetForm() {
    activity.value = '활동을 하지 못했어..'
    talkCount.value = ''
    dmRows.forEach(r => { r.count = '' })
    qrRows.forEach(r => { r.count = '' })
    onlineIntakeRows.forEach(r => { r.count = '' })
    mood.value = 5
    moodTouched.value = false
    isFinal.value = false
    reflection.value = ''
    univRows.splice(0, univRows.length, { name: '', path: '', tool: '' })
    leafRows.splice(0, leafRows.length, { val: '-', date: '' })
    loadPathPrefs()
}

function loadReportForName(name, dateKey) {
    if (!name) return
    resetForm()
    callApi('/api/daily-report/get', { dateKey: dateKey || getTodayDate(), name }, (r) => {
        if (!r || !r.success || !r.exists) return
        const d = r.data || {}
        if (d.activity) activity.value = d.activity
        talkCount.value = d.talkCount ?? ''
        // 기존 저장 데이터는 단일 숫자 → 첫 행 count에 복원, 나머지 행 경로·도구는 prefs 유지
        if (d.dmCount != null) dmRows[0].count = d.dmCount
        if (d.qrCount != null) qrRows[0].count = d.qrCount
        if (d.onlineIntakeCount != null) onlineIntakeRows[0].count = d.onlineIntakeCount
        if (d.mood) { mood.value = Number(d.mood); moodTouched.value = true }
        if (d.isFinal) { isFinal.value = true; finalWarning.value = true }
        reflection.value = d.reflection || ''
        // promoItems: [{school, path, tool}] → univRows 채움
        if (Array.isArray(d.promoItems) && d.promoItems.length) {
            univRows.splice(0, univRows.length, ...d.promoItems.map((e) => ({
                name: e.school || '', path: e.path || '', tool: e.tool || '',
            })))
        }
        if (Array.isArray(d.leafList) && d.leafList.length) {
            leafRows.splice(0, leafRows.length, ...d.leafList.map((l) => ({ val: l.val || '-', date: l.date || '' })))
        }
        saveDraft()
    })
}

async function loadReportNameOptions() {
    try {
        const r = await callApiPromise('/api/daily-report/list-names', { dateKey: getTodayDate() })
        if (r && r.success) reportNameOptions.value = r.names || []
    } catch (_) { /* 401/네트워크 — 명단은 fallback */ }
}

// ── 보고 저장 일자 label ───────────────────────────────────────────────
// legacy2 updateReportSaveDateLabel — 미보고 일이 있으면 그 날짜를, 아니면 오늘.
// 미보고 첫 항목의 날짜를 우선. 단순화: missedList 의 첫 entry 의 startTime 의
// 날짜 부분만 사용. 추후 정확한 로직으로 대체.
// mood touched 추적 — slider 를 한 번이라도 만졌는지. legacy2 의 dataset.touched
// 와 동치. submit 시 merge preview 의 "기존 유지 vs 덮어쓰기" 분기에 사용.
const moodTouched = ref(false)
function onMoodInput() { moodTouched.value = true; saveDraft() }

// merge preview state
const mergeExisting = ref(null)
const mergeInput = ref(null)

// 보고 저장 라벨 텍스트 — missedList 우선 / 22시+ 면 영업일(내일) / 그 외 오늘
// legacy 의 updateReportSaveDateLabel + fmtKstLabel 정합 ("M월 D일 (요일)" 형식)
const reportSaveDateText = computed(() => {
    if (missedList.value.length > 0) {
        const t = missedList.value[0]?.startTime || ''
        const m = String(t).match(/(\d{4}-\d{2}-\d{2})/)
        if (m) {
            const [y, mo, d] = m[1].split('-').map(Number)
            return fmtKstLabel(new Date(y, mo - 1, d))
        }
    }
    if (selectedDateKey.value) {
        const [y, mo, d] = selectedDateKey.value.split('-').map(Number)
        return fmtKstLabel(new Date(y, mo - 1, d))
    }
    // 22시+ 면 영업일(내일) 기준으로 표시 — currentReportDateKey() 와 동일 로직
    const d = getClientKstNow()
    if (d.getHours() >= 22) d.setDate(d.getDate() + 1)
    return fmtKstLabel(d)
})
const reportSaveDateHint = computed(() => missedList.value.length > 0 || (isLate.value && !selectedDateKey.value))
const reportSaveDateHintText = computed(() => {
    if (missedList.value.length > 0) return '제출 시 날짜를 다시 선택할 수 있어요.'
    if (isLate.value && !selectedDateKey.value) return '⏰ 22시 이후 — 오늘/내일 중 어느 날짜 건으로 저장할지 선택해줘요.'
    return ''
})

function addUnivRow() {
    univRows.push({ name: '', path: '', tool: '' })
}

function removeUnivRow(idx) {
    if (univRows.length > 1) univRows.splice(idx, 1)
}

function addLeafRow() {
    leafRows.push({ val: '-', date: '' })
}

function removeLeafRow(idx) {
    if (leafRows.length > 1) leafRows.splice(idx, 1)
}

function saveDraft() {
    const draft = {
        date: selectedDateKey.value || getTodayDate(),
        reportName: reportName.value,
        activity: activity.value,
        talkCount: talkCount.value,
        dmRows: [...dmRows],
        qrRows: [...qrRows],
        onlineIntakeRows: [...onlineIntakeRows],
        univRows: [...univRows],
        leafRows: [...leafRows],
        mood: mood.value,
        moodTouched: moodTouched.value,
        isFinal: isFinal.value,
        reflection: reflection.value,
        timeBlocks: timeBlocks.value
    }
    localStorage.setItem('dailyReportDraft', JSON.stringify(draft))
}

function loadDraft() {
    try {
        const raw = localStorage.getItem('dailyReportDraft')
        if (!raw) return
        const draft = JSON.parse(raw)
        const targetDate = selectedDateKey.value || getTodayDate()
        if (draft.date !== targetDate) return

        reportName.value = draft.reportName || ''
        activity.value = draft.activity || '활동을 하지 못했어..'
        talkCount.value = draft.talkCount || ''
        if (draft.dmRows?.length) dmRows.splice(0, dmRows.length, ...draft.dmRows)
        if (draft.qrRows?.length) qrRows.splice(0, qrRows.length, ...draft.qrRows)
        if (draft.onlineIntakeRows?.length) onlineIntakeRows.splice(0, onlineIntakeRows.length, ...draft.onlineIntakeRows)
        mood.value = draft.mood || 5
        if (draft.moodTouched) moodTouched.value = true
        isFinal.value = !!draft.isFinal
        if (draft.isFinal) finalWarning.value = true
        reflection.value = draft.reflection || ''

        if (draft.univRows?.length) {
            univRows.splice(0, univRows.length, ...draft.univRows)
        }
        if (draft.leafRows?.length) {
            leafRows.splice(0, leafRows.length, ...draft.leafRows)
        }
        if (draft.timeBlocks) {
            timeBlocks.value = draft.timeBlocks
        }
    } catch (e) {
        console.error('Draft load error:', e)
    }
}

// ── resolveReportName (legacy 정합) ────────────────────────────────────
// 1) 본인 이름이면 통과
// 2) teamMembers 정확 일치 → 통과
// 3) 동명이인 (suffix A/B 등) 1명 → 자동 통과 (suffix 포함된 정식 이름으로 resolve)
// 4) 동명이인 다수 → 선택 모달 (dateChoice 패턴과 동일하게 inline 처리)
// 5) 없음 → "팀에 없는 이름" 알림
const dupChoice = ref(null)  // { input: string, candidates: string[], onPick: fn } | null
function resolveReportName(inputName) {
    return new Promise((resolve, reject) => {
        if (inputName === auth.currentUserName) return resolve(inputName)
        // legacy 의 window.teamMembers 는 redesign2 의 auth.validNames 와 동일 역할
        const members = auth.validNames || []
        if (members.includes(inputName)) return resolve(inputName)
        const matches = members.filter((m) => m.replace(/[A-Z]$/, '') === inputName)
        if (matches.length === 1) return resolve(matches[0])
        if (matches.length > 1) {
            dupChoice.value = {
                input: inputName,
                candidates: matches.slice().sort(),
                onPick: (chosen) => { dupChoice.value = null; resolve(chosen) },
                onCancel: () => { dupChoice.value = null; reject(new Error('cancelled')) },
            }
            return
        }
        showAppAlert(`"${inputName}" 은(는) 우리 팀에 없는 이름이야!`)
        reject(new Error('not_in_team'))
    })
}

// ── 22시+ 분기: 오늘/내일 선택 모달 ─────────────────────────────────────
const dateChoice = ref(null)  // { todayKey, todayLbl, tmrKey, tmrLbl, onPick: fn } | null

async function submitDailyReport() {
    if (ui.isProcessing) return

    const rawName = reportName.value.trim()
    if (!rawName) return showAppAlert('이름을 입력해줘!')

    // 동명이인 / 미등록 처리
    let resolvedName
    try {
        resolvedName = await resolveReportName(rawName)
    } catch (_) { return }
    reportName.value = resolvedName

    // mood touched 검증 (본인 제출만, 대리 제출은 0 으로 저장)
    const isDelegated = resolvedName !== auth.currentUserName
    if (!isDelegated && !moodTouched.value) {
        return showAppAlert('💖 오늘 나의 하루는! 점수를 입력해줘!')
    }

    const baseData = buildSubmitPayload(resolvedName)
    // 본인 제출이고 mood 안 만졌으면 위에서 막음. 대리 제출은 0.
    if (isDelegated && !moodTouched.value) baseData.mood = '0'
    baseData.moodTouched = true  // 서버 머지 정책 입력

    // 22시 이후 → 진입 시 선택한 날짜 있으면 팝업 생략, 없으면 다시 팝업
    const now = getClientKstNow()
    if (now.getHours() >= 22) {
        if (selectedDateKey.value) {
            const key = selectedDateKey.value
            const isToday = (key === fmtKstKey(now))
            if (!isToday) return doSubmitWithKey(baseData, key)
            const existing = await fetchExisting(key, resolvedName)
            if (existing) return showMergePreview(existing, baseData, key)
            return doSubmitWithKey(baseData, key)
        }
        const today = new Date(now)
        const tmr = new Date(now); tmr.setDate(tmr.getDate() + 1)
        dateChoice.value = {
            todayKey: fmtKstKey(today),
            todayLbl: fmtKstLabel(today),
            tmrKey: fmtKstKey(tmr),
            tmrLbl: fmtKstLabel(tmr),
            onPick: async (key, isToday) => {
                dateChoice.value = null
                if (!isToday) return doSubmitWithKey(baseData, key)
                const existing = await fetchExisting(key, resolvedName)
                if (existing) return showMergePreview(existing, baseData, key)
                doSubmitWithKey(baseData, key)
            },
            onCancel: () => { dateChoice.value = null },
        }
        return
    }

    // 22시 이전: 자동 오늘 (서버 default). 단 기존 보고 있으면 merge preview.
    const todayKey = fmtKstKey(now)
    const existing = await fetchExisting(todayKey, resolvedName)
    if (existing) return showMergePreview(existing, baseData, null)
    doSubmitWithKey(baseData, null)
}

async function fetchExisting(dateKey, name) {
    try {
        const r = await callApiPromise('/api/daily-report/get', { dateKey, name })
        if (r && r.success && r.exists) return r.data
    } catch (_) {}
    return null
}

function showMergePreview(existing, baseData, confirmedDateKey) {
    mergeExisting.value = existing
    mergeInput.value = {
        ...baseData,
        moodTouched: moodTouched.value,
        _confirmedDateKey: confirmedDateKey,  // 22시+ "오늘" 선택 시 명시
    }
}

function doSubmitWithKey(data, confirmedDateKey) {
    const payload = confirmedDateKey ? { ...data, confirmedDateKey } : data
    actuallySubmit(payload)
}

function onMergeConfirm() {
    const confirmedDateKey = mergeInput.value?._confirmedDateKey || null
    const data = buildSubmitPayload(reportName.value.trim())
    mergeExisting.value = null
    mergeInput.value = null
    doSubmitWithKey(data, confirmedDateKey)
}
function onMergeCancel() {
    mergeExisting.value = null
    mergeInput.value = null
}

function buildSubmitPayload(name) {
    const promoItems = univRows
        .filter(u => u.name.trim())
        .map(u => ({ school: u.name.trim(), path: u.path || '', tool: u.tool || '' }))
    const seenLeaves = new Set()
    const lDataList = leafRows
        .filter(l => l.val !== '-' && l.val.trim())
        .map(l => ({ val: l.val, date: l.date }))
        .filter(l => {
            const key = `${l.val}|${l.date}`
            if (seenLeaves.has(key)) return false
            seenLeaves.add(key)
            return true
        })
    return {
        sabun: auth.currentSabun,
        name,
        dateKey: currentReportDateKey(),
        activity: activity.value,
        talkCount: talkCount.value,
        dmCount: dmRows.reduce((s, r) => s + (Number(r.count) || 0), 0),
        qrCount: qrRows.reduce((s, r) => s + (Number(r.count) || 0), 0),
        onlineIntakeCount: onlineIntakeRows.reduce((s, r) => s + (Number(r.count) || 0), 0),
        promoList: promoItems.map(formatPromoItem).join(', '),
        promoItems,
        regList: [],
        leafList: JSON.stringify(lDataList),
        mood: mood.value,
        isFinal: isFinal.value,
        reflection: reflection.value,
    }
}

function actuallySubmit(data) {
    const plansArr = []
    Object.entries(timeBlocks.value).forEach(([timeKey, blk]) => {
        plansArr.push({ time: timeKey, name: blk.name, color: blk.color, type: blk.type, memo: blk.memo || '' })
    })

    ui.setProcessing(true)
    callApi('/api/daily-report', data, async (res) => {
        if (res.success && plansArr.length > 0) {
            const tomorrowDate = getTomorrowDate()
            await callApiPromise('/api/update-today-plan', {
                sabun: auth.currentSabun,
                name: data.name,
                dateStr: tomorrowDate,
                plans: plansArr,
            })
        }
        ui.setProcessing(false)
        showAppAlert(res.message, () => {
            if (res.success) {
                localStorage.removeItem('dailyReportDraft')
                router.push({ name: 'home' })
            }
        })
    })
}

onMounted(async () => {
    if (!reportName.value) {
        reportName.value = auth.currentUserName || ''
    }
    loadPathPrefs()
    loadDraft()
    loadMissedExecutions()
    loadPromoOptions()
    await loadReportNameOptions()

    const now = getClientKstNow()
    if (now.getHours() >= 22) {
        const today = new Date(now)
        const tmr = new Date(now); tmr.setDate(tmr.getDate() + 1)
        const todayKey = fmtKstKey(today)
        const tmrKey = fmtKstKey(tmr)
        dateChoice.value = {
            todayKey,
            todayLbl: fmtKstLabel(today),
            tmrKey,
            tmrLbl: fmtKstLabel(tmr),
            title: '지금 어떻게 작성할까요?',
            desc: '현재 <b>22시 이후</b>입니다.<br>오늘 제출분을 수정하거나, 내일 보고를 미리 쓸 수 있어요.',
            todayBtnLabel: `📋 오늘 (${fmtKstLabel(today)}) 것 수정하기`,
            tmrBtnLabel: `🌙 내일 (${fmtKstLabel(tmr)}) 것 미리 쓰기`,
            onPick: (key, isToday) => {
                dateChoice.value = null
                selectedDateKey.value = key
                if (isToday) {
                    if (reportName.value) loadReportForName(reportName.value, key)
                } else {
                    loadDraft()
                }
            },
            onCancel: () => { dateChoice.value = null },
        }
    } else {
        const hasTodayDraft = (() => {
            try {
                const raw = localStorage.getItem('dailyReportDraft')
                if (!raw) return false
                return JSON.parse(raw).date === getTodayDate()
            } catch { return false }
        })()
        if (reportName.value && !hasTodayDraft) loadReportForName(reportName.value)
    }
})
</script>

<template>
    <div class="screen">
        <div class="header">
            <span class="header-emoji">🌙</span>
            <h3>오늘의 추수를 알려줘! 🦔</h3>
            <p>오늘의 수확을 거두고, 내일의 씨앗을 뿌리자!</p>
        </div>

        <!-- 스루 패스: 미보고 내역 -->
        <div v-if="missedList.length > 0" class="missed-section">
            <div class="missed-header">
                <span>🔔 아직 대답 안 한 사역 점검이 있어!</span>
                <button class="missed-resolve-all" @click="resolveAllMissed">전부 완료 처리</button>
            </div>
            <div v-for="item in missedList" :key="item.id" class="missed-item" :style="{ opacity: item._processing ? 0.5 : 1 }">
                <div class="missed-info">
                    <span class="missed-time">{{ item.startTime }}~{{ item.endTime }}</span>
                    <span class="missed-plans">{{ (item.expectedPlans || []).map(p => p.name).filter((v,i,a) => a.indexOf(v)===i).join(', ') }}</span>
                </div>
                <div class="missed-actions">
                    <button class="missed-btn ok" @click="handleMissedAction(item.id, 'ok')">⭕ 했어</button>
                    <button class="missed-btn no" @click="handleMissedAction(item.id, 'no')">❌ 못했어</button>
                </div>
            </div>
        </div>

        <div class="report-section-divider">🌾 오늘의 수확 (보고)</div>

        <label>🌻 보고 대상자</label>
        <div class="input-card" style="position:relative;">
            <input type="text" v-model="reportName" placeholder="이름 입력 또는 ▼ 눌러 선택"
                autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
                inputmode="text" name="reportName_no_autofill"
                @focus="openSuggestions" @input="saveDraft" @blur="closeSuggestionsSoon"
                style="color:#333; width:calc(100% - 28px);">
            <span @click="toggleSuggestions"
                style="position:absolute; right:14px; top:50%; transform:translateY(-50%); cursor:pointer; color:#888; font-size:12px;">▼</span>
            <div v-if="showSuggestions && filteredSuggestions.length > 0" class="report-name-suggestions">
                <div v-for="n in filteredSuggestions" :key="n" class="suggestion-item"
                    @mousedown.prevent="pickSuggestion(n)" @touchstart.prevent="pickSuggestion(n)">
                    {{ n }}
                </div>
            </div>
        </div>

        <label>🌱 1. 활동</label>
        <div class="input-card">
            <select v-model="activity" @change="saveDraft">
                <option>활동을 하지 못했어..</option>
                <option>비대면 활동!</option>
                <option>대면 활동!</option>
                <option>오프찾 했어!</option>
            </select>
        </div>

        <label>🗣️ 말걸기 수</label>
        <div class="input-card">
            <input type="number" v-model="talkCount" inputmode="numeric" pattern="[0-9]*"
                placeholder="0" @input="saveDraft">
        </div>

        <label>📩 디엠</label>
        <div>
            <div v-for="(row, idx) in dmRows" :key="idx" class="univ-row">
                <div class="univ-input-group" style="flex:0.6;">
                    <input type="number" v-model="row.count" inputmode="numeric" pattern="[0-9]*"
                        placeholder="0" class="univ-name" @input="saveDraft">
                </div>
                <div class="univ-input-group">
                    <select v-model="row.path" style="font-family:'Jua';" @change="onPathToolChange">
                        <option value="">경로</option>
                        <option v-for="opt in pathOptions" :key="opt.id" :value="opt.pathName">{{ opt.pathName }}</option>
                    </select>
                </div>
                <div class="univ-input-group">
                    <select v-model="row.tool" style="font-family:'Jua';" @change="onPathToolChange">
                        <option value="">도구</option>
                        <option v-for="opt in toolOptions" :key="opt.id" :value="opt.toolName">{{ opt.toolName }}</option>
                    </select>
                </div>
                <button v-if="idx === 0" class="btn-icon btn-add" @click="dmRows.push({ count: '', path: '', tool: '' }); savePathPrefs()">+</button>
                <button v-else class="btn-icon btn-remove" @click="dmRows.splice(idx, 1); savePathPrefs()">-</button>
            </div>
        </div>

        <label>📷 큐알</label>
        <div>
            <div v-for="(row, idx) in qrRows" :key="idx" class="univ-row">
                <div class="univ-input-group" style="flex:0.6;">
                    <input type="number" v-model="row.count" inputmode="numeric" pattern="[0-9]*"
                        placeholder="0" class="univ-name" @input="saveDraft">
                </div>
                <div class="univ-input-group">
                    <select v-model="row.path" style="font-family:'Jua';" @change="onPathToolChange">
                        <option value="">경로</option>
                        <option v-for="opt in pathOptions" :key="opt.id" :value="opt.pathName">{{ opt.pathName }}</option>
                    </select>
                </div>
                <div class="univ-input-group">
                    <select v-model="row.tool" style="font-family:'Jua';" @change="onPathToolChange">
                        <option value="">도구</option>
                        <option v-for="opt in toolOptions" :key="opt.id" :value="opt.toolName">{{ opt.toolName }}</option>
                    </select>
                </div>
                <button v-if="idx === 0" class="btn-icon btn-add" @click="qrRows.push({ count: '', path: '', tool: '' }); savePathPrefs()">+</button>
                <button v-else class="btn-icon btn-remove" @click="qrRows.splice(idx, 1); savePathPrefs()">-</button>
            </div>
        </div>

        <label>🌐 온유입</label>
        <div>
            <div v-for="(row, idx) in onlineIntakeRows" :key="idx" class="univ-row">
                <div class="univ-input-group" style="flex:0.6;">
                    <input type="number" v-model="row.count" inputmode="numeric" pattern="[0-9]*"
                        placeholder="0" class="univ-name" @input="saveDraft">
                </div>
                <div class="univ-input-group">
                    <select v-model="row.path" style="font-family:'Jua';" @change="onPathToolChange">
                        <option value="">경로</option>
                        <option v-for="opt in pathOptions" :key="opt.id" :value="opt.pathName">{{ opt.pathName }}</option>
                    </select>
                </div>
                <div class="univ-input-group">
                    <select v-model="row.tool" style="font-family:'Jua';" @change="onPathToolChange">
                        <option value="">도구</option>
                        <option v-for="opt in toolOptions" :key="opt.id" :value="opt.toolName">{{ opt.toolName }}</option>
                    </select>
                </div>
                <button v-if="idx === 0" class="btn-icon btn-add" @click="onlineIntakeRows.push({ count: '', path: '', tool: '' }); savePathPrefs()">+</button>
                <button v-else class="btn-icon btn-remove" @click="onlineIntakeRows.splice(idx, 1); savePathPrefs()">-</button>
            </div>
        </div>

        <label>🏫 홍보 학교</label>
        <div>
            <div v-for="(row, idx) in univRows" :key="idx" class="univ-row">
                <div class="univ-input-group" style="flex:1.4;">
                    <input class="univ-name" v-model="row.name" placeholder="학교명" @input="saveDraft">
                </div>
                <div class="univ-input-group">
                    <select v-model="row.path" style="font-family:'Jua';" @change="saveDraft">
                        <option value="">경로</option>
                        <option v-for="opt in pathOptions" :key="opt.id" :value="opt.pathName">{{ opt.pathName }}</option>
                    </select>
                </div>
                <div class="univ-input-group">
                    <select v-model="row.tool" style="font-family:'Jua';" @change="saveDraft">
                        <option value="">도구</option>
                        <option v-for="opt in toolOptions" :key="opt.id" :value="opt.toolName">{{ opt.toolName }}</option>
                    </select>
                </div>
                <button v-if="idx === 0" class="btn-icon btn-add" @click="addUnivRow">+</button>
                <button v-else class="btn-icon btn-remove" @click="removeUnivRow(idx)">-</button>
            </div>
        </div>

        <label>🍀 잎사귀</label>
        <div>
            <div v-for="(row, idx) in leafRows" :key="idx" class="univ-row">
                <div class="univ-input-group">
                    <select v-model="row.val" class="leaf-val" style="font-family:'Jua';" @change="saveDraft">
                        <option v-for="opt in leafOptions" :key="opt" :value="opt">{{ opt }}</option>
                    </select>
                </div>
                <div class="univ-input-group" style="flex:0.7;">
                    <input type="date" v-model="row.date" class="leaf-date" style="font-family:'Jua';" @change="saveDraft">
                </div>
                <button v-if="idx === 0" class="btn-icon btn-add" @click="addLeafRow">+</button>
                <button v-else class="btn-icon btn-remove" @click="removeLeafRow(idx)">-</button>
            </div>
        </div>

        <label>💖 오늘 나의 하루는! (<span :class="moodTouched ? 'mood-on' : 'mood-off'">{{ moodTouched ? mood : '없음' }}</span>)</label>
        <div class="input-card">
            <input type="range" v-model.number="mood" min="1" max="10" @input="onMoodInput">
        </div>

        <label>💭 오늘 깨달았거나 힘들었던게 있다면 적어보아요!</label>
        <div class="input-card">
            <textarea v-model="reflection" rows="3" @input="saveDraft"></textarea>
        </div>

        <!-- 내일 시간표 (터치 페인팅) — 임시 비활성화
        <div class="plan-section">
            <label>🎨 내일의 작전 (시간표)</label>
            <div class="plan-desc">아래 팔레트에서 사역을 선택한 후 시간표를 터치해서 칠해줘!</div>
            <div class="plan-copy-btns">
                <button class="plan-copy-btn" @click="loadYesterdayPlan" :disabled="!!copyLoading">
                    {{ copyLoading === 'yesterday' ? '로딩 중...' : '📋 어제 계획 복사' }}
                </button>
                <button class="plan-copy-btn" @click="loadLastWeekPlan" :disabled="!!copyLoading">
                    {{ copyLoading === 'lastweek' ? '로딩 중...' : '📅 지난주 복사' }}
                </button>
            </div>
            <TimeBlockPainter
                ref="painterRef"
                :initial-blocks="timeBlocks"
                @update:blocks="onBlocksUpdate"
            />
        </div>
        -->

        <div class="report-save-date-label" :class="{ 'is-late': isLate }">
            📅 이 보고는 <b>{{ reportSaveDateText }}</b> 건으로 저장됩니다
            <div v-if="reportSaveDateHint" class="report-save-date-hint">
                {{ reportSaveDateHintText }}
            </div>
        </div>

        <label class="final-check-label">
            <input type="checkbox" v-model="isFinal" @change="saveDraft">
            ✅ 오늘 보고 완료 — 더 이상 수정 없음
        </label>

        <button class="btn submit-btn" @click="submitDailyReport" :disabled="ui.isProcessing">
            {{ ui.isProcessing ? '제출 중...' : '🌰 마감 제출하기' }}
        </button>

        <!-- 최종마감 재진입 경고 팝업 -->
        <div v-if="finalWarning" class="dr-modal-backdrop">
            <div class="dr-modal">
                <div class="dr-modal-title">✅ 이미 최종 제출한 보고야!</div>
                <div class="dr-modal-desc">오늘 보고를 이미 최종으로 제출했어.<br>그래도 수정할 거야?</div>
                <div class="dr-modal-btns">
                    <button class="btn-pos" style="background:#1565C0;" @click="finalWarning = false">수정할게</button>
                    <button class="btn-neg" @click="finalWarning = false; router.push({ name: 'home' })">나갈게</button>
                </div>
            </div>
        </div>

        <DailyReportMergePreviewModal v-if="mergeExisting && mergeInput"
            :existing="mergeExisting" :input="mergeInput"
            @confirm="onMergeConfirm" @cancel="onMergeCancel" />

        <div v-if="dateChoice" class="dr-modal-backdrop">
            <div class="dr-modal">
                <div class="dr-modal-title">{{ dateChoice.title || '어느 날짜의 보고?' }}</div>
                <div class="dr-modal-desc" v-html="dateChoice.desc || '현재 <b>22시 이후</b>입니다.<br>이 보고를 <b>어느 날짜의 건</b>으로 저장할지 선택해 주세요.'"></div>
                <div class="dr-modal-btns">
                    <button class="btn-pos today-btn"
                        @click="dateChoice.onPick(dateChoice.todayKey, true)">
                        {{ dateChoice.todayBtnLabel || `📅 오늘 (${dateChoice.todayLbl}) 보고로 저장` }}
                    </button>
                    <button class="btn-pos tmr-btn"
                        @click="dateChoice.onPick(dateChoice.tmrKey, false)">
                        {{ dateChoice.tmrBtnLabel || `🌙 내일 (${dateChoice.tmrLbl}) 보고로 저장` }}
                    </button>
                </div>
            </div>
        </div>

        <!-- 동명이인 선택 모달 (legacy resolveReportName 동명이인 분기 정합) -->
        <div v-if="dupChoice" class="dr-modal-backdrop" @click.self="dupChoice.onCancel()">
            <div class="dr-modal">
                <div class="dr-modal-title">👥 {{ dupChoice.input }} - 누구?</div>
                <div class="dr-modal-desc">팀 내에 동명이인이 있어! 선택해줘.</div>
                <div class="dr-modal-btns">
                    <button v-for="cand in dupChoice.candidates" :key="cand"
                        class="btn-pos dup-btn" @click="dupChoice.onPick(cand)">
                        {{ dupChoice.input }}<b v-if="cand !== dupChoice.input" class="dup-suffix">{{ cand.replace(dupChoice.input, '') }}</b>
                    </button>
                    <button class="btn-neg" @click="dupChoice.onCancel()">취소</button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.missed-section {
    background: #FFF3E0;
    border: 1px solid #FFE0B2;
    border-radius: 12px;
    padding: 14px;
    margin-bottom: 18px;
}
.missed-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
    font-weight: bold;
    margin-bottom: 10px;
    color: #E65100;
}
.missed-resolve-all {
    background: #FF9800;
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 6px 12px;
    font-size: 12px;
    font-family: 'Jua';
    cursor: pointer;
}
.missed-item {
    background: #fff;
    border-radius: 8px;
    padding: 10px 12px;
    margin-bottom: 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: opacity 0.3s;
}
.missed-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
}
.missed-time {
    font-size: 13px;
    font-weight: bold;
    color: #333;
}
.missed-plans {
    font-size: 12px;
    color: #666;
}
.missed-actions {
    display: flex;
    gap: 6px;
}
.missed-btn {
    border: none;
    border-radius: 8px;
    padding: 6px 10px;
    font-size: 12px;
    font-family: 'Jua';
    cursor: pointer;
}
.missed-btn.ok {
    background: #E8F5E9;
    color: #2E7D32;
}
.missed-btn.no {
    background: #FFEBEE;
    color: #C62828;
}
.plan-section {
    margin-top: 20px;
    margin-bottom: 20px;
}
.plan-desc {
    font-size: 12px;
    color: #888;
    margin-bottom: 12px;
    line-height: 1.4;
}
.plan-copy-btns {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
}
.plan-copy-btn {
    flex: 1;
    background: #F5F5F5;
    border: 1px solid #E0E0E0;
    border-radius: 8px;
    padding: 8px;
    font-size: 12px;
    font-family: 'Jua';
    cursor: pointer;
    color: #555;
}
.plan-copy-btn:disabled {
    opacity: 0.5;
}

/* 보고 대상자 autocomplete */
.report-name-suggestions {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 4px;
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 8px;
    max-height: 240px;
    overflow-y: auto;
    z-index: 50;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}
.suggestion-item {
    padding: 10px 12px;
    cursor: pointer;
    border-bottom: 1px solid #f0f0f0;
    font-size: 14px;
    color: #333;
}
.suggestion-item:last-child { border-bottom: none; }
.suggestion-item:hover { background: #f9f9f9; }


/* 🌾 오늘의 수확 (보고) 섹션 헤더 (legacy line 3923-3924 정합) */
.report-section-divider {
    font-weight: bold;
    color: #5D4037;
    font-size: 18px;
    margin: 18px 0 10px;
    border-bottom: 2px solid #EFEBE9;
    padding-bottom: 5px;
}

/* mood 슬라이더 라벨 — legacy moodVal 색상 분기 */
.mood-on { color: #333; }
.mood-off { color: #aaa; }

/* 보고 저장 일자 label */
.report-save-date-label {
    margin: 10px 0;
    padding: 10px 12px;
    border-radius: 8px;
    background: #E8F5E9;
    color: #2E7D32;
    font-size: 13px;
    text-align: center;
    line-height: 1.5;
}
.report-save-date-label.is-late {
    background: #FFF3E0;
    color: #E65100;
}
.report-save-date-hint {
    margin-top: 4px;
    font-size: 11px;
    color: #6b6b6b;
}

/* 22시+ 날짜 선택 / 동명이인 선택 모달 (inline) */
.dr-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}
.dr-modal {
    background: #FFF9E6;
    border-radius: 12px;
    padding: 20px;
    max-width: 380px;
    width: 90%;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}
.dr-modal-title {
    font-size: 17px;
    font-weight: bold;
    color: #5D4037;
    text-align: center;
    margin-bottom: 12px;
}
.dr-modal-desc {
    font-size: 13px;
    color: #555;
    margin: 4px 0 14px;
    line-height: 1.6;
    text-align: center;
}
.dr-modal-btns {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.dr-modal-btns .btn-pos,
.dr-modal-btns .btn-neg {
    width: 100%;
    border: none;
    border-radius: 8px;
    padding: 12px;
    font-size: 14px;
    font-family: 'Jua';
    color: #fff;
    cursor: pointer;
}
.dr-modal-btns .today-btn { background: #4CAF50; }
.dr-modal-btns .tmr-btn { background: #1565C0; }
.dr-modal-btns .dup-btn { background: #795548; }
.dr-modal-btns .btn-neg { background: #9E9E9E; }
.dup-suffix {
    color: #FFD54F;
    margin-left: 4px;
}

/* 최종마감 체크박스 */
.final-check-label {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    margin: 8px 0 4px;
    background: #E3F2FD;
    border: 1px solid #90CAF9;
    border-radius: 8px;
    font-size: 13px;
    color: #1565C0;
    cursor: pointer;
}
.final-check-label input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
    flex-shrink: 0;
}

/* "🌰 마감 제출하기" 버튼 정합 (legacy 의 #4CAF50 / 20px) */
.submit-btn {
    margin-top: 10px;
    background: #4CAF50;
    font-size: 20px;
}
</style>
