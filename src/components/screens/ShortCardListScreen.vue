<script setup>
import { ref, computed, onMounted } from 'vue'
import { useApi } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'
import { useAuthStore } from '@/stores/auth'
import { stageLabels, stageNameToIndex } from '@/constants'
import FarmerJournalPopup from './popups/FarmerJournalPopup.vue'

const { callApi } = useApi()
const { showAppConfirm, showAppAlert, showToast } = usePopup()
const auth = useAuthStore()
const list = ref([])
const loading = ref(true)
const canApprove = ref(false)
const othersLabel = ref(null)
const activeTab = ref('mine') // 'pending' | 'mine' | 'others'
const journalCardId = ref(null)

const STATUS_EMOJI = { pending: '🌱', approved: '🌻', rejected: '🥀' }
const STATUS_LABEL = { pending: '대기중', approved: '재가완료', rejected: '반려됨' }
const STAGE_EMOJI = { 씨앗: '🌰', 새싹: '🌿', 떡잎: '🍀' }
// 농부일지 성장 단계 — stageLabels/stageNameToIndex는 기존 인도권(dolyo) 상수 재사용
// (constants/index.js). '씨앗 🌰' 형태라 라벨/이모지가 한 문자열에 같이 있음.
function journalStageDisplay(stage) {
    return stageLabels[stageNameToIndex[stage]] || stage
}

// 대기 목록: 아직 재가 안 된(대기중/반려됨) 전체. 나의 밭 / 구역·지역의 밭: 재가된 것만,
// 인도자가 본인인지 아닌지로 갈림.
const pendingList = computed(() => list.value.filter(c => c.approval_status !== 'approved'))
const mineList = computed(() => list.value.filter(c => c.approval_status === 'approved' && c.member_id === auth.currentSabun))
const othersList = computed(() => list.value.filter(c => c.approval_status === 'approved' && c.member_id !== auth.currentSabun))

const visibleList = computed(() => {
    if (activeTab.value === 'mine') return mineList.value
    if (activeTab.value === 'others') return othersList.value
    return pendingList.value
})

const counts = computed(() => {
    const c = { pending: 0, approved: 0, rejected: 0 }
    list.value.forEach(x => { if (c[x.approval_status] !== undefined) c[x.approval_status]++ })
    return c
})

// 나의 밭 / 구역·지역의 밭 탭에서는 상태 대신 성장 단계(씨앗/새싹/떡잎)로 상단 통계 교체.
const stageCounts = computed(() => {
    const c = { 씨앗: 0, 새싹: 0, 떡잎: 0 }
    visibleList.value.forEach(x => { if (c[x.stage] !== undefined) c[x.stage]++ })
    return c
})

function openJournal(card) {
    journalCardId.value = card.short_card_id
}

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
            othersLabel.value = r.othersLabel || null
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
    <div class="screen sc-toss">
        <div class="sc-top">
            <h1 class="sc-title">밭 관리하기</h1>
            <p class="sc-subtitle">내가 심은 짧카들, 무럭무럭 자라는 중</p>

            <div v-if="activeTab === 'pending'" class="sc-stat-row">
                <div class="sc-stat-chip">
                    <span class="sc-stat-emoji">🌱</span>
                    <span class="sc-stat-num">{{ counts.pending }}</span>
                    <span class="sc-stat-label">대기중</span>
                </div>
                <div class="sc-stat-chip">
                    <span class="sc-stat-emoji">🌻</span>
                    <span class="sc-stat-num">{{ counts.approved }}</span>
                    <span class="sc-stat-label">재가완료</span>
                </div>
                <div class="sc-stat-chip">
                    <span class="sc-stat-emoji">🥀</span>
                    <span class="sc-stat-num">{{ counts.rejected }}</span>
                    <span class="sc-stat-label">반려됨</span>
                </div>
            </div>
            <div v-else class="sc-stat-row">
                <div class="sc-stat-chip">
                    <span class="sc-stat-emoji">🌰</span>
                    <span class="sc-stat-num">{{ stageCounts.씨앗 }}</span>
                    <span class="sc-stat-label">씨앗</span>
                </div>
                <div class="sc-stat-chip">
                    <span class="sc-stat-emoji">🌿</span>
                    <span class="sc-stat-num">{{ stageCounts.새싹 }}</span>
                    <span class="sc-stat-label">새싹</span>
                </div>
                <div class="sc-stat-chip">
                    <span class="sc-stat-emoji">🍀</span>
                    <span class="sc-stat-num">{{ stageCounts.떡잎 }}</span>
                    <span class="sc-stat-label">떡잎</span>
                </div>
            </div>
        </div>

        <div class="sc-list-area">
            <div v-if="loading" class="sc-empty">불러오는 중...</div>
            <div v-else-if="!visibleList.length" class="sc-empty">
                <div class="sc-empty-icon">🌾</div>
                <div v-if="activeTab === 'pending'">대기 중인 짧카가 없어요</div>
                <div v-else-if="activeTab === 'mine'">재가받은 내 짧카가 없어요</div>
                <div v-else>{{ othersLabel || '남의 밭' }}에 아직 없어요</div>
            </div>

            <div v-else class="sc-cards">
                <div v-for="c in visibleList" :key="c.short_card_id"
                     :class="['sc-card', activeTab !== 'pending' ? 'sc-card-clickable' : '']"
                     @click="activeTab !== 'pending' && openJournal(c)">
                    <div class="sc-card-top">
                        <div v-if="activeTab === 'pending'" class="sc-icon-badge" :class="'sc-icon-' + c.approval_status">{{ STATUS_EMOJI[c.approval_status] || '🌱' }}</div>
                        <div v-else class="sc-icon-badge" :class="'sc-icon-stage-' + c.stage">{{ STAGE_EMOJI[c.stage] || '🌰' }}</div>
                        <div class="sc-card-heading">
                            <div class="sc-name">{{ c.name }}</div>
                            <div class="sc-meta">{{ c.age || '-' }}세 · {{ c.gender || '-' }}</div>
                        </div>
                        <span v-if="activeTab === 'pending'" :class="['sc-badge', 'sc-badge-' + c.approval_status]">{{ STATUS_LABEL[c.approval_status] || c.approval_status }}</span>
                        <span v-else class="sc-badge sc-badge-stage">{{ journalStageDisplay(c.stage) }}</span>
                    </div>

                    <div class="sc-info">
                        <div class="sc-row">🏫 {{ c.school_major || '-' }}</div>
                        <div class="sc-row">📍 {{ c.residence || '-' }} · 🙏 {{ c.religion || '-' }}</div>
                        <div v-if="c.environment" class="sc-row">🌤️ {{ c.environment }}</div>
                        <div v-if="c.recruit_note" class="sc-row">💭 {{ c.recruit_note }}</div>
                    </div>

                    <div class="sc-card-bottom">
                        <span>인도자 {{ c.author_name }}</span>
                        <span>{{ fmtDate(c.created_at) }}</span>
                    </div>

                    <div v-if="canApprove && c.approval_status === 'pending'" class="sc-decide-row">
                        <button class="sc-btn sc-btn-primary" @click="decide(c, '재가')">재가</button>
                        <button class="sc-btn sc-btn-ghost" @click="decide(c, '반려')">반려</button>
                    </div>
                </div>
            </div>
        </div>

        <div class="sc-tabbar">
            <button :class="['sc-tab', activeTab === 'pending' ? 'sc-tab-active' : '']" @click="activeTab = 'pending'">
                <span class="sc-tab-icon-wrap">
                    <span class="sc-tab-icon">⏳</span>
                    <span v-if="pendingList.length" class="sc-tab-count">{{ pendingList.length }}</span>
                </span>
                <span>대기 목록</span>
            </button>
            <button :class="['sc-tab', activeTab === 'mine' ? 'sc-tab-active' : '']" @click="activeTab = 'mine'">
                <span class="sc-tab-icon-wrap">
                    <span class="sc-tab-icon">👤</span>
                    <span v-if="mineList.length" class="sc-tab-count">{{ mineList.length }}</span>
                </span>
                <span>나의 밭</span>
            </button>
            <button v-if="othersLabel" :class="['sc-tab', activeTab === 'others' ? 'sc-tab-active' : '']" @click="activeTab = 'others'">
                <span class="sc-tab-icon-wrap">
                    <span class="sc-tab-icon">🌍</span>
                    <span v-if="othersList.length" class="sc-tab-count">{{ othersList.length }}</span>
                </span>
                <span>{{ othersLabel }}</span>
            </button>
        </div>

        <FarmerJournalPopup v-if="journalCardId" :short-card-id="journalCardId" @close="journalCardId = null" @saved="load" />
    </div>
</template>

<style scoped>
.sc-toss {
    margin: 0 -20px;
    min-height: calc(100vh - 50px);
    display: flex;
    flex-direction: column;
    background: var(--bg-color);
    padding-bottom: 76px;
}

.sc-top {
    background: var(--card-bg);
    padding: 24px 20px 18px;
}
.sc-title {
    font-size: 22px;
    font-weight: 800;
    color: var(--text-color);
    margin: 0;
}
.sc-subtitle {
    font-size: 14px;
    color: #A1887F;
    margin: 4px 0 18px;
}
.sc-stat-row {
    display: flex;
    gap: 8px;
}
.sc-stat-chip {
    flex: 1;
    background: #FFF3E0;
    border-radius: 14px;
    padding: 12px 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
}
.sc-stat-emoji {
    font-size: 18px;
}
.sc-stat-num {
    font-size: 17px;
    font-weight: 800;
    color: var(--text-color);
}
.sc-stat-label {
    font-size: 11px;
    color: #A1887F;
}

.sc-list-area {
    flex: 1;
    padding: 16px 16px 0;
}
.sc-empty {
    text-align: center;
    padding: 60px 10px;
    color: #A1887F;
    font-size: 14px;
}
.sc-empty-icon {
    font-size: 32px;
    margin-bottom: 8px;
}
.sc-cards {
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.sc-card {
    background: var(--card-bg);
    border-radius: 18px;
    padding: 16px;
    box-shadow: var(--shadow);
}
.sc-card-clickable {
    cursor: pointer;
    transition: transform .08s;
}
.sc-card-clickable:active {
    transform: scale(.98);
}
.sc-card-top {
    display: flex;
    align-items: center;
    gap: 10px;
}
.sc-icon-badge {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 19px;
    background: #FFF3E0;
}
.sc-icon-approved {
    background: #FFE9B3;
}
.sc-icon-rejected {
    background: #FCEEEE;
}
.sc-icon-stage-씨앗 {
    background: #FBF0DE;
}
.sc-icon-stage-새싹 {
    background: #EAF7E9;
}
.sc-icon-stage-떡잎 {
    background: #DEF2D9;
}
.sc-card-heading {
    flex: 1;
    min-width: 0;
}
.sc-name {
    font-size: 16px;
    font-weight: 700;
    color: var(--text-color);
}
.sc-meta {
    font-size: 12px;
    color: #A1887F;
    margin-top: 1px;
}
.sc-badge {
    font-size: 11px;
    font-weight: 700;
    padding: 4px 9px;
    border-radius: 20px;
    flex-shrink: 0;
}
.sc-badge-pending {
    background: #FFF1E6;
    color: #E6720B;
}
.sc-badge-approved {
    background: #FFE9B3;
    color: var(--btn-color);
}
.sc-badge-rejected {
    background: #FCEEEE;
    color: #E0433F;
}
.sc-badge-stage {
    background: #EAF7E9;
    color: #22A340;
}
.sc-info {
    margin-top: 12px;
    padding-left: 50px;
}
.sc-row {
    font-size: 13px;
    color: var(--text-color);
    line-height: 1.6;
}
.sc-card-bottom {
    display: flex;
    justify-content: space-between;
    margin-top: 12px;
    padding-top: 10px;
    padding-left: 50px;
    border-top: 1px solid #F3E5D8;
    font-size: 11px;
    color: #BCAAA4;
}
.sc-decide-row {
    display: flex;
    gap: 8px;
    margin-top: 12px;
    padding-left: 50px;
}
.sc-btn {
    flex: 1;
    padding: 11px;
    border: none;
    border-radius: 12px;
    font-family: 'Jua', sans-serif;
    font-size: 14px;
    cursor: pointer;
    transition: transform .08s, opacity .08s;
}
.sc-btn:active {
    transform: scale(.97);
    opacity: .85;
}
.sc-btn-primary {
    background: var(--btn-color);
    color: #fff;
}
.sc-btn-ghost {
    background: #FFF3E0;
    color: var(--text-color);
}

.sc-tabbar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    background: var(--card-bg);
    border-top: 1px solid #F3E5D8;
    padding: 8px 12px calc(8px + env(safe-area-inset-bottom));
    z-index: 3;
}
.sc-tab {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 6px 4px;
    border: none;
    background: transparent;
    color: #BCAAA4;
    font-family: 'Jua', sans-serif;
    font-size: 11px;
    cursor: pointer;
}
.sc-tab-icon-wrap {
    position: relative;
    display: inline-flex;
}
.sc-tab-icon {
    font-size: 19px;
    filter: grayscale(1);
    opacity: .5;
}
.sc-tab-count {
    position: absolute;
    top: -6px;
    right: -10px;
    background: #FF5252;
    color: #fff;
    font-size: 10px;
    line-height: 1;
    padding: 3px 5px;
    border-radius: 20px;
    min-width: 14px;
    text-align: center;
}
.sc-tab-active {
    color: var(--btn-color);
}
.sc-tab-active .sc-tab-icon {
    filter: none;
    opacity: 1;
}
</style>
