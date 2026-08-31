<script setup>
import { ref, computed, onMounted } from 'vue'
import { useApi } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'

const emit = defineEmits(['close'])
const { callApi } = useApi()
const { showAppAlert, showAppConfirm, showToast } = usePopup()

// ── 데이터 ──────────────────────────────────────────────────
const list = ref([])
const teams = ref([])
const areas = ref([])
const roles = ref([])
const loading = ref(true)
const errorMsg = ref('')

// ── 뷰 전환 ─────────────────────────────────────────────────
const view = ref('list') // 'list' | 'form'
const editingSabun = ref(null) // null = 추가 모드
const newSabun = ref('') // 추가 모드 전용 사번 입력

// ── 폼 ──────────────────────────────────────────────────────
const form = ref(emptyForm())
function emptyForm() {
    return { name: '', teamId: '', areaId: '', status: 'active', gmail: '', telegramId: '', roleIds: [] }
}

// ── 탭 / 검색 ───────────────────────────────────────────────
const search = ref('')
const selectedTeamId = ref('')

const teamTabs = computed(() => {
    const seen = new Set()
    const tabs = []
    for (const u of list.value) {
        if (u.team_id && !seen.has(u.team_id)) {
            seen.add(u.team_id)
            tabs.push({ team_id: u.team_id, team_name: u.team_name || u.team_id })
        }
    }
    return tabs.sort((a, b) => a.team_name.localeCompare(b.team_name, 'ko'))
})

const filteredList = computed(() => {
    let result = list.value
    if (selectedTeamId.value) result = result.filter(u => u.team_id === selectedTeamId.value)
    const q = search.value.trim().toLowerCase()
    if (q) result = result.filter(u =>
        u.name?.toLowerCase().includes(q) ||
        u.sabun?.toLowerCase().includes(q)
    )
    return [...result].sort((a, b) => {
        const teamCmp = (a.team_name || '').localeCompare(b.team_name || '', 'ko')
        if (teamCmp !== 0) return teamCmp
        const areaCmp = (a.area_name || '').localeCompare(b.area_name || '', 'ko')
        if (areaCmp !== 0) return areaCmp
        // 같은 구역 내에서: 구역장/부구역장 우선, 나머지는 posOrder 순
        const areaRank = (u) => {
            const names = u.positions ? u.positions.split(',').map(n => n.trim()) : []
            if (names.includes('구역장')) return 0
            if (names.includes('부구역장')) return 1
            return 2
        }
        const rCmp = areaRank(a) - areaRank(b)
        if (rCmp !== 0) return rCmp
        return minPosOrder(a) - minPosOrder(b)
    })
})


// filteredList 를 구역별 카드로 그룹핑
const groupedList = computed(() => {
    const groups = []
    const map = new Map()
    for (const u of filteredList.value) {
        const key = (u.team_id || '') + '__' + (u.area_id || u.area_name || '')
        if (!map.has(key)) {
            const g = { key, team_name: u.team_name, area_name: u.area_name, users: [] }
            map.set(key, g)
            groups.push(g)
        }
        map.get(key).users.push(u)
    }
    return groups
})

const GLOBAL_STAFF_ROLES = new Set(['임원', '지역장', '지역총무'])
const TEAM_STAFF_ROLES = new Set(['팀장', '팀서기', '팀전도서기'])

// 여러 직책 중 가장 높은 순위
function minPosOrder(u) {
    const names = u.positions ? u.positions.split(',') : []
    if (!names.length) return 99
    return Math.min(...names.map(n => posOrder(n.trim())))
}

const globalStaff = computed(() => {
    if (selectedTeamId.value) return []
    const entries = []
    for (const u of list.value) {
        const names = u.positions ? u.positions.split(',').map(n => n.trim()) : []
        for (const name of names) {
            if (GLOBAL_STAFF_ROLES.has(name)) entries.push({ user: u, role: name })
        }
    }
    return entries.sort((a, b) => posOrder(a.role) - posOrder(b.role))
})

const teamStaff = computed(() => {
    if (!selectedTeamId.value) return []
    // 팀 스태프 직책을 가진 사용자 (중복 제거, 직책별 정렬)
    const entries = []
    for (const u of list.value) {
        if (u.team_id !== selectedTeamId.value) continue
        const names = u.positions ? u.positions.split(',') : []
        for (const name of names) {
            if (TEAM_STAFF_ROLES.has(name.trim())) {
                entries.push({ user: u, role: name.trim() })
            }
        }
    }
    return entries.sort((a, b) => posOrder(a.role) - posOrder(b.role))
})

// 팀이 바뀌면 구역 초기화
const filteredAreas = computed(() => areas.value.filter(a => a.team_id === form.value.teamId))

// ── 로드 ────────────────────────────────────────────────────
function load() {
    loading.value = true
    errorMsg.value = ''
    callApi('/api/admin/users/list', {}, (r) => {
        loading.value = false
        if (!r?.success) { errorMsg.value = r?.message || '목록을 불러오지 못했어'; return }
        list.value = r.list || []
    })
}

function loadMeta(cb) {
    callApi('/api/admin/users/meta', {}, (r) => {
        if (!r?.success) { showAppAlert('메타 로드 실패: ' + (r?.message || '')); return }
        teams.value = r.teams || []
        areas.value = r.areas || []
        roles.value = (r.roles || []).sort((a, b) => posOrder(a.name) - posOrder(b.name))
        cb?.()
    })
}

// ── 폼 열기 ──────────────────────────────────────────────────
function openAdd() {
    editingSabun.value = null
    newSabun.value = ''
    form.value = emptyForm()
    if (!teams.value.length) {
        loadMeta(() => { view.value = 'form' })
    } else {
        view.value = 'form'
    }
}

function openEdit(u) {
    editingSabun.value = u.sabun
    form.value = {
        name: u.name,
        teamId: u.team_id,
        areaId: u.area_id,
        status: u.status,
        gmail: u.gmail || '',
        telegramId: u.telegram_id || '',
        roleIds: u.role_ids ? u.role_ids.split(',') : [],
    }
    if (!teams.value.length) {
        loadMeta(() => { view.value = 'form' })
    } else {
        view.value = 'form'
    }
}

function cancelForm() {
    view.value = 'list'
    load()
}

// 팀 변경 시 구역 초기화
function onTeamChange() {
    form.value.areaId = ''
}

// ── 저장 ────────────────────────────────────────────────────
function save() {
    const isEdit = !!editingSabun.value
    const action = isEdit ? 'update' : 'create'
    const payload = isEdit
        ? { ...form.value, targetSabun: editingSabun.value }
        : { ...form.value, newSabun: newSabun.value }
    callApi(`/api/admin/users/${action}`, payload, (r) => {
        if (!r?.success) {
            showAppAlert('⛔ ' + (r?.message || '저장 실패'))
            load()
            return
        }
        showToast(r.message || '✅ 저장됨')
        view.value = 'list'
        load()
    })
}

// ── 직책 정렬 / 레이블 ──────────────────────────────────────
const POSITION_ORDER = {
  '관리자': 0, '임원': 1,
  '지역장': 2, '지역총무': 3, '지역서기': 4, '지역전도서기': 5,
  '팀장': 6, '팀전도교관': 7, '팀서기': 8, '팀전도서기': 9,
  '구역장': 10, '부구역장': 11,
}
function posOrder(pos) { return POSITION_ORDER[pos] ?? 99 }
function posLabel(pos) { return pos || '회원' }
function positionsLabel(positions) {
    if (!positions) return '회원'
    return positions.split(',').map(p => p.trim()).filter(Boolean).join(' · ') || '회원'
}

// ── 직책 뱃지 색상 ───────────────────────────────────────────
const ROLE_COLORS = {
    '관리자': '#B71C1C', '임원': '#6A1B9A',
    '지역장': '#7B1FA2', '지역총무': '#7B1FA2', '지역서기': '#7B1FA2', '지역전도서기': '#7B1FA2',
    '팀장': '#1565C0', '팀전도교관': '#1565C0', '팀서기': '#1565C0', '팀전도서기': '#1565C0',
    '구역장': '#2E7D32', '부구역장': '#00695C',
}
function roleColor(name) { return ROLE_COLORS[name] || '#757575' }
function roleList(u) {
    if (!u.positions) return ['회원']
    const names = u.positions.split(',').map(n => n.trim()).filter(Boolean)
    return names.length ? names : ['회원']
}
function rowBgClass(u) {
    const names = u.positions ? u.positions.split(',').map(n => n.trim()) : []
    if (names.includes('팀장') || names.includes('팀전도교관')) return 'um-row-team'
    if (names.includes('구역장')) return 'um-row-leader'
    if (names.includes('부구역장')) return 'um-row-subleader'
    return ''
}
function isAreaLeader(u) {
    const names = u.positions ? u.positions.split(',').map(n => n.trim()) : []
    return names.includes('구역장') || names.includes('부구역장')
}

// ── 상태 레이블 ──────────────────────────────────────────────
const STATUS_LABEL = { active: '재직', inactive: '비활성', leave: '휴직' }
const STATUS_COLOR = { active: '#2E7D32', inactive: '#757575', leave: '#E65100' }

// ── 팀 스왑 ─────────────────────────────────────────────
const swapTeamId1 = ref('')
const swapTeamId2 = ref('')
const swapLoading = ref(false)

function openSwap() {
    swapTeamId1.value = ''
    swapTeamId2.value = ''
    if (!teams.value.length) {
        loadMeta(() => { view.value = 'swap' })
    } else {
        view.value = 'swap'
    }
}

function confirmSwap() {
    if (!swapTeamId1.value || !swapTeamId2.value) return showAppAlert('두 팀을 모두 선택해줘')
    if (swapTeamId1.value === swapTeamId2.value) return showAppAlert('서로 다른 팀을 선택해줘')
    const t1 = teams.value.find(t => t.team_id === swapTeamId1.value)
    const t2 = teams.value.find(t => t.team_id === swapTeamId2.value)
    showAppConfirm(
        `${t1?.display_name} ↔ ${t2?.display_name} 스왑할게.\n모든 과거 데이터도 함께 바뀌어. 계속할게?`,
        (ok) => {
            if (!ok) return
            swapLoading.value = true
            callApi('/api/admin/users/swap-teams', { teamId1: swapTeamId1.value, teamId2: swapTeamId2.value }, (r) => {
                swapLoading.value = false
                if (!r?.success) { showAppAlert('⛔ ' + (r?.message || '스왑 실패')); return }
                showToast(r.message || '✅ 스왑 완료')
                view.value = 'list'
                load()
            })
        }
    )
}

// ── 다중 선택 / 일괄 변경 ─────────────────────────────────
const selectMode = ref(false)
const selectedSabuns = ref(new Set())
const bulkPanel = ref(null) // null | 'team' | 'area' | 'roles'
const bulkTeamId = ref('')
const bulkAreaId = ref('')
const bulkRoleIds = ref([])

const bulkAreas = computed(() =>
    bulkTeamId.value ? areas.value.filter(a => a.team_id === bulkTeamId.value) : areas.value
)

function enterSelectMode() {
    if (!teams.value.length) loadMeta()
    selectMode.value = true
    selectedSabuns.value = new Set()
}
function exitSelectMode() {
    selectMode.value = false
    selectedSabuns.value = new Set()
    bulkPanel.value = null
}
function toggleSelect(sabun) {
    const s = new Set(selectedSabuns.value)
    s.has(sabun) ? s.delete(sabun) : s.add(sabun)
    selectedSabuns.value = s
}
function selectAll() {
    selectedSabuns.value = new Set(filteredList.value.map(u => u.sabun))
}
function openBulkPanel(type) {
    if (!selectedSabuns.value.size) return showAppAlert('먼저 대상을 선택해줘')
    bulkPanel.value = type
    bulkTeamId.value = ''
    bulkAreaId.value = ''
    bulkRoleIds.value = []
}
function confirmBulk() {
    const targetSabuns = [...selectedSabuns.value]
    const payload = { targetSabuns, type: bulkPanel.value }
    if (bulkPanel.value === 'team') {
        if (!bulkTeamId.value) return showAppAlert('팀을 선택해줘')
        payload.teamId = bulkTeamId.value
    } else if (bulkPanel.value === 'area') {
        if (!bulkAreaId.value) return showAppAlert('구역을 선택해줘')
        payload.areaId = bulkAreaId.value
    } else {
        payload.roleIds = bulkRoleIds.value
    }
    callApi('/api/admin/users/bulk-update', payload, (r) => {
        if (!r?.success) { showAppAlert('⛔ ' + (r?.message || '저장 실패')); return }
        showToast(r.message || '✅ 저장됨')
        exitSelectMode()
        load()
    })
}

onMounted(() => {
    load()
})
</script>

<template>
    <Teleport to="body">
        <div class="modal-overlay" @click.self="emit('close')">
            <div class="modal-card" style="height:auto; max-height:90vh; padding:0;">

                <div class="modal-header-sticky">
                    <div class="modal-title" style="margin:0;">👥 명단 관리</div>
                    <span class="modal-close-sticky" @click="emit('close')">×</span>
                </div>

                <div class="modal-content-scroll" style="padding:20px;">

                    <!-- ── 목록 뷰 ── -->
                    <template v-if="view === 'list'">
                        <!-- 팀 탭 -->
                        <div class="um-tabs">
                            <button
                                class="um-tab"
                                :class="{ active: selectedTeamId === '' }"
                                @click="selectedTeamId = ''"
                            >전체</button>
                            <button
                                v-for="t in teamTabs"
                                :key="t.team_id"
                                class="um-tab"
                                :class="{ active: selectedTeamId === t.team_id }"
                                @click="selectedTeamId = t.team_id"
                            >{{ t.team_name }}</button>
                        </div>

                        <div style="display:flex; gap:8px; margin-bottom:12px; align-items:center;">
                            <input
                                v-model="search"
                                type="text"
                                class="input-card"
                                placeholder="이름 / 사번 검색"
                                style="flex:1; margin:0;"
                            />
                            <button v-if="!selectMode" class="btn-pos" style="flex-shrink:0; padding:10px 16px;" @click="openAdd">+ 추가</button>
                            <button v-if="!selectMode" class="btn-swap" @click="openSwap">스왑</button>
                            <button v-if="!selectMode" class="btn-select" @click="enterSelectMode">선택</button>
                            <button v-else class="btn-neg" style="flex-shrink:0; padding:10px 14px;" @click="exitSelectMode">취소</button>
                        </div>

                        <!-- 선택 모드 바 -->
                        <div v-if="selectMode" class="um-select-bar">
                            <span class="um-select-count">{{ selectedSabuns.size }}명 선택됨</span>
                            <button class="um-select-all" @click="selectAll">전체</button>
                            <div class="um-bulk-actions">
                                <button @click="openBulkPanel('team')">팀 이동</button>
                                <button @click="openBulkPanel('area')">구역 이동</button>
                                <button @click="openBulkPanel('roles')">직책 변경</button>
                            </div>
                        </div>

                        <!-- 일괄 변경 패널 -->
                        <div v-if="bulkPanel" class="um-bulk-panel">
                            <template v-if="bulkPanel === 'team'">
                                <div class="um-bulk-panel-title">팀 이동 — {{ selectedSabuns.size }}명</div>
                                <select v-model="bulkTeamId" class="input-card" style="margin:0;">
                                    <option value="">팀 선택</option>
                                    <option v-for="t in teams" :key="t.team_id" :value="t.team_id">{{ t.display_name }}</option>
                                </select>
                            </template>
                            <template v-else-if="bulkPanel === 'area'">
                                <div class="um-bulk-panel-title">구역 이동 — {{ selectedSabuns.size }}명</div>
                                <select v-model="bulkTeamId" class="input-card" style="margin:0 0 8px;" @change="bulkAreaId = ''">
                                    <option value="">팀 먼저 선택 (선택 사항)</option>
                                    <option v-for="t in teams" :key="t.team_id" :value="t.team_id">{{ t.display_name }}</option>
                                </select>
                                <select v-model="bulkAreaId" class="input-card" style="margin:0;">
                                    <option value="">구역 선택</option>
                                    <option v-for="a in bulkAreas" :key="a.area_id" :value="a.area_id">{{ a.display_name }}</option>
                                </select>
                            </template>
                            <template v-else>
                                <div class="um-bulk-panel-title">직책 변경 — {{ selectedSabuns.size }}명</div>
                                <div class="um-role-checks">
                                    <label v-for="ro in roles" :key="ro.role_id" class="um-role-check">
                                        <input type="checkbox" :value="ro.role_id" v-model="bulkRoleIds" />
                                        {{ ro.name }}
                                    </label>
                                </div>
                            </template>
                            <div class="um-bulk-panel-btns">
                                <button class="btn-pos" style="flex:1;" @click="confirmBulk">적용</button>
                                <button class="btn-neg" style="flex:1;" @click="bulkPanel = null">닫기</button>
                            </div>
                        </div>

                        <div v-if="loading" style="text-align:center; padding:30px; color:#888;">불러오는 중... ⏳</div>
                        <div v-else-if="errorMsg" style="text-align:center; padding:20px; color:red;">{{ errorMsg }}</div>

                        <div v-else>
                            <!-- 전체 탭 상단 고정: 임원/지역장/지역총무 -->
                            <div v-if="globalStaff.length" class="um-team-staff">
                                <div
                                    v-for="entry in globalStaff"
                                    :key="entry.user.sabun + entry.role"
                                    class="um-staff-cell"
                                    @click="openEdit(entry.user)"
                                >
                                    <span class="um-staff-role">{{ entry.role }}</span>
                                    <span class="um-staff-name">{{ entry.user.name }}</span>
                                </div>
                            </div>

                            <!-- 팀 상단 고정: 팀장/팀서기/팀전도서기 -->
                            <div v-if="teamStaff.length" class="um-team-staff">
                                <div
                                    v-for="entry in teamStaff"
                                    :key="entry.user.sabun + entry.role"
                                    class="um-staff-cell"
                                    @click="openEdit(entry.user)"
                                >
                                    <span class="um-staff-role">{{ entry.role }}</span>
                                    <span class="um-staff-name">{{ entry.user.name }}</span>
                                </div>
                            </div>

                            <div v-if="groupedList.length === 0" style="text-align:center; color:#888; padding:20px;">
                                {{ search ? '검색 결과가 없어' : '등록된 사용자가 없어' }}
                            </div>
                            <div v-for="group in groupedList" :key="group.key" class="um-area-card">
                                <div class="um-area-card-header">
                                    {{ group.team_name }} · {{ group.area_name }}
                                    <span class="um-area-count">{{ group.users.length }}명</span>
                                </div>
                                <div
                                    v-for="u in group.users"
                                    :key="u.sabun"
                                    class="um-row"
                                    :class="[rowBgClass(u), { 'um-row-selected': selectedSabuns.has(u.sabun) }]"
                                    @click="selectMode ? toggleSelect(u.sabun) : openEdit(u)"
                                >
                                    <div v-if="selectMode" class="um-checkbox" :class="{ checked: selectedSabuns.has(u.sabun) }"></div>
                                    <div class="um-col-role">
                                        <span
                                            v-for="role in roleList(u)"
                                            :key="role"
                                            class="um-role-badge"
                                            :style="{ background: roleColor(role) }"
                                        >{{ role }}</span>
                                    </div>
                                    <span class="um-name">{{ u.name }}</span>
                                </div>
                            </div>
                        </div>

                        <div class="btn-group" style="margin-top:15px;">
                            <button class="btn-neg" @click="emit('close')">뒤로가기</button>
                        </div>
                    </template>

                    <!-- ── 팀 스왑 뷰 ── -->
                    <template v-else-if="view === 'swap'">
                        <div class="um-form-title">🔄 팀 스왑</div>
                        <div style="font-size:13px; color:#888; margin-bottom:20px; line-height:1.6;">
                            두 팀의 이름/코드를 교환해. 모든 과거 데이터도 자동으로 새 이름을 따라가.
                        </div>

                        <div class="um-field">
                            <label>팀 A</label>
                            <select v-model="swapTeamId1" class="input-card" style="margin:0;">
                                <option value="">팀 선택</option>
                                <option v-for="t in teams" :key="t.team_id" :value="t.team_id" :disabled="t.team_id === swapTeamId2">{{ t.display_name }}</option>
                            </select>
                        </div>

                        <div style="text-align:center; font-size:22px; color:#888; margin: 4px 0;">⇅</div>

                        <div class="um-field">
                            <label>팀 B</label>
                            <select v-model="swapTeamId2" class="input-card" style="margin:0;">
                                <option value="">팀 선택</option>
                                <option v-for="t in teams" :key="t.team_id" :value="t.team_id" :disabled="t.team_id === swapTeamId1">{{ t.display_name }}</option>
                            </select>
                        </div>

                        <div v-if="swapTeamId1 && swapTeamId2" style="background:#FFF3E0; border:1px solid #FFB74D; border-radius:8px; padding:12px; margin:16px 0; font-size:13px; color:#E65100;">
                            ⚠️ {{ teams.find(t=>t.team_id===swapTeamId1)?.display_name }} ↔ {{ teams.find(t=>t.team_id===swapTeamId2)?.display_name }} 이름이 교환돼. ADMIN_AUDIT_LOGS에 이벤트 기록이 남아.
                        </div>

                        <div class="btn-group" style="margin-top:20px;">
                            <button class="btn-pos" @click="confirmSwap" :disabled="swapLoading">
                                {{ swapLoading ? '처리 중...' : '스왑 실행' }}
                            </button>
                            <button class="btn-neg" @click="view = 'list'">취소</button>
                        </div>
                    </template>

                    <!-- ── 폼 뷰 ── -->
                    <template v-else-if="view === 'form'">
                        <div class="um-form-title">{{ editingSabun ? '✏️ 사용자 수정' : '➕ 사용자 추가' }}</div>

                        <div class="um-field">
                            <label>사번 *</label>
                            <input
                                v-if="editingSabun"
                                :value="editingSabun"
                                type="text"
                                class="input-card"
                                readonly
                                style="margin:0; background:#F5F5F5; color:#888;"
                            />
                            <input
                                v-else
                                v-model="newSabun"
                                type="text"
                                class="input-card"
                                autocomplete="off"
                                placeholder="사번"
                                maxlength="20"
                                style="margin:0;"
                            />
                        </div>

                        <div class="um-field">
                            <label>이름 *</label>
                            <input
                                v-model="form.name"
                                type="text"
                                class="input-card"
                                placeholder="이름"
                                maxlength="50"
                                style="margin:0;"
                            />
                        </div>

                        <div class="um-field">
                            <label>팀 *</label>
                            <select v-model="form.teamId" class="input-card" style="margin:0;" @change="onTeamChange">
                                <option value="">팀 선택</option>
                                <option v-for="t in teams" :key="t.team_id" :value="t.team_id">{{ t.display_name }}</option>
                            </select>
                        </div>

                        <div class="um-field">
                            <label>구역 *</label>
                            <select v-model="form.areaId" class="input-card" style="margin:0;" :disabled="!form.teamId">
                                <option value="">구역 선택</option>
                                <option v-for="a in filteredAreas" :key="a.area_id" :value="a.area_id">{{ a.display_name }}</option>
                            </select>
                        </div>

                        <div class="um-field">
                            <label>직책 (복수 선택 가능)</label>
                            <div class="um-role-checks">
                                <label
                                    v-for="ro in roles"
                                    :key="ro.role_id"
                                    class="um-role-check"
                                >
                                    <input
                                        type="checkbox"
                                        :value="ro.role_id"
                                        v-model="form.roleIds"
                                    />
                                    {{ ro.name }}
                                </label>
                            </div>
                        </div>

                        <div class="um-field">
                            <label>상태 *</label>
                            <select v-model="form.status" class="input-card" style="margin:0;">
                                <option value="active">재직</option>
                                <option value="inactive">비활성</option>
                                <option value="leave">휴직</option>
                            </select>
                        </div>

                        <div class="um-field">
                            <label>이메일</label>
                            <input
                                v-model="form.gmail"
                                type="email"
                                class="input-card"
                                placeholder="example@gmail.com"
                                maxlength="255"
                                style="margin:0;"
                            />
                        </div>

                        <div class="um-field">
                            <label>텔레그램 ID</label>
                            <input
                                v-model="form.telegramId"
                                type="text"
                                class="input-card"
                                placeholder="숫자 ID"
                                maxlength="20"
                                style="margin:0;"
                            />
                        </div>

                        <div class="btn-group" style="margin-top:20px;">
                            <button class="btn-pos" @click="save">저장</button>
                            <button class="btn-neg" @click="cancelForm">취소</button>
                        </div>
                    </template>

                </div>
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
.um-tabs {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    margin-bottom: 12px;
    padding-bottom: 2px;
    scrollbar-width: none;
}
.um-tabs::-webkit-scrollbar { display: none; }

.um-tab {
    flex-shrink: 0;
    padding: 6px 14px;
    border-radius: 20px;
    border: 1px solid #DDD;
    background: #F5F5F5;
    color: #555;
    font-size: 13px;
    font-family: inherit;
    cursor: pointer;
    transition: 0.15s;
}
.um-tab.active {
    background: #1565C0;
    color: #fff;
    border-color: #1565C0;
    font-weight: bold;
}

.um-area-card {
    background: #fff;
    border-radius: 10px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.08);
    margin-bottom: 12px;
    overflow: hidden;
}
.um-area-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: #F0F4FF;
    font-size: 12px;
    font-weight: bold;
    color: #1565C0;
    border-bottom: 1px solid #DDEAFF;
}
.um-area-count {
    font-size: 11px;
    color: #888;
    font-weight: normal;
}

.um-row {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    gap: 0;
    cursor: pointer;
    transition: background 0.1s;
    border-bottom: 1px solid #F5F5F5;
    min-height: 40px;
}
.um-row:last-child { border-bottom: none; }
.um-row:hover { background: #F9FAFF; }
.um-row-team { background: #EEF4FF; }
.um-row-team:hover { background: #DDEAFF; }
.um-row-leader { background: #C8EED4; }
.um-row-leader:hover { background: #B2E4BE; }
.um-row-subleader { background: #F1FBF4; }
.um-row-subleader:hover { background: #E6F7EB; }
.um-row-selected { outline: 2px solid #1565C0 !important; outline-offset: -2px; }

.btn-swap {
    flex-shrink: 0;
    padding: 10px 14px;
    border-radius: 8px;
    border: 1px solid #E65100;
    background: #fff;
    color: #E65100;
    font-size: 14px;
    font-family: inherit;
    cursor: pointer;
}

.btn-select {
    flex-shrink: 0;
    padding: 10px 14px;
    border-radius: 8px;
    border: 1px solid #1565C0;
    background: #fff;
    color: #1565C0;
    font-size: 14px;
    font-family: inherit;
    cursor: pointer;
}

.um-select-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: #EEF4FF;
    border-radius: 8px;
    margin-bottom: 10px;
    flex-wrap: wrap;
}
.um-select-count {
    font-size: 13px;
    font-weight: bold;
    color: #1565C0;
    flex: 1;
    min-width: 60px;
}
.um-select-all {
    padding: 4px 10px;
    border-radius: 6px;
    border: 1px solid #1565C0;
    background: #fff;
    color: #1565C0;
    font-size: 12px;
    font-family: inherit;
    cursor: pointer;
}
.um-bulk-actions {
    display: flex;
    gap: 6px;
}
.um-bulk-actions button {
    padding: 6px 10px;
    border-radius: 6px;
    border: none;
    background: #1565C0;
    color: #fff;
    font-size: 12px;
    font-family: inherit;
    cursor: pointer;
}

.um-bulk-panel {
    background: #F8FAFF;
    border: 1px solid #DDEAFF;
    border-radius: 10px;
    padding: 14px;
    margin-bottom: 12px;
}
.um-bulk-panel-title {
    font-size: 13px;
    font-weight: bold;
    color: #1565C0;
    margin-bottom: 10px;
}
.um-bulk-panel-btns {
    display: flex;
    gap: 8px;
    margin-top: 12px;
}

.um-checkbox {
    width: 18px;
    height: 18px;
    border-radius: 4px;
    border: 2px solid #BDBDBD;
    flex-shrink: 0;
    margin-right: 8px;
    transition: 0.1s;
}
.um-checkbox.checked {
    background: #1565C0;
    border-color: #1565C0;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 10'%3E%3Cpath d='M1 5l3 4L11 1' stroke='white' stroke-width='2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
    background-size: 70%;
    background-repeat: no-repeat;
    background-position: center;
}

.um-col-role {
    width: 90px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
}
.um-name {
    flex: 1;
    font-size: 14px;
    font-weight: bold;
    color: #222;
}
.um-role-badge {
    font-size: 10px;
    color: #fff;
    border-radius: 4px;
    padding: 2px 6px;
    white-space: nowrap;
    display: inline-block;
    width: fit-content;
}

.um-team-staff {
    display: flex;
    gap: 6px;
    margin-bottom: 10px;
    flex-wrap: wrap;
}
.um-staff-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: #E3F2FD;
    border: 1px solid #90CAF9;
    border-radius: 8px;
    padding: 6px 12px;
    cursor: pointer;
    min-width: 72px;
    transition: background 0.12s;
}
.um-staff-cell:hover { background: #BBDEFB; }
.um-staff-role {
    font-size: 10px;
    color: #1565C0;
    font-weight: bold;
}
.um-staff-name {
    font-size: 14px;
    font-weight: bold;
    color: #222;
}

.um-role-checks {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 12px;
    padding: 8px 0;
}
.um-role-check {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    color: #333;
    cursor: pointer;
    white-space: nowrap;
}
.um-role-check input[type="checkbox"] {
    width: 16px;
    height: 16px;
    cursor: pointer;
}

.um-form-title {
    font-size: 15px;
    font-weight: bold;
    color: #333;
    margin-bottom: 16px;
}
.um-field {
    margin-bottom: 12px;
}
.um-field label {
    display: block;
    font-size: 12px;
    color: #666;
    margin-bottom: 4px;
    font-weight: bold;
}
</style>
