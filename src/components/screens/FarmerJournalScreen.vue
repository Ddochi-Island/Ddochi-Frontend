<script setup>
import { reactive, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'
import { FAITH_LABEL_MAP, stageLabels, stageNameToIndex } from '@/constants'

const route = useRoute()
const router = useRouter()
const { callApi } = useApi()
const { showAppAlert, showToast } = usePopup()

const shortCardId = route.query.shortCardId
const loading = ref(true)
const saving = ref(false)
const isEditable = ref(false)
const stage = ref('씨앗')
const authorName = ref('')
const form = reactive({})

function stageDisplay() {
    return stageLabels[stageNameToIndex[stage.value]] || stage.value
}

function load() {
    if (!shortCardId) { showAppAlert('잘못된 접근이에요'); router.back(); return }
    callApi('/api/short-cards/journal-get', { shortCardId }, r => {
        loading.value = false
        if (!r?.success) { showAppAlert(r?.message || '불러오기 실패'); router.back(); return }
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
    callApi('/api/short-cards/journal-save', { shortCardId, data }, r => {
        saving.value = false
        if (!r?.success) { showAppAlert(r?.message || '저장 실패'); return }
        showToast(r.message)
        load()
    })
}
</script>

<template>
    <div class="screen">
        <div class="header">
            <h3>🌱 {{ form.name || '' }}님의 농부일지</h3>
            <p>인도자 {{ authorName }} · 지금 단계 {{ stageDisplay() }}</p>
        </div>

        <div v-if="loading" style="text-align:center;padding:20px;">불러오는 중...</div>
        <template v-else>
            <div class="fj-section">
                <label>신앙여부</label>
                <select class="input-card" v-model="form.faithStatus" :disabled="!isEditable">
                    <option value="">선택</option>
                    <option v-for="(label, code) in FAITH_LABEL_MAP" :key="code" :value="code">{{ label }}</option>
                </select>
            </div>

            <div class="fj-stage-header">🌰 1단계 (씨앗)</div>
            <div class="fj-grid">
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

            <div class="fj-stage-header">🌿 2단계 (새싹)</div>
            <div class="fj-grid">
                <div class="fj-field"><label>학교/학과 or 직장</label><input type="text" class="input-card" v-model="form.schoolMajor" :disabled="!isEditable"></div>
                <div class="fj-field"><label>성격</label><textarea class="input-card" v-model="form.personality" :disabled="!isEditable"></textarea></div>
                <div class="fj-field"><label>취미/관심사</label><textarea class="input-card" v-model="form.hobby" :disabled="!isEditable"></textarea></div>
                <div class="fj-field"><label>이성친구 유무</label><input type="text" class="input-card" v-model="form.hasPartner" :disabled="!isEditable"></div>
                <div class="fj-field"><label>가족관계</label><textarea class="input-card" v-model="form.familyRelation" :disabled="!isEditable"></textarea></div>
                <div class="fj-field"><label>1년 환경(동아리, 알바, 여행 일정)</label><textarea class="input-card" v-model="form.environment" :disabled="!isEditable"></textarea></div>
            </div>

            <div class="fj-stage-header">🍀 3단계 (떡잎)</div>
            <div class="fj-grid">
                <div class="fj-field"><label>되고싶은 모습</label><textarea class="input-card" v-model="form.desiredImage" :disabled="!isEditable"></textarea></div>
                <div class="fj-field"><label>최근 고민</label><textarea class="input-card" v-model="form.recentConcern" :disabled="!isEditable"></textarea></div>
                <div class="fj-field"><label>가족분위기</label><textarea class="input-card" v-model="form.familyAtmosphere" :disabled="!isEditable"></textarea></div>
                <div class="fj-field"><label>인간관계</label><textarea class="input-card" v-model="form.humanRelations" :disabled="!isEditable"></textarea></div>
            </div>

            <div class="fj-stage-header">📝 기타</div>
            <div class="fj-grid">
                <div class="fj-field"><label>특이사항(비합요소, 컴플렉스, 낯선사람에 대한 경계도 등)</label><textarea class="input-card" v-model="form.noteSpecial" :disabled="!isEditable"></textarea></div>
                <div class="fj-field"><label>인도자의 개인적인 소견 한줄</label><textarea class="input-card" v-model="form.guideComment" :disabled="!isEditable"></textarea></div>
            </div>

            <button v-if="isEditable" class="btn" :disabled="saving" @click="save">
                {{ saving ? '저장 중...' : '저장하기 📨' }}
            </button>
            <p v-else class="fj-readonly-note">👀 인도자 본인만 쓸 수 있어요 — 열람만 가능</p>
        </template>
    </div>
</template>

<style scoped>
.fj-section {
    margin-bottom: 10px;
}
.fj-stage-header {
    margin: 20px 0 10px;
    font-size: 15px;
    font-weight: bold;
    color: #5D4037;
    border-bottom: 2px solid #EFEBE9;
    padding-bottom: 6px;
}
.fj-grid {
    display: flex;
    flex-direction: column;
}
.fj-field {
    margin-bottom: 14px;
}
.fj-readonly-note {
    text-align: center;
    color: #8B95A1;
    font-size: 13px;
    margin-top: 20px;
}
</style>
