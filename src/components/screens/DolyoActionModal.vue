<script setup>
// DolyoActionModal — 인도권 액션 로그 한 줄 추가.
// legacy2 의 addDolyoAction overlay (line 15868-15895) 의 Vue 화.

import { ref, computed } from 'vue'
import { useDolyo } from '@/composables/useDolyo'
import { usePopup } from '@/composables/usePopup'

const props = defineProps({
    docId: { type: String, required: true },
})
const emit = defineEmits(['close', 'saved'])

const { addAction } = useDolyo()
const { showToast } = usePopup()

function todayStr() {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

const date = ref(todayStr())
const content = ref('')
const saving = ref(false)

async function onSave() {
    if (!content.value.trim()) return showToast('내용을 입력해줘!')
    saving.value = true
    try {
        const r = await addAction(props.docId, date.value, content.value.trim())
        if (r && (r.success || r.ok)) {
            emit('saved')
            emit('close')
        } else {
            showToast(r?.message || '오류 발생')
        }
    } catch (e) {
        showToast(e.message || '오류 발생')
    } finally {
        saving.value = false
    }
}

function autoResize(e) {
    const ta = e.target
    ta.style.height = 'auto'
    ta.style.height = ta.scrollHeight + 'px'
}
</script>

<template>
    <Teleport to="body">
        <div class="dly-act-overlay" @click.self="emit('close')">
            <div class="dly-act-card">
                <div class="dly-act-head">
                    <div class="modal-title">📝 액션 기록</div>
                    <span class="dly-act-close" @click="emit('close')">×</span>
                </div>
                <div style="padding:14px 16px 16px;">
                    <label>날짜</label>
                    <div class="input-card"><input type="date" v-model="date"></div>
                    <label>내용</label>
                    <div class="input-card">
                        <textarea v-model="content" rows="3" placeholder="오늘 어떤 액션을 했어?"
                            style="width:100%;box-sizing:border-box;border:none;outline:none;resize:none;"
                            @input="autoResize"></textarea>
                    </div>
                    <div class="btn-group" style="margin-top:10px;">
                        <button class="btn-pos" :disabled="saving" @click="onSave">
                            {{ saving ? '저장 중...' : '저장' }}
                        </button>
                        <button class="btn-neg" @click="emit('close')">취소</button>
                    </div>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
.dly-act-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
}
.dly-act-card {
    background: #fff;
    border-radius: 16px;
    width: 90%;
    max-width: 360px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
    overflow: hidden;
}
.dly-act-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 16px 0;
}
.modal-title {
    font-weight: bold;
    font-size: 16px;
}
.dly-act-close {
    cursor: pointer;
    font-size: 24px;
    color: #bbb;
    line-height: 1;
}
</style>
