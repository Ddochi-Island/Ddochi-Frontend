<script setup>
// ERP 찾기 분석 — 기간 안에 찾은 사람을 온/오프 → 찾기 활동(인스타 디엠·큐알·인스타 광고·홍보·도구 노방 …) → 도구별로 나누고,
// 그 뒤 만픽·합재양·재가·만남·상연까지 간 수. 활동은 합재양의 경로(합재양 전 shed 유입은 도구노방·사쉐)로 정함
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
const districts = computed(() => [...new Set((data.value?.rows || []).filter((r) => r.region === region.value).map((r) => r.district).filter(Boolean))].sort(natCmp))
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
            <template v-if="data">
                <span class="erp-label">범위</span>
                <select v-model="region" class="erp-input erp-select" aria-label="지역" @change="district = ''">
                    <option value="">전체 지역</option>
                    <option v-for="r in regions" :key="r" :value="r">{{ regionLabel(r) }}</option>
                </select>
                <select v-if="region" v-model="district" class="erp-input erp-select" aria-label="구역">
                    <option value="">전체 구역</option>
                    <option v-for="d in districts" :key="d" :value="d">{{ districtLabel(d) }}</option>
                </select>
            </template>
            <button class="erp-btn" :disabled="loading" @click="load(range)">🔍 조회</button>
        </div>

        <p v-if="loading" class="erp-empty">조회 중…</p>
        <p v-else-if="error" class="erp-error">{{ error }}</p>
        <template v-else-if="data">
            <p><span class="erp-range-info">{{ range.from }} ~ {{ range.to }}에 찾은 사람 · {{ scopeLabel }} · 뒤 단계는 오늘까지 도달한 수</span></p>
            <p class="erp-note">찾기 활동은 합재양에 적은 경로로 나눠요. 홍보 = 소모임 + 온라인폼. 합재양 전인 shed 유입은 도구 노방(사쉐)으로 셉니다. 활동을 누르면 도구별로 펼쳐져요.</p>

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
                            <th scope="row">전체</th>
                            <td v-for="[k] in COLS" :key="k">{{ grand[k] || 0 }}</td>
                            <td>{{ pct(grand.jaega || 0, grand.reg || 0) }}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </template>
        <p v-else class="erp-empty">기간을 고르고 🔍 조회를 누르세요.</p>
    </section>
</template>
