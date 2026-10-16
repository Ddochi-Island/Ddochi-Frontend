<script setup>
// ERP 찾기 분석 — 찾기까지의 활동만: 지역 → 구역별 활동량(일일보고 말걸기·DM·QR·홍보 학교)과 찾은 수(온라인 = 일일보고 온라인 찾기,
// 오프라인 = shed 도구 노방 등). 만픽 이후 단계는 전환 퍼널에서 봄 (2026-10-16 사용자 결정)
import { ref, computed } from 'vue'
import ErpRangePicker from './ErpRangePicker.vue'
import { useErpLoad, monthOf, total, natCmp, regionLabel, districtLabel } from './erpUtil'

const range = ref(monthOf())
const { loading, error, data, load } = useErpLoad('/api/erp/find')
const region = ref('')  // '' = 지역별, 고르면 그 지역의 구역별

const OFFLINE_ROUTES = new Set(['도구노방', '생노', '바따장', '노방', '오프찾'])
// 칸 정의 — [key, 라벨, 묶음]. 활동량·온라인 찾기는 일일보고, 오프라인 찾기는 사람 단위(shed 유입·합재양 경로)
const BASE_COLS = [
    ['talk', '말걸기', 'act'], ['dm', 'DM 보냄', 'act'], ['qr', 'QR 붙임', 'act'], ['promo', '홍보(학교)', 'act'],
    ['onlineFound', '온라인 찾기', 'find'], ['toolStreet', '도구 노방', 'find'], ['offEtc', '기타 오프', 'find'],
    ['found', '찾기 합계', 'sum'],
]
// '기타 오프' 머리를 누르면 그 안의 경로(생노 등)별 칸을 바로 옆에 펼침 — 이번 기간 데이터에 있는 경로만
const etcOpen = ref(false)
const etcRoutes = computed(() => [...new Set((data.value?.rows || [])
    .filter((r) => r.route && OFFLINE_ROUTES.has(r.route) && r.route !== '도구노방').map((r) => r.route))].sort(natCmp))
const COLS = computed(() => {
    if (!etcOpen.value) return BASE_COLS
    const i = BASE_COLS.findIndex((c) => c[0] === 'offEtc')
    return [...BASE_COLS.slice(0, i + 1), ...etcRoutes.value.map((r) => ['off:' + r, r, 'find sub']), ...BASE_COLS.slice(i + 1)]
})
const findSpan = computed(() => COLS.value.filter((c) => c[2].startsWith('find')).length)

// 오프라인 찾은 사람 — 도구 노방(모아는 이제 안 써서 도구 구분 없이 한 칸)과 그 외 오프 경로. 온라인 경로 행은 일일보고로 대신하므로 안 셈
function offlineOf(r) {
    if (!r.route || !OFFLINE_ROUTES.has(r.route)) return null
    return r.route === '도구노방' ? 'toolStreet' : 'offEtc'
}
const keyOf = (r) => (region.value ? r.district : r.region)
function cellsOf(people, daily) {
    const d = total(daily)
    const c = { talk: d.talk || 0, dm: d.dm || 0, qr: d.qr || 0, promo: d.promo || 0, onlineFound: d.onlineFound || 0, toolStreet: 0, offEtc: 0 }
    for (const r of people) {
        const k = offlineOf(r)
        if (!k) continue
        c[k] += r.reg
        if (k === 'offEtc') c['off:' + r.route] = (c['off:' + r.route] || 0) + r.reg
    }
    c.found = c.onlineFound + c.toolStreet + c.offEtc
    return c
}

const inRegion = (r) => !region.value || r.region === region.value
const people = computed(() => (data.value?.rows || []).filter(inRegion))
const daily = computed(() => (data.value?.daily || []).filter(inRegion))
const regions = computed(() => [...new Set([...(data.value?.rows || []), ...(data.value?.daily || [])].map((r) => r.region).filter(Boolean))].sort(natCmp))
const rows = computed(() => [...new Set([...people.value, ...daily.value].map(keyOf))].sort(natCmp).map((k) => ({
    key: k,
    label: region.value ? districtLabel(k) : regionLabel(k),
    cells: cellsOf(people.value.filter((r) => keyOf(r) === k), daily.value.filter((r) => keyOf(r) === k)),
})))
const sum = computed(() => cellsOf(people.value, daily.value))

// 구역 줄을 누르면 그 구역 사람별로 펼침(여러 구역 동시 가능)
const openDistricts = ref(new Set())
function pickRow(k) {
    if (!region.value) { region.value = k; openDistricts.value = new Set(); return }
    const s = new Set(openDistricts.value)
    s.has(k) ? s.delete(k) : s.add(k)
    openDistricts.value = s
}
function pickRegion(r) { region.value = r; openDistricts.value = new Set() }

// ── 그래프 — 찾기 구성(온라인 찾기 / 도구 노방 / 기타 오프) 가로 누적 막대, 줄은 표와 같음 ──
// 색: 검증된 기본 범주 팔레트 앞 3칸(흰 배경 all-pairs 통과). 청록은 대비 2.8:1이라 합계·범례·위 표로 보완
const SERIES = [['onlineFound', '온라인 찾기', '#2a78d6'], ['toolStreet', '도구 노방', '#eb6834'], ['offEtc', '기타 오프', '#1baf7a']]
const chartMax = computed(() => Math.max(1, ...rows.value.map((r) => r.cells.found)))
const segsOf = (cells) => SERIES.map(([k, label, color]) => ({ k, label, color, v: cells[k] || 0 })).filter((x) => x.v > 0)
const tip = ref(null)  // { x, y, row }
function showTip(e, row) {
    const box = e.currentTarget.closest('.erp-chart').getBoundingClientRect()
    tip.value = { x: e.clientX - box.left + 12, y: e.clientY - box.top + 12, row }
}
const membersOf = (dk) => (data.value?.members || [])
    .filter((m) => m.region === region.value && m.district === dk)
    .map((m) => ({ ...m, found: m.onlineFound + m.toolStreet + m.offEtc, act: m.talk + m.dm + m.qr + m.promo }))
    .filter((m) => m.found || m.act)  // 일일보고는 냈지만 숫자가 모두 0인 사람은 안 보임
    .sort((a, b) => b.found - a.found || b.act - a.act || a.name.localeCompare(b.name))
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
            <p><span class="erp-range-info">{{ range.from }} ~ {{ range.to }} · 찾기까지의 활동 · 만픽 이후는 전환 퍼널에서</span></p>
            <div class="erp-section">
                <div class="erp-find-chips" role="group" aria-label="지역">
                    <button :class="['erp-chip', { on: !region }]" :aria-pressed="!region" @click="pickRegion('')">전체</button>
                    <button v-for="r in regions" :key="r" :class="['erp-chip', { on: region === r }]" :aria-pressed="region === r" @click="pickRegion(r)">{{ regionLabel(r) }}</button>
                </div>
                <h3 class="erp-h3">
                    {{ region ? `${regionLabel(region)} 구역별` : '지역별' }} 찾기 활동
                    <span class="erp-sub">{{ region ? '구역을 누르면 사람별로 펼쳐져요 · ' : '지역을 누르면 구역별로 들어가요 · ' }}활동량·온라인 찾기 = 일일보고(제출 당시 소속), 오프라인 찾기 = shed 유입(유입자 지역)</span>
                </h3>
                <div class="erp-table-wrap">
                    <table class="erp-table erp-find">
                        <thead>
                            <tr>
                                <th scope="col" rowspan="2">{{ region ? '구역' : '지역' }}</th>
                                <th scope="colgroup" colspan="4" class="erp-grp act">활동량</th>
                                <th scope="colgroup" :colspan="findSpan" class="erp-grp find">찾기</th>
                                <th scope="col" rowspan="2">찾기 합계</th>
                            </tr>
                            <tr>
                                <th v-for="c in COLS.slice(0, -1)" :key="c[0]" scope="col" :class="c[2]">
                                    <button v-if="c[0] === 'offEtc' && etcRoutes.length" class="erp-col-toggle" :aria-expanded="etcOpen" @click="etcOpen = !etcOpen">
                                        {{ c[1] }} <span aria-hidden="true">{{ etcOpen ? '◂' : '▸' }}</span>
                                    </button>
                                    <template v-else>{{ c[1] }}</template>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <template v-for="row in rows" :key="row.key ?? 'none'">
                                <tr class="erp-find-pick" @click="pickRow(row.key)">
                                    <th scope="row">
                                        <button class="erp-find-toggle" :aria-expanded="region ? openDistricts.has(row.key) : null" @click.stop="pickRow(row.key)">
                                            <template v-if="region"><span aria-hidden="true">{{ openDistricts.has(row.key) ? '▾' : '▸' }}</span> {{ row.label }}</template>
                                            <template v-else>{{ row.label }} <span aria-hidden="true">›</span></template>
                                        </button>
                                    </th>
                                    <td v-for="c in COLS" :key="c[0]" :class="[c[2], { 'erp-zero': !row.cells[c[0]] }]">
                                        <b v-if="c[2] === 'sum'">{{ row.cells[c[0]] }}</b><template v-else>{{ (row.cells[c[0]] || 0).toLocaleString() }}</template>
                                    </td>
                                </tr>
                                <template v-if="region && openDistricts.has(row.key)">
                                    <tr v-for="m in membersOf(row.key)" :key="m.memberId" class="erp-find-person">
                                        <th scope="row">{{ m.name }}</th>
                                        <td v-for="c in COLS" :key="c[0]" :class="[c[2], { 'erp-zero': !m[c[0]] }]">{{ (m[c[0]] || 0).toLocaleString() }}</td>
                                    </tr>
                                    <tr v-if="!membersOf(row.key).length" class="erp-find-person"><th scope="row" :colspan="COLS.length + 1">이 기간에 활동하거나 찾은 사람이 없어요</th></tr>
                                </template>
                            </template>
                        </tbody>
                        <tfoot>
                            <tr>
                                <th scope="row">{{ region ? regionLabel(region) + ' 합계' : '전체' }}</th>
                                <td v-for="c in COLS" :key="c[0]" :class="c[2]">{{ (sum[c[0]] || 0).toLocaleString() }}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                <figure class="erp-chart" @mouseleave="tip = null">
                    <figcaption class="erp-chart-head">
                        <span class="erp-chart-title">찾기 구성</span>
                        <span class="erp-chart-legend">
                            <span v-for="[k, label, color] in SERIES" :key="k"><i :style="{ background: color }"></i>{{ label }}</span>
                        </span>
                    </figcaption>
                    <div v-for="row in rows" :key="'c' + (row.key ?? 'none')" class="erp-chart-row"
                         :aria-label="`${row.label} 찾기 ${row.cells.found}명: ` + SERIES.map(([k, l]) => `${l} ${row.cells[k] || 0}`).join(', ')">
                        <span class="erp-chart-label">{{ row.label }}</span>
                        <span class="erp-chart-track" @mousemove="showTip($event, row)">
                            <span class="erp-chart-bar" :style="{ width: `calc((100% - 48px) * ${row.cells.found / chartMax})` }">
                                <span v-for="sg in segsOf(row.cells)" :key="sg.k" class="erp-chart-seg"
                                      :style="{ flexGrow: sg.v, background: sg.color }"></span>
                            </span>
                            <span class="erp-chart-total">{{ row.cells.found }}</span>
                        </span>
                    </div>
                    <div v-if="tip" class="erp-chart-tip" :style="{ left: tip.x + 'px', top: tip.y + 'px' }" role="status">
                        <b>{{ tip.row.label }}</b> · 찾기 {{ tip.row.cells.found }}명
                        <div v-for="[k, label, color] in SERIES" :key="k"><i :style="{ background: color }"></i>{{ label }} {{ tip.row.cells[k] || 0 }}</div>
                    </div>
                </figure>

                <p class="erp-note" style="margin: 10px 0 0">
                    홍보(학교) = 일일보고에 적은 홍보 학교 수 · 인스타 광고는 일일보고에 칸이 없어 활동량이 없어요 ·
                    도구 노방 = shed로 받은 사람
                </p>
            </div>
        </template>
        <p v-else class="erp-empty">기간을 고르고 🔍 조회를 누르세요.</p>
    </section>
</template>
