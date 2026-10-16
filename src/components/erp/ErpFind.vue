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
const COLS = [
    ['talk', '말걸기', 'act'], ['dm', 'DM 보냄', 'act'], ['qr', 'QR 붙임', 'act'], ['promo', '홍보(학교)', 'act'],
    ['onlineFound', '온라인 찾기', 'find'], ['toolStreet', '도구 노방', 'find'], ['offEtc', '기타 오프', 'find'],
    ['found', '찾기 합계', 'sum'],
]

// 오프라인 찾은 사람 — 도구 노방(모아는 이제 안 써서 도구 구분 없이 한 칸)과 그 외 오프 경로. 온라인 경로 행은 일일보고로 대신하므로 안 셈
function offlineOf(r) {
    if (!r.route || !OFFLINE_ROUTES.has(r.route)) return null
    return r.route === '도구노방' ? 'toolStreet' : 'offEtc'
}
const keyOf = (r) => (region.value ? r.district : r.region)
function cellsOf(people, daily) {
    const d = total(daily)
    const c = { talk: d.talk || 0, dm: d.dm || 0, qr: d.qr || 0, promo: d.promo || 0, onlineFound: d.onlineFound || 0, toolStreet: 0, offEtc: 0 }
    for (const r of people) { const k = offlineOf(r); if (k) c[k] += r.reg }
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

function pickRow(k) { if (!region.value) region.value = k }
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
                    <button :class="['erp-chip', { on: !region }]" :aria-pressed="!region" @click="region = ''">전체</button>
                    <button v-for="r in regions" :key="r" :class="['erp-chip', { on: region === r }]" :aria-pressed="region === r" @click="region = r">{{ regionLabel(r) }}</button>
                </div>
                <h3 class="erp-h3">
                    {{ region ? `${regionLabel(region)} 구역별` : '지역별' }} 찾기 활동
                    <span class="erp-sub">{{ region ? '' : '지역을 누르면 구역별로 들어가요 · ' }}활동량·온라인 찾기 = 일일보고(제출 당시 소속), 오프라인 찾기 = shed 유입(유입자 지역)</span>
                </h3>
                <div class="erp-table-wrap">
                    <table class="erp-table erp-find">
                        <thead>
                            <tr>
                                <th scope="col" rowspan="2">{{ region ? '구역' : '지역' }}</th>
                                <th scope="colgroup" colspan="4" class="erp-grp act">활동량</th>
                                <th scope="colgroup" colspan="3" class="erp-grp find">찾기</th>
                                <th scope="col" rowspan="2">찾기 합계</th>
                            </tr>
                            <tr><th v-for="c in COLS.slice(0, 7)" :key="c[0]" scope="col" :class="c[2]">{{ c[1] }}</th></tr>
                        </thead>
                        <tbody>
                            <tr v-for="row in rows" :key="row.key ?? 'none'" :class="{ 'erp-find-pick': !region }" @click="pickRow(row.key)">
                                <th scope="row">
                                    <button v-if="!region" class="erp-find-toggle" @click.stop="pickRow(row.key)">{{ row.label }} <span aria-hidden="true">›</span></button>
                                    <span v-else class="erp-find-name">{{ row.label }}</span>
                                </th>
                                <td v-for="c in COLS" :key="c[0]" :class="[c[2], { 'erp-zero': !row.cells[c[0]] }]">
                                    <b v-if="c[2] === 'sum'">{{ row.cells[c[0]] }}</b><template v-else>{{ row.cells[c[0]].toLocaleString() }}</template>
                                </td>
                            </tr>
                        </tbody>
                        <tfoot>
                            <tr>
                                <th scope="row">{{ region ? regionLabel(region) + ' 합계' : '전체' }}</th>
                                <td v-for="c in COLS" :key="c[0]" :class="c[2]">{{ sum[c[0]].toLocaleString() }}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                <p class="erp-note" style="margin: 10px 0 0">
                    홍보(학교) = 일일보고에 적은 홍보 학교 수 · 인스타 광고는 일일보고에 칸이 없어 활동량이 없어요 ·
                    도구 노방 = shed로 받은 사람
                </p>
            </div>
        </template>
        <p v-else class="erp-empty">기간을 고르고 🔍 조회를 누르세요.</p>
    </section>
</template>
