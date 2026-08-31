<script setup>
// MatchingScreen 의 결과 입력 6 옵션 grid popup.
// legacy: inputMatchResult / handleMatchRes 정합. window.__selectMatchResult 제거.

defineProps({})

const emit = defineEmits(['close', 'pick'])

// legacy 정합 — class 명까지 동일 (.res-btn-cancel/delay/bi/drop/2nd/consult)
const OPTIONS = [
    { label: '취소처리', cls: 'res-btn-cancel' },
    { label: '밀림처리', cls: 'res-btn-delay' },
    { label: '비합처리', cls: 'res-btn-bi' },
    { label: '탈락처리', cls: 'res-btn-drop' },
    { label: '2차만남', cls: 'res-btn-2nd' },
    { label: '상담따기', cls: 'res-btn-consult' },
]
</script>

<template>
    <Teleport to="body">
        <div class="modal-overlay" @click.self="emit('close')">
            <div class="modal-card">
                <span class="modal-close" @click="emit('close')">&times;</span>
                <div class="modal-title">어떻게 됐어?!</div>
                <div class="reason-grid">
                    <div
                        v-for="o in OPTIONS"
                        :key="o.label"
                        class="reason-btn"
                        :class="o.cls"
                        @click="emit('pick', o.label)"
                    >{{ o.label }}</div>
                </div>
            </div>
        </div>
    </Teleport>
</template>
