import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAdminStore = defineStore('admin', () => {
    const cachedSemesterData = ref({})
    const calViewDate = ref(new Date())
    const adminSheetConfigs = ref([])
    const currentIsFreeForm = ref(false)

    return {
        cachedSemesterData,
        calViewDate,
        adminSheetConfigs,
        currentIsFreeForm
    }
})
