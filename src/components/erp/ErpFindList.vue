<script setup>
// ERP 주간 찾기 명단(찾기 분석 하위) — shed로 들어온 사람을 이관받은 날 기준 기간으로. 섭외자·인도자·유입자·소속·찾기장소·단계, "섭외자/인도자" 복사
import { ref, computed } from 'vue'
import ErpRangePicker from './ErpRangePicker.vue'
import { useErpLoad, weekOf, natCmp, regionLabel, districtLabel, fmtDateTime } from './erpUtil'
import { usePopup } from '@/composables/usePopup'

const { showToast } = usePopup()
const range = ref(weekOf())
const { loading, error, data, load } = useErpLoad('/api/erp/find-list')
const region = ref('')
const loaded = ref(null)  // 조회한 기간 — 복사 글 머리에 씀
async function run() { const r = { ...range.value }; if (await load(r)) loaded.value = r }

const STAGE_NAME = { 유입: '찾기', 상따: '상연' }  // DB 값은 그대로, 보이는 이름만(10/14 명칭 변경)
const regions = computed(() => [...new Set((data.value?.rows || []).map((r) => r.region_code).filter(Boolean))].sort(natCmp))
const rows = computed(() => (data.value?.rows || []).filter((r) => !region.value || r.region_code === region.value))
const byRegion = computed(() => Object.fromEntries(regions.value.map((rg) => [rg, (data.value?.rows || []).filter((r) => r.region_code === rg).length])))

const md = (ymd) => `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}`
function copy() {
    const scope = region.value ? regionLabel(region.value) : '전체'
    const text = [
        `[주간 찾기 명단] ${md(loaded.value.from)}~${md(loaded.value.to)} · ${scope} · ${rows.value.length}명`,
        '섭외자/인도자',
        ...rows.value.map((r) => `- ${r.name}/${r.guide_name || '-'}`),
    ].join('\n')
    navigator.clipboard.writeText(text).catch(() => {})
    showToast('📋 명단 복사됨')
}
</script>

<template>
    <section>
        <div class="erp-bar">
            <span class="erp-label">이관받은 날</span>
            <ErpRangePicker v-model="range" />
            <button class="erp-btn" :disabled="loading" @click="run">🔍 조회</button>
        </div>

        <p v-if="loading" class="erp-empty">조회 중…</p>
        <p v-else-if="error" class="erp-error">{{ error }}</p>
        <template v-else-if="data && loaded">
            <div class="erp-section">
                <div class="erp-find-chips" role="group" aria-label="지역">
                    <button :class="['erp-chip', { on: !region }]" :aria-pressed="!region" @click="region = ''">전체 {{ data.rows.length }}</button>
                    <button v-for="rg in regions" :key="rg" :class="['erp-chip', { on: region === rg }]" :aria-pressed="region === rg" @click="region = rg">
                        {{ regionLabel(rg) }} {{ byRegion[rg] }}
                    </button>
                    <button class="erp-btn" style="margin-left: auto" :disabled="!rows.length" @click="copy">섭외자/인도자 복사</button>
                </div>
                <h3 class="erp-h3">
                    {{ md(loaded.from) }}~{{ md(loaded.to) }} shed 이관 명단 <span class="erp-sub">{{ rows.length }}명 · 이관받은 순서 · 인도자는 합재양을 쓴 뒤에 생겨요 · 지역은 유입자 기준</span>
                </h3>
                <p v-if="!rows.length" class="erp-empty">이 기간에 이관받은 shed 명단이 없어요.</p>
                <div v-else class="erp-table-wrap">
                    <table class="erp-table erp-table-left">
                        <thead>
                            <tr><th scope="col">이관받은 날</th><th scope="col">섭외자</th><th scope="col">인도자</th><th scope="col">유입자</th><th scope="col">소속</th><th scope="col">찾기장소</th><th scope="col">단계</th></tr>
                        </thead>
                        <tbody>
                            <tr v-for="r in rows" :key="r.sarang_id">
                                <td>{{ fmtDateTime(r.accepted_at) }}</td>
                                <td><b>{{ r.name }}</b></td>
                                <td :class="{ 'erp-zero': !r.guide_name }">{{ r.guide_name || '—' }}</td>
                                <td>{{ r.introducer_name || '—' }}</td>
                                <td>{{ regionLabel(r.region_code) }} {{ districtLabel(r.district_code) }}</td>
                                <td>{{ r.location || '—' }}</td>
                                <td><span class="erp-stage">{{ STAGE_NAME[r.stage] || r.stage }}</span></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </template>
        <p v-else class="erp-empty">이관받은 기간을 고르고 🔍 조회를 누르세요.</p>
    </section>
</template>
