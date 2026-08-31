<script setup>
import { ref, reactive } from 'vue'
import { usePopup } from '@/composables/usePopup'

// CenterScreen 의 일정 설정 팝업 — 요일 클릭 → 시간 입력 sub-step.
// legacy: openSchedulePopup / renderSchedulePopupContent / __handleDayClick /
//         __confirmScheduleTime / __submitSchedule 정합.

const props = defineProps({
    item: { type: Object, required: true },
})

const emit = defineEmits(['close', 'submit'])

const { showAppAlert } = usePopup()

const DAYS = ['월', '화', '수', '목', '금', '토', '일']

// 초기값: item.note.schedule 복사 (drafft 는 이 컴포넌트 lifetime 동안만 유지 — legacy module-let 의 lifecycle 과 일치)
const rawSched = props.item?.note?.schedule
const initial = (rawSched && typeof rawSched === 'object') ? rawSched : {}
const tempSchedule = reactive({ ...initial })

// sub-step: 'main' | { kind: 'time', day }
const subStep = ref({ kind: 'main' })
const timeInput = ref('')

function handleDayClick(day) {
    if (tempSchedule[day]) {
        // 이미 설정된 요일 → 토글 off
        delete tempSchedule[day]
    } else {
        timeInput.value = ''
        subStep.value = { kind: 'time', day }
    }
}

function confirmTime() {
    if (!timeInput.value) {
        showAppAlert('시간을 입력해줘!')
        return
    }
    if (subStep.value.kind === 'time') {
        tempSchedule[subStep.value.day] = timeInput.value
    }
    subStep.value = { kind: 'main' }
}

function cancelTime() {
    subStep.value = { kind: 'main' }
}

function handleSubmit() {
    const original = (props.item && props.item.note && props.item.note.schedule) ? props.item.note.schedule : {}
    const sortObj = (obj) => JSON.stringify(Object.keys(obj).sort().reduce((r, k) => { r[k] = obj[k]; return r }, {}))

    // no change → just close
    if (sortObj(original) === sortObj(tempSchedule)) {
        emit('close')
        return
    }

    const selectedDays = Object.keys(tempSchedule)
    if (selectedDays.length === 0) {
        emit('submit', { docId: props.item.docId, summary: '미정', details: {}, isClear: true })
        return
    }
    const sortedDays = selectedDays.sort((a, b) => DAYS.indexOf(a) - DAYS.indexOf(b))
    const summary = sortedDays.join('')
    emit('submit', {
        docId: props.item.docId,
        summary,
        details: { ...tempSchedule },
        isClear: false,
    })
}
</script>

<template>
    <Teleport to="body">
        <div class="modal-overlay" @click.self="emit('close')">
            <div class="modal-card">
                <span class="modal-close" @click="emit('close')">&times;</span>

                <template v-if="subStep.kind === 'main'">
                    <div class="modal-title">📅 일정 설정</div>
                    <div class="modal-desc">요일을 눌러 시간을 입력해!</div>
                    <div class="sch-container">
                        <div
                            v-for="day in DAYS"
                            :key="day"
                            class="sch-row"
                            :class="{ active: !!tempSchedule[day] }"
                            @click="handleDayClick(day)"
                        >
                            <span class="sch-day-label">{{ day }}요일</span>
                            <span class="sch-time-val" :class="{ 'sch-time-empty': !tempSchedule[day] }">
                                {{ tempSchedule[day] || '터치하여 설정' }}
                            </span>
                        </div>
                    </div>
                    <div class="btn-group">
                        <button class="btn-pos" @click="handleSubmit">설정완료</button>
                    </div>
                </template>

                <template v-else>
                    <div class="modal-title">{{ subStep.day }}요일 시간 설정</div>
                    <div class="input-card">
                        <input
                            v-model="timeInput"
                            type="time"
                            class="popup-text-input"
                            style="text-align:center; font-size:20px;"
                        />
                    </div>
                    <div class="btn-group">
                        <button class="btn-pos" @click="confirmTime">입력</button>
                        <button class="btn-neg" @click="cancelTime">취소</button>
                    </div>
                </template>
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
.sch-container {
    display: flex;
    flex-direction: column;
    gap: 4px;
    text-align: left;
    margin-bottom: 12px;
}
.sch-row {
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
.sch-row:active {
    background: #f5f5f5;
}
.sch-row.active {
    border-color: var(--btn-color, #4CAF50);
}
.sch-day-label {
    font-weight: bold;
    font-size: 14px;
    color: #333;
    flex-shrink: 0;
}
.sch-time-val {
    font-size: 13px;
    color: #333;
    text-align: right;
    flex: 1;
    margin-left: 12px;
}
.sch-time-empty {
    color: #bbb;
}
</style>
