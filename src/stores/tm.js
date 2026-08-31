import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useTmStore = defineStore('tm', () => {
    const tmDataList = ref([])
    const originalTmList = ref([])
    // sortState: 0=원본 / 1=desc / 2=asc — 3 state cycle.
    // sortKey: 마지막 정렬 키 (UI 의 ↑/↓/↕ 시각화용)
    const sortState = ref(0)
    const sortKey = ref('')
    const currentlyExpandedId = ref(null)
    // legacy 정합: null = 전체. 활성 path 재클릭으로 toggle.
    const currentTmToolTab = ref(null)
    // status 탭 (legacy 정합) — '번호찾'=등록된 PROSPECTS / '미등록'=SHEET_CACHE_ROWS 중 미처리
    const currentTmStatusTab = ref('번호찾')
    // sheet 미등록 list (background fetch /api/get-sheet-prospects 후 채워짐)
    const sheetUnregisteredList = ref([])
    const currentTmIndex = ref(null)
    const shedContext = ref(null)  // { docId, name, phone, age, residence, memo, noteToggles }

    function setTmData(list) {
        tmDataList.value = list
        originalTmList.value = [...list]
    }

    function toggleSort(key) {
        // 다른 컬럼 누르면 cycle 초기화 (0 → 1)
        if (sortKey.value !== key) {
            sortKey.value = key
            sortState.value = 1
        } else {
            sortState.value = (sortState.value + 1) % 3
        }
        if (sortState.value === 0) {
            tmDataList.value = [...originalTmList.value]
            sortKey.value = ''
        } else {
            const asc = sortState.value === 2
            tmDataList.value.sort((a, b) => {
                let valA = a[key] || ''
                let valB = b[key] || ''
                if (valA < valB) return asc ? -1 : 1
                if (valA > valB) return asc ? 1 : -1
                return 0
            })
        }
    }

    return {
        tmDataList,
        originalTmList,
        sortState,
        sortKey,
        currentlyExpandedId,
        currentTmToolTab,
        currentTmStatusTab,
        sheetUnregisteredList,
        currentTmIndex,
        shedContext,
        setTmData,
        toggleSort,
    }
})
