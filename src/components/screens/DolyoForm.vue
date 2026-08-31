<script setup>
// DolyoForm — 인도권 등록/수정 통합 form.
//
// legacy2 의 getDolyoFormHtml + _showDolyoFormModal + _collectDolyoFormData
// + submitDolyoRegister + submitDolyoEdit (line 16134~16318) 의 Vue 화.
//
// 사용:
//   <DolyoForm v-if="formMode" :item="formItem" @close="closeForm" @saved="onSaved" />
//   - formMode === 'register': item=null, 빈 폼
//   - formMode === 'edit'    : item={...}, 채운 폼

import { ref, reactive, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useDolyo } from '@/composables/useDolyo'
import { usePopup } from '@/composables/usePopup'

const props = defineProps({
    // null = 등록, 객체 = 수정
    item: { type: Object, default: null },
})
const emit = defineEmits(['close', 'saved'])

const auth = useAuthStore()
const { register, update } = useDolyo()
const { showToast, showAppAlert } = usePopup()

const PATH_LIST = ['도구노방', '생노', '큐알', '바따장', '인스타디엠', '인스타광고', '온라인폼', '지인', '소모임', '온찾']
const FAITH_LIST = ['', '무', '휴', '신앙']

const isEdit = computed(() => !!props.item)
const title = computed(() =>
    isEdit.value ? `✏️ ${props.item.name} 수정` : '🌱 새 인도권 등록'
)

// reactive form state. legacy 의 _collectDolyoFormData 와 1:1 대응.
const form = reactive({
    manager: '',
    faith: '',
    name: '',
    gender: '여',
    age: '',
    pathTool: '',           // PATH_LIST 의 값 또는 '직접입력'
    customPath: '',
    relationDetail: '',
    phone1: '',
    phone2: '',
    phone3: '',
    residence: '',
    school: '',
    personality: '',
    hobby: '',
    partner: '',
    family: '',
    annualSchedule: '',
    goal: '',
    concern: '',
    familyAtmo: '',
    humanRelation: '',
    notes: '',
    opinion: '',
})

const saving = ref(false)

const isCustomPath = computed(() => form.pathTool === '직접입력')

onMounted(() => {
    if (isEdit.value) {
        const it = props.item
        const fd = it.farmerDiary || {}
        const s1 = fd.stage1 || {}
        const s2 = fd.stage2 || {}
        const s3 = fd.stage3 || {}
        const phoneParts = String(it.phone || '').split('-')

        form.manager = it.manager || ''
        form.faith = fd.faith || ''
        form.name = it.name || ''
        form.gender = it.gender || '여'
        form.age = it.age || ''

        // pathTool — PATH_LIST 안 있으면 직접입력
        const pt = s1.pathTool || it.path || ''
        if (PATH_LIST.includes(pt)) {
            form.pathTool = pt
        } else if (pt) {
            form.pathTool = '직접입력'
            form.customPath = pt
        }

        form.relationDetail = s1.relationDetail || ''
        form.phone1 = phoneParts[0] || ''
        form.phone2 = phoneParts[1] || ''
        form.phone3 = phoneParts[2] || ''
        form.residence = it.residence || ''
        form.school = s2.school || ''
        form.personality = s2.personality || ''
        form.hobby = s2.hobby || ''
        form.partner = s2.partner || ''
        form.family = s2.family || ''
        form.annualSchedule = s2.annualSchedule || ''
        form.goal = s3.goal || ''
        form.concern = s3.concern || ''
        form.familyAtmo = s3.familyAtmo || ''
        form.humanRelation = s3.humanRelation || ''
        form.notes = fd.notes || ''
        form.opinion = fd.opinion || ''
    } else {
        form.manager = auth.currentUserName || ''
    }
})

function buildPayload() {
    const phone = form.phone1 && form.phone2 && form.phone3
        ? `${form.phone1}-${form.phone2}-${form.phone3}`
        : ''
    const pathTool = isCustomPath.value ? form.customPath : form.pathTool
    return {
        manager: form.manager,
        faith: form.faith,
        name: form.name,
        gender: form.gender,
        age: form.age,
        pathTool,
        relationDetail: form.relationDetail,
        phone,
        residence: form.residence,
        school: form.school,
        personality: form.personality,
        hobby: form.hobby,
        partner: form.partner,
        family: form.family,
        annualSchedule: form.annualSchedule,
        goal: form.goal,
        concern: form.concern,
        familyAtmo: form.familyAtmo,
        humanRelation: form.humanRelation,
        notes: form.notes,
        opinion: form.opinion,
    }
}

async function onSubmit() {
    if (!form.name) return showToast('이름은 필수야!')
    if (!form.age) return showToast('나이는 필수야!')
    if (!form.phone1 || !form.phone2 || !form.phone3) return showToast('연락처는 필수야!')

    saving.value = true
    const payload = buildPayload()
    try {
        const r = isEdit.value
            ? await update(props.item.docId, payload)
            : await register(payload)

        if (r && (r.success || r.ok)) {
            showAppAlert(isEdit.value ? '✅ 수정 완료!' : '🌱 등록 완료!', () => {
                emit('saved', r.docId || props.item?.docId || null)
                emit('close')
            })
        } else {
            showToast(r?.message || '오류 발생')
        }
    } catch (e) {
        showToast(e.message || '오류 발생')
    } finally {
        saving.value = false
    }
}

function autoResize(e) {
    const ta = e.target
    ta.style.height = 'auto'
    ta.style.height = ta.scrollHeight + 'px'
}
function moveFocus(e, max, nextId) {
    if (e.target.value.length >= max) {
        const next = document.getElementById(nextId)
        if (next) next.focus()
    }
}
</script>

<template>
    <Teleport to="body">
        <div class="dolyo-form-overlay" @click.self="emit('close')">
            <div class="dolyo-form-modal">
                <div class="modal-header-sticky">
                    <div class="modal-title">{{ title }}</div>
                    <span class="modal-close-sticky" @click="emit('close')">×</span>
                </div>
                <div class="modal-content-scroll">
                    <div style="padding-bottom:10px;">
                        <div style="background:#FFF8E1; border-radius:10px; padding:12px; margin-bottom:12px;">
                            <div style="font-weight:bold; color:#E65100; margin-bottom:8px;">[ 농부 일지 ]</div>
                            <label>인도자</label>
                            <div class="input-card"><input type="text" v-model="form.manager" placeholder="인도자 이름"></div>
                            <label>신앙여부</label>
                            <div class="input-card">
                                <select v-model="form.faith" style="padding:0;">
                                    <option v-for="f in FAITH_LIST" :key="f" :value="f">{{ f || '미확인' }}</option>
                                </select>
                            </div>
                        </div>

                        <details open>
                            <summary class="dolyo-summary" style="color:#1565C0;">● 1단계 (씨앗)
                                <span style="color:#E91E63; font-size:11px;">*필수</span></summary>
                            <div style="padding:8px 0;">
                                <div style="display:flex; gap:8px;">
                                    <div style="flex:1.2;">
                                        <label>이름</label>
                                        <div class="input-card"><input type="text" v-model="form.name" placeholder="이름"></div>
                                    </div>
                                    <div style="flex:0.7;">
                                        <label>성별</label>
                                        <div class="input-card">
                                            <select v-model="form.gender" style="padding:0;">
                                                <option>여</option><option>남</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div style="flex:0.7;">
                                        <label>나이</label>
                                        <div class="input-card"><input type="number" v-model="form.age" placeholder="20"></div>
                                    </div>
                                </div>
                                <label>경로/도구</label>
                                <div style="display:flex; gap:8px; margin-bottom:8px;">
                                    <div style="flex:1;">
                                        <div class="input-card">
                                            <select v-model="form.pathTool" style="padding:0;">
                                                <option value="">경로 선택</option>
                                                <option v-for="p in PATH_LIST" :key="p" :value="p">{{ p }}</option>
                                                <option value="직접입력">직접입력</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <div v-if="isCustomPath" style="margin-bottom:8px;">
                                    <div class="input-card"><input type="text" v-model="form.customPath" placeholder="직접 입력"></div>
                                </div>
                                <label>상세 관계</label>
                                <div class="input-card"><input type="text" v-model="form.relationDetail" placeholder="예: 고등학교 친구, 동아리 선배"></div>
                                <label>연락처</label>
                                <div class="input-card phone-group">
                                    <input type="tel" class="phone-input" id="dly_phone1" v-model="form.phone1"
                                        maxlength="3" placeholder="010" @input="(e) => moveFocus(e, 3, 'dly_phone2')">
                                    <span class="dash">-</span>
                                    <input type="tel" class="phone-input" id="dly_phone2" v-model="form.phone2"
                                        maxlength="4" placeholder="0000" @input="(e) => moveFocus(e, 4, 'dly_phone3')">
                                    <span class="dash">-</span>
                                    <input type="tel" class="phone-input" id="dly_phone3" v-model="form.phone3"
                                        maxlength="4" placeholder="0000">
                                </div>
                                <label>거주지</label>
                                <div class="input-card">
                                    <input type="text" v-model="form.residence" placeholder="거주지" autocomplete="off">
                                </div>
                            </div>
                        </details>

                        <details style="margin-top:8px;">
                            <summary class="dolyo-summary" style="color:#2E7D32;">● 2단계 (새싹)
                                <span style="color:#888; font-size:11px;">선택</span></summary>
                            <div style="padding:8px 0;">
                                <label>학교/학과 or 직장</label>
                                <div class="input-card"><input type="text" v-model="form.school" placeholder="○○대학교 / ○○회사"></div>
                                <label>성격</label>
                                <div class="input-card"><input type="text" v-model="form.personality" placeholder="활발함, 내성적 등"></div>
                                <label>취미/관심사</label>
                                <div class="input-card"><input type="text" v-model="form.hobby" placeholder="운동, 독서 등"></div>
                                <label>이성친구 유무</label>
                                <div class="input-card"><input type="text" v-model="form.partner" placeholder="있음/없음"></div>
                                <label>가족관계</label>
                                <div class="input-card"><input type="text" v-model="form.family" placeholder="부모님과 동생 1명 등"></div>
                                <label>1년 환경 (동아리, 알바, 여행 일정 등)</label>
                                <div class="input-card">
                                    <textarea v-model="form.annualSchedule" rows="1" @input="autoResize"
                                        placeholder="방학 알바, 교환학생 예정 등"></textarea>
                                </div>
                            </div>
                        </details>

                        <details style="margin-top:8px;">
                            <summary class="dolyo-summary" style="color:#7B1FA2;">● 3단계 (떡잎)
                                <span style="color:#888; font-size:11px;">선택</span></summary>
                            <div style="padding:8px 0;">
                                <label>되고싶은 모습</label>
                                <div class="input-card">
                                    <textarea v-model="form.goal" rows="1" @input="autoResize"
                                        placeholder="어떤 사람이 되고 싶은지"></textarea>
                                </div>
                                <label>최근 고민</label>
                                <div class="input-card">
                                    <textarea v-model="form.concern" rows="1" @input="autoResize"
                                        placeholder="요즘 무슨 고민이 있는지"></textarea>
                                </div>
                                <label>가족분위기</label>
                                <div class="input-card"><input type="text" v-model="form.familyAtmo" placeholder="화목함, 부모님 이혼 등"></div>
                                <label>인간관계</label>
                                <div class="input-card">
                                    <textarea v-model="form.humanRelation" rows="1" @input="autoResize"
                                        placeholder="친구가 많은 편, 소수 깊은 관계 등"></textarea>
                                </div>
                            </div>
                        </details>

                        <details style="margin-top:8px;">
                            <summary class="dolyo-summary" style="color:#555;">특이사항 / 소견
                                <span style="color:#888; font-size:11px;">선택</span></summary>
                            <div style="padding:8px 0;">
                                <label>특이사항 (비합요소, 컴플렉스 등)</label>
                                <div class="input-card">
                                    <textarea v-model="form.notes" rows="1" @input="autoResize"
                                        placeholder="비합요소, 컴플렉스, 경계도 등"></textarea>
                                </div>
                                <label>인도자 개인 소견 한줄</label>
                                <div class="input-card"><input type="text" v-model="form.opinion" placeholder="한 줄로 표현하자면..."></div>
                            </div>
                        </details>

                        <div class="btn-group" style="margin-top:15px; padding-bottom:40px;">
                            <button class="btn-pos" :disabled="saving" @click="onSubmit">
                                {{ saving ? '저장 중...' : (isEdit ? '수정 완료' : '등록하기 🌱') }}
                            </button>
                            <button class="btn-neg" @click="emit('close')">취소</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
.dolyo-form-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
}
.dolyo-form-modal {
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
.dolyo-summary {
    font-weight: bold;
    padding: 8px 0;
    cursor: pointer;
    list-style: none;
}
.phone-group {
    display: flex;
    align-items: center;
    gap: 4px;
}
.phone-input {
    flex: 1;
    border: none;
    outline: none;
    text-align: center;
    background: transparent;
}
.dash {
    color: #aaa;
}
</style>
