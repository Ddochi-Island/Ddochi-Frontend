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
async function run() { const r = { ...range.value }; if (await load(r)) loaded.value = r }
watch(region, () => { group.value = '' })

const all = computed(() => data.value?.rows || [])
const regions = computed(() => [...new Set(all.value.map((r) => r.guide_region).filter(Boolean))].sort(natCmp))
const inRegion = computed(() => all.value.filter((r) => !region.value || r.guide_region === region.value))
const groups = computed(() => (region.value ? [...new Set(inRegion.value.map((r) => r.guide_group).filter(Boolean))].sort(natCmp) : []))
const chipRows = computed(() => inRegion.value.filter((r) => !group.value || r.guide_group === group.value))
// 표 제목 아래 칸별 선택 필터(엑셀 필터처럼) — 인도·교사 소속 지역/반/구역. '' = 전체, NONE = 값 없음(2026-11-20)
const NONE = '__none__'
const FILTER_COLS = ['guide_region', 'guide_group', 'guide_district', 'teacher_region', 'teacher_group', 'teacher_district']
const colFilter = reactive(Object.fromEntries(FILTER_COLS.map((k) => [k, ''])))
watch([region, group], () => { for (const k of FILTER_COLS) colFilter[k] = '' })
const colOptions = (key) => [...new Set(chipRows.value.map((r) => r[key] || NONE))].sort(natCmp)
const colLabel = (key, v) => (v === NONE ? '(없음)' : key.endsWith('region') ? regionLabel(v) : key.endsWith('district') ? dist(v) : v)
// 최초만남 날짜 순(없는 사람은 맨 뒤, 같으면 합당한자 날짜 순) — 2026-11-20 사용자 요청(전엔 합당한자 날짜 순)
const byFirstMeet = (a, b) => (!a.first_at - !b.first_at) || String(a.first_at || '').localeCompare(String(b.first_at || '')) || String(a.hap_at || '').localeCompare(String(b.hap_at || ''))
// 노션처럼 칸 제목을 누르면 정렬 — 오름차순 → 내림차순 → 해제(기본: 최초만남 날짜 순). 빈 값은 항상 맨 뒤(2026-11-20)
const COLS = [
    ['hap_at', '합당한자 날짜'], ['guide_region', '인도 지역'], ['guide_group', '인도 반'], ['guide_district', '인도 구역'],
    ['teacher_region', '교사 지역'], ['teacher_group', '교사 반'], ['teacher_district', '교사 구역'],
    ['name', '섭'], ['guide_name', '인'], ['teacher_name', '교'], ['route', '유형'], ['tool', '도구'], ['recruitment_type', '온/오프'],
    ['meet_stage', '현재 단계'], ['first_at', '최초만남'], ['first_result', '최초 결과'], ['later_result', '이후 결과'], ['consult_at', '상담연결'],
]
const sortKey = ref('')
const sortDir = ref(1)
function toggleSort(key) {
    if (sortKey.value !== key) { sortKey.value = key; sortDir.value = 1 }
    else if (sortDir.value === 1) sortDir.value = -1
    else sortKey.value = ''
}
const bySort = (a, b) => {
    const k = sortKey.value
    const va = a[k] ?? '', vb = b[k] ?? ''
    return (!va - !vb) || sortDir.value * natCmp(va, vb) || byFirstMeet(a, b)
}
const rows = computed(() => chipRows.value.filter((r) => FILTER_COLS.every((k) => !colFilter[k] || (r[k] || NONE) === colFilter[k]))
    .sort(sortKey.value ? bySort : byFirstMeet))
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
            <span class="erp-label">합당한자 날짜</span>
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
                    <button class="erp-btn" style="margin-left: auto" :disabled="!rows.length" @click="copy">시트용 복사</button>
                </div>
                <div v-if="groups.length" class="erp-find-chips" role="group" aria-label="인도 반">
                    <button :class="['erp-chip', { on: !group }]" :aria-pressed="!group" @click="group = ''">{{ regionLabel(region) }} 전체</button>
                    <button v-for="g in groups" :key="g" :class="['erp-chip', { on: group === g }]" :aria-pressed="group === g" @click="group = g">
                        {{ g }} {{ count(inRegion, 'guide_group', g) }}
                    </button>
                </div>
                <h3 class="erp-h3">
                    {{ md(loaded.from) }}~{{ md(loaded.to) }} 매칭 명단 <span class="erp-sub">{{ rows.length }}명 · {{ sortKey ? `${COLS.find(([k]) => k === sortKey)[1]} ${sortDir === 1 ? '오름차순' : '내림차순'}` : '최초만남 날짜 순서' }} · 날짜는 재가한 날 · 소속은 인도자·교사의 지금 소속 · 2차만남·밀림 날짜 색 <span class="erp-term-short">단기(3일 이내)</span> / <span class="erp-term-long">장기</span></span>
                </h3>
                <p v-if="!chipRows.length" class="erp-empty">이 기간에 합당한자 날짜인 사람이 없어요.</p>
                <div v-else class="erp-table-wrap">
                    <table class="erp-table erp-table-left erp-match-table">
                        <thead>
                            <tr>
                                <th v-for="[k, label] in COLS" :key="k" scope="col" :aria-sort="sortKey === k ? (sortDir === 1 ? 'ascending' : 'descending') : 'none'">
                                    <button type="button" :class="['erp-sort', { on: sortKey === k }]" @click="toggleSort(k)">
                                        {{ label }}<span class="erp-sort-mark">{{ sortKey === k ? (sortDir === 1 ? ' ▲' : ' ▼') : ' ↕' }}</span>
                                    </button>
                                </th>
                            </tr>
                            <tr class="erp-filter-row">
                                <th>
                                    <button v-if="filtering" class="erp-filter-clear" @click="clearFilters">필터 해제</button>
                                </th>
                                <th v-for="k in FILTER_COLS" :key="k">
                                    <select v-model="colFilter[k]" :class="['erp-filter', { on: colFilter[k] }]" :aria-label="`${k.startsWith('guide') ? '인도' : '교사'} 소속 필터`">
                                        <option value="">전체 ▾</option>
                                        <option v-for="v in colOptions(k)" :key="v" :value="v">{{ colLabel(k, v) }}</option>
                                    </select>
                                </th>
                                <th colspan="11"></th>
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
        <p v-else class="erp-empty">합당한자 날짜 기간을 고르고 🔍 조회를 누르세요.</p>
    </section>
</template>

<style scoped>
.erp-match-table td { white-space: nowrap; }
.erp-stage-2 { color: var(--e-blue); font-weight: 700; }
.erp-term-short { color: var(--e-up); font-weight: 700; }
.erp-sort { border: none; background: none; padding: 0; font: inherit; font-weight: 700; color: inherit; cursor: pointer; white-space: nowrap; }
.erp-sort-mark { color: var(--e-faint); font-size: 11px; }
.erp-sort.on, .erp-sort.on .erp-sort-mark { color: var(--e-blue); }
.erp-term-long { color: #E8590C; font-weight: 700; }
.erp-filter-row th { background: #fff; padding: 4px 6px; font-weight: normal; }
.erp-filter { width: 100%; min-width: 72px; border: 1px solid var(--e-line); border-radius: 6px; padding: 3px 4px; font-size: 12px; color: var(--e-sub); background: #fff; }
.erp-filter.on { border-color: #C8DEFF; background: var(--e-blue-soft); color: var(--e-blue); font-weight: 600; }
.erp-filter-clear { border: none; background: none; color: var(--e-blue); font-size: 12px; cursor: pointer; padding: 0; white-space: nowrap; }
</style>
