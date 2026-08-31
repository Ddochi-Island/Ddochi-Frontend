<script setup>
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { usePopup } from '@/composables/usePopup'
import { useFormatters } from '@/composables/useFormatters'
import { useApi } from '@/composables/useApi'

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
    }, { value: currentVal })
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
        trouble: hj.trouble || note.trouble,
        qna: hj.qna || note.qna,
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
    const pathInfo = (item.path || '') + (item.tool && !String(item.path || '').includes(item.tool) ? `(${item.tool})` : '')
    const dayStr = safe.mtDate && safe.mtDate !== '미정' ? getDay(safe.mtDate) : ''
    const txt = `🐑 대학 ${teamName}의 합재양 🐑\n\n🚿인도자 : ${safe.guide || '-'}\n🚿티엠자 : ${safe.tmName || '-'}\n🚿섭외경로(도구) : ${pathInfo}\n🚿매칭 일시/장소 : ${safe.mtDate || '-'}(${dayStr}) ${safe.mtTime || ''} ${safe.mtPlace || ''}\n\n🫧인적\n• 이름(성별/나이) : ${safe.subName || '-'}(${safe.gender || '-'}/${safe.age || '-'})\n• 연락처 : ${safe.contact || '-'}\n• 거주지 : ${safe.nearSt || '-'}\n• MBTI : ${safe.mbti || '-'}\n\n🫧환경\n• 학교(전공)/직장 : ${safe.job || '-'}\n• 일정(학원,동아리,학생회,알바 등) : ${safe.sch || '-'}\n• 향후 계획 : ${safe.plan || '-'}\n\n🫧내면\n• 신청 목적 (메리트) : ${safe.purpose || '-'}\n• 내적 고민(00%, 되고싶은 모습) : ${safe.trouble || '-'}\n\n• 내면질문(최대한 상세하게)\n${safe.qna || '-'}\n\n• 태도 : ${safe.att || '-'}\n• 경계 : ${safe.wary || '-'}\n• 거리부담 : ${safe.dist || '-'}\n• 특이사항 : ${safe.etc || '-'}`
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
                        <div class="hj-section" style="margin-top:10px;">
                            <div class="hj-row"><span class="hj-label">인도자</span><div class="hj-val hj-editable" @click="editHjField('guide', '인도자', safeData.guide)">{{ safeData.guide || '-' }}</div></div>
                            <div class="hj-row"><span class="hj-label">티엠자</span><div class="hj-val hj-editable" @click="editHjField('tmName', '티엠자', safeData.tmName)">{{ safeData.tmName || '-' }}</div></div>
                            <div class="hj-row"><span class="hj-label">섭외경로</span><span class="hj-val hj-editable" style="border:none;" @click="editProspectField('path', '섭외경로', item.path)">{{ item.path || '-' }}</span></div>
                            <div class="hj-row"><span class="hj-label">섭외도구</span><span class="hj-val hj-editable" style="border:none;" @click="editProspectField('tool', '섭외도구', item.tool)">{{ item.tool || '-' }}</span></div>
                            <div class="hj-row"><span class="hj-label">만픽시간</span><span class="hj-val" style="cursor:default;border:none;">{{ matchTime }}</span></div>
                        </div>
                        <div class="hj-blue-box">매칭 {{ matchDateFull }}</div>
                        <div class="hj-section">
                            <div class="hj-row"><span class="hj-label">이름</span><div class="hj-val hj-editable" @click="editProspectField('subGuide', '섭외자 이름', safeData.subName)">{{ safeData.subName || '-' }}</div></div>
                            <div class="hj-row"><span class="hj-label">성별</span><div class="hj-val hj-editable" @click="editProspectField('gender', '성별 (남/여)', safeData.gender)">{{ safeData.gender || '-' }}</div></div>
                            <div class="hj-row"><span class="hj-label">나이</span><div class="hj-val hj-editable" @click="editProspectField('age', '나이', safeData.age)">{{ safeData.age || '-' }}</div></div>
                            <div class="hj-row"><span class="hj-label">MBTI</span><div class="hj-val hj-editable" @click="editHjField('mbti', 'MBTI', safeData.mbti)">{{ safeData.mbti || '-' }}</div></div>
                            <div class="hj-row"><span class="hj-label">연락처</span><div class="hj-val hj-editable" @click="editProspectField('phone', '연락처', safeData.contact)">{{ safeData.contact || '-' }}</div></div>
                        </div>
                        <div class="hj-section">
                            <div class="hj-row"><span class="hj-label">거주지</span><div class="hj-val hj-editable" @click="editProspectField('residence', '거주지', safeData.nearSt)">{{ safeData.nearSt || '-' }}</div></div>
                            <div class="hj-row"><span class="hj-label">학교/직장</span><div class="hj-val hj-editable" @click="editHjField('job', '학교/직장', safeData.job)">{{ safeData.job || '-' }}</div></div>
                            <div class="hj-row"><span class="hj-label">일정</span><div class="hj-val hj-editable" @click="editHjField('schedule', '일정', safeData.sch)">{{ safeData.sch || '-' }}</div></div>
                            <div class="hj-row"><span class="hj-label">향후계획</span><div class="hj-val hj-editable" @click="editHjField('plan', '향후계획', safeData.plan)">{{ safeData.plan || '-' }}</div></div>
                        </div>
                        <div class="hj-section">
                            <div class="hj-row"><span class="hj-label">신청목적</span><div class="hj-val hj-editable" @click="editHjField('purpose', '신청목적', safeData.purpose)">{{ safeData.purpose || '-' }}</div></div>
                            <div class="hj-row"><span class="hj-label">내적고민</span><div class="hj-val hj-editable" @click="editHjField('trouble', '내적고민', safeData.trouble)">{{ safeData.trouble || '-' }}</div></div>
                            <div class="hj-row"><span class="hj-label">질문</span><div class="hj-val hj-editable" @click="editHjField('qna', '질문', safeData.qna)">{{ safeData.qna || '-' }}</div></div>
                        </div>
                        <div class="hj-section" style="margin-bottom:20px;">
                            <div class="hj-row"><span class="hj-label">태도</span><div class="hj-val hj-editable" @click="editHjField('att', '태도', safeData.att)">{{ safeData.att || '-' }}</div></div>
                            <div class="hj-row"><span class="hj-label">경계</span><div class="hj-val hj-editable" @click="editHjField('wary', '경계', safeData.wary)">{{ safeData.wary || '-' }}</div></div>
                            <div class="hj-row"><span class="hj-label">거리부담</span><div class="hj-val hj-editable" @click="editHjField('dist', '거리부담', safeData.dist)">{{ safeData.dist || '-' }}</div></div>
                            <div class="hj-row"><span class="hj-label">특이사항</span><div class="hj-val hj-editable" @click="editHjField('etc', '특이사항', safeData.etc)">{{ safeData.etc || '-' }}</div></div>
                        </div>
                    </div>
                    <div class="btn-group"><button class="btn-neg" @click="emit('back')">뒤로가기</button></div>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
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
