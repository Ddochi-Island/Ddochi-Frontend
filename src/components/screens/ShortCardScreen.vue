<script setup>
import { reactive, ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'
import { useFormatters } from '@/composables/useFormatters'
import { scFields } from '@/constants'

const router = useRouter()
const { callApiPromise } = useApi()
const { showAppAlert, showToast } = usePopup()
const { moveFocus } = useFormatters()

const formData = reactive({})
const submitting = ref(false)
const phone1 = ref('010')
const phone2 = ref('')
const phone3 = ref('')

function handlePhoneFocus(el, max, nextId) { moveFocus(el, max, nextId) }
function onPhone3Input(event) { if (phone3.value.length >= 4) event.target.blur() }

const DRAFT_KEY = 'sc_draft'
function saveDraft() {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ formData, phone1: phone1.value, phone2: phone2.value, phone3: phone3.value })) } catch (_) {}
}
function loadDraft() {
    try {
        const raw = localStorage.getItem(DRAFT_KEY)
        if (!raw) return
        const d = JSON.parse(raw)
        Object.assign(formData, d.formData || {})
        if (d.phone1) phone1.value = d.phone1
        if (d.phone2) phone2.value = d.phone2
        if (d.phone3) phone3.value = d.phone3
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
watch([phone1, phone2, phone3], saveDraft)

async function submitShortCard() {
    if (submitting.value) return
    if (!(formData.name || '').trim()) { showAppAlert('이름을 입력해줘!'); return }

    submitting.value = true
    const data = {}
    scFields.forEach(f => { data[f.id] = (formData[f.id] || '').toString().trim() })
    data.phone = phone1.value && phone2.value && phone3.value ? `${phone1.value}-${phone2.value}-${phone3.value}` : ''

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
                    <div v-if="f.id === 'phone'" class="input-card phone-group">
                        <input type="tel" class="phone-input" id="sc-phone1" maxlength="3" v-model="phone1" @input="handlePhoneFocus($event.target, 3, 'sc-phone2')">
                        <span class="dash">-</span>
                        <input type="tel" class="phone-input" id="sc-phone2" maxlength="4" v-model="phone2" @input="handlePhoneFocus($event.target, 4, 'sc-phone3')">
                        <span class="dash">-</span>
                        <input type="tel" class="phone-input" id="sc-phone3" maxlength="4" v-model="phone3" @input="onPhone3Input">
                    </div>
                    <select v-else-if="f.type === 'select'" class="input-card" v-model="formData[f.id]">
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
