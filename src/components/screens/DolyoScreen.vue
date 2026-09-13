<script setup>
// DolyoScreen — 인도권(dolyo) 관리 화면.
//
// legacy2/public/index.html 의 dolyoScreen (line 3809-3861, openDolyoXxx 18 함수)
// 을 Vue 로 재구성. 이번 commit 은 read-only 단계 — 목록/검색/필터/제주 통계까지.
// 등록/수정/액션/삭제/매칭 진입은 후속 commit.
//
// 진입: HomeScreen 의 "🌱 너! 내 동료가 되라!" 핑크 banner.

import { onMounted, computed, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useDolyo } from '@/composables/useDolyo'
import DolyoDetail from '@/components/screens/DolyoDetail.vue'
import DolyoForm from '@/components/screens/DolyoForm.vue'

const auth = useAuthStore()
const isAdmin = computed(() => auth.isAdmin)

// modal state
const detailDocId = ref(null)     // docId 만 보관 — list 갱신 시 detail 도 자동 갱신
const detailItem = computed(() => {
    if (!detailDocId.value) return null
    return list.value.find(i => i.docId === detailDocId.value) || null
})
const formMode = ref(null)        // null | 'register' | 'edit'
const formItem = ref(null)        // edit 시 기존 item
const {
    list,
    loading,
    errorMsg,
    scope,
    scopeTeam,
    scopeArea,
    filterStage,
    filterStatus,
    searchQuery,
    filterPanelOpen,
    filteredList,
    stats,
    getList,
    setScope,
    setScopeTeam,
    setScopeArea,
    setFilterStage,
    setFilterStatus,
    toggleFilterPanel,
    getStage,
    getAvailableScopes,
    stageLabels,
} = useDolyo()

const availableScopes = computed(() =>
    getAvailableScopes(auth.currentUserRole || '', isAdmin.value)
)

// 팀/구역 셀렉터용
const allTeams = computed(() => {
    const users = (window.allUsers || [])
    return [...new Set(users.map(m => m.team).filter(Boolean))].sort()
})
const allZonesInTeam = computed(() => {
    if (!scopeTeam.value) return []
    const users = (window.allUsers || [])
    return [...new Set(users.filter(m => m.team === scopeTeam.value).map(m => m.area).filter(Boolean))].sort()
})

const showRegionPicker = computed(() => {
    const role = auth.currentUserRole || ''
    return (
        (scope.value === '지역' || scope.value === '구역') &&
        (isAdmin.value || /지역장|지구장|행정/.test(role))
    )
})

const filterChipLabel = computed(() => {
    const parts = []
    if (filterStage.value) parts.push(filterStage.value)
    if (filterStatus.value) parts.push(filterStatus.value)
    return parts.length ? parts.join('·') : '필터'
})
const hasFilter = computed(() => !!filterStage.value || !!filterStatus.value)

// 통계 텍스트 (컴포지션 — legacy 와 같은 어조)
const statsLine = computed(() => {
    const s = stats.value
    const parts = [`전체 ${s.total}명`, `씨앗 ${s.seed}`, `새싹 ${s.sprout}`, `떡잎 ${s.leaf}`]
    if (s.fruit) parts.push(`열매 ${s.fruit}`)
    if (s.approved) parts.push(`재가 ${s.approved}`)
    return parts.join(' · ')
})

// 항목별 표시 정보
function itemPathDisp(item) {
    return item.path ? item.path.split('(')[0] : '-'
}
function itemRelationDetail(item) {
    const fd = item.farmerDiary || {}
    return (fd.stage1 && fd.stage1.relationDetail) ? fd.stage1.relationDetail : ''
}
function itemFaithText(item) {
    const fd = item.farmerDiary || {}
    const map = { '무': '무신앙', '휴': '휴면', '신앙': '신앙인' }
    return fd.faith ? (map[fd.faith] || fd.faith) : ''
}
function itemApprBadge(item) {
    const map = { '재가': '✅재가', '반려': '➖반려', '취소': '➖취소' }
    return map[item.approvalStatus] || ''
}
function itemApprColor(item) {
    const colors = { '재가': '#4CAF50', '반려': '#EF6C00', '취소': '#795548' }
    return colors[item.approvalStatus] || '#888'
}
function itemSubInfo(item) {
    const parts = []
    if (item.residence) parts.push(item.residence)
    if (item.age) parts.push(`${item.age}세`)
    return parts.join(' ')
}
function itemRecentLog(item) {
    if (!item.actionLogs || item.actionLogs.length === 0) return ''
    return item.actionLogs[item.actionLogs.length - 1].content || ''
}

// 진입 시 데이터 로딩
onMounted(() => { getList() })

function openRegister() {
    formItem.value = null
    formMode.value = 'register'
}
function openDetail(item) {
    detailDocId.value = item.docId
}
function closeDetail() {
    detailDocId.value = null
}
function openEditFromDetail() {
    if (!detailItem.value) return
    formItem.value = detailItem.value
    formMode.value = 'edit'
    detailDocId.value = null
}
function closeForm() {
    formMode.value = null
    formItem.value = null
}
function onSaved(_docId) {
    // useDolyo.register/update 가 이미 getList() 호출. 추가 동작 없음.
}
</script>

<template>
    <div class="screen">
        <div class="header">
            <h3>🌱 너! 내 동료가 되라!</h3>
            <p>나의 인도권 관리</p>
        </div>

        <!-- 조회 범위 -->
        <div v-if="availableScopes.length > 1" class="dolyo-scope-bar">
            <button v-for="s in availableScopes" :key="s"
                :class="['scope-chip', { active: s === scope }]"
                @click="setScope(s)">{{ s }}</button>

            <select v-if="showRegionPicker" :value="scopeTeam"
                @change="setScopeTeam($event.target.value)" class="region-select">
                <option value="">전체지역</option>
                <option v-for="t in allTeams" :key="t" :value="t">{{ t }}</option>
            </select>

            <select v-if="scope === '구역' && scopeTeam" :value="scopeArea"
                @change="setScopeArea($event.target.value)" class="region-select">
                <option value="">전체구역</option>
                <option v-for="z in allZonesInTeam" :key="z" :value="z">{{ z }}</option>
            </select>
        </div>

        <!-- 검색바 -->
        <div style="margin-bottom:10px;">
            <div class="input-card" style="display:flex; align-items:center; gap:8px;">
                <span style="color:#888;">🔍</span>
                <input v-model="searchQuery" type="text" placeholder="이름 또는 인도자로 검색"
                    autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
                    style="flex:1; border:none; outline:none; background:transparent; color:#333;">
                <span @click="searchQuery = ''" style="cursor:pointer; color:#bbb; font-size:14px;">✕</span>
            </div>
        </div>

        <!-- 등록 버튼 -->
        <div style="text-align:right; margin-bottom:10px;">
            <button class="btn-pos" style="font-size:13px; padding:8px 16px;" @click="openRegister">
                + 새 인도권 등록
            </button>
        </div>

        <!-- 필터 + 통계 -->
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
            <div style="font-size:12px; color:#888;">{{ statsLine }}</div>
            <div style="position:relative;">
                <button @click="toggleFilterPanel"
                    :style="{
                        background: 'none',
                        border: '1px solid ' + (hasFilter ? '#1565C0' : '#ddd'),
                        borderRadius: '20px',
                        padding: '4px 12px',
                        fontSize: '13px',
                        cursor: 'pointer',
                        color: hasFilter ? '#1565C0' : '#555',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                    }">
                    <span>⚙</span><span>{{ filterChipLabel }}</span>
                </button>
                <div v-if="filterPanelOpen" class="dolyo-filter-panel">
                    <div class="filter-section-title">단계</div>
                    <div class="filter-chip-row">
                        <button v-for="[label, val] in [['전체', ''], ['씨앗', '씨앗'], ['새싹', '새싹'], ['떡잎', '떡잎'], ['열매', '열매']]"
                            :key="val"
                            :class="['filter-chip', { active: filterStage === val }]"
                            @click="setFilterStage(val)">{{ label }}</button>
                    </div>
                    <div class="filter-section-title" style="margin-top:12px;">상태</div>
                    <div class="filter-chip-row">
                        <button v-for="[label, val] in [['전체', ''], ['대기', '대기중'], ['재가', '재가'], ['반려', '반려'], ['취소', '취소']]"
                            :key="val"
                            :class="['filter-chip', { active: filterStatus === val }]"
                            @click="setFilterStatus(val)">{{ label }}</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- 목록 -->
        <div>
            <div v-if="loading" style="text-align:center; padding:30px; color:#aaa;">불러오는 중...</div>
            <div v-else-if="errorMsg" style="text-align:center; color:red; padding:30px;">{{ errorMsg }}</div>
            <div v-else-if="filteredList.length === 0" style="text-align:center; padding:40px; color:#aaa;">
                등록된 인도권이 없어 🌱
            </div>
            <div v-else>
                <div v-for="item in filteredList" :key="item.docId"
                    class="input-card dolyo-card"
                    :style="{ opacity: item.deleted ? 0.45 : 1 }"
                    @click="openDetail(item)">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div style="flex:1;">
                            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px; flex-wrap:wrap;">
                                <span style="font-weight:bold; font-size:15px;">{{ item.name }}</span>
                                <span v-if="item.deleted" style="font-size:10px; color:#fff; background:#9E9E9E; border-radius:8px; padding:1px 6px;">삭제됨</span>
                                <span style="font-size:11px; color:#666;">{{ stageLabels[getStage(item)] }}</span>
                                <span v-if="itemApprBadge(item)" :style="{ fontSize: '11px', color: itemApprColor(item), fontWeight: 'bold' }">{{ itemApprBadge(item) }}</span>
                            </div>
                            <div style="font-size:12px; color:#666; margin-bottom:2px;">
                                인도자: {{ item.manager || '-' }} · {{ itemPathDisp(item) }}<template v-if="itemRelationDetail(item)"> · {{ itemRelationDetail(item) }}</template><template v-if="itemFaithText(item)"> · {{ itemFaithText(item) }}</template>
                            </div>
                            <div style="font-size:12px; color:#888;">{{ itemSubInfo(item) }}</div>
                        </div>
                        <div style="font-size:20px; color:#ccc;">›</div>
                    </div>
                    <div v-if="itemRecentLog(item)"
                        style="margin-top:8px; padding-top:8px; border-top:1px solid #f0f0f0; font-size:12px; color:#888;">
                        🗓 최근: {{ itemRecentLog(item) }}
                    </div>
                </div>
            </div>
        </div>

        <DolyoDetail v-if="detailItem" :item="detailItem"
            @close="closeDetail" @edit="openEditFromDetail" />
        <DolyoForm v-if="formMode" :item="formItem"
            @close="closeForm" @saved="onSaved" />
    </div>
</template>

<style scoped>
.dolyo-scope-bar {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 10px;
}
.scope-chip {
    padding: 6px 14px;
    border-radius: 20px;
    border: none;
    font-size: 13px;
    cursor: pointer;
    background: #f5f5f5;
    color: #555;
    font-family: inherit;
}
.scope-chip.active {
    background: #E91E63;
    color: #fff;
}
.region-select {
    padding: 5px 8px;
    border-radius: 8px;
    border: 1px solid #ddd;
    font-size: 13px;
}
.dolyo-filter-panel {
    position: absolute;
    right: 0;
    top: 32px;
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 12px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    padding: 14px;
    z-index: 200;
    min-width: 200px;
}
.filter-section-title {
    font-size: 11px;
    color: #aaa;
    margin-bottom: 6px;
    font-weight: bold;
}
.filter-chip-row {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
}
.filter-chip {
    padding: 4px 10px;
    border-radius: 14px;
    border: 1px solid #ddd;
    font-size: 12px;
    cursor: pointer;
    background: #fff;
    color: #555;
    font-family: inherit;
}
.filter-chip.active {
    border-color: #1565C0;
    background: #E3F2FD;
    color: #1565C0;
}
.dolyo-card {
    padding: 14px;
    margin-bottom: 10px;
    cursor: pointer;
}
</style>
