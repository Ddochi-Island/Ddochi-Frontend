export function useDaumPostcode() {
    function execDaumPostcode(targetId) {
        const layer = document.getElementById('daumLayer')

        new window.daum.Postcode({
            oncomplete: function(data) {
                let addr = ''
                if (data.sido) addr += data.sido
                if (data.sigungu) addr += ' ' + data.sigungu
                addr += ' '

                const target = document.getElementById(targetId)
                if (target) {
                    target.value = addr
                    // Vue v-model 은 'input' event 로 reactive state 동기화 →
                    // JS 직접 .value 할당만으로는 안 잡혀서 form.residence 가 빈 채로
                    // 남아 validate 가 실패하던 회귀 fix.
                    target.dispatchEvent(new Event('input', { bubbles: true }))
                    target.dispatchEvent(new Event('change', { bubbles: true }))
                    target.readOnly = false
                    target.focus()
                    if (target.setSelectionRange) {
                        const len = target.value.length
                        target.setSelectionRange(len, len)
                    }
                }
                closeDaumPostcode()
            },
            width: '100%',
            height: '100%',
            maxSuggestItems: 5
        }).embed(layer)

        layer.style.display = 'block'
        const width = 300
        const height = 400
        const borderWidth = 1
        layer.style.width = width + 'px'
        layer.style.height = height + 'px'
        layer.style.left = (((window.innerWidth || document.documentElement.clientWidth) - width) / 2 - borderWidth) + 'px'
        layer.style.top = (((window.innerHeight || document.documentElement.clientHeight) - height) / 2 - borderWidth) + 'px'
    }

    function closeDaumPostcode() {
        const layer = document.getElementById('daumLayer')
        if (layer) layer.style.display = 'none'
    }

    return { execDaumPostcode, closeDaumPostcode }
}
