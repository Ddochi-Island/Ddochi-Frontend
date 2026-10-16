<script setup>
// ERP 찾기 분석 — 기간 안에 찾은 사람을 지역 → 구역별 × 찾기 활동(인스타 디엠·큐알·인스타 광고·홍보·도구 노방)으로 먼저 보고(메인),
// 고른 지역·구역의 활동 → 도구별 상세와 그 뒤 만픽·합재양·재가·만남·상연까지 간 수를 아래에. 활동은 합재양의 경로(합재양 전 shed 유입은 도구노방·사쉐)
import { ref, computed } from 'vue'
import ErpRangePicker from './ErpRangePicker.vue'
import { useErpLoad, monthOf, sumBy, total, pct, natCmp, regionLabel, districtLabel } from './erpUtil'

const range = ref(monthOf())
const { loading, error, data, load } = useErpLoad('/api/erp/find')
const region = ref('')
const district = ref('')
const open = ref(new Set())  // 도구까지 펼친 활동

// 경로 → 찾기 활동 (홍보 = 소모임 + 온라인폼, 사용자 정의 2026-10-16). 나머지 경로는 그대로 한 줄씩
const ACTIVITY = { 인스타디엠: '인스타 디엠', 큐알: '큐알', 인스타광고: '인스타 광고', 소모임: '홍보', 온라인폼: '홍보', 도구노방: '도구 노방' }
const OFFLINE_ROUTES = new Set(['도구노방', '생노', '바따장', '노방', '오프찾'])
const MAIN_ORDER = { 온라인: ['인스타 디엠', '큐알', '인스타 광고', '홍보'], 오프라인: ['도구 노방'] }
const COLS = [['reg', '찾기'], ['meet_fix', '만픽'], ['hjy', '합재양'], ['jaega', '재가'], ['met', '만남'], ['consult', '상연']]

const activityOf = (route) => (route ? ACTIVITY[route] || route : '미기록')
const sideOf = (route) => (route && OFFLINE_ROUTES.has(route) ? '오프라인' : '온라인')

const regions = computed(() => [...new Set((data.value?.rows || []).map((r) => r.region).filter(Boolean))].sort(natCmp))
const scoped = computed(() => (data.value?.rows || [])
    .filter((r) => (!region.value || r.region === region.value) && (!district.value || r.district === district.value))
    .map((r) => ({ ...r, side: sideOf(r.route), activity: activityOf(r.route),
        // 홍보는 경로 두 개를 묶어서 도구 앞에 경로도 붙임
        toolLabel: (ACTIVITY[r.route] === '홍보' ? `${r.route} · ` : '') + (r.tool || '도구 미기록') })))

// [{ side, sum, activities: [{ name, sum, tools: [{ name, ...합계 }] }] }]
const groups = computed(() => ['온라인', '오프라인'].map((side) => {
    const rows = scoped.value.filter((r) => r.side === side)
    const main = MAIN_ORDER[side]
    const activities = sumBy(rows, (r) => r.activity)
        .sort((a, b) => {
            const ia = main.indexOf(a.key), ib = main.indexOf(b.key)
            return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || b.reg - a.reg || natCmp(a.key, b.key)
        })
        .map((a) => ({ name: a.key, sum: a, tools: sumBy(rows.filter((r) => r.activity === a.key), (r) => r.toolLabel).sort((x, y) => y.reg - x.reg) }))
    // 주요 활동은 0건이어도 줄을 보여줌 — 이번 기간에 안 한 활동이 눈에 띄게
    for (const name of main) if (!activities.some((a) => a.name === name)) activities.splice(main.indexOf(name), 0, { name, sum: {}, tools: [] })
    return { side, sum: total(rows), activities }
}))
const grand = computed(() => total(scoped.value))

// ── 지역 > 구역별 — 행: 지역(누르면 구역), 열: 주요 찾기 활동 + 기타 + 합계, 숫자 종류는 고름 ──
const metric = ref('reg')
const MATRIX_COLS = [...MAIN_ORDER.온라인, ...MAIN_ORDER.오프라인]
const colOf = (r) => (MATRIX_COLS.includes(r.activity) ? r.activity : '기타')
function cellsOf(rows) {
    const c = Object.fromEntries([...MATRIX_COLS, '기타', '합계'].map((k) => [k, 0]))
    for (const r of rows) { c[colOf(r)] += r[metric.value] || 0; c.합계 += r[metric.value] || 0 }
    return c
}
// 메인 표 — 지역을 안 골랐으면 지역별, 골랐으면 그 지역의 구역별 (구역 선택과 무관하게 그 지역 전체를 보여줌)
const tagged = computed(() => (data.value?.rows || []).map((r) => ({ ...r, activity: activityOf(r.route) })))
const matrixRows = computed(() => {
    const base = tagged.value.filter((r) => !region.value || r.region === region.value)
    const keyOf = (r) => (region.value ? r.district : r.region)
    return [...new Set(base.map(keyOf))].sort(natCmp).map((k) => ({
        key: k, label: region.value ? districtLabel(k) : regionLabel(k), cells: cellsOf(base.filter((r) => keyOf(r) === k)),
    }))
})
const matrixTotal = computed(() => cellsOf(tagged.value.filter((r) => !region.value || r.region === region.value)))
function pickRow(k) {
    if (!region.value) { region.value = k; district.value = '' }
    else district.value = district.value === k ? '' : k
}
function pickRegion(r) { region.value = r; district.value = '' }

function toggle(key) {
    const s = new Set(open.value)
    s.has(key) ? s.delete(key) : s.add(key)
    open.value = s
}
const scopeLabel = computed(() => (region.value ? regionLabel(region.value) + (district.value ? ' ' + districtLabel(district.value) : '') : '전체 지역'))
</script>

<template>
    <section>
        <div class="erp-bar">
            <span class="erp-label">기간</span>
            <ErpRangePicker v-model="range" />
            <button class="erp-btn" :disabled="loading" @click="load(range)">🔍 조회</button>
        </div>

        <p v-if="loading" class="erp-empty">조회 중…</p>
        <p v-else-if="error" class="erp-error">{{ error }}</p>
        <template v-else-if="data">
            <p><span class="erp-range-info">{{ range.from }} ~ {{ range.to }}에 찾은 사람 · 유입자 지역 기준 · 뒤 단계는 오늘까지 도달한 수</span></p>

            <!-- 메인: 지역 → 구역 -->
            <div class="erp-section">
                <div class="erp-find-chips" role="group" aria-label="지역">
                    <button :class="['erp-chip', { on: !region }]" :aria-pressed="!region" @click="pickRegion('')">전체</button>
                    <button v-for="r in regions" :key="r" :class="['erp-chip', { on: region === r }]" :aria-pressed="region === r" @click="pickRegion(r)">{{ regionLabel(r) }}</button>
                </div>
                <h3 class="erp-h3">
                    {{ region ? `${regionLabel(region)} 구역별` : '지역별' }} 찾기
                    <span class="erp-sub">{{ region ? '구역을 누르면 아래 상세가 그 구역으로 바뀌어요' : '지역을 누르면 구역별로 들어가요' }}</span>
                </h3>
                <div class="erp-seg" role="group" aria-label="숫자 종류">
                    <button v-for="[k, l] in COLS" :key="k" :class="{ on: metric === k }" :aria-pressed="metric === k" @click="metric = k">{{ l }}</button>
                </div>
                <div class="erp-table-wrap">
                    <table class="erp-table erp-find">
                        <thead>
                            <tr><th scope="col">{{ region ? '구역' : '지역' }}</th><th v-for="c in MATRIX_COLS" :key="c" scope="col">{{ c }}</th><th scope="col">기타</th><th scope="col">합계</th></tr>
                        </thead>
                        <tbody>
                            <tr v-for="row in matrixRows" :key="row.key ?? 'none'" :class="['erp-find-pick', { on: region && district === row.key }]" @click="pickRow(row.key)">
                                <th scope="row">
                                    <button class="erp-find-toggle" :aria-pressed="region ? district === row.key : null" @click.stop="pickRow(row.key)">{{ row.label }} <span aria-hidden="true">›</span></button>
                                </th>
                                <td v-for="c in [...MATRIX_COLS, '기타']" :key="c" :class="{ 'erp-zero': !row.cells[c] }">{{ row.cells[c] }}</td>
                                <td><b>{{ row.cells.합계 }}</b></td>
                            </tr>
                        </tbody>
                        <tfoot>
                            <tr>
                                <th scope="row">{{ region ? regionLabel(region) + ' 합계' : '전체' }}</th>
                                <td v-for="c in [...MATRIX_COLS, '기타']" :key="c">{{ matrixTotal[c] }}</td>
                                <td>{{ matrixTotal.합계 }}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            <!-- 상세: 고른 범위의 활동 → 도구, 단계별 -->
            <div class="erp-section">
                <h3 class="erp-h3">{{ scopeLabel }} · 찾기 활동 → 도구별 <span class="erp-sub">활동을 누르면 도구가 펼쳐져요 · 홍보 = 소모임 + 온라인폼 · 합재양 전 shed 유입은 도구 노방(사쉐)</span></h3>
                <div class="erp-table-wrap">
                    <table class="erp-table erp-find">
                        <thead>
                            <tr><th scope="col">찾기 활동</th><th v-for="[k, l] in COLS" :key="k" scope="col">{{ l }}</th><th scope="col">찾기→재가</th></tr>
                        </thead>
                        <tbody v-for="g in groups" :key="g.side">
                            <tr class="erp-find-side">
                                <th scope="rowgroup">{{ g.side }}</th>
                                <td v-for="[k] in COLS" :key="k">{{ g.sum[k] || 0 }}</td>
                                <td>{{ pct(g.sum.jaega || 0, g.sum.reg || 0) }}</td>
                            </tr>
                            <template v-for="a in g.activities" :key="g.side + a.name">
                                <tr :class="{ 'erp-zero-row': !a.sum.reg }">
                                    <th scope="row">
                                        <button v-if="a.tools.length" class="erp-find-toggle" :aria-expanded="open.has(g.side + a.name)" @click="toggle(g.side + a.name)">
                                            <span aria-hidden="true">{{ open.has(g.side + a.name) ? '▾' : '▸' }}</span> {{ a.name }}
                                        </button>
                                        <span v-else class="erp-find-name">{{ a.name }}</span>
                                    </th>
                                    <td v-for="[k] in COLS" :key="k" :class="{ 'erp-zero': !a.sum[k] }">{{ a.sum[k] || 0 }}</td>
                                    <td>{{ pct(a.sum.jaega || 0, a.sum.reg || 0) }}</td>
                                </tr>
                                <template v-if="open.has(g.side + a.name)">
                                    <tr v-for="t in a.tools" :key="t.key" class="erp-find-tool">
                                        <th scope="row">{{ t.key }}</th>
                                        <td v-for="[k] in COLS" :key="k" :class="{ 'erp-zero': !t[k] }">{{ t[k] || 0 }}</td>
                                        <td>{{ pct(t.jaega || 0, t.reg || 0) }}</td>
                                    </tr>
                                </template>
                            </template>
                        </tbody>
                        <tfoot>
                            <tr>
                                <th scope="row">합계</th>
                                <td v-for="[k] in COLS" :key="k">{{ grand[k] || 0 }}</td>
                                <td>{{ pct(grand.jaega || 0, grand.reg || 0) }}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </template>
        <p v-else class="erp-empty">기간을 고르고 🔍 조회를 누르세요.</p>
    </section>
</template>
