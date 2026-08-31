<script setup>
// 📝 재가 요청서 — 부구역장이 잠긴 항목(온라인 찾기/교사매칭/복음방) 해금을 요청.
// 제출 후 복사, 재가(앱 밖에서)가 떨어지면 본인이 "재가완료!" 로 self-report 해금.
// backend: POST /api/area-score/unlock-requests, /unlock-requests/list, /unlock-requests/:id/complete

import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useApi } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'
import { useFormatters } from '@/composables/useFormatters'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const { callApi, callApiPromise } = useApi()
const { showAppAlert, showToast } = usePopup()
const { copyText } = useFormatters()

const ITEM_OPTIONS = [
    { code: 'online_search', label: '온라인 찾기 (1.0점)' },
    { code: 'teacher_match', label: '교사매칭 (0.5점)' },
    { code: 'gospel_room', label: '복음방 (0.5점)' },
]

const itemCode = ref(ITEM_OPTIONS[0].code)
const reason = ref('')
const submitting = ref(false)
const requests = ref([])
const loading = ref(true)

const itemLabel = computed(() => ITEM_OPTIONS.find((o) => o.code === itemCode.value)?.label || '')

function buildRequestText() {
    return [
        '[구역 점수 재가 요청서]',
        `팀: ${auth.currentUserTeam || ''}`,
        `구역: ${auth.currentUserArea || ''}`,
        `직책: ${auth.currentUserRole || ''}`,
        `이름: ${auth.currentUserName || ''}`,
        `항목: ${itemLabel.value}`,
        `사유: ${reason.value}`,
    ].join('\n')
}

function loadList() {
    loading.value = true
    callApi('/api/area-score/unlock-requests/list', {}, (r) => {
        loading.value = false
        if (!r?.success) return showAppAlert(r?.message || '불러오기 실패')
        requests.value = r.list || []
    })
}

async function submit() {
    if (!reason.value.trim()) return showAppAlert('사유를 작성해주세요!')
    submitting.value = true
    const r = await callApiPromise('/api/area-score/unlock-requests', { itemCode: itemCode.value, reason: reason.value.trim() })
    submitting.value = false
    if (!r.success) return showAppAlert(r.message || '제출 실패')

    copyText(buildRequestText())
    showToast('제출되었습니다! 요청서 내용이 복사되었어요 📋')
    reason.value = ''
    loadList()
}

function copyRequest(req) {
    const text = [
        '[구역 점수 재가 요청서]',
        `팀: ${auth.currentUserTeam || ''}`,
        `구역: ${auth.currentUserArea || ''}`,
        `직책: ${auth.currentUserRole || ''}`,
        `이름: ${auth.currentUserName || ''}`,
        `항목: ${req.label}`,
        `사유: ${req.reason}`,
    ].join('\n')
    copyText(text)
    showToast('복사되었습니다 📋')
}

async function completeRequest(req) {
    const r = await callApiPromise(`/api/area-score/unlock-requests/${req.id}/complete`, {})
    if (!r.success) return showAppAlert(r.message || '처리 실패')
    req.status = 'unlocked'
    showAppAlert('해금되었습니다! (30일간 유효) 🎉')
}

onMounted(() => {
    if (route.query.itemCode && ITEM_OPTIONS.some((o) => o.code === route.query.itemCode)) {
        itemCode.value = route.query.itemCode
    }
    loadList()
})
</script>

<template>
    <div class="screen">
        <div class="header">
            <span class="header-emoji">📝</span>
            <h3>재가 요청서</h3>
            <p>잠긴 항목 해금을 요청해요</p>
        </div>

        <div class="input-card">
            <label style="margin-top:0;">해금 요청 항목</label>
            <select v-model="itemCode">
                <option v-for="o in ITEM_OPTIONS" :key="o.code" :value="o.code">{{ o.label }}</option>
            </select>

            <div class="input-grid-2" style="margin-top:10px;">
                <div>
                    <label>팀</label>
                    <div class="input-card" style="margin-top:4px; color:#888;">{{ auth.currentUserTeam }}</div>
                </div>
                <div>
                    <label>구역</label>
                    <div class="input-card" style="margin-top:4px; color:#888;">{{ auth.currentUserArea }}</div>
                </div>
            </div>
            <div class="input-grid-2">
                <div>
                    <label>직책</label>
                    <div class="input-card" style="margin-top:4px; color:#888;">{{ auth.currentUserRole }}</div>
                </div>
                <div>
                    <label>이름</label>
                    <div class="input-card" style="margin-top:4px; color:#888;">{{ auth.currentUserName }}</div>
                </div>
            </div>

            <label>사유</label>
            <textarea v-model="reason" class="auto-textarea input-card" rows="3" placeholder="예: 구역장님 출장으로 이번주 대신 진행하려 합니다"></textarea>

            <button class="btn" :disabled="submitting" @click="submit">{{ submitting ? '제출 중...' : '제출하기' }}</button>
        </div>

        <div class="input-card">
            <label style="margin-top:0;">내 요청 내역</label>
            <div v-if="loading" style="text-align:center; padding:15px; color:#999;">불러오는 중...</div>
            <div v-else-if="requests.length === 0" style="text-align:center; padding:15px; color:#999;">요청 내역이 없어요</div>
            <div v-for="req in requests" :key="req.id" style="padding:10px 0; border-top:1px dashed #eee;">
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
                    <strong>{{ req.label }}</strong>
                    <span v-if="req.status === 'unlocked'" style="font-size:11px; color:#4CAF50; font-weight:bold;">해금됨</span>
                    <span v-else style="font-size:11px; color:var(--accent-color); font-weight:bold;">대기중</span>
                </div>
                <div style="font-size:12px; color:#888; margin-bottom:6px;">"{{ req.reason }}"</div>
                <div style="display:flex; gap:8px;">
                    <button class="btn-sm" @click="copyRequest(req)">복사하기</button>
                    <button v-if="req.status === 'pending'" class="btn-approve" style="width:auto;" @click="completeRequest(req)">재가완료!</button>
                </div>
            </div>
        </div>

        <button class="btn-neg" style="max-width:200px; margin:20px auto 0; display:block;" @click="router.back()">뒤로</button>
    </div>
</template>
