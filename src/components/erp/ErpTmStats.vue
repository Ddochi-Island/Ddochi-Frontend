<script setup>
// ERP TM 결과 집계 — 기간 안 통화 결과를 지역 → 구역 → 개인으로 내려가며 봄. 통화한 사람의 현재 소속 기준
import { ref, computed } from 'vue'
import ErpRangePicker from './ErpRangePicker.vue'
import { useErpLoad, weekOf, sumBy, total, pct, regionLabel, districtLabel, natCmp } from './erpUtil'

const range = ref(weekOf())
const { loading, error, data, load } = useErpLoad('/api/erp/tm-stats')
const region = ref(null)    // 고른 지역 (null = 지역별 보기)
const district = ref(null)  // 고른 구역 (null = 구역별 보기)

const COLS = [
    ['total', '통화'], ['NO_ANSWER', '부재중'], ['RESERVED_TM', '예약'], ['MEET_FIX', '만픽'],
    ['UNFIT', '비합'], ['REJECT', '거절'], ['INVALID', '무효'], ['jaega', '재가'],
]

function run() {
    region.value = district.value = null
    load(range.value)
}

const level = computed(() => (region.value === null ? 'region' : district.value === null ? 'district' : 'person'))
const rows = computed(() => {
    const all = data.value?.rows || []
    if (level.value === 'region') return sumBy(all, (r) => r.region).map((r) => ({ ...r, label: regionLabel(r.key) }))
    const inRegion = all.filter((r) => r.region === region.value)
    if (level.value === 'district') return sumBy(inRegion, (r) => r.district).map((r) => ({ ...r, label: districtLabel(r.key) }))
    return inRegion.filter((r) => r.district === district.value)
        .map((r) => ({ ...r, key: r.memberId, label: r.name }))
        .sort((a, b) => b.total - a.total || natCmp(a.label, b.label))
})
const sum = computed(() => total(rows.value))

function drill(r) {
    if (level.value === 'region') region.value = r.key
    else if (level.value === 'district') district.value = r.key
}
</script>

<template>
    <section>
        <div class="erp-bar">
            <span class="erp-label">기간</span>
            <ErpRangePicker v-model="range" />
            <button class="erp-btn" :disabled="loading" @click="run">🔍 집계</button>
        </div>
        <p class="erp-note">만픽률 = 만픽 ÷ 통화. 재가는 그 사람의 마지막 만남픽스를 잡은 티엠자에게 셉니다.</p>

        <p v-if="loading" class="erp-empty">집계 중…</p>
        <p v-else-if="error" class="erp-error">{{ error }}</p>
        <template v-else-if="data">
            <nav class="erp-crumbs" aria-label="위치">
                <button class="erp-link" :disabled="level === 'region'" @click="region = district = null">전체</button>
                <template v-if="region !== null"> › <button class="erp-link" :disabled="level === 'district'" @click="district = null">{{ regionLabel(region) }}</button></template>
                <template v-if="district !== null"> › {{ districtLabel(district) }}</template>
            </nav>
            <p v-if="!rows.length" class="erp-empty">이 기간엔 통화 기록이 없어요. 기간을 넓혀 다시 집계해 보세요.</p>
            <div v-else class="erp-table-wrap">
                <table class="erp-table">
                    <thead>
                        <tr>
                            <th scope="col">{{ level === 'region' ? '지역' : level === 'district' ? '구역' : '티엠자' }}</th>
                            <th v-for="[k, l] in COLS" :key="k" scope="col">{{ l }}</th>
                            <th scope="col">만픽률</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="r in rows" :key="r.key ?? 'none'" :class="{ 'erp-click': level !== 'person' }" @click="drill(r)">
                            <th scope="row">
                                <button v-if="level !== 'person'" class="erp-link" @click.stop="drill(r)">{{ r.label }} ›</button>
                                <template v-else>{{ r.label }}</template>
                            </th>
                            <td v-for="[k] in COLS" :key="k" :class="{ 'erp-zero': !r[k] }">{{ r[k] || 0 }}</td>
                            <td>{{ pct(r.MEET_FIX, r.total) }}</td>
                        </tr>
                    </tbody>
                    <tfoot>
                        <tr>
                            <th scope="row">합계</th>
                            <td v-for="[k] in COLS" :key="k">{{ sum[k] || 0 }}</td>
                            <td>{{ pct(sum.MEET_FIX, sum.total) }}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </template>
        <p v-else class="erp-empty">기간 선택 후 🔍 집계를 누르세요.</p>
    </section>
</template>
