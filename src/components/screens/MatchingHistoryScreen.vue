<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useApi } from '@/composables/useApi'
import { useFormatters } from '@/composables/useFormatters'

const router = useRouter()
const auth = useAuthStore()
const { callApi } = useApi()
const { getDay } = useFormatters()

const meetings = ref([])
const loadingPast = ref(false)
const loadingFuture = ref(false)
const rangeStart = ref('')  // 현재 로드된 범위 시작 (YYYY-MM-DD)
const rangeEnd = ref('')    // 현재 로드된 범위 끝
const noMorePast = ref(false)
const noMoreFuture = ref(false)

const CHUNK_DAYS = 7

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function fetchRange(start, end) {
  return new Promise(resolve => {
    callApi('/api/get-matching-history', { sabun: auth.currentSabun, startDate: start, endDate: end }, r => {
      resolve(r.success ? (r.meetings || []) : [])
    })
  })
}

// 날짜별 그룹핑
const displayGroups = computed(() => {
  const groups = {}
  for (const m of meetings.value) {
    if (!groups[m.date]) groups[m.date] = []
    groups[m.date].push(m)
  }
  const today = todayStr()
  return Object.keys(groups).sort().map(date => {
    const items = groups[date].slice().sort((a, b) => (a.time || '').localeCompare(b.time || ''))
    const mm = date.slice(5, 7).replace(/^0/, '')
    const dd = date.slice(8).replace(/^0/, '')
    const wd = getDay(date)
    const isToday = date === today
    const dateDisplay = isToday ? `오늘 - ${mm}/${dd}(${wd})` : `${mm}/${dd}(${wd})`
    return { date, dateDisplay, isToday, items }
  })
})

function getOutcomeColor(outcome) {
  if (!outcome) return '#888'
  if (outcome.includes('⭕️')) return '#7B1FA2'
  if (outcome.includes('❌')) return '#795548'
  if (outcome.includes('밀림')) return '#F57F17'
  if (outcome.includes('안만남')) return '#9E9E9E'
  return '#333'
}

function getOutcomeDisplay(m) {
  if (m.outcome) return m.outcome
  if (m.approvalStatus === '반려') return '반려'
  if (m.approvalStatus === '취소') return '취소'
  const att = m.attended
  if (att === 0 || att === '0') return '안만남'
  if (att === 1 || att === '1') return '결과 대기'
  return '준비완료'
}

// ── 헤더 컬럼 / 필터 / 정렬 ─────────────────────────────────────────
const COLUMNS = [
  { key: 'time', label: '시간', filterable: false },
  { key: 'name', label: '이름', filterable: false },
  { key: 'guide', label: '인도자', filterable: true },
  { key: 'teacher', label: '교사', filterable: true },
  { key: 'outcome', label: '결과', filterable: true },
]

function valueOf(m, key) {
  if (key === 'time') return m.time || '-'
  if (key === 'name') return m.name || '-'
  if (key === 'guide') return m.guide || m.manager || '-'
  if (key === 'teacher') return m.teacher || '-'
  if (key === 'outcome') return getOutcomeDisplay(m)
  return ''
}

// colFilters[key] = Set<string> (허용값). 없으면 필터 없음.
const colFilters = ref({})
const filterPopup = ref(null) // { key, x, y }
const filterSearch = ref('')

const popupColValues = computed(() => {
  if (!filterPopup.value) return []
  const key = filterPopup.value.key
  const q = filterSearch.value.trim().toLowerCase()
  const vals = [...new Set(meetings.value.map(m => valueOf(m, key)))].sort()
  return q ? vals.filter(v => v.toLowerCase().includes(q)) : vals
})

const popupAllSelected = computed(() => {
  if (!filterPopup.value) return true
  const s = colFilters.value[filterPopup.value.key]
  if (!s) return true
  return popupColValues.value.every(v => s.has(v))
})

function isPopupValChecked(val) {
  const s = colFilters.value[filterPopup.value?.key]
  return !s || s.has(val)
}

function openFilterPopup(key, event) {
  const rect = event.currentTarget.getBoundingClientRect()
  if (filterPopup.value?.key === key) { filterPopup.value = null; return }
  filterSearch.value = ''
  filterPopup.value = { key, x: rect.left, y: rect.bottom }
}
function closeFilterPopup() { filterPopup.value = null; filterSearch.value = '' }

function togglePopupVal(val) {
  const key = filterPopup.value?.key
  if (!key) return
  const allVals = [...new Set(meetings.value.map(m => valueOf(m, key)))]
  const s = colFilters.value[key] ? new Set(colFilters.value[key]) : new Set(allVals)
  if (s.has(val)) s.delete(val); else s.add(val)
  if (allVals.every(v => s.has(v))) {
    const next = { ...colFilters.value }; delete next[key]; colFilters.value = next
  } else {
    colFilters.value = { ...colFilters.value, [key]: s }
  }
}

function toggleSelectAll() {
  const key = filterPopup.value?.key
  if (!key) return
  const visible = popupColValues.value
  const allVals = [...new Set(meetings.value.map(m => valueOf(m, key)))]
  const prev = colFilters.value[key] ? new Set(colFilters.value[key]) : new Set(allVals)
  if (popupAllSelected.value) {
    visible.forEach(v => prev.delete(v))
  } else {
    visible.forEach(v => prev.add(v))
  }
  if (allVals.every(v => prev.has(v))) {
    const next = { ...colFilters.value }; delete next[key]; colFilters.value = next
  } else {
    colFilters.value = { ...colFilters.value, [key]: prev }
  }
}

function clearColFilter(key) {
  const next = { ...colFilters.value }; delete next[key]; colFilters.value = next
}
function clearAllFilters() { colFilters.value = {} }
function colHasFilter(key) { return !!colFilters.value[key] }

const filterPopupStyle = computed(() => {
  if (!filterPopup.value) return { display: 'none' }
  const panelW = 220
  const left = Math.min(filterPopup.value.x, window.innerWidth - panelW - 8)
  return { position: 'fixed', left: Math.max(4, left) + 'px', top: filterPopup.value.y + 'px', zIndex: 10002 }
})

// 다단 정렬: 배열 순서 = 우선순위. { key, dir: 'asc'|'desc' }
const sortColumns = ref([])

function toggleSort(key) {
  const idx = sortColumns.value.findIndex(s => s.key === key)
  if (idx === -1) {
    sortColumns.value = [...sortColumns.value, { key, dir: 'asc' }]
  } else if (sortColumns.value[idx].dir === 'asc') {
    const next = [...sortColumns.value]; next[idx] = { key, dir: 'desc' }; sortColumns.value = next
  } else {
    sortColumns.value = sortColumns.value.filter(s => s.key !== key)
  }
}

function sortArrow(key) {
  const s = sortColumns.value.find(s => s.key === key)
  if (!s) return '↕'
  return s.dir === 'asc' ? '↑' : '↓'
}

function sortPriority(key) {
  if (sortColumns.value.length <= 1) return null
  const idx = sortColumns.value.findIndex(s => s.key === key)
  return idx === -1 ? null : idx + 1
}

function resetFiltersAndSort() {
  clearAllFilters()
  sortColumns.value = []
}

const hasActiveFilterOrSort = computed(() =>
  Object.keys(colFilters.value).length > 0 || sortColumns.value.length > 0)

const flatFilteredSorted = computed(() => {
  let rows = meetings.value.filter(m =>
    Object.entries(colFilters.value).every(([key, allowed]) => allowed.has(valueOf(m, key))))
  if (sortColumns.value.length) {
    rows = rows.slice().sort((a, b) => {
      for (const { key, dir } of sortColumns.value) {
        const cmp = valueOf(a, key).localeCompare(valueOf(b, key), 'ko')
        if (cmp !== 0) return dir === 'asc' ? cmp : -cmp
      }
      return 0
    })
  }
  return rows
})

// 초기 로드: 오늘 기준 ±7일
async function initialLoad() {
  const today = todayStr()
  const start = addDays(today, -CHUNK_DAYS)
  const end = addDays(today, CHUNK_DAYS)
  rangeStart.value = start
  rangeEnd.value = end
  loadingPast.value = true
  const data = await fetchRange(start, end)
  meetings.value = data
  loadingPast.value = false

  // 오늘 섹션으로 스크롤
  setTimeout(() => {
    const el = document.getElementById(`hist-header-${today}`)
    if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, 100)
}

async function loadMorePast() {
  if (loadingPast.value || noMorePast.value) return
  loadingPast.value = true
  const newEnd = addDays(rangeStart.value, -1)
  const newStart = addDays(newEnd, -CHUNK_DAYS)
  const data = await fetchRange(newStart, newEnd)
  if (data.length === 0) { noMorePast.value = true }
  else { meetings.value = [...data, ...meetings.value] }
  rangeStart.value = newStart
  loadingPast.value = false
}

async function loadMoreFuture() {
  if (loadingFuture.value || noMoreFuture.value) return
  loadingFuture.value = true
  const newStart = addDays(rangeEnd.value, 1)
  const newEnd = addDays(newStart, CHUNK_DAYS)
  const data = await fetchRange(newStart, newEnd)
  if (data.length === 0) { noMoreFuture.value = true }
  else { meetings.value = [...meetings.value, ...data] }
  rangeEnd.value = newEnd
  loadingFuture.value = false
}

// IntersectionObserver로 상하단 감지
const topSentinel = ref(null)
const bottomSentinel = ref(null)
let observer = null

onMounted(async () => {
  await initialLoad()

  observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      if (entry.target === topSentinel.value) loadMorePast()
      if (entry.target === bottomSentinel.value) loadMoreFuture()
    }
  }, { threshold: 0.1 })

  if (topSentinel.value) observer.observe(topSentinel.value)
  if (bottomSentinel.value) observer.observe(bottomSentinel.value)
})

onUnmounted(() => {
  if (observer) observer.disconnect()
})
</script>

<template>
  <div class="screen">
    <div class="hist-header-bar">
      <button class="btn-back" @click="router.back()">← 매칭 절대지켜!</button>
      <span class="hist-title">히스토리</span>
    </div>

    <div class="hist-header-row">
      <div
        v-for="col in COLUMNS" :key="col.key"
        class="hist-th"
        :class="{ 'hist-th-sorted': sortColumns.some(s => s.key === col.key) }"
        @click="toggleSort(col.key)"
      >
        <span class="hist-th-lbl">{{ col.label }}</span>
        <span class="hist-th-sort">{{ sortArrow(col.key) }}<sup v-if="sortPriority(col.key)">{{ sortPriority(col.key) }}</sup></span>
        <span
          v-if="col.filterable"
          class="hist-th-fbtn"
          :class="{ 'hist-th-fbtn-on': colHasFilter(col.key) }"
          @click.stop="openFilterPopup(col.key, $event)"
        >▾</span>
      </div>
    </div>
    <div v-if="hasActiveFilterOrSort" class="hist-clear-bar">
      <button class="hist-clear-btn" @click="resetFiltersAndSort">필터/정렬 초기화</button>
    </div>

    <div class="hist-body">
      <!-- 위쪽 sentinel -->
      <div ref="topSentinel" class="sentinel">
        <div v-if="loadingPast" class="loading-msg">불러오는 중...</div>
        <div v-else-if="noMorePast" class="no-more">더 이상 기록이 없어</div>
      </div>

      <template v-if="hasActiveFilterOrSort">
        <div v-if="flatFilteredSorted.length === 0" style="text-align:center;padding:40px;color:#aaa;">
          조건에 맞는 매칭 기록이 없어
        </div>
        <div v-for="m in flatFilteredSorted" :key="m.meetingId" class="hist-row hist-row-flat">
          <div class="hist-time">{{ valueOf(m, 'time') }}</div>
          <div class="hist-name">{{ valueOf(m, 'name') }}</div>
          <div class="hist-guide">{{ valueOf(m, 'guide') }}</div>
          <div class="hist-teacher">{{ valueOf(m, 'teacher') }}</div>
          <div class="hist-outcome" :style="{ color: getOutcomeColor(m.outcome) }">
            {{ valueOf(m, 'outcome') }}
          </div>
        </div>
      </template>

      <template v-else>
        <div v-if="displayGroups.length === 0 && !loadingPast" style="text-align:center;padding:40px;color:#aaa;">
          이 기간에 매칭 기록이 없어
        </div>

        <div v-for="group in displayGroups" :key="group.date" class="date-group">
          <div
            class="hist-date-header"
            :id="`hist-header-${group.date}`"
            :style="group.isToday ? { background: '#E3F2FD', color: '#1565C0', border: '2px solid #90CAF9' } : {}"
          >{{ group.dateDisplay }}</div>

          <div v-for="m in group.items" :key="m.meetingId" class="hist-row">
            <div class="hist-time">{{ m.time || '-' }}</div>
            <div class="hist-name">{{ m.name || '-' }}</div>
            <div class="hist-guide">{{ m.guide || m.manager || '-' }}</div>
            <div class="hist-teacher">{{ m.teacher || '-' }}</div>
            <div class="hist-outcome" :style="{ color: getOutcomeColor(m.outcome) }">
              {{ getOutcomeDisplay(m) }}
            </div>
          </div>
        </div>
      </template>

      <!-- 아래쪽 sentinel -->
      <div ref="bottomSentinel" class="sentinel">
        <div v-if="loadingFuture" class="loading-msg">불러오는 중...</div>
        <div v-else-if="noMoreFuture" class="no-more">마지막 기록이야</div>
      </div>
    </div>

    <template v-if="filterPopup">
      <div class="hist-fp-backdrop" @click="closeFilterPopup"></div>
      <div class="hist-fp-panel" :style="filterPopupStyle">
        <div class="hist-fp-top">
          <input v-model="filterSearch" class="hist-fp-search" placeholder="🔍 검색..." @click.stop />
        </div>
        <div class="hist-fp-selectall" @mousedown.prevent="toggleSelectAll">
          <input type="checkbox" :checked="popupAllSelected" />
          <span>전체 선택</span>
        </div>
        <div class="hist-fp-divider"></div>
        <div class="hist-fp-list">
          <div v-for="val in popupColValues" :key="val" class="hist-fp-item" @mousedown.prevent="togglePopupVal(val)">
            <input type="checkbox" :checked="isPopupValChecked(val)" />
            <span class="hist-fp-lbl">{{ val === '' ? '(빈값)' : val }}</span>
          </div>
          <div v-if="!popupColValues.length" class="hist-fp-empty">일치하는 값 없음</div>
        </div>
        <div class="hist-fp-footer">
          <button class="hist-fp-ok" @mousedown.prevent="closeFilterPopup">확인</button>
          <button class="hist-fp-clr" @mousedown.prevent="() => { clearColFilter(filterPopup.key); closeFilterPopup(); }">초기화</button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.hist-header-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px 6px;
  background: white;
  position: sticky;
  top: 0;
  z-index: 20;
  border-bottom: 1px solid #eee;
}

.btn-back {
  background: none;
  border: none;
  color: #3949AB;
  font-family: 'Jua', sans-serif;
  font-size: 14px;
  cursor: pointer;
  padding: 4px 0;
}

.hist-title {
  font-family: 'Jua', sans-serif;
  font-size: 16px;
  font-weight: bold;
  color: #333;
}

.hist-body {
  padding: 0 0 40px;
}

.sentinel {
  min-height: 20px;
  text-align: center;
}

.loading-msg {
  padding: 12px;
  color: #999;
  font-size: 13px;
}

.no-more {
  padding: 12px;
  color: #ccc;
  font-size: 12px;
}

.hist-date-header {
  position: sticky;
  top: 76px;
  background: #EFEBE9;
  padding: 8px 15px;
  font-weight: bold;
  color: #5D4037;
  z-index: 10;
  border-radius: 0 0 10px 10px;
  box-shadow: 0 2px 5px rgba(0,0,0,0.1);
  margin-bottom: 6px;
  text-align: center;
  font-family: 'Jua', sans-serif;
}

.hist-row {
  display: grid;
  grid-template-columns: 0.7fr 0.9fr 0.9fr 0.8fr 1.2fr;
  gap: 2px;
  align-items: center;
  background: white;
  margin: 0 8px 4px;
  border-radius: 10px;
  padding: 8px 6px;
  font-size: 13px;
  text-align: center;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  min-height: 40px;
}

.hist-name { font-weight: bold; color: #111; }
.hist-time { color: #666; }
.hist-guide { color: #555; }
.hist-teacher { color: #555; }
.hist-outcome { font-weight: bold; white-space: pre-wrap; line-height: 1.2; }

/* ── 헤더 행 (필터/정렬) ───────────────────────────────────────── */
.hist-header-row {
  display: grid;
  grid-template-columns: 0.7fr 0.9fr 0.9fr 0.8fr 1.2fr;
  gap: 2px;
  align-items: center;
  margin: 0 8px;
  padding: 6px 6px 4px;
  position: sticky;
  top: 45px;
  background: white;
  z-index: 15;
  border-bottom: 1px solid #eee;
}

.hist-th {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  font-size: 12px;
  font-weight: bold;
  color: #555;
  cursor: pointer;
  user-select: none;
  padding: 4px 2px;
  border-radius: 6px;
}

.hist-th:hover { background: #f5f5f5; }
.hist-th-sorted { color: #3949AB; background: #E8EAF6; }
.hist-th-lbl { white-space: nowrap; }
.hist-th-sort { font-size: 10px; color: #999; }
.hist-th-sorted .hist-th-sort { color: #3949AB; }
.hist-th-sort sup { font-size: 8px; }

.hist-th-fbtn {
  font-size: 9px;
  color: #bbb;
  padding: 0 2px;
}
.hist-th-fbtn-on { color: #3949AB; font-weight: bold; }

.hist-clear-bar {
  display: flex;
  justify-content: flex-end;
  padding: 4px 12px 0;
}
.hist-clear-btn {
  font-family: 'Jua', sans-serif;
  font-size: 11px;
  color: #3949AB;
  background: #E8EAF6;
  border: none;
  border-radius: 8px;
  padding: 4px 10px;
  cursor: pointer;
}
.hist-clear-btn:hover { background: #C5CAE9; }

.hist-row-flat { margin: 0 8px 4px; }

/* ── 필터 팝업 ────────────────────────────────────────────────── */
.hist-fp-backdrop { position: fixed; inset: 0; z-index: 30; }
.hist-fp-panel {
  position: fixed;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 12px;
  box-shadow: 0 6px 24px rgba(0,0,0,.18);
  z-index: 31;
  width: 220px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  max-height: 65vh;
}
.hist-fp-top { padding: 8px 10px 4px; }
.hist-fp-search {
  width: 100%;
  box-sizing: border-box;
  font-size: 12px;
  padding: 5px 8px;
  border: 1px solid #ddd !important;
  border-radius: 8px;
  outline: none;
  background: #fff !important;
}
.hist-fp-search:focus { border-color: #3949AB; }
.hist-fp-selectall {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 12px;
  font-weight: bold;
  color: #333;
  user-select: none;
}
.hist-fp-selectall:hover { background: #f5f5f5; }
.hist-fp-selectall input[type="checkbox"] { pointer-events: none; width: auto; flex-shrink: 0; }
.hist-fp-divider { height: 1px; background: #eee; flex-shrink: 0; }
.hist-fp-list { overflow-y: auto; flex: 1; padding: 4px 0; -webkit-overflow-scrolling: touch; }
.hist-fp-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  cursor: pointer;
  font-size: 12px;
  color: #333;
  user-select: none;
}
.hist-fp-item:hover { background: #f5f5f5; }
.hist-fp-item input[type="checkbox"] { pointer-events: none; width: auto; flex-shrink: 0; }
.hist-fp-lbl { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hist-fp-empty { padding: 12px; text-align: center; font-size: 12px; color: #bbb; }
.hist-fp-footer { display: flex; gap: 6px; padding: 8px 10px; border-top: 1px solid #eee; flex-shrink: 0; }
.hist-fp-ok {
  flex: 1;
  font-family: 'Jua', sans-serif;
  font-size: 13px;
  padding: 7px;
  background: #3949AB;
  color: #fff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}
.hist-fp-ok:hover { background: #2C3893; }
.hist-fp-clr {
  font-family: 'Jua', sans-serif;
  font-size: 12px;
  padding: 7px 10px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: none;
  color: #888;
  cursor: pointer;
}
.hist-fp-clr:hover { background: #f5f5f5; }
</style>
