<script setup>
// DolyoDetail — 인도권 상세 보기 modal.
// legacy2 의 openDolyoDetail HTML (line 15754-15866) 의 Vue 화. read-only 표시 +
// "수정" / "닫기" 버튼. 액션 기록/매칭 진행은 Phase 1-C/D 에서 추가.

import { ref, computed } from 'vue'
import { useDolyo } from '@/composables/useDolyo'
import { usePopup } from '@/composables/usePopup'
import DolyoActionModal from '@/components/screens/DolyoActionModal.vue'
import DolyoDeleteModal from '@/components/screens/DolyoDeleteModal.vue'
import DolyoMatchResultModal from '@/components/screens/DolyoMatchResultModal.vue'
import DolyoApprovalModal from '@/components/screens/DolyoApprovalModal.vue'
import DolyoHabjaeyangModal from '@/components/screens/DolyoHabjaeyangModal.vue'
import { TM_RESULT_BIHAP, TM_RESULT_GEOJEOL, FAITH_LABEL_MAP } from '@/constants'

const props = defineProps({
    item: { type: Object, required: true },
})
const emit = defineEmits(['close', 'edit'])

const { deleteActionLog } = useDolyo()
const { showAppAlert, showAppConfirm, showToast } = usePopup()

const showActionModal = ref(false)
const showDeleteModal = ref(false)
const showMatchResultModal = ref(false)
const showApprovalModal = ref(false)
const showHabjaeyangModal = ref(false)

// hasHj — 합재양 row 존재 여부 (subName 으로 판정, legacy 와 동일)
const hasHj = computed(() => !!(props.item.habjaeyang && props.item.habjaeyang.subName))

// reverse — 최신 액션이 위로
const actionLogsReverse = computed(() => {
    const arr = props.item.actionLogs || []
    return [...arr].reverse()
})

function openAction() { showActionModal.value = true }
function openDelete() { showDeleteModal.value = true }

function onActionSaved() {
    // useDolyo.addAction 가 list 갱신함 — DolyoScreen 의 detail prop 도 새 actionLogs 반영
}

function onDeleted() {
    // 카드 자체가 사라졌으니 detail 도 닫기
    emit('close')
}

function removeLog(actionId) {
    showAppConfirm('이 기록을 정말 지울까?', async (ok) => {
        if (!ok) return
        try {
            const r = await deleteActionLog(props.item.docId, actionId)
            if (!r?.success && !r?.ok) showToast(r?.message || '삭제 실패')
        } catch (e) {
            showToast(e.message || '오류 발생')
        }
    })
}

const fd = computed(() => props.item.farmerDiary || {})
const s1 = computed(() => fd.value.stage1 || {})
const s2 = computed(() => fd.value.stage2 || {})
const s3 = computed(() => fd.value.stage3 || {})

const tmResult = computed(() => props.item.tmResultDetail || '')
const isManpix = computed(() => tmResult.value === '만남픽스')
const isBiHap = computed(() => TM_RESULT_BIHAP.includes(tmResult.value))
const isGeojeol = computed(() => TM_RESULT_GEOJEOL.includes(tmResult.value))
const hasFinalResult = computed(() => isManpix.value || isBiHap.value || isGeojeol.value)

const resultBadge = computed(() => {
    if (isManpix.value) return { label: '📅 만남픽스', bg: '#E3F2FD', color: '#1565C0', bold: true }
    if (isBiHap.value) return { label: `⭕️ 비합 · ${tmResult.value}`, bg: '#EDE7F6', color: '#4A148C', bold: true }
    if (isGeojeol.value) return { label: `❌ 거절 · ${tmResult.value}`, bg: '#FBE9E7', color: '#BF360C', bold: true }
    return { label: '⏳ 결과 미입력', bg: '#F5F5F5', color: '#9E9E9E', bold: false }
})

const faithText = computed(() => FAITH_LABEL_MAP[fd.value.faith] || fd.value.faith || '')

function block(label, val) { return val ? { label, val } : null }

const stage1Blocks = computed(() => [
    block('이름/성별/나이', [s1.value.name, s1.value.gender, s1.value.age ? s1.value.age + '세' : ''].filter(Boolean).join(' / ')),
    block('경로/도구', s1.value.pathTool || props.item.path),
    block('상세 관계', s1.value.relationDetail),
    block('연락처', props.item.phone),
    block('거주지', props.item.residence),
].filter(Boolean))

const stage2Blocks = computed(() => [
    block('학교/직장', s2.value.school),
    block('성격', s2.value.personality),
    block('취미/관심사', s2.value.hobby),
    block('이성친구', s2.value.partner),
    block('가족관계', s2.value.family),
    block('1년 환경', s2.value.annualSchedule),
].filter(Boolean))

const hasStage2 = computed(() => stage2Blocks.value.length > 0)

const stage3Blocks = computed(() => [
    block('되고싶은 모습', s3.value.goal),
    block('최근 고민', s3.value.concern),
    block('가족분위기', s3.value.familyAtmo),
    block('인간관계', s3.value.humanRelation),
].filter(Boolean))

const hasStage3 = computed(() => stage3Blocks.value.length > 0)
</script>

<template>
    <Teleport to="body">
        <div class="dolyo-detail-overlay" @click.self="emit('close')">
            <div class="dolyo-detail-modal">
                <div class="modal-header-sticky">
                    <div class="modal-title">🌱 {{ item.name }} 농부일지</div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <button style="background:none; border:none; font-size:18px; cursor:pointer; color:#ccc; padding:2px 6px;"
                            @click="openDelete" title="삭제">🗑</button>
                        <span class="modal-close-sticky" @click="emit('close')">×</span>
                    </div>
                </div>

                <div class="modal-content-scroll">
                    <div style="display:flex; gap:8px; margin-bottom:12px;">
                        <button class="btn-pos" style="flex:1; font-size:12px;" @click="emit('edit')">✏️ 수정</button>
                        <button class="btn-pos" style="flex:1; font-size:12px; background:#FF9800;" @click="openAction">
                            📝 액션 기록
                        </button>
                    </div>

                    <div style="background:#E8F5E9; border-radius:10px; padding:12px; margin-bottom:10px;">
                        <div style="font-weight:bold; color:#1B5E20; margin-bottom:8px;">🤝 매칭 진행</div>
                        <div style="margin-bottom:10px;">
                            <span :style="{
                                background: resultBadge.bg,
                                color: resultBadge.color,
                                padding: '2px 8px',
                                borderRadius: '10px',
                                fontSize: '12px',
                                fontWeight: resultBadge.bold ? 'bold' : 'normal',
                            }">{{ resultBadge.label }}</span>
                        </div>
                        <div style="display:flex; gap:6px; flex-wrap:wrap;">
                            <button v-if="!hasFinalResult" class="btn-pos"
                                style="font-size:11px; padding:6px 10px; background:#E65100;"
                                @click="showMatchResultModal = true">결과입력</button>
                            <button v-if="isManpix && !hasHj"
                                class="btn-pos" style="font-size:11px; padding:6px 10px; background:#1565C0;"
                                @click="showHabjaeyangModal = true">합재양 작성</button>
                            <button v-if="hasHj"
                                class="btn-pos" style="font-size:11px; padding:6px 10px; background:#0288D1;"
                                @click="showHabjaeyangModal = true">🔄 2차 매칭</button>
                            <button v-if="hasFinalResult && !isManpix" class="btn-pos"
                                style="font-size:11px; padding:6px 10px; background:#78909C;"
                                @click="showMatchResultModal = true">재결정</button>
                            <button v-if="isManpix" class="btn-pos"
                                style="font-size:11px; padding:6px 10px; background:#5E35B1;"
                                @click="showApprovalModal = true">재가/반려</button>
                        </div>
                    </div>

                    <div style="background:#f9f9f9; border-radius:10px; padding:12px; margin-bottom:10px;">
                        <div style="font-weight:bold; color:#555; margin-bottom:8px;">📋 액션 기록</div>
                        <div v-if="actionLogsReverse.length === 0" style="color:#aaa; font-size:12px;">아직 기록이 없어</div>
                        <div v-for="log in actionLogsReverse" :key="log.actionId"
                            style="display:flex; align-items:flex-start; gap:6px; padding:6px 0; border-bottom:1px solid #f5f5f5; font-size:12px;">
                            <div style="flex:1;">
                                <span style="color:#888;">{{ log.date }}</span>
                                <span style="color:#333;">{{ log.content }}</span>
                            </div>
                            <span @click="removeLog(log.actionId)"
                                style="color:#ccc; cursor:pointer; font-size:16px; line-height:1; padding:0 2px; flex-shrink:0;">×</span>
                        </div>
                    </div>

                    <div style="background:#FFF8E1; border-radius:10px; padding:12px; margin-bottom:10px;">
                        <div style="font-weight:bold; color:#E65100; margin-bottom:8px;">[ 농부 일지 ]</div>
                        <div v-if="item.manager" style="margin-bottom:5px;">
                            <span style="color:#888; font-size:12px;">인도자</span><br>
                            <span style="font-size:13px;">{{ item.manager }}</span>
                        </div>
                        <div v-if="faithText" style="margin-bottom:5px;">
                            <span style="color:#888; font-size:12px;">신앙여부</span><br>
                            <span style="font-size:13px;">{{ faithText }}</span>
                        </div>
                    </div>

                    <div style="background:#f9f9f9; border-radius:10px; padding:12px; margin-bottom:8px;">
                        <div style="font-weight:bold; color:#1565C0; margin-bottom:8px;">● 1단계 (씨앗)</div>
                        <div v-for="b in stage1Blocks" :key="b.label" style="margin-bottom:5px;">
                            <span style="color:#888; font-size:12px;">{{ b.label }}</span><br>
                            <span style="font-size:13px;">{{ b.val }}</span>
                        </div>
                    </div>

                    <div v-if="hasStage2" style="background:#f9f9f9; border-radius:10px; padding:12px; margin-bottom:8px;">
                        <div style="font-weight:bold; color:#2E7D32; margin-bottom:8px;">● 2단계 (새싹)</div>
                        <div v-for="b in stage2Blocks" :key="b.label" style="margin-bottom:5px;">
                            <span style="color:#888; font-size:12px;">{{ b.label }}</span><br>
                            <span style="font-size:13px;">{{ b.val }}</span>
                        </div>
                    </div>

                    <div v-if="hasStage3" style="background:#f9f9f9; border-radius:10px; padding:12px; margin-bottom:8px;">
                        <div style="font-weight:bold; color:#7B1FA2; margin-bottom:8px;">● 3단계 (떡잎)</div>
                        <div v-for="b in stage3Blocks" :key="b.label" style="margin-bottom:5px;">
                            <span style="color:#888; font-size:12px;">{{ b.label }}</span><br>
                            <span style="font-size:13px;">{{ b.val }}</span>
                        </div>
                    </div>

                    <div v-if="fd.notes || fd.opinion"
                        style="background:#f9f9f9; border-radius:10px; padding:12px; margin-bottom:8px;">
                        <div v-if="fd.notes" style="margin-bottom:5px;">
                            <span style="color:#888; font-size:12px;">특이사항</span><br>
                            <span style="font-size:13px;">{{ fd.notes }}</span>
                        </div>
                        <div v-if="fd.opinion" style="margin-bottom:5px;">
                            <span style="color:#888; font-size:12px;">인도자 소견</span><br>
                            <span style="font-size:13px;">{{ fd.opinion }}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <DolyoActionModal v-if="showActionModal" :doc-id="item.docId"
            @close="showActionModal = false" @saved="onActionSaved" />
        <DolyoDeleteModal v-if="showDeleteModal" :item="item"
            @close="showDeleteModal = false" @deleted="onDeleted" />
        <DolyoMatchResultModal v-if="showMatchResultModal" :doc-id="item.docId"
            @close="showMatchResultModal = false" />
        <DolyoApprovalModal v-if="showApprovalModal" :doc-id="item.docId"
            @close="showApprovalModal = false" />
        <DolyoHabjaeyangModal v-if="showHabjaeyangModal" :item="item"
            @close="showHabjaeyangModal = false" />
    </Teleport>
</template>

<style scoped>
.dolyo-detail-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
}
.dolyo-detail-modal {
    background: #fff;
    border-radius: 16px;
    width: 92%;
    max-width: 480px;
    max-height: 88vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
}
.modal-header-sticky {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px;
    border-bottom: 1px solid #eee;
}
.modal-title {
    font-weight: bold;
    font-size: 16px;
}
.modal-close-sticky {
    cursor: pointer;
    font-size: 24px;
    color: #bbb;
    line-height: 1;
}
.modal-content-scroll {
    overflow-y: auto;
    padding: 15px;
    flex: 1;
}
</style>
