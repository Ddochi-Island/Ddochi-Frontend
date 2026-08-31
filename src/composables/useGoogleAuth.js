const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

export function useGoogleAuth() {
    function startGoogleLogin() {
        // 개발: Vite(5173) → 프록시 → Express(8082), 프로덕션: 같은 origin
        // redirect_uri는 항상 Express 서버 기준으로 설정
        const isDevProxy = window.location.port === '5173'
        const backendOrigin = isDevProxy
            ? 'http://localhost:8082'
            : window.location.origin

        const redirectUri = backendOrigin + '/api/auth/google/callback'
        const frontendOrigin = window.location.origin // 콜백 후 돌아올 주소

        const state = JSON.stringify({ frontendOrigin })

        const params = new URLSearchParams({
            client_id: GOOGLE_CLIENT_ID,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: 'openid email profile',
            state,
            prompt: 'select_account'
        })

        window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
    }

    return {
        GOOGLE_CLIENT_ID,
        startGoogleLogin
    }
}
