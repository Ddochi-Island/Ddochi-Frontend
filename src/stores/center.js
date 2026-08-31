import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useCenterStore = defineStore('center', () => {
    const centerDataList = ref([])
    const originalCenterList = ref([])
    const centerSortState = ref({ key: 'phase', asc: true })

    function setCenterData(list) {
        centerDataList.value = list
        originalCenterList.value = [...list]
    }

    function toggleCenterSort(key) {
        if (centerSortState.value.key === key) {
            centerSortState.value.asc = !centerSortState.value.asc
        } else {
            centerSortState.value = { key, asc: true }
        }
    }

    return {
        centerDataList,
        originalCenterList,
        centerSortState,
        setCenterData,
        toggleCenterSort
    }
})
