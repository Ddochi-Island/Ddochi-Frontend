<script setup>
import { inject } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()
const openSidebar = inject('openSidebar')

function handleSmartBack() {
    if (window.history.length > 1) {
        router.back()
    } else {
        router.push({ name: 'home' })
    }
}

function goHome() {
    router.push({ name: 'home' })
}
</script>

<template>
    <div class="top-nav">
        <div class="nav-info">{{ auth.currentUserTeam || '' }}_{{ auth.currentUserArea || '' }}_{{ auth.currentUserName || '' }}</div>
        <div class="nav-actions">
            <button class="nav-btn" @click="handleSmartBack">뒤로</button>
            <button class="nav-btn" @click="goHome">홈</button>
            <button class="nav-btn nav-btn-menu" style="font-size:16px; padding: 2px 8px; font-weight:bold;" @click="openSidebar">⚙️</button>
        </div>
    </div>
</template>
