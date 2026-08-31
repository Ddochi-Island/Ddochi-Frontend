import { KR_TIME_DIFF_MS } from '@/constants'

export function useFormatters() {
    function formatPhoneNumber(rawPhone) {
        if (!rawPhone) return null
        let p = rawPhone.replace(/[^0-9]/g, '')
        if (p.startsWith('82')) p = '0' + p.substring(2)
        if (p.length === 11 && p.startsWith('010')) {
            return `${p.substring(0, 3)}-${p.substring(3, 7)}-${p.substring(7, 11)}`
        }
        return null
    }

    function letterToIndex(letter) {
        if (!letter) return -1
        let idx = 0
        for (let i = 0; i < letter.length; i++) {
            idx = idx * 26 + (letter.charCodeAt(i) - 64)
        }
        return idx - 1
    }

    function formatDateForList(dateStr) {
        if (!dateStr) return ''
        const d = new Date(dateStr)
        if (isNaN(d.getTime())) return dateStr
        return `${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
    }

    function getDay(dateStr) {
        if (!dateStr) return ''
        const w = ['일', '월', '화', '수', '목', '금', '토']
        return w[new Date(dateStr).getDay()]
    }

    function autoResize(el) {
        if (!el) return
        const scrollY = window.scrollY
        el.style.height = 'auto'
        el.style.height = el.scrollHeight + 'px'
        window.scrollTo(0, scrollY)
    }

    function getKstDate() {
        const curr = new Date()
        const utc = curr.getTime() + (curr.getTimezoneOffset() * 60 * 1000)
        return new Date(utc + KR_TIME_DIFF_MS)
    }

    function getBusinessDateStr(dateInput) {
        const bizDate = getBusinessDateObj(dateInput)
        if (!bizDate) return null
        return `${bizDate.getFullYear()}-${String(bizDate.getMonth()+1).padStart(2,'0')}-${String(bizDate.getDate()).padStart(2,'0')}`
    }

    function getBusinessDateObj(dateInput) {
        if (!dateInput) return null
        let d = null

        if (typeof dateInput === 'string' && dateInput.includes('.')) {
            const parts = dateInput.split(/[.\s:-]+/).filter(Boolean)
            if (parts.length >= 3) {
                let yy = parseInt(parts[0])
                if (yy < 100) yy += 2000
                const mm = parseInt(parts[1]) - 1
                const dd = parseInt(parts[2])
                const hh = parts.length >= 4 ? parseInt(parts[3]) : 0
                const min = parts.length >= 5 ? parseInt(parts[4]) : 0
                d = new Date(yy, mm, dd, hh, min)
            }
        } else {
            d = new Date(dateInput)
        }

        if (!d || isNaN(d.getTime())) return null

        const bizDate = new Date(d)
        if (bizDate.getHours() >= 22) {
            bizDate.setDate(bizDate.getDate() + 1)
        }
        bizDate.setHours(0, 0, 0, 0)
        return bizDate
    }

    function formatTimeAgo(dateInput) {
        if (!dateInput) return '방금 전'

        // YY.MM.DD HH:mm 로그 포맷 처리
        if (typeof dateInput === 'string' && dateInput.includes('.') && !dateInput.includes('T')) {
            const p = dateInput.split(/[\. :]/)
            if (p.length >= 5) {
                const last = new Date(2000 + parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]), parseInt(p[3]), parseInt(p[4]))
                return Math.floor((new Date() - last) / (1000 * 60 * 60)) + '시간 전'
            }
            return ''
        }

        // ISO 날짜 문자열 / Date 객체 처리 (분/시간/날짜 fallback)
        const date = new Date(dateInput)
        if (isNaN(date.getTime())) return '방금 전'
        const diffMin = Math.floor((new Date() - date) / 60000)
        if (diffMin < 1) return '방금 전'
        if (diffMin < 60) return `${diffMin}분 전`
        const diffHr = Math.floor(diffMin / 60)
        if (diffHr < 24) return `${diffHr}시간 전`
        return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`
    }

    function copyText(t) {
        navigator.clipboard.writeText(t).then(() => {
            // Will use showAppAlert in components
        })
    }

    function moveFocus(el, max, nextId) {
        if (el.value.length >= max) {
            document.getElementById(nextId)?.focus()
        }
    }

    return {
        formatPhoneNumber,
        letterToIndex,
        formatDateForList,
        getDay,
        autoResize,
        getKstDate,
        getBusinessDateStr,
        getBusinessDateObj,
        formatTimeAgo,
        copyText,
        moveFocus
    }
}
