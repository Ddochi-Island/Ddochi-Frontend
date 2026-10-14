<script setup>
// ERP 전환 퍼널 분석(ST004) — 찾기 → 만남픽스 → 합재양 → 재가 → 매칭(만남) → 상담연결. 구 ERP 스텝 깔때기 모양
// 유입 코호트: 기간 안에 유입된 사람이 지금까지 어디까지 갔나 / 기간 내 발생: 기간 안에 단계별로 몇 건 일어났나
import { ref, computed } from 'vue'
import ErpRangePicker from './ErpRangePicker.vue'
import { useErpLoad, monthOf, total, pct, natCmp, regionLabel, districtLabel } from './erpUtil'

const range = ref(monthOf())
const { loading, error, data, load } = useErpLoad('/api/erp/funnel')
const view = ref('cohort')
const region = ref('')
const district = ref('')

// 색은 구 ERP 깔때기(진한 남색 → 옅은 파랑)
const STAGES = [
    { label: '찾기', cohort: 'reg', event: (r) => (r.inflowOn || 0) + (r.inflowOff || 0), c: ['#1e4080', '#2a5599'] },
    { label: '만남픽스', cohort: 'meet_fix', event: (r) => r.meetFix || 0, c: ['#2a5599', '#4e6ea8'] },
    { label: '합재양', cohort: 'hjy', event: (r) => r.hjy || 0, c: ['#3d5f9c', '#5e81b6'] },
    { label: '재가', cohort: 'jaega', event: (r) => r.jaega || 0, c: ['#4e6ea8', '#7aa4d6'] },
    { label: '매칭(만남)', cohort: 'met', event: (r) => r.met || 0, c: ['#5e81b6', '#8fb0d9'] },
    { label: '상담연결', cohort: 'consult', event: (r) => r.match_CONSULT_WIN || 0, c: ['#7aa4d6', '#aac4e5'] },
]

const inScope = (r) => (!region.value || r.region === region.value) && (!district.value || r.district === district.value)
const regions = computed(() => [...new Set((data.value?.cohort || []).concat(data.value?.event || []).map((r) => r.region).filter(Boolean))].sort(natCmp))
const districts = computed(() => [...new Set((data.value?.cohort || []).filter((r) => r.region === region.value).map((r) => r.district).filter(Boolean))].sort(natCmp))

const counts = computed(() => {
    if (!data.value) return []
    const t = total((view.value === 'cohort' ? data.value.cohort : data.value.event).filter(inScope))
    return STAGES.map((s) => (view.value === 'cohort' ? t[s.cohort] || 0 : s.event(t)))
})
const pct2 = (n, d) => (d ? `${((n / d) * 100).toFixed(2)}%` : '—')
const steps = computed(() => {
    const c = counts.value
    return STAGES.map((s, i) => {
        const prev = i ? c[i - 1] : null
        return {
            ...s, n: c[i],
            width: Math.max(c[0] ? (c[i] / c[0]) * 100 : 0, 22),
            pct: i ? `전체 ${pct2(c[i], c[0])} · 직전 ${pct2(c[i], prev)}` : '전체 100% · 기준',
            drop: i ? prev - c[i] : null,
            dropPct: i && prev ? (((prev - c[i]) / prev) * 100).toFixed(2) : null,
        }
    })
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
            <button class="erp-btn" :disabled="loading" @click="load(range)">🔍 실행</button>
        </div>

        <p v-if="loading" class="erp-empty">분석 중…</p>
        <p v-else-if="error" class="erp-error">{{ error }}</p>
        <template v-else-if="data">
            <p><span class="erp-range-info">{{ range.from }} ~ {{ range.to }} · {{ scopeLabel }}</span></p>
            <div class="erp-seg" role="group" aria-label="보기">
                <button :class="{ on: view === 'cohort' }" :aria-pressed="view === 'cohort'" @click="view = 'cohort'">찾기 코호트</button>
                <button :class="{ on: view === 'event' }" :aria-pressed="view === 'event'" @click="view = 'event'">기간 내 발생</button>
            </div>
            <p class="erp-note">
                <template v-if="view === 'cohort'">기간 안에 찾은 사람들이 오늘까지 도달한 단계예요.</template>
                <template v-else>기간 안에 각 단계가 일어난 건수예요. 단계끼리 다른 사람이라 비율은 참고만 하세요.</template>
            </p>

            <div class="erp-funnel">
                <template v-for="(s, i) in steps" :key="s.label">
                    <div v-if="i > 0" :class="['erp-drop-ind', { hold: s.drop <= 0 }]">
                        <template v-if="s.drop > 0">⬇ {{ s.drop }}건 이탈<span class="pct">({{ s.dropPct }}%)</span></template>
                        <template v-else-if="s.drop === 0">— 유지</template>
                        <template v-else>▲ 순증가 +{{ -s.drop }}건</template>
                    </div>
                    <div class="erp-step-row">
                        <div class="erp-step" :style="{ width: s.width + '%', background: `linear-gradient(to right, ${s.c[0]}, ${s.c[1]})` }">
                            <span class="name">{{ s.label }}</span>
                            <span class="count">{{ s.n }}</span>
                            <span class="pct">{{ s.pct }}</span>
                        </div>
                    </div>
                </template>
            </div>

            <div v-if="byType.length" class="erp-section">
                <h3 class="erp-h3">찾기 유형별</h3>
                <div class="erp-table-wrap">
                    <table class="erp-table">
                        <thead>
                            <tr><th scope="col">찾기 유형</th><th v-for="s in STAGES" :key="s.label" scope="col">{{ s.label }}</th></tr>
                        </thead>
                        <tbody>
                            <tr v-for="t in byType" :key="t.label">
                                <th scope="row">{{ t.label }}</th>
                                <td v-for="(v, i) in t.values" :key="i" :class="{ 'erp-zero': !v }">
                                    {{ v }}<span v-if="i" class="erp-sub"> ({{ pct(v, t.values[0]) }})</span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </template>
        <p v-else class="erp-empty">범위와 기간을 선택하고 실행을 누르세요.</p>
    </section>
</template>
