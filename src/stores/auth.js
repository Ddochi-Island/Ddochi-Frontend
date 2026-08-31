import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { tokenStore, persistStore } from '@/composables/useApi'

const SABUN_KEY = 'ddochi_sabun'

// [2026-05 redesign2] JWT 재도입.
// - 로그인 응답이 { accessToken, refreshToken, user, ... } 또는 레거시
//   { success, name, team, area, role, ... } 어느 쪽이든 setUser 가 흡수.
// - useApi 가 토큰을 localStorage 에 저장하므로 store 는 사용자 메타만 관리.
// - logout 시 사용자 메타 + 토큰 둘 다 클리어.

export const useAuthStore = defineStore('auth', () => {
    const currentSabun = ref(null)
    const currentUserName = ref(null)
    const currentUserTeam = ref(null)
    const currentUserArea = ref(null)
    const currentUserRole = ref(null)
    const validNames = ref([])

    const isLoggedIn = computed(() => !!currentSabun.value && !!currentUserName.value)
    // admin 판정 — USERS.POSITION 기반. 옛 sabun-prefix backdoor (12144000-N) 폐기됨.
    const isAdmin = computed(() =>
        currentUserRole.value === '관리자' || currentUserRole.value === '임원'
    )

    function setUser(data) {
        // 신규 main 은 user 를 sub-object 로 내려준다 ({user: {sabun, name, team, position}}).
        // 레거시 main 은 top-level 로 내려준다 ({sabun, name, team, area, role}).
        const u = (data && data.user) || data || {}
        currentSabun.value = u.sabun ?? data?.sabun ?? null
        currentUserName.value = u.name ?? data?.name ?? null
        currentUserTeam.value = u.team ?? data?.team ?? null
        currentUserArea.value = u.area ?? data?.area ?? null
        // 신규 main 은 'position' 으로 내려옴 — role 로 폴백 매핑.
        currentUserRole.value = u.position ?? u.role ?? data?.role ?? ''
        validNames.value = (data && data.validNames) || []
        if (currentSabun.value) persistStore.set(SABUN_KEY, currentSabun.value)
    }

    function logout() {
        currentSabun.value = null
        currentUserName.value = null
        currentUserTeam.value = null
        currentUserArea.value = null
        currentUserRole.value = null
        validNames.value = []
        persistStore.remove(SABUN_KEY)
        localStorage.removeItem('ddochi_token')   // 레거시 키 제거
        tokenStore.clearTokens()                   // accessToken / refreshToken 제거
    }

    function getSavedSabun() {
        return persistStore.get(SABUN_KEY)
    }

    return {
        currentSabun,
        currentUserName,
        currentUserTeam,
        currentUserArea,
        currentUserRole,
        validNames,
        isLoggedIn,
        isAdmin,
        setUser,
        logout,
        getSavedSabun
    }
})
