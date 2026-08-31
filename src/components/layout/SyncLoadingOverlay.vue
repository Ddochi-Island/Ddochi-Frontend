<script setup>
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
</script>

<template>
    <div v-if="ui.syncOverlayVisible" class="sync-loading-overlay">
        <div class="sync-spinner">🦔</div>
        <div class="sync-text" v-html="ui.syncOverlayText"></div>
        <div class="sync-warning">절대 화면을 끄거나 뒤로 가지 마세요 ⏳</div>
    </div>
</template>

<style scoped>
.sync-loading-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.85);
    z-index: 9999;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    color: white;
    font-family: 'Jua', sans-serif;
    transition: opacity 0.3s;
}

.sync-spinner {
    font-size: 60px;
    margin-bottom: 20px;
    animation: spin 2s linear infinite;
}

@keyframes spin {
    100% { transform: rotate(360deg); }
}

.sync-text {
    font-size: 20px;
    line-height: 1.5;
    text-align: center;
}

.sync-warning {
    color: #FF5252;
    font-size: 14px;
    margin-top: 15px;
}
</style>
