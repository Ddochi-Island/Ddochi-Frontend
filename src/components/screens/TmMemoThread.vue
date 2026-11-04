<script setup>
// 합당한자 통화 메모 — 댓글처럼 "날짜 시간 · 작성자 · 내용" 목록 + 입력창. 쓰다 만 글은 새로고침해도 남게 기기에 임시저장.
// 전도팀장 이하는 자기 메모만 수정·삭제(canManage면 남의 것도) — 서버도 같은 규칙으로 막음
import { ref, watch } from 'vue'

const props = defineProps({
  sarangId: { type: String, required: true },
  memos: { type: Array, default: () => [] },
  myId: { type: String, default: '' },
  canManage: { type: Boolean, default: false },
  api: { type: Function, required: true },  // callApiPromise(연습 모드면 가짜 API)
})
const emit = defineEmits(['update'])

const draftKey = () => `ddochi_memo_draft_${props.sarangId}`
const readDraft = () => { try { return localStorage.getItem(draftKey()) || '' } catch { return '' } }
const draft = ref(readDraft())
watch(() => props.sarangId, () => { draft.value = readDraft(); editingId.value = null })
watch(draft, (v) => { try { v ? localStorage.setItem(draftKey(), v) : localStorage.removeItem(draftKey()) } catch { /* 저장 못 해도 입력은 됨 */ } })

const editingId = ref(null)
const editText = ref('')
const busy = ref(false)

const canEdit = (m) => props.canManage || m.authorId === props.myId
function fmt(iso) {
  return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
}

async function send(body) {
  busy.value = true
  const r = await props.api('/api/shed/memo', { sarangId: props.sarangId, ...body })
  busy.value = false
  if (r?.success && r.memos) emit('update', r.memos)
  return r
}
async function add() {
  const content = draft.value.trim()
  if (!content || busy.value) return
  const r = await send({ action: 'add', content })
  if (r?.success) draft.value = ''
}
function startEdit(m) { editingId.value = m.id; editText.value = m.content }
async function saveEdit(m) {
  const content = editText.value.trim()
  if (!content) return
  const r = await send({ action: 'edit', memoId: m.id, content })
  if (r?.success) editingId.value = null
}
async function remove(m) {
  if (!confirm('이 메모를 지울까요?')) return
  await send({ action: 'delete', memoId: m.id })
}
</script>

<template>
  <div class="memo">
    <ul v-if="memos.length" class="memo-list">
      <li v-for="m in memos" :key="m.id" class="memo-item">
        <div class="memo-head">
          <span class="memo-time">{{ fmt(m.createdAt) }}</span>
          <b class="memo-author">{{ m.authorName }}</b>
          <span v-if="m.updatedAt" class="memo-edited">(수정됨)</span>
          <span v-if="canEdit(m) && editingId !== m.id" class="memo-actions">
            <button type="button" @click="startEdit(m)">수정</button>
            <button type="button" @click="remove(m)">삭제</button>
          </span>
        </div>
        <template v-if="editingId === m.id">
          <textarea v-model="editText" class="memo-input" rows="2" aria-label="메모 수정"></textarea>
          <div class="memo-edit-actions">
            <button type="button" class="memo-btn ghost" @click="editingId = null">취소</button>
            <button type="button" class="memo-btn" :disabled="busy || !editText.trim()" @click="saveEdit(m)">저장</button>
          </div>
        </template>
        <p v-else class="memo-content">{{ m.content }}</p>
      </li>
    </ul>
    <div class="memo-write">
      <textarea v-model="draft" class="memo-input" rows="2" placeholder="메모 남기기…" aria-label="메모 입력"
        @keydown.enter.meta.prevent="add" @keydown.enter.ctrl.prevent="add"></textarea>
      <button type="button" class="memo-btn" :disabled="busy || !draft.trim()" @click="add">등록</button>
    </div>
  </div>
</template>

<style scoped>
.memo-list { list-style: none; margin: 0 0 8px; padding: 0; max-height: 180px; overflow-y: auto; }
.memo-item { padding: 6px 0; border-bottom: 1px dashed #dcedc8; font-size: 12px; }
.memo-item:last-child { border-bottom: none; }
.memo-head { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.memo-time { color: #888; font-variant-numeric: tabular-nums; }
.memo-author { color: #2E7D32; }
.memo-edited { color: #aaa; font-size: 11px; }
.memo-actions { margin-left: auto; display: flex; gap: 4px; }
.memo-actions button { border: none; background: none; color: #888; font-size: 11px; cursor: pointer; padding: 2px 4px; }
.memo-actions button:hover { color: #2E7D32; }
.memo-content { margin: 3px 0 0; white-space: pre-wrap; word-break: break-word; color: #333; }
.memo-write { display: flex; gap: 6px; align-items: flex-end; }
.memo-input {
  flex: 1; width: 100%; box-sizing: border-box; border: 1px solid #c5e1a5; border-radius: 8px;
  padding: 8px; font-size: 12px; resize: vertical; font-family: "Noto Sans KR", Arial, sans-serif; background: #fafff5;
}
.memo-btn {
  flex-shrink: 0; border: none; border-radius: 8px; background: #2E7D32; color: #fff;
  padding: 8px 12px; font-size: 12px; cursor: pointer; font-family: inherit;
}
.memo-btn:disabled { opacity: .45; cursor: default; }
.memo-btn.ghost { background: #f1f8e9; color: #558b2f; }
.memo-edit-actions { display: flex; justify-content: flex-end; gap: 6px; margin-top: 4px; }
</style>
