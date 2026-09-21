import { createRouter, createWebHashHistory, START_LOCATION } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
    { path: '/', name: 'loading', component: () => import('@/components/screens/LoadingScreen.vue') },
    { path: '/login', name: 'login', component: () => import('@/components/screens/LoginScreen.vue') },
    // [2026-04-22] AccessKey 라우트 비활성화 (JWT 재도입 시 복구). 파일은 보존.
    { path: '/home', name: 'home', component: () => import('@/components/screens/HomeScreen.vue'), meta: { requiresAuth: true } },
    { path: '/matching', name: 'matching', component: () => import('@/components/screens/MatchingScreen.vue'), meta: { requiresAuth: true } },
    { path: '/matching-history', name: 'matchingHistory', component: () => import('@/components/screens/MatchingHistoryScreen.vue'), meta: { requiresAuth: true } },
    { path: '/habjaeyang', name: 'habjaeyang', component: () => import('@/components/screens/HabjaeyangScreen.vue'), meta: { requiresAuth: true } },
    { path: '/short-card', name: 'shortCard', component: () => import('@/components/screens/ShortCardScreen.vue'), meta: { requiresAuth: true } },
    { path: '/short-cards', name: 'shortCardList', component: () => import('@/components/screens/ShortCardListScreen.vue'), meta: { requiresAuth: true, fullScreen: true } },
    { path: '/farmer-journal', name: 'farmerJournal', component: () => import('@/components/screens/FarmerJournalScreen.vue'), meta: { requiresAuth: true } },
    { path: '/center', name: 'center', component: () => import('@/components/screens/CenterScreen.vue'), meta: { requiresAuth: true } },
    { path: '/dolyo', name: 'dolyo', component: () => import('@/components/screens/DolyoScreen.vue'), meta: { requiresAuth: true } },
    { path: '/admin', name: 'admin', component: () => import('@/components/screens/AdminScreen.vue'), meta: { requiresAuth: true } },
    { path: '/weekly-record', name: 'weeklyRecord', component: () => import('@/components/screens/WeeklyRecordScreen.vue'), meta: { requiresAuth: true } },
    { path: '/daily-report', name: 'dailyReport', component: () => import('@/components/screens/DailyReportScreen.vue'), meta: { requiresAuth: true } },
    { path: '/area-score', name: 'areaScore', component: () => import('@/components/screens/AreaScoreScreen.vue'), meta: { requiresAuth: true } },
    { path: '/area-score/requests', name: 'areaScoreRequests', component: () => import('@/components/screens/AreaScoreRequestScreen.vue'), meta: { requiresAuth: true } },
    { path: '/prayer', name: 'prayer', component: () => import('@/components/screens/PrayerScreen.vue'), meta: { requiresAuth: true } },
    { path: '/statistics', name: 'statistics', component: () => import('@/components/screens/StatisticsScreen.vue'), meta: { requiresAuth: true } },
    { path: '/report', name: 'report', component: () => import('@/components/screens/ReportScreen.vue'), meta: { requiresAuth: true } },
    { path: '/board', name: 'boardMain', component: () => import('@/components/screens/BoardMainScreen.vue'), meta: { requiresAuth: true } },
    { path: '/board/write', name: 'postWrite', component: () => import('@/components/screens/PostWriteScreen.vue'), meta: { requiresAuth: true } },
    { path: '/board/post/:id', name: 'postDetail', component: () => import('@/components/screens/PostDetailScreen.vue'), meta: { requiresAuth: true } },
    { path: '/personal-stats', name: 'personalStats', component: () => import('@/components/screens/PersonalStatsScreen.vue'), meta: { requiresAuth: true } },
    { path: '/tm-sheet', name: 'tmSheet', component: () => import('@/components/screens/SheetViewScreen.vue'), meta: { requiresAuth: true, fullScreen: true } },
    { path: '/online-intake', name: 'onlineIntake', component: () => import('@/components/screens/OnlineIntakeScreen.vue'), meta: { requiresAuth: true, fullScreen: true } },
    { path: '/sunhan-yanghagi', name: 'sunhanYanghagi', component: () => import('@/components/screens/SunhanYanghagiScreen.vue'), meta: { requiresAuth: true, fullScreen: true } },
    { path: '/quality-find', name: 'qualityFind', component: () => import('@/components/screens/SunhanYanghagiScreen.vue'), meta: { requiresAuth: true, fullScreen: true } },
    { path: '/feedback', name: 'feedback', component: () => import('@/components/screens/FeedbackScreen.vue'), meta: { requiresAuth: true } },
    { path: '/weekly-score', name: 'weeklyScore', component: () => import('@/components/screens/WeeklyScoreScreen.vue'), meta: { requiresAuth: true } },
    { path: '/leaderboard', name: 'leaderboard', component: () => import('@/components/screens/LeaderboardScreen.vue'), meta: { requiresAuth: true } },
    { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
    history: createWebHashHistory(),
    routes,
})

router.beforeEach((to, from, next) => {
    const authStore = useAuthStore()

    // [2026-04-22] 새로고침 시 #/home 등 인증 라우트로 바로 진입하면
    //   LoadingScreen 이 마운트될 기회가 없어 자동 로그인이 실행되지 않음.
    //   초기 네비게이션 + 저장된 사번이 있으면 loading 으로 우회시키고
    //   원래 목적지를 sessionStorage 에 저장 → LoadingScreen 이 복귀.
    if (from === START_LOCATION && !authStore.isLoggedIn) {
        const savedSabun = authStore.getSavedSabun()
        if (savedSabun && to.name !== 'loading' && to.name !== 'login') {
            try { sessionStorage.setItem('ddochi_initial_target', to.fullPath) } catch (_) {}
            return next({ name: 'loading' })
        }
    }

    if (to.meta.disabled) {
        return next({ name: 'home' })
    }
    if (to.meta.requiresAuth && !authStore.isLoggedIn) {
        try { sessionStorage.setItem('ddochi_initial_target', to.fullPath) } catch (_) {}
        next({ name: 'login' })
    } else if (to.name === 'login' && authStore.isLoggedIn) {
        next({ name: 'home' })
    } else {
        next()
    }
})

export default router
