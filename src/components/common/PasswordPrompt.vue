<script setup>
import { ref } from 'vue'
import { usePopup } from '@/composables/usePopup'

const { passwordState, showAppAlert } = usePopup()
const displayValue = ref('')

function appendPassword(num) {
    if (passwordState.input.length < 4) {
        passwordState.input += num
        displayValue.value = '*'.repeat(passwordState.input.length)
    }
    if (passwordState.input.length === 4) {
        checkPassword()
    }
}

function deletePassword() {
    passwordState.input = passwordState.input.slice(0, -1)
    displayValue.value = '*'.repeat(passwordState.input.length)
}

function checkPassword() {
    const targetPwd = passwordState.expectedPassword !== null ? passwordState.expectedPassword : '1440'

    if (passwordState.input === targetPwd) {
        const enteredInput = passwordState.input
        passwordState.visible = false
        if (passwordState.callback) {
            passwordState.callback(true, enteredInput)
        }
    } else {
        showAppAlert('비밀번호가 틀렸어! 🥺', () => {
            passwordState.input = ''
            displayValue.value = ''
        })
    }
}
</script>

<template>
    <div class="modal-overlay">
        <div class="modal-card">
            <span class="modal-close" @click="passwordState.visible = false">&times;</span>
            <div class="modal-title">비밀번호를 입력해주세요</div>
            <div class="password-modal-content">
                <input type="password" class="password-input" inputmode="numeric" readonly :value="displayValue">
                <div class="keypad-grid">
                    <button v-for="n in [1,2,3,4,5,6,7,8,9]" :key="n" class="keypad-btn" @click="appendPassword(String(n))">{{ n }}</button>
                    <button class="keypad-btn"></button>
                    <button class="keypad-btn" @click="appendPassword('0')">0</button>
                    <button class="keypad-btn"></button>
                    <button class="keypad-btn delete" style="grid-column: span 2;" @click="deletePassword">← 삭제</button>
                    <button class="keypad-btn confirm" @click="checkPassword">확인</button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.password-modal-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 15px;
}

.password-input {
    width: 100%;
    padding: 12px;
    border: 1px solid #ddd;
    border-radius: 10px;
    font-size: 24px;
    text-align: center;
    letter-spacing: 5px;
    font-family: 'Jua', sans-serif;
}

.keypad-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    width: 100%;
    max-width: 280px;
}

.keypad-btn {
    width: 100%;
    padding: 18px 10px;
    background: #EFEBE9;
    border: 1px solid #ddd;
    border-radius: 10px;
    font-size: 24px;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.1s;
    box-shadow: 0 2px 0 rgba(0, 0, 0, 0.1);
    font-family: 'Jua';
    color: var(--btn-color);
}

.keypad-btn:active {
    transform: translateY(2px);
    box-shadow: none;
}

.keypad-btn.delete {
    background: #FFCDD2;
    color: #C62828;
}

.keypad-btn.confirm {
    background: var(--btn-color);
    color: white;
}
</style>
