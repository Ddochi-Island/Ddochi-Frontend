import { ref } from 'vue'

const tg = window.Telegram?.WebApp
const isLocalhost = ref(
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.includes('testddochi')
)

// 브라우저 접근 허용 — 인증은 backend의 JWT 검증에 위임.
// Telegram WebApp 환경이 아니면 initDataUnsafe.user는 비어 있고,
// useTelegram 사용처(start_param, telegramId 자동 매핑 등)는 모두
// optional chaining으로 자연스럽게 무시된다.
if (tg) tg.expand()

export function useTelegram() {
    function getStartParam() {
        return tg?.initDataUnsafe?.start_param || null
    }

    function openLink(url) {
        if (tg?.platform === 'android' || tg?.platform === 'ios') {
            tg.openLink(url)
        } else {
            window.open(url, '_blank')
        }
    }

    // 미니앱 환경에서 로그인 직후 자동 호출.
    // initData를 백엔드에 전송 → HMAC 검증 후 USERS.TELEGRAM_ID 저장.
    // callApiPromise(url, body) — useApi() 에서 꺼낸 함수를 주입받음.
    async function linkTelegramAccount(callApiPromise) {
        if (!tg?.initData) return null
        try {
            return await callApiPromise('/api/telegram/link-me', { initData: tg.initData }) || null
        } catch (_) {
            return null
        }
    }

    return { tg, isLocalhost, getStartParam, openLink, linkTelegramAccount }
}
