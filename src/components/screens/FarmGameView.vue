<script setup>
// 밭 관리하기 게임 모드 — 짧카 목록을 밭 격자 위 식물로 그리는 화면 (데이터는 부모가 내려줌)
import { computed } from 'vue'

const props = defineProps({
    list: { type: Array, required: true },
    stageEmoji: { type: Object, required: true },
})
const emit = defineEmits(['open', 'plant'])

// 빈 밭이 너무 휑하지 않게 최소 6칸 + 항상 빈 칸 1개(눌러서 씨앗 심기)
const emptyPlots = computed(() => Math.max(6 - props.list.length, 1))
</script>

<template>
    <div class="fg-field">
        <button v-for="c in list" :key="c.short_card_id" class="fg-plot" @click="emit('open', c)">
            <span v-if="c.sprout_status === 'pending'" class="fg-flag" title="떡잎 재가 대기">⏳</span>
            <span v-else-if="c.sprout_status === 'rejected'" class="fg-flag" title="떡잎 반려">🥀</span>
            <span :class="['fg-plant', 'fg-plant-' + c.stage]">{{ stageEmoji[c.stage] || '🌰' }}</span>
            <span class="fg-soil"></span>
            <span class="fg-sign">{{ c.name }}</span>
        </button>
        <button v-for="n in emptyPlots" :key="'empty-' + n" class="fg-plot fg-plot-empty" @click="emit('plant')">
            <span class="fg-plant fg-plus">＋</span>
            <span class="fg-soil"></span>
            <span class="fg-sign">씨앗 심기</span>
        </button>
    </div>
</template>

<style scoped>
.fg-field {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    padding: 14px;
    border-radius: 20px;
    background: linear-gradient(#AED581, #8BC34A);
    box-shadow: inset 0 0 0 6px #C8A27A, var(--shadow);
}
.fg-plot {
    position: relative;
    aspect-ratio: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    padding: 6px 4px 8px;
    border: none;
    border-radius: 14px;
    background: #F1E3C8;
    font-family: 'Jua', sans-serif;
    cursor: pointer;
    transition: transform .08s;
}
.fg-plot:active { transform: scale(.95); }
.fg-plot-empty { background: #E8D9BC; opacity: .75; }
.fg-plant {
    font-size: 34px;
    line-height: 1;
    transform-origin: 50% 100%;
    animation: fg-sway 3s ease-in-out infinite;
}
.fg-plant-씨앗 { font-size: 26px; animation: none; }
.fg-plant-떡잎 { font-size: 40px; }
.fg-plus { font-size: 24px; color: #A1887F; animation: none; }
.fg-soil {
    width: 70%;
    height: 8px;
    margin-top: 2px;
    border-radius: 50%;
    background: #8D6E63;
}
.fg-sign {
    margin-top: 6px;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    color: var(--text-color);
}
.fg-flag {
    position: absolute;
    top: 6px;
    right: 6px;
    font-size: 14px;
}
@keyframes fg-sway {
    0%, 100% { transform: rotate(-3deg); }
    50% { transform: rotate(3deg); }
}
@media (prefers-reduced-motion: reduce) {
    .fg-plant { animation: none; }
}
</style>
