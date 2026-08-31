<script setup>
import { computed, ref, watch, nextTick } from 'vue'
import { usePopup } from '@/composables/usePopup'
import PasswordPrompt from './PasswordPrompt.vue'

const { popupStack, passwordState, closePopup } = usePopup()

const currentPopup = computed(() => {
    return popupStack.length > 0 ? popupStack[popupStack.length - 1] : null
})

function handleAlertOk() {
    const cb = currentPopup.value?.callback
    closePopup()
    if (cb) cb()
}

function handleConfirmYes() {
    const cb = currentPopup.value?.callback
    closePopup()
    if (cb) cb(true)
}

function handleConfirmNo() {
    const cb = currentPopup.value?.callback
    closePopup()
    if (cb) cb(false)
}

// For custom popups that use v-html and onclick handlers,
// we need to expose functions to window temporarily
function handleCustomCallback(result) {
    const cb = currentPopup.value?.callback
    closePopup()
    if (cb) cb(result)
}

// ── 'text' 타입 — 단일 줄 입력 (legacy showPopup('text', title, currentVal, cb)) ──
const textInput = ref('')
const textInputRef = ref(null)
watch(currentPopup, (p) => {
    if (!p) return
    if (p.type === 'text') {
        // legacy 의 desc 가 currentVal 역할 (V1 호환). 명시 opts.value 가 있으면 우선.
        textInput.value = String(p.opts?.value ?? '')
        nextTick(() => { textInputRef.value?.focus() })
    } else if (p.type === 'date') {
        textInput.value = ''
        dateInput.value = p.opts?.defaultDate || ''
        reasonInput.value = ''
        dateUndecided.value = false
    } else if (p.type === 'reason') {
        reasonType.value = ''
        reasonInput.value = ''
    }
}, { immediate: true })

function handleTextSubmit() {
    const v = textInput.value
    const cb = currentPopup.value?.callback
    closePopup()
    if (cb) cb({ text: v })
}

// ── 'date' 타입 — 날짜+시간 + 사유 입력 (legacy 의 티엠예약/장기관리/finalResult 등) ──
const dateInput = ref('')
const reasonInput = ref('')
const dateUndecided = ref(false)
function handleDateSubmit() {
    const cb = currentPopup.value?.callback
    closePopup()
    const dateVal = dateUndecided.value ? '미정' : dateInput.value
    if (cb) cb({ date: dateVal, reason: reasonInput.value })
}

// ── 'reason' 타입 — 사유 type 선택 (옵션 grid) + 자유 입력 ──
const reasonType = ref('')
function handleReasonSubmit() {
    const cb = currentPopup.value?.callback
    closePopup()
    if (cb) cb({ reasonType: reasonType.value, reason: reasonInput.value })
}
</script>

<template>
    <!-- Password Prompt (separate from popup stack) -->
    <PasswordPrompt v-if="passwordState.visible" />

    <!-- Main Popup —
         legacy 의 9999 oneoff popup (HomeScreen 작전판, Dolyo*Modal 등) 위에 떠야 하므로
         base 10000+. popupStack 의 깊이에 따라 +10 씩 (popup-on-popup 도 정합). -->
    <div
        v-if="currentPopup"
        class="modal-overlay"
        :style="{ zIndex: 10000 + popupStack.length * 10 }"
        @click.self="closePopup"
    >
        <!-- Raw mode: full HTML replacement -->
        <div v-if="currentPopup.opts?.raw" class="modal-card" style="height:80vh; padding:0;">
            <div v-html="currentPopup.opts.html"></div>
        </div>

        <!-- Standard popup card -->
        <div v-else class="modal-card">
            <span class="modal-close" @click="closePopup">&times;</span>
            <div class="modal-title">{{ currentPopup.title }}</div>
            <div v-if="currentPopup.desc && currentPopup.type !== 'text'" class="modal-desc">{{ currentPopup.desc }}</div>

            <!-- App Alert -->
            <template v-if="currentPopup.type === 'appAlert'">
                <div class="modal-desc" style="display:block;background:none;padding:0;" v-html="currentPopup.opts.message"></div>
                <div class="btn-group">
                    <button class="btn-pos" @click="handleAlertOk">확인</button>
                </div>
            </template>

            <!-- App Confirm -->
            <template v-else-if="currentPopup.type === 'appConfirm'">
                <div class="modal-desc" style="display:block;background:none;padding:0;" v-html="currentPopup.opts.message"></div>
                <div class="btn-group">
                    <button class="btn-pos" @click="handleConfirmYes">{{ currentPopup.opts?.yesLabel || '응!' }}</button>
                    <button class="btn-neg" @click="handleConfirmNo">{{ currentPopup.opts?.noLabel || '아니' }}</button>
                </div>
            </template>

            <!-- Decision (재가/반려) -->
            <template v-else-if="currentPopup.type === 'decision'">
                <div class="btn-group">
                    <button class="btn-pos" style="background:#4CAF50" @click="handleCustomCallback({ choice: 'approve' })">재가!</button>
                    <button class="btn-neg" style="background:#FF9800;color:white" @click="handleCustomCallback({ choice: 'reject' })">반려ㅠ</button>
                </div>
            </template>

            <!-- Approve Confirm -->
            <template v-else-if="currentPopup.type === 'approveConfirm'">
                <div class="btn-group">
                    <button class="btn-pos" @click="handleCustomCallback({ proceed: true })">센터가자!</button>
                    <button class="btn-neg" @click="handleCustomCallback({ proceed: false })">아 잠깐..</button>
                </div>
            </template>

            <!-- Redecide -->
            <template v-else-if="currentPopup.type === 'redecideAppr'">
                <div class="btn-group">
                    <button class="btn-pos" @click="handleCustomCallback({ proceed: true })">응!</button>
                    <button class="btn-neg" @click="handleCustomCallback({ proceed: false })">잘못눌렀어..</button>
                </div>
            </template>

            <!-- Date Check -->
            <template v-else-if="currentPopup.type === 'dateCheck'">
                <div class="btn-group">
                    <button class="btn-pos" @click="handleCustomCallback({ proceed: true })">오타 맞아!</button>
                    <button class="btn-neg" @click="handleCustomCallback({ proceed: false })">앗 밀린거다!</button>
                </div>
            </template>

            <!-- Reconfirm -->
            <template v-else-if="currentPopup.type === 'reconfirm'">
                <div class="btn-col">
                    <button class="btn-pos" @click="handleCustomCallback({ proceed: true })">알아! 진행할게</button>
                    <button class="btn-neg" @click="handleCustomCallback({ proceed: false })">잘못눌렀어!</button>
                </div>
            </template>

            <!-- Conflict -->
            <template v-else-if="currentPopup.type === 'conflict'">
                <div class="btn-col">
                    <button class="btn-pos" @click="handleCustomCallback('force')">그냥 입력하기!</button>
                    <button class="btn-neg" @click="handleCustomCallback('reload')">포기하고 새로고침!</button>
                </div>
            </template>

            <!-- DupCheck -->
            <template v-else-if="currentPopup.type === 'dupCheck'">
                <div class="dup-list">
                    <div v-for="(h, i) in currentPopup.opts.history" :key="i" class="dup-item">
                        {{ h.date }} | {{ h.manager }} | {{ h.result }}
                    </div>
                </div>
                <div class="btn-group">
                    <button class="btn-pos" @click="handleCustomCallback({ proceed: true })">한번 더!</button>
                    <button class="btn-neg" @click="handleCustomCallback({ proceed: false })">놓아주기..</button>
                </div>
            </template>

            <!-- Text input (legacy 'text' type — 단일 줄 입력) -->
            <template v-else-if="currentPopup.type === 'text'">
                <div class="input-card" style="margin-top: 10px;">
                    <input
                        ref="textInputRef"
                        v-model="textInput"
                        type="text"
                        class="popup-text-input"
                        :placeholder="currentPopup.desc || ''"
                        @keyup.enter="handleTextSubmit"
                    />
                </div>
                <div class="btn-group">
                    <button class="btn-pos" @click="handleTextSubmit">확인</button>
                    <button class="btn-neg" @click="closePopup">취소</button>
                </div>
            </template>

            <!-- Date + reason (티엠예약 / 장기관리 / finalResult) -->
            <template v-else-if="currentPopup.type === 'date'">
                <div style="display:flex; flex-direction:column; gap:8px; margin-top: 10px;">
                    <label style="display:flex; align-items:center; gap:6px; font-size:14px; color:#555; font-weight:bold; cursor:pointer; white-space:nowrap;">
                        <input type="checkbox" v-model="dateUndecided" style="width:16px; height:16px; flex-shrink:0;" />
                        날짜 미정
                    </label>
                    <label class="popup-label">📅 날짜·시각</label>
                    <div class="input-card" style="margin:0;">
                        <input v-model="dateInput" type="datetime-local" class="popup-text-input" :disabled="dateUndecided" />
                    </div>
                    <label class="popup-label">📝 메모(선택)</label>
                    <div class="input-card" style="margin:0;">
                        <input v-model="reasonInput" type="text" class="popup-text-input" placeholder="이유 / 메모" />
                    </div>
                </div>
                <div class="btn-group">
                    <button class="btn-pos" @click="handleDateSubmit">확인</button>
                    <button class="btn-neg" @click="closePopup">취소</button>
                </div>
            </template>

            <!-- Reason picker (비합처리 / 거절처리) -->
            <template v-else-if="currentPopup.type === 'reason'">
                <div class="reason-grid">
                    <div
                        v-for="opt in (currentPopup.opts?.options || [])"
                        :key="opt"
                        class="reason-btn"
                        :class="{ selected: reasonType === opt }"
                        @click="reasonType = opt"
                    >{{ opt }}</div>
                </div>
                <div class="input-card" style="margin-top: 10px;">
                    <input v-model="reasonInput" type="text" class="popup-text-input" placeholder="구체적 사유 (선택)" />
                </div>
                <div class="btn-group">
                    <button class="btn-pos" :disabled="!reasonType" @click="handleReasonSubmit">확인</button>
                    <button class="btn-neg" @click="closePopup">취소</button>
                </div>
            </template>

            <!-- Custom (with v-html) -->
            <template v-else-if="currentPopup.type === 'custom'">
                <div v-html="currentPopup.opts?.html"></div>
            </template>

            <!-- Fallback for other types - rendered as custom with v-html -->
            <template v-else>
                <div v-if="currentPopup.opts?.html" v-html="currentPopup.opts.html"></div>
            </template>
        </div>
    </div>
</template>

<style scoped>
.popup-text-input {
    width: 100%;
    border: none;
    outline: none;
    background: transparent;
    font-size: 14px;
    color: #333;
    padding: 4px 0;
}
.popup-label {
    font-size: 12px;
    color: #666;
    font-weight: bold;
}
.reason-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    margin-top: 8px;
}
.reason-btn {
    background: #FAFAFA;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 10px;
    text-align: center;
    cursor: pointer;
    font-size: 13px;
    color: #555;
    transition: 0.15s;
}
.reason-btn:hover { background: #FFF3E0; }
.reason-btn.selected {
    background: #FF9800;
    border-color: #FF9800;
    color: white;
    font-weight: bold;
}
.btn-pos:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
