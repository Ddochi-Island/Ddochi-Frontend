<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useApi, tokenStore } from '@/composables/useApi'
import { useAuthNav } from '@/composables/useAuthNav'

// [2026-05] 새로고침 시 세션 복원 — passkey 없이 /api/login 호출 불가하므로
// refreshToken 으로 /api/refresh 호출 (서버가 user 정보 + 회전된 토큰 반환).
// refreshToken 없거나 만료면 → 로그인 페이지.

const router = useRouter()
const auth = useAuthStore()
const { callApi } = useApi()
const { navigateAfterLogin } = useAuthNav()

const loadingText = ref('로그인 확인 중...')

function continueAfterRestore(sabun, r) {
    auth.setUser({ sabun, ...r })
    let initialTarget = null
    try { initialTarget = sessionStorage.getItem('ddochi_initial_target') } catch (_) {}
    if (initialTarget) {
        try { sessionStorage.removeItem('ddochi_initial_target') } catch (_) {}
        router.replace(initialTarget)
    } else {
        navigateAfterLogin()
    }
}

function bounceToLogin() {
    auth.logout()
    router.replace({ name: 'login' })
}

onMounted(() => {
    // Telegram WebApp: 현재 유저와 저장된 세션 유저가 다르면 로그인 화면으로.
    const tgUid = window.Telegram?.WebApp?.initDataUnsafe?.user?.id
    if (tgUid) {
        const storedTgUid = tokenStore.getTgUid()
        if (storedTgUid !== String(tgUid)) {
            bounceToLogin()
            return
        }
    }

    const refreshToken = tokenStore.getRefresh()
    const savedSabun = auth.getSavedSabun()
    if (!refreshToken || !savedSabun) {
        bounceToLogin()
        return
    }
    callApi('/api/refresh', { refreshToken }, (r) => {
        if (r && (r.ok || r.success) && (r.accessToken || r.user)) {
            const sabun = (r.user && r.user.sabun) || r.sabun || savedSabun
            continueAfterRestore(sabun, r)
        } else {
            bounceToLogin()
        }
    })
})
</script>

<template>
    <div class="screen">
        <div style="text-align:center;margin-top:50%;">
            <span style="font-size:50px;">🦔</span><br>
            <span>{{ loadingText }}</span>
        </div>
    </div>
</template>
