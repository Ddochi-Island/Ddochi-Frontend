<script setup>
// 씨앗 심기 후 품종 뽑기 연출 — 씨앗 봉투가 흔들리다 열리며 품종 꽃과 희귀도를 보여줌
import { ref, onMounted, onBeforeUnmount } from 'vue'
import confetti from 'canvas-confetti'
import { ICONS, FLOWER_SPRITES } from './farmSprites'

const props = defineProps({
    species: { type: Object, required: true },   // { key, name, rarity, rarityLabel } — 백엔드 plant_species
})
const emit = defineEmits(['farm', 'close'])

const opened = ref(false)
let timer = null
onMounted(() => {
    timer = setTimeout(() => {
        opened.value = true
        if (props.species.rarity !== 'common') {
            confetti({ particleCount: props.species.rarity === 'legend' ? 160 : 80, spread: 70, origin: { y: 0.5 }, zIndex: 1200 })
        }
    }, 1200)
})
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
    <div class="sr-overlay">
        <div class="sr-card" role="dialog" aria-live="polite">
            <template v-if="!opened">
                <img :src="ICONS.seedBag" class="sr-bag" alt="" />
                <p class="sr-text">어떤 꽃이 필까요…?</p>
            </template>
            <template v-else>
                <span :class="['sr-rarity', 'sr-' + species.rarity]">{{ species.rarityLabel }}</span>
                <img :src="FLOWER_SPRITES[species.key]" class="sr-flower" alt="" />
                <p class="sr-text">{{ species.name }} 씨앗을 심었어요!</p>
                <p class="sr-sub">농부일지를 채워 꽃을 피워봐요</p>
                <div class="sr-btns">
                    <button class="sr-btn sr-btn-main" @click="emit('farm')">밭에서 보기</button>
                    <button class="sr-btn" @click="emit('close')">확인</button>
                </div>
            </template>
        </div>
    </div>
</template>

<style scoped>
.sr-overlay {
    position: fixed;
    inset: 0;
    z-index: 1100;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(40, 28, 16, .55);
}
/* 밭 게임 HUD와 같은 도트 상자 — 계단식 테두리 */
.sr-card, .sr-btn, .sr-rarity {
    --line: #5c3a1e;
    box-shadow: 0 -3px 0 0 var(--line), 0 3px 0 0 var(--line), -3px 0 0 0 var(--line), 3px 0 0 0 var(--line);
}
.sr-card {
    width: min(300px, calc(100% - 48px));
    padding: 22px 18px 18px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    background: #fff8e7;
    font-family: 'Galmuri11', 'Jua', sans-serif;
    color: #4e342e;
    box-shadow: 0 -3px 0 0 var(--line), 0 3px 0 0 var(--line), -3px 0 0 0 var(--line), 3px 0 0 0 var(--line),
        inset 0 -4px 0 0 #ead6ae, 0 8px 0 0 rgba(0, 0, 0, .25);
}
.sr-bag, .sr-flower { width: 96px; height: 96px; image-rendering: pixelated; }
.sr-bag { animation: sr-shake .3s steps(2) infinite; }
.sr-flower { animation: sr-pop .45s cubic-bezier(.34, 1.56, .64, 1); }
.sr-text { margin: 4px 0 0; font-size: 15px; }
.sr-sub { margin: 0; font-size: 12px; color: #8d6e63; }
.sr-rarity { padding: 3px 10px; font-size: 12px; background: #f3d9a4; }
.sr-rare { background: #cfe3fb; }
.sr-legend { background: #ffe27a; }
.sr-btns { display: flex; gap: 12px; margin-top: 10px; width: 100%; }
.sr-btn {
    flex: 1;
    padding: 9px 4px;
    border: none;
    border-radius: 0;
    background: #f3d9a4;
    font: inherit;
    font-size: 13px;
    color: #4e342e;
    cursor: pointer;
}
.sr-btn-main { --line: #2f5e1f; background: #7cc255; color: #fff; }
.sr-btn:active { transform: translateY(2px); }
@keyframes sr-shake {
    0% { transform: rotate(-6deg); }
    100% { transform: rotate(6deg); }
}
@keyframes sr-pop {
    from { transform: scale(.3); }
    to { transform: scale(1); }
}
@media (prefers-reduced-motion: reduce) {
    .sr-bag, .sr-flower { animation: none; }
}
</style>
