<script setup>
// ERP 주간 보고서 — 일~토 한 주의 일일보고·섭외·매칭 결과를 지역별(지역 고르면 구역별)로, 전주와 비교. 재가·매칭 명단 포함
import { ref, computed } from 'vue'
import ErpRangePicker from './ErpRangePicker.vue'
import { useErpLoad, weekOf, sumBy, total, natCmp, regionLabel, districtLabel, fmtDate, fmtDateTime } from './erpUtil'

const range = ref(weekOf())
const { loading, error, data, load } = useErpLoad('/api/erp/weekly')
const region = ref('')

const SECTIONS = [
    { title: '일일보고', note: '제출 당시 소속 기준', cols: [['reports', '보고'], ['talk', '말걸기'], ['dm', 'DM'], ['qr', 'QR'], ['online_intake', '온라인 찾기']] },
    { title: '섭외', note: '유입자 지역 기준', cols: [['inflowOff', '오프 찾기'], ['inflowOn', '온 찾기'], ['meetFix', '만픽'], ['hjy', '합재양'], ['jaega', '재가']] },
    { title: '매칭 결과', note: '인도자 지역 · 만남 예정일 기준', cols: [['met', '만남'], ['match_CONSULT_WIN', '상연'], ['match_SECOND_MEET', '2차'], ['match_DROPOUT', '탈락'], ['match_UNFIT', '비합'], ['match_CANCEL', '취소'], ['match_DELAY', '밀림'], ['match_PENDING', '진행 예정']] },
]

const inRegion = (r) => !region.value || r.region === region.value
const keyOf = (r) => (region.value ? r.district : r.region)
const labelOf = (k) => (region.value ? districtLabel(k) : regionLabel(k))

const regions = computed(() => [...new Set((data.value?.cur || []).map((r) => r.region).filter(Boolean))].sort(natCmp))
const table = computed(() => {
    if (!data.value) return { rows: [], sum: {}, prevSum: {} }
    const cur = data.value.cur.filter(inRegion)
    const prev = data.value.prev.filter(inRegion)
    const prevBy = Object.fromEntries(sumBy(prev, keyOf).map((r) => [r.key, r]))
    const keys = [...new Set([...cur.map(keyOf), ...prev.map(keyOf)])].sort(natCmp)
    const curBy = Object.fromEntries(sumBy(cur, keyOf).map((r) => [r.key, r]))
    return {
        rows: keys.map((k) => ({ key: k, label: labelOf(k), cur: curBy[k] || {}, prev: prevBy[k] || {} })),
        sum: total(cur),
        prevSum: total(prev),
    }
})
const jaegaList = computed(() => (data.value?.jaegaDetails || []).filter((r) => !region.value || r.region_code === region.value))
const matchList = computed(() => (data.value?.matchDetails || []).filter((r) => !region.value || r.region_code === region.value))

function delta(c = 0, p = 0) {
    const d = c - p
    return d > 0 ? { t: `▲${d}`, cls: 'up' } : d < 0 ? { t: `▼${-d}`, cls: 'down' } : { t: '–', cls: '' }
}
</script>

<template>
    <section>
        <div class="erp-bar">
            <span class="erp-label">주차 (일~토)</span>
            <ErpRangePicker v-model="range" week />
            <template v-if="data">
                <span class="erp-label">지역</span>
                <select v-model="region" class="erp-input erp-select" aria-label="지역">
                    <option value="">전체 지역</option>
                    <option v-for="r in regions" :key="r" :value="r">{{ regionLabel(r) }}</option>
                </select>
            </template>
            <button class="erp-btn" :disabled="loading" @click="load(range)">🔍 집계</button>
        </div>

        <p v-if="loading" class="erp-empty">집계 중…</p>
        <p v-else-if="error" class="erp-error">{{ error }}</p>
        <template v-else-if="data">
            <p><span class="erp-range-info">{{ data.range.from }} ~ {{ data.range.to }} · ▲▼는 전주({{ data.prevRange.from }} ~ {{ data.prevRange.to }}) 대비</span></p>

            <div v-for="(sec, si) in SECTIONS" :key="sec.title" class="erp-section">
                <h3 class="erp-h3">{{ '①②③'[si] }} {{ sec.title }} <span class="erp-sub">{{ sec.note }}</span></h3>
                <div class="erp-table-wrap">
                    <table class="erp-table">
                        <thead>
                            <tr><th scope="col">{{ region ? '구역' : '지역' }}</th><th v-for="[k, l] in sec.cols" :key="k" scope="col">{{ l }}</th></tr>
                        </thead>
                        <tbody>
                            <tr v-for="r in table.rows" :key="r.key ?? 'none'">
                                <th scope="row">{{ r.label }}</th>
                                <td v-for="[k] in sec.cols" :key="k" :class="{ 'erp-zero': !r.cur[k] }">
                                    {{ r.cur[k] || 0 }} <small :class="['erp-delta', delta(r.cur[k], r.prev[k]).cls]">{{ delta(r.cur[k], r.prev[k]).t }}</small>
                                </td>
                            </tr>
                        </tbody>
                        <tfoot>
                            <tr>
                                <th scope="row">합계</th>
                                <td v-for="[k] in sec.cols" :key="k">
                                    {{ table.sum[k] || 0 }} <small :class="['erp-delta', delta(table.sum[k], table.prevSum[k]).cls]">{{ delta(table.sum[k], table.prevSum[k]).t }}</small>
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            <details class="erp-section">
                <summary><h3 class="erp-h3">재가 명단 <span class="erp-sub">{{ jaegaList.length }}명</span></h3></summary>
                <div class="erp-table-wrap">
                    <table class="erp-table erp-table-left">
                        <thead><tr><th scope="col">날짜</th><th scope="col">이름</th><th scope="col">유입자</th><th scope="col">인도자</th><th scope="col">소속</th></tr></thead>
                        <tbody>
                            <tr v-for="(r, i) in jaegaList" :key="i">
                                <td>{{ fmtDate(r.at) }}</td><td>{{ r.name }}</td><td>{{ r.introducer_name }}</td><td>{{ r.guide_name || '–' }}</td>
                                <td>{{ regionLabel(r.region_code) }} {{ districtLabel(r.district_code) }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </details>
            <details class="erp-section">
                <summary><h3 class="erp-h3">매칭 명단 <span class="erp-sub">{{ matchList.length }}건</span></h3></summary>
                <div class="erp-table-wrap">
                    <table class="erp-table erp-table-left">
                        <thead><tr><th scope="col">만남</th><th scope="col">이름</th><th scope="col">인도자</th><th scope="col">교사</th><th scope="col">도구</th><th scope="col">결과</th><th scope="col">소속</th></tr></thead>
                        <tbody>
                            <tr v-for="(r, i) in matchList" :key="i">
                                <td>{{ fmtDateTime(r.at) }}</td><td>{{ r.name }}</td><td>{{ r.guide_name || '–' }}</td><td>{{ r.teacher_name || '–' }}</td>
                                <td>{{ r.tool || '–' }}</td><td>{{ r.match_degree }}차 {{ r.result_label }}</td>
                                <td>{{ regionLabel(r.region_code) }} {{ districtLabel(r.district_code) }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </details>
        </template>
        <p v-else class="erp-empty">주차 선택 후 🔍 집계를 누르세요.</p>
    </section>
</template>
