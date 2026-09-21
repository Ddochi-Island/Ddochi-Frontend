<script setup>
import { ref, onMounted } from 'vue'
import { useApi } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'

const { callApi } = useApi()
const { showAppConfirm, showAppAlert, showToast } = usePopup()
const list = ref([])
const loading = ref(true)
const canApprove = ref(false)

const STAGE_EMOJI = { pending: '🌱', approved: '🌻', rejected: '🥀' }

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
        <div class="header sc-header">
            <h3>🏞️ 밭 관리하기</h3>
            <p>내가 심은 짧카들, 무럭무럭 자라는 중</p>
        </div>

        <div class="sc-meadow">
            <span class="sc-tree sc-tree-l">🌲</span>
            <span class="sc-tree sc-tree-r">🌳</span>

            <div class="sc-field">
                <div v-if="loading" class="sc-empty">🚜 밭 갈아엎는 중...</div>
                <div v-else-if="!list.length" class="sc-empty">
                    <div class="sc-empty-icon">🌾</div>
                    <div>아직 심어둔 짧카가 없어요</div>
                </div>

                <div v-else class="sc-plots">
                    <div v-for="c in list" :key="c.short_card_id" :class="['sc-plot', 'sc-plot-' + c.approval_status]">
                        <div class="sc-plant">{{ STAGE_EMOJI[c.approval_status] || '🌱' }}</div>
                        <div class="sc-plot-body">
                            <div class="sc-plot-top">
                                <span class="sc-name">{{ c.name }}</span>
                                <span :class="['sc-badge', 'sc-badge-' + c.approval_status]">{{ c.approval_status_label }}</span>
                            </div>
                            <div class="sc-meta">{{ c.age || '-' }}세 · {{ c.gender || '-' }}</div>
                            <div class="sc-row">🏫 {{ c.school_major || '-' }}</div>
                            <div class="sc-row">📍 {{ c.residence || '-' }} · 🙏 {{ c.religion || '-' }}</div>
                            <div v-if="c.environment" class="sc-row">🌤️ {{ c.environment }}</div>
                            <div v-if="c.recruit_note" class="sc-row">💭 {{ c.recruit_note }}</div>
                            <div class="sc-plot-bottom">
                                <span>인도자 {{ c.author_name }}</span>
                                <span>{{ fmtDate(c.created_at) }}</span>
                            </div>
                            <div v-if="canApprove && c.approval_status === 'pending'" class="sc-decide-row">
                                <button class="sc-btn sc-btn-approve" @click="decide(c, '재가')">💧 재가로 물 주기</button>
                                <button class="sc-btn sc-btn-reject" @click="decide(c, '반려')">🥀 반려</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="sc-fence">
                    <span v-for="n in 8" :key="n">🟫</span>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.sc-header p {
    color: #689F38;
}
.sc-meadow {
    position: relative;
    margin: 4px 4px 16px;
    padding: 22px 14px 14px;
    border-radius: 24px;
    background: radial-gradient(circle at 20% 10%, #C5E1A5, #9CCC65 55%, #8BC34A);
    overflow: hidden;
}
.sc-tree {
    position: absolute;
    top: -6px;
    font-size: 30px;
    filter: drop-shadow(0 2px 2px rgba(0,0,0,.15));
}
.sc-tree-l { left: 4px; }
.sc-tree-r { right: 8px; }

.sc-field {
    position: relative;
    background: linear-gradient(160deg, #D9BA8C, #C29A65);
    border-radius: 18px;
    padding: 16px 12px 10px;
    box-shadow: inset 0 0 0 3px rgba(255,255,255,.25), 0 4px 10px rgba(90,60,20,.25);
}
.sc-empty {
    text-align: center;
    padding: 30px 10px;
    color: #6D4C24;
    font-size: 15px;
}
.sc-empty-icon {
    font-size: 34px;
    margin-bottom: 6px;
}
.sc-plots {
    display: flex;
    flex-direction: column;
    gap: 12px;
}
.sc-plot {
    display: flex;
    gap: 10px;
    background: #FBF3E3;
    border-radius: 14px;
    padding: 12px;
    box-shadow: 0 2px 4px rgba(90,60,20,.2);
    border: 2px solid #EADCB8;
}
.sc-plot-rejected {
    opacity: .75;
}
.sc-plant {
    font-size: 30px;
    line-height: 1;
    flex-shrink: 0;
    padding-top: 2px;
}
.sc-plot-body {
    flex: 1;
    min-width: 0;
}
.sc-plot-top {
    display: flex;
    align-items: center;
    gap: 8px;
}
.sc-name {
    font-size: 17px;
    font-weight: bold;
    color: #4E342E;
}
.sc-meta {
    font-size: 13px;
    color: #8D6E4B;
    margin-top: 2px;
}
.sc-row {
    font-size: 13px;
    color: #6D5738;
    margin-top: 4px;
}
.sc-plot-bottom {
    display: flex;
    justify-content: space-between;
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px dashed #DCC9A0;
    font-size: 11px;
    color: #A38A62;
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
    background: #FBE9E7;
    color: #A1424A;
}
.sc-decide-row {
    display: flex;
    gap: 8px;
    margin-top: 10px;
}
.sc-btn {
    flex: 1;
    padding: 9px;
    border: none;
    border-radius: 10px;
    font-family: 'Jua', sans-serif;
    font-size: 13px;
    cursor: pointer;
}
.sc-btn-approve {
    background: #7CB342;
    color: #fff;
    box-shadow: 0 2px 0 #5D8C2C;
}
.sc-btn-reject {
    background: #EFE5D2;
    color: #8D6E4B;
    box-shadow: 0 2px 0 #D9C7A0;
}
.sc-fence {
    display: flex;
    justify-content: space-between;
    margin-top: 12px;
    padding: 0 2px;
    font-size: 20px;
    line-height: 1;
    opacity: .85;
}
</style>
