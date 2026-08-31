<script setup>
import { ref, reactive, onMounted, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useApi } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'
import { ACTIVITY_HOUR_START, ACTIVITY_HOUR_END } from '@/constants'

const props = defineProps({
    /** 초기 블록 데이터: { 'HH:mm': { name, color, type, memo } } */
    initialBlocks: { type: Object, default: () => ({}) },
    /** 읽기 전용 모드 */
    readonly: { type: Boolean, default: false }
})

const emit = defineEmits(['update:blocks'])

const auth = useAuthStore()
const { callApi } = useApi()
const { showPopup } = usePopup()

const categories = ref([])
const activeTab = ref('')
const currentCategory = ref(undefined) // undefined=unset, null=eraser
const blocks = reactive({})

// 카테고리 로드
function loadCategories() {
    const targetTeam = auth.isAdmin ? '공통' : (auth.currentUserTeam || '미배정')
    callApi('/api/manage-ministry-categories', { action: 'get', team: targetTeam }, (r) => {
        if (r.success) {
            categories.value = r.list
            const types = [...new Set(r.list.map(c => c.type || '기타'))]
            if (types.length > 0) activeTab.value = types[0]
        }
    })
}

// 시간 슬롯 생성 — constants/index.js ACTIVITY_HOUR_START..END 단일 소스.
const timeSlots = []
for (let h = ACTIVITY_HOUR_START; h <= ACTIVITY_HOUR_END; h++) {
    const hStr = String(h).padStart(2, '0')
    timeSlots.push({ hour: `${hStr}:00`, t1: `${hStr}:00`, t2: `${hStr}:30` })
}

// 탭 목록 (computed-like)
function getTypes() {
    return [...new Set(categories.value.map(c => c.type || '기타'))]
}

function getFilteredCategories() {
    if (activeTab.value === 'eraser') return []
    return categories.value.filter(c => (c.type || '기타') === activeTab.value)
}

function selectCategory(cat) {
    currentCategory.value = cat
    haptic('light')
}

function selectEraser() {
    currentCategory.value = null
    activeTab.value = 'eraser'
    haptic('light')
}

function selectTab(type) {
    activeTab.value = type
    // 탭 변경 시 카테고리 선택 해제하지 않음 (UX 유지)
}

function touchBlock(timeStr) {
    if (props.readonly) return

    // 지우개
    if (currentCategory.value === null) {
        delete blocks[timeStr]
        haptic('medium')
        emitBlocks()
        return
    }

    const existing = blocks[timeStr]

    // 같은 색상 재터치 → 메모 입력
    if (existing && currentCategory.value && existing.name === currentCategory.value.name) {
        const currentMemo = existing.memo || ''
        showPopup(
            'text',
            `[${timeStr}] ${currentCategory.value.name}`,
            '여기에 구체적인 일정(장소, 이름 등)을 적어주세요',
            (res) => {
                if (!res || res.text === undefined) return
                blocks[timeStr].memo = String(res.text).trim()
                emitBlocks()
            },
            { value: currentMemo }
        )
        return
    }

    // 새로 칠하기
    if (currentCategory.value !== undefined) {
        blocks[timeStr] = {
            name: currentCategory.value.name,
            color: currentCategory.value.color,
            type: currentCategory.value.type,
            memo: ''
        }
        haptic('light')
        emitBlocks()
    }
}

function emitBlocks() {
    emit('update:blocks', { ...blocks })
}

function haptic(style) {
    if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.impactOccurred(style)
    }
}

// 외부에서 블록 세팅 (어제/지난주 복사 등)
function setBlocks(data) {
    Object.keys(blocks).forEach(k => delete blocks[k])
    Object.entries(data).forEach(([k, v]) => { blocks[k] = v })
    emitBlocks()
}

// 블록 초기화
function clearBlocks() {
    Object.keys(blocks).forEach(k => delete blocks[k])
    emitBlocks()
}

// expose for parent
defineExpose({ setBlocks, clearBlocks, loadCategories })

onMounted(() => {
    // 초기 블록 데이터 세팅
    if (props.initialBlocks) {
        Object.entries(props.initialBlocks).forEach(([k, v]) => { blocks[k] = v })
    }
    loadCategories()
})

watch(() => props.initialBlocks, (newVal) => {
    if (newVal) {
        Object.keys(blocks).forEach(k => delete blocks[k])
        Object.entries(newVal).forEach(([k, v]) => { blocks[k] = v })
    }
}, { deep: true })
</script>

<template>
    <div class="tbp-wrapper">
        <!-- 도화지 (시간 블록 그리드) -->
        <div class="tbp-canvas">
            <div v-for="slot in timeSlots" :key="slot.hour" class="tbp-row">
                <div class="tbp-label">{{ slot.hour }}</div>
                <div class="tbp-cells">
                    <div
                        class="tbp-cell left"
                        :style="{ background: blocks[slot.t1]?.color || '#f9f9f9', border: blocks[slot.t1] ? 'none' : '1px solid #eee' }"
                        @click="touchBlock(slot.t1)"
                    >
                        <template v-if="blocks[slot.t1]">{{ blocks[slot.t1].name }}</template>
                        <template v-else><span class="tbp-placeholder">00분~</span></template>
                        <span v-if="blocks[slot.t1]?.memo" class="tbp-memo-icon">📝</span>
                    </div>
                    <div
                        class="tbp-cell right"
                        :style="{ background: blocks[slot.t2]?.color || '#f9f9f9', border: blocks[slot.t2] ? 'none' : '1px solid #eee' }"
                        @click="touchBlock(slot.t2)"
                    >
                        <template v-if="blocks[slot.t2]">{{ blocks[slot.t2].name }}</template>
                        <template v-else><span class="tbp-placeholder">30분~</span></template>
                        <span v-if="blocks[slot.t2]?.memo" class="tbp-memo-icon">📝</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- 하단 고정 팔레트 -->
        <div v-if="!readonly" class="tbp-palette">
            <div class="tbp-tabs">
                <div
                    class="tbp-tab eraser"
                    :class="{ active: activeTab === 'eraser' }"
                    @click="selectEraser"
                >🧹 지우개</div>
                <div
                    v-for="type in getTypes()"
                    :key="type"
                    class="tbp-tab"
                    :class="{ active: activeTab === type }"
                    @click="selectTab(type)"
                >{{ type }}</div>
            </div>
            <div class="tbp-items">
                <template v-if="activeTab === 'eraser'">
                    <div class="tbp-eraser-msg">빗자루가 선택되었어! 지울 시간표를 터치해! 🧹</div>
                </template>
                <template v-else>
                    <div
                        v-for="cat in getFilteredCategories()"
                        :key="cat.id"
                        class="tbp-item"
                        :class="{ selected: currentCategory?.name === cat.name }"
                        :style="{ background: cat.color }"
                        @click="selectCategory(cat)"
                    >{{ cat.name }}</div>
                </template>
            </div>
        </div>
    </div>
</template>

<style scoped>
.tbp-wrapper {
    position: relative;
}
.tbp-canvas {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
    background: #fff;
    border-radius: 12px;
    padding: 15px 10px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    border: 1px solid #eee;
}
.tbp-row {
    display: flex;
    align-items: center;
    height: 45px;
}
.tbp-label {
    width: 45px;
    font-size: 13px;
    color: #888;
    text-align: right;
    padding-right: 10px;
    font-weight: bold;
}
.tbp-cells {
    flex: 1;
    display: flex;
    gap: 3px;
    height: 100%;
}
.tbp-cell {
    flex: 1;
    height: 100%;
    background: #f9f9f9;
    cursor: pointer;
    transition: background 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: bold;
    color: white;
    text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
    position: relative;
}
.tbp-cell.left { border-radius: 8px 2px 2px 8px; }
.tbp-cell.right { border-radius: 2px 8px 8px 2px; }
.tbp-cell:active { transform: scale(0.96); }
.tbp-placeholder {
    color: #ccc;
    font-size: 11px;
    text-shadow: none;
}
.tbp-memo-icon {
    position: absolute;
    top: 2px;
    right: 3px;
    font-size: 10px;
    opacity: 0.8;
}
/* 하단 고정 팔레트 */
.tbp-palette {
    position: sticky;
    bottom: 0;
    background: #fff;
    padding: 15px;
    margin: 15px -15px -15px -15px;
    z-index: 100;
    border-top: 1px solid #ddd;
    box-shadow: 0 -4px 15px rgba(0,0,0,0.08);
    border-radius: 24px 24px 0 0;
}
.tbp-tabs {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    margin-bottom: 12px;
    padding-bottom: 5px;
}
.tbp-tab {
    flex: 0 0 auto;
    padding: 8px 14px;
    background: #f0f0f0;
    color: #777;
    border-radius: 20px;
    font-size: 13px;
    font-weight: bold;
    cursor: pointer;
    border: 1px solid #e0e0e0;
    transition: 0.2s;
}
.tbp-tab.active {
    background: #5D4037;
    color: white;
    border-color: #5D4037;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
}
.tbp-tab.eraser {
    background: #FFEBEE;
    color: #C62828;
    border-color: #FFCDD2;
}
.tbp-tab.eraser.active {
    background: #E53935;
    color: white;
    border-color: #E53935;
}
.tbp-items {
    display: flex;
    gap: 10px;
    overflow-x: auto;
    padding: 10px 5px;
}
.tbp-item {
    flex: 0 0 auto;
    padding: 8px 15px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: bold;
    color: white;
    cursor: pointer;
    border: 2px solid transparent;
    transition: transform 0.2s, box-shadow 0.2s;
}
.tbp-item.selected {
    transform: scale(1.15);
    border-color: #333;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    z-index: 10;
}
.tbp-eraser-msg {
    font-size: 12px;
    color: #888;
    padding: 5px;
}
</style>
