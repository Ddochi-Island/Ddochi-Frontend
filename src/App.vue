<script setup>
import { computed, ref, provide, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import TopNav from '@/components/layout/TopNav.vue'
import Sidebar from '@/components/layout/Sidebar.vue'
import AppModal from '@/components/common/AppModal.vue'
import AppToast from '@/components/common/AppToast.vue'
import SyncLoadingOverlay from '@/components/layout/SyncLoadingOverlay.vue'
import ImageViewer from '@/components/common/ImageViewer.vue'
import { useDaumPostcode } from '@/composables/useDaumPostcode'
import { useAuthStore } from '@/stores/auth'
import { useTelegram } from '@/composables/useTelegram'
import { useApi } from '@/composables/useApi'

const route = useRoute()
const auth = useAuthStore()
const { closeDaumPostcode } = useDaumPostcode()
const { tg, linkTelegramAccount } = useTelegram()
const { callApiPromise } = useApi()

// 미니앱 startapp 파라미터 → 로그인 후 해당 페이지 자동 이동.
// 기존 ddochi_initial_target 패턴을 그대로 활용.
const START_PARAM_MAP = {
    'matching': '/matching',
    'sunhan-yanghagi': '/sunhan-yanghagi',
    'quality-find': '/quality-find',
    'daily-report': '/daily-report',
    'center': '/center',
}
const _startParam = tg?.initDataUnsafe?.start_param
if (_startParam && START_PARAM_MAP[_startParam]) {
    try { sessionStorage.setItem('ddochi_initial_target', START_PARAM_MAP[_startParam]) } catch (_) {}
}
const sidebarRef = ref(null)
const debugMode = ref(localStorage.getItem('ddochi_debug') === 'true')

provide('debugMode', debugMode)

const isFullScreen = computed(() => route.meta?.fullScreen === true)
const showNav = computed(() => {
    return route.name && route.name !== 'loading' && route.name !== 'login'
})

function openSidebar() {
    sidebarRef.value?.open()
}

provide('openSidebar', openSidebar)

// 미니앱 환경에서 로그인 완료 시 텔레그램 ID 자동 연동.
// watch로 isLoggedIn 변화를 감지 — 새로고침 복원 / 로그인 양쪽 모두 처리.
watch(() => auth.isLoggedIn, (loggedIn) => {
    if (loggedIn) linkTelegramAccount(callApiPromise)
}, { immediate: true })
</script>

<template>
    <div id="daumLayer"
        style="display:none;position:fixed;overflow:hidden;z-index:2000;-webkit-overflow-scrolling:touch;background:white;border:1px solid #5D4037;box-shadow:0 4px 15px rgba(0,0,0,0.3);border-radius:10px;">
        <div style="cursor:pointer;position:absolute;right:0px;top:0px;z-index:1;background:#5D4037;color:white;padding:5px 10px;font-weight:bold;border-bottom-left-radius:10px;font-size:13px;"
            @click="closeDaumPostcode">✕ 닫기</div>
    </div>

    <div v-if="debugMode" style="position:fixed;bottom:0;left:0;right:0;background:rgba(0,0,0,0.85);color:#0f0;font-size:11px;padding:4px 8px;z-index:9999;font-family:monospace;">
        route:{{ route.name }} | nav:{{ showNav }} | loggedIn:{{ auth.isLoggedIn }} | user:{{ auth.currentUserName || '-' }} | team:{{ auth.currentUserTeam || '-' }} | sabun:{{ auth.currentSabun || '-' }}
    </div>

    <TopNav v-if="showNav" />

    <div :class="isFullScreen ? '' : 'container'">
        <router-view v-slot="{ Component }">
            <transition name="fade" mode="out-in">
                <component :is="Component" :key="route.path" />
            </transition>
        </router-view>
    </div>

    <Sidebar ref="sidebarRef" />

    <Teleport to="body">
        <AppModal />
        <AppToast />
        <SyncLoadingOverlay />
        <ImageViewer />
    </Teleport>
</template>

<style>
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s, transform 0.3s;
}
.fade-enter-from {
    opacity: 0;
    transform: translateY(10px);
}
.fade-leave-to {
    opacity: 0;
}
</style>
