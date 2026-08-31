<script setup>
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useApi } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'
import { useAuthNav } from '@/composables/useAuthNav'

// 사번 + 패스키 단일 인증. backend (/api/login) 가 USERS 테이블 조회 + 패스키
// 검증 후 JWT 발급. 옛 admin backdoor (`12144000-N`) 은 폐기됨 — 모든 로그인이
// USERS row 가 있어야 통과.

const auth = useAuthStore()
const { callApi } = useApi()
const { showAppAlert } = usePopup()
const { navigateAfterLogin } = useAuthNav()

const sabunInput = ref('')
const passkeyInput = ref('')
const submitting = ref(false)

function tryLogin() {
    const sabun = sabunInput.value.trim()
    const passkey = passkeyInput.value.trim()
    if (!sabun) return showAppAlert('사번을 입력해줘!')
    if (!passkey) return showAppAlert('패스키를 입력해줘!')
    if (submitting.value) return
    submitting.value = true

    callApi('/api/login', { sabun, passkey }, (r) => {
        submitting.value = false
        if (r && r.success) {
            auth.setUser({ sabun, ...r })
            navigateAfterLogin()
        } else {
            showAppAlert((r && r.message) || '로그인에 실패했어 🥺')
        }
    })
}
</script>

<template>
    <div class="screen">
        <div class="header">
            <span class="header-emoji">👋</span>
            <h3>또치섬에 온걸 환영해!</h3>
            <p>사번과 패스키를 입력해줘!</p>
        </div>

        <label>🔑 사원 번호</label>
        <div class="input-card">
            <input
                type="text"
                v-model="sabunInput"
                placeholder="예 : 00000000-00000"
                autocomplete="off"
                @keyup.enter="tryLogin"
            >
        </div>

        <label>🗝️ 패스키</label>
        <div class="input-card">
            <input
                type="password"
                v-model="passkeyInput"
                placeholder="패스키"
                autocomplete="current-password"
                @keyup.enter="tryLogin"
            >
        </div>

        <button class="btn" :disabled="submitting" @click="tryLogin">
            {{ submitting ? '확인 중...' : '입국하기 🦔' }}
        </button>
    </div>
</template>
