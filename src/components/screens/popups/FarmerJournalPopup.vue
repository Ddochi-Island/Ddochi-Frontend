<script setup>
import { reactive, ref, onMounted } from 'vue'
import { useApi } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'
import { FAITH_LABEL_MAP, stageLabels, stageNameToIndex } from '@/constants'

const props = defineProps({
    shortCardId: { type: String, required: true },
})
const emit = defineEmits(['close', 'saved'])

const { callApi } = useApi()
const { showAppAlert, showToast } = usePopup()

const loading = ref(true)
const saving = ref(false)
const isEditable = ref(false)
const stage = ref('씨앗')
const authorName = ref('')
const activeStage = ref(1)
const form = reactive({})

function stageDisplay() {
    return stageLabels[stageNameToIndex[stage.value]] || stage.value
}

function load() {
    callApi('/api/short-cards/journal-get', { shortCardId: props.shortCardId }, r => {
        loading.value = false
        if (!r?.success) { showAppAlert(r?.message || '불러오기 실패'); emit('close'); return }
        const c = r.card
        isEditable.value = !!c.is_editable
        stage.value = c.stage || '씨앗'
        authorName.value = c.author_name
        Object.assign(form, {
            name: c.name, age: c.age, gender: c.gender, relation: c.relation,
            phone: c.phone, residence: c.residence,
            schoolMajor: c.school_major, personality: c.personality, hobby: c.hobby,
            hasPartner: c.has_partner, familyRelation: c.family_relation, environment: c.environment,
            desiredImage: c.desired_image, recentConcern: c.recent_concern,
            familyAtmosphere: c.family_atmosphere, humanRelations: c.human_relations,
            faithStatus: c.faith_status, noteSpecial: c.note_special, guideComment: c.guide_comment,
        })
    })
}
onMounted(load)

function save() {
    if (saving.value) return
    saving.value = true
    const { name, ...data } = form // name은 짧카 작성 때 정해진 값, 여기선 안 바꿈
    callApi('/api/short-cards/journal-save', { shortCardId: props.shortCardId, data }, r => {
        saving.value = false
        if (!r?.success) { showAppAlert(r?.message || '저장 실패'); return }
        showToast(r.message)
        emit('saved')
        load()
    })
}
</script>

<template>
    <Teleport to="body">
        <div class="modal-overlay" @click.self="emit('close')">
            <div class="modal-card fj-modal-card">
                <div class="modal-header-sticky">
                    <div class="fj-header-text">
                        <div class="fj-header-title">🌱 {{ form.name || '' }}님의 농부일지</div>
                        <div class="fj-header-sub">인도자 {{ authorName }} · 지금 단계 {{ stageDisplay() }}</div>
                    </div>
                    <span class="modal-close-sticky" @click="emit('close')">X</span>
                </div>

                <div v-if="loading" class="fj-loading">불러오는 중...</div>
                <template v-else>
                    <div class="fj-stage-tabs">
                        <button :class="['fj-stage-tab', activeStage === 1 ? 'fj-stage-tab-active' : '']" @click="activeStage = 1">🌰 1단계</button>
                        <button :class="['fj-stage-tab', activeStage === 2 ? 'fj-stage-tab-active' : '']" @click="activeStage = 2">🌿 2단계</button>
                        <button :class="['fj-stage-tab', activeStage === 3 ? 'fj-stage-tab-active' : '']" @click="activeStage = 3">🍀 3단계</button>
                    </div>

                    <div class="modal-content-scroll fj-scroll">
                        <div v-show="activeStage === 1" class="fj-grid">
                            <div class="fj-field">
                                <label>신앙여부</label>
                                <select class="input-card" v-model="form.faithStatus" :disabled="!isEditable">
                                    <option value="">선택</option>
                                    <option v-for="(label, code) in FAITH_LABEL_MAP" :key="code" :value="code">{{ label }}</option>
                                </select>
                            </div>
                            <div class="fj-field"><label>나이</label><input type="number" class="input-card" v-model="form.age" :disabled="!isEditable"></div>
                            <div class="fj-field">
                                <label>성별</label>
                                <select class="input-card" v-model="form.gender" :disabled="!isEditable">
                                    <option value="">선택</option><option>남</option><option>여</option>
                                </select>
                            </div>
                            <div class="fj-field"><label>관계</label><input type="text" class="input-card" v-model="form.relation" :disabled="!isEditable" placeholder="예) 과 후배, 동아리 친구"></div>
                            <div class="fj-field"><label>연락처</label><input type="tel" class="input-card" v-model="form.phone" :disabled="!isEditable"></div>
                            <div class="fj-field"><label>거주지</label><input type="text" class="input-card" v-model="form.residence" :disabled="!isEditable"></div>
                        </div>

                        <div v-show="activeStage === 2" class="fj-grid">
                            <div class="fj-field"><label>학교/학과 or 직장</label><input type="text" class="input-card" v-model="form.schoolMajor" :disabled="!isEditable"></div>
                            <div class="fj-field"><label>성격</label><textarea class="input-card" v-model="form.personality" :disabled="!isEditable"></textarea></div>
                            <div class="fj-field"><label>취미/관심사</label><textarea class="input-card" v-model="form.hobby" :disabled="!isEditable"></textarea></div>
                            <div class="fj-field"><label>이성친구 유무</label><input type="text" class="input-card" v-model="form.hasPartner" :disabled="!isEditable"></div>
                            <div class="fj-field"><label>가족관계</label><textarea class="input-card" v-model="form.familyRelation" :disabled="!isEditable"></textarea></div>
                            <div class="fj-field"><label>1년 환경(동아리, 알바, 여행 일정)</label><textarea class="input-card" v-model="form.environment" :disabled="!isEditable"></textarea></div>
                        </div>

                        <div v-show="activeStage === 3" class="fj-grid">
                            <div class="fj-field"><label>되고싶은 모습</label><textarea class="input-card" v-model="form.desiredImage" :disabled="!isEditable"></textarea></div>
                            <div class="fj-field"><label>최근 고민</label><textarea class="input-card" v-model="form.recentConcern" :disabled="!isEditable"></textarea></div>
                            <div class="fj-field"><label>가족분위기</label><textarea class="input-card" v-model="form.familyAtmosphere" :disabled="!isEditable"></textarea></div>
                            <div class="fj-field"><label>인간관계</label><textarea class="input-card" v-model="form.humanRelations" :disabled="!isEditable"></textarea></div>
                            <div class="fj-field"><label>특이사항(비합요소, 컴플렉스, 낯선사람에 대한 경계도 등)</label><textarea class="input-card" v-model="form.noteSpecial" :disabled="!isEditable"></textarea></div>
                            <div class="fj-field"><label>인도자의 개인적인 소견 한줄</label><textarea class="input-card" v-model="form.guideComment" :disabled="!isEditable"></textarea></div>
                        </div>

                        <button v-if="isEditable" class="btn fj-save-btn" :disabled="saving" @click="save">
                            {{ saving ? '저장 중...' : '저장하기 📨' }}
                        </button>
                        <p v-else class="fj-readonly-note">👀 인도자 본인만 쓸 수 있어요 — 열람만 가능</p>
                    </div>
                </template>
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
.fj-modal-card {
    padding: 0;
    height: 85vh;
    max-width: 420px;
}
.fj-header-text {
    text-align: left;
}
.fj-header-title {
    font-size: 16px;
    font-weight: 800;
    color: #191F28;
}
.fj-header-sub {
    font-size: 12px;
    color: #8B95A1;
    margin-top: 2px;
}
.fj-loading {
    padding: 40px 0;
    text-align: center;
    color: #8B95A1;
}
.fj-stage-tabs {
    display: flex;
    gap: 6px;
    padding: 10px 16px;
    background: #F7F8FA;
    border-bottom: 1px solid #EDEFF2;
}
.fj-stage-tab {
    flex: 1;
    padding: 9px 4px;
    border: none;
    border-radius: 10px;
    background: transparent;
    color: #8B95A1;
    font-family: 'Jua', sans-serif;
    font-size: 13px;
    cursor: pointer;
}
.fj-stage-tab-active {
    background: #fff;
    color: #3182F6;
    box-shadow: 0 1px 2px rgba(25,31,40,.08);
}
.fj-scroll {
    text-align: left;
}
.fj-grid {
    display: flex;
    flex-direction: column;
}
.fj-field {
    margin-bottom: 14px;
}
.fj-field label {
    display: block;
    font-size: 13px;
    color: #4E5968;
    margin-bottom: 4px;
}
.fj-save-btn {
    width: 100%;
    margin-top: 4px;
}
.fj-readonly-note {
    text-align: center;
    color: #8B95A1;
    font-size: 13px;
    margin-top: 20px;
}
</style>
