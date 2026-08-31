<script setup>
import { computed } from 'vue'

// CenterScreen 의 매칭정보 팝업 — 합재양 보기 / 유형진 보기 두 버튼.
// legacy: openMatchingInfoPopup 정합.

defineProps({})

const emit = defineEmits(['close', 'viewHabjaeyang'])

// 유형진 단톡방 — legacy 와 동일 link
const YUHYEONGJIN_LINK = 'https://t.me/+bIrD9EkjZjs3NWY9'

const platform = (typeof window !== 'undefined' && window.Telegram?.WebApp?.platform) || ''
const isMobile = computed(() => platform === 'android' || platform === 'ios')

function openYuhyeongjin() {
    if (isMobile.value) window.open(YUHYEONGJIN_LINK, '_blank')
    else window.Telegram?.WebApp?.openLink?.(YUHYEONGJIN_LINK)
}
</script>

<template>
    <Teleport to="body">
        <div class="modal-overlay" @click.self="emit('close')">
            <div class="modal-card">
                <span class="modal-close" @click="emit('close')">&times;</span>
                <div class="modal-title">매칭정보</div>
                <div class="btn-col">
                    <button class="btn-pos" style="background:#6D4C41; margin-bottom:10px;" @click="emit('viewHabjaeyang')">합재양 보기</button>
                    <button class="btn-pos" style="background:#3F51B5;" @click="openYuhyeongjin">유형진 보기</button>
                </div>
            </div>
        </div>
    </Teleport>
</template>
