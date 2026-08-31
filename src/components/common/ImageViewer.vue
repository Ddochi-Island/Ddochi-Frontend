<script setup>
import { useBoardStore } from '@/stores/board'

const board = useBoardStore()

function changeImage(direction) {
    const newIdx = board.viewerCurrentIdx + direction
    if (newIdx >= 0 && newIdx < board.viewerImages.length) {
        board.viewerCurrentIdx = newIdx
    }
}

function close() {
    board.viewerImages = []
}
</script>

<template>
    <div v-if="board.viewerImages.length > 0" class="image-viewer-overlay">
        <div class="image-viewer-header">
            <span>{{ board.viewerCurrentIdx + 1 }} / {{ board.viewerImages.length }}</span>
            <span class="image-viewer-close" @click="close">✕</span>
        </div>
        <div class="image-viewer-content">
            <div class="image-viewer-nav image-viewer-prev" @click="changeImage(-1)">‹</div>
            <img :src="board.viewerImages[board.viewerCurrentIdx]" alt="">
            <div class="image-viewer-nav image-viewer-next" @click="changeImage(1)">›</div>
        </div>
    </div>
</template>

<style scoped>
.image-viewer-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: #000;
    z-index: 3000;
    display: flex;
    flex-direction: column;
}

.image-viewer-header {
    padding: 15px;
    display: flex;
    justify-content: space-between;
    color: white;
    font-size: 16px;
    align-items: center;
    background: rgba(0, 0, 0, 0.5);
}

.image-viewer-close {
    font-size: 28px;
    cursor: pointer;
}

.image-viewer-content {
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    position: relative;
    overflow: hidden;
}

.image-viewer-content img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    transition: transform 0.3s;
}

.image-viewer-nav {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    color: white;
    font-size: 40px;
    background: rgba(0, 0, 0, 0.3);
    padding: 10px;
    cursor: pointer;
    border-radius: 50%;
}

.image-viewer-prev { left: 10px; }
.image-viewer-next { right: 10px; }
</style>
