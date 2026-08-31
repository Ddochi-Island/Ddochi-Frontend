<script setup>
import { ref, computed } from 'vue'

// CenterScreen 의 전략창 팝업 — 3 step 상태머신.
// legacy: handleStrategyBtn / openStrategyInput / openStrategyMenu / __submitStrategyLink 정합.
// step:
//   'menu'    — 기존 link 가 있을 때 보여주는 메뉴 (이동/링크변경)
//   'input'   — 새 링크 입력 (URL validation)
//   'success' — 등록 완료 안내

const props = defineProps({
    item: { type: Object, required: true },
    initialStep: { type: String, default: 'menu' },   // 'menu' | 'input'
})

const emit = defineEmits(['close', 'submit', 'reload'])

const step = ref(props.initialStep)
const linkInput = ref('')
const errorMsg = ref('')

const platform = (typeof window !== 'undefined' && window.Telegram?.WebApp?.platform) || ''
const isMobile = computed(() => platform === 'android' || platform === 'ios')

function openLink() {
    const link = props.item?.strategyLink
    if (!link) return
    if (isMobile.value) window.open(link, '_blank')
    else window.Telegram?.WebApp?.openLink?.(link)
}

function goInput() {
    linkInput.value = ''
    errorMsg.value = ''
    step.value = 'input'
}

function handleSubmit() {
    const link = linkInput.value.trim()
    if (!link.startsWith('https://t.me')) {
        errorMsg.value = '전략창 링크는 https://t.me 으로 시작해!'
        return
    }
    errorMsg.value = ''
    emit('submit', { docId: props.item.docId, link })
    // parent 가 callApi 후 step='success' 로 전환할 것 (또는 emit('reload') 유도)
}

function showSuccess() { step.value = 'success' }

function handleSuccessOk() {
    emit('reload')
    emit('close')
}

defineExpose({ showSuccess })
</script>

<template>
    <Teleport to="body">
        <div class="modal-overlay" @click.self="emit('close')">
            <div class="modal-card">
                <span class="modal-close" @click="emit('close')">&times;</span>

                <template v-if="step === 'menu'">
                    <div class="modal-title">전략창</div>
                    <div class="btn-group">
                        <button class="btn-pos" @click="openLink">이동하기</button>
                    </div>
                    <div class="link-edit-btn" @click="goInput">링크변경</div>
                </template>

                <template v-else-if="step === 'input'">
                    <div class="modal-title">전략창 초대링크를 입력해주세요!</div>
                    <div class="input-card">
                        <input v-model="linkInput" type="text" class="popup-text-input" placeholder="https://t.me/+qAxBCdDkE_k0FGFl" />
                    </div>
                    <div v-if="errorMsg" class="modal-desc" style="display:block; color:#E53935;">{{ errorMsg }}</div>
                    <div class="btn-group">
                        <button class="btn-pos" @click="handleSubmit">등록하기</button>
                    </div>
                </template>

                <template v-else-if="step === 'success'">
                    <div class="modal-title">등록완료!</div>
                    <div class="modal-desc" style="display:block;">이제 전략창 접근이 가능해!</div>
                    <div class="btn-group">
                        <button class="btn-pos" @click="handleSuccessOk">확인</button>
                    </div>
                </template>
            </div>
        </div>
    </Teleport>
</template>
