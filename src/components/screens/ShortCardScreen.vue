<script setup>
import { reactive, ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'
import { useFormatters } from '@/composables/useFormatters'
import { useAuthStore } from '@/stores/auth'
import { scFields } from '@/constants'

const router = useRouter()
const { callApiPromise } = useApi()
const { showAppAlert, showToast } = usePopup()
const { moveFocus } = useFormatters()
const auth = useAuthStore()

const formData = reactive({})
const submitting = ref(false)
const phone1 = ref('010')
const phone2 = ref('')
const phone3 = ref('')

function handlePhoneFocus(el, max, nextId) { moveFocus(el, max, nextId) }
function onPhone3Input(event) { if (phone3.value.length >= 4) event.target.blur() }

// 인도자 자동완성 — 기본값은 본인, 지우고 다른 사람 이름을 고르면 그 사람 명의로 제출됨.
const guideAcOpen = ref(false)
const guideAcQuery = ref('')
const guideAcConfirmed = ref(false)
const guideAcStatus = ref('') // '' | 'valid' | 'invalid'
const guideAcOpts = computed(() => {
    if (!guideAcOpen.value || !guideAcQuery.value) return []
    const lower = guideAcQuery.value.toLowerCase()
    return (auth.validNames || []).filter(n => n.toLowerCase().includes(lower)).slice(0, 10)
})
function onGuideInput(e) {
    guideAcQuery.value = e.target.value
    formData.guideName = e.target.value
    guideAcConfirmed.value = false
    guideAcStatus.value = ''
}
function openGuideAc() { guideAcOpen.value = true }
function closeGuideAc() {
    setTimeout(() => {
        guideAcOpen.value = false
        if (!guideAcQuery.value) return
        if (!guideAcConfirmed.value) {
            guideAcStatus.value = 'invalid'
            setTimeout(() => {
                formData.guideName = ''
                guideAcQuery.value = ''
                guideAcStatus.value = ''
            }, 600)
        }
    }, 150)
}
function selectGuide(name) {
    formData.guideName = name
    guideAcQuery.value = name
    guideAcConfirmed.value = true
    guideAcStatus.value = 'valid'
    guideAcOpen.value = false
}

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
    formData.guideName = auth.currentUserName || ''
    loadDraft()
    guideAcQuery.value = formData.guideName
    guideAcConfirmed.value = true
    guideAcStatus.value = formData.guideName ? 'valid' : ''
})
watch(formData, saveDraft, { deep: true })
watch([phone1, phone2, phone3], saveDraft)

async function submitShortCard() {
    if (submitting.value) return
    if (!(formData.name || '').trim()) { showAppAlert('이름을 입력해줘!'); return }
    const guideName = (formData.guideName || '').trim()
    if (!guideName) { showAppAlert('인도자를 입력해줘!'); return }
    if (!auth.validNames.includes(guideName)) { showAppAlert(`인도자 이름[${guideName}]이(가) 명단에 없어! 확인해줘.`); return }

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
                    <div v-if="f.id === 'guideName'" class="ac-wrap">
                        <input type="text" :class="['input-card', guideAcStatus ? `ac-input-${guideAcStatus}` : '']"
                               :value="guideAcQuery" placeholder="명단에서 선택"
                               autocomplete="off"
                               @input="onGuideInput"
                               @focus="openGuideAc" @blur="closeGuideAc">
                        <div v-if="guideAcOpts.length" class="ac-dropdown">
                            <div v-for="n in guideAcOpts" :key="n" class="ac-item" @mousedown.prevent="selectGuide(n)">{{ n }}</div>
                        </div>
                    </div>
                    <div v-else-if="f.id === 'phone'" class="input-card phone-group">
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
.ac-wrap { position: relative; }
.ac-dropdown {
    position: absolute;
    top: 100%;
    left: 0; right: 0;
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 8px;
    z-index: 1000;
    max-height: 180px;
    overflow-y: auto;
    box-shadow: 0 4px 12px rgba(0,0,0,0.12);
}
.ac-item {
    padding: 10px 14px;
    font-size: 14px;
    cursor: pointer;
    border-bottom: 1px solid #f0f0f0;
}
.ac-item:last-child { border-bottom: none; }
.ac-item:active { background: #f5f5f5; }
.ac-input-valid { border-color: #4CAF50 !important; background: #F1F8E9 !important; }
.ac-input-invalid {
    border-color: #EF5350 !important;
    background: #FFEBEE !important;
    animation: ac-shake 0.45s ease;
}
@keyframes ac-shake {
    0%, 100% { transform: translateX(0); }
    20%       { transform: translateX(-7px); }
    40%       { transform: translateX(7px); }
    60%       { transform: translateX(-4px); }
    80%       { transform: translateX(4px); }
}
</style>
