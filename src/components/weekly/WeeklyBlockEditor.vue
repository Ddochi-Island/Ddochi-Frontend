<script setup>
import { ref, computed } from 'vue'
import { usePopup } from '@/composables/usePopup'

// [2026-04-22] index2.html openWeeklyBlockEditor (L12689-12839) 이식.
// 주간 템플릿 블록 수정/삭제 서브 모달.

const { showAppAlert } = usePopup()

const props = defineProps({
    dow: { type: Number, required: true },         // 0=Sun..6=Sat
    block: { type: Object, required: true },       // { name, color, type, isActivity, activityCategory, memo }
    range: { type: Object, required: true },       // { l, r } (슬롯 인덱스)
    slots: { type: Array, required: true },        // ["09:00", "09:30", ...]
    canSetUndefined: { type: Boolean, default: false }
})
const emit = defineEmits(['save', 'delete', 'close'])

const DAY_NAMES = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']

const startIdx = ref(props.range.l)
const endIdx = ref(props.range.r)
const memo = ref(props.block.memo || '')
const isActivity = ref(props.block.isActivity !== false)
const actCat = ref(props.block.activityCategory || 'guide')

const cleanName = computed(() => {
    const n = props.block.name || ''
    return n.replace(/\p{Emoji_Presentation}|\p{Extended_Pictographic}|️|‍/gu, '').trim() || '(이름 없음)'
})

const endTimeLabel = (idx) => (idx + 1 < props.slots.length) ? props.slots[idx + 1] : '24:00'

function save() {
    const s = parseInt(startIdx.value)
    const e = parseInt(endIdx.value)
    if (isNaN(s) || isNaN(e) || s > e) {
        showAppAlert('시작 시간이 종료 시간보다 늦어!')
        return
    }
    emit('save', {
        startIdx: s,
        endIdx: e,
        memo: (memo.value || '').trim().slice(0, 200),
        isActivity: isActivity.value,
        activityCategory: isActivity.value ? actCat.value : null
    })
}
</script>

<template>
    <Teleport to="body">
        <div class="modal-overlay" style="z-index:1200;" @click.self="emit('close')">
            <div class="modal-card" style="max-width:400px; max-height:90vh; overflow-y:auto;">
                <span class="modal-close" @click="emit('close')">&times;</span>
                <div class="modal-title" style="text-align:left;">✏️ 일정 수정</div>

                <div style="text-align:left;">
                    <div style="display:flex; align-items:center; gap:10px; padding:10px 12px; background:#F5F5F5; border-radius:8px; margin-bottom:14px;">
                        <span :style="{ display:'inline-block', width:'18px', height:'18px', borderRadius:'4px', background: block.color || '#5D4037', flexShrink:0 }"></span>
                        <span style="font-weight:700; font-size:15px;">{{ cleanName }}</span>
                        <span style="margin-left:auto; font-size:12px; color:#888;">{{ DAY_NAMES[dow] }}</span>
                    </div>

                    <div style="display:flex; gap:10px; margin-bottom:14px;">
                        <div style="flex:1;">
                            <label style="font-size:12px; color:#888; display:block; margin-bottom:4px; font-weight:normal;">시작</label>
                            <select v-model="startIdx" style="width:100%; padding:8px 10px; font-size:14px; border:1px solid #ddd; border-radius:8px; background:#fff; box-sizing:border-box;">
                                <option v-for="(t, i) in slots" :key="i" :value="i">{{ t }}</option>
                            </select>
                        </div>
                        <div style="flex:1;">
                            <label style="font-size:12px; color:#888; display:block; margin-bottom:4px; font-weight:normal;">종료</label>
                            <select v-model="endIdx" style="width:100%; padding:8px 10px; font-size:14px; border:1px solid #ddd; border-radius:8px; background:#fff; box-sizing:border-box;">
                                <option v-for="(t, i) in slots" :key="i" :value="i">{{ endTimeLabel(i) }}</option>
                            </select>
                        </div>
                    </div>

                    <div style="padding:12px; background:#FAFAFA; border:1px solid #eee; border-radius:8px; margin-bottom:14px;">
                        <label style="display:flex; align-items:center; gap:10px; font-size:14px; color:#333; cursor:pointer; font-weight:600; margin:0;">
                            <input type="checkbox" v-model="isActivity" style="width:18px; height:18px; flex-shrink:0; margin:0;">
                            <span>활동으로 집계 (사역 시간)</span>
                        </label>
                        <div :style="{ marginTop:'10px', display:'flex', alignItems:'center', gap:'8px', opacity: isActivity ? 1 : 0.4 }">
                            <span style="font-size:12px; color:#666; font-weight:600; white-space:nowrap; min-width:52px;">카테고리</span>
                            <select v-model="actCat" :disabled="!isActivity" style="flex:1; padding:6px 10px; font-size:13px; border:1px solid #ddd; border-radius:6px; background:white;">
                                <option value="guide">👤 인도</option>
                                <option value="teacher">👨‍🏫 교사</option>
                                <option value="leaf">🌱 잎사귀</option>
                                <option v-if="canSetUndefined" value="undefined_evangelism">🌏 구분없는전도</option>
                            </select>
                        </div>
                    </div>

                    <label style="font-size:12px; color:#888; display:block; margin-bottom:4px; font-weight:normal;">세부 메모 (선택)</label>
                    <textarea v-model="memo" placeholder="예: 수학 학원, 교회 모임 장소 등"
                        style="width:100%; min-height:60px; padding:10px; border:1px solid #ddd; border-radius:8px; background:#fff; box-sizing:border-box; font-size:14px; font-family:inherit; resize:vertical; margin-bottom:14px;"></textarea>
                </div>

                <div style="display:flex; gap:8px;">
                    <button class="btn-pos" style="flex:1; background:#4CAF50;" @click="save">💾 저장</button>
                    <button class="btn-neg" style="flex:1; background:#E53935; color:#fff;" @click="emit('delete')">🗑 삭제</button>
                    <button class="btn-neg" style="flex:1; background:#9E9E9E; color:#fff;" @click="emit('close')">취소</button>
                </div>
            </div>
        </div>
    </Teleport>
</template>
