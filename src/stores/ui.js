import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
    const isProcessing = ref(false)
    const syncOverlayVisible = ref(false)
    const syncOverlayText = ref('데이터를 굽고 있습니다\n조금만 기다려줘!')
    const approvalDate = ref(new Date())

    function setProcessing(val) {
        isProcessing.value = val
    }

    function showSyncOverlay(text) {
        syncOverlayText.value = text || '데이터를 굽고 있습니다\n조금만 기다려줘!'
        syncOverlayVisible.value = true
    }

    function hideSyncOverlay() {
        syncOverlayVisible.value = false
    }

    function initApprovalDate() {
        const now = new Date()
        if (now.getHours() >= 22) {
            approvalDate.value.setDate(now.getDate() + 1)
        }
    }

    return {
        isProcessing,
        syncOverlayVisible,
        syncOverlayText,
        approvalDate,
        setProcessing,
        showSyncOverlay,
        hideSyncOverlay,
        initApprovalDate
    }
})
