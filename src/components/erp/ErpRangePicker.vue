<script setup>
// ERP 기간 선택 — 시작/끝 날짜 + 이번 주/지난 주/이번 달 빠른 버튼. week 모드면 일~토 한 주 단위로만 움직임
import { weekOf, monthOf, addDays, parseYmd } from './erpUtil'

const props = defineProps({ week: { type: Boolean, default: false } })
const range = defineModel({ type: Object, required: true })  // { from, to }

function setWeek(offset) {
    const w = weekOf()
    range.value = { from: addDays(w.from, offset * 7), to: addDays(w.to, offset * 7) }
}
function shift(dir) {
    range.value = { from: addDays(range.value.from, dir * 7), to: addDays(range.value.to, dir * 7) }
}
function onFrom(e) {
    const v = e.target.value
    if (!v) return
    range.value = props.week ? weekOf(parseYmd(v)) : { ...range.value, from: v }
}
</script>

<template>
    <div class="erp-range">
        <div class="erp-quick">
            <button class="erp-chip" @click="setWeek(0)">이번 주</button>
            <button class="erp-chip" @click="setWeek(-1)">지난 주</button>
            <button v-if="!week" class="erp-chip" @click="range = monthOf()">이번 달</button>
        </div>
        <div class="erp-dates">
            <button v-if="week" class="erp-chip" aria-label="이전 주" @click="shift(-1)">◀</button>
            <input type="date" :value="range.from" aria-label="시작일" @change="onFrom">
            <span>~</span>
            <input type="date" :value="range.to" aria-label="종료일" :disabled="week" @change="range = { ...range, to: $event.target.value }">
            <button v-if="week" class="erp-chip" aria-label="다음 주" @click="shift(1)">▶</button>
        </div>
    </div>
</template>
