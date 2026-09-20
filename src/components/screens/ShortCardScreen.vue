<script setup>
import { reactive, ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'
import { scFields } from '@/constants'

const router = useRouter()
const { callApiPromise } = useApi()
const { showAppAlert, showToast } = usePopup()

const formData = reactive({})
const submitting = ref(false)

const DRAFT_KEY = 'sc_draft'
function saveDraft() {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(formData)) } catch (_) {}
}
function loadDraft() {
    try {
        const raw = localStorage.getItem(DRAFT_KEY)
        if (raw) Object.assign(formData, JSON.parse(raw))
    } catch (_) {}
}
function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY) } catch (_) {}
}

onMounted(() => {
    scFields.forEach(f => { if (!(f.id in formData)) formData[f.id] = '' })
    loadDraft()
})
watch(formData, saveDraft, { deep: true })

async function submitShortCard() {
    if (submitting.value) return
    if (!(formData.name || '').trim()) { showAppAlert('이름을 입력해줘!'); return }

    submitting.value = true
    const data = {}
    scFields.forEach(f => { data[f.id] = (formData[f.id] || '').toString().trim() })

    const r = await callApiPromise('/api/submit-short-card', { data })
    submitting.value = false

    if (!r?.success) { showAppAlert(r?.message || '제출 실패'); return }
    clearDraft()
    if (r.duplicateInSarang) showToast('짧카 작성 완료! ⚠️ 이 번호는 이미 섭외 이력이 있어요')
    else showToast('짧카 작성 완료! 📍')
    router.push({ name: 'home' })
}
</script>

<template>
    <div class="screen">
        <div class="header">
            <h3>📍 짧카 작성</h3>
            <p>농부일지에 채울 지인 작성</p>
        </div>

        <div class="hj-form-grid">
            <template v-for="f in scFields" :key="f.id">
                <div class="hj-field">
                    <label>{{ f.label }}</label>
                    <select v-if="f.type === 'select'" class="input-card" v-model="formData[f.id]">
                        <option value="">선택</option>
                        <option v-for="opt in f.opts" :key="opt">{{ opt }}</option>
                    </select>
                    <textarea v-else-if="f.type === 'textarea'" class="input-card" v-model="formData[f.id]"></textarea>
                    <input v-else :type="f.type" class="input-card" v-model="formData[f.id]">
                </div>
            </template>
        </div>

        <button class="btn" :disabled="submitting" @click="submitShortCard">
            {{ submitting ? '제출 중...' : '제출하기 📨' }}
        </button>
    </div>
</template>

<style scoped>
.hj-form-grid {
    margin-bottom: 10px;
}
.hj-field {
    margin-bottom: 15px;
}
</style>
