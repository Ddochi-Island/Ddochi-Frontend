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
onBeforeUnmount(() => { alive = false; game?.destroy() })
watch(() => props.list, (l) => game?.setCards(l))
</script>

<template>
    <div class="fg-wrap">
        <!-- 프레임 테두리 3px×2 포함(border-box) — 캔버스 크기는 farmScene의 ResizeObserver가 맞춤 -->
        <div class="fg-frame" :style="{ height: `min(62vh, ${world.h + 6}px)`, maxWidth: `${world.w + 6}px` }">
            <div ref="host" class="fg-canvas"></div>
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
</style>
