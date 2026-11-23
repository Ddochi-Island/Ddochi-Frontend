<script setup>
// 밭 관리하기 게임 모드 — 짧카 목록을 2D 도트 밭 위 식물로 그리는 화면 (데이터는 부모가 내려줌)
import { computed } from 'vue'
import { PLANT_SPRITES, TILES } from './farmSprites'

const props = defineProps({
    list: { type: Array, required: true },
})
const emit = defineEmits(['open', 'plant'])

// 빈 밭이 너무 휑하지 않게 최소 6칸 + 항상 빈 칸 1개(눌러서 씨앗 심기)
const emptyPlots = computed(() => Math.max(6 - props.list.length, 1))
const tileVars = {
    '--fg-grass': `url("${TILES.grass}")`,
    '--fg-soil': `url("${TILES.soil}")`,
    '--fg-fence': `url("${TILES.fence}")`,
}
</script>

<template>
    <div class="fg-field" :style="tileVars">
        <div class="fg-fence"></div>
        <div class="fg-grid">
            <button v-for="(c, i) in list" :key="c.short_card_id" class="fg-plot"
                    :aria-label="`${c.name} ${c.stage}`" @click="emit('open', c)">
                <span v-if="c.sprout_status === 'pending'" class="fg-bubble" title="떡잎 재가 대기">!</span>
                <span v-else-if="c.sprout_status === 'rejected'" class="fg-bubble fg-bubble-sad" title="떡잎 반려">…</span>
                <img :src="PLANT_SPRITES[c.stage] || PLANT_SPRITES.씨앗" alt=""
                     :class="['fg-plant', c.sprout_status === 'rejected' ? 'fg-wilted' : '']"
                     :style="{ animationDelay: (i % 4) * 0.35 + 's' }" />
                <span class="fg-sign">{{ c.name }}</span>
            </button>
            <button v-for="n in emptyPlots" :key="'empty-' + n" class="fg-plot fg-plot-empty" @click="emit('plant')">
                <img :src="PLANT_SPRITES.씨앗" alt="" class="fg-plant fg-ghost" />
                <span class="fg-sign fg-sign-empty">＋ 씨앗 심기</span>
            </button>
        </div>
        <div class="fg-fence"></div>
    </div>
</template>

<style scoped>
.fg-field {
    max-width: 480px;
    margin: 0 auto;
    border-radius: 18px;
    overflow: hidden;
    background: var(--fg-grass) 0 0 / 32px 32px;
    image-rendering: pixelated;
    border: 3px solid #5c3a1e;
    box-shadow: 0 5px 0 #5c3a1e, var(--shadow);
}
.fg-fence {
    height: 24px;
    background: var(--fg-fence) 0 center / 24px 24px repeat-x;
}
.fg-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    padding: 8px 14px;
}
.fg-plot {
    position: relative;
    aspect-ratio: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    padding: 4px 4px 8px;
    border: none;
    border-radius: 8px;
    background: var(--fg-soil) 0 0 / 32px 32px;
    box-shadow: inset 0 0 0 3px #6b4428, inset 0 -6px 0 rgba(0, 0, 0, .12);
    font-family: 'Jua', sans-serif;
    cursor: pointer;
    transition: transform .08s;
}
.fg-plot:active { transform: translateY(2px); }
.fg-plot-empty { filter: saturate(.8); }
.fg-plant {
    width: 64px;
    height: 64px;
    image-rendering: pixelated;
    transform-origin: 50% 90%;
    animation: fg-idle 1.4s steps(1) infinite;
}
.fg-ghost { opacity: .35; animation: none; }
.fg-wilted { filter: saturate(.3) sepia(.5) brightness(.9); animation: none; }
.fg-sign {
    margin-top: 2px;
    max-width: 100%;
    padding: 2px 8px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    color: #4e342e;
    background: #f3d9a4;
    border: 2px solid #8b5a2b;
    border-radius: 8px;
    box-shadow: 0 2px 0 #8b5a2b;
}
.fg-sign-empty { background: #fff8e7; color: #a1887f; border-color: #c8a27a; box-shadow: 0 2px 0 #c8a27a; }
.fg-bubble {
    position: absolute;
    top: 6px;
    right: 6px;
    min-width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 15px;
    color: #f57f17;
    background: #fffdf5;
    border: 2px solid #5c3a1e;
    border-radius: 10px;
    animation: fg-hop 1s steps(1) infinite;
}
.fg-bubble-sad { color: #8d6e63; animation: none; }
@keyframes fg-idle {
    0% { transform: scaleY(1); }
    50% { transform: scaleY(.94); }
}
@keyframes fg-hop {
    0% { transform: translateY(0); }
    50% { transform: translateY(-3px); }
}
@media (prefers-reduced-motion: reduce) {
    .fg-plant, .fg-bubble { animation: none; }
}
</style>
