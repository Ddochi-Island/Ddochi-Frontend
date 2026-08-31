<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useApi } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'
import { useAuthStore } from '@/stores/auth'
import WeeklyBlockEditor from './WeeklyBlockEditor.vue'
import { ACTIVITY_HOUR_START, ACTIVITY_HOUR_END, dayLabels, dayDisplayOrder } from '@/constants'

// [2026-04-22] index2.html openWeeklyTemplate / doOpenWeeklyTemplate /
// renderWeeklyGrid / renderWeeklyPalette / saveWeeklyTemplateAll (L12369-12974) 이식.
// 주간 일정 템플릿 — 개인/팀/지역 scope + 상위 scope 일정 병합 경고 + 줌

const props = defineProps({
    scope: { type: String, required: true },   // 'personal' | 'team' | 'region'
    team: { type: String, default: '' }        // 편집 대상 팀명 (scope='team' 일 때 사용)
})
const emit = defineEmits(['close'])

const { callApi, callApiPromise } = useApi()
const { showAppAlert, showToast, showPopup } = usePopup()
const auth = useAuthStore()

// 시간 슬롯 (30분 단위) — constants/index.js ACTIVITY_HOUR_START..END 단일 소스.
const SLOTS = (() => {
    const arr = []
    for (let h = ACTIVITY_HOUR_START; h <= ACTIVITY_HOUR_END; h++) {
        for (let m = 0; m < 60; m += 30) arr.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
    return arr
})()
const DAY_NAMES = dayLabels

const SCOPE_META = {
    personal: { icon: '📅', label: '내', color: '#1976D2' },
    team:     { icon: '📆', label: '팀', color: '#388E3C' },
    region:   { icon: '🗓️', label: '지역', color: '#D32F2F' }
}

// -------------- state --------------
const loading = ref(true)
const saving = ref(false)
// weeklyGridData[dow][time] = { name, color, type, isActivity, activityCategory, memo }
const weeklyGridData = reactive({ 0: {}, 1: {}, 2: {}, 3: {}, 4: {}, 5: {}, 6: {} })
// weeklyParentData[dow][time] = { name, color, scope }
const weeklyParentData = reactive({ 0: {}, 1: {}, 2: {}, 3: {}, 4: {}, 5: {}, 6: {} })
const categories = ref([])
const currentCategory = ref(null) // null = 지우개 / { name, color, type, isActivity } = 카테고리
const activePaletteTab = ref('eraser') // 'eraser' | 'custom' | <type>
const zoom = ref(1.0)
const scrollWrap = ref(null)
const gridContainer = ref(null)

// 블록 에디터 상태
const editorState = ref(null) // null | { dow, block, range }

const scopeMeta = computed(() => SCOPE_META[props.scope] || SCOPE_META.personal)
const scopeLabel = computed(() => {
    const base = scopeMeta.value.label
    if (props.scope === 'team' && props.team && props.team !== auth.currentUserTeam) return `${props.team}팀 ${base}`
    return base
})
const infoText = computed(() => {
    if (props.scope === 'personal') return '🔴 빨강 = 지역 일정 / 🟢 초록 = 팀 일정 (상위)<br>겹치는 셀에 ⚠️ 표시됨'
    if (props.scope === 'team') return '🔴 빨강 = 지역 일정 (상위)<br>겹치는 셀에 ⚠️ 표시됨'
    return '지역 일정은 모든 팀/개인의 최상위 일정이야'
})

const paletteTypes = computed(() => [...new Set(categories.value.map(c => c.type || '기타'))])
const filteredPaletteItems = computed(() => {
    if (activePaletteTab.value === 'eraser') return []
    return categories.value.filter(c => (c.type || '기타') === activePaletteTab.value)
})
const isCustomSelected = computed(() => currentCategory.value && currentCategory.value.type === '직접입력')

const canSetUndefined = computed(() => auth.isAdmin)

// -------------- 그리드 계산 (병합 + 충돌) --------------
function cleanEmoji(s) {
    return (s || '').replace(/\p{Emoji_Presentation}|\p{Extended_Pictographic}|️|‍/gu, '').trim()
}

function columnCells(dow) {
    // 연속된 동일 name 을 병합해서 { startIdx, span, kind, block, hasConflict } 배열 반환
    const cells = []
    let i = 0
    while (i < SLOTS.length) {
        const t = SLOTS[i]
        const blk = weeklyGridData[dow][t]
        const parent = weeklyParentData[dow][t]
        if (blk) {
            let runEnd = i + 1
            while (runEnd < SLOTS.length) {
                const nxt = weeklyGridData[dow][SLOTS[runEnd]]
                if (!nxt || nxt.name !== blk.name) break
                runEnd++
            }
            let hasConflict = false
            for (let k = i; k < runEnd; k++) {
                if (weeklyParentData[dow][SLOTS[k]]) { hasConflict = true; break }
            }
            cells.push({ startIdx: i, span: runEnd - i, kind: 'own', block: blk, hasConflict })
            i = runEnd
        } else if (parent) {
            let runEnd = i + 1
            while (runEnd < SLOTS.length) {
                const nxtP = weeklyParentData[dow][SLOTS[runEnd]]
                const nxtB = weeklyGridData[dow][SLOTS[runEnd]]
                if (nxtB || !nxtP || nxtP.name !== parent.name) break
                runEnd++
            }
            cells.push({ startIdx: i, span: runEnd - i, kind: 'parent', block: parent })
            i = runEnd
        } else {
            cells.push({ startIdx: i, span: 1, kind: 'empty' })
            i++
        }
    }
    return cells
}

// 표시 순서는 월요일 시작 (dayDisplayOrder = [1,2,3,4,5,6,0]). 데이터 dow 는 0=일~6=토 유지.
const gridCells = computed(() => {
    const out = []
    for (const dow of dayDisplayOrder) out.push({ dow, cells: columnCells(dow) })
    return out
})

// 활성 탭이 사라진 타입(카테고리 삭제/로드 실패)이면 기본 탭으로 복귀
function ensureValidTab() {
    if (activePaletteTab.value === 'eraser') return
    if (!paletteTypes.value.includes(activePaletteTab.value)) {
        activePaletteTab.value = paletteTypes.value[0] || 'eraser'
    }
}

// -------------- 로드 --------------
async function loadAll() {
    loading.value = true
    try {
        const targetTeam = auth.isAdmin ? '공통' : (props.team || auth.currentUserTeam || '미배정')
        const teamForQuery = props.team || auth.currentUserTeam

        const promises = [
            callApiPromise('/api/weekly-template/get', { sabun: auth.currentSabun, team: teamForQuery, scope: props.scope }),
            callApiPromise('/api/manage-ministry-categories', { action: 'get', team: targetTeam })
        ]
        if (props.scope === 'personal') {
            promises.push(callApiPromise('/api/weekly-template/get', { sabun: auth.currentSabun, team: teamForQuery, scope: 'region' }))
            promises.push(callApiPromise('/api/weekly-template/get', { sabun: auth.currentSabun, team: teamForQuery, scope: 'team' }))
        } else if (props.scope === 'team') {
            promises.push(callApiPromise('/api/weekly-template/get', { sabun: auth.currentSabun, team: teamForQuery, scope: 'region' }))
        }

        const results = await Promise.all(promises)
        const tplRes = results[0]
        const catRes = results[1]
        const parentResults = results.slice(2)

        // 본인 템플릿
        for (let d = 0; d < 7; d++) weeklyGridData[d] = {}
        const tpl = (tplRes && tplRes.templates) || {}
        for (let dow = 0; dow < 7; dow++) {
            (tpl[dow] || []).forEach(p => {
                weeklyGridData[dow][p.time] = {
                    name: p.name,
                    color: p.color,
                    type: p.type,
                    isActivity: p.isActivity,
                    activityCategory: p.activityCategory || null,
                    memo: p.memo || ''
                }
            })
        }

        // 상위 일정
        for (let d = 0; d < 7; d++) weeklyParentData[d] = {}
        parentResults.forEach(pr => {
            if (!pr || !pr.templates) return
            const pscope = pr.scope || 'region'
            for (let dow = 0; dow < 7; dow++) {
                (pr.templates[dow] || []).forEach(p => {
                    if (!weeklyParentData[dow][p.time]) {
                        weeklyParentData[dow][p.time] = { ...p, scope: pscope }
                    }
                })
            }
        })

        categories.value = (catRes && catRes.success) ? (catRes.list || []) : []
        currentCategory.value = null
        // 카테고리가 있으면 첫 번째 타입 탭을 기본 활성화 (없으면 지우개)
        const types = [...new Set(categories.value.map(c => c.type || '기타'))]
        activePaletteTab.value = types[0] || 'eraser'
        zoom.value = 1.0
    } catch (err) {
        showAppAlert('주간 템플릿 로드 실패 😢')
        console.error(err)
    } finally {
        loading.value = false
        nextTick(applyZoom)
    }
}

// -------------- 줌 --------------
function applyZoom() {
    const con = gridContainer.value
    const wrap = scrollWrap.value
    if (!con || !wrap) return
    con.style.transform = `scale(${zoom.value})`
    const realHeight = con.scrollHeight * zoom.value
    wrap.style.height = Math.min(realHeight + 12, window.innerHeight * 0.5) + 'px'
}
function adjustZoom(delta) {
    zoom.value = Math.max(1.0, Math.min(2.5, +(zoom.value + delta).toFixed(2)))
    nextTick(applyZoom)
}
function resetZoom() { zoom.value = 1.0; nextTick(applyZoom) }

// -------------- 핀치 줌 --------------
let pinchDist = 0
let pinchStartZoom = 1.0
function onTouchStart(e) {
    if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        pinchDist = Math.sqrt(dx * dx + dy * dy)
        pinchStartZoom = zoom.value
    }
}
function onTouchMove(e) {
    if (e.touches.length === 2 && pinchDist > 0) {
        e.preventDefault()
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        const dist = Math.sqrt(dx * dx + dy * dy)
        zoom.value = Math.max(1.0, Math.min(2.5, pinchStartZoom * (dist / pinchDist)))
        applyZoom()
    }
}
function onTouchEnd() { pinchDist = 0 }

// -------------- 셀 클릭 --------------
function findRange(dow, slotIdx) {
    const blk = weeklyGridData[dow][SLOTS[slotIdx]]
    if (!blk) return null
    let l = slotIdx, r = slotIdx
    while (l > 0) {
        const prev = weeklyGridData[dow][SLOTS[l - 1]]
        if (!prev || prev.name !== blk.name) break
        l--
    }
    while (r < SLOTS.length - 1) {
        const nxt = weeklyGridData[dow][SLOTS[r + 1]]
        if (!nxt || nxt.name !== blk.name) break
        r++
    }
    return { l, r, blk }
}

function onCellClick(dow, slotIdx) {
    if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.impactOccurred('light')
    }
    const range = findRange(dow, slotIdx)

    // 지우개 모드
    if (currentCategory.value === null) {
        if (range) {
            for (let i = range.l; i <= range.r; i++) delete weeklyGridData[dow][SLOTS[i]]
        }
        return
    }

    // 빈 셀 + 팔레트 선택 → 즉시 채움
    if (!range) {
        weeklyGridData[dow][SLOTS[slotIdx]] = {
            name: currentCategory.value.name,
            color: currentCategory.value.color,
            type: currentCategory.value.type,
            isActivity: currentCategory.value.isActivity,
            activityCategory: currentCategory.value.activityCategory || null,
            memo: ''
        }
        const parent = weeklyParentData[dow][SLOTS[slotIdx]]
        if (parent) showToast(`⚠️ ${parent.scope === 'region' ? '지역' : '팀'} 일정과 겹쳐!`)
        return
    }

    // 기존 블록 → 에디터 열기
    editorState.value = { dow, block: { ...range.blk }, range: { l: range.l, r: range.r } }
}

// -------------- 에디터 콜백 --------------
function onEditorSave(payload) {
    if (!editorState.value) return
    const { dow, block, range } = editorState.value
    // 기존 범위 제거
    for (let i = range.l; i <= range.r; i++) delete weeklyGridData[dow][SLOTS[i]]
    // 새 범위 채우기
    for (let i = payload.startIdx; i <= payload.endIdx; i++) {
        weeklyGridData[dow][SLOTS[i]] = {
            name: block.name,
            color: block.color,
            type: block.type,
            isActivity: payload.isActivity,
            activityCategory: payload.activityCategory,
            memo: payload.memo
        }
    }
    editorState.value = null
}
function onEditorDelete() {
    if (!editorState.value) return
    const { dow, range } = editorState.value
    for (let i = range.l; i <= range.r; i++) delete weeklyGridData[dow][SLOTS[i]]
    editorState.value = null
}
function onEditorClose() { editorState.value = null }

// -------------- 팔레트 --------------
function selectPaletteTab(type) { activePaletteTab.value = type }
function selectCategory(cat) { currentCategory.value = cat }
function selectCustomCategory() {
    showPopup('text', '직접 입력', '직접 입력할 사역 이름을 적어줘! (예: 회식, 시험)', (res) => {
        if (!res || res.text === undefined) return
        const cleanName = String(res.text).trim().slice(0, 20)
        if (!cleanName) return
        currentCategory.value = {
            name: cleanName,
            color: '#5D4037',
            type: '직접입력',
            isActivity: false
        }
    })
}

// -------------- 저장 --------------
function saveAll() {
    if (saving.value) return
    saving.value = true
    const templates = {}
    for (let dow = 0; dow < 7; dow++) {
        templates[dow] = []
        Object.keys(weeklyGridData[dow]).forEach(t => {
            const b = weeklyGridData[dow][t]
            templates[dow].push({
                time: t,
                name: b.name,
                color: b.color,
                type: b.type,
                isActivity: b.isActivity,
                activityCategory: b.activityCategory || null,
                memo: b.memo || ''
            })
        })
    }
    callApi('/api/weekly-template/save-all', {
        sabun: auth.currentSabun,
        team: props.team || auth.currentUserTeam,
        scope: props.scope,
        templates
    }, (r) => {
        saving.value = false
        showAppAlert((r && r.message) || (r && r.success ? '저장 완료!' : '저장 실패 ㅠ'))
    })
}

onMounted(loadAll)
onBeforeUnmount(() => {})
</script>

<template>
    <Teleport to="body">
        <div class="modal-overlay" @click.self="emit('close')">
            <div class="admin-modal-card" style="max-width:560px;">
                <div class="modal-header-sticky">
                    <div class="modal-title" :style="{ margin:0, textAlign:'center', width:'100%', color: scopeMeta.color }">
                        {{ scopeMeta.icon }} {{ scopeLabel }} 주간 일정 템플릿
                    </div>
                    <span class="modal-close-sticky" style="position:absolute; right:20px;" @click="emit('close')">×</span>
                </div>

                <div class="modal-content-scroll no-scrollbar" style="padding:12px; background:#f9f9f9; text-align:left; display:flex; flex-direction:column;">
                    <div v-if="loading" style="text-align:center; padding:30px;">주간 템플릿 불러오는 중... ⏳</div>

                    <template v-else>
                        <div style="font-size:11px; color:#666; margin-bottom:10px; line-height:1.4; text-align:center;" v-html="infoText"></div>

                        <div ref="scrollWrap" style="overflow:auto; -webkit-overflow-scrolling:touch; background:#fff; border-radius:8px; padding:6px; border:1px solid #eee;"
                            @touchstart.passive="onTouchStart"
                            @touchmove="onTouchMove"
                            @touchend.passive="onTouchEnd">
                            <div ref="gridContainer" style="transform-origin:top left; width:100%;">
                                <div class="weekly-grid" :style="{ gridTemplateRows: `auto repeat(${SLOTS.length}, 18px)` }">
                                    <!-- 헤더 (월~일 표시 순서, 데이터 dow 는 0=일~6=토 보존) -->
                                    <div class="weekly-grid-header" :style="{ gridRow: 1, gridColumn: 1 }"></div>
                                    <div v-for="(dow, i) in dayDisplayOrder" :key="dow"
                                        class="weekly-grid-header"
                                        :class="{ sun: dow === 0, sat: dow === 6 }"
                                        :style="{ gridRow: 1, gridColumn: i + 2 }">{{ DAY_NAMES[dow] }}</div>

                                    <!-- 시간 라벨 -->
                                    <div v-for="(t, idx) in SLOTS" :key="'t' + idx"
                                        class="weekly-grid-time"
                                        :style="{ gridRow: idx + 2, gridColumn: 1 }">
                                        {{ t.endsWith(':00') ? t.slice(0, 2) : '' }}
                                    </div>

                                    <!-- 요일별 셀 (병합 블록). gridColumn 은 표시 순서 인덱스 (colIdx) +2.
                                         데이터 dow (col.dow) 는 클릭 핸들러 / 키 식별에만 사용. -->
                                    <template v-for="(col, colIdx) in gridCells" :key="'col' + col.dow">
                                        <template v-for="cell in col.cells" :key="`${col.dow}-${cell.startIdx}`">
                                            <!-- 본인 블록 -->
                                            <div v-if="cell.kind === 'own'"
                                                class="weekly-grid-cell filled"
                                                :style="{
                                                    gridRow: `${cell.startIdx + 2} / span ${cell.span}`,
                                                    gridColumn: colIdx + 2,
                                                    background: cell.block.color,
                                                    boxShadow: cell.hasConflict ? 'inset 0 0 0 2px #FF0000' : 'none'
                                                }"
                                                @click="onCellClick(col.dow, cell.startIdx)">
                                                {{ cleanEmoji(cell.block.name) }}
                                                <span v-if="cell.hasConflict"
                                                    style="position:absolute; top:1px; right:2px; font-size:9px;">⚠️</span>
                                            </div>
                                            <!-- 상위 일정 (read-only overlay) -->
                                            <div v-else-if="cell.kind === 'parent'"
                                                class="weekly-grid-cell"
                                                :style="{
                                                    gridRow: `${cell.startIdx + 2} / span ${cell.span}`,
                                                    gridColumn: colIdx + 2,
                                                    background: cell.block.scope === 'region' ? '#FFCDD2' : '#C8E6C9',
                                                    color: cell.block.scope === 'region' ? '#C62828' : '#2E7D32',
                                                    fontSize: '8px',
                                                    fontWeight: 'bold',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    textAlign: 'center',
                                                    lineHeight: 1,
                                                    overflow: 'hidden'
                                                }"
                                                :title="`${cell.block.scope === 'region' ? '지역' : '팀'} 일정: ${cleanEmoji(cell.block.name)}`"
                                                @click="onCellClick(col.dow, cell.startIdx)">
                                                {{ cleanEmoji(cell.block.name) }}
                                            </div>
                                            <!-- 빈 셀 -->
                                            <div v-else
                                                class="weekly-grid-cell"
                                                :style="{ gridRow: cell.startIdx + 2, gridColumn: colIdx + 2 }"
                                                @click="onCellClick(col.dow, cell.startIdx)"></div>
                                        </template>
                                    </template>
                                </div>
                            </div>
                        </div>

                        <div style="display:flex; gap:6px; margin-top:8px; align-items:center;">
                            <button class="btn-sm" style="background:#EFEBE9; color:#5D4037; padding:6px 10px; border-radius:6px;" @click="adjustZoom(-0.1)">🔍-</button>
                            <div style="flex:1; text-align:center; font-size:11px; color:#666;">{{ Math.round(zoom * 100) }}%</div>
                            <button class="btn-sm" style="background:#EFEBE9; color:#5D4037; padding:6px 10px; border-radius:6px;" @click="adjustZoom(0.1)">🔍+</button>
                            <button class="btn-sm" style="background:#EFEBE9; color:#5D4037; padding:6px 10px; border-radius:6px;" @click="resetZoom">↻</button>
                        </div>

                        <button class="btn-pos" :disabled="saving"
                            :style="{ width:'100%', padding:'14px', borderRadius:'12px', fontSize:'15px', background: scopeMeta.color, marginTop:'12px', marginBottom:'12px' }"
                            @click="saveAll">
                            {{ saving ? '저장 중...' : `💾 ${scopeLabel} 주간 템플릿 저장` }}
                        </button>
                    </template>
                </div>

                <!-- 팔레트 (하단 고정) -->
                <div v-if="!loading" class="sticky-palette-wrapper">
                    <div class="palette-tab-container">
                        <div class="palette-tab-btn eraser-tab" :class="{ active: activePaletteTab === 'eraser' }"
                            @click="selectPaletteTab('eraser')">🧹 지우개</div>
                        <div v-for="t in paletteTypes" :key="t"
                            class="palette-tab-btn" :class="{ active: activePaletteTab === t }"
                            @click="selectPaletteTab(t)">{{ t }}</div>
                    </div>
                    <div class="palette-container">
                        <!-- 새 사역 블록 추가 (직접입력) — 모든 탭에서 상시 노출 -->
                        <div class="palette-add-btn"
                            :class="{ selected: isCustomSelected }"
                            @click="selectCustomCategory">
                            {{ isCustomSelected ? `✏️ ${currentCategory.name}` : '➕ 새 사역 블록' }}
                        </div>

                        <!-- 지우개 탭: 지우개 아이템만 -->
                        <div v-if="activePaletteTab === 'eraser'"
                            class="palette-item eraser-item"
                            :class="{ selected: currentCategory === null }"
                            @click="selectCategory(null)">🧹 지우개</div>

                        <!-- 일반 탭: 해당 type 카테고리들 -->
                        <template v-else>
                            <div v-for="c in filteredPaletteItems" :key="c.id || c.name"
                                class="palette-item"
                                :class="{ selected: currentCategory && currentCategory.name === c.name }"
                                :style="{ background: c.color }"
                                @click="selectCategory(c)">{{ c.name }}</div>
                            <div v-if="filteredPaletteItems.length === 0"
                                style="font-size:12px; color:#888; padding:8px 10px;">
                                이 분류에 등록된 사역이 없어. ➕ 새 사역 블록 으로 추가해봐!
                            </div>
                        </template>
                    </div>
                </div>
            </div>

            <!-- 블록 에디터 (overlay) -->
            <WeeklyBlockEditor v-if="editorState"
                :dow="editorState.dow"
                :block="editorState.block"
                :range="editorState.range"
                :slots="SLOTS"
                :can-set-undefined="canSetUndefined"
                @save="onEditorSave"
                @delete="onEditorDelete"
                @close="onEditorClose" />
        </div>
    </Teleport>
</template>
