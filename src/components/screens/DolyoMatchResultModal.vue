<script setup>
// DolyoMatchResultModal — 매칭 결과 입력.
// legacy2 의 dolyoInputMatchResult + dolyoHandleMatchRes (line 16028~) 의 Vue 화.
// 첫 단계: 만남픽스/비합처리/거절처리 selection.
// 비합/거절 선택 시 sub-reason picker 가 같은 modal 안에서 step 2 로 전환.

import { ref } from 'vue'
import { useDolyo } from '@/composables/useDolyo'
import { usePopup } from '@/composables/usePopup'

const props = defineProps({
    docId: { type: String, required: true },
})
const emit = defineEmits(['close', 'saved'])

const { setMatchResult } = useDolyo()
const { showAppAlert, showToast } = usePopup()

const BIHAP_OPTIONS = ['환경비합', '거리비합', '나이비합', '인성비합', '정신질환', '중복섭외']
const GEOJEOL_OPTIONS = ['N번 안받음', '수신거절', '의심/경계', '거리부담', '대면부담', '메리트부족']

const step = ref(1)               // 1 = type 선택, 2 = sub-reason
const pickedType = ref('')        // '비합처리' | '거절처리'
const submitting = ref(false)

async function commitManpix() {
    if (submitting.value) return
    submitting.value = true
    try {
        const r = await setMatchResult(props.docId, '만남픽스', '')
        if (r && (r.success || r.ok)) {
            showAppAlert(r.message || '만남픽스 저장됐어!', () => emit('close'))
            emit('saved', { type: '만남픽스' })
        } else {
            showToast(r?.message || '오류 발생')
        }
    } catch (e) {
        showToast(e.message || '오류 발생')
    } finally {
        submitting.value = false
    }
}

function pickType(type) {
    pickedType.value = type
    step.value = 2
}

async function commitSubReason(sub) {
    if (submitting.value) return
    submitting.value = true
    try {
        const r = await setMatchResult(props.docId, pickedType.value, sub)
        if (r && (r.success || r.ok)) {
            showAppAlert(r.message || '결과 입력 완료!', () => emit('close'))
            emit('saved', { type: pickedType.value, subReason: sub })
        } else {
            showToast(r?.message || '오류 발생')
        }
    } catch (e) {
        showToast(e.message || '오류 발생')
    } finally {
        submitting.value = false
    }
}

function goBack() {
    pickedType.value = ''
    step.value = 1
}
</script>

<template>
    <Teleport to="body">
        <div class="dly-mr-overlay" @click.self="emit('close')">
            <div class="dly-mr-card">
                <div class="dly-mr-head">
                    <div class="modal-title" v-if="step === 1">결과를 입력해줘!</div>
                    <div class="modal-title" v-else>{{ pickedType === '비합처리' ? '⭕️ 비합 사유' : '❌ 거절 사유' }}</div>
                    <span class="dly-mr-close" @click="emit('close')">×</span>
                </div>

                <div v-if="step === 1" class="dly-mr-grid">
                    <button class="dly-mr-btn manpix" :disabled="submitting" @click="commitManpix">만남픽스</button>
                    <button class="dly-mr-btn bihap" :disabled="submitting" @click="pickType('비합처리')">비합처리</button>
                    <button class="dly-mr-btn geojeol" :disabled="submitting" @click="pickType('거절처리')">거절처리</button>
                </div>

                <div v-else class="dly-mr-grid">
                    <button v-for="opt in (pickedType === '비합처리' ? BIHAP_OPTIONS : GEOJEOL_OPTIONS)"
                        :key="opt" class="dly-mr-btn sub" :disabled="submitting" @click="commitSubReason(opt)">
                        {{ opt }}
                    </button>
                    <button class="dly-mr-btn back" @click="goBack">← 뒤로</button>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
.dly-mr-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
}
.dly-mr-card {
    background: #fff;
    border-radius: 16px;
    width: 85%;
    max-width: 320px;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
}
.dly-mr-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 16px 0;
}
.modal-title { font-weight: bold; font-size: 16px; }
.dly-mr-close { cursor: pointer; font-size: 24px; color: #bbb; line-height: 1; }
.dly-mr-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    padding: 14px;
}
.dly-mr-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 14px 8px;
    border: 1px solid #ddd;
    border-radius: 10px;
    cursor: pointer;
    font-family: inherit;
    font-size: 14px;
    background: #fff;
}
.dly-mr-btn:disabled { opacity: 0.5; cursor: wait; }
.dly-mr-btn.manpix {
    grid-column: 1 / -1;
    background: #1565C0;
    color: #fff;
    border-color: #1565C0;
}
.dly-mr-btn.bihap { color: #6A1B9A; }
.dly-mr-btn.geojeol { color: #BF360C; }
.dly-mr-btn.sub { color: #444; }
.dly-mr-btn.back {
    grid-column: 1 / -1;
    color: #888;
    border-style: dashed;
}
</style>
