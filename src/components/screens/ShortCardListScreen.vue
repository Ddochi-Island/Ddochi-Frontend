<script setup>
import { ref, computed, onMounted } from 'vue'
import { useApi } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'
import { useAuthStore } from '@/stores/auth'

const { callApi } = useApi()
const { showAppConfirm, showAppAlert, showToast } = usePopup()
const auth = useAuthStore()
const list = ref([])
const loading = ref(true)
const canApprove = ref(false)
const showMineOnly = ref(false)

const STAGE_EMOJI = { pending: '🌱', approved: '🌻', rejected: '🥀' }

const visibleList = computed(() => {
    if (!showMineOnly.value) return list.value
    return list.value.filter(c => c.member_id === auth.currentSabun)
})

const counts = computed(() => {
    const c = { pending: 0, approved: 0, rejected: 0 }
    visibleList.value.forEach(x => { if (c[x.approval_status] !== undefined) c[x.approval_status]++ })
    return c
})

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
    <div class="screen sc-game">
        <div class="sc-hud">
            <div class="sc-hud-title">
                <span class="sc-hud-icon">🏞️</span>
                <div>
                    <div class="sc-hud-h1">밭 관리하기</div>
                    <div class="sc-hud-sub">내가 심은 짧카들, 무럭무럭 자라는 중</div>
                </div>
            </div>
            <div class="sc-hud-stats">
                <span class="sc-stat">🌱 {{ counts.pending }}</span>
                <span class="sc-stat">🌻 {{ counts.approved }}</span>
                <span class="sc-stat">🥀 {{ counts.rejected }}</span>
            </div>
        </div>

        <div class="sc-meadow">
            <span class="sc-deco sc-tree-l">🌲</span>
            <span class="sc-deco sc-bush-l">🌳</span>
            <span class="sc-deco sc-tree-r">🌳</span>
            <span class="sc-deco sc-rock">🪨</span>
            <span class="sc-deco sc-flower">🌼</span>

            <div class="sc-field">
                <div v-if="loading" class="sc-empty">🚜 밭 갈아엎는 중...</div>
                <div v-else-if="!visibleList.length" class="sc-empty">
                    <div class="sc-empty-icon">🌾</div>
                    <div>{{ showMineOnly ? '내가 심은 짧카가 없어요' : '아직 심어둔 짧카가 없어요' }}</div>
                </div>

                <div v-else class="sc-plots">
                    <div v-for="c in visibleList" :key="c.short_card_id" :class="['sc-plot', 'sc-plot-' + c.approval_status]">
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
            </div>

            <div class="sc-fence">
                <span v-for="n in 10" :key="n">🟫</span>
            </div>
        </div>

        <div class="sc-toolbar">
            <button :class="['sc-tool-btn', !showMineOnly ? 'sc-tool-active' : '']" @click="showMineOnly = false">
                <span class="sc-tool-icon">🏞️</span>
                <span class="sc-tool-label">전체 밭</span>
            </button>
            <button :class="['sc-tool-btn', showMineOnly ? 'sc-tool-active' : '']" @click="showMineOnly = true">
                <span class="sc-tool-icon">🧑‍🌾</span>
                <span class="sc-tool-label">내가 심은 것</span>
            </button>
        </div>
    </div>
</template>

<style scoped>
.sc-game {
    margin: 0 -20px;
    min-height: calc(100vh - 50px);
    display: flex;
    flex-direction: column;
    background: linear-gradient(180deg, #EFF7E1, #DCEEC3);
}

/* ── 상단 HUD ── */
.sc-hud {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    padding: 14px 16px;
    background: linear-gradient(180deg, #8D6E4B, #6D4C24);
    box-shadow: 0 3px 0 #4E3418, 0 6px 10px rgba(0,0,0,.25);
    position: relative;
    z-index: 2;
}
.sc-hud-title {
    display: flex;
    align-items: center;
    gap: 10px;
}
.sc-hud-icon {
    font-size: 26px;
    filter: drop-shadow(0 2px 1px rgba(0,0,0,.3));
}
.sc-hud-h1 {
    font-size: 18px;
    font-weight: bold;
    color: #FFF6E0;
    text-shadow: 0 2px 0 rgba(0,0,0,.35);
}
.sc-hud-sub {
    font-size: 11px;
    color: #E4D2AC;
    margin-top: 1px;
}
.sc-hud-stats {
    display: flex;
    gap: 6px;
    flex-shrink: 0;
}
.sc-stat {
    background: rgba(0,0,0,.22);
    border: 1px solid rgba(255,255,255,.25);
    border-radius: 20px;
    padding: 4px 9px;
    font-size: 12px;
    color: #FFF6E0;
    white-space: nowrap;
}

/* ── 초원 ── */
.sc-meadow {
    position: relative;
    flex: 1;
    padding: 18px 14px 0;
    background:
        radial-gradient(circle at 15% 8%, rgba(255,255,255,.35), transparent 40%),
        linear-gradient(180deg, #AEDC7F, #8BC34A 60%, #7CB342);
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
.sc-deco {
    position: absolute;
    filter: drop-shadow(0 2px 2px rgba(0,0,0,.15));
    pointer-events: none;
}
.sc-tree-l { top: 6px; left: 6px; font-size: 32px; }
.sc-bush-l { top: 46px; left: -6px; font-size: 24px; opacity: .85; }
.sc-tree-r { top: 2px; right: 10px; font-size: 30px; }
.sc-rock { bottom: 34px; left: 12px; font-size: 20px; }
.sc-flower { bottom: 30px; right: 18px; font-size: 18px; }

.sc-field {
    position: relative;
    z-index: 1;
    background: linear-gradient(160deg, #DCC098, #C29A65);
    border-radius: 18px 18px 0 0;
    padding: 16px 12px;
    box-shadow: inset 0 0 0 3px rgba(255,255,255,.25), 0 -4px 10px rgba(90,60,20,.15);
    flex: 1;
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
    transition: transform .08s, box-shadow .08s;
}
.sc-btn:active {
    transform: translateY(2px);
}
.sc-btn-approve {
    background: #7CB342;
    color: #fff;
    box-shadow: 0 3px 0 #5D8C2C;
}
.sc-btn-approve:active {
    box-shadow: 0 1px 0 #5D8C2C;
}
.sc-btn-reject {
    background: #EFE5D2;
    color: #8D6E4B;
    box-shadow: 0 3px 0 #D9C7A0;
}
.sc-btn-reject:active {
    box-shadow: 0 1px 0 #D9C7A0;
}
.sc-fence {
    display: flex;
    justify-content: space-between;
    padding: 4px 10px 10px;
    font-size: 18px;
    line-height: 1;
    opacity: .85;
    background: #7CB342;
}

/* ── 하단 툴바 ── */
.sc-toolbar {
    position: sticky;
    bottom: 0;
    display: flex;
    gap: 8px;
    padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
    background: linear-gradient(0deg, #8D6E4B, #6D4C24);
    box-shadow: 0 -3px 0 #4E3418, 0 -6px 10px rgba(0,0,0,.2);
    z-index: 3;
}
.sc-tool-btn {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 8px 4px;
    border: none;
    border-radius: 12px;
    background: rgba(0,0,0,.2);
    color: #D8C6A4;
    font-family: 'Jua', sans-serif;
    cursor: pointer;
    transition: transform .08s, background .15s, color .15s;
}
.sc-tool-btn:active {
    transform: translateY(1px);
}
.sc-tool-icon {
    font-size: 22px;
}
.sc-tool-label {
    font-size: 11px;
}
.sc-tool-active {
    background: #FFF6E0;
    color: #6D4C24;
    box-shadow: inset 0 0 0 2px #C29A65;
}
</style>
