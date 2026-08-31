<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import confetti from 'canvas-confetti'

const props = defineProps({
    visible: Boolean,
    inflowName: String,
    tmName: String,
    winner: String,       // 'tm' | 'inflow'
    currentRound: Number, // 1-5
    nextProb: Number,
})
const emit = defineEmits(['done'])

// ── 확률별 풀 비율 (티엠자 개수 / 10) ──
const TM_COUNTS = [6, 7, 10] // round 1-3

const ITEM_H = 64 // px, slot item height

// phase: coin → insert → ready → spinning → result
const phase = ref('coin')
const leverPulled = ref(false)
const reelTranslateY = ref(0)
const reelTransition = ref('none')

// 슬롯 릴 아이템 목록 구성
const reelItems = computed(() => {
    const round = Math.min((props.currentRound || 1), 3)
    const tmCount = TM_COUNTS[round - 1]
    const inflowCount = 10 - tmCount
    const pool = [
        ...Array(inflowCount).fill(props.inflowName),
        ...Array(tmCount).fill(props.tmName),
    ]
    // 풀을 4번 반복 셔플 후, 마지막에 winner 배치
    const shuffled = []
    for (let i = 0; i < 4; i++) {
        const p = [...pool].sort(() => Math.random() - 0.5)
        shuffled.push(...p)
    }
    // winner를 끝에서 3번째 위치에 (뒤에 여백 2개)
    shuffled.push(props.winner === 'tm' ? props.tmName : props.inflowName)
    shuffled.push(pool[Math.floor(Math.random() * pool.length)])
    shuffled.push(pool[Math.floor(Math.random() * pool.length)])
    return shuffled
})

// 당첨 이름
const winnerName = computed(() =>
    props.winner === 'tm' ? props.tmName : props.inflowName
)

// winner 아이템 인덱스 (끝에서 3번째)
const winnerIndex = computed(() => reelItems.value.length - 3)

// 릴 컨테이너: 3개 아이템 보임, center = index 1
// translateY 최종값: -(winnerIndex - 1) * ITEM_H
const targetY = computed(() => -(winnerIndex.value - 1) * ITEM_H)

let phaseTimer = null

function clearTimer() {
    if (phaseTimer) { clearTimeout(phaseTimer); phaseTimer = null }
}

watch(() => props.visible, (v) => {
    if (v) startSequence()
}, { immediate: true })

function startSequence() {
    phase.value = 'coin'
    leverPulled.value = false
    reelTranslateY.value = 0
    reelTransition.value = 'none'
    clearTimer()
    // coin 획득 → 1.2s 후 insert
    phaseTimer = setTimeout(() => {
        phase.value = 'insert'
        // insert → 0.9s 후 ready
        phaseTimer = setTimeout(() => {
            phase.value = 'ready'
        }, 900)
    }, 1200)
}

function pullLever() {
    if (leverPulled.value || phase.value !== 'ready') return
    leverPulled.value = true
    phase.value = 'spinning'

    // 릴 스핀 시작
    reelTransition.value = 'transform 3s cubic-bezier(0.05, 0.9, 0.1, 1.0)'
    reelTranslateY.value = targetY.value

    // 2.8s 후 결과
    phaseTimer = setTimeout(() => {
        phase.value = 'result'
        fireConfetti()
    }, 3000)
}

function fireConfetti() {
    if (props.winner === 'tm') {
        // 화려한 골드 폭죽
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.4 }, colors: ['#FFD700', '#FFA500', '#FF6B6B', '#4ECDC4'] })
        setTimeout(() => confetti({ particleCount: 80, spread: 120, origin: { y: 0.3 }, colors: ['#FFD700', '#fff', '#FF6B6B'] }), 400)
        setTimeout(() => confetti({ particleCount: 60, spread: 60, angle: 60, origin: { x: 0, y: 0.5 }, colors: ['#FFD700', '#FFA500'] }), 700)
        setTimeout(() => confetti({ particleCount: 60, spread: 60, angle: 120, origin: { x: 1, y: 0.5 }, colors: ['#FFD700', '#FFA500'] }), 700)
    } else {
        // 은색 소량 폭죽
        confetti({ particleCount: 40, spread: 60, origin: { y: 0.4 }, colors: ['#aaa', '#ccc', '#888'] })
    }
}

function done() {
    clearTimer()
    phase.value = 'coin'
    leverPulled.value = false
    emit('done')
}

onUnmounted(clearTimer)
</script>

<template>
    <teleport to="body">
        <div v-if="visible" class="go-overlay">
            <div class="go-box">

                <!-- ═══ PHASE: COIN ═══ -->
                <transition name="go-fade">
                    <div v-if="phase === 'coin'" class="go-phase go-phase-coin">
                        <div class="go-title">✨ 인도권 가챠 ✨</div>
                        <div class="go-coin-wrap">
                            <div class="go-coin">
                                <div class="go-coin-face go-coin-front">₩</div>
                                <div class="go-coin-face go-coin-back">★</div>
                            </div>
                            <div class="go-coin-label">🪙 코인 획득!</div>
                        </div>
                        <div class="go-round-badge">{{ currentRound }}회차 · 티엠자 당첨 확률 {{ [60,70,100][Math.min((currentRound||1)-1,2)] }}%</div>
                    </div>
                </transition>

                <!-- ═══ PHASE: INSERT ═══ -->
                <transition name="go-fade">
                    <div v-if="phase === 'insert'" class="go-phase go-phase-insert">
                        <div class="go-title">✨ 인도권 가챠 ✨</div>
                        <div class="go-insert-wrap">
                            <div class="go-coin go-coin-flying">
                                <div class="go-coin-face go-coin-front">₩</div>
                                <div class="go-coin-face go-coin-back">★</div>
                            </div>
                            <div class="go-insert-slot">▼ 코인 투입 중...</div>
                        </div>
                        <div class="go-machine-light">🎰 딸깍!</div>
                    </div>
                </transition>

                <!-- ═══ PHASE: READY / SPINNING ═══ -->
                <transition name="go-fade">
                    <div v-if="phase === 'ready' || phase === 'spinning'" class="go-phase go-phase-slot">
                        <div class="go-title">✨ 인도권 가챠 ✨</div>

                        <!-- 슬롯 머신 프레임 -->
                        <div class="go-machine">
                            <!-- 릴 -->
                            <div class="go-reel-wrap">
                                <div class="go-reel-window">
                                    <div
                                        class="go-reel-inner"
                                        :style="{ transform: `translateY(${reelTranslateY}px)`, transition: reelTransition }"
                                    >
                                        <div
                                            v-for="(name, i) in reelItems"
                                            :key="i"
                                            class="go-reel-item"
                                            :class="{ 'go-reel-item-tm': name === tmName }"
                                        >{{ name }}</div>
                                    </div>
                                </div>
                                <!-- 선택 라인 하이라이트 -->
                                <div class="go-reel-selector"></div>
                            </div>

                            <!-- 레버 -->
                            <div class="go-lever-wrap" @click="pullLever">
                                <div class="go-lever-ball" :class="{ pulled: leverPulled }"></div>
                                <div class="go-lever-arm" :class="{ pulled: leverPulled }"></div>
                                <div class="go-lever-base"></div>
                            </div>
                        </div>

                        <div class="go-pool-label">
                            <span class="go-pool-inflow">{{ inflowName }} × {{ 10 - TM_COUNTS[Math.min((currentRound||1)-1,2)] }}</span>
                            &nbsp;vs&nbsp;
                            <span class="go-pool-tm">{{ tmName }} × {{ TM_COUNTS[Math.min((currentRound||1)-1,2)] }}</span>
                        </div>

                        <div v-if="phase === 'ready'" class="go-pull-hint">👇 손잡이를 당겨보세요!</div>
                        <div v-else class="go-spinning-hint">🎰 돌아가는 중...</div>
                    </div>
                </transition>

                <!-- ═══ PHASE: RESULT ═══ -->
                <transition name="go-fade">
                    <div v-if="phase === 'result'" class="go-phase go-phase-result">
                        <template v-if="winner === 'tm'">
                            <div class="go-result-emoji">🎉🎊🎉</div>
                            <div class="go-result-title go-result-win">티엠자 당첨!</div>
                            <div class="go-result-crown">👑</div>
                            <div class="go-result-name">{{ winnerName }}</div>
                            <div class="go-result-sub">인도자로 확정됩니다</div>
                            <div class="go-result-next">다음 회차 60%로 리셋</div>
                        </template>
                        <template v-else>
                            <div class="go-result-emoji">😢</div>
                            <div class="go-result-title go-result-lose">아쉽게도...</div>
                            <div class="go-result-name go-result-name-lose">{{ winnerName }}</div>
                            <div class="go-result-sub">유입자가 인도권을 가져갔어</div>
                            <div class="go-result-next">다음 회차 {{ nextProb }}% 확률</div>
                        </template>
                        <button class="go-confirm-btn" @click="done">확인</button>
                    </div>
                </transition>

            </div>
        </div>
    </teleport>
</template>

<style scoped>
.go-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.88);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
}
.go-box {
    width: 100%;
    max-width: 400px;
    min-height: 480px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
}
.go-phase {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px 20px;
    gap: 16px;
}
.go-title {
    font-size: 22px;
    font-weight: bold;
    color: #FFD700;
    text-shadow: 0 0 12px rgba(255,215,0,0.7);
    letter-spacing: 1px;
}

/* ── COIN ── */
.go-coin-wrap { display: flex; flex-direction: column; align-items: center; gap: 12px; }
.go-coin {
    width: 90px; height: 90px;
    position: relative;
    transform-style: preserve-3d;
    animation: coinSpin 0.8s linear infinite;
}
.go-phase-insert .go-coin { animation: coinFly 0.8s ease-in forwards; }
.go-coin-face {
    position: absolute; inset: 0;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 36px; font-weight: bold;
    backface-visibility: hidden;
}
.go-coin-front { background: radial-gradient(circle at 35% 35%, #FFE44D, #D4A000); color: #7A5000; }
.go-coin-back { background: radial-gradient(circle at 35% 35%, #FFD700, #B8860B); color: #5A3500; transform: rotateY(180deg); }
@keyframes coinSpin {
    0%   { transform: rotateY(0deg) scale(1); }
    50%  { transform: rotateY(180deg) scale(1.1); }
    100% { transform: rotateY(360deg) scale(1); }
}
@keyframes coinFly {
    0%   { transform: translateY(0) scale(1) rotateY(0); opacity: 1; }
    100% { transform: translateY(80px) scale(0.3) rotateY(720deg); opacity: 0; }
}
.go-coin-label { font-size: 18px; color: #FFD700; font-weight: bold; }
.go-round-badge {
    background: rgba(255, 215, 0, 0.15);
    border: 1px solid #FFD700;
    border-radius: 20px;
    padding: 6px 16px;
    font-size: 13px;
    color: #FFD700;
}

/* ── INSERT ── */
.go-phase-insert .go-insert-wrap { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.go-insert-slot { font-size: 14px; color: #aaa; }
.go-machine-light { font-size: 28px; animation: lightPulse 0.4s ease-in-out 3; }
@keyframes lightPulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%       { opacity: 0.3; transform: scale(0.9); }
}

/* ── SLOT MACHINE ── */
.go-machine {
    display: flex;
    align-items: center;
    gap: 0;
    background: linear-gradient(145deg, #2a1a6e, #1a0a4e);
    border-radius: 20px;
    padding: 16px;
    border: 3px solid #FFD700;
    box-shadow: 0 0 24px rgba(255,215,0,0.4), inset 0 0 20px rgba(0,0,0,0.5);
}
.go-reel-wrap { position: relative; }
.go-reel-window {
    width: 200px;
    height: 192px; /* 3 items × 64px */
    overflow: hidden;
    border-radius: 12px;
    background: #0a0020;
    border: 2px solid #4a3a8e;
    position: relative;
}
.go-reel-inner {
    display: flex;
    flex-direction: column;
}
.go-reel-item {
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    font-weight: bold;
    color: #ccc;
    border-bottom: 1px solid #2a1a5e;
    flex-shrink: 0;
}
.go-reel-item-tm { color: #FFD700; }
.go-reel-selector {
    position: absolute;
    top: 64px; /* center slot */
    left: 0; right: 0;
    height: 64px;
    border-top: 2px solid #FFD700;
    border-bottom: 2px solid #FFD700;
    background: rgba(255, 215, 0, 0.08);
    pointer-events: none;
}
/* 위아래 그라디언트 마스크 */
.go-reel-window::before,
.go-reel-window::after {
    content: '';
    position: absolute;
    left: 0; right: 0;
    height: 50px;
    z-index: 2;
    pointer-events: none;
}
.go-reel-window::before { top: 0; background: linear-gradient(to bottom, #0a0020, transparent); }
.go-reel-window::after  { bottom: 0; background: linear-gradient(to top, #0a0020, transparent); }

/* ── LEVER ── */
.go-lever-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-left: 14px;
    cursor: pointer;
    user-select: none;
    gap: 0;
}
.go-lever-ball {
    width: 28px; height: 28px;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 35%, #ff6b6b, #c0392b);
    box-shadow: 0 0 10px rgba(255,80,80,0.6);
    transition: transform 0.3s ease;
    margin-bottom: 4px;
}
.go-lever-ball.pulled { transform: translateY(60px); }
.go-lever-arm {
    width: 8px;
    height: 80px;
    background: linear-gradient(to right, #888, #ccc, #888);
    border-radius: 4px;
    transition: transform 0.3s ease;
    transform-origin: bottom center;
}
.go-lever-arm.pulled { transform: rotate(20deg); }
.go-lever-base {
    width: 24px; height: 14px;
    background: linear-gradient(145deg, #999, #555);
    border-radius: 4px;
}

.go-pool-label {
    font-size: 13px;
    color: #aaa;
    text-align: center;
}
.go-pool-inflow { color: #90CAF9; font-weight: bold; }
.go-pool-tm     { color: #FFD700; font-weight: bold; }
.go-pull-hint   { font-size: 15px; color: #FFD700; animation: hint-pulse 1s ease-in-out infinite; }
.go-spinning-hint { font-size: 14px; color: #888; }
@keyframes hint-pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.4; }
}

/* ── RESULT ── */
.go-phase-result { gap: 12px; }
.go-result-emoji { font-size: 36px; animation: bounce 0.5s ease 3; }
@keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50%       { transform: translateY(-10px); }
}
.go-result-title { font-size: 26px; font-weight: bold; }
.go-result-win  { color: #FFD700; text-shadow: 0 0 16px rgba(255,215,0,0.8); }
.go-result-lose { color: #90CAF9; }
.go-result-crown { font-size: 44px; animation: crownPop 0.6s cubic-bezier(0.34,1.56,0.64,1); }
@keyframes crownPop {
    0%   { transform: scale(0) rotate(-20deg); opacity: 0; }
    100% { transform: scale(1) rotate(0); opacity: 1; }
}
.go-result-name {
    font-size: 32px;
    font-weight: bold;
    color: #fff;
    text-shadow: 0 0 20px rgba(255,255,255,0.5);
    animation: nameGlow 1.5s ease-in-out infinite alternate;
}
@keyframes nameGlow {
    from { text-shadow: 0 0 10px rgba(255,215,0,0.3); }
    to   { text-shadow: 0 0 30px rgba(255,215,0,0.9), 0 0 60px rgba(255,165,0,0.4); }
}
.go-result-name-lose { color: #ccc; animation: none; text-shadow: none; font-size: 26px; }
.go-result-sub  { font-size: 14px; color: #aaa; }
.go-result-next { font-size: 13px; color: #888; background: rgba(255,255,255,0.06); padding: 5px 14px; border-radius: 12px; }
.go-confirm-btn {
    margin-top: 8px;
    padding: 14px 48px;
    background: linear-gradient(135deg, #FFD700, #FFA500);
    color: #5A3500;
    border: none;
    border-radius: 24px;
    font-size: 17px;
    font-weight: bold;
    font-family: 'Jua', sans-serif;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(255,165,0,0.5);
    transition: transform 0.1s;
}
.go-confirm-btn:active { transform: scale(0.96); }

/* ── TRANSITION ── */
.go-fade-enter-active, .go-fade-leave-active { transition: opacity 0.35s; }
.go-fade-enter-from, .go-fade-leave-to { opacity: 0; }
</style>
