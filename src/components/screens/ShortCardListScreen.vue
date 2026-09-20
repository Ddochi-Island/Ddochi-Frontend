<script setup>
import { ref, onMounted } from 'vue'
import { useApi } from '@/composables/useApi'

const { callApi } = useApi()
const list = ref([])
const loading = ref(true)

function fmtDate(iso) {
    if (!iso) return ''
    return iso.replace('T', ' ').slice(0, 16)
}

onMounted(() => {
    callApi('/api/short-cards/list', {}, r => {
        loading.value = false
        if (r?.success) list.value = r.list || []
    })
})
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
</style>
