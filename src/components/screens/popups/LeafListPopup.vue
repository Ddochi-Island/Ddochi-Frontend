<script setup>
import { computed } from 'vue'

// CenterScreen 의 잎사귀 6종 grid 팝업.
// legacy index.html 의 showCenterLeaf(idx) 를 Vue 컴포넌트로 정합.

const props = defineProps({
    item: { type: Object, required: true },
})

const emit = defineEmits(['pick', 'close'])

const LEAF_TYPES = ['생노잎', '간증잎', '성구잎', '특강자', '타로잎', '인도잎', '기타잎']

const leafMap = computed(() => props.item?.note?.leafMap || {})

// 표시값 + filled 여부.
function leafDisplay(type) {
    const raw = leafMap.value[type]
    if (!raw) return { text: '터치하여 입력', filled: false }
    const m = raw.match(/^(.*)\((\d{2}\/\d{2})(.)\)$/)
    if (m) return { text: `${m[1]}(${m[2]}(${m[3]}))`, filled: true }
    return { text: raw, filled: true }
}
</script>

<template>
    <Teleport to="body">
        <div class="modal-overlay" @click.self="emit('close')">
            <div class="modal-card">
                <span class="modal-close" @click="emit('close')">&times;</span>
                <div class="modal-title">🌱 잎사귀 작성</div>

                <div class="leaf-list">
                    <div
                        v-for="type in LEAF_TYPES"
                        :key="type"
                        class="leaf-row"
                        @click="emit('pick', type)"
                    >
                        <span class="leaf-label">{{ type }}</span>
                        <div
                            class="leaf-input-area"
                            :class="{ 'leaf-val-filled': leafDisplay(type).filled }"
                        >
                            <span v-if="!leafDisplay(type).filled" class="leaf-placeholder">{{ leafDisplay(type).text }}</span>
                            <span v-else>{{ leafDisplay(type).text }}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
.leaf-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    text-align: left;
}
.leaf-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    border: 1px solid #eee;
    border-radius: 8px;
    cursor: pointer;
    background: white;
    transition: background 0.15s;
}
.leaf-row:active {
    background: #f5f5f5;
}
.leaf-label {
    font-weight: bold;
    font-size: 14px;
    color: #333;
    flex-shrink: 0;
}
.leaf-input-area {
    font-size: 13px;
    color: #333;
    text-align: right;
    flex: 1;
    margin-left: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.leaf-placeholder {
    color: #bbb;
}
</style>
