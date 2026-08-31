import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useBoardStore = defineStore('board', () => {
    const globalBoards = ref([])
    const currentBoardTab = ref('전체')
    const posts = ref([])
    const currentPostDetail = ref(null)
    const currentPostImages = ref([])
    const viewerImages = ref([])
    const viewerCurrentIdx = ref(0)

    return {
        globalBoards,
        currentBoardTab,
        posts,
        currentPostDetail,
        currentPostImages,
        viewerImages,
        viewerCurrentIdx
    }
})
