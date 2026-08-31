<script setup>
import { computed } from 'vue'
import { tokenStore } from '@/composables/useApi'

const emit = defineEmits(['close'])

// 토큰을 URL 해시에 포함 — useAuth가 setup() 중 동기적으로 읽어서
// onMounted의 첫 /stats 폴링 전에 확실히 세팅됨. postMessage 방식은
// race condition이 있어서 (폴링이 ready 메시지보다 먼저 발생) 사용하지 않음.
const iframeSrc = computed(() => {
    const token = tokenStore.getAccess()
    return `/dashboard/?embed=1${token ? '#token=' + encodeURIComponent(token) : ''}`
})
</script>

<template>
    <div class="trd-overlay" @click.self="emit('close')">
        <div class="trd-panel">
            <div class="trd-header">
                <span>📡 텔레그램 라우터 대시보드</span>
                <button class="trd-close" @click="emit('close')">✕</button>
            </div>
            <iframe
                class="trd-iframe"
                :src="iframeSrc"
            />
        </div>
    </div>
</template>

<style scoped>
.trd-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.6);
    z-index: 1000;
    display: flex;
    align-items: stretch;
    justify-content: center;
    padding: 16px;
    box-sizing: border-box;
}
.trd-panel {
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 900px;
    background: #1a1a2e;
    border-radius: 12px;
    overflow: hidden;
}
.trd-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: #16213e;
    color: #fff;
    font-size: 15px;
    font-weight: 600;
}
.trd-close {
    background: none;
    border: none;
    color: #aaa;
    font-size: 18px;
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
}
.trd-close:hover { color: #fff; }
.trd-iframe {
    flex: 1;
    border: none;
    width: 100%;
}
</style>
