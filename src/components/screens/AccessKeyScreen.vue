<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useApi } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'

const router = useRouter()
const auth = useAuthStore()
const { callApi } = useApi()
const { showAppAlert } = usePopup()

const keyInput = ref('')
const isLoading = ref(false)

function submitKey() {
    const key = keyInput.value.trim()
    if (!key) return showAppAlert('액세스 키를 입력해줘!')

    isLoading.value = true
    callApi('/api/auth/verify-access-key', {
        inputKey: key,
        sabun: auth.currentSabun
    }, (r) => {
        isLoading.value = false
        if (r.success) {
            auth.setAccessKeyVerified(true)
            showAppAlert('인증 완료! 환영합니다!', () => {
                router.replace({ name: 'home' })
            })
        } else {
            showAppAlert(r.message || '키가 일치하지 않아요!')
        }
    })
}

function doLogout() {
    auth.logout()
    router.replace({ name: 'login' })
}
</script>

<template>
    <div class="screen">
        <div class="header">
            <span class="header-emoji">🔐</span>
            <h3>액세스 인증</h3>
            <p>서비스 이용을 위해 액세스 키를 입력해줘!</p>
        </div>

        <div class="key-info-card">
            <div class="key-user">{{ auth.currentUserName }}님, 안녕하세요!</div>
            <div class="key-desc">관리자에게 전달받은 액세스 키를 입력하면<br>서비스를 이용할 수 있어요.</div>
        </div>

        <label>🔑 액세스 키</label>
        <div class="input-card">
            <input
                type="text"
                v-model="keyInput"
                placeholder="액세스 키를 입력해줘"
                @keyup.enter="submitKey"
                autocomplete="off"
            >
        </div>

        <button class="btn" @click="submitKey" :disabled="isLoading">
            {{ isLoading ? '확인 중...' : '인증하기 🦔' }}
        </button>

        <button class="btn btn-logout" @click="doLogout">
            다른 계정으로 로그인
        </button>
    </div>
</template>

<style scoped>
.key-info-card {
    background: white;
    border-radius: 12px;
    padding: 18px;
    box-shadow: var(--shadow);
    text-align: center;
    margin-bottom: 10px;
}

.key-user {
    font-size: 16px;
    font-weight: bold;
    color: #5D4037;
    margin-bottom: 8px;
}

.key-desc {
    font-size: 13px;
    color: #888;
    line-height: 1.6;
}

.btn-logout {
    background: #EFEBE9;
    color: #795548;
    box-shadow: 0 2px 0 #D7CCC8;
    font-size: 14px;
    margin-top: 12px;
}
</style>
