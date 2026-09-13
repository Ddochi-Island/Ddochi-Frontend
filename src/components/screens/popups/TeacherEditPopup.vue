<script setup>
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { usePopup } from '@/composables/usePopup'

// CenterScreen 의 교사 교체 팝업 — confirm → input 두 단계.
// legacy: editCenterTeacher / __showTeacherInput / __submitTeacher 정합.

const props = defineProps({
    item: { type: Object, required: true },
    skipConfirm: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'submit'])

const auth = useAuthStore()
const { showAppAlert } = usePopup()

const step = ref(props.skipConfirm ? 'input' : 'confirm')   // 'confirm' | 'input'
const name = ref('')
const isTa = ref(false)

function goInput() { step.value = 'input' }

function handleSubmit() {
    const trimmed = name.value.trim()
    if (!trimmed) {
        showAppAlert('이름을 입력해줘!')
        return
    }
    if (!isTa.value && !auth.validNames.includes(trimmed)) {
        showAppAlert('명단에 없는 이름이야! 타지역이면 체크해줘.')
        return
    }
    const finalName = isTa.value ? `${trimmed}(타지역)` : trimmed
    emit('submit', { docId: props.item.docId, finalName })
}
</script>

<template>
    <Teleport to="body">
        <div class="modal-overlay" @click.self="emit('close')">
            <div class="modal-card">
                <span class="modal-close" @click="emit('close')">&times;</span>

                <template v-if="step === 'confirm'">
                    <div class="modal-title">교사 교체 맞을까요!?</div>
                    <div class="modal-desc" style="display:block;">타지역 교사 입력시 데이터가 타지역으로 이관돼!</div>
                    <div class="btn-group">
                        <button class="btn-pos" @click="goInput">맞아!</button>
                        <button class="btn-neg" @click="emit('close')">아니야</button>
                    </div>
                </template>

                <template v-else>
                    <div class="modal-title">교사님을 지정할게!</div>
                    <div class="input-card" style="margin-top:10px;">
                        <input v-model="name" type="text" class="popup-text-input" placeholder="교사 이름" />
                    </div>
                    <div style="text-align:left; margin-top:5px;">
                        <label style="display:inline-flex; align-items:center; cursor:pointer;">
                            <input v-model="isTa" type="checkbox" style="width:auto; margin-right:5px;" /> 타지역
                        </label>
                    </div>
                    <div class="btn-group">
                        <button class="btn-pos" @click="handleSubmit">저장하기</button>
                    </div>
                </template>
            </div>
        </div>
    </Teleport>
</template>
