<script setup>
// AdminScreen 의 '🎨 사역 카테고리(블록) 설정' modal.
// 팀 단위 (12144000-* admin='공통' / 일반=내 팀).
// list 는 깔끔하게 — 행마다 [수정] [삭제] 버튼만. 인라인 토글/dropdown 없음.
// [수정] 클릭 시 같은 modal 안 폼이 prefill 모드로 전환 (편집 흐름).

import { ref, computed, onMounted } from 'vue'
import draggable from 'vuedraggable'
import { useAuthStore } from '@/stores/auth'
import { useApi } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'
import { useRoles } from '@/composables/useRoles'

const emit = defineEmits(['close'])

const auth = useAuthStore()
const { callApi } = useApi()
const { showAppAlert, showAppConfirm, showToast } = usePopup()
const { hasRegionRole } = useRoles()

const targetTeam = computed(() => {
    if (String(auth.currentSabun).startsWith('12144000-')) return '공통'
    return auth.currentUserTeam || '미배정'
})

const list = ref([])
const loading = ref(true)
const errorMsg = ref('')

// 직전 item 과 type 이 다르면 헤더 노출 — 드래그로 list 가 바뀌어도 자동으로 헤더 위치가 재배치됨
function shouldShowHeader(index) {
    if (index === 0) return true
    return list.value[index - 1].type !== list.value[index].type
}

// 10색 팔레트
const COLOR_PALETTE = [
    '#F44336', '#FF9800', '#FFEB3B', '#4CAF50', '#2196F3',
    '#3F51B5', '#9C27B0', '#E91E63', '#795548', '#9E9E9E',
]

// '구분없는전도' — admin 또는 지역권한자만 설정 가능
const canSetUndefined = computed(() => auth.isAdmin || hasRegionRole.value)
const ACTIVITY_OPTIONS = computed(() => {
    const base = [
        { value: 'guide', label: '👤 인도' },
        { value: 'teacher', label: '👨‍🏫 교사' },
        { value: 'leaf', label: '🌱 잎사귀' },
    ]
    if (canSetUndefined.value) base.push({ value: 'undefined_evangelism', label: '🌏 구분없는전도' })
    return base
})

// 카드 표시용 activityCategory → label
const ACTIVITY_LABEL_MAP = {
    guide: '👤 인도',
    teacher: '👨‍🏫 교사',
    leaf: '🌱 잎사귀',
    undefined_evangelism: '🌏 구분없는전도',
}
function activityCatLabel(code) {
    return ACTIVITY_LABEL_MAP[code] || code
}

// ── 폼 state — editingId null=신규 / string=수정 ──
const editingId = ref(null)
const form = ref({
    type: '',
    name: '',
    color: '#F44336',
    isActivity: true,
    activityCategory: 'guide',
})

function resetForm() {
    editingId.value = null
    form.value = { type: '', name: '', color: '#F44336', isActivity: true, activityCategory: 'guide' }
}

function startEdit(cat) {
    editingId.value = cat.id
    form.value = {
        type: cat.type || '',
        name: cat.name || '',
        color: cat.color || '#F44336',
        isActivity: !!cat.isActivity,
        activityCategory: cat.activityCategory || 'guide',
    }
    // 폼 영역으로 스크롤
    setTimeout(() => {
        document.querySelector('.mc-form-area')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
}

function cancelEdit() {
    resetForm()
}

// ── 데이터 로딩 ──
function load() {
    loading.value = true
    errorMsg.value = ''
    callApi('/api/manage-ministry-categories', { action: 'get', team: targetTeam.value }, (r) => {
        loading.value = false
        if (!r.success) {
            errorMsg.value = '목록을 불러오지 못했어.'
            return
        }
        list.value = r.list || []
    })
}

// ── 드래그 드롭 시 자동 저장 ──
function onDragEnd(evt) {
    if (evt.oldIndex === evt.newIndex) return
    saveOrder()
}

function saveOrder() {
    const orders = list.value.map((c, idx) => ({ id: c.id, order: idx }))
    callApi('/api/manage-ministry-categories', {
        action: 'reorder', team: targetTeam.value, orders,
    }, (r) => {
        if (!r?.success) {
            showAppAlert('⛔ 순서 저장 실패: ' + (r?.message || '알 수 없는 에러') + '\n새로고침해서 다시 시도해줘.')
            return
        }
        showToast('✅ 순서 저장됨')
    })
}

// ── 저장 (신규 / 수정 분기) ──
function submitForm() {
    const type = form.value.type.trim()
    const name = form.value.name.trim()
    if (!type) return showAppAlert('대주제를 입력해줘!')
    if (!name) return showAppAlert('소주제(사역 이름)를 입력해줘!')

    const data = {
        type,
        name,
        color: form.value.color,
        isActivity: form.value.isActivity,
        activityCategory: form.value.isActivity ? form.value.activityCategory : null,
    }

    if (editingId.value) {
        // 수정
        callApi('/api/manage-ministry-categories', {
            action: 'update', categoryId: editingId.value, data,
        }, (r) => {
            if (!r?.success) {
                showAppAlert('⛔ 수정 실패: ' + (r?.message || '알 수 없는 에러'))
                return
            }
            showAppAlert(r.message || '수정 완료!', () => {
                resetForm()
                load()
            })
        })
    } else {
        // 신규
        callApi('/api/manage-ministry-categories', {
            action: 'add', team: targetTeam.value, data: { ...data, order: list.value.length },
        }, (r) => {
            if (!r?.success) {
                showAppAlert('⛔ 추가 실패: ' + (r?.message || '알 수 없는 에러'))
                return
            }
            showAppAlert(r.message || '블록이 추가됐어!', () => {
                resetForm()
                load()
            })
        })
    }
}

// ── 삭제 ──
function deleteCategory(id) {
    showAppConfirm('이 사역 블록을 삭제할까? (기존에 작성된 계획이 지워지진 않아)', (yes) => {
        if (!yes) return
        callApi('/api/manage-ministry-categories', {
            action: 'delete', categoryId: id,
        }, (r) => {
            if (!r?.success) {
                showAppAlert('⛔ 삭제 실패: ' + (r?.message || '알 수 없는 에러'))
                return
            }
            if (editingId.value === id) resetForm()
            load()
        })
    })
}

onMounted(load)
</script>

<template>
    <Teleport to="body">
        <div class="modal-overlay" @click.self="emit('close')">
            <div class="modal-card" style="height:85vh; padding:0;">
                <div class="modal-header-sticky">
                    <div class="modal-title" style="margin:0;">🎨 사역 블록 설정</div>
                    <span class="modal-close-sticky" @click="emit('close')">×</span>
                </div>

                <div class="modal-content-scroll" style="padding:20px;">
                    <div class="mc-team-info">
                        <b>{{ targetTeam }}</b> 지역 · ☰ 끌어서 순서 변경 (자동 저장), ✏️ 로 수정
                    </div>

                    <!-- Loading / Error -->
                    <div v-if="loading" style="text-align:center; padding:30px; color:#888;">불러오는 중... ⏳</div>
                    <div v-else-if="errorMsg" style="text-align:center; padding:20px; color:red;">{{ errorMsg }}</div>

                    <!-- List: vuedraggable + 직전 item 과 type 다르면 헤더 노출. 드롭 시 saveOrder 자동 호출 -->
                    <div v-else class="mc-list">
                        <div v-if="list.length === 0" style="text-align:center; color:#888; padding:20px;">
                            생성된 사역 블록이 없어!
                        </div>
                        <draggable
                            v-model="list"
                            item-key="id"
                            handle=".mc-drag-handle"
                            :animation="180"
                            ghost-class="mc-ghost"
                            chosen-class="mc-chosen"
                            drag-class="mc-dragging"
                            @end="onDragEnd"
                        >
                            <template #item="{ element: cat, index }">
                                <div class="mc-item">
                                    <div v-if="shouldShowHeader(index)" class="mc-group-header">{{ cat.type }}</div>
                                    <div
                                        class="mc-row"
                                        :class="{ editing: editingId === cat.id }"
                                    >
                                        <button class="mc-drag-handle" aria-label="순서 변경 핸들">☰</button>
                                        <span class="mc-dot" :style="{ background: cat.color }"></span>
                                        <div class="mc-info">
                                            <div class="mc-name">{{ cat.name }}</div>
                                            <div class="mc-badges">
                                                <span :class="['mc-badge', cat.isActivity ? 'act' : 'daily']">
                                                    {{ cat.isActivity ? '활동' : '일상' }}
                                                </span>
                                                <span
                                                    v-if="cat.isActivity && cat.activityCategory"
                                                    class="mc-badge cat"
                                                >{{ activityCatLabel(cat.activityCategory) }}</span>
                                                <span
                                                    v-else-if="cat.isActivity && !cat.activityCategory"
                                                    class="mc-badge cat-warn"
                                                >⚠️ 분류 없음</span>
                                            </div>
                                        </div>
                                        <button class="mc-btn-edit" @click="startEdit(cat)">✏️</button>
                                        <button class="mc-btn-delete" @click="deleteCategory(cat.id)">🗑</button>
                                    </div>
                                </div>
                            </template>
                        </draggable>
                    </div>

                    <!-- 신규/수정 폼 -->
                    <div class="mc-form-area">
                        <div class="mc-form-title">
                            <template v-if="editingId">✏️ 블록 수정</template>
                            <template v-else>🎨 새 블록 추가</template>
                        </div>

                        <label class="mc-label">대주제 (예: 온라인, 오프라인, 일상)</label>
                        <input v-model="form.type" type="text" class="input-card mc-input" placeholder="대주제 입력" />

                        <label class="mc-label">소주제 (예: 인스타디엠, 식사)</label>
                        <input v-model="form.name" type="text" class="input-card mc-input" placeholder="소주제 입력" />

                        <label class="mc-label">블록 색상</label>
                        <div class="mc-color-palette">
                            <div
                                v-for="c in COLOR_PALETTE"
                                :key="c"
                                class="mc-color-btn"
                                :class="{ active: form.color === c }"
                                :style="{ background: c }"
                                @click="form.color = c"
                            ></div>
                        </div>

                        <label class="mc-checkbox-row">
                            <input v-model="form.isActivity" type="checkbox" class="mc-checkbox" />
                            ✅ '총 활동 시간(통계)'에 포함 (체크 해제 = 일상)
                        </label>

                        <div v-if="form.isActivity" class="mc-activity-wrap">
                            <label class="mc-label">활동 카테고리 분류</label>
                            <div class="input-card" style="margin-top:5px;">
                                <select v-model="form.activityCategory" class="mc-activity-select">
                                    <option v-for="opt in ACTIVITY_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                                </select>
                            </div>
                        </div>

                        <div class="mc-form-buttons">
                            <button class="btn-pos mc-submit-btn" @click="submitForm">
                                {{ editingId ? '수정하기' : '블록 만들기' }}
                            </button>
                            <button v-if="editingId" class="btn-neg" @click="cancelEdit">취소</button>
                        </div>
                    </div>

                    <div class="btn-group" style="margin-top:15px;">
                        <button class="btn-neg" @click="emit('close')">뒤로가기</button>
                    </div>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
.mc-team-info {
    font-size: 12px;
    color: #666;
    text-align: center;
    margin-bottom: 12px;
}

.mc-list {
    margin-bottom: 15px;
    padding: 2px;
}
.mc-group {
    margin-bottom: 10px;
}
.mc-group-header {
    font-size: 13px;
    font-weight: bold;
    color: #888;
    padding: 6px 6px 4px;
    margin-bottom: 3px;
    border-bottom: 1px solid #eee;
    text-align: left;
}
.mc-row {
    background: #fff;
    padding: 8px 10px;
    border-radius: 7px;
    margin-bottom: 5px;
    box-shadow: 0 1px 2px rgba(0,0,0,0.06);
    display: grid;
    grid-template-columns: auto auto 1fr 40px 40px;
    align-items: center;
    gap: 8px;
    transition: 0.15s;
    min-height: 44px;
}
.mc-row.editing {
    box-shadow: 0 0 0 2px #FF9800;
    background: #FFF8E1;
}
.mc-dot {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    box-shadow: inset 0 0 0 1px rgba(0,0,0,0.1);
}
.mc-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    text-align: left;
}
.mc-name {
    font-weight: bold;
    font-size: 16px;
    color: #333;
    word-break: break-all;
    line-height: 1.25;
}
.mc-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
}
.mc-badge {
    padding: 2px 7px;
    border-radius: 5px;
    font-size: 12px;
    font-weight: normal;
    white-space: nowrap;
}
.mc-badge.act { background: #E3F2FD; color: #1565C0; }
.mc-badge.daily { background: #EEEEEE; color: #757575; }
.mc-badge.cat { background: #FFF3E0; color: #E65100; }
.mc-badge.cat-warn { background: #FFEBEE; color: #C62828; }
.mc-drag-handle {
    background: none;
    border: none;
    color: #bbb;
    font-size: 18px;
    padding: 4px 2px;
    cursor: grab;
    font-family: inherit;
    line-height: 1;
    touch-action: none;
    user-select: none;
    transition: color 0.15s;
}
.mc-drag-handle:hover { color: #666; }
.mc-drag-handle:active { cursor: grabbing; color: #333; }

/* SortableJS classes — 드래그 중 시각 피드백 */
.mc-ghost {
    opacity: 0.4;
}
.mc-ghost .mc-row {
    background: #FFF8E1;
    box-shadow: 0 0 0 2px #FF9800;
}
.mc-chosen .mc-row {
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}
.mc-dragging {
    cursor: grabbing;
}
.mc-dragging .mc-row {
    transform: rotate(-1deg);
}
.mc-item { /* draggable 가 #item slot 을 감싸는 wrapper */ }
.mc-btn-edit, .mc-btn-delete {
    border: none;
    border-radius: 6px;
    padding: 6px 10px;
    cursor: pointer;
    font-size: 16px;
    font-family: inherit;
    transition: 0.15s;
    flex-shrink: 0;
}
.mc-btn-edit {
    background: #f5f5f5;
    color: #555;
}
.mc-btn-edit:hover { background: #FFE0B2; }
.mc-btn-delete {
    background: #F44336;
    color: white;
}
.mc-btn-delete:hover { background: #D32F2F; }

.mc-form-area {
    background: #FAFAFA;
    padding: 15px;
    border-radius: 10px;
    border: 1px solid #eee;
    text-align: left;
}
.mc-form-title {
    font-size: 14px;
    font-weight: bold;
    color: #5D4037;
    margin-bottom: 12px;
}
.mc-label {
    font-size: 12px;
    color: #666;
    display: block;
    margin-bottom: 4px;
}
.mc-input {
    margin-top: 0;
    margin-bottom: 10px;
}
.mc-color-palette {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 15px;
    justify-content: center;
}
.mc-color-btn {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    cursor: pointer;
    transition: 0.15s;
    border: 2px solid transparent;
}
.mc-color-btn.active {
    border: 3px solid #333;
    transform: scale(1.15);
}
.mc-checkbox-row {
    display: flex;
    align-items: center;
    cursor: pointer;
    font-size: 13px;
    color: #333;
    margin-bottom: 10px;
}
.mc-checkbox {
    width: 18px;
    height: 18px;
    margin: 0 8px 0 0;
}
.mc-activity-wrap {
    margin-bottom: 12px;
}
.mc-activity-select {
    width: 100%;
    padding: 10px;
    border: none;
    background: transparent;
    font-family: 'Jua';
    font-size: inherit;
    color: inherit;
}
.mc-form-buttons {
    display: flex;
    gap: 8px;
}
.mc-submit-btn {
    flex: 1;
    padding: 10px;
    border-radius: 8px;
}
</style>
