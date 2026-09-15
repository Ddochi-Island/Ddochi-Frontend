// useDolyo — 인도권(dolyo) 화면 상태 + API 어댑터.
//
// 모듈 레벨 ref 로 상태를 공유 (legacy 의 모듈 전역 변수와 동일 역할).
// 한 번 진입한 후 다시 들어와도 검색/필터/스크롤 위치가 보존됨.
//
// 현재 read-only 단계:
//   - getList()        /api/get-dolyo-list (PROSPECTS WHERE SOURCE_TYPE='dolyo')
//   - 검색/필터/단계 계산 헬퍼
//
// 후속 commit 에서 추가될 액션:
//   - register / update            /api/register-dolyo, /api/update-dolyo
//   - addAction / deleteAction     /api/add-dolyo-action, /api/delete-dolyo-action
//   - delete (soft)                /api/delete-dolyo
//   - resetResult                  /api/reset-dolyo-result
//   - habjaeyang 통합 진입         openDolyoHabjaeyang(item)

import { ref, computed } from 'vue'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import { stageLabels, stageNameToIndex, FAITH_LABEL_MAP as faithLabels } from '@/constants'

// ── module-level reactive state ────────────────────────────────────────
const list = ref([])
const loading = ref(false)
const errorMsg = ref('')

// 조회 범위
const scope = ref('나만')              // '전체' | '지역' | '구역' | '나만'
const scopeTeam = ref('')
const scopeArea = ref('')

// 단계 / 상태 필터
const filterStage = ref('')             // '' | '씨앗' | '새싹' | '떡잎' | '열매'
const filterStatus = ref('')            // '' | '대기중' | '재가' | '반려' | '취소'

// 검색
const searchQuery = ref('')

// 필터 패널 펼침
const filterPanelOpen = ref(false)

// ── helpers ────────────────────────────────────────────────────────────
function getStage(item) {
    if (item.habjaeyang && item.habjaeyang.subName) return 3
    const fd = item.farmerDiary || {}
    if (fd.stage3 && Object.values(fd.stage3).some(v => v)) return 2
    if (fd.stage2 && Object.values(fd.stage2).some(v => v)) return 1
    return 0
}

// 권한별 사용 가능 scope. 사용자 role 에 따라 단계적 노출.
function getAvailableScopes(role, isAdmin) {
    if (isAdmin) return ['전체', '지역', '구역', '나만']
    const r = role || ''
    if (/전도교관|지구장|행정/.test(r)) return ['전체', '지역', '구역', '나만']
    if (/지역장|부지역장/.test(r)) return ['지역', '구역', '나만']
    if (/구역장|순장/.test(r)) return ['구역', '나만']
    return ['나만']
}

// ── derived ────────────────────────────────────────────────────────────
const filteredList = computed(() => {
    const sorted = [...list.value].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    )
    const isSearching = !!searchQuery.value

    let result = isSearching ? sorted : sorted.filter(i => !i.deleted)

    // 검색
    if (isSearching) {
        const q = searchQuery.value.toLowerCase()
        result = result.filter(item =>
            (item.name || '').toLowerCase().includes(q) ||
            (item.manager || '').toLowerCase().includes(q)
        )
    }

    // 단계 필터
    if (filterStage.value) {
        const stageIdx = stageNameToIndex[filterStage.value]
        result = result.filter(i => getStage(i) === stageIdx)
    }

    // 상태 필터
    if (filterStatus.value) {
        result = result.filter(i => {
            const a = i.approvalStatus || ''
            if (filterStatus.value === '대기중') {
                return !a || (a !== '재가' && a !== '반려' && a !== '취소')
            }
            return a === filterStatus.value
        })
    }

    return result
})

const stats = computed(() => {
    const active = list.value.filter(i => !i.deleted)
    const stageCounts = [0, 0, 0, 0]
    active.forEach(i => stageCounts[getStage(i)]++)
    const apprCount = active.filter(i => i.approvalStatus === '재가').length
    return {
        total: active.length,
        seed: stageCounts[0],
        sprout: stageCounts[1],
        leaf: stageCounts[2],
        fruit: stageCounts[3],
        approved: apprCount,
    }
})

// ── actions (read-only at this stage) ──────────────────────────────────
export function useDolyo() {
    const { callApiPromise } = useApi()
    const auth = useAuthStore()

    async function getList() {
        loading.value = true
        errorMsg.value = ''
        try {
            const r = await callApiPromise('/api/get-dolyo-list', {
                sabun: auth.currentSabun,
                scope: scope.value,
                targetTeam: scopeTeam.value,
                targetArea: scopeArea.value,
            })
            if (r && (r.success || r.ok)) {
                list.value = r.list || r.rows || []
            } else {
                errorMsg.value = r?.message || '목록을 불러오지 못했어'
                list.value = []
            }
        } catch (e) {
            errorMsg.value = e.message || '오류 발생'
            list.value = []
        } finally {
            loading.value = false
        }
    }

    function setScope(s) {
        scope.value = s
        if (s === '나만') { scopeTeam.value = ''; scopeArea.value = '' }
        if (s === '지역') { scopeArea.value = '' }
        getList()
    }
    function setScopeTeam(v) { scopeTeam.value = v; scopeArea.value = ''; getList() }
    function setScopeArea(v) { scopeArea.value = v; getList() }

    function setFilterStage(v) { filterStage.value = v }
    function setFilterStatus(v) { filterStatus.value = v }
    function clearSearch() { searchQuery.value = '' }
    function toggleFilterPanel() { filterPanelOpen.value = !filterPanelOpen.value }

    async function register(data) {
        const r = await callApiPromise('/api/register-dolyo', {
            sabun: auth.currentSabun,
            data,
        })
        if (r && (r.success || r.ok)) {
            // optimistic refresh
            await getList()
        }
        return r
    }

    async function update(docId, data) {
        const r = await callApiPromise('/api/update-dolyo', {
            sabun: auth.currentSabun,
            docId,
            data,
        })
        if (r && (r.success || r.ok)) {
            // local in-place merge — list refresh 도 같이 호출하지만 즉시 반영용
            const idx = list.value.findIndex(i => i.docId === docId)
            if (idx >= 0) list.value[idx] = { ...list.value[idx], ...data }
            await getList()
        }
        return r
    }

    function findItem(docId) {
        return list.value.find(i => i.docId === docId) || null
    }

    async function addAction(docId, date, content, logType) {
        const r = await callApiPromise('/api/add-dolyo-action', {
            sabun: auth.currentSabun,
            docId, date, content,
            ...(logType ? { logType } : {}),
        })
        if (r && (r.success || r.ok)) await getList()
        return r
    }

    async function deleteActionLog(docId, actionId) {
        const r = await callApiPromise('/api/delete-dolyo-action', {
            sabun: auth.currentSabun,
            docId, actionId,
        })
        if (r && (r.success || r.ok)) await getList()
        return r
    }

    async function softDelete(docId) {
        const r = await callApiPromise('/api/delete-dolyo', {
            sabun: auth.currentSabun,
            docId,
        })
        if (r && (r.success || r.ok)) await getList()
        return r
    }

    async function setMatchResult(docId, type, subReason) {
        const r = await callApiPromise('/api/dolyo-match-result', {
            sabun: auth.currentSabun,
            docId, type, subReason,
        })
        if (r && (r.success || r.ok)) await getList()
        return r
    }

    async function setApproval(docId, decision, reasonType, reason) {
        const r = await callApiPromise('/api/dolyo-approval', {
            sabun: auth.currentSabun,
            docId, decision,
            ...(reasonType ? { reasonType } : {}),
            ...(reason ? { reason } : {}),
        })
        if (r && (r.success || r.ok)) await getList()
        return r
    }

    async function submitHabjaeyang(docId, data) {
        const r = await callApiPromise('/api/submit-dolyo-habjaeyang', {
            sabun: auth.currentSabun,
            docId, data,
        })
        if (r && (r.success || r.ok)) await getList()
        return r
    }

    return {
        // state
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
        // derived
        filteredList,
        stats,
        // actions
        getList,
        register,
        update,
        findItem,
        addAction,
        deleteActionLog,
        softDelete,
        setMatchResult,
        setApproval,
        submitHabjaeyang,
        setScope,
        setScopeTeam,
        setScopeArea,
        setFilterStage,
        setFilterStatus,
        clearSearch,
        toggleFilterPanel,
        // helpers
        getStage,
        getAvailableScopes,
        stageLabels,
        faithLabels,
    }
}
