<script setup>
// 밭 관리하기 게임 모드 — Phaser 2D 밭(탭 이동·상호작용)을 띄우고 액션 버튼은 DOM으로 얹는 호스트
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
    list: { type: Array, required: true },
    ownerName: { type: String, default: '' },
})
const emit = defineEmits(['open', 'plant'])

const host = ref(null)
const loading = ref(true)
const near = ref(null)
const say = ref('')
const world = ref({ w: 432, h: 480 })
// 전체 화면 — CSS 고정 오버레이 (iPhone Safari는 요소 Fullscreen API 미지원). z-index는 상단바(900) 위, 팝업(1000) 아래.
const full = ref(false)
const onKey = (e) => { if (e.key === 'Escape') full.value = false }
let game = null
let alive = true

function act(t) {
    if (!t) return
    if (t.kind === 'plant') emit('open', t.card)
    else if (t.kind === 'empty') emit('plant')
    else if (t.kind === 'sign') say.value = `🪧 ${props.ownerName ? props.ownerName + '의' : '나의'} 밭이에요. 무럭무럭 키워봐요!`
    else if (t.kind === 'mailbox') say.value = '📮 우편함이 비어 있어요. 방명록은 곧 열려요!'
}

onMounted(async () => {
    window.addEventListener('keydown', onKey)
    // Phaser는 게임 모드에서만 내려받음 (업무 화면 번들에 안 섞이게)
    const { createFarmGame } = await import('./farmScene.js')
    if (!alive) return
    game = await createFarmGame(host.value, {
        cards: props.list,
        onNear: (t) => { near.value = t; say.value = '' },
        onAct: act,
        onWorldSize: (w, h) => { world.value = { w, h } },
    })
    if (!alive) { game.destroy(); return }
    loading.value = false
})
onBeforeUnmount(() => { alive = false; game?.destroy(); window.removeEventListener('keydown', onKey) })
watch(() => props.list, (l) => game?.setCards(l))
</script>

<template>
    <div :class="['fg-wrap', full ? 'fg-full' : '']">
        <!-- 프레임 테두리 3px×2 포함(border-box) — 캔버스 크기는 farmScene의 ResizeObserver가 맞춤 -->
        <div class="fg-frame" :style="full ? null : { height: `min(62vh, ${world.h + 6}px)`, maxWidth: `${world.w + 6}px` }">
            <div ref="host" class="fg-canvas"></div>
            <button class="fg-full-btn" :aria-label="full ? '전체 화면 닫기' : '전체 화면'" @click="full = !full">
                {{ full ? '✕' : '⛶' }}
            </button>
        </div>
        <div v-if="loading" class="fg-loading">밭으로 가는 중… 🌱</div>

        <div class="fg-hud" aria-live="polite">
            <div v-if="say" class="fg-say">{{ say }}</div>
            <button v-else-if="near?.kind === 'plant'" class="fg-act" @click="act(near)">🔍 {{ near.card.name }} 살펴보기</button>
            <button v-else-if="near?.kind === 'empty'" class="fg-act" @click="act(near)">🌱 여기에 씨앗 심기</button>
            <button v-else-if="near" class="fg-act fg-act-sub" @click="act(near)">
                {{ near.kind === 'sign' ? '🪧 팻말 읽기' : '📮 우편함 열기' }}
            </button>
            <div v-else class="fg-hint">땅을 눌러 걸어가요 · 식물 앞에 서면 살펴볼 수 있어요</div>
        </div>
    </div>
</template>

<style scoped>
.fg-wrap {
    position: relative;
    max-width: 560px;
    margin: 0 auto;
}
.fg-canvas { width: 100%; height: 100%; }
.fg-frame {
    position: relative;
    border: 3px solid #5c3a1e;
    border-radius: 18px;
    overflow: hidden;
    box-shadow: 0 5px 0 #5c3a1e, var(--shadow);
    background: #cfe8c0;
    touch-action: none;
    margin: 0 auto;
}
.fg-loading {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #4e342e;
}
.fg-hud {
    min-height: 52px;
    margin-top: 14px;
    display: flex;
    justify-content: center;
}
.fg-act, .fg-say, .fg-hint {
    font-family: 'Jua', sans-serif;
    font-size: 15px;
    border-radius: 14px;
    padding: 11px 18px;
}
.fg-act {
    border: 2px solid #4f8a35;
    background: #7cc255;
    color: #fff;
    box-shadow: 0 3px 0 #4f8a35;
    cursor: pointer;
}
.fg-act:active { transform: translateY(2px); box-shadow: 0 1px 0 #4f8a35; }
.fg-act-sub { background: #f3d9a4; color: #4e342e; border-color: #8b5a2b; box-shadow: 0 3px 0 #8b5a2b; }
.fg-say {
    background: #fff8e7;
    color: #4e342e;
    border: 2px solid #8b5a2b;
    box-shadow: 0 3px 0 #8b5a2b;
}
.fg-hint { font-size: 13px; color: #8d6e63; padding: 8px 0; }
.fg-full-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 36px;
    height: 36px;
    border: 2px solid #8b5a2b;
    border-radius: 10px;
    background: #fff8e7;
    color: #4e342e;
    font-size: 18px;
    line-height: 1;
    box-shadow: 0 2px 0 #8b5a2b;
    cursor: pointer;
}
.fg-full {
    position: fixed;
    inset: 0;
    z-index: 950;
    max-width: none;
    background: #5fb24e;
}
.fg-full .fg-frame {
    height: 100dvh;
    border: none;
    border-radius: 0;
    box-shadow: none;
}
.fg-full .fg-full-btn { top: calc(10px + env(safe-area-inset-top)); right: 12px; }
.fg-full .fg-hud {
    position: absolute;
    left: 0;
    right: 0;
    bottom: calc(16px + env(safe-area-inset-bottom));
    margin: 0;
    pointer-events: none;
}
.fg-full .fg-hud > * { pointer-events: auto; }
.fg-full .fg-hint { background: rgba(255, 248, 231, .9); border-radius: 14px; padding: 8px 14px; }
</style>
