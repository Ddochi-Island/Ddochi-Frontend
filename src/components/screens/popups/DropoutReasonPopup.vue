<script setup>
import { ref } from 'vue'
import { usePopup } from '@/composables/usePopup'

// CenterScreen 의 탈락 사유 입력 팝업 (FinalResultPopup 의 sub).
// legacy: __openDropoutReasonInput / __confirmDropout 정합.

defineProps({})

const emit = defineEmits(['back', 'submit'])

const { showAppAlert } = usePopup()
const reason = ref('')

function handleSubmit() {
    const r = reason.value.trim()
    if (!r) {
        showAppAlert('탈락 사유를 입력해야 해!')
        return
    }
    emit('submit', r)
}
</script>

<template>
    <Teleport to="body">
        <div class="modal-overlay" @click.self="emit('back')">
            <div class="modal-card">
                <span class="modal-close" @click="emit('back')">&times;</span>
                <div class="modal-title">탈락 사유를 알려줘</div>
                <div class="input-card">
                    <textarea v-model="reason" class="popup-text-input" placeholder="탈락 사유를 적어줘 (필수)" style="height:100px; resize:vertical;" />
                </div>
                <div class="btn-group">
                    <button class="btn-pos" style="background:#F44336;" @click="handleSubmit">제출하기</button>
                    <button class="btn-neg" @click="emit('back')">뒤로가기</button>
                </div>
            </div>
        </div>
    </Teleport>
</template>
