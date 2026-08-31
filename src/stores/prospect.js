import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useProspectStore = defineStore('prospect', () => {
    const sheetConfigs = ref([])
    const fetchedSheetData = ref([])
    const importedStatusMap = ref({})
    const currentSheetToolTab = ref('전체')

    return {
        sheetConfigs,
        fetchedSheetData,
        importedStatusMap,
        currentSheetToolTab
    }
})
