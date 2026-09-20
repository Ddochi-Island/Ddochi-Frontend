<script setup>
import { ref, onMounted } from 'vue'
import { useApi } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'

const { callApi } = useApi()
const { showAppConfirm, showAppAlert, showToast } = usePopup()
const list = ref([])
const loading = ref(true)
const canApprove = ref(false)

function fmtDate(iso) {
    if (!iso) return ''
    return iso.replace('T', ' ').slice(0, 16)
}

function load() {
    callApi('/api/short-cards/list', {}, r => {
        loading.value = false
        if (r?.success) {
            list.value = r.list || []
            canApprove.value = !!r.canApprove
        }
    })
}
onMounted(load)

function decide(card, statusKo) {
    showAppConfirm(`${card.name}님 짧카를 ${statusKo}하시겠어요?`, (ok) => {
        if (!ok) return
        callApi('/api/short-cards/approve', { shortCardId: card.short_card_id, status: statusKo }, r => {
            if (!r?.success) { showAppAlert(r?.message || '처리 실패'); return }
            showToast(r.message)
            load()
        })
    })
}
</script>

<template>
    <div class="screen">
        <div class="header">
            <h3>🏞️ 밭 관리하기</h3>
            <p>내 짧카 및 볼 수 있는 범위의 짧카 목록</p>
        </div>

        <div v-if="loading" style="text-align:center;padding:20px;">로딩 중...</div>
        <div v-else-if="!list.length" style="text-align:center;padding:20px;">아직 짧카가 없어요 🌱</div>

        <div v-else class="sc-list">
            <div v-for="c in list" :key="c.short_card_id" class="sc-card">
                <div class="sc-card-top">
                    <span class="sc-name">{{ c.name }}</span>
                    <span :class="['sc-badge', 'sc-badge-' + c.approval_status]">{{ c.approval_status_label }}</span>
                    <span class="sc-meta">{{ c.age || '-' }}세 / {{ c.gender || '-' }}</span>
                </div>
                <div class="sc-row">🏫 {{ c.school_major || '-' }}</div>
                <div class="sc-row">📍 {{ c.residence || '-' }} · 🙏 {{ c.religion || '-' }}</div>
                <div v-if="c.environment" class="sc-row">🌱 {{ c.environment }}</div>
                <div v-if="c.recruit_note" class="sc-row">💭 {{ c.recruit_note }}</div>
                <div class="sc-card-bottom">
                    <span>인도자 {{ c.author_name }}</span>
                    <span>{{ fmtDate(c.created_at) }}</span>
                </div>
                <div v-if="canApprove && c.approval_status === 'pending'" class="sc-decide-row">
                    <button class="sc-btn sc-btn-approve" @click="decide(c, '재가')">🎉 재가</button>
                    <button class="sc-btn sc-btn-reject" @click="decide(c, '반려')">🚫 반려</button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.sc-list {
    padding: 8px 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.sc-card {
    background: var(--card-bg);
    padding: 14px;
    border-radius: 12px;
    box-shadow: var(--shadow);
}
.sc-card-top {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 6px;
}
.sc-name {
    font-size: 18px;
    font-weight: bold;
}
.sc-meta {
    font-size: 14px;
    color: #888;
}
.sc-row {
    font-size: 14px;
    color: #555;
    margin-top: 4px;
}
.sc-card-bottom {
    display: flex;
    justify-content: space-between;
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px solid #eee;
    font-size: 12px;
    color: #999;
}
.sc-badge {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 10px;
    font-weight: bold;
}
.sc-badge-pending {
    background: #FFF3E0;
    color: #EF6C00;
}
.sc-badge-approved {
    background: #E8F5E9;
    color: #2E7D32;
}
.sc-badge-rejected {
    background: #FFEBEE;
    color: #C62828;
}
.sc-decide-row {
    display: flex;
    gap: 8px;
    margin-top: 10px;
}
.sc-btn {
    flex: 1;
    padding: 8px;
    border: none;
    border-radius: 8px;
    font-family: 'Jua', sans-serif;
    font-size: 14px;
    cursor: pointer;
}
.sc-btn-approve {
    background: #4CAF50;
    color: #fff;
}
.sc-btn-reject {
    background: #eee;
    color: #666;
}
</style>
