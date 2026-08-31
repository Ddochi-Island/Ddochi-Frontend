<script setup>
import { reactive, ref, onMounted, nextTick } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { usePopup } from '@/composables/usePopup'
import { useFormatters } from '@/composables/useFormatters'

// CenterScreen 의 양육일지 상세/수정 팝업.
// legacy: openNurtureLogDetail / __submitNurtureLogUpdate / __copyNurtureLog 정합.

const props = defineProps({
    item: { type: Object, required: true },
    logIdx: { type: Number, required: true },
})

const emit = defineEmits(['close', 'submit'])

const auth = useAuthStore()
const { showAppConfirm, showToast } = usePopup()
const { autoResize } = useFormatters()

const log = props.item.nurtureLogs?.[props.logIdx] || {}

const form = reactive({
    date: log.date || '',
    round: log.round || '',
    method: log.method || '',
    title: log.title || '',
    reaction: log.reaction || '',
    reflection: log.reflection || '',
})

const reactionRef = ref(null)
const reflectionRef = ref(null)

onMounted(() => {
    nextTick(() => {
        if (reactionRef.value) autoResize(reactionRef.value)
        if (reflectionRef.value) autoResize(reflectionRef.value)
    })
})

function handleSubmit() {
    showAppConfirm('수정사항을 반영할까?', (yes) => {
        if (!yes) return
        const updatedLog = {
            ...log,
            date: form.date.trim(),
            round: form.round.trim(),
            method: form.method.trim(),
            title: form.title.trim(),
            reaction: form.reaction,
            reflection: form.reflection,
        }
        emit('submit', { docId: props.item.docId, logIndex: props.logIdx, updatedLog })
    })
}

function handleCopy() {
    const item = props.item
    const LEAF_TYPES = ['생노잎', '간증잎', '성구잎', '특강자', '타로잎', '인도잎', '기타잎']
    const teacher = (item.teacher || '').replace('(타지역)', '')
    const header = `${item.name}/${item.manager || '미정'}/${teacher}`

    let scheduleTxt = '미정'
    if (item.note && item.note.schedule) {
        const days = ['월', '화', '수', '목', '금', '토', '일']
        const sorted = Object.keys(item.note.schedule).sort((a, b) => days.indexOf(a) - days.indexOf(b))
        if (sorted.length > 0) scheduleTxt = sorted.map(d => `${d} ${item.note.schedule[d]}`).join(', ')
    }

    let leafContent = ''
    const leafMap = {}
    if (item.logs) {
        item.logs.split('\n').forEach(line => {
            const parts = line.split('|')
            if (parts.length >= 3) {
                const t = parts[1].trim()
                const c = parts[2].trim()
                if (LEAF_TYPES.includes(t) && !leafMap[t]) leafMap[t] = c
            }
        })
    }
    LEAF_TYPES.forEach(t => { if (leafMap[t]) leafContent += `- ${t}: ${leafMap[t]}\n` })
    if (!leafContent) leafContent = '기록 없음'

    let historyTxt = ''
    if (item.nurtureLogs?.length > 0) {
        item.nurtureLogs.forEach(l => { historyTxt += `${l.date}/${l.round}/${l.method}/${l.title}\n` })
    }

    const fullText = `${header}\n\n■ 복음방 고정 요일, 시간 : ${scheduleTxt}\n\n■ 잎사귀\n${leafContent.trim()}\n\n■ 수업일/회차/대면or줌/제목(누적)\n${historyTxt.trim()}\n\n■ 수강생 반응(구체적, 워딩 그대로)\n${form.reaction}\n\n■ 수업 느낀점\n${form.reflection}`
    navigator.clipboard.writeText(fullText).then(() => showToast('복사 완료!'))
}

function onTextareaInput(event) {
    autoResize(event.target)
}
</script>

<template>
    <Teleport to="body">
        <div class="modal-overlay" @click.self="emit('close')">
            <div class="modal-card" style="height:80vh; padding:0;">
                <div class="modal-header-sticky">
                    <div class="copy-btn" style="position:static; margin:0;" @click="handleCopy">복사하기</div>
                    <span class="modal-close-sticky" @click="emit('close')">X</span>
                </div>
                <div class="modal-content-scroll">
                    <div class="modal-title" style="margin-top:0;">일지 상세</div>
                    <div class="report-header-grid">
                        <input v-model="form.date" type="text" class="report-input" style="text-align:center;" />
                        <input v-model="form.round" type="text" class="report-input" style="text-align:center;" />
                        <input v-model="form.method" type="text" class="report-input" style="text-align:center;" />
                    </div>
                    <span class="report-label">제목</span>
                    <input v-model="form.title" type="text" class="report-input" />
                    <span class="report-label">수강생 반응</span>
                    <textarea ref="reactionRef" v-model="form.reaction" class="report-textarea auto-resize-box" @input="onTextareaInput" />
                    <span class="report-label">수업 느낀점</span>
                    <textarea ref="reflectionRef" v-model="form.reflection" class="report-textarea auto-resize-box" @input="onTextareaInput" />
                    <div class="btn-group">
                        <button class="btn-pos" @click="handleSubmit">수정하기</button>
                    </div>
                </div>
            </div>
        </div>
    </Teleport>
</template>
