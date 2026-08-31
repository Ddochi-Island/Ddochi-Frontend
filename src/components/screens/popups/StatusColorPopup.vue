<script setup>
import { ref, computed } from 'vue'
import { statusTextMap } from '@/constants'

// CenterScreen 의 상태 색상 변경 팝업.
// legacy: changeCenterStatus / __selectStatusColor / __submitCenterStatus 정합.
// 색상 클릭 시 사유 입력 영역이 노출되도록 1단 popup 안에서 v-show 로 표시.

const props = defineProps({
    item: { type: Object, required: true },
})

const emit = defineEmits(['close', 'submit'])

const COLORS = [
    { code: '🔴', label: '위험' },
    { code: '🟠', label: '불안' },
    { code: '🟡', label: '경계' },
    { code: '🟢', label: '관심' },
    { code: '🔵', label: '안정' },
]

const selectedColor = ref('')
const reason = ref('')

const selectedDisplay = computed(() => {
    if (!selectedColor.value) return ''
    return `${selectedColor.value} ${statusTextMap[selectedColor.value] || ''}`
})

function pickColor(code) {
    selectedColor.value = code
}

function handleSubmit() {
    if (!selectedColor.value) return
    emit('submit', {
        docId: props.item.docId,
        color: selectedColor.value,
        text: statusTextMap[selectedColor.value] || '',
        reason: reason.value.trim() || '-',
    })
}
</script>

<template>
    <Teleport to="body">
        <div class="modal-overlay" @click.self="emit('close')">
            <div class="modal-card">
                <span class="modal-close" @click="emit('close')">&times;</span>
                <div class="modal-title">현재 상태는 어때?</div>

                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; gap:5px;">
                    <div
                        v-for="c in COLORS"
                        :key="c.code"
                        style="display:flex; flex-direction:column; align-items:center; cursor:pointer; flex:1;"
                        @click="pickColor(c.code)"
                    >
                        <div class="status-dot-btn" style="margin-bottom:5px;">{{ c.code }}</div>
                        <span style="font-size:12px; color:#555;">{{ c.label }}</span>
                    </div>
                </div>

                <div v-show="selectedColor">
                    <div style="text-align:center; font-weight:bold; margin-bottom:10px; font-size:18px;">{{ selectedDisplay }}</div>
                    <div class="input-card" style="margin-top:10px;">
                        <textarea v-model="reason" class="popup-text-input" placeholder="사유 (선택사항)" rows="3" style="resize:vertical;" />
                    </div>
                    <button class="btn" style="margin-top:10px;" @click="handleSubmit">저장하기</button>
                </div>
            </div>
        </div>
    </Teleport>
</template>
