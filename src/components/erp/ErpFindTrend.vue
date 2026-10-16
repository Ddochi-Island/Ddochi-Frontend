<script setup>
// ERP 찾기 분석 — 날짜별 찾기 수 선 그래프(한 줄 = 찾기 합계). 마우스 위치의 날짜에 십자선 + 그날 온라인 찾기·도구 노방·기타 오프 말풍선
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { addDays } from './erpUtil'

const props = defineProps({
    points: { type: Array, required: true },  // 이미 범위로 거른 timeline 행 [{ date, onlineFound, toolStreet, offEtc }]
    from: { type: String, required: true },
    to: { type: String, required: true },
    title: { type: String, required: true },
})

const LINE = '#2a78d6'  // 기본 범주 팔레트 1번(파랑) — 한 줄이라 범례 없이 제목이 이름
const H = 220, PAD = { l: 36, r: 16, t: 14, b: 26 }

// 기간의 모든 날(오늘 이후는 뺌) — 기록 없는 날은 0
const todayYmd = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })()
const days = computed(() => {
    const out = []
    const end = props.to < todayYmd ? props.to : todayYmd
    for (let d = props.from; d <= end && out.length < 400; d = addDays(d, 1)) out.push(d)
    return out
})
const series = computed(() => {
    const by = {}
    for (const p of props.points) {
        const b = (by[p.date] ||= { onlineFound: 0, toolStreet: 0, offEtc: 0 })
        b.onlineFound += p.onlineFound; b.toolStreet += p.toolStreet; b.offEtc += p.offEtc
    }
    return days.value.map((d) => {
        const b = by[d] || { onlineFound: 0, toolStreet: 0, offEtc: 0 }
        return { date: d, ...b, total: b.onlineFound + b.toolStreet + b.offEtc }
    })
})

// 폭은 실제 칸 너비를 따라감(글자가 늘어나지 않게 viewBox를 늘리지 않음)
const wrap = ref(null)
const W = ref(800)
let ro = null
onMounted(() => {
    ro = new ResizeObserver(([e]) => { W.value = Math.max(320, Math.round(e.contentRect.width)) })
    ro.observe(wrap.value)
})
onUnmounted(() => ro?.disconnect())

// y 눈금 — 1·2·5 단위로 4~5칸(최소 1)
const yMax = computed(() => {
    const m = Math.max(1, ...series.value.map((p) => p.total))
    const raw = m / 4
    const pow = 10 ** Math.floor(Math.log10(raw))
    const step = Math.max(1, [1, 2, 5, 10].map((k) => k * pow).find((s) => s >= raw))  // 사람 수라 1 단위 이상
    return { max: Math.ceil(m / step) * step, step }
})
const yTicks = computed(() => { const t = []; for (let v = 0; v <= yMax.value.max; v += yMax.value.step) t.push(v); return t })
const x = (i) => PAD.l + (series.value.length <= 1 ? 0 : (i / (series.value.length - 1)) * (W.value - PAD.l - PAD.r))
const y = (v) => PAD.t + (1 - v / yMax.value.max) * (H - PAD.t - PAD.b)
const path = computed(() => series.value.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.total).toFixed(1)}`).join(''))
const xLabelEvery = computed(() => Math.max(1, Math.ceil(series.value.length / Math.max(2, Math.floor((W.value - PAD.l - PAD.r) / 56)))))
const md = (d) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`
const WEEK = ['일', '월', '화', '수', '목', '금', '토']
const dow = (d) => WEEK[new Date(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)).getDay()]

const hover = ref(null)  // 인덱스
function onMove(e) {
    const r = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - r.left
    const n = series.value.length
    if (!n) return
    const i = n === 1 ? 0 : Math.round(((px - PAD.l) / (W.value - PAD.l - PAD.r)) * (n - 1))
    hover.value = Math.min(n - 1, Math.max(0, i))
}
const hp = computed(() => (hover.value == null ? null : series.value[hover.value]))
const sum = computed(() => series.value.reduce((s, p) => s + p.total, 0))
</script>

<template>
    <figure class="erp-chart erp-trend" @mouseleave="hover = null">
        <figcaption class="erp-chart-head">
            <span class="erp-chart-title">{{ title }}</span>
            <span class="erp-chart-legend">기간 합계 {{ sum }}명 · 하루 평균 {{ series.length ? (sum / series.length).toFixed(1) : 0 }}명</span>
        </figcaption>
        <div ref="wrap" class="erp-trend-wrap">
            <svg :width="W" :height="H" role="img" :aria-label="`${title}: ` + series.map((p) => `${md(p.date)} ${p.total}명`).join(', ')"
                 @mousemove="onMove">
                <g class="erp-trend-grid">
                    <template v-for="t in yTicks" :key="t">
                        <line :x1="PAD.l" :x2="W - PAD.r" :y1="y(t)" :y2="y(t)" />
                        <text :x="PAD.l - 8" :y="y(t) + 4" text-anchor="end">{{ t }}</text>
                    </template>
                    <template v-for="(p, i) in series" :key="p.date">
                        <text v-if="i % xLabelEvery === 0 || i === series.length - 1" :x="x(i)" :y="H - 6" text-anchor="middle">{{ md(p.date) }}</text>
                    </template>
                </g>
                <path :d="path" fill="none" :stroke="LINE" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
                <g v-if="hp">
                    <line class="erp-trend-cross" :x1="x(hover)" :x2="x(hover)" :y1="PAD.t" :y2="H - PAD.b" />
                    <circle :cx="x(hover)" :cy="y(hp.total)" r="5" :fill="LINE" stroke="#fff" stroke-width="2" />
                </g>
                <rect :x="PAD.l" :y="0" :width="Math.max(0, W - PAD.l - PAD.r)" :height="H" fill="transparent" />
            </svg>
            <div v-if="hp" class="erp-chart-tip" role="status"
                 :style="{ left: Math.min(x(hover) + 12, W - 170) + 'px', top: Math.max(0, y(hp.total) - 70) + 'px' }">
                <b>{{ md(hp.date) }}({{ dow(hp.date) }})</b> · 찾기 {{ hp.total }}명
                <div>온라인 찾기 {{ hp.onlineFound }}</div>
                <div>도구 노방 {{ hp.toolStreet }}</div>
                <div v-if="hp.offEtc">기타 오프 {{ hp.offEtc }}</div>
            </div>
        </div>
    </figure>
</template>
