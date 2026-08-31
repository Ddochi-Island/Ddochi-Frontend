<script setup>
// CenterScreen 의 히스토리 로그 보기 팝업.
// legacy: showCenterLogs / formatLogsForCenter / __deleteCenterLog 정합.
// 로그 라인은 v-html 로 렌더 (TmAssetScreen.formatLogs 패턴) + data-action 위임 클릭.

const props = defineProps({
    // entries: [{id, source, text}] — id+source 는 삭제 시 서버가 정확한 원본 행을
    // 찾기 위한 안정적 키 (구 방식은 화면에 보이는 "몇 번째 줄"로 지웠는데,
    // PROSPECT_HISTORY 와 PROSPECT_TM_LOGS 를 합치는 순서가 조금만 달라도 엉뚱한 행이 지워졌다).
    entries: { type: Array, default: () => [] },
})

const emit = defineEmits(['close', 'delete'])

function formatLogsHtml(entries) {
    if (!entries || !entries.length) return '<div style="padding:10px;text-align:center;color:#aaa;">기록 없음</div>'
    let html = ''
    const cancelledCounts = new Map()
    entries.forEach(({ text: line }) => {
        const marker = '[취소됨]|'
        const markerIdx = line.indexOf(marker)
        if (markerIdx !== -1) {
            const original = line.substring(markerIdx + marker.length)
            cancelledCounts.set(original, (cancelledCounts.get(original) || 0) + 1)
        }
    })
    const hiddenCounts = new Map()

    entries.forEach((entry) => {
        const line = entry.text || ''
        if (!line.trim()) return
        if (line.includes('[취소됨]')) return
        const cancelCount = cancelledCounts.get(line) || 0
        if (cancelCount > 0) {
            const hidden = hiddenCounts.get(line) || 0
            if (hidden < cancelCount) { hiddenCounts.set(line, hidden + 1); return }
        }
        let cssClass = 'log-card'
        if (line.includes('[최초정보]')) cssClass += ' log-initial'
        const parts = line.split('|')
        const delBtn = `<span class="log-del-btn" data-action="deleteLog" data-log-id="${entry.id}" data-log-source="${entry.source}">[x]</span>`

        if (parts.length >= 3) {
            const dateRaw = parts[0].trim()
            const type = parts[1].trim()
            const content = parts[2].trim()
            const author = parts[3] ? parts[3].trim() : ''
            const shortDate = dateRaw.length > 3 ? dateRaw.substring(3) : dateRaw
            const authorHtml = author ? `<span style="font-size:10px; color:#888; margin-right:5px;">(${author})</span>` : ''
            html += `<div class="${cssClass}"><div class="log-header"><span>${shortDate}</span><span>${authorHtml}${delBtn}</span></div><div class="log-result">${type}</div><div class="log-content">${content}</div></div>`
        } else {
            html += `<div class="${cssClass}"><div class="log-content">${line} ${delBtn}</div></div>`
        }
    })
    return html
}

function handleClick(event) {
    const t = event.target
    if (t && t.dataset && t.dataset.action === 'deleteLog') {
        emit('delete', { id: t.dataset.logId, source: t.dataset.logSource })
    }
}
</script>

<template>
    <Teleport to="body">
        <div class="modal-overlay" @click.self="emit('close')">
            <div class="modal-card">
                <span class="modal-close" @click="emit('close')">&times;</span>
                <div class="modal-title">📝 히스토리</div>

                <div class="log-container" style="max-height:60vh;overflow-y:auto;" v-html="formatLogsHtml(entries)" @click="handleClick"></div>

                <div class="btn-group">
                    <button class="btn-pos" @click="emit('close')">닫기</button>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
:deep(.log-card) {
    background: white;
    border: 1px solid #eee;
    border-radius: 8px;
    padding: 10px;
    margin-bottom: 8px;
    font-family: 'Noto Sans KR', sans-serif;
    font-size: 13px;
    text-align: left;
}
:deep(.log-header) {
    display: flex;
    justify-content: space-between;
    color: #888;
    font-size: 11px;
    margin-bottom: 4px;
    align-items: center;
}
:deep(.log-result) {
    font-weight: bold;
    color: var(--btn-color);
    margin-bottom: 2px;
    text-align: left;
}
:deep(.log-content) {
    color: #333;
    line-height: 1.4;
    white-space: nowrap;
    overflow-x: auto;
    text-align: left;
}
:deep(.log-initial) {
    border-left: 3px solid var(--accent-color);
    background: #FFFDE7;
}
:deep(.log-del-btn) {
    color: #FF5252;
    cursor: pointer;
    font-size: 12px;
    margin-left: 5px;
    font-weight: bold;
}
</style>
