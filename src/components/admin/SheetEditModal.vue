<script setup>
// [2026-05-12] legacy openSheetRegister (legacy2/public/index.html L11250-11320,
//   selectPalette/loadSheetPreview/renderPreviewTable/assignCol/submitSheetConfig
//   L11578-11789) 후속 패턴 1:1 정합.
//
// 핵심 인터랙션:
//   1. "🔍 미리보기 불러오기" → /api/fetch-sheet-data 로 첫 3행 + 자동 전화번호 감지
//   2. 4개 팔레트 (📞전화/👤이름/✅보존/❌제외) 중 activePalette 선택
//   3. 미리보기 열 위 버튼 클릭 → activePalette 가 그 열에 할당 (colAssignments)
//      phone/name 은 unique (1개만), exclude 는 토글 (재클릭 해제)
//   4. 저장: phoneColIdx 필수 검증 → /api/save-sheet-config (cols flat + colAssignments)
//      V3 backend 가 cols flat 만 활용해도 colAssignments 까지 보존돼 legacy 호환.

import { ref, reactive, computed, onMounted } from 'vue'
import { useApi } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'

const props = defineProps({
    sheet: { type: Object, default: null },  // null = 신규
})
const emit = defineEmits(['close', 'saved'])
const { callApi, callApiPromise } = useApi()
const { showAppAlert, showAppConfirm } = usePopup()

const saving = ref(false)
const testing = ref(false)
const loadingPreview = ref(false)
const isEdit = computed(() => !!props.sheet?.id)

const form = reactive({
    id: props.sheet?.id || '',
    name: props.sheet?.name || '',
    team: props.sheet?.team || '',
    path: props.sheet?.path || '',
    tool: props.sheet?.tool || '',
    onOff: props.sheet?.onOff || 'online',
    spreadsheetId: props.sheet?.spreadsheetId || '',
    sheetTabName: props.sheet?.sheetTabName || '',
    startRow: props.sheet?.startRow || '2',
    isFreeForm: !!props.sheet?.isFreeForm,
    order: props.sheet?.order || 0,
    dashResultCol: props.sheet?.dashResultCol || '',
    dashStatusCol: props.sheet?.dashStatusCol || '',
    dashChatId: props.sheet?.dashChatId || '',
})

// 팔레트 상태 — legacy 정합
const PALETTES = [
    { key: 'phone',   label: '📞 전화',  color: '#1976D2', bg: '#e3f2fd' },
    { key: 'name',    label: '👤 이름',  color: '#7B1FA2', bg: '#f3e5f5' },
    { key: 'date',    label: '📅 날짜',  color: '#F57C00', bg: '#fff3e0' },
    { key: 'age',     label: '🎂 나이',  color: '#00796B', bg: '#e0f2f1' },
    { key: 'gender',  label: '⚥ 성별',  color: '#6A1B9A', bg: '#f3e5f5' },
    { key: 'addr',    label: '📍 거주지', color: '#C62828', bg: '#ffebee' },
    { key: 'keep',    label: '✅ 보존',  color: '#388E3C', bg: '#ffffff' },
    { key: 'exclude', label: '❌ 제외',  color: '#D32F2F', bg: '#ffebee' },
]
const activePalette = ref('keep')
const previewRows = ref([])           // [][] — fetch-sheet-data 응답
const colAssignments = reactive({})   // { colIdx (0-based) : palette key }

// 단일값 팔레트 키 목록 (같은 key는 1열만 허용)
const UNIQUE_PALETTES = new Set(['phone', 'name', 'date', 'age', 'gender', 'addr'])

// 편집 모드 진입 시 기존 colAssignments 복원 (legacy 의 conf.colAssignments).
// V3 SHEET_CONFIGS.COLUMN_MAPPING.colAssignments 가 있으면 사용,
// 없으면 cols.* 를 idx 로 변환 (legacy migration 호환).
onMounted(() => {
    const ca = props.sheet?.colAssignments
    if (ca && typeof ca === 'object') {
        Object.entries(ca).forEach(([k, v]) => { colAssignments[k] = v })
    } else {
        const cols = props.sheet?.cols || {}
        const fieldMap = { phone: 'phone', name: 'name', date: 'date', age: 'age', gender: 'gender', addr: 'addr' }
        for (const [colKey, paletteKey] of Object.entries(fieldMap)) {
            if (cols[colKey]) colAssignments[letterToIdx(cols[colKey])] = paletteKey
        }
    }
})

function pickPalette(key) { activePalette.value = key }

function assignCol(idx) {
    const cur = colAssignments[idx]
    const a = activePalette.value

    if (UNIQUE_PALETTES.has(a)) {
        // 단일값 팔레트 — 기존 같은 key 제거 후 신규 배정
        Object.keys(colAssignments).forEach(k => {
            if (colAssignments[k] === a) delete colAssignments[k]
        })
    } else if (a === 'exclude' && cur === 'exclude') {
        // 토글: 다시 클릭 = 해제
        delete colAssignments[idx]
        return
    }
    colAssignments[idx] = a
}

// 전화번호 자동 감지 — legacy normalizePhoneNumber 단순 정합.
// "010-1234-5678" / "010 1234 5678" / "01012345678" 등 9~11 digit 한국형.
function isPhoneLike(v) {
    if (!v) return false
    const digits = String(v).replace(/\D/g, '')
    if (digits.length < 9 || digits.length > 11) return false
    return digits.startsWith('0')
}

async function loadPreview() {
    if (!form.spreadsheetId) return showAppAlert('스프레드시트 ID/URL 을 먼저 입력해줘')
    loadingPreview.value = true
    try {
        const tab = form.sheetTabName.trim()
        const startRow = parseInt(form.startRow) || 2
        const range = tab
            ? `'${tab}'!A${startRow}:Z${startRow + 2}`
            : `A${startRow}:Z${startRow + 2}`
        const r = await callApiPromise('/api/fetch-sheet-data', {
            spreadsheetId: form.spreadsheetId, range,
        })
        if (!r?.success || !r.values?.length) {
            showAppAlert('데이터를 불러오지 못했어. URL/탭이름을 확인해봐.')
            previewRows.value = []
            return
        }
        previewRows.value = r.values
        // 자동 phone 감지 — 기존 colAssignments 가 비어있을 때만
        if (Object.keys(colAssignments).length === 0) {
            const row0 = r.values[0] || []
            row0.forEach((cell, idx) => {
                if (isPhoneLike(cell)) colAssignments[idx] = 'phone'
            })
        }
    } catch (e) {
        showAppAlert('미리보기 실패: ' + e.message)
    } finally {
        loadingPreview.value = false
    }
}

const maxCols = computed(() =>
    previewRows.value.length
        ? Math.max(...previewRows.value.map(r => r.length))
        : 0
)
const previewBody = computed(() => previewRows.value.slice(0, 3))

function paletteOf(key) { return PALETTES.find(p => p.key === key) }
function bgOf(idx) {
    const p = paletteOf(colAssignments[idx])
    return p ? p.bg : '#fff'
}
function btnColorOf(idx) {
    const p = paletteOf(colAssignments[idx])
    return p ? p.color : '#9E9E9E'
}
function iconOf(idx) {
    const k = colAssignments[idx]
    return { phone: '📞', name: '👤', date: '📅', age: '🎂', gender: '⚥', addr: '📍', keep: '✅', exclude: '❌' }[k] || '✅'
}
function idxToLetter(i) {
    let s = '', n = i
    while (n >= 0) {
        s = String.fromCharCode(65 + (n % 26)) + s
        n = Math.floor(n / 26) - 1
    }
    return s
}
function letterToIdx(letter) {
    let result = 0
    for (let i = 0; i < letter.length; i++) {
        result = result * 26 + (letter.charCodeAt(i) - 64)
    }
    return result - 1
}

// URL 자동 파싱
function onSpreadsheetIdInput(e) {
    const v = e.target.value.trim()
    const m = v.match(/\/d\/([a-zA-Z0-9_-]+)/)
    form.spreadsheetId = m ? m[1] : v
}

async function testTabAccess() {
    if (!form.spreadsheetId) return showAppAlert('스프레드시트 ID/URL 을 먼저 입력해줘')
    testing.value = true
    try {
        const r = await callApiPromise('/api/test-sheet-access', {
            spreadsheetId: form.spreadsheetId,
            sheetTabName: form.sheetTabName || '',
        })
        if (r.ok) {
            showAppAlert(`✅ 접근 성공\n탭 ${r.availableTabs.length}개: ${r.availableTabs.slice(0, 8).join(', ')}${r.availableTabs.length > 8 ? '…' : ''}`)
        } else {
            const tabs = (r.availableTabs || []).slice(0, 20).join(', ')
            showAppAlert(`❌ ${r.code}\n${r.message}${tabs ? `\n\n사용 가능 탭: ${tabs}` : ''}`)
        }
    } finally {
        testing.value = false
    }
}

// 저장 — legacy submitSheetConfig 정합.
//   phoneColIdx 필수, colAssignments → cols flat 자동 변환 (V3 backend 호환).
async function save() {
    if (saving.value) return
    if (!form.name.trim()) return showAppAlert('시트 제목을 입력해줘')
    if (!form.team.trim()) return showAppAlert('담당 지역을 입력해줘')
    if (!form.path.trim()) return showAppAlert('경로를 입력해줘')
    if (!form.spreadsheetId.trim()) return showAppAlert('스프레드시트 ID 가 비어있어')
    if (!form.startRow) return showAppAlert('시작 행을 입력해줘')

    // 팔레트 결과 수집
    const entries = Object.entries(colAssignments)
    const phoneEntry = entries.find(([, v]) => v === 'phone')
    const keepColIdxs = entries
        .filter(([, v]) => v === 'keep' || UNIQUE_PALETTES.has(v))
        .map(([k]) => parseInt(k))

    if (!phoneEntry) {
        return showAppAlert('📞 전화 팔레트로 전화번호 열을 지정해줘! (미리보기 먼저 불러오기)')
    }

    // 단일값 팔레트 키 → cols 필드명 매핑 (sheetSync.js 의 cols.* 와 일치)
    const paletteToColKey = { phone: 'phone', name: 'name', date: 'date', age: 'age', gender: 'gender', addr: 'addr' }
    const cols = {}
    for (const [idxStr, paletteKey] of entries) {
        const colKey = paletteToColKey[paletteKey]
        if (colKey) cols[colKey] = idxToLetter(parseInt(idxStr))
    }

    const phoneColIdx = parseInt(phoneEntry[0])
    const nameEntry = entries.find(([, v]) => v === 'name')
    const nameColIdx = nameEntry ? parseInt(nameEntry[0]) : undefined

    const payload = {
        id: form.id || undefined,
        name: form.name.trim(),
        team: form.team.trim(),
        path: form.path.trim(),
        tool: form.tool.trim(),
        onOff: form.onOff,
        spreadsheetId: form.spreadsheetId.trim(),
        sheetTabName: form.sheetTabName.trim(),
        startRow: String(form.startRow).trim() || '2',
        isFreeForm: !!form.isFreeForm,
        cols,
        order: Number(form.order) || 0,
        dashResultCol: form.dashResultCol.trim().toUpperCase(),
        dashStatusCol: form.dashStatusCol.trim().toUpperCase(),
        dashChatId: form.dashChatId.trim(),
        // legacy 호환 필드 — V3 backend 가 fullDoc 으로 JSON 보관.
        phoneColIdx,
        nameColIdx,
        keepColIdxs,
        colAssignments: { ...colAssignments },
    }

    saving.value = true
    // 사전 시트 접근 검증 (legacy 와 동일 — 저장 전 권한/탭 확인)
    try {
        const accessRes = await callApiPromise('/api/test-sheet-access', {
            spreadsheetId: payload.spreadsheetId,
            sheetTabName: payload.sheetTabName,
        })
        if (!accessRes?.ok) {
            showAppAlert(accessRes?.message || '시트 접근 검증 실패')
            return
        }
        const r = await callApiPromise('/api/save-sheet-config', payload)
        if (r?.success) {
            showAppAlert(r.message || '저장 완료')
            emit('saved')
        } else {
            showAppAlert(r?.message || '저장 실패')
        }
    } catch (e) {
        showAppAlert('저장 실패: ' + e.message)
    } finally {
        saving.value = false
    }
}

function deleteSelf() {
    if (!form.id) return
    showAppConfirm(`"${form.name}" 시트 설정을 삭제할까?`, (yes) => {
        if (!yes) return
        callApi('/api/delete-sheet-config', { id: form.id }, (r) => {
            if (r.success) {
                showAppAlert(r.message || '삭제 완료')
                emit('saved')
            } else {
                showAppAlert(r.message || '삭제 실패')
            }
        })
    })
}
</script>

<template>
    <div class="modal-overlay" @click.self="emit('close')">
        <div class="admin-modal-card" style="max-width: 600px;">
            <div class="modal-header-sticky">
                <div class="modal-title">📝 시트 {{ isEdit ? '수정' : '등록' }}</div>
                <span class="modal-close-sticky" @click="emit('close')">×</span>
            </div>

            <div class="modal-content-scroll">
                <!-- 기본 정보 -->
                <div class="section-title">기본 정보</div>
                <input type="text" v-model="form.name" class="input-card" placeholder="시트 제목 (예: 인스타 1지역)">
                <div class="row">
                    <input type="text" v-model="form.team" class="input-card" placeholder="담당 지역 (예: 1지역)">
                    <input type="text" v-model="form.path" class="input-card" placeholder="경로 (예: 인스타광고)">
                </div>
                <input type="text" v-model="form.tool" class="input-card" placeholder="도구 (예: MBTI테스트)">

                <div class="onoff-row">
                    <button class="onoff-btn"
                        :class="{ active: form.onOff === 'online' }"
                        style="--btn-bg:#4CAF50"
                        @click="form.onOff = 'online'">온라인</button>
                    <button class="onoff-btn"
                        :class="{ active: form.onOff === 'offline' }"
                        style="--btn-bg:#F44336"
                        @click="form.onOff = 'offline'">오프라인</button>
                </div>

                <!-- 시트 연결 -->
                <div class="section-title">시트 연결 설정</div>
                <input type="text" :value="form.spreadsheetId" class="input-card"
                    placeholder="구글 시트 URL 또는 ID 붙여넣기"
                    @input="onSpreadsheetIdInput">
                <div class="row">
                    <input type="text" v-model="form.sheetTabName" class="input-card" placeholder="시트(탭) 이름 (예: 시트1)">
                    <input type="number" inputmode="numeric" pattern="[0-9]*" v-model="form.startRow" class="input-card" placeholder="시작 행 (예: 2)">
                </div>
                <button class="test-btn" :disabled="testing" @click="testTabAccess">
                    {{ testing ? '확인 중…' : '🔍 시트 접근 확인' }}
                </button>

                <!-- 자유형식 -->
                <div class="freeform-row">
                    <label class="freeform-label">
                        <input type="checkbox" v-model="form.isFreeForm">
                        <span class="freeform-tag" :class="{ active: form.isFreeForm }">
                            🎨 자유형식 (전화번호/날짜 검증 skip)
                        </span>
                    </label>
                </div>

                <!-- 섭외 명단 대시보드 설정 -->
                <div class="section-title">📋 섭외 명단 대시보드</div>
                <div class="row">
                    <input v-model="form.dashResultCol" class="input-card" placeholder="결과 컬럼 (예: A)" maxlength="3" style="flex:1">
                    <input v-model="form.dashStatusCol" class="input-card" placeholder="상태 컬럼 (선택, 예: B)" maxlength="3" style="flex:1">
                </div>
                <input v-model="form.dashChatId" class="input-card" placeholder="발송 채팅방 ID (예: -100123456789)">

                <!-- 열 설정 (팔레트 + 미리보기) -->
                <div class="section-title">열 설정</div>
                <div class="palette-row">
                    <button v-for="p in PALETTES" :key="p.key"
                        class="palette-btn"
                        :class="{ active: activePalette === p.key }"
                        :style="{ '--c': p.color }"
                        @click="pickPalette(p.key)">
                        {{ p.label }}
                    </button>
                </div>
                <button class="preview-btn" :disabled="loadingPreview" @click="loadPreview">
                    {{ loadingPreview ? '불러오는 중…' : '🔍 미리보기 불러오기' }}
                </button>

                <div class="preview-area">
                    <div v-if="!previewRows.length && Object.keys(colAssignments).length"
                        class="preview-hint">
                        저장된 설정이 있어. <b>📞</b> 자리: 열 {{ Object.entries(colAssignments).find(([,v])=>v==='phone')?.[0] != null ? idxToLetter(parseInt(Object.entries(colAssignments).find(([,v])=>v==='phone')[0])) : '?' }} · <b>👤</b>: 열 {{ Object.entries(colAssignments).find(([,v])=>v==='name')?.[0] != null ? idxToLetter(parseInt(Object.entries(colAssignments).find(([,v])=>v==='name')[0])) : '?' }}. 미리보기를 다시 불러오면 확인할 수 있어.
                    </div>
                    <div v-if="previewRows.length" class="preview-wrap">
                        <table class="preview-table">
                            <thead>
                                <tr>
                                    <th v-for="i in maxCols" :key="i">
                                        <button class="col-btn"
                                            :style="{ background: btnColorOf(i-1) }"
                                            :title="`열 ${idxToLetter(i-1)} — ${colAssignments[i-1] || '미지정'}`"
                                            @click="assignCol(i-1)">
                                            {{ iconOf(i-1) }}
                                        </button>
                                        <div class="col-letter">{{ idxToLetter(i-1) }}</div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(row, ri) in previewBody" :key="ri">
                                    <td v-for="i in maxCols" :key="i"
                                        :style="{ background: bgOf(i-1) }"
                                        :title="String(row[i-1] || '')">
                                        {{ String(row[i-1] || '') }}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                        <div class="preview-help">
                            * 열 버튼을 탭하면 <b>{{ paletteOf(activePalette)?.label }}</b> 가 적용돼.
                            ❌ 는 다시 탭하면 해제.
                        </div>
                    </div>
                </div>

                <!-- 버튼 -->
                <div class="btn-group">
                    <button class="btn-pos" :disabled="saving" @click="save">
                        {{ saving ? '저장 중…' : isEdit ? '수정하기' : '등록하기' }}
                    </button>
                    <button v-if="isEdit" class="btn-neg btn-delete" @click="deleteSelf">삭제</button>
                    <button class="btn-neg" @click="emit('close')">취소</button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 10px;
}

.section-title {
    font-size: 12px;
    font-weight: bold;
    color: #5D4037;
    margin: 16px 0 6px;
}

.row { display: flex; gap: 8px; }
.row .input-card { flex: 1; }

.input-card {
    width: 100%;
    padding: 10px 12px;
    margin-bottom: 8px;
    border: 1px solid #ddd;
    border-radius: 8px;
    background: #fff;
    font-size: 13px;
    font-family: 'Jua', 'Noto Sans KR', sans-serif;
    color: #333;
    box-sizing: border-box;
}
.input-card:focus { outline: none; border-color: #1976D2; }

.onoff-row { display: flex; gap: 8px; margin: 8px 0 4px; }
.onoff-btn {
    flex: 1;
    padding: 10px;
    border: 2px solid var(--btn-bg);
    border-radius: 8px;
    background: #fff;
    color: var(--btn-bg);
    font-family: 'Jua';
    font-size: 13px;
    cursor: pointer;
}
.onoff-btn.active { background: var(--btn-bg); color: #fff; }

.test-btn {
    width: 100%;
    padding: 8px;
    background: #2196F3;
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 12px;
    font-family: 'Jua';
    cursor: pointer;
    margin-bottom: 4px;
}
.test-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.test-btn:hover:not(:disabled) { background: #1976D2; }

.freeform-row { margin: 14px 0 4px; }
.freeform-label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
}
.freeform-tag {
    font-size: 12px;
    color: #888;
    padding: 4px 8px;
    border-radius: 6px;
    background: #ECEFF1;
}
.freeform-tag.active { background: #FFF3E0; color: #E65100; font-weight: bold; }

.palette-row {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 8px;
}
.palette-btn {
    flex: 1;
    min-width: 70px;
    padding: 8px 10px;
    border: 2px solid var(--c);
    border-radius: 8px;
    background: #fff;
    color: var(--c);
    font-size: 12px;
    font-family: 'Jua';
    cursor: pointer;
    opacity: 0.55;
    transition: opacity 0.15s, font-weight 0.15s;
}
.palette-btn.active {
    opacity: 1;
    font-weight: bold;
    background: var(--c);
    color: #fff;
}

.preview-btn {
    width: 100%;
    padding: 8px;
    background: #2196F3;
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 12px;
    font-family: 'Jua';
    cursor: pointer;
    margin-bottom: 10px;
}
.preview-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.preview-area { font-size: 11px; }
.preview-hint {
    background: #FFFDE7;
    padding: 8px 10px;
    border-radius: 6px;
    color: #666;
}
.preview-wrap { overflow-x: auto; margin-top: 4px; }
.preview-table {
    border-collapse: collapse;
    font-size: 11px;
}
.preview-table th {
    border: 1px solid #ddd;
    padding: 4px;
    background: #f5f5f5;
    min-width: 70px;
    text-align: center;
}
.preview-table td {
    border: 1px solid #ddd;
    padding: 4px 6px;
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.col-btn {
    background: #9E9E9E;
    color: #fff;
    border: none;
    border-radius: 4px;
    padding: 2px 8px;
    font-size: 11px;
    cursor: pointer;
    line-height: 1.2;
    min-width: 32px;
}
.col-btn:hover { opacity: 0.85; }
.col-letter {
    font-size: 9px;
    color: #999;
    text-align: center;
    margin-top: 1px;
}
.preview-help {
    font-size: 10px;
    color: #888;
    margin-top: 4px;
}

.btn-group {
    display: flex;
    gap: 8px;
    margin-top: 20px;
    flex-wrap: wrap;
}
.btn-group .btn-pos { flex: 2; }
.btn-group .btn-neg { flex: 1; }
.btn-delete {
    background: #F44336 !important;
    color: #fff !important;
}

@media (max-width: 480px) {
    .row { flex-direction: column; gap: 0; }
    .palette-btn { font-size: 11px; min-width: 60px; padding: 6px 8px; }
}
</style>
