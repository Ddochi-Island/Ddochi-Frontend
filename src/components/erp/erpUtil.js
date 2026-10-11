// ERP 화면 공통 — /api/erp/* 호출 상태, 날짜(로컬=KST) 계산, (지역, 구역) 행 묶기, 표시 포맷
import { ref } from 'vue'
import { useApi } from '@/composables/useApi'

// 탭마다 같은 로딩/에러/결과 상태 — load(body)가 끝나면 data에 응답 전체
export function useErpLoad(path) {
    const { callApiPromise } = useApi()
    const loading = ref(false)
    const error = ref('')
    const data = ref(null)
    async function load(body) {
        loading.value = true
        error.value = ''
        const r = await callApiPromise(path, body)
        loading.value = false
        if (!r?.success) { error.value = r?.message || '불러오지 못했어요. 잠시 뒤 다시 눌러 주세요.'; return null }
        data.value = r
        return r
    }
    return { loading, error, data, load }
}

const pad = (n) => String(n).padStart(2, '0')
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
export function addDays(s, n) { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d) }

// 일~토 한 주 (구 ERP와 같은 주 경계)
export function weekOf(date = new Date()) {
    const s = new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay())
    return { from: ymd(s), to: addDays(ymd(s), 6) }
}
export const monthOf = (date = new Date()) => ({
    from: ymd(new Date(date.getFullYear(), date.getMonth(), 1)),
    to: ymd(new Date(date.getFullYear(), date.getMonth() + 1, 0)),
})

export const natCmp = (a, b) => String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true })
export const regionLabel = (r) => (r ? `${r}지역` : '소속 없음')
export const districtLabel = (d) => (d ? `${d}구역` : '구역 없음')
export const pct = (n, d) => (d ? `${Math.round((n / d) * 1000) / 10}%` : '–')

// rows를 keyFn으로 묶어 숫자 필드를 합침 → [{ key, ...합계 }] (key 자연 정렬)
export function sumBy(rows, keyFn) {
    const map = new Map()
    for (const r of rows) {
        const k = keyFn(r)
        const acc = map.get(k) || { key: k }
        for (const [f, v] of Object.entries(r)) if (typeof v === 'number') acc[f] = (acc[f] || 0) + v
        map.set(k, acc)
    }
    return [...map.values()].sort((a, b) => natCmp(a.key, b.key))
}
export function total(rows) {
    const acc = {}
    for (const r of rows) for (const [f, v] of Object.entries(r)) if (typeof v === 'number') acc[f] = (acc[f] || 0) + v
    return acc
}

export function fmtDateTime(iso) {
    if (!iso) return ''
    return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
}
export function fmtDate(iso) {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: '2-digit', month: 'numeric', day: 'numeric' })
}
