import { reactive } from 'vue'

const popupStack = reactive([])
const toasts = reactive([])

// Password state
const passwordState = reactive({
    visible: false,
    callback: null,
    input: '',
    expectedPassword: null
})

export function usePopup() {
    function showPopup(type, title, desc, callback, opts = {}) {
        // 같은 성격 (type) 의 popup 이 이미 떠 있거나 stack 에 쌓여 있으면 replace 한다.
        // 콜백 race / 사용자 빠른 연타로 같은 alert/confirm/text 가 중첩 쌓여서
        // 진행이 안 되는 케이스 회피 (legacy V1 의 단일 popup 패턴 정합).
        // 다른 type 이면 push (text 입력 위에 alert 등 layered popup 보존).
        while (popupStack.length > 0 && popupStack[popupStack.length - 1].type === type) {
            popupStack.pop()
        }
        popupStack.push({ type, title, desc, callback, opts })
    }

    function closePopup() {
        popupStack.pop()
    }

    function closeAllPopups() {
        popupStack.splice(0)
    }

    function showAppAlert(msg, callback) {
        showPopup('appAlert', '알림 🦔', null, callback, { message: msg })
    }

    function showAppConfirm(msg, callback, opts = {}) {
        showPopup('appConfirm', '확인해줘 🦔', null, callback, { message: msg, ...opts })
    }

    function showPasswordPrompt(callback, dynamicPassword = null) {
        passwordState.visible = true
        passwordState.callback = callback
        passwordState.input = ''
        passwordState.expectedPassword = dynamicPassword
    }

    function showToast(msg) {
        const id = Date.now()
        toasts.push({ id, msg })
        setTimeout(() => {
            const idx = toasts.findIndex(t => t.id === id)
            if (idx !== -1) toasts.splice(idx, 1)
        }, 2000)
    }

    return {
        popupStack,
        toasts,
        passwordState,
        showPopup,
        closePopup,
        closeAllPopups,
        showAppAlert,
        showAppConfirm,
        showPasswordPrompt,
        showToast
    }
}
