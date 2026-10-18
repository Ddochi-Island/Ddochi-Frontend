<script setup>
// ERP 주간 찾기 명단(찾기 분석 하위) — shed로 들어와 아직 찾기 단계인 사람을 이관받은 날 기준 기간으로. 섭외자·유입자·조력자·소속·찾기장소, 시트에 바로 붙는 표 복사(탭 구분)
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

const regions = computed(() => [...new Set((data.value?.rows || []).map((r) => r.region_code).filter(Boolean))].sort(natCmp))
const rows = computed(() => (data.value?.rows || []).filter((r) => !region.value || r.region_code === region.value))
const byRegion = computed(() => Object.fromEntries(regions.value.map((rg) => [rg, (data.value?.rows || []).filter((r) => r.region_code === rg).length])))

const md = (ymd) => `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}`
// 스프레드시트에 그대로 붙게 탭 구분(TSV) — 첫 줄은 열 이름. 칸 안의 탭·줄바꿈은 공백으로 바꿔 칸이 밀리지 않게
const cell = (v) => String(v ?? '').replace(/[\t\r\n]+/g, ' ').trim()
const kst = (iso) => {
    const d = new Date(new Date(iso).getTime() + 9 * 3600e3)  // KST로 옮겨서 YYYY-MM-DD HH:mm
    return d.toISOString().slice(0, 16).replace('T', ' ')
}
function copy() {
    const head = ['이관받은 날', '섭외자', '유입자', '조력자', '지역', '구역', '찾기장소']
    const lines = rows.value.map((r) => [
        kst(r.accepted_at), r.name, r.introducer_name, r.helper_names,
        r.region_code ? `${r.region_code}지역` : '', r.district_code ? `${r.district_code}구역` : '', r.location,
    ].map(cell).join('\t'))
    navigator.clipboard.writeText([head.join('\t'), ...lines].join('\n')).catch(() => {})
    showToast(`📋 ${rows.value.length}명 복사됨 — 시트에 붙여넣으세요`)
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
                    <button class="erp-btn" style="margin-left: auto" :disabled="!rows.length" @click="copy">시트용 복사</button>
                </div>
                <h3 class="erp-h3">
                    {{ md(loaded.from) }}~{{ md(loaded.to) }} shed 이관 명단 — 찾기 단계만 <span class="erp-sub">{{ rows.length }}명 · 이관받은 순서 · 티엠 이후로 넘어간 사람은 빠져요 · 지역은 유입자 기준</span>
                </h3>
                <p v-if="!rows.length" class="erp-empty">이 기간에 이관받고 아직 찾기 단계인 사람이 없어요.</p>
                <div v-else class="erp-table-wrap">
                    <table class="erp-table erp-table-left">
                        <thead>
                            <tr><th scope="col">이관받은 날</th><th scope="col">섭외자</th><th scope="col">유입자</th><th scope="col">조력자</th><th scope="col">소속</th><th scope="col">찾기장소</th></tr>
                        </thead>
                        <tbody>
                            <tr v-for="r in rows" :key="r.sarang_id">
                                <td>{{ fmtDateTime(r.accepted_at) }}</td>
                                <td><b>{{ r.name }}</b></td>
                                <td>{{ r.introducer_name || '—' }}</td>
                                <td :class="{ 'erp-zero': !r.helper_names }">{{ r.helper_names || '—' }}</td>
                                <td>{{ regionLabel(r.region_code) }} {{ districtLabel(r.district_code) }}</td>
                                <td>{{ r.location || '—' }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </template>
        <p v-else class="erp-empty">이관받은 기간을 고르고 🔍 조회를 누르세요.</p>
    </section>
</template>
