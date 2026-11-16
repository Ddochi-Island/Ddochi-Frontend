<script setup>
// ERP 활동자 명단 — 기간 안에서 사람마다 가장 상위 활동(대면>전단지>비대면>대체>미활동)과 그 날짜를 표로(매칭 명단처럼). 지역으로 좁히고 시트용 복사
import { ref, computed, watch } from 'vue'
import ErpRangePicker from './ErpRangePicker.vue'
import { useErpLoad, weekOf, natCmp, regionLabel, districtLabel } from './erpUtil'
import { usePopup } from '@/composables/usePopup'

const STAGES = [
    { code: 'offline', label: '👥 대면' }, { code: 'flyer', label: '📄 전단지' }, { code: 'online', label: '🌐 비대면' },
    { code: 'substitute', label: '🔄 대체' }, { code: 'none', label: '🛋 미활동' },
]
const WEEK = ['일', '월', '화', '수', '목', '금', '토']

const { showToast } = usePopup()
const range = ref(weekOf())
const { loading, error, data, load } = useErpLoad('/api/erp/activity-roster')
const region = ref('')
const district = ref('')
watch(region, () => { district.value = '' })
const loaded = ref(false)
async function run() { if (await load({ ...range.value })) loaded.value = true }

const all = computed(() => data.value?.rows || [])
const regions = computed(() => [...new Set(all.value.map((r) => r.region).filter(Boolean))].sort(natCmp))
const inRegion = computed(() => all.value.filter((r) => !region.value || r.region === region.value))
// 구역 — 지역을 고르면 그 지역의 구역으로 더 좁힘(보고한 날 소속 기준)
const districts = computed(() => (region.value ? [...new Set(inRegion.value.map((r) => r.district).filter(Boolean))].sort(natCmp) : []))
const rows = computed(() => inRegion.value.filter((r) => !district.value || r.district === district.value))
const RANK = Object.fromEntries(STAGES.map((st, i) => [st.code, i]))
const LABEL = Object.fromEntries(STAGES.map((st) => [st.code, st.label]))
// 사람마다 기간 안 가장 상위 활동 한 줄 — 같은 단계를 여러 날 했으면 가장 최근 날짜(2026-11-16 사용자 요청)
const people = computed(() => {
    const best = new Map()
    for (const r of rows.value) {
        const b = best.get(r.name)
        if (!b || RANK[r.activity] < RANK[b.activity] || (r.activity === b.activity && r.day > b.day)) best.set(r.name, r)
    }
    return [...best.values()].sort((a, b) => RANK[a.activity] - RANK[b.activity] || b.day.localeCompare(a.day) || a.name.localeCompare(b.name))
})
const stageCount = (code) => people.value.filter((r) => r.activity === code).length
const dayLabel = (ymd) => `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}(${WEEK[new Date(`${ymd}T00:00:00`).getDay()]})`
const stageName = (code) => LABEL[code].slice(2).trim()

function copy() {
    const lines = [['날짜', '활동 단계', '이름'].join('\t'),
        ...people.value.map((r) => [dayLabel(r.day), stageName(r.activity), r.name].join('\t'))]
    navigator.clipboard.writeText(lines.join('\n')).catch(() => {})
    showToast(`📋 ${people.value.length}명 복사됨 — 시트에 붙여넣으세요`)
}
</script>

<template>
    <section>
        <div class="erp-bar">
            <span class="erp-label">보고 날짜</span>
            <ErpRangePicker v-model="range" />
            <button class="erp-btn" :disabled="loading" @click="run">🔍 조회</button>
        </div>

        <p v-if="loading" class="erp-empty">조회 중…</p>
        <p v-else-if="error" class="erp-error">{{ error }}</p>
        <template v-else-if="data && loaded">
            <div class="erp-section">
                <div class="erp-find-chips" role="group" aria-label="지역">
                    <button :class="['erp-chip', { on: !region }]" :aria-pressed="!region" @click="region = ''">전체</button>
                    <button v-for="rg in regions" :key="rg" :class="['erp-chip', { on: region === rg }]" :aria-pressed="region === rg" @click="region = rg">
                        {{ regionLabel(rg) }}
                    </button>
                    <button class="erp-btn" style="margin-left: auto" :disabled="!rows.length" @click="copy">시트용 복사</button>
                </div>
                <div v-if="districts.length" class="erp-find-chips" role="group" aria-label="구역">
                    <button :class="['erp-chip', { on: !district }]" :aria-pressed="!district" @click="district = ''">{{ regionLabel(region) }} 전체</button>
                    <button v-for="d in districts" :key="d" :class="['erp-chip', { on: district === d }]" :aria-pressed="district === d" @click="district = d">
                        {{ districtLabel(d) }}
                    </button>
                </div>
                <h3 class="erp-h3" style="margin-top: 12px">
                    활동자 명단 <span class="erp-sub">{{ people.length }}명 · 사람마다 기간 안 가장 상위 활동과 그 날짜(같은 단계면 최근 날) · 옛 오프찾은 대면 · 일일보고를 안 낸 사람은 안 나와요</span>
                </h3>
                <div class="erp-find-chips">
                    <span v-for="st in STAGES" :key="st.code" class="erp-sub">{{ st.label }} {{ stageCount(st.code) }}</span>
                </div>
                <p v-if="!people.length" class="erp-empty">이 기간에 올라온 일일보고가 없어요.</p>
                <div v-else class="erp-table-wrap">
                    <table class="erp-table erp-table-left">
                        <thead><tr><th scope="col">날짜</th><th scope="col">활동 단계</th><th scope="col">이름</th></tr></thead>
                        <tbody>
                            <tr v-for="r in people" :key="r.name">
                                <td>{{ dayLabel(r.day) }}</td>
                                <td>{{ LABEL[r.activity] }}</td>
                                <td><b>{{ r.name }}</b></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </template>
        <p v-else class="erp-empty">보고 날짜 기간을 고르고 🔍 조회를 누르세요.</p>
    </section>
</template>
