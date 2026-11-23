<script setup>
// 밭 관리하기 게임 모드 — Phaser 2D 밭(탭 이동·상호작용)을 띄우고 액션 버튼은 DOM으로 얹는 호스트
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { PLANT_SPRITES, ICONS } from './farmSprites'
import galmuri11 from 'galmuri/dist/Galmuri11-Bold.woff2?url'   // 굵은체가 보통체(505KB)보다 훨씬 작음(167KB)

// 도트 글꼴(Galmuri11 Bold, OFL) — 게임 HUD·밭 이름표 전용. 한 굵기만 등록해 필요할 때만 내려받음
if (![...document.fonts].some(f => f.family === 'Galmuri11')) document.fonts.add(new FontFace('Galmuri11', `url(${galmuri11}) format('woff2')`))

const props = defineProps({
    list: { type: Array, required: true },
    ownerName: { type: String, default: '' },
    goals: { type: Array, default: () => [] },       // 반 떡잎 목표 [{name, sprouts, goal}]
    sproutBadge: { type: Number, default: 0 },
    othersLabel: { type: String, default: '' },
})
const emit = defineEmits(['open', 'plant', 'tab'])

// 전체 화면 상단 상태: 단계별 개수 + 반 목표(반이 하나면 그 반, 여러 반이면 달성 반 수)
const STAGES = ['씨앗', '새싹', '떡잎']
const counts = computed(() => Object.fromEntries(STAGES.map(st => [st, props.list.filter(c => c.stage === st).length])))
const goalText = computed(() => {
    const g = props.goals
    if (g.length === 1) return `${g[0].name} ${g[0].sprouts}/${g[0].goal}`
    return g.length ? `${g.filter(x => x.sprouts >= x.goal).length}/${g.length}반 달성` : ''
})

const host = ref(null)
const loading = ref(true)
const near = ref(null)
const say = ref(null)   // { icon, text }
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
    else if (t.kind === 'sign') say.value = { icon: ICONS.sign, text: `${props.ownerName ? props.ownerName + '의' : '나의'} 밭이에요. 무럭무럭 키워봐요!` }
    else if (t.kind === 'mailbox') say.value = { icon: ICONS.mailbox, text: '우편함이 비어 있어요. 방명록은 곧 열려요!' }
}

onMounted(async () => {
    window.addEventListener('keydown', onKey)
    // Phaser는 게임 모드에서만 내려받음 (업무 화면 번들에 안 섞이게)
    const { createFarmGame } = await import('./farmScene.js')
    if (!alive) return
    game = await createFarmGame(host.value, {
        cards: props.list,
        onNear: (t) => { near.value = t; say.value = null },
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
            <button v-if="!full" class="fg-px fg-icon-btn fg-corner" aria-label="전체 화면" @click="full = true">
                <img :src="ICONS.expand" alt="" />
            </button>
        </div>

        <div v-if="full" class="fg-top">
            <div class="fg-stats">
                <span v-for="st in STAGES" :key="st" class="fg-px fg-stat" :title="st">
                    <img :src="PLANT_SPRITES[st]" alt="" />{{ counts[st] }}
                </span>
                <span v-if="goalText" class="fg-px fg-stat"><img :src="PLANT_SPRITES.떡잎" alt="" />{{ goalText }}</span>
            </div>
            <button class="fg-px fg-icon-btn" aria-label="전체 화면 닫기" @click="full = false"><img :src="ICONS.close" alt="" /></button>
        </div>
        <div v-if="loading" class="fg-loading">밭으로 가는 중…</div>

        <div class="fg-hud" aria-live="polite">
            <div v-if="say" class="fg-px fg-say"><img :src="say.icon" alt="" />{{ say.text }}</div>
            <button v-else-if="near?.kind === 'plant'" class="fg-px fg-act" @click="act(near)">
                <img :src="PLANT_SPRITES[near.card.stage] || PLANT_SPRITES.씨앗" alt="" />{{ near.card.name }} 살펴보기
            </button>
            <button v-else-if="near?.kind === 'empty'" class="fg-px fg-act" @click="act(near)">
                <img :src="PLANT_SPRITES.새싹" alt="" />여기에 씨앗 심기
            </button>
            <button v-else-if="near" class="fg-px fg-act fg-act-sub" @click="act(near)">
                <img :src="ICONS[near.kind]" alt="" />{{ near.kind === 'sign' ? '팻말 읽기' : '우편함 열기' }}
            </button>
            <div v-else class="fg-px fg-hint">땅을 눌러 걸어가요 · 식물 앞에 서면 살펴볼 수 있어요</div>
        </div>

        <nav v-if="full" class="fg-px fg-bar">
            <button class="fg-px fg-slot" @click="emit('plant')"><img :src="PLANT_SPRITES.새싹" alt="" />씨앗 심기</button>
            <button class="fg-px fg-slot" @click="emit('tab', 'sprout')">
                <span class="fg-ico"><img :src="PLANT_SPRITES.떡잎" alt="" /><b v-if="sproutBadge" class="fg-badge">{{ sproutBadge }}</b></span>떡잎 재가
            </button>
            <button v-if="othersLabel" class="fg-px fg-slot" @click="emit('tab', 'others')"><img :src="ICONS.sign" alt="" />{{ othersLabel }}</button>
            <button class="fg-px fg-slot" @click="emit('tab', 'list')"><img :src="ICONS.list" alt="" />목록 보기</button>
        </nav>
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
    margin-top: 16px;
    display: flex;
    justify-content: center;
    align-items: center;
}

/* ── 도트 UI 공통: 둥근 모서리 대신 계단식(깎인) 테두리 + 아래 그림자 ── */
.fg-px {
    --px-bg: #fff8e7;
    --px-line: #5c3a1e;
    --px-shade: #ead6ae;
    font-family: 'Galmuri11', 'Jua', sans-serif;
    font-size: 12px;
    color: #4e342e;
    background: var(--px-bg);
    border: none;
    border-radius: 0;
    box-shadow:
        0 -3px 0 0 var(--px-line), 0 3px 0 0 var(--px-line),
        -3px 0 0 0 var(--px-line), 3px 0 0 0 var(--px-line),
        inset 0 -3px 0 0 var(--px-shade),
        0 6px 0 0 rgba(60, 40, 20, .3);
    image-rendering: pixelated;
}
.fg-px img { image-rendering: pixelated; }
button.fg-px { cursor: pointer; }
button.fg-px:active { transform: translateY(3px); box-shadow:
    0 -3px 0 0 var(--px-line), 0 3px 0 0 var(--px-line),
    -3px 0 0 0 var(--px-line), 3px 0 0 0 var(--px-line); }

.fg-icon-btn {
    width: 34px;
    height: 34px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
}
.fg-icon-btn img { width: 16px; height: 16px; }
.fg-corner { position: absolute; top: 10px; right: 10px; }

.fg-act, .fg-say, .fg-hint {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    font-size: 13px;
}
.fg-act img, .fg-say img { width: 24px; height: 24px; }
.fg-act { --px-bg: #7cc255; --px-line: #2f5e1f; --px-shade: #5a9e3c; color: #fff; text-shadow: 0 2px 0 #3f7a2a; }
.fg-act-sub { --px-bg: #f3d9a4; --px-line: #5c3a1e; --px-shade: #d9b77a; color: #4e342e; text-shadow: none; }
.fg-hint { padding: 6px 12px; font-size: 12px; color: #8d6e63; }

/* ── 전체 화면 ── */
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
.fg-full .fg-hud {
    position: absolute;
    left: 0;
    right: 0;
    bottom: calc(100px + env(safe-area-inset-bottom));
    margin: 0;
    pointer-events: none;
}
.fg-full .fg-hud > * { pointer-events: auto; }

/* 상단 상태바 */
.fg-top {
    position: absolute;
    top: calc(14px + env(safe-area-inset-top));
    left: 14px;
    right: 14px;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
    pointer-events: none;
}
.fg-top > * { pointer-events: auto; }
.fg-stats { display: flex; flex-wrap: wrap; gap: 12px; }
.fg-stat {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 30px;
    padding: 0 10px 0 4px;
    font-size: 13px;
}
.fg-stat img { width: 24px; height: 24px; }

/* 하단 나무 툴바 */
.fg-bar {
    --px-bg: #c98c4e;
    --px-line: #5c3a1e;
    --px-shade: #a86f37;
    position: absolute;
    left: 50%;
    bottom: calc(18px + env(safe-area-inset-bottom));
    transform: translateX(-50%);
    width: min(calc(100% - 30px), 460px);
    display: flex;
    gap: 10px;
    padding: 8px 8px 11px;
}
.fg-slot {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 5px 2px 7px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.fg-slot img { width: 24px; height: 24px; }
.fg-ico { position: relative; display: inline-flex; }
.fg-badge {
    position: absolute;
    top: -4px;
    right: -14px;
    min-width: 16px;
    padding: 2px 3px 1px;
    font: 10px/1 'Galmuri11', sans-serif;
    color: #fff;
    background: #e0453a;
    box-shadow: 0 -2px 0 #5c3a1e, 0 2px 0 #5c3a1e, -2px 0 #5c3a1e, 2px 0 #5c3a1e;
}
</style>
