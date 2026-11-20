<script setup>
// ERP 매칭 명단 — 구 매칭 시트처럼 합당한자 날짜(재가한 날) 기준 기간 안 재가된 사람 한 줄씩. 인도 지역·반 버튼과 칸별 소속 필터로 좁히고 시트용(탭 구분) 복사
import { ref, reactive, computed, watch } from 'vue'
import ErpRangePicker from './ErpRangePicker.vue'
import { useErpLoad, monthOf, natCmp, regionLabel } from './erpUtil'
import { usePopup } from '@/composables/usePopup'

const { showToast } = usePopup()
const range = ref(monthOf())
const { loading, error, data, load } = useErpLoad('/api/erp/match-list')
const region = ref('')
const group = ref('')
const loaded = ref(null)
// 기간을 어떤 날짜로 거를지 — 합당한자 날짜(재가한 날) 또는 최초만남 날짜(2026-11-20)
const BASIS = { hap: '합당한자 날짜', first: '최초만남 날짜' }
const basis = ref('hap')
async function run() { const r = { ...range.value, basis: basis.value }; if (await load(r)) loaded.value = r }
watch(region, () => { group.value = '' })

const all = computed(() => data.value?.rows || [])
const regions = computed(() => [...new Set(all.value.map((r) => r.guide_region).filter(Boolean))].sort(natCmp))
const inRegion = computed(() => all.value.filter((r) => !region.value || r.guide_region === region.value))
const groups = computed(() => (region.value ? [...new Set(inRegion.value.map((r) => r.guide_group).filter(Boolean))].sort(natCmp) : []))
const chipRows = computed(() => inRegion.value.filter((r) => !group.value || r.guide_group === group.value))
// 표 열 — [응답 키, 제목]. 정렬·필터가 같이 씀
const COLS = [
    ['hap_at', '합당한자 날짜'], ['guide_region', '인도 지역'], ['guide_group', '인도 반'], ['guide_district', '인도 구역'],
    ['teacher_region', '교사 지역'], ['teacher_group', '교사 반'], ['teacher_district', '교사 구역'],
    ['name', '섭'], ['guide_name', '인'], ['teacher_name', '교'], ['route', '유형'], ['tool', '도구'], ['recruitment_type', '온/오프'],
    ['meet_stage', '현재 단계'], ['first_at', '최초만남'], ['first_result', '최초 결과'], ['later_result', '이후 결과'], ['consult_at', '상담연결'],
]
// 표 제목 아래 칸별 선택 필터(엑셀 필터처럼) — 모든 열, 화면에 보이는 글자 기준. '' = 전체, NONE = 값 없음(2026-11-20)
const NONE = '__none__'
const FILTER_COLS = COLS.map(([k]) => k)
const colFilter = reactive(Object.fromEntries(FILTER_COLS.map((k) => [k, ''])))
watch([region, group], () => { for (const k of FILTER_COLS) colFilter[k] = '' })
const DATE_COLS = { hap_at: 'hap_date', first_at: 'first_at', consult_at: 'consult_at' }
const cellText = (k, r) => {
    if (DATE_COLS[k]) return day(r[DATE_COLS[k]]) || NONE
    if (k.endsWith('region')) return r[k] ? regionLabel(r[k]) : NONE
    if (k.endsWith('district')) return dist(r[k]) || NONE
    if (k === 'recruitment_type') return onOff(r[k]) || NONE
    return r[k] || NONE
}
const colOptions = (k) => [...new Set(chipRows.value.map((r) => cellText(k, r)))].sort(natCmp)
const colLabel = (k, v) => (v === NONE ? '(없음)' : v)
// 섭·인·교(이름)는 고르기 대신 검색 — 들어간 글자를 포함하면 남김(2026-11-20)
const NAME_COLS = new Set(['name', 'guide_name', 'teacher_name'])
const colMatch = (k, r) => {
    const f = colFilter[k]
    if (!f) return true
    if (NAME_COLS.has(k)) return !f.trim() || String(r[k] || '').includes(f.trim())
    return cellText(k, r) === f
}
// 최초만남 날짜 순(없는 사람은 맨 뒤, 같으면 합당한자 날짜 순) — 2026-11-20 사용자 요청(전엔 합당한자 날짜 순)
const byFirstMeet = (a, b) => (!a.first_at - !b.first_at) || String(a.first_at || '').localeCompare(String(b.first_at || '')) || String(a.hap_at || '').localeCompare(String(b.hap_at || ''))
// 노션 데이터베이스처럼 정렬 규칙을 쌓음 — [열, 오름/내림] 여러 개, 위 규칙부터 적용. 빈 값은 항상 맨 뒤,
// 규칙이 없거나 다 같으면 최초만남 날짜 순(2026-11-20)
const COL_LABEL = Object.fromEntries(COLS)
const sorts = ref([])  // [{ key, dir: 1 | -1 }]
const showSort = ref(false)
function addSort() {
    const used = new Set(sorts.value.map((x) => x.key))
    const next = COLS.find(([k]) => !used.has(k))
    if (next) sorts.value.push({ key: next[0], dir: 1 })
}
const bySorts = (a, b) => {
    for (const { key, dir } of sorts.value) {
        const va = a[key] ?? '', vb = b[key] ?? ''
        const c = (!va - !vb) || dir * natCmp(va, vb)
        if (c) return c
    }
    return byFirstMeet(a, b)
}
const sortSummary = computed(() => sorts.value.map(({ key, dir }) => `${COL_LABEL[key]} ${dir === 1 ? '오름차순' : '내림차순'}`).join(' → '))
const rows = computed(() => chipRows.value.filter((r) => FILTER_COLS.every((k) => colMatch(k, r)))
    .sort(bySorts))
const filtering = computed(() => FILTER_COLS.some((k) => colFilter[k]))
const clearFilters = () => { for (const k of FILTER_COLS) colFilter[k] = '' }
const count = (list, key, v) => list.filter((r) => r[key] === v).length

const md = (ymd) => `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}`
// 시트처럼 M/D. 합당한자 날짜(hap_date)는 서버가 KST 날짜로 줌. 만남 날짜(MATCHED_AT·만남 예정일)는
// 입력한 벽시계 시각이 Z 붙은 채 저장돼 있어서 옮기지 않고 날짜만(옮기면 저녁 만남이 다음 날로 밀림)
const day = (iso) => (iso ? md(iso.slice(0, 10)) : '')
const onOff = (t) => (t === 'ONLINE' ? '온라인' : t === 'OFFLINE' ? '오프라인' : '')
const dist = (d) => (d ? `${d}구역` : '')
// 2차만남·밀림 결과의 괄호 속 날짜를 단기/장기 색으로 — 서버가 *_term으로 줌(다음 만남까지 3일 이내 단기, 2026-11-20)
const splitDate = (text) => { const m = String(text || '').match(/^(.*?)(\d{1,2}\/\d{1,2})(\)?)$/); return m ? [m[1], m[2], m[3]] : [text, '', ''] }
const TERM_CLASS = { 단기: 'erp-term-short', 장기: 'erp-term-long' }
// 스프레드시트에 그대로 붙게 탭 구분(TSV) — 칸 안의 탭·줄바꿈은 공백으로
const cell = (v) => String(v ?? '').replace(/[\t\r\n]+/g, ' ').trim()
function copy() {
    const head = ['합당한자 날짜', '인도 지역', '인도 반', '인도 구역', '교사 지역', '교사 반', '교사 구역', '섭', '인', '교',
        '유형', '도구이름', '온/오프라인', '현재 단계', '최초만남 예정날짜', '최초만남 진행결과', '이후만남 진행결과', '상담연결 날짜']
    const lines = rows.value.map((r) => [
        day(r.hap_date), r.guide_region ? regionLabel(r.guide_region) : '', r.guide_group, dist(r.guide_district),
        r.teacher_region ? regionLabel(r.teacher_region) : '', r.teacher_group, dist(r.teacher_district),
        r.name, r.guide_name, r.teacher_name, r.route, r.tool, onOff(r.recruitment_type), r.meet_stage,
        day(r.first_at), r.first_result, r.later_result, day(r.consult_at),
    ].map(cell).join('\t'))
    navigator.clipboard.writeText([head.join('\t'), ...lines].join('\n')).catch(() => {})
    showToast(`📋 ${rows.value.length}명 복사됨 — 시트에 붙여넣으세요`)
}
</script>

<template>
    <section>
        <div class="erp-bar">
            <select v-model="basis" class="erp-basis" aria-label="기간 기준 날짜">
                <option v-for="(label, k) in BASIS" :key="k" :value="k">{{ label }}</option>
            </select>
            <ErpRangePicker v-model="range" />
            <button class="erp-btn" :disabled="loading" @click="run">🔍 조회</button>
        </div>

        <p v-if="loading" class="erp-empty">조회 중…</p>
        <p v-else-if="error" class="erp-error">{{ error }}</p>
        <template v-else-if="data && loaded">
            <div class="erp-section">
                <div class="erp-find-chips" role="group" aria-label="인도 지역">
                    <button :class="['erp-chip', { on: !region }]" :aria-pressed="!region" @click="region = ''">전체 {{ all.length }}</button>
                    <button v-for="rg in regions" :key="rg" :class="['erp-chip', { on: region === rg }]" :aria-pressed="region === rg" @click="region = rg">
                        {{ regionLabel(rg) }} {{ count(all, 'guide_region', rg) }}
                    </button>
                    <button :class="['erp-btn', { 'erp-sort-on': sorts.length }]" style="margin-left: auto" @click="showSort = !showSort">
                        ⇅ 정렬{{ sorts.length ? ` ${sorts.length}` : '' }}
                    </button>
                    <button v-if="filtering" class="erp-btn" @click="clearFilters">필터 해제</button>
                    <button class="erp-btn" :disabled="!rows.length" @click="copy">시트용 복사</button>
                </div>
                <div v-if="showSort" class="erp-sort-panel">
                    <div v-for="(x, i) in sorts" :key="i" class="erp-sort-rule">
                        <select v-model="x.key" class="erp-filter" aria-label="정렬할 열">
                            <option v-for="[k, label] in COLS" :key="k" :value="k">{{ label }}</option>
                        </select>
                        <select v-model="x.dir" class="erp-filter" aria-label="정렬 방향">
                            <option :value="1">오름차순</option>
                            <option :value="-1">내림차순</option>
                        </select>
                        <button class="erp-sort-x" :aria-label="`${COL_LABEL[x.key]} 정렬 빼기`" @click="sorts.splice(i, 1)">✕</button>
                    </div>
                    <p v-if="!sorts.length" class="erp-sub" style="margin: 0 0 6px">정렬 규칙이 없어요 — 지금은 최초만남 날짜 순이에요.</p>
                    <div class="erp-sort-actions">
                        <button class="erp-filter-clear" :disabled="sorts.length >= COLS.length" @click="addSort">＋ 정렬 추가</button>
                        <button v-if="sorts.length" class="erp-filter-clear" style="color: var(--e-down)" @click="sorts = []">정렬 지우기</button>
                    </div>
                </div>
                <div v-if="groups.length" class="erp-find-chips" role="group" aria-label="인도 반">
                    <button :class="['erp-chip', { on: !group }]" :aria-pressed="!group" @click="group = ''">{{ regionLabel(region) }} 전체</button>
                    <button v-for="g in groups" :key="g" :class="['erp-chip', { on: group === g }]" :aria-pressed="group === g" @click="group = g">
                        {{ g }} {{ count(inRegion, 'guide_group', g) }}
                    </button>
                </div>
                <h3 class="erp-h3">
                    {{ BASIS[loaded.basis] }} {{ md(loaded.from) }}~{{ md(loaded.to) }} 매칭 명단 <span class="erp-sub">{{ rows.length }}명 · {{ sorts.length ? `정렬 ${sortSummary}` : '최초만남 날짜 순서' }} · 날짜는 재가한 날 · 소속은 인도자·교사의 지금 소속 · 2차만남·밀림 날짜 색 <span class="erp-term-short">단기(3일 이내)</span> / <span class="erp-term-long">장기</span></span>
                </h3>
                <p v-if="!chipRows.length" class="erp-empty">이 기간에 {{ BASIS[loaded.basis] }}인 사람이 없어요.</p>
                <div v-else class="erp-table-wrap">
                    <table class="erp-table erp-table-left erp-match-table">
                        <thead>
                            <tr>
                                <th v-for="[k, label] in COLS" :key="k" scope="col" :class="{ 'erp-sorted': sorts.some((x) => x.key === k) }">{{ label }}</th>
                            </tr>
                            <tr class="erp-filter-row">
                                <th v-for="[k, label] in COLS" :key="k">
                                    <template v-if="NAME_COLS.has(k)">
                                        <!-- 자동완성 — 지금 명단에 있는 이름(브라우저 기본 datalist) -->
                                        <input v-model="colFilter[k]" type="search" placeholder="검색" :list="`erp-names-${k}`"
                                            :class="['erp-filter', { on: colFilter[k] }]" :aria-label="`${label} 이름 검색`">
                                        <datalist :id="`erp-names-${k}`">
                                            <option v-for="v in colOptions(k).filter((x) => x !== NONE)" :key="v" :value="v" />
                                        </datalist>
                                    </template>
                                    <select v-if="!NAME_COLS.has(k)" v-model="colFilter[k]" :class="['erp-filter', { on: colFilter[k] }]" :aria-label="`${label} 필터`">
                                        <option value="">전체 ▾</option>
                                        <option v-for="v in colOptions(k)" :key="v" :value="v">{{ colLabel(k, v) }}</option>
                                    </select>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-if="!rows.length"><td colspan="18" class="erp-zero">필터에 맞는 사람이 없어요.</td></tr>
                            <tr v-for="r in rows" :key="r.sarang_id">
                                <td>{{ day(r.hap_date) }}</td>
                                <td>{{ r.guide_region ? regionLabel(r.guide_region) : '—' }}</td>
                                <td>{{ r.guide_group || '—' }}</td>
                                <td>{{ dist(r.guide_district) || '—' }}</td>
                                <td :class="{ 'erp-zero': !r.teacher_region }">{{ r.teacher_region ? regionLabel(r.teacher_region) : '—' }}</td>
                                <td :class="{ 'erp-zero': !r.teacher_group }">{{ r.teacher_group || '—' }}</td>
                                <td :class="{ 'erp-zero': !r.teacher_district }">{{ dist(r.teacher_district) || '—' }}</td>
                                <td><b>{{ r.name }}</b></td>
                                <td>{{ r.guide_name || '—' }}</td>
                                <td :class="{ 'erp-zero': !r.teacher_name }">{{ r.teacher_name || '—' }}</td>
                                <td>{{ r.route || '—' }}</td>
                                <td>{{ r.tool || '—' }}</td>
                                <td>{{ onOff(r.recruitment_type) }}</td>
                                <td :class="{ 'erp-stage-2': r.meet_stage !== '1차' }">{{ r.meet_stage || '—' }}</td>
                                <td>{{ day(r.first_at) || '—' }}</td>
                                <td v-for="([res, term], ci) in [[r.first_result, r.first_term], [r.later_result, r.later_term]]" :key="ci">
                                    <template v-if="res && term">{{ splitDate(res)[0] }}<span :class="TERM_CLASS[term]" :title="term">{{ splitDate(res)[1] }}</span>{{ splitDate(res)[2] }}</template>
                                    <template v-else>{{ res || '—' }}</template>
                                </td>
                                <td>{{ day(r.consult_at) || '—' }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </template>
        <p v-else class="erp-empty">기준 날짜(합당한자 날짜·최초만남 날짜)와 기간을 고르고 🔍 조회를 누르세요.</p>
    </section>
</template>

<style scoped>
.erp-match-table td { white-space: nowrap; }
.erp-stage-2 { color: var(--e-blue); font-weight: 700; }
.erp-term-short { color: var(--e-up); font-weight: 700; }
.erp-sorted { color: var(--e-blue); }
.erp-basis { border: 1px solid var(--e-line); border-radius: 8px; padding: 6px 8px; font-size: 13px; font-weight: 600; background: #fff; color: var(--e-text); }
.erp-sort-on { border-color: #C8DEFF; background: var(--e-blue-soft); color: var(--e-blue); font-weight: 600; }
.erp-sort-panel { margin-top: 10px; padding: 12px; border: 1px solid var(--e-line); border-radius: 10px; background: var(--e-head); max-width: 420px; }
.erp-sort-rule { display: flex; gap: 6px; align-items: center; margin-bottom: 6px; }
.erp-sort-rule .erp-filter { width: auto; min-width: 110px; padding: 5px 6px; font-size: 13px; }
.erp-sort-x { border: none; background: none; color: var(--e-faint); cursor: pointer; font-size: 14px; }
.erp-sort-actions { display: flex; gap: 14px; }
.erp-term-long { color: #E8590C; font-weight: 700; }
.erp-filter-row th { background: #fff; padding: 4px 6px; font-weight: normal; }
.erp-filter { width: 100%; min-width: 72px; border: 1px solid var(--e-line); border-radius: 6px; padding: 3px 4px; font-size: 12px; color: var(--e-sub); background: #fff; }
.erp-filter.on { border-color: #C8DEFF; background: var(--e-blue-soft); color: var(--e-blue); font-weight: 600; }
.erp-filter-clear { border: none; background: none; color: var(--e-blue); font-size: 12px; cursor: pointer; padding: 0; white-space: nowrap; }
</style>
