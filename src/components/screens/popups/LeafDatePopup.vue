<script setup>
import { ref } from 'vue'
import { usePopup } from '@/composables/usePopup'

// 잎사귀 날짜 선택 팝업. 입력 시 logContent 와 fmtDate 를 emit.
// legacy: window.__submitLeafDate 의 흐름을 컴포넌트화.

const props = defineProps({
    type: { type: String, required: true },   // 잎사귀 종류 (생노잎 등)
    name: { type: String, required: true },   // 사전 검증된 이름
})

const emit = defineEmits(['submit', 'cancel'])

const { showAppAlert } = usePopup()

function todayLocalIsoString() {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const dateValue = ref(todayLocalIsoString())

function handleSubmit() {
    if (!dateValue.value) {
        showAppAlert('날짜를 선택해줘!')
        return
    }
    const d = new Date(dateValue.value)
    const week = ['일', '월', '화', '수', '목', '금', '토']
    const fmtDate = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}${week[d.getDay()]}`
    emit('submit', {
        logContent: `${props.name}(${fmtDate})`,
        fmtDate,
    })
}
</script>

<template>
    <Teleport to="body">
        <div class="modal-overlay" @click.self="emit('cancel')">
            <div class="modal-card">
                <span class="modal-close" @click="emit('cancel')">&times;</span>
                <div class="modal-title">{{ type }} - 날짜 선택</div>
                <div class="modal-desc">{{ name }}님이 언제 했어?</div>

                <div style="text-align:center; color:#888; font-size:13px; margin-bottom:5px;">날짜를 선택해줘!</div>
                <div class="input-card" style="margin-top: 10px;">
                    <input
                        v-model="dateValue"
                        type="date"
                        class="popup-text-input"
                        style="text-align:center; background:#fff;"
                    />
                </div>

                <div class="btn-group">
                    <button class="btn-pos" @click="handleSubmit">입력완료</button>
                    <button class="btn-neg" @click="emit('cancel')">취소</button>
                </div>
            </div>
        </div>
    </Teleport>
</template>
