<script setup>
// ERP 활동자 명단 — 일일보고에 올린 활동을 날짜마다 단계(대면/전단지/비대면/대체/미활동)별 이름으로. 지역으로 좁히고 시트용 복사
import { ref, computed } from 'vue'
import ErpRangePicker from './ErpRangePicker.vue'
import { useErpLoad, weekOf, natCmp, regionLabel } from './erpUtil'
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
const loaded = ref(false)
async function run() { if (await load({ ...range.value })) loaded.value = true }

const all = computed(() => data.value?.rows || [])
const regions = computed(() => [...new Set(all.value.map((r) => r.region).filter(Boolean))].sort(natCmp))
const rows = computed(() => all.value.filter((r) => !region.value || r.region === region.value))
// [{ day, stages: [{ code, label, people: [r] }], total }] — 최근 날짜부터
const days = computed(() => {
    const byDay = new Map()
    for (const r of rows.value) (byDay.get(r.day) || byDay.set(r.day, []).get(r.day)).push(r)
    return [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([day, list]) => ({
        day, total: list.length,
        stages: STAGES.map((s) => ({ ...s, people: list.filter((r) => r.activity === s.code) })),
    }))
})
const dayLabel = (ymd) => `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}(${WEEK[new Date(`${ymd}T00:00:00`).getDay()]})`
const who = (r) => `${r.name}${r.region ? ` ${r.region}-${r.district || '?'}` : ''}`

function copy() {
    const lines = [['날짜', '활동', '이름', '지역', '구역'].join('\t')]
    for (const d of days.value) for (const s of d.stages) for (const r of s.people)
        lines.push([d.day, s.label.slice(2).trim(), r.name, r.region || '', r.district || ''].join('\t'))
    navigator.clipboard.writeText(lines.join('\n')).catch(() => {})
    showToast(`📋 ${lines.length - 1}줄 복사됨 — 시트에 붙여넣으세요`)
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
                <p class="erp-sub" style="margin: 8px 0 0">소속은 보고한 날 기준 · 옛 오프찾은 대면으로 · 일일보고를 안 낸 사람은 안 나와요</p>
            </div>
            <p v-if="!days.length" class="erp-empty">이 기간에 올라온 일일보고가 없어요.</p>
            <div v-for="d in days" :key="d.day" class="erp-section">
                <h3 class="erp-h3">{{ dayLabel(d.day) }} <span class="erp-sub">보고 {{ d.total }}명</span></h3>
                <div v-for="s in d.stages" :key="s.code" class="act-stage">
                    <span class="act-stage-label">{{ s.label }} <b>{{ s.people.length }}</b></span>
                    <span class="act-stage-names">
                        <template v-if="s.people.length">{{ s.people.map(who).join(', ') }}</template>
                        <span v-else class="erp-zero">—</span>
                    </span>
                </div>
            </div>
        </template>
        <p v-else class="erp-empty">보고 날짜 기간을 고르고 🔍 조회를 누르세요.</p>
    </section>
</template>

<style scoped>
.act-stage { display: grid; grid-template-columns: 110px 1fr; gap: 8px; padding: 6px 0; border-top: 1px solid var(--e-line); font-size: 13px; }
.act-stage:first-of-type { border-top: none; }
.act-stage-label { color: var(--e-sub); white-space: nowrap; }
.act-stage-label b { color: var(--e-text); margin-left: 2px; }
.act-stage-names { line-height: 1.6; }
</style>
