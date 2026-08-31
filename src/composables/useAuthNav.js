import { useRouter } from 'vue-router'
import { useTelegram } from './useTelegram'
import { useUiStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { useApi, tokenStore } from './useApi'

const START_PARAM_ROUTES = {
    matching: { name: 'matching' },
    prayer: { name: 'prayer' },
    dailyReport: { name: 'dailyReport' },
}

export function useAuthNav() {
    const router = useRouter()
    const { getStartParam } = useTelegram()
    const ui = useUiStore()
    const auth = useAuthStore()
    const { callApi } = useApi()

    function navigateAfterLogin() {
        ui.initApprovalDate()

        // 텔레그램 ID 자동 매핑 (스텔스)
        const tg = window.Telegram?.WebApp
        if (tg?.initDataUnsafe?.user?.id) {
            tokenStore.setTgUid(tg.initDataUnsafe.user.id)
            callApi('/api/link-telegram-user', {
                sabun: auth.currentSabun,
                telegramId: tg.initDataUnsafe.user.id
            }, () => {})
        }

        // [2026-04-22] AccessKey 게이트 일시 비활성화 (JWT 재도입 시 복구)
        const startParam = getStartParam()
        if (!startParam) {
            let savedTarget = null
            try { savedTarget = sessionStorage.getItem('ddochi_initial_target') } catch (_) {}
            if (savedTarget) {
                try { sessionStorage.removeItem('ddochi_initial_target') } catch (_) {}
                return router.replace(savedTarget)
            }
            return router.replace({ name: 'home' })
        }

        // editPlan 딥링크: 텔레그램 마이크로 팝업
        if (startParam.startsWith('editPlan_')) {
            const docId = startParam.replace('editPlan_', '')
            return router.replace({ name: 'home', query: { editPlan: docId } })
        }

        if (startParam.startsWith('post_')) {
            return router.replace({ name: 'postDetail', params: { id: startParam.replace('post_', '') } })
        }
        const route = START_PARAM_ROUTES[startParam]
        router.replace(route || { name: 'home' })
    }

    return { navigateAfterLogin }
}
