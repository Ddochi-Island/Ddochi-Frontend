<script setup>
import { computed } from 'vue'

// CenterScreen 의 최종결과 팝업 (메인 — 센터/탈락 선택).
// legacy: handleFinalResultBtn / __submitFinalResult 정합.

const props = defineProps({
    item: { type: Object, required: true },
})

const emit = defineEmits(['close', 'pickCenter', 'pickDropout'])

const currentVal = computed(() => {
    if (props.item.computedPhase === '탈락') return '탈락'
    if (props.item.computedPhase === '센터') return '센터'
    return '미정'
})
</script>

<template>
    <Teleport to="body">
        <div class="modal-overlay" @click.self="emit('close')">
            <div class="modal-card">
                <span class="modal-close" @click="emit('close')">&times;</span>
                <div class="modal-title">최종결과를 입력할게</div>
                <div class="modal-desc" style="display:block;">현재 상태: {{ currentVal }}</div>
                <div class="btn-group">
                    <button class="btn-pos" style="background:#4CAF50;" @click="emit('pickCenter')">센터</button>
                    <button class="btn-neg" style="background:#F44336; color:white;" @click="emit('pickDropout')">탈락</button>
                </div>
            </div>
        </div>
    </Teleport>
</template>
