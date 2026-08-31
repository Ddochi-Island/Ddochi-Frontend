<script setup>
// DolyoDeleteModal — 인도권 소프트 삭제 confirm.
// legacy2 의 deleteDolyoItem overlay (line 15916-15942) 의 Vue 화.
// IS_DROPPED=1 으로 마킹 — DB 에는 row 가 남는다.

import { ref } from 'vue'
import { useDolyo } from '@/composables/useDolyo'
import { usePopup } from '@/composables/usePopup'

const props = defineProps({
    item: { type: Object, required: true },
})
const emit = defineEmits(['close', 'deleted'])

const { softDelete } = useDolyo()
const { showAppAlert, showToast } = usePopup()

const submitting = ref(false)

async function onConfirm() {
    submitting.value = true
    try {
        const r = await softDelete(props.item.docId)
        if (r && (r.success || r.ok)) {
            showAppAlert(r.message || '삭제됐어 (DB에는 남아있어)', () => {
                emit('deleted')
                emit('close')
            })
        } else {
            showToast(r?.message || '오류 발생')
        }
    } catch (e) {
        showToast(e.message || '오류 발생')
    } finally {
        submitting.value = false
    }
}
</script>

<template>
    <Teleport to="body">
        <div class="dly-del-overlay" @click.self="emit('close')">
            <div class="dly-del-card">
                <div class="modal-title" style="color:#E53935;">🗑 정말 삭제할까?</div>
                <div style="font-size:13px; color:#888; margin-bottom:16px;">
                    {{ item.name }} · 목록에서 사라지지만 DB에는 남아있어
                </div>
                <div class="btn-group">
                    <button class="btn-neg" style="background:#E53935;" :disabled="submitting" @click="onConfirm">
                        {{ submitting ? '삭제 중...' : '삭제' }}
                    </button>
                    <button class="btn-neg" @click="emit('close')">취소</button>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
.dly-del-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
}
.dly-del-card {
    background: #fff;
    border-radius: 16px;
    padding: 20px;
    width: 85%;
    max-width: 300px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
    text-align: center;
}
.modal-title {
    font-weight: bold;
    font-size: 16px;
    margin-bottom: 8px;
}
</style>
