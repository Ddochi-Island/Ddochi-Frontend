<script setup>
import { computed, ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { usePopup } from '@/composables/usePopup'
import { useFormatters } from '@/composables/useFormatters'
import { useApi } from '@/composables/useApi'
import { hjFields } from '@/constants'

// CenterScreen 의 합재양 read-only 상세 팝업.
// legacy: viewHabjaeyangPopupForCenter / __copyHabjaeyang 정합.

const props = defineProps({
    item: { type: Object, required: true },
    readonly: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'back', 'fieldSaved'])

const auth = useAuthStore()
const { showToast, showAppAlert, showPopup } = usePopup()
const { getDay } = useFormatters()
const { callApi } = useApi()

// 섭외경로/섭외도구 — 작성 폼(HabjaeyangScreen)과 같은 선택지
const pathOpts = ref([])
const toolOpts = ref([])
const route = ref(props.item.habjaeyang?.route || '')
const tool = ref(props.item.habjaeyang?.tool || '')
onMounted(() => {
    if (props.readonly) return
    callApi('/api/get-path-configs', {}, res => { if (res?.list) pathOpts.value = res.list.map(p => p.pathName) })
    callApi('/api/get-tool-configs', {}, res => { if (res?.list) toolOpts.value = res.list.map(t => t.toolName) })
})
function onSelect(type, e) {
    const target = type === 'path' ? route : tool
    const prev = target.value
    target.value = e.target.value
    callApi('/api/edit-match', { sabun: auth.currentSabun, rowIndex: props.item.docId, type, value: target.value }, (res) => {
        if (!res?.success) { target.value = prev; return showAppAlert(res?.message || '저장 실패') }
        showToast('저장 완료!')
        emit('fieldSaved')
    })
}
// 선택지 목록에 없는 기존 값(구 경로명 등)도 select에 보이게
const pathChoices = computed(() => route.value && !pathOpts.value.includes(route.value) ? [route.value, ...pathOpts.value] : pathOpts.value)
const toolChoices = computed(() => tool.value && !toolOpts.value.includes(tool.value) ? [tool.value, ...toolOpts.value] : toolOpts.value)

// 라벨은 합재양 작성 폼(hjFields)과 같은 걸 씀
const LABEL = Object.fromEntries(hjFields.map(f => [f.id, f.label]))
const MULTILINE = new Set(['sch', 'schedule', 'plan', 'purpose', 'selfImage', 'trouble', 'att', 'wary', 'dist', 'etc', 'job'])

function editHjField(apiKey, label, currentVal) {
    if (props.readonly) return
    showPopup('text', label, label + ' 입력', ({ text }) => {
        if (text === currentVal) return
        const hjData = { ...(props.item.habjaeyang || {}), [apiKey]: text, _changedField: label }
        callApi('/api/update-match', {
            sabun: auth.currentSabun,
            rowIndex: props.item.docId,
            type: 'habjaeyang',
            data: hjData,
        }, (res) => {
            if (!res?.success) return showAppAlert(res?.message || '저장 실패')
            showToast('저장 완료!')
            emit('fieldSaved')
        })
    }, { value: currentVal, multiline: MULTILINE.has(apiKey) })
}

function editProspectField(type, label, currentVal) {
    if (props.readonly) return
    showPopup('text', label, label + ' 입력', ({ text }) => {
        if (text === currentVal) return
        const apiValue = type === 'subGuide' ? text + ',' : text
        callApi('/api/edit-match', {
            sabun: auth.currentSabun,
            rowIndex: props.item.docId,
            type,
            value: apiValue,
        }, (res) => {
            if (!res?.success) return showAppAlert(res?.message || '저장 실패')
            showToast('저장 완료!')
            emit('fieldSaved')
        })
    }, { value: currentVal })
}

// TM 노트 (scrapMemo) — 합재양 작성자가 별도로 적어두는 메모. 있을 때만 헤더에 버튼 노출.
// legacy f80d438 정합. 본 popup 은 read-only 라 alert 형태로 별도 표시.
const tmNoteText = computed(() => {
    const m = (props.item.note && props.item.note.scrapMemo) || ''
    return String(m).trim()
})
const hasTmNote = computed(() => !!tmNoteText.value)

function showTmNote() {
    if (!hasTmNote.value) return
    const escaped = tmNoteText.value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
    showAppAlert(`<div style="white-space:pre-wrap; word-break:break-word; text-align:left; font-size:14px; line-height:1.7; color:#333;">📝 ${escaped}</div>`)
}

const safeData = computed(() => {
    const item = props.item
    const hj = item.habjaeyang || {}
    const note = item.note || {}
    return {
        guide: hj.guide || note.guide || item.manager,
        tmName: hj.tmName || note.tmName,
        subName: hj.subName || note.subName || item.name,
        gender: hj.gender || note.gender || item.gender,
        age: hj.age || note.age || item.age,
        mbti: hj.mbti || note.mbti,
        contact: hj.contact || note.contact || item.phone,
        nearSt: hj.nearSt || note.nearSt || item.residence,
        job: hj.job || note.job,
        sch: hj.sch || note.sch,
        plan: hj.plan || note.plan,
        purpose: hj.purpose || note.purpose,
        selfImage: hj.selfImage || note.selfImage,
        trouble: hj.trouble || note.trouble,
        att: hj.att || note.att,
        wary: hj.wary || note.wary,
        dist: hj.dist || note.dist,
        etc: hj.etc || note.etc,
        mtDate: hj.mtDate, mtTime: hj.mtTime, mtPlace: hj.mtPlace,
    }
})

const matchDateFull = computed(() => {
    const s = safeData.value
    if (!s.mtDate) return '미정'
    const d = new Date(s.mtDate)
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${mm}/${dd}(${getDay(s.mtDate)}) ${s.mtTime || ''} ${s.mtPlace || ''}`
})



const matchTime = computed(() => (props.item.habjaeyang && props.item.habjaeyang.pixTs) || '-')

function handleCopy() {
    const safe = safeData.value
    const item = props.item
    const teamName = auth.currentUserTeam || ''
    const pathInfo = (route.value || '-') + (tool.value && !route.value.includes(tool.value) ? `(${tool.value})` : '')
    const dayStr = safe.mtDate && safe.mtDate !== '미정' ? getDay(safe.mtDate) : ''
    const txt = `🐑 대학 ${teamName}의 합재양 🐑\n\n🚿인도자 : ${safe.guide || '-'}\n🚿티엠자 : ${safe.tmName || '-'}\n🚿섭외경로(도구) : ${pathInfo}\n🚿매칭 일시/장소 : ${safe.mtDate || '-'}(${dayStr}) ${safe.mtTime || ''} ${safe.mtPlace || ''}\n\n🫧인적\n• 이름(성별/나이) : ${safe.subName || '-'}(${safe.gender || '-'}/${safe.age || '-'})\n• 연락처 : ${safe.contact || '-'}\n• 거주지 : ${safe.nearSt || '-'}\n• MBTI : ${safe.mbti || '-'}\n\n🫧환경\n• 학교(전공)/직장 : ${safe.job || '-'}\n• 일정(학원,동아리,학생회,알바 등) : ${safe.sch || '-'}\n• 1년 환경 구체적으로 : ${safe.plan || '-'}\n\n🫧내면\n• 신청 목적 (메리트) : ${safe.purpose || '-'}\n• 나의 이미지(성격) : ${safe.selfImage || '-'}\n• 되고 싶은 내적 이미지(or 가장 고민되는 부분) : ${safe.trouble || '-'}\n\n• 인성(전화 태도) : ${safe.att || '-'}\n• 경계 : ${safe.wary || '-'}\n• 거리부담 : ${safe.dist || '-'}\n• 특이사항 : ${safe.etc || '-'}`
    navigator.clipboard.writeText(txt).then(() => showToast('복사 완료!'))
}
</script>

<template>
    <Teleport to="body">
        <div class="modal-overlay" @click.self="emit('close')">
            <div class="modal-card" style="height:80vh; padding:0;">
                <div class="modal-header-sticky">
                    <div style="display:flex; gap:6px; align-items:center;">
                        <div class="copy-btn" style="position:static; margin:0;" @click="handleCopy">복사하기</div>
                        <button v-if="hasTmNote" class="tm-note-btn" @click="showTmNote">📝 TM노트</button>
                    </div>
                    <span class="modal-close-sticky" @click="emit('close')">X</span>
                </div>
                <div class="modal-content-scroll">
                    <div class="modal-title" style="margin-top:0;">합재양 상세</div>
                    <div class="hj-modal-content" :class="{ 'hj-readonly': readonly }">
                        <div class="hj-sec-title">📋 매칭 정보</div>
                        <div class="hj-section hj-stack">
                            <div class="hj-row"><span class="hj-label">인도자</span><div class="hj-val hj-editable" @click="editHjField('guide', '인도자', safeData.guide)">{{ safeData.guide || '-' }}</div></div>
                            <div class="hj-row"><span class="hj-label">티엠자</span><div class="hj-val hj-editable" @click="editHjField('tmName', '티엠자', safeData.tmName)">{{ safeData.tmName || '-' }}</div></div>
                            <div class="hj-row"><span class="hj-label">섭외경로</span>
                                <span v-if="readonly" class="hj-val">{{ route || '-' }}</span>
                                <select v-else class="hj-select" :value="route" @change="onSelect('path', $event)">
                                    <option value="">선택 안 함</option>
                                    <option v-for="opt in pathChoices" :key="opt" :value="opt">{{ opt }}</option>
                                </select></div>
                            <div class="hj-row"><span class="hj-label">섭외도구</span>
                                <span v-if="readonly" class="hj-val">{{ tool || '-' }}</span>
                                <select v-else class="hj-select" :value="tool" @change="onSelect('tool', $event)">
                                    <option value="">선택 안 함</option>
                                    <option v-for="opt in toolChoices" :key="opt" :value="opt">{{ opt }}</option>
                                </select></div>
                            <div class="hj-row"><span class="hj-label">만픽시간</span><span class="hj-val" style="cursor:default;">{{ matchTime }}</span></div>
                        </div>
                        <div class="hj-blue-box">매칭 {{ matchDateFull }}</div>
                        <div class="hj-sec-title">👤 섭외자</div>
                        <div class="hj-section hj-stack">
                            <div class="hj-row"><span class="hj-label">이름</span><div class="hj-val hj-editable" @click="editProspectField('subGuide', '섭외자 이름', safeData.subName)">{{ safeData.subName || '-' }}</div></div>
                            <div class="hj-row"><span class="hj-label">성별</span><div class="hj-val hj-editable" @click="editProspectField('gender', '성별 (남/여)', safeData.gender)">{{ safeData.gender || '-' }}</div></div>
                            <div class="hj-row"><span class="hj-label">나이</span><div class="hj-val hj-editable" @click="editProspectField('age', '나이', safeData.age)">{{ safeData.age || '-' }}</div></div>
                            <div class="hj-row"><span class="hj-label">연락처</span><div class="hj-val hj-editable" @click="editProspectField('phone', '연락처', safeData.contact)">{{ safeData.contact || '-' }}</div></div>
                            <div class="hj-row"><span class="hj-label">{{ LABEL.nearSt }}</span><div class="hj-val hj-editable" @click="editProspectField('residence', LABEL.nearSt, safeData.nearSt)">{{ safeData.nearSt || '-' }}</div></div>
                            <div class="hj-row"><span class="hj-label">MBTI</span><div class="hj-val hj-editable" @click="editHjField('mbti', 'MBTI', safeData.mbti)">{{ safeData.mbti || '-' }}</div></div>
                            <div class="hj-row"><span class="hj-label">{{ LABEL.job }}</span><div class="hj-val hj-editable" @click="editHjField('job', LABEL.job, safeData.job)">{{ safeData.job || '-' }}</div></div>
                        </div>
                        <div class="hj-sec-title">💭 내면 파악</div>
                        <div class="hj-section hj-stack">
                            <div class="hj-row"><span class="hj-label">{{ LABEL.sch }}</span><div class="hj-val hj-editable" @click="editHjField('schedule', LABEL.sch, safeData.sch)">{{ safeData.sch || '-' }}</div></div>
                            <div class="hj-row"><span class="hj-label">{{ LABEL.plan }}</span><div class="hj-val hj-editable" @click="editHjField('plan', LABEL.plan, safeData.plan)">{{ safeData.plan || '-' }}</div></div>
                            <div class="hj-row"><span class="hj-label">{{ LABEL.purpose }}</span><div class="hj-val hj-editable" @click="editHjField('purpose', LABEL.purpose, safeData.purpose)">{{ safeData.purpose || '-' }}</div></div>
                            <div class="hj-row"><span class="hj-label">{{ LABEL.selfImage }}</span><div class="hj-val hj-editable" @click="editHjField('selfImage', LABEL.selfImage, safeData.selfImage)">{{ safeData.selfImage || '-' }}</div></div>
                            <div class="hj-row"><span class="hj-label">{{ LABEL.trouble }}</span><div class="hj-val hj-editable" @click="editHjField('trouble', LABEL.trouble, safeData.trouble)">{{ safeData.trouble || '-' }}</div></div>
                        </div>
                        <div class="hj-sec-title">📝 태도 &amp; 기타</div>
                        <div class="hj-section hj-stack" style="margin-bottom:20px;">
                            <div class="hj-row"><span class="hj-label">{{ LABEL.att }}</span><div class="hj-val hj-editable" @click="editHjField('att', LABEL.att, safeData.att)">{{ safeData.att || '-' }}</div></div>
                            <div class="hj-row"><span class="hj-label">{{ LABEL.wary }}</span><div class="hj-val hj-editable" @click="editHjField('wary', LABEL.wary, safeData.wary)">{{ safeData.wary || '-' }}</div></div>
                            <div class="hj-row"><span class="hj-label">{{ LABEL.dist }}</span><div class="hj-val hj-editable" @click="editHjField('dist', LABEL.dist, safeData.dist)">{{ safeData.dist || '-' }}</div></div>
                            <div class="hj-row"><span class="hj-label">{{ LABEL.etc }}</span><div class="hj-val hj-editable" @click="editHjField('etc', LABEL.etc, safeData.etc)">{{ safeData.etc || '-' }}</div></div>
                        </div>
                    </div>
                    <div class="btn-group"><button class="btn-neg" @click="emit('back')">뒤로가기</button></div>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
.hj-sec-title {
    margin: 14px 0 6px;
    font-family: 'Jua';
    font-size: 14px;
    color: #5D4037;
}
/* 서술형 값은 줄바꿈 그대로 보이게 */
.hj-val {
    white-space: pre-wrap;
    word-break: break-word;
    line-height: 1.55;
}
/* 긴 라벨(작성 폼과 같은 문구)은 값 위에 따로 한 줄로 */
.hj-stack .hj-row {
    flex-direction: column;
    align-items: stretch;
    gap: 4px;
}
.hj-stack .hj-label {
    width: auto;
    min-width: 0;
}
.hj-stack .hj-val {
    text-align: left;
    font-weight: normal;
    background: #FAFAF7;
    border: 1px solid #EEE;
    border-radius: 8px;
    padding: 8px 10px;
}
.hj-select {
    width: 100%;
    padding: 8px 10px;
    border: 1px solid #EEE;
    border-radius: 8px;
    background: #FAFAF7;
    font-size: 14px;
    color: #333;
}
.hj-editable {
    cursor: pointer;
    border-bottom: 1px dotted #eee;
}
.hj-editable:active {
    background: #FFF8E1;
}
.hj-readonly .hj-editable {
    cursor: default;
    border-bottom: none;
}
.hj-readonly .hj-editable:active {
    background: none;
}
.tm-note-btn {
    font-size: 11px;
    padding: 5px 10px;
    background: #FFF8E1;
    border: 1px solid #FFCA28;
    border-radius: 16px;
    color: #5D4037;
    cursor: pointer;
    white-space: nowrap;
    font-family: 'Jua';
}
</style>
