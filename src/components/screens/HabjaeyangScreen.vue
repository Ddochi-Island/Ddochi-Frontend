<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useTmStore } from '@/stores/tm'
import { useUiStore } from '@/stores/ui'
import { useApi } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'
import { useFormatters } from '@/composables/useFormatters'
import { hjFields, mbtiOptions } from '@/constants'
import DuplicateHistoryPopup from './popups/DuplicateHistoryPopup.vue'
import GachaSlotOverlay from './GachaSlotOverlay.vue'

const SECTION_STARTS = {
    guide:      '📋 매칭 정보',
    subName:    '👤 섭외자',
    sch:        '💭 내면 파악',
    att:        '📝 태도 & 기타',
    centerEnv:  '✅ 합자 체크',
}
const FULL_WIDTH_FIELDS = new Set(['mtPlace', 'contact', 'purpose', 'selfImage', 'trouble', 'etc'])
// Fields rendered explicitly in pair rows — excluded from the generic bottom loop
const EXPLICIT_TOP_IDS = new Set(['guide', 'tmName', 'path', 'tool', 'mtDate', 'mtTime', 'mtPlace', 'subName', 'gender', 'age', 'contact', 'nearSt', 'gwacheonMin', 'gwacheonTransfer', 'centerMin', 'centerTransfer', 'mbti', 'job'])
const hjBottomFields = hjFields.filter(f => !EXPLICIT_TOP_IDS.has(f.id))

const MIN_OPTS = ['미정', '10분', '20분', '30분', '40분', '50분', '1시간', '1시간 10분', '1시간 20분', '1시간 30분', '1시간 40분', '1시간 50분', '2시간 이상']
const TRANSFER_OPTS = ['0회', '1회', '2회', '3회 이상']

const router = useRouter()
const auth = useAuthStore()
const tm = useTmStore()
const ui = useUiStore()
const { callApi, callApiPromise } = useApi()
const { showAppAlert } = usePopup()
const { autoResize, moveFocus } = useFormatters()

const formData = reactive({})
const phone1 = ref('010')
const phone2 = ref('')
const phone3 = ref('')
const submitting = ref(false)
const toolOpts = ref([])
const pathOpts = ref([])
const currentDocId = ref(null)
const duplicateList = ref(null)
const duplicateProspectId = ref(null)

// 선한 양치기 가챠
const inflowName = ref('')
const gachaVisible = ref(false)
const gachaResult = ref(null) // { winner, winnerName, inflowName, tmName, currentRound, nextProb }

// 자동완성
const acOpen = ref('')
const acQuery = reactive({ guide: '', tmName: '', inflow: '' })
const acConfirmed = reactive({ guide: false, tmName: false, inflow: false })
const acStatus = reactive({ guide: '', tmName: '', inflow: '' }) // '' | 'valid' | 'invalid'

function filterNames(q) {
    if (!q || q.length < 1) return []
    const lower = q.toLowerCase()
    return (auth.validNames || []).filter(n => n.toLowerCase().includes(lower)).slice(0, 10)
}
const acGuideOpts = computed(() => acOpen.value === 'guide' ? filterNames(acQuery.guide) : [])
const acTmNameOpts = computed(() => acOpen.value === 'tmName' ? filterNames(acQuery.tmName) : [])
const acInflowOpts = computed(() => acOpen.value === 'inflow' ? filterNames(acQuery.inflow) : [])

function openAc(field) { acOpen.value = field }
function onAcInput(field, e) {
    acQuery[field] = e.target.value
    acConfirmed[field] = false
    acStatus[field] = ''
}
function closeAc(field) {
    setTimeout(() => {
        // 다른 필드가 이 150ms 사이에 이미 열려있으면(예: A blur 직후 B focus) 그걸
        // 건드리면 안 됨 — 무조건 초기화하면 방금 연 B의 드롭다운이 닫혀버림.
        if (acOpen.value === field) acOpen.value = ''
        if (!acQuery[field]) return
        if (!acConfirmed[field]) {
            acStatus[field] = 'invalid'
            setTimeout(() => {
                if (field === 'guide') formData.guide = ''
                else if (field === 'tmName') formData.tmName = ''
                else if (field === 'inflow') inflowName.value = ''
                acQuery[field] = ''
                acStatus[field] = ''
            }, 600)
        }
    }, 150)
}
function selectAc(field, name) {
    if (field === 'guide') formData.guide = name
    else if (field === 'tmName') formData.tmName = name
    else if (field === 'inflow') inflowName.value = name
    acQuery[field] = name
    acConfirmed[field] = true
    acStatus[field] = 'valid'
    acOpen.value = ''
}

// 구두만픽: 도구노방/생노 경로일 때만 활성화
const verbalManFix = ref('X')
const verbalManFixEnabled = computed(() => {
    const p = formData.path || ''
    return p === '도구노방' || p === '생노'
})
watch(() => formData.path, (newPath) => {
    if (newPath !== '도구노방' && newPath !== '생노') verbalManFix.value = 'X'
})

// 번호찾 팝업 (합재양 제출 전 확인)
const regPopupState = ref(null) // null | 'confirm' | 'register'
const regPopupEntries = ref([])
const pendingSubmitData = ref(null)

onMounted(() => {
    if (tm.shedContext) {
        const ctx = tm.shedContext
        currentDocId.value = ctx.docId
        applyFormData({ subName: ctx.name, contact: ctx.phone, age: ctx.age, mbti: ctx.mbti })
        // applyFormData 안의 loadDraft()가 이 문서의 예전 임시저장(mbti 이관 기능
        // 추가 전에 저장된 draft라 mbti가 비어있음)으로 방금 넣은 값을 덮어쓸 수 있어서,
        // 번호찾 정보가 임시저장보다 우선하도록 다시 한번 덮어씀.
        if (ctx.mbti) formData.mbti = ctx.mbti
        if (ctx.introducer) selectAc('inflow', ctx.introducer)
    } else {
        initForm()
    }
    callApi('/api/get-tool-configs', {}, res => {
        if (res?.list) toolOpts.value = res.list.map(t => t.toolName)
    })
    callApi('/api/get-path-configs', {}, res => {
        if (res?.list) pathOpts.value = res.list.map(p => p.pathName)
    })
})

function initForm() {
    const idx = tm.currentTmIndex
    const isValidIdx = idx !== null && idx !== undefined && Number.isFinite(idx) && idx >= 0 && idx < tm.tmDataList.length
    if (isValidIdx) populateFromTmItem(tm.tmDataList[idx])
}

function populateFromTmItem(item) {
    currentDocId.value = item.docId
    const hj = item.habjaeyang || {}
    const note = { ...(item.note || {}) }
    const rawGender = hj.gender || item.gender || ''
    const gender = rawGender === '남자' ? '남' : rawGender === '여자' ? '여' : rawGender
    const safeData = {
        subName: item.name, age: item.age, gender, nearSt: item.residence,
        guide: item.manager, contact: item.phone,
        mtDate: hj.mtDate || '', mtTime: hj.mtTime || '', mtPlace: hj.mtPlace || '',
        purpose: hj.purpose || '', sch: hj.sch || hj.schedule || '',
        plan: hj.plan || '', selfImage: hj.selfImage || '', trouble: hj.trouble || '', wary: hj.wary || '',
        tmName: hj.tmName || '', mbti: hj.mbti || '', job: hj.job || '',
        att: hj.att || '', dist: hj.dist || '', etc: hj.etc || '',
        gwacheonMin: hj.gwacheonMin || '', gwacheonTransfer: hj.gwacheonTransfer || '',
        centerMin: hj.centerMin || '', centerTransfer: hj.centerTransfer || '',
        centerEnv: hj.centerEnv || '', drug: hj.drug || '', mental: hj.mental || '', ...note,
    }
    applyFormData(safeData)
}

function applyFormData(safeData) {
    hjFields.forEach(f => {
        if (f.id === 'contact') {
            const val = safeData.contact || ''
            if (val) {
                const parts = val.split('-')
                if (parts.length === 3) {
                    phone1.value = parts[0]; phone2.value = parts[1]; phone3.value = parts[2]
                } else {
                    const d = val.replace(/[^0-9]/g, '')
                    if (d.length === 11) { phone1.value = d.slice(0,3); phone2.value = d.slice(3,7); phone3.value = d.slice(7) }
                    else if (d.length === 10) { phone1.value = d.slice(0,3); phone2.value = d.slice(3,6); phone3.value = d.slice(6) }
                }
            }
        } else {
            formData[f.id] = safeData[f.id] || ''
        }
    })
    if (!formData.mtTime) {
        const h = String(new Date().getHours()).padStart(2, '0')
        formData.mtTime = `${h}:00`
    }
    loadDraft()
    nextTick(() => { document.querySelectorAll('.auto-textarea').forEach(el => autoResize(el)) })
}

function handlePhoneFocus(el, max, nextId) { moveFocus(el, max, nextId) }
function onPhone3Input(event) { if (phone3.value.length >= 4) event.target.blur() }
function handleAutoResize(event) { autoResize(event.target) }

const DRAFT_KEY = () => currentDocId.value ? `hj_draft_${currentDocId.value}` : null
function saveDraft() {
    const key = DRAFT_KEY(); if (!key) return
    try { localStorage.setItem(key, JSON.stringify({ formData: { ...formData }, phone1: phone1.value, phone2: phone2.value, phone3: phone3.value })) } catch (_) {}
}
function loadDraft() {
    const key = DRAFT_KEY(); if (!key) return
    try {
        const raw = localStorage.getItem(key); if (!raw) return
        const d = JSON.parse(raw)
        if (d.formData) Object.assign(formData, d.formData)
        if (d.phone1) phone1.value = d.phone1
        if (d.phone2) phone2.value = d.phone2
        if (d.phone3) phone3.value = d.phone3
    } catch (_) {}
}
function clearDraft() {
    const key = DRAFT_KEY(); if (!key) return
    try { localStorage.removeItem(key) } catch (_) {}
}
watch(formData, saveDraft, { deep: true })

function collectSubmitData() {
    const guideName = (formData.guide || '').trim()
    const tmName = (formData.tmName || '').trim()
    const mtDate = (formData.mtDate || '').trim()
    const mtTime = (formData.mtTime || '').trim()
    const isShed = !!tm.shedContext
    if (!isShed) {
        if (!auth.validNames.includes(guideName)) { showAppAlert(`인도자 이름[${guideName}]이(가) 명단에 없어! 확인해줘.`); return null }
    } else {
        // 가챠 모드: 유입자/티엠자 필수
        if (!inflowName.value.trim()) { showAppAlert('유입자 이름을 입력해줘!'); return null }
        if (!tmName) { showAppAlert('티엠자 이름을 입력해줘!'); return null }
    }
    if (!isShed && tmName && !auth.validNames.includes(tmName)) { showAppAlert(`티엠자 이름[${tmName}]이(가) 명단에 없어! 확인해줘.`); return null }
    if (!mtDate) { showAppAlert('매칭일자를 입력해줘!'); return null }
    if (!mtTime) { showAppAlert('매칭시간을 입력해줘!'); return null }
    const data = {}
    hjFields.forEach(f => {
        if (f.id === 'contact') data.contact = `${phone1.value}-${phone2.value}-${phone3.value}`
        else data[f.id] = (formData[f.id] || '').toString().trim()
    })
    data.verbalManFix = verbalManFix.value
    return data
}

async function submitHabjaeyang() {
    if (submitting.value || ui.isProcessing) return
    const submitData = collectSubmitData()
    if (!submitData) return
    pendingSubmitData.value = submitData

    const path = submitData.path || ''
    const subName = submitData.subName || ''
    if ((path === '도구노방' || path === '생노') && subName) {
        submitting.value = true
        ui.setProcessing(true)
        try {
            const r = await callApiPromise('/api/daily-report/search-reg', { name: subName })
            const entries = (r?.success ? r.entries : []) || []
            regPopupEntries.value = entries
            regPopupState.value = entries.length > 0 ? 'confirm' : 'register'
        } catch {
            regPopupState.value = 'register'
        } finally {
            submitting.value = false
            ui.setProcessing(false)
        }
        return
    }
    doActualSubmit(submitData)
}

function onRegConfirmYes() {
    regPopupState.value = null
    doActualSubmit(pendingSubmitData.value)
}
function onRegConfirmNo() {
    regPopupState.value = 'register'
}
function onRegRegisterYes() {
    const submitData = pendingSubmitData.value
    regPopupState.value = null
    callApiPromise('/api/daily-report/add-reg-entry', {
        name: submitData.subName,
        verbalManFix: submitData.verbalManFix,
        result: '만픽',
    }).catch(() => {})
    doActualSubmit(submitData)
}
function onRegRegisterNo() {
    regPopupState.value = null
    doActualSubmit(pendingSubmitData.value)
}

function finishAndGoHome(message) {
    submitting.value = false
    ui.setProcessing(false)
    clearDraft()
    const fromShed = !!tm.shedContext
    showAppAlert(message, () => {
        currentDocId.value = null
        tm.currentTmIndex = null
        if (fromShed) {
            tm.shedContext = null
            router.push({ name: 'sunhanYanghagi' })
        } else {
            router.push({ name: 'home' })
        }
    })
}

function doActualSubmit(submitData) {
    submitting.value = true
    ui.setProcessing(true)
    const isShed = !!tm.shedContext
    const afterSave = async (savedDocId) => {
        if (!isShed) { finishAndGoHome('제출 완료!'); return }
        // 가챠 실행 (합재양은 이미 저장됨)
        const r = await callApiPromise('/api/run-shed-gacha', {
            docId: savedDocId,
            inflowName: inflowName.value.trim(),
            tmName: (submitData.tmName || '').trim(),
        })
        submitting.value = false
        ui.setProcessing(false)
        clearDraft()
        if (!r?.success) { showAppAlert(r?.message || '가챠 오류'); return }
        gachaResult.value = r
        gachaVisible.value = true
    }

    if (!currentDocId.value) {
        callApi('/api/submit-habjaeyang-new', {
            sabun: auth.currentSabun,
            data: { habjaeyang: submitData },
        }, res => {
            if (!res?.success) { submitting.value = false; ui.setProcessing(false); return showAppAlert(res?.message || '저장 실패') }
            if (res.duplicate) {
                submitting.value = false; ui.setProcessing(false)
                duplicateList.value = res.duplicates || []
                duplicateProspectId.value = res.prospectId
                return
            }
            afterSave(res.prospectId || currentDocId.value)
        })
        return
    }
    callApi('/api/submit-result', {
        sabun: auth.currentSabun,
        data: {
            rowIndex: currentDocId.value,
            status: '끝난거', finalResult: '만남픽스',
            logType: '합재양작성', logContent: '합재양 제출 완료🗂',
            habjaeyang: submitData, forceUpdate: true,
        },
    }, res => {
        if (!res?.success) { submitting.value = false; ui.setProcessing(false); return showAppAlert(res?.message || '저장 실패') }
        afterSave(currentDocId.value)
    })
}

async function onGachaDone() {
    gachaVisible.value = false
    gachaResult.value = null
    currentDocId.value = null
    tm.currentTmIndex = null
    tm.shedContext = null
    await nextTick()
    router.replace({ name: 'sunhanYanghagi' })
}

// 중복섭외 팝업 세 갈래 — 저장은 이미 끝나있고(IS_DROPPED=1/중복섭외), 여기선 최종 처리만 결정.
function closeDuplicatePopup() {
    // [X] — 제출 이전으로 되돌리기 (소프트 삭제). 폼에 그대로 남아있는다.
    const prospectId = duplicateProspectId.value
    duplicateList.value = null
    duplicateProspectId.value = null
    if (prospectId) callApi('/api/habjaeyang-dup-resolve', { prospectId, action: 'revert' }, () => {})
}
function rejectDuplicatePopup() {
    // "중섭 반려처리" — 이미 반려 상태니 확정 로그만 남기고 완료 처리.
    const prospectId = duplicateProspectId.value
    duplicateList.value = null
    duplicateProspectId.value = null
    if (!prospectId) return
    submitting.value = true
    ui.setProcessing(true)
    callApi('/api/habjaeyang-dup-resolve', { prospectId, action: 'reject' }, res => {
        if (!res?.success) { submitting.value = false; ui.setProcessing(false); return showAppAlert(res?.message || '처리 실패') }
        finishAndGoHome('중복섭외로 반려 처리했어요.')
    })
}
function proceedDuplicatePopup() {
    // "그래도 제출" — 정상 등록으로 되돌리고 텔레그램 발송.
    const prospectId = duplicateProspectId.value
    duplicateList.value = null
    duplicateProspectId.value = null
    if (!prospectId) return
    submitting.value = true
    ui.setProcessing(true)
    callApi('/api/habjaeyang-dup-resolve', { prospectId, action: 'proceed' }, res => {
        if (!res?.success) { submitting.value = false; ui.setProcessing(false); return showAppAlert(res?.message || '처리 실패') }
        finishAndGoHome('제출 완료!')
    })
}

function getFieldType(f) {
    if (f.type === 'textarea') return 'textarea'
    return 'input'
}

onUnmounted(() => {
    if (tm.shedContext) tm.shedContext = null
})
</script>

<template>
    <div class="screen">
        <div class="header">
            <h3>📑 합재양 작성</h3>
            <p>빈칸 없이 꼼꼼하게!</p>
        </div>

        <!-- 선한 양치기 메모 (shedContext 있을 때만) -->
        <div v-if="tm.shedContext?.memo" class="hj-shed-memo">
            <div class="hj-shed-memo-title">📌 TM 메모 (참고용)</div>
            <div class="hj-shed-memo-text">{{ tm.shedContext.memo }}</div>
        </div>

        <div class="hj-form-grid">
            <!-- ── 📋 매칭 정보 ── -->
            <div class="hj-section-header">📋 매칭 정보</div>

            <!-- 인도자 + 티엠자 (shed 모드: 가챠 구조) -->
            <template v-if="tm.shedContext">
                <div class="hj-pair-row">
                    <div class="hj-field">
                        <label>유입자 이름</label>
                        <div class="ac-wrap">
                            <input type="text" :class="['input-card', acStatus.inflow ? `ac-input-${acStatus.inflow}` : '']"
                                   :value="acQuery.inflow" placeholder="명단에서 선택"
                                   autocomplete="off"
                                   @input="onAcInput('inflow', $event)"
                                   @focus="openAc('inflow')" @blur="closeAc('inflow')">
                            <div v-if="acInflowOpts.length" class="ac-dropdown">
                                <div v-for="n in acInflowOpts" :key="n" class="ac-item" @mousedown.prevent="selectAc('inflow', n)">{{ n }}</div>
                            </div>
                        </div>
                    </div>
                    <div class="hj-field">
                        <label>티엠자 이름</label>
                        <div class="ac-wrap">
                            <input id="hj-tmName" type="text" :class="['input-card', acStatus.tmName ? `ac-input-${acStatus.tmName}` : '']"
                                   :value="acQuery.tmName" placeholder="명단에서 선택"
                                   autocomplete="off"
                                   @input="onAcInput('tmName', $event)"
                                   @focus="openAc('tmName')" @blur="closeAc('tmName')">
                            <div v-if="acTmNameOpts.length" class="ac-dropdown">
                                <div v-for="n in acTmNameOpts" :key="n" class="ac-item" @mousedown.prevent="selectAc('tmName', n)">{{ n }}</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="hj-pair-row">
                    <div class="hj-field hj-field-full">
                        <label>인도자 이름</label>
                        <input type="text" class="input-card hj-guide-disabled" :value="'🎰 가챠로 결정'" disabled>
                    </div>
                </div>
            </template>
            <!-- 일반 모드: 기존 구조 -->
            <template v-else>
                <div class="hj-pair-row">
                    <div class="hj-field">
                        <label>인도자 이름</label>
                        <div class="ac-wrap">
                            <input id="hj-guide" type="text" :class="['input-card', acStatus.guide ? `ac-input-${acStatus.guide}` : '']"
                                   :value="acQuery.guide" placeholder="명단에서 선택"
                                   autocomplete="off"
                                   @input="onAcInput('guide', $event)"
                                   @focus="openAc('guide')" @blur="closeAc('guide')">
                            <div v-if="acGuideOpts.length" class="ac-dropdown">
                                <div v-for="n in acGuideOpts" :key="n" class="ac-item" @mousedown.prevent="selectAc('guide', n)">{{ n }}</div>
                            </div>
                        </div>
                    </div>
                    <div class="hj-field">
                        <label>티엠자 이름</label>
                        <div class="ac-wrap">
                            <input id="hj-tmName" type="text" :class="['input-card', acStatus.tmName ? `ac-input-${acStatus.tmName}` : '']"
                                   :value="acQuery.tmName" placeholder="명단에서 선택"
                                   autocomplete="off"
                                   @input="onAcInput('tmName', $event)"
                                   @focus="openAc('tmName')" @blur="closeAc('tmName')">
                            <div v-if="acTmNameOpts.length" class="ac-dropdown">
                                <div v-for="n in acTmNameOpts" :key="n" class="ac-item" @mousedown.prevent="selectAc('tmName', n)">{{ n }}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </template>

            <!-- 섭외경로 + 섭외도구 + 구두만픽 -->
            <div class="hj-pair-row">
                <div class="hj-field">
                    <label>섭외경로</label>
                    <select id="hj-path" class="input-card" v-model="formData.path">
                        <option value="">선택 안 함</option>
                        <option v-for="opt in pathOpts" :key="opt">{{ opt }}</option>
                    </select>
                </div>
                <div class="hj-field">
                    <label>섭외도구</label>
                    <select id="hj-tool" class="input-card" v-model="formData.tool">
                        <option value="">선택 안 함</option>
                        <option v-for="opt in toolOpts" :key="opt">{{ opt }}</option>
                    </select>
                </div>
                <div class="hj-field-check">
                    <label>구두만픽</label>
                    <input
                        type="checkbox"
                        :checked="verbalManFix === 'O'"
                        :disabled="!verbalManFixEnabled"
                        @change="verbalManFix = $event.target.checked ? 'O' : 'X'"
                    >
                </div>
            </div>

            <!-- 매칭일자 + 매칭시간 -->
            <div class="hj-pair-row">
                <div class="hj-field">
                    <label>매칭일자</label>
                    <input id="hj-mtDate" type="date" class="input-card" v-model="formData.mtDate">
                </div>
                <div class="hj-field">
                    <label>매칭시간</label>
                    <input id="hj-mtTime" type="time" class="input-card" v-model="formData.mtTime">
                </div>
            </div>

            <!-- 매칭장소 (full) -->
            <div class="hj-field hj-field-full">
                <label>매칭장소</label>
                <input id="hj-mtPlace" type="text" class="input-card" v-model="formData.mtPlace">
            </div>

            <!-- ── 👤 섭외자 ── -->
            <div class="hj-section-header">👤 섭외자</div>

            <!-- 섭외자 이름 (full) -->
            <div class="hj-field hj-field-full">
                <label>섭외자 이름</label>
                <input id="hj-subName" type="text" class="input-card" v-model="formData.subName">
            </div>

            <!-- 성별 + 나이 -->
            <div class="hj-pair-row">
                <div class="hj-field">
                    <label>성별</label>
                    <select id="hj-gender" class="input-card" v-model="formData.gender">
                        <option value="">선택 안 함</option>
                        <option>남</option>
                        <option>여</option>
                    </select>
                </div>
                <div class="hj-field">
                    <label>나이</label>
                    <input id="hj-age" type="number" class="input-card" v-model="formData.age">
                </div>
            </div>

            <!-- 연락처 (full) -->
            <div class="hj-field hj-field-full">
                <label>연락처</label>
                <div class="input-card phone-group">
                    <input type="tel" class="phone-input" id="hj-phone1" maxlength="3" v-model="phone1" @input="handlePhoneFocus($event.target, 3, 'hj-phone2')">
                    <span class="dash">-</span>
                    <input type="tel" class="phone-input" id="hj-phone2" maxlength="4" v-model="phone2" @input="handlePhoneFocus($event.target, 4, 'hj-phone3')">
                    <span class="dash">-</span>
                    <input type="tel" class="phone-input" id="hj-phone3" maxlength="4" v-model="phone3" @input="onPhone3Input">
                </div>
            </div>

            <!-- 거주지 근처 역 -->
            <div class="hj-field hj-field-full">
                <label>거주지 근처 역</label>
                <input id="hj-nearSt" type="text" class="input-card" v-model="formData.nearSt">
            </div>

            <!-- 과천 분 + 환승 -->
            <div class="hj-pair-row">
                <div class="hj-field">
                    <label>과천까지(분)</label>
                    <select class="input-card" v-model="formData.gwacheonMin">
                        <option value="">미정</option>
                        <option v-for="opt in MIN_OPTS" :key="opt">{{ opt }}</option>
                    </select>
                </div>
                <div class="hj-field">
                    <label>과천 환승</label>
                    <select class="input-card" v-model="formData.gwacheonTransfer">
                        <option value="">미정</option>
                        <option v-for="opt in TRANSFER_OPTS" :key="opt">{{ opt }}</option>
                    </select>
                </div>
            </div>

            <!-- 센터 분 + 환승 -->
            <div class="hj-pair-row">
                <div class="hj-field">
                    <label>센터까지(분)</label>
                    <select class="input-card" v-model="formData.centerMin">
                        <option value="">미정</option>
                        <option v-for="opt in MIN_OPTS" :key="opt">{{ opt }}</option>
                    </select>
                </div>
                <div class="hj-field">
                    <label>센터 환승</label>
                    <select class="input-card" v-model="formData.centerTransfer">
                        <option value="">미정</option>
                        <option v-for="opt in TRANSFER_OPTS" :key="opt">{{ opt }}</option>
                    </select>
                </div>
            </div>

            <!-- MBTI -->
            <div class="hj-field">
                <label>MBTI</label>
                <select id="hj-mbti" class="input-card" v-model="formData.mbti">
                    <option v-for="opt in mbtiOptions" :key="opt" :selected="formData.mbti === opt">{{ opt }}</option>
                </select>
            </div>

            <!-- 학교/직장 -->
            <div class="hj-field">
                <label>학교(전공)/직장</label>
                <input id="hj-job" type="text" class="input-card" v-model="formData.job">
            </div>

            <!-- ── 나머지 섹션 (💭 내면 파악, 📝 태도 & 기타, ✅ 합자 체크) ── -->
            <template v-for="f in hjBottomFields" :key="f.id">
                <div v-if="SECTION_STARTS[f.id]" class="hj-section-header">{{ SECTION_STARTS[f.id] }}</div>
                <!-- O/X 토글 -->
                <div v-if="f.type === 'ox'" class="hj-field-ox">
                    <label>{{ f.label }}</label>
                    <div class="ox-group">
                        <button type="button" :class="['ox-btn', formData[f.id] === 'O' ? 'ox-active-o' : '']" @click="formData[f.id] = 'O'">O</button>
                        <button type="button" :class="['ox-btn', formData[f.id] === 'X' ? 'ox-active-x' : '']" @click="formData[f.id] = 'X'">X</button>
                    </div>
                </div>
                <!-- 일반 입력 -->
                <div v-else :class="['hj-field', FULL_WIDTH_FIELDS.has(f.id) ? 'hj-field-full' : '']">
                    <label>{{ f.label }}</label>
                    <textarea v-if="getFieldType(f) === 'textarea'" :id="'hj-' + f.id" class="input-card auto-textarea" v-model="formData[f.id]" @input="handleAutoResize"></textarea>
                    <input v-else :id="'hj-' + f.id" :type="f.type" class="input-card" v-model="formData[f.id]">
                </div>
            </template>
        </div>

        <button class="btn" :disabled="submitting" @click="submitHabjaeyang">
            {{ submitting ? '제출 중...' : '제출하기 📨' }}
        </button>

        <!-- 번호찾 확인 팝업 -->
        <teleport to="body">
            <div v-if="regPopupState" class="reg-overlay">
                <!-- 기존 기록 확인 -->
                <div v-if="regPopupState === 'confirm'" class="reg-popup">
                    <div class="reg-popup-header-row">
                        <span>🔍 번호찾 기록 확인</span>
                        <span class="reg-close" @click="regPopupState = null">×</span>
                    </div>
                    <p class="reg-popup-desc">오늘 같은 이름으로 번호찾 기록이 있어요.<br>이 인원이 맞나요?</p>
                    <div class="reg-entry-list">
                        <div v-for="(e, i) in regPopupEntries" :key="i" class="reg-entry-row">
                            <span class="reg-tag reg-name">{{ e.name }}</span>
                            <span class="reg-tag reg-submitter">{{ e.submitterName }}</span>
                            <span class="reg-tag reg-vmf" :class="{ 'vmf-yes': e.verbalManFix === 'O' }">{{ e.verbalManFix === 'O' ? '구두만픽' : '일반' }}</span>
                            <span class="reg-tag reg-result">{{ e.result }}</span>
                        </div>
                    </div>
                    <div class="reg-popup-btns">
                        <button class="reg-btn reg-btn-yes" @click="onRegConfirmYes">✅ 맞아, 진행할게</button>
                        <button class="reg-btn reg-btn-no" @click="onRegConfirmNo">❌ 아니야, 다른 인원이야</button>
                    </div>
                </div>
                <!-- 번호찾 등록 -->
                <div v-if="regPopupState === 'register'" class="reg-popup">
                    <div class="reg-popup-header-row">
                        <span>📝 번호찾 등록</span>
                        <span class="reg-close" @click="regPopupState = null">×</span>
                    </div>
                    <p class="reg-popup-desc">「{{ pendingSubmitData?.subName || '' }}」을(를)<br>번호찾으로 등록할까요?</p>
                    <div class="reg-popup-btns">
                        <button class="reg-btn reg-btn-yes" @click="onRegRegisterYes">✅ 등록하고 제출</button>
                        <button class="reg-btn reg-btn-no" @click="onRegRegisterNo">❌ 그냥 제출</button>
                    </div>
                </div>
            </div>
        </teleport>

        <DuplicateHistoryPopup
            v-if="duplicateList !== null"
            :list="duplicateList"
            @close="closeDuplicatePopup"
            @reject="rejectDuplicatePopup"
            @proceed="proceedDuplicatePopup"
        />

        <!-- teleport to="body"로 실제 표시 위치는 body 바로 아래라 여기 위치는 무관 —
             단, .screen 밖(템플릿 루트 형제)에 두면 컴포넌트가 멀티 루트가 되어
             App.vue의 <Transition mode="out-in">이 leave 완료를 못 잡고 멈춰버림
             (다른 화면으로 못 넘어가고 빈 화면만 남는 버그) -> .screen 안으로 이동. -->
        <GachaSlotOverlay
            v-if="gachaResult"
            :visible="gachaVisible"
            :inflow-name="gachaResult.inflowName"
            :tm-name="gachaResult.tmName"
            :winner="gachaResult.winner"
            :current-round="gachaResult.currentRound"
            :next-prob="gachaResult.nextProb"
            @done="onGachaDone"
        />
    </div>
</template>

<style scoped>
.hj-shed-memo {
    position: sticky;
    top: 45px;
    z-index: 100;
    margin: 0 0 0;
    padding: 8px 16px 8px;
    background: #FFFDE7;
    border-bottom: 1px solid #FFF59D;
    font-family: "Noto Sans KR", Arial, sans-serif;
}
.hj-shed-memo-title {
    font-size: 11px; font-weight: bold; color: #F57F17; margin-bottom: 4px;
}
.hj-shed-memo-text {
    font-size: 12px; color: #555; white-space: pre-wrap; word-break: break-word;
    max-height: calc(12px * 1.6 * 7);
    overflow-y: auto;
}
.hj-form-grid {
    margin-bottom: 10px;
}
.hj-guide-disabled {
    background: #f0f0f0 !important;
    color: #999 !important;
    cursor: not-allowed;
    font-style: italic;
}
.hj-field {
    margin-bottom: 15px;
}
.hj-section-header {
    margin: 20px 0 10px;
    font-size: 14px;
    font-weight: bold;
    color: #5D4037;
    border-bottom: 2px solid #EFEBE9;
    padding-bottom: 6px;
}
.hj-pair-row {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    margin-bottom: 0;
}
.hj-pair-row .hj-field {
    flex: 1;
    min-width: 0;
}
.hj-field-check {
    flex: 0 0 58px;
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 15px;
    padding-top: 2px;
}
.hj-field-check label {
    font-size: 12px;
    color: #666;
    margin-bottom: 8px;
    text-align: center;
}
.hj-field-check input[type="checkbox"] {
    width: 24px;
    height: 24px;
    cursor: pointer;
    accent-color: #4CAF50;
}
.hj-field-check input[type="checkbox"]:disabled {
    opacity: 0.3;
    cursor: not-allowed;
}

/* 번호찾 팝업 */
.reg-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.5);
    z-index: 9999;
    display: flex;
    align-items: flex-end;
    justify-content: center;
}
.reg-popup {
    background: #fff;
    width: 100%;
    max-width: 500px;
    border-radius: 24px 24px 0 0;
    padding: 24px 20px 32px;
}
.reg-popup-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 17px;
    font-weight: bold;
    margin-bottom: 14px;
}
.reg-close {
    font-size: 24px;
    color: #aaa;
    cursor: pointer;
    line-height: 1;
    padding: 0 2px;
}
.reg-popup-desc {
    font-size: 14px;
    color: #555;
    margin-bottom: 16px;
    line-height: 1.6;
}
.reg-entry-list {
    margin-bottom: 20px;
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.reg-entry-row {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
}
.reg-tag {
    padding: 4px 9px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: bold;
}
.reg-name { background: #E3F2FD; color: #1565C0; }
.reg-submitter { background: #F3E5F5; color: #6A1B9A; }
.reg-vmf { background: #EFEBE9; color: #5D4037; }
.reg-vmf.vmf-yes { background: #E8F5E9; color: #2E7D32; }
.reg-result { background: #FFF8E1; color: #F57F17; }
.reg-popup-btns {
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.reg-btn {
    padding: 14px;
    border-radius: 12px;
    font-size: 15px;
    font-weight: bold;
    border: none;
    cursor: pointer;
    font-family: 'Jua', sans-serif;
}
.reg-btn-yes { background: #4CAF50; color: white; }
.reg-btn-no { background: #E0E0E0; color: #333; }

/* 자동완성 */
.ac-wrap { position: relative; }
.ac-dropdown {
    position: absolute;
    top: 100%;
    left: 0; right: 0;
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 8px;
    z-index: 1000;
    max-height: 180px;
    overflow-y: auto;
    box-shadow: 0 4px 12px rgba(0,0,0,0.12);
}
.ac-item {
    padding: 10px 14px;
    font-size: 14px;
    cursor: pointer;
    border-bottom: 1px solid #f0f0f0;
}
.ac-item:last-child { border-bottom: none; }
.ac-item:active { background: #f5f5f5; }
.ac-input-valid { border-color: #4CAF50 !important; background: #F1F8E9 !important; }
.ac-input-invalid {
    border-color: #EF5350 !important;
    background: #FFEBEE !important;
    animation: ac-shake 0.45s ease;
}
@keyframes ac-shake {
    0%, 100% { transform: translateX(0); }
    20%       { transform: translateX(-7px); }
    40%       { transform: translateX(7px); }
    60%       { transform: translateX(-4px); }
    80%       { transform: translateX(4px); }
}

/* O/X 합자 체크 */
.hj-field-ox {
    margin-bottom: 15px;
    display: flex;
    align-items: center;
    gap: 12px;
}
.hj-field-ox label {
    font-size: 13px;
    color: #666;
    min-width: 70px;
}
.ox-group {
    display: flex;
    gap: 8px;
}
.ox-btn {
    width: 44px;
    height: 36px;
    border-radius: 8px;
    border: 2px solid #ddd;
    background: #f5f5f5;
    font-size: 15px;
    font-weight: bold;
    cursor: pointer;
    font-family: 'Jua', sans-serif;
    color: #aaa;
    transition: all 0.15s;
}
.ox-active-o { border-color: #4CAF50; background: #E8F5E9; color: #2E7D32; }
.ox-active-x { border-color: #EF5350; background: #FFEBEE; color: #B71C1C; }

@media (min-width: 1024px) {
    .hj-form-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        column-gap: 20px;
    }
    .hj-section-header,
    .hj-field-full,
    .hj-pair-row,
    .hj-field-ox {
        grid-column: span 2;
    }
}
</style>
