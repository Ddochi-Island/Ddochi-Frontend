<script setup>
// ERP 전환 퍼널 — 번호찾 → 만남픽스 → 합재양 → 재가 → 매칭(만남) → 상담따기. 지역/구역으로 좁혀 보기
// 유입 코호트: 기간 안에 유입된 사람이 지금까지 어디까지 갔나 / 기간 내 발생: 기간 안에 단계별로 몇 건 일어났나
import { ref, computed } from 'vue'
import ErpRangePicker from './ErpRangePicker.vue'
import { useErpLoad, monthOf, total, pct, natCmp, regionLabel, districtLabel } from './erpUtil'

const range = ref(monthOf())
const { loading, error, data, load } = useErpLoad('/api/erp/funnel')
const view = ref('cohort')
const region = ref('')
const district = ref('')

const STAGES = [
    { label: '번호찾', cohort: 'reg', event: (r) => (r.inflowOn || 0) + (r.inflowOff || 0) },
    { label: '만남픽스', cohort: 'meet_fix', event: (r) => r.meetFix || 0 },
    { label: '합재양', cohort: 'hjy', event: (r) => r.hjy || 0 },
    { label: '재가', cohort: 'jaega', event: (r) => r.jaega || 0 },
    { label: '매칭(만남)', cohort: 'met', event: (r) => r.met || 0 },
    { label: '상담따기', cohort: 'consult', event: (r) => r.match_CONSULT_WIN || 0 },
]

const inScope = (r) => (!region.value || r.region === region.value) && (!district.value || r.district === district.value)
const regions = computed(() => [...new Set((data.value?.cohort || []).concat(data.value?.event || []).map((r) => r.region).filter(Boolean))].sort(natCmp))
const districts = computed(() => [...new Set((data.value?.cohort || []).filter((r) => r.region === region.value).map((r) => r.district).filter(Boolean))].sort(natCmp))

function counts(rows) {
    const t = total(rows)
    return STAGES.map((s) => (view.value === 'cohort' ? t[s.cohort] || 0 : s.event(t)))
}
const steps = computed(() => {
    if (!data.value) return []
    const c = counts((view.value === 'cohort' ? data.value.cohort : data.value.event).filter(inScope))
    return STAGES.map((s, i) => ({ label: s.label, n: c[i], width: c[0] ? Math.max(2, (c[i] / c[0]) * 100) : 0, step: i ? pct(c[i], c[i - 1]) : null }))
})
// 코호트만 온/오프 구분 가능(유입 유형은 사람에 붙어 있음)
const byType = computed(() => {
    if (!data.value || view.value !== 'cohort') return []
    const rows = data.value.cohort.filter(inScope)
    return [['오프라인', rows.filter((r) => r.type !== 'ONLINE')], ['온라인', rows.filter((r) => r.type === 'ONLINE')], ['전체', rows]]
        .map(([label, rs]) => { const t = total(rs); return { label, values: STAGES.map((s) => t[s.cohort] || 0) } })
})
const scopeLabel = computed(() => (region.value ? regionLabel(region.value) + (district.value ? ' ' + districtLabel(district.value) : '') : '전체'))
</script>

<template>
    <section>
        <div class="erp-bar">
            <ErpRangePicker v-model="range" />
            <button class="erp-btn" :disabled="loading" @click="load(range)">분석</button>
        </div>

        <p v-if="loading" class="erp-empty">분석 중…</p>
        <p v-else-if="error" class="erp-error">{{ error }}</p>
        <template v-else-if="data">
            <div class="erp-bar">
                <div class="erp-seg" role="group" aria-label="보기">
                    <button :class="{ on: view === 'cohort' }" :aria-pressed="view === 'cohort'" @click="view = 'cohort'">유입 코호트</button>
                    <button :class="{ on: view === 'event' }" :aria-pressed="view === 'event'" @click="view = 'event'">기간 내 발생</button>
                </div>
                <select v-model="region" class="erp-input erp-select" aria-label="지역" @change="district = ''">
                    <option value="">전체 지역</option>
                    <option v-for="r in regions" :key="r" :value="r">{{ regionLabel(r) }}</option>
                </select>
                <select v-if="region" v-model="district" class="erp-input erp-select" aria-label="구역">
                    <option value="">전체 구역</option>
                    <option v-for="d in districts" :key="d" :value="d">{{ districtLabel(d) }}</option>
                </select>
            </div>
            <p class="erp-note">
                <template v-if="view === 'cohort'">{{ range.from }} ~ {{ range.to }}에 유입된 {{ scopeLabel }} 사람들이 오늘까지 도달한 단계예요.</template>
                <template v-else>{{ range.from }} ~ {{ range.to }} 사이에 {{ scopeLabel }}에서 각 단계가 일어난 건수예요. 단계끼리 다른 사람이라 비율은 참고만 하세요.</template>
            </p>

            <ol class="erp-funnel">
                <li v-for="s in steps" :key="s.label">
                    <span class="erp-funnel-label">{{ s.label }}</span>
                    <span class="erp-funnel-track"><span class="erp-funnel-bar" :style="{ width: s.width + '%' }"></span></span>
                    <span class="erp-funnel-n">{{ s.n }}</span>
                    <span class="erp-funnel-step">{{ s.step ? '전 단계의 ' + s.step : '' }}</span>
                </li>
            </ol>

            <div v-if="byType.length" class="erp-table-wrap">
                <table class="erp-table">
                    <thead>
                        <tr><th scope="col">유입 유형</th><th v-for="s in STAGES" :key="s.label" scope="col">{{ s.label }}</th><th scope="col">번호찾→상따</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="t in byType" :key="t.label">
                            <th scope="row">{{ t.label }}</th>
                            <td v-for="(v, i) in t.values" :key="i" :class="{ 'erp-zero': !v }">{{ v }}</td>
                            <td>{{ pct(t.values[5], t.values[0]) }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </template>
        <p v-else class="erp-empty">기간을 고르고 분석을 누르세요.</p>
    </section>
</template>
