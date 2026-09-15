import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

// Backend services/main/src/auth/roles.js 의 미러.
// 두 곳에서 substring match 로 권한 판정.
const REGION_ROLES = ['전도교관', '수지역장', '지역총무', '지역서기', '지역전도서기']
const TEAM_ROLES = ['지역장', '전도팀장', '팀서기', '팀전도서기']

function _hasRegion(position) {
    if (!position) return false
    return REGION_ROLES.some(r => position.includes(r))
}
function _hasTeam(position) {
    if (!position) return false
    return TEAM_ROLES.some(r => position.includes(r))
}

/**
 * 권한 헬퍼.
 *   isAdmin       — POSITION='관리자'/'수지역장' 또는 ADMIN_SABUNS allow-list (auth store)
 *   hasRegionRole — 지역 직책 (전도교관/수지역장/총무/서기/전도서기)
 *   hasTeamRole   — 팀 직책 (지역장/전도팀장/팀서기/팀전도서기) — 지역권한 자동 포함
 *   canManageSheets — admin 또는 팀권한 또는 지역권한 — 시트 동기화 에러 배너 노출 대상
 */
export function useRoles() {
    const auth = useAuthStore()

    const hasRegionRole = computed(() => _hasRegion(auth.currentUserRole))
    // 지역권한자는 팀권한도 자동 포함 (legacy hasTeamRole 동작 미러).
    const hasTeamRole = computed(() => hasRegionRole.value || _hasTeam(auth.currentUserRole))
    const canManageSheets = computed(() => auth.isAdmin || hasTeamRole.value)

    return { hasRegionRole, hasTeamRole, canManageSheets }
}
