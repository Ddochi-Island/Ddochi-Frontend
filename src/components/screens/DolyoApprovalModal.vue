<script setup>
// DolyoApprovalModal — 재가/반려/매칭취소 결정.
// legacy2 dolyoApprDecision (line 15993~16026) 의 4단 popup chain 의 Vue 화.
//
// 흐름:
//   step 1: 결정 (재가 / 반려 / 매칭취소)
//   재가  → step 2-A: 합재양 확인했냐 confirm → 저장
//   반려  → step 2-B: 반려 사유 type 선택 (자유 텍스트 입력 후 저장)
//   매칭취소 → step 2-C: 취소 사유 옵션 (5개) 선택 → 저장

import { ref } from 'vue'
import { useDolyo } from '@/composables/useDolyo'
import { usePopup } from '@/composables/usePopup'

const props = defineProps({
    docId: { type: String, required: true },
})
const emit = defineEmits(['close', 'saved'])

const { setApproval } = useDolyo()
const { showAppAlert, showToast } = usePopup()

// 매칭취소 사유 옵션 (legacy line 16012)
const CANCEL_OPTIONS = ['의심/경계', '거리부담', '대면부담', '메리트부족', '답장안옴']

const step = ref(1)              // 1 | 'approve_confirm' | 'reject_form' | 'cancel_pick' | 'cancel_detail'
const reasonType = ref('')
const reasonText = ref('')
const submitting = ref(false)

async function commit(decision) {
    if (submitting.value) return
    submitting.value = true
    try {
        const r = await setApproval(
            props.docId, decision, reasonType.value, reasonText.value
        )
        if (r && (r.success || r.ok)) {
            showAppAlert(r.message || `${decision} 처리 완료!`, () => emit('close'))
            emit('saved', { decision, reasonType: reasonType.value, reason: reasonText.value })
        } else {
            showToast(r?.message || '오류 발생')
        }
    } catch (e) {
        showToast(e.message || '오류 발생')
    } finally {
        submitting.value = false
    }
}

function pick(option) {
    if (option === '재가') step.value = 'approve_confirm'
    else if (option === '반려') step.value = 'reject_form'
    else step.value = 'cancel_pick'
}

function pickCancelReason(opt) {
    reasonType.value = opt
    step.value = 'cancel_detail'
}

function autoResize(e) {
    const ta = e.target
    ta.style.height = 'auto'
    ta.style.height = ta.scrollHeight + 'px'
}
</script>

<template>
    <Teleport to="body">
        <div class="dly-ap-overlay" @click.self="emit('close')">
            <div class="dly-ap-card">
                <!-- step 1 -->
                <template v-if="step === 1">
                    <div class="modal-title">재가하여 주시옵소서.</div>
                    <div class="dly-ap-desc">합재양 확인 하셨죠?🤔</div>
                    <div class="btn-group">
                        <button class="btn-pos" :disabled="submitting" @click="pick('재가')">✅ 재가</button>
                        <button class="btn-neg" @click="pick('반려')">➖ 반려</button>
                    </div>
                    <div style="margin-top:6px;">
                        <button class="btn-neg" style="width:100%; background:#888;" @click="pick('취소')">매칭취소</button>
                    </div>
                </template>

                <!-- step approve_confirm -->
                <template v-else-if="step === 'approve_confirm'">
                    <div class="modal-title" style="color:#2E7D32;">오예! 정말요!?</div>
                    <div class="dly-ap-desc">비합사유를 모두 확인하셨나요?</div>
                    <div class="btn-group">
                        <button class="btn-pos" :disabled="submitting" @click="commit('재가')">
                            {{ submitting ? '처리 중...' : '예 재가' }}
                        </button>
                        <button class="btn-neg" @click="step = 1">← 뒤로</button>
                    </div>
                </template>

                <!-- step reject_form -->
                <template v-else-if="step === 'reject_form'">
                    <div class="modal-title" style="color:#E65100;">너무 슬퍼요..</div>
                    <div class="dly-ap-desc">반려 사유 type 을 입력해줘.</div>
                    <label>유형 (한 단어)</label>
                    <div class="input-card">
                        <input v-model="reasonType" type="text" placeholder="예: 환경비합">
                    </div>
                    <label>상세 (선택)</label>
                    <div class="input-card">
                        <textarea v-model="reasonText" rows="1" @input="autoResize" placeholder="자세히..."></textarea>
                    </div>
                    <div class="btn-group" style="margin-top:10px;">
                        <button class="btn-pos" :disabled="submitting || !reasonType" @click="commit('반려')">
                            {{ submitting ? '처리 중...' : '반려 처리' }}
                        </button>
                        <button class="btn-neg" @click="step = 1">← 뒤로</button>
                    </div>
                </template>

                <!-- step cancel_pick -->
                <template v-else-if="step === 'cancel_pick'">
                    <div class="modal-title" style="color:#5E35B1;">매칭취소 사유</div>
                    <div class="dly-ap-grid">
                        <button v-for="opt in CANCEL_OPTIONS" :key="opt" class="dly-ap-pill"
                            @click="pickCancelReason(opt)">{{ opt }}</button>
                    </div>
                    <div class="btn-group" style="margin-top:10px;">
                        <button class="btn-neg" @click="step = 1">← 뒤로</button>
                    </div>
                </template>

                <!-- step cancel_detail -->
                <template v-else-if="step === 'cancel_detail'">
                    <div class="modal-title" style="color:#5E35B1;">매칭취소 — {{ reasonType }}</div>
                    <div class="dly-ap-desc">상세 사유 (선택)</div>
                    <div class="input-card">
                        <textarea v-model="reasonText" rows="1" @input="autoResize" placeholder="자세히..."></textarea>
                    </div>
                    <div class="btn-group" style="margin-top:10px;">
                        <button class="btn-pos" :disabled="submitting" @click="commit('취소')">
                            {{ submitting ? '처리 중...' : '매칭취소 확정' }}
                        </button>
                        <button class="btn-neg" @click="step = 'cancel_pick'">← 뒤로</button>
                    </div>
                </template>
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
.dly-ap-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
}
.dly-ap-card {
    background: #fff;
    border-radius: 16px;
    width: 85%;
    max-width: 340px;
    padding: 18px 16px 14px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
}
.modal-title { font-weight: bold; font-size: 16px; margin-bottom: 6px; }
.dly-ap-desc { font-size: 13px; color: #888; margin-bottom: 12px; }
.dly-ap-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-top: 6px;
}
.dly-ap-pill {
    padding: 12px 8px;
    border: 1px solid #ddd;
    border-radius: 10px;
    background: #fff;
    cursor: pointer;
    font-family: inherit;
    font-size: 13px;
    color: #333;
}
.dly-ap-pill:hover { background: #f5f5f5; }
</style>
