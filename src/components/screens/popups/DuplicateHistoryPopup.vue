<script setup>
import { ref } from 'vue'
import { usePopup } from '@/composables/usePopup'
import HabjaeyangViewPopup from './HabjaeyangViewPopup.vue'

// 합재양 제출 시 동일 전화번호(숫자만 비교) 중복 섭외 이력을 보여주는 팝업.
// V3.20: 저장은 이미 끝난 상태(백엔드가 IS_DROPPED=1/중복섭외로 잠정 저장)에서 사용자가
// 최종 처리를 고르는 화면 — [X] 닫기(되돌리기) / 중섭 반려처리 / 그래도 제출 세 갈래.
// 각 이력 카드엔 "진행 히스토리"(2차만남/밀림/상담따기/비합 등) 타임라인이 같이 뜬다.

const props = defineProps({
    list: { type: Array, required: true },
    showProceed: { type: Boolean, default: true },
})

const emit = defineEmits(['close', 'reject', 'proceed'])
const { showToast } = usePopup()

const viewIdx = ref(null)

const RESULT_ICON = [
    { m: '상담따기', icon: '🟣' },
    { m: '2차', icon: '🔵' },
    { m: '밀림', icon: '🟠' },
    { m: '비합', icon: '⚫' },
    { m: '정신질환', icon: '⚫' },
    { m: '중복섭외', icon: '⚫' },
    { m: '취소', icon: '⚫' },
    { m: '탈락', icon: '⚫' },
]
function historyIcon(content) {
    const hit = RESULT_ICON.find((r) => (content || '').includes(r.m))
    return hit ? hit.icon : '⚪'
}

function buildCopyText() {
    const lines = []
    props.list.forEach((item, idx) => {
        if (idx > 0) lines.push('')
        lines.push(`■ ${item.name} (${item.date})`)
        lines.push(`인도자: ${item.manager || '-'} / 교사: ${item.teacher || '-'} / 결과: ${item.result || '-'}`)
        if (item.history && item.history.length > 0) {
            lines.push('진행 히스토리:')
            item.history.forEach((h) => {
                const range = h.dateRange ? ` (${h.dateRange})` : ''
                lines.push(`  ${h.at} ${historyIcon(h.content)} ${h.content}${range} · ${h.actor}`)
            })
        }
    })
    return lines.join('\n')
}

async function copyHistory() {
    const text = buildCopyText()
    try {
        await navigator.clipboard.writeText(text)
        showToast('복사했어요! 📋')
    } catch (_) {
        showToast('복사 실패 — 브라우저 권한을 확인해줘')
    }
}
</script>

<template>
    <Teleport to="body">
        <div class="modal-overlay">
            <div class="modal-card" style="max-height:80vh; padding:0;">
                <div class="modal-header-sticky">
                    <span class="dup-header-title">⚠️ 중복 섭외 이력</span>
                    <div class="dup-header-actions">
                        <button class="dup-copy-btn" @click="copyHistory">📋 복사</button>
                        <span class="modal-close-sticky" @click="emit('close')">X</span>
                    </div>
                </div>
                <div class="modal-content-scroll">
                    <p class="dup-desc">해당 섭외자는 이전에 섭외된 이력이 있어요. 아래 이력을 확인해줘.</p>

                    <div v-for="(item, idx) in props.list" :key="item.docId" class="dup-row">
                        <div class="dup-date">{{ item.date }}</div>
                        <div class="dup-fields">
                            <div><span class="dup-label">인도자</span>{{ item.manager || '-' }}</div>
                            <div><span class="dup-label">교사</span>{{ item.teacher || '-' }}</div>
                            <div><span class="dup-label">최종 매칭결과</span>{{ item.result || '-' }}</div>
                        </div>
                        <button class="dup-view-btn" @click="viewIdx = idx">합재양 보기</button>

                        <div v-if="item.history && item.history.length > 0" class="dup-history">
                            <div class="dup-history-title">진행 히스토리</div>
                            <div v-for="(h, hi) in item.history" :key="hi" class="dup-history-row">
                                <span class="dup-history-at">{{ h.at }}</span>
                                <span class="dup-history-icon">{{ historyIcon(h.content) }}</span>
                                <span class="dup-history-content">{{ h.content }}<span v-if="h.dateRange" class="dup-history-range"> ({{ h.dateRange }})</span></span>
                                <span class="dup-history-actor">· {{ h.actor }}</span>
                            </div>
                        </div>
                    </div>

                    <div class="btn-group">
                        <button class="btn-neg" @click="emit('reject')">반려처리</button>
                        <button v-if="props.showProceed" class="btn" @click="emit('proceed')">그래도 제출</button>
                    </div>
                </div>
            </div>
        </div>

        <HabjaeyangViewPopup
            v-if="viewIdx !== null"
            :item="props.list[viewIdx]"
            :readonly="true"
            @back="viewIdx = null"
            @close="viewIdx = null"
        />
    </Teleport>
</template>

<style scoped>
.dup-header-title {
    font-weight: bold;
    font-size: 15px;
}
.dup-header-actions {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 10px;
}
.dup-copy-btn {
    font-size: 12px;
    padding: 4px 10px;
    background: #FFF8E1;
    border: 1px solid #FFCA28;
    border-radius: 14px;
    color: #5D4037;
    cursor: pointer;
}
.dup-desc {
    font-size: 13px;
    color: #795548;
    margin: 0 0 12px;
}
.dup-row {
    border: 1px solid #EFEBE9;
    border-radius: 10px;
    padding: 10px 12px;
    margin-bottom: 10px;
}
.dup-date {
    font-size: 12px;
    color: #A1887F;
    margin-bottom: 6px;
}
.dup-fields {
    font-size: 13px;
    line-height: 1.7;
}
.dup-label {
    color: #8D6E63;
    font-weight: bold;
    margin-right: 6px;
}
.dup-view-btn {
    margin-top: 8px;
    font-size: 12px;
    padding: 5px 10px;
    background: #FFF8E1;
    border: 1px solid #FFCA28;
    border-radius: 16px;
    color: #5D4037;
    cursor: pointer;
}
.dup-history {
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px dashed #EFEBE9;
}
.dup-history-title {
    font-size: 11px;
    color: #A1887F;
    font-weight: bold;
    margin-bottom: 4px;
}
.dup-history-row {
    display: flex;
    align-items: baseline;
    gap: 6px;
    font-size: 12px;
    color: #5D4037;
    padding: 2px 0;
    flex-wrap: wrap;
}
.dup-history-at {
    font-family: monospace;
    font-size: 11px;
    color: #A1887F;
}
.dup-history-content {
    font-weight: bold;
}
.dup-history-range {
    font-weight: normal;
    color: #A1887F;
}
.dup-history-actor {
    color: #A1887F;
    margin-left: auto;
}
</style>
