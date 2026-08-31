<script setup>
import { computed } from 'vue'

const props = defineProps({
    existing: { type: Object, required: true },
    input: { type: Object, required: true },
})
const emit = defineEmits(['confirm', 'cancel'])

const toNum = (v) => { const n = parseInt(v); return isNaN(n) ? 0 : n }
const leafParse = (s) => { try { return JSON.parse(s) || [] } catch { return [] } }
const clip = (s, n) => { const t = String(s || ''); return t.length > n ? t.slice(0, n) + '…' : t }
const pick = (newV, oldV) => (newV != null && newV !== '') ? String(newV) : (oldV || '')

const merged = computed(() => {
    const e = props.existing, i = props.input
    return {
        activity: pick(i.activity, e.activity),
        dmCount: pick(i.dmCount, e.dmCount),
        qrCount: pick(i.qrCount, e.qrCount),
        promoList: pick(i.promoList, e.promoList),
        leafList: pick(i.leafList, e.leafList),
        mood: (i.moodTouched && i.mood != null && String(i.mood) !== '') ? String(i.mood) : (e.mood || ''),
        reflection: pick(i.reflection, e.reflection),
    }
})

const changedRows = computed(() => {
    const e = props.existing, i = props.input, m = merged.value
    const eLeaf = leafParse(e.leafList).length
    const mLeaf = leafParse(m.leafList).length
    const candidates = [
        { label: '활동',     before: e.activity || '—',             after: m.activity || '—',
          changed: (m.activity || '') !== (e.activity || '') },
        { label: 'DM',       before: `${toNum(e.dmCount)}건`,        after: `${toNum(m.dmCount)}건`,
          changed: toNum(m.dmCount) !== toNum(e.dmCount) },
        { label: 'QR',       before: `${toNum(e.qrCount)}건`,        after: `${toNum(m.qrCount)}건`,
          changed: toNum(m.qrCount) !== toNum(e.qrCount) },
        { label: '홍보학교', before: e.promoList || '—',             after: m.promoList || '—',
          changed: (m.promoList || '') !== (e.promoList || '') },
        { label: '잎사귀',   before: `${eLeaf}개`,                   after: `${mLeaf}개`,
          changed: mLeaf !== eLeaf },
        { label: '기분',     before: e.mood || '—',                  after: m.mood || '—',
          changed: String(m.mood || '') !== String(e.mood || '') },
        { label: '회고',     before: clip(e.reflection, 30) || '—',  after: clip(m.reflection, 30) || '—',
          changed: (m.reflection || '') !== (e.reflection || '') },
    ]
    return candidates.filter(r => r.changed)
})
</script>

<template>
    <Teleport to="body">
        <div class="dr-mp-overlay" @click.self="emit('cancel')">
            <div class="dr-mp-modal">
                <div class="modal-header">
                    <div class="modal-title">📋 보고 수정 확인</div>
                    <span class="modal-close" @click="emit('cancel')">×</span>
                </div>
                <div class="modal-body">
                    <div class="dr-mp-desc">
                        이미 제출된 오늘 보고가 있어.<br>
                        <span v-if="changedRows.length">아래 항목이 <b>바뀌어</b> 저장돼.</span>
                        <span v-else>변경된 내용이 없어. 동일하게 다시 저장할게.</span>
                    </div>

                    <div v-if="changedRows.length" class="change-list">
                        <div v-for="r in changedRows" :key="r.label" class="change-card">
                            <div class="change-label">{{ r.label }}</div>
                            <div class="change-diff">
                                <span class="diff-before">{{ r.before }}</span>
                                <span class="diff-arrow">→</span>
                                <span class="diff-after">{{ r.after }}</span>
                            </div>
                        </div>
                    </div>

                    <div class="btn-col">
                        <button class="btn-pos" style="background:#4CAF50;" @click="emit('confirm')">✅ 이대로 저장</button>
                        <button class="btn-neg" style="background:#9E9E9E;color:#fff;" @click="emit('cancel')">취소</button>
                    </div>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
.dr-mp-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
}
.dr-mp-modal {
    background: #fff;
    border-radius: 20px;
    width: 92%;
    max-width: 420px;
    max-height: 88vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
}
.modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 20px 14px;
    border-bottom: 1px solid #F0F0F0;
}
.modal-title { font-weight: 700; font-size: 16px; color: #222; }
.modal-close { cursor: pointer; font-size: 22px; color: #bbb; line-height: 1; }
.modal-body { overflow-y: auto; padding: 16px; flex: 1; display: flex; flex-direction: column; gap: 14px; }
.dr-mp-desc { font-size: 13px; color: #666; line-height: 1.7; }
.change-list { display: flex; flex-direction: column; gap: 10px; }
.change-card {
    background: #F0F6FF;
    border-left: 3px solid #1565C0;
    border-radius: 0 10px 10px 0;
    padding: 10px 14px;
}
.change-label { font-size: 11px; font-weight: 700; color: #1565C0; margin-bottom: 4px; letter-spacing: 0.3px; }
.change-diff { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.diff-before { font-size: 13px; color: #aaa; text-decoration: line-through; }
.diff-arrow { font-size: 13px; color: #bbb; }
.diff-after { font-size: 14px; font-weight: 700; color: #1565C0; }
.btn-col { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
.btn-pos {
    padding: 14px;
    border: none; border-radius: 12px;
    font-size: 15px; font-weight: 700; color: #fff;
    cursor: pointer; font-family: 'Jua', sans-serif;
}
.btn-neg {
    padding: 14px;
    border: none; border-radius: 12px;
    font-size: 15px; font-weight: 700;
    cursor: pointer; font-family: 'Jua', sans-serif;
}
</style>
