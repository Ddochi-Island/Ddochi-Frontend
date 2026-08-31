// API client — main service 와의 단일 fetch 어댑터.
//
// [2026-05 redesign2 update]
// - JWT 액세스 토큰을 Authorization: Bearer 헤더로 첨부
// - 401 응답 시 refreshToken 으로 한 번 갱신 시도 후 원본 요청 재시도
// - refresh 실패 시 logout + #/login?reason=token_expired 로 라우팅
// - 응답 shape 호환:
//   - 신규 main: { accessToken, refreshToken, user }
//   - 레거시 main: { success, name, team, area, role, ... }
//   둘 다 통과시켜 호출자가 입맛에 맞게 사용.

import { usePopup } from './usePopup'

const ACCESS_KEY = 'ddochi_access_token'
const REFRESH_KEY = 'ddochi_refresh_token'
const TG_UID_KEY = 'ddochi_tg_uid'

// 화이트리스트: 토큰 없이도 호출 허용. 401 떨어져도 refresh 시도 안 함.
const PUBLIC_PATHS = new Set(['/api/login', '/api/refresh', '/api/ping'])

let refreshInFlight = null

// ── 저장 매체 라우팅 ────────────────────────────────────────────────
// Telegram WebApp 환경 → localStorage (웹앱 컨테이너에서 쿠키 신뢰성 ↓)
// 일반 브라우저 → document.cookie (Path=/, SameSite=Lax, 30일)
//   브라우저에서 새로고침 시 localStorage 가 의도치 않게 비는 케이스 (사파리 ITP/
//   시크릿 등) 를 회피하기 위함. 두 매체를 동시에 읽어 마이그레이션 안전성 확보.
function isWebApp() {
    try { return !!(window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) }
    catch (_) { return false }
}

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30  // 30일 — refresh TTL 과 동일.
function readCookie(name) {
    const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
    return m ? decodeURIComponent(m[1]) : ''
}
function writeCookie(name, value) {
    if (value) {
        document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${COOKIE_MAX_AGE}; Path=/; SameSite=Lax`
    } else {
        document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`
    }
}

function readToken(key) {
    // 두 매체 모두 확인 — 환경 전환 시 (개발/배포) 마이그 안전.
    return localStorage.getItem(key) || readCookie(key) || ''
}
function writeToken(key, value) {
    if (isWebApp()) {
        if (value) localStorage.setItem(key, value); else localStorage.removeItem(key)
    } else {
        writeCookie(key, value)
    }
}
function clearToken(key) {
    localStorage.removeItem(key)
    writeCookie(key, '')
}

function getAccess() { return readToken(ACCESS_KEY) }
function getRefresh() { return readToken(REFRESH_KEY) }
function setTokens({ accessToken, refreshToken }) {
    if (accessToken) writeToken(ACCESS_KEY, accessToken)
    if (refreshToken) writeToken(REFRESH_KEY, refreshToken)
}
function clearTokens() {
    clearToken(ACCESS_KEY)
    clearToken(REFRESH_KEY)
    try { localStorage.removeItem(TG_UID_KEY) } catch (_) {}
}

function setTgUid(uid) {
    try { if (uid) localStorage.setItem(TG_UID_KEY, String(uid)); } catch (_) {}
}
function getTgUid() {
    try { return localStorage.getItem(TG_UID_KEY) || '' } catch (_) { return '' }
}

async function rawFetch(url, body, opts = {}) {
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) }
    const token = getAccess()
    if (token && !PUBLIC_PATHS.has(url)) {
        headers.Authorization = `Bearer ${token}`
    }
    return fetch(url, {
        method: opts.method || 'POST',
        headers,
        body: body == null ? undefined : JSON.stringify(body)
    })
}

async function tryRefresh() {
    if (refreshInFlight) return refreshInFlight
    const refreshToken = getRefresh()
    if (!refreshToken) return Promise.resolve(false)
    refreshInFlight = (async () => {
        try {
            const res = await rawFetch('/api/refresh', { refreshToken })
            if (!res.ok) return false
            const data = await res.json().catch(() => ({}))
            if (data.accessToken) {
                setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken || refreshToken })
                return true
            }
            return false
        } catch (_) {
            return false
        } finally {
            refreshInFlight = null
        }
    })()
    return refreshInFlight
}

export function useApi() {
    async function callApi(url, body, onSuccess) {
        try {
            let response = await rawFetch(url, body)

            // JWT 만료 → refresh 한 번 시도 후 재호출
            if (response.status === 401 && !PUBLIC_PATHS.has(url)) {
                const ok = await tryRefresh()
                if (ok) {
                    response = await rawFetch(url, body)
                } else {
                    clearTokens()
                    if (typeof onSuccess === 'function') {
                        onSuccess({ success: false, message: '세션이 만료됐어요. 다시 로그인해주세요.' })
                    }
                    if (typeof window !== 'undefined' && window.location) {
                        window.location.hash = '#/login?reason=token_expired'
                    }
                    return
                }
            }

            const data = await response.json().catch(() => ({}))

            // /api/login 등에서 토큰이 내려오면 자동 저장.
            if (data && (data.accessToken || data.refreshToken)) {
                setTokens(data)
            }

            onSuccess(data)
        } catch (error) {
            console.error('API Error:', error)
            // 시스템 alert 대신 앱 내 팝업 (legacy 의 showAppAlert 정합)
            const { showAppAlert } = usePopup()
            showAppAlert('서버 연결에 실패했어 🥺: ' + error.message)
        }
    }

    async function callApiPromise(url, body) {
        return new Promise((resolve) => {
            callApi(url, body, resolve)
        })
    }

    // 멀티파트 업로드용 — Content-Type 은 브라우저가 boundary 와 함께 set.
    // 사용처: /api/storage/upload (게시판 이미지).
    async function callApiMultipart(url, formData, onSuccess) {
        try {
            const headers = {}
            const token = getAccess()
            if (token) headers.Authorization = `Bearer ${token}`
            const response = await fetch(url, { method: 'POST', headers, body: formData })
            const data = await response.json().catch(() => ({}))
            onSuccess(data)
        } catch (error) {
            console.error('API Upload Error:', error)
            const { showAppAlert } = usePopup()
            showAppAlert('업로드 실패 🥺: ' + error.message)
        }
    }

    return { callApi, callApiPromise, callApiMultipart }
}

// 외부에서도 토큰 조작이 필요할 때 (logout 등).
export const tokenStore = { getAccess, getRefresh, setTokens, clearTokens, isWebApp, setTgUid, getTgUid }

// 사용자 메타 (sabun 등) 도 동일 매체 정책 사용. auth store 가 이 헬퍼를 통해
// 저장/조회하면 WebApp(localStorage) vs 브라우저(cookie) 자동 라우팅 됨.
export const persistStore = {
    set(key, value) { writeToken(key, value) },
    get(key) { return readToken(key) },
    remove(key) { clearToken(key) },
}
