// useTmNoteDraft — TM 노트 (스크랩 메모 + 선택된 글) localStorage 드래프트.
// V3 backend 에 메모 저장 endpoint 가 아직 없어 일단 클라이언트 로컬에 보존.

const KEY_PREFIX = 'ddochi_tm_note_'

function key(docId) { return `${KEY_PREFIX}${docId || 'unknown'}` }

export function loadTmNoteDraft(docId) {
    if (!docId) return {}
    try {
        const raw = localStorage.getItem(key(docId))
        if (!raw) return {}
        return JSON.parse(raw) || {}
    } catch (_) { return {} }
}

export function saveTmNoteDraft(docId, patch) {
    if (!docId) return
    try {
        const cur = loadTmNoteDraft(docId)
        localStorage.setItem(key(docId), JSON.stringify({ ...cur, ...patch }))
    } catch (_) { /* swallow */ }
}

export function clearTmNoteDraft(docId) {
    if (!docId) return
    try { localStorage.removeItem(key(docId)) } catch (_) { /* swallow */ }
}
