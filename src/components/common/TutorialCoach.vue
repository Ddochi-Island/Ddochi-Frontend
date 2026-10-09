<script setup>
// 튜토리얼 코치 — 화면의 [data-tour] 요소를 밝혀 주고 말풍선으로 안내. 단계는 "다음" 버튼이나, 연습용 가짜 API 호출
// (예: 이관받기 → /api/shed-register)로 넘어감. z-index 900 — 확인창(1000) 같은 팝업이 위에 떠서 그대로 쓸 수 있게.
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { onPracticeCall } from '@/composables/usePracticeApi'

const props = defineProps({
    // [{ target?: 'data-tour 값', title, text, wait?: '/api/…'(그 호출이 오면 다음으로) | 'click'(대상을 누르면 다음으로) }]
    steps: { type: Array, required: true },
})
const emit = defineEmits(['finish', 'exit'])

const index = ref(0)
const step = computed(() => props.steps[index.value])
const rect = ref(null)
const isLast = computed(() => index.value === props.steps.length - 1)

function findTarget() {
    const key = step.value?.target
    if (!key) return null
    return [...document.querySelectorAll(`[data-tour="${key}"]`)].find(el => {
        const r = el.getBoundingClientRect()
        return r.width > 0 && r.height > 0
    }) || null
}

function measure() {
    const el = findTarget()
    if (!el) { rect.value = null; return }
    const r = el.getBoundingClientRect()
    rect.value = { top: r.top - 6, left: r.left - 6, width: r.width + 12, height: r.height + 12 }
}

async function focusStep() {
    await nextTick()
    measure()
    findTarget()?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    setTimeout(measure, 350)
}

function next() {
    if (isLast.value) { emit('finish'); return }
    index.value += 1
}
function prev() { if (index.value > 0) index.value -= 1 }

// 말풍선 위치 — 대상 아래에 자리가 있으면 아래, 아니면 위, 대상이 없으면 화면 가운데
const bubbleStyle = computed(() => {
    const r = rect.value
    if (!r) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
    const below = r.top + r.height + 12
    const top = below + 190 < window.innerHeight ? below : Math.max(12, r.top - 190 - 12)
    const left = Math.min(Math.max(12, r.left + r.width / 2 - 160), window.innerWidth - 332)
    return { top: `${top}px`, left: `${left}px` }
})

let off = null
let timer = null
function onDocClick(e) {  // wait: 'click' — 강조한 대상을 실제로 눌렀을 때만 다음으로
    if (step.value?.wait !== 'click') return
    const el = findTarget()
    if (el && el.contains(e.target)) setTimeout(next, 300)
}
watch(index, focusStep)
onMounted(() => {
    off = onPracticeCall((path) => { if (step.value?.wait === path) setTimeout(next, 400) })
    timer = setInterval(measure, 400)  // 목록이 다시 그려지거나 펼쳐져도 강조 위치를 따라감
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    document.addEventListener('click', onDocClick, true)
    focusStep()
})
onUnmounted(() => {
    off?.()
    clearInterval(timer)
    window.removeEventListener('resize', measure)
    window.removeEventListener('scroll', measure, true)
    document.removeEventListener('click', onDocClick, true)
})
</script>

<template>
    <div class="coach" aria-live="polite">
        <div v-if="rect" class="coach-spot" :style="{ top: rect.top + 'px', left: rect.left + 'px', width: rect.width + 'px', height: rect.height + 'px' }"></div>
        <div v-else class="coach-dim"></div>
        <div class="coach-bubble" :style="bubbleStyle" role="dialog" :aria-label="step.title">
            <div class="coach-count">{{ index + 1 }} / {{ steps.length }}</div>
            <div class="coach-title">{{ step.title }}</div>
            <p class="coach-text">{{ step.text }}</p>
            <div v-if="step.wait" class="coach-wait">👆 직접 눌러 보세요</div>
            <div class="coach-actions">
                <button class="coach-btn ghost" @click="emit('exit')">그만하기</button>
                <button v-if="index > 0" class="coach-btn ghost" @click="prev">이전</button>
                <button v-if="!step.wait" class="coach-btn" @click="next">{{ isLast ? '끝내기 🎉' : '다음' }}</button>
                <button v-else class="coach-btn ghost" @click="next">건너뛰기</button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.coach { position: fixed; inset: 0; z-index: 900; pointer-events: none; }
.coach-dim { position: fixed; inset: 0; background: rgba(0, 0, 0, .5); }
.coach-spot { position: fixed; border-radius: 12px; box-shadow: 0 0 0 9999px rgba(0, 0, 0, .5); outline: 3px solid #FFB74D;
    transition: top .2s, left .2s, width .2s, height .2s; }
.coach-bubble { position: fixed; width: 320px; max-width: calc(100vw - 24px); background: #fff; border-radius: 16px; padding: 14px 16px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, .25); pointer-events: auto; font-family: 'Jua'; color: #5D4037; }
.coach-count { font-size: 12px; color: #A1887F; }
.coach-title { font-size: 17px; margin: 2px 0 6px; }
.coach-text { margin: 0; line-height: 1.6; font-size: 14px; }
.coach-wait { margin-top: 8px; font-size: 13px; color: #E65100; }
.coach-actions { display: flex; gap: 6px; justify-content: flex-end; margin-top: 12px; }
.coach-btn { border: none; border-radius: 10px; padding: 8px 14px; background: #6D4C41; color: #fff; font-family: 'Jua'; font-size: 14px; cursor: pointer; }
.coach-btn.ghost { background: #EFE3D3; color: #6D4C41; }
.coach-btn:focus-visible { outline: 3px solid #FFB74D; outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { .coach-spot { transition: none; } }
</style>
