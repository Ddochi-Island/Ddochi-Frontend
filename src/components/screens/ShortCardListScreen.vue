<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'
import { useAuthStore } from '@/stores/auth'
import { stageLabels, stageNameToIndex } from '@/constants'
import FarmerJournalPopup from './popups/FarmerJournalPopup.vue'
import FarmGameView from './FarmGameView.vue'
import { PLANT_SPRITES } from './farmSprites'

const router = useRouter()
const { callApi } = useApi()
const { showAppConfirm, showAppAlert, showToast } = usePopup()
const auth = useAuthStore()
const list = ref([])
const loading = ref(true)
const othersLabel = ref(null)
const groupGoals = ref([]) // 반장 이상: [{name, sprouts, goal, leaderName}]
const activeTab = ref('mine') // 'sprout' | 'mine' | 'others'
const journalCardId = ref(null)

// 게임 모드(밭 격자 화면) ON/OFF — 기기별 localStorage. 나의 밭 탭에만 적용, 재가 탭은 항상 목록.
// ponytail: 기기별 저장, 기기 간 유지가 필요해지면 서버(FARM_PROFILES)로 이동
const GAME_MODE_KEY = 'farmGameMode'
const gameMode = ref((() => { try { return localStorage.getItem(GAME_MODE_KEY) === '1' } catch { return false } })())
function toggleGameMode() {
    gameMode.value = !gameMode.value
    try { localStorage.setItem(GAME_MODE_KEY, gameMode.value ? '1' : '0') } catch { /* 저장 못 해도 이번 화면에선 동작 */ }
}
const gameView = computed(() => gameMode.value && activeTab.value === 'mine')
// 게임 전체 화면 툴바: 다른 탭으로 가거나(게임 화면은 나의 밭에만 있어 자연히 닫힘) 목록 보기로 전환
function onGameTab(t) {
    if (t === 'list') toggleGameMode()
    else activeTab.value = t
}

const STAGE_EMOJI = { 씨앗: '🌰', 새싹: '🌿', 떡잎: '🍀' }
// 농부일지 성장 단계 — stageLabels/stageNameToIndex는 기존 인도권(dolyo) 상수 재사용
// (constants/index.js). '씨앗 🌰' 형태라 라벨/이모지가 한 문자열에 같이 있음.
function journalStageDisplay(stage) {
    return stageLabels[stageNameToIndex[stage]] || stage
}

// 짧카는 재가 없이 바로 밭에 올라감. 재가는 2단계까지 채운 뒤 떡잎이 될 때만(반장 이상).
// 떡잎 재가 탭: 재가 대기 중인 짧카 — 재가할 수 있는 사람에겐 재가/반려 버튼, 작성자에겐 진행 상황.
const sproutList = computed(() => list.value.filter(c => c.sprout_status === 'pending'))
const mineList = computed(() => list.value.filter(c => c.member_id === auth.currentSabun))
// 상단 반 칩을 누르면 그 반(작성자 현재 구역이 반에 속한)의 밭만 — 다시 누르면 해제
const selectedGroup = ref(null)
const inSelectedGroup = (c) => !selectedGroup.value ||
    (c.author_region === selectedGroup.value.region && (selectedGroup.value.districts || []).includes(c.author_district))
function toggleGroup(g) {
    selectedGroup.value = selectedGroup.value?.groupId === g.groupId ? null : g
    if (selectedGroup.value && othersLabel.value) activeTab.value = 'others'
}
const othersList = computed(() => list.value.filter(c => c.member_id !== auth.currentSabun && inSelectedGroup(c)))
const sproutDecidable = computed(() => sproutList.value.filter(c => c.can_decide_sprout).length)

const visibleList = computed(() => {
    if (activeTab.value === 'mine') return mineList.value
    if (activeTab.value === 'others') return othersList.value
    return sproutList.value
})

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
            othersLabel.value = r.othersLabel || null
            groupGoals.value = r.groupGoals || []
        } else {
            // 실패하면 빈 밭처럼 보여서 반·반의 밭이 "없는" 걸로 오해됨 — 실패를 알림
            showAppAlert(`밭을 불러오지 못했어요. 잠시 후 다시 열어 주세요.${r?.message ? '<br>(' + r.message + ')' : ''}`)
        }
    })
}
onMounted(load)

function decideSprout(card, statusKo) {
    const msg = statusKo === '재가'
        ? `${card.name} 짧카를 떡잎으로 올릴까요? 🍀`
        : `${card.name} 짧카의 떡잎 재가를 반려할까요? (인도자가 2단계까지 고쳐 다시 저장하면 다시 올라와요)`
    showAppConfirm(msg, (ok) => {
        if (!ok) return
        callApi('/api/short-cards/sprout-decide', { shortCardId: card.short_card_id, status: statusKo }, r => {
            if (!r?.success) { showAppAlert(r?.message || '처리 실패'); return }
            showToast(r.message)
            load()
        })
    })
}
</script>

<template>
    <div :class="['screen', 'sc-toss', gameView ? 'sc-game' : '']">
        <div class="sc-top">
            <button class="sc-plant-btn" @click="router.push({ name: 'shortCard' })">🌱 씨앗 심기</button>
            <h1 class="sc-title">밭 관리하기</h1>
            <p class="sc-subtitle">내가 심은 짧카들, 무럭무럭 자라는 중</p>

            <div v-if="groupGoals.length" class="sc-goal-row">
                <div v-for="g in groupGoals" :key="g.groupId"
                     :class="['sc-goal-chip', g.sprouts >= g.goal ? 'sc-goal-done' : '', selectedGroup?.groupId === g.groupId ? 'sc-goal-selected' : '']"
                     role="button" tabindex="0" @click="toggleGroup(g)" @keydown.enter="toggleGroup(g)">
                    <span class="sc-goal-name">{{ g.name }}{{ g.leaderName ? ' · ' + g.leaderName : '' }}</span>
                    <span class="sc-goal-num">🍀 {{ g.sprouts }} / {{ g.goal }}</span>
                </div>
            </div>
            <div class="sc-stat-row">
                <div v-for="st in ['씨앗', '새싹', '떡잎']" :key="st" class="sc-stat-chip">
                    <img v-if="gameView" :src="PLANT_SPRITES[st]" alt="" class="sc-stat-sprite" />
                    <span v-else class="sc-stat-emoji">{{ STAGE_EMOJI[st] }}</span>
                    <span class="sc-stat-num">{{ stageCounts[st] }}</span>
                    <span class="sc-stat-label">{{ st }}</span>
                </div>
            </div>
        </div>

        <div class="sc-list-area">
            <div v-if="activeTab === 'mine' && !loading" class="sc-mode-row">
                <button class="sc-mode-toggle" role="switch" :aria-checked="gameMode" @click="toggleGameMode">
                    <span>🎮 게임 모드</span>
                    <span :class="['sc-switch', gameMode ? 'sc-switch-on' : '']"></span>
                </button>
            </div>

            <div v-if="loading" class="sc-empty">불러오는 중...</div>
            <FarmGameView v-else-if="gameView" :list="mineList" :owner-name="auth.currentUserName || ''"
                          :goals="groupGoals" :sprout-badge="sproutDecidable || sproutList.length" :others-label="othersLabel || ''"
                          @open="openJournal" @plant="router.push({ name: 'shortCard' })" @tab="onGameTab" />
            <div v-else-if="!visibleList.length" class="sc-empty">
                <div class="sc-empty-icon">🌾</div>
                <div v-if="activeTab === 'sprout'">떡잎 재가를 기다리는 짧카가 없어요</div>
                <div v-else-if="activeTab === 'mine'">아직 심은 짧카가 없어요</div>
                <div v-else-if="selectedGroup">{{ selectedGroup.name }}의 밭에 아직 없어요</div>
                <div v-else>{{ othersLabel || '남의 밭' }}에 아직 없어요</div>
            </div>

            <div v-else class="sc-cards">
                <div v-for="c in visibleList" :key="c.short_card_id" class="sc-card sc-card-clickable" @click="openJournal(c)">
                    <div class="sc-card-top">
                        <div class="sc-icon-badge" :class="'sc-icon-stage-' + c.stage">{{ STAGE_EMOJI[c.stage] || '🌰' }}</div>
                        <div class="sc-card-heading">
                            <div class="sc-name">{{ c.name }}</div>
                            <div class="sc-meta">{{ c.age || '-' }}세 · {{ c.gender || '-' }}</div>
                        </div>
                        <span class="sc-badge sc-badge-stage">{{ journalStageDisplay(c.stage) }}</span>
                    </div>
                    <div v-if="c.sprout_status === 'pending' || c.sprout_status === 'rejected'"
                         :class="['sc-sprout-status', 'sc-sprout-' + c.sprout_status]">
                        {{ c.sprout_status === 'pending' ? '⏳ 떡잎 재가 대기' : '🥀 떡잎 반려 — 2단계까지 고쳐 저장하면 다시 올라가요' }}
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

                    <div v-if="activeTab === 'sprout' && c.can_decide_sprout" class="sc-decide-row" @click.stop>
                        <button class="sc-btn sc-btn-primary" @click="decideSprout(c, '재가')">떡잎 재가</button>
                        <button class="sc-btn sc-btn-ghost" @click="decideSprout(c, '반려')">반려</button>
                    </div>
                </div>
            </div>
        </div>

        <div class="sc-tabbar">
            <button :class="['sc-tab', activeTab === 'sprout' ? 'sc-tab-active' : '']" @click="activeTab = 'sprout'">
                <span class="sc-tab-icon-wrap">
                    <span class="sc-tab-icon">🍀</span>
                    <span v-if="sproutDecidable || sproutList.length" class="sc-tab-count">{{ sproutDecidable || sproutList.length }}</span>
                </span>
                <span>떡잎 재가</span>
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
                <span>{{ selectedGroup ? selectedGroup.name + '의 밭' : othersLabel }}</span>
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
    position: relative;
    background: var(--card-bg);
    padding: 24px 20px 18px;
}
.sc-plant-btn {
    position: absolute;
    top: 24px;
    right: 20px;
    border: 1px solid var(--btn-color);
    background: #E8F5E9;
    color: var(--btn-color);
    font-size: 13px;
    font-weight: 700;
    padding: 7px 12px;
    border-radius: 20px;
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
.sc-goal-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 10px;
}
.sc-goal-selected {
    outline: 2px solid #2E7D32;
    outline-offset: 1px;
}
.sc-goal-chip {
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    background: #F1F8E9;
    border: 1px solid #C5E1A5;
    border-radius: 20px;
    padding: 5px 10px;
    font-size: 12px;
}
.sc-goal-done { background: #DCEDC8; border-color: #7CB342; }
.sc-goal-name { color: #558B2F; font-weight: 600; }
.sc-goal-num { color: var(--text-color); font-weight: 800; }
.sc-sprout-status { margin: 8px 0 0; font-size: 12px; font-weight: 600; padding: 6px 10px; border-radius: 8px; }
.sc-sprout-pending { background: #FFF8E1; color: #F57F17; }
.sc-sprout-rejected { background: #FFEBEE; color: #C62828; }
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
.sc-mode-row {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 10px;
}
.sc-mode-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    border: none;
    background: transparent;
    font-family: 'Jua', sans-serif;
    font-size: 13px;
    color: var(--text-color);
    cursor: pointer;
}
.sc-switch {
    position: relative;
    width: 36px;
    height: 20px;
    border-radius: 20px;
    background: #D7CCC8;
    transition: background .15s;
}
.sc-switch::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #fff;
    transition: transform .15s;
}
.sc-switch-on { background: var(--btn-color); }
.sc-switch-on::after { transform: translateX(16px); }
/* 게임 모드 스킨 — 하늘·잔디 배경, 나무 테두리의 통통한 패널 */
.sc-game {
    background: linear-gradient(#bfe3f5 0, #e3f3d6 260px, #f4ecd8 560px);
}
.sc-game .sc-top { background: transparent; }
.sc-game .sc-title { color: #4e342e; text-shadow: 0 2px 0 #fff8e7; }
.sc-game .sc-subtitle { color: #6d8b4e; }
.sc-game .sc-plant-btn {
    background: #7cc255;
    color: #fff;
    border: 2px solid #4f8a35;
    box-shadow: 0 3px 0 #4f8a35;
}
.sc-game .sc-stat-chip,
.sc-game .sc-goal-chip {
    background: #fff8e7;
    border: 2px solid #8b5a2b;
    box-shadow: 0 3px 0 #8b5a2b;
}
.sc-stat-sprite { width: 32px; height: 32px; image-rendering: pixelated; }
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
