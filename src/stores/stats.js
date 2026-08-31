import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useStatsStore = defineStore('stats', () => {
    const comprehensiveStatsData = ref(null)
    const currentPeriod = ref('weekly')

    return {
        comprehensiveStatsData,
        currentPeriod
    }
})
