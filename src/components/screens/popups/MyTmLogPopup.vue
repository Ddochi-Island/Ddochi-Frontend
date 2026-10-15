<script setup>
// 합당한자 화면 "내 티엠 내역" — 고른 날(기본 오늘) 내가 돌린 통화를 "섭외자/섭외유형/티엠결과" 양식으로 보여주고 복사
import { ref, computed, onMounted } from 'vue'
import { useApi } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'

const emit = defineEmits(['close'])
const { callApiPromise } = useApi()
const { showToast } = usePopup()

const pad = (n) => String(n).padStart(2, '0')
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }

const date = ref(today())
const list = ref([])
const loading = ref(false)
const error = ref('')

async function load() {
    loading.value = true
    error.value = ''
    const r = await callApiPromise('/api/shed/my-tm-log', { date: date.value })
    loading.value = false
    if (!r?.success) { error.value = r?.message || '불러오지 못했어요. 잠시 뒤 다시 열어 주세요.'; list.value = []; return }
    list.value = r.list || []
}

// 결과 뒤 괄호: 거절/비합 사유, 예약 티엠 시각, 부재중 문자 발송 여부
function resultText(x) {
    const extra = x.reservedAt || x.subReason || (x.noAnswerMsg ? '부재중 문자 발송' : '')
    return extra ? `${x.result}(${extra})` : x.result
}
const text = computed(() => [`티엠수 ${list.value.length}건`, ...list.value.map((x) => `${x.name}/${x.type}/${resultText(x)}`)].join('\n'))

function copy() {
    navigator.clipboard.writeText(text.value).catch(() => {})
    showToast('📋 티엠 내역 복사됨')
}
onMounted(load)
</script>

<template>
    <div class="modal-overlay" @click.self="emit('close')">
        <div class="modal-card tl-modal" role="dialog" aria-label="내 티엠 내역">
            <span class="modal-close" @click="emit('close')">&times;</span>
            <div class="modal-title">📋 내 티엠 내역</div>
            <div class="tl-bar">
                <input v-model="date" type="date" class="tl-date" aria-label="날짜" @change="load">
                <button class="tl-copy" :disabled="loading || !list.length" @click="copy">복사</button>
            </div>
            <p v-if="loading" class="tl-empty">불러오는 중…</p>
            <p v-else-if="error" class="tl-error">{{ error }}</p>
            <p v-else-if="!list.length" class="tl-empty">이 날은 돌린 티엠이 없어요.</p>
            <pre v-else class="tl-text">{{ text }}</pre>
        </div>
    </div>
</template>

<style scoped>
.tl-modal { max-width: 420px; }
.tl-bar { display: flex; gap: 8px; margin: 8px 0 10px; }
.tl-date { flex: 1; padding: 7px 10px; border: 1px solid #c5e1a5; border-radius: 8px; font: inherit; }
.tl-copy { padding: 7px 16px; border: none; border-radius: 8px; background: #558b2f; color: #fff; font-family: "Jua", sans-serif; cursor: pointer; }
.tl-copy:disabled { opacity: .4; cursor: default; }
.tl-text { margin: 0; padding: 12px; text-align: left; background: #f1f8e9; border-radius: 10px; white-space: pre-wrap; word-break: keep-all;
    font-family: inherit; font-size: 14px; line-height: 1.7; max-height: 60vh; overflow: auto; color: #33691e; }
.tl-empty { padding: 24px 0; text-align: center; color: #8d6e63; }
.tl-error { padding: 10px 12px; border-radius: 8px; background: #fdecea; color: #b71c1c; }
.tl-copy:focus-visible, .tl-date:focus-visible { outline: 3px solid #aed581; outline-offset: 2px; }
</style>
