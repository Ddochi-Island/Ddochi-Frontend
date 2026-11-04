// 합당한 자 실시간 신호 구독 — /ws/hapdang 웹소켓. 끊기면 1·2·4…30초 간격으로 다시 붙고, 다시 붙으면 onReconnect(놓친 변경 채우기)
import { onUnmounted } from 'vue'
import { tokenStore } from '@/composables/useApi'

export function useRealtime({ onMessage, onReconnect }) {
    let ws = null
    let retry = 0
    let timer = null
    let stopped = false
    let connectedOnce = false

    function connect() {
        if (stopped) return
        const token = tokenStore.getAccess()
        if (!token) { schedule(); return }
        const proto = location.protocol === 'https:' ? 'wss' : 'ws'
        ws = new WebSocket(`${proto}://${location.host}/ws/hapdang`)
        ws.onopen = () => {
            ws.send(token)  // 토큰은 첫 메시지로(URL에 넣으면 서버 접속 로그에 남음)
            if (connectedOnce) onReconnect?.()
            connectedOnce = true
            retry = 0
        }
        ws.onmessage = (e) => { try { onMessage(JSON.parse(e.data)) } catch { /* 모르는 메시지는 무시 */ } }
        ws.onclose = schedule  // 토큰 만료(4401)여도 다시 시도 — 그사이 API 호출이 토큰을 갱신해 둠
    }
    function schedule() {
        if (stopped) return
        clearTimeout(timer)
        timer = setTimeout(connect, Math.min(30, 2 ** retry++) * 1000)
    }
    function stop() {
        stopped = true
        clearTimeout(timer)
        if (ws) { ws.onclose = null; ws.close() }
    }

    connect()
    onUnmounted(stop)
    return { stop }
}
