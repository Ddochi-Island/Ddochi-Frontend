<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useApi } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'
import { useUiStore } from '@/stores/ui'
import { useFormatters } from '@/composables/useFormatters'
import { prayerVerses } from '@/constants'

const router = useRouter()
const auth = useAuthStore()
const { callApi } = useApi()
const { showAppAlert } = usePopup()
const ui = useUiStore()
const { autoResize } = useFormatters()

const verse = ref('')
const content = ref('')
const textareaRef = ref(null)

function savePrayerDraft() {
    localStorage.setItem('prayer_draft', content.value)
}

function loadPrayerDraft() {
    const saved = localStorage.getItem('prayer_draft')
    if (saved) content.value = saved
}

function submitPrayer() {
    if (ui.isProcessing) return
    if (!content.value.trim()) return showAppAlert('기도 내용을 입력해줘!')

    ui.setProcessing(true)

    callApi('/api/submit-prayer', {
        sabun: auth.currentSabun,
        content: content.value
    }, (r) => {
        ui.setProcessing(false)
        showAppAlert(r.message || '향연이 올라갔어! 🕊️', () => {
            localStorage.removeItem('prayer_draft')
            content.value = ''
            router.push({ name: 'home' })
        })
    })
}

function onInput() {
    savePrayerDraft()
    nextTick(() => {
        if (textareaRef.value) autoResize(textareaRef.value)
    })
}

onMounted(() => {
    verse.value = prayerVerses[Math.floor(Math.random() * prayerVerses.length)]
    loadPrayerDraft()
    nextTick(() => {
        if (textareaRef.value) autoResize(textareaRef.value)
    })
})
</script>

<template>
    <div class="screen">
        <div class="header">
            <h3>🙏 향연</h3>
            <p>우리의 기도가 하늘에 닿기를</p>
        </div>
        <div class="input-card" style="background:#E3F2FD; color:#1565C0; padding:15px; font-weight:bold; margin-bottom:15px; font-size:14px; line-height:1.5; text-align:center;">
            {{ verse }}
        </div>
        <div class="input-card">
            <textarea
                ref="textareaRef"
                v-model="content"
                class="auto-textarea auto-resize-box"
                placeholder="무엇을 서원드릴까요?"
                @input="onInput"
                style="min-height:150px; padding:10px;"
            ></textarea>
        </div>
        <button class="btn" @click="submitPrayer" :disabled="ui.isProcessing">
            {{ ui.isProcessing ? '올리는 중...' : '향연 올리기 🕊️' }}
        </button>
    </div>
</template>
