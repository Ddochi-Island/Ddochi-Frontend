<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useApi } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const { callApi, callApiPromise } = useApi()
const { showAppAlert, showPasswordPrompt } = usePopup()

// editPlan 마이크로 팝업

const showEditPlanPopup = ref(false)
const editPlanData = ref(null)
const editPlanTime = ref(0)
const editPlanCategory = ref(null)
const editPlanCategories = ref([])
const editPlanSaving = ref(false)

function goTo(name) { router.push({ name }) }

async function openEditPlanPopup(docId) {
    const r = await callApiPromise('/api/get-plan-execution', { docId })
    if (!r.success) return showAppAlert(r.message)

    editPlanData.value = { ...r.data, docId }
    const plans = r.data.expectedPlans || []
    editPlanTime.value = plans.length * 0.5
    editPlanCategory.value = plans.length > 0 ? { name: plans[0].name, color: plans[0].color, type: plans[0].type } : null

    const targetTeam = auth.isAdmin ? '공통' : (auth.currentUserTeam || '미배정')
    const catRes = await callApiPromise('/api/manage-ministry-categories', { action: 'get', team: targetTeam })
    editPlanCategories.value = catRes.success ? catRes.list : []
    showEditPlanPopup.value = true
}

function changeEditPlanTime(amount) {
    editPlanTime.value = Math.max(0, editPlanTime.value + amount)
}

function selectEditCategory(cat) {
    editPlanCategory.value = { name: cat.name, color: cat.color, type: cat.type }
}

async function submitEditPlan() {
    if (editPlanTime.value === 0) return showAppAlert("시간이 0시간이라면, 텔레그램에서 [❌못함] 버튼을 눌러주세요!")
    if (!editPlanCategory.value) return showAppAlert("사역 카테고리를 선택해주세요!")

    const actualPlans = []
    const loops = editPlanTime.value / 0.5
    for (let i = 0; i < loops; i++) {
        actualPlans.push({ time: `수정됨_${i}`, name: editPlanCategory.value.name, color: editPlanCategory.value.color, type: editPlanCategory.value.type })
    }

    editPlanSaving.value = true
    const r = await callApiPromise('/api/update-plan-execution', { docId: editPlanData.value.docId, actualPlans })
    editPlanSaving.value = false
    if (r.success) {
        showEditPlanPopup.value = false
        showAppAlert('수정 완료! 고생하셨습니다 🔥')
    } else {
        showAppAlert('저장 실패: ' + r.message)
    }
}

async function openErp() {
    showPasswordPrompt(async (ok, password) => {
        if (!ok) return
        const r = await callApiPromise('/api/admin-unlock', { password })
        if (!r.success) return showAppAlert(r.message || '비밀번호가 틀렸어!')
        window.open('https://erp.ddochi.cloud', '_blank')
    })
}

function openOnlineIntake() {
    router.push('/online-intake')
}

// 건의함
const showSuggestionModal = ref(false)
const suggestionSubject = ref('')
const suggestionContent = ref('')
const suggestionSubmitting = ref(false)
const suggestionSubjectRef = ref(null)

function openSuggestionModal() {
    showSuggestionModal.value = true
    nextTick(() => suggestionSubjectRef.value?.focus())
}

async function submitSuggestion() {
    if (!suggestionSubject.value.trim()) return showAppAlert('주제를 입력해주세요.')
    if (!suggestionContent.value.trim()) return showAppAlert('내용을 입력해주세요.')
    suggestionSubmitting.value = true
    const r = await callApiPromise('/api/suggestions/submit', {
        subject: suggestionSubject.value.trim(),
        content: suggestionContent.value.trim(),
    })
    suggestionSubmitting.value = false
    if (r.success) {
        showSuggestionModal.value = false
        suggestionSubject.value = ''
        suggestionContent.value = ''
        showAppAlert('건의가 전달됐어요 :)')
    } else {
        showAppAlert(r.message || '전송 실패')
    }
}

function openSunhanYanghagi() {
    router.push('/sunhan-yanghagi')
}

function openQualityFind() {
    router.push('/quality-find')
}

const showSunhan = computed(() => {
    const num = auth.currentUserTeam?.match(/(\d+)/)?.[1]
    return ['1', '3', '5'].includes(num) || ['수지역장', '전도교관', '총무'].includes(auth.currentUserRole)
})

const showQuality = computed(() => {
    const num = auth.currentUserTeam?.match(/(\d+)/)?.[1]
    return ['2', '4', '6'].includes(num) || ['수지역장', '전도교관', '총무'].includes(auth.currentUserRole) || auth.currentSabun === '00291203-00013'
})

function checkStatsPassword() {
    if (auth.isAdmin) { router.push({ name: 'statistics' }); return }
    callApi('/api/get-stats-password', {}, (r) => {
        showPasswordPrompt((ok) => { if (ok) router.push({ name: 'statistics' }) }, r.password || '0000')
    })
}

onMounted(() => {
    if (route.query.editPlan) {
        openEditPlanPopup(route.query.editPlan)
    }
})
</script>

<template>
    <div class="screen">
        <div class="home-header">
            <h3>안녕, {{ auth.currentUserName }}또치! 👋</h3>
            <p>오늘도 승리하는 하루 보내자! 🔥</p>
        </div>

        <div class="pipeline-section">
            <div v-if="showSunhan" class="pipeline-banner" style="background:#F1F8E9; border: 1px solid #AED581;" @click="openSunhanYanghagi">
                <div class="pipeline-info"><span class="pipeline-icon">🐑</span><div><div class="pipeline-title">선한 양치기</div><div class="pipeline-desc">진짜 sheep다 오프찾</div></div></div>
                <div class="pipeline-arrow">➔</div>
            </div>
            <div v-if="showQuality" class="pipeline-banner" style="background:#E8F5E9; border: 1px solid #81C784;" @click="openQualityFind">
                <div class="pipeline-info"><span class="pipeline-icon">🌿</span><div><div class="pipeline-title">질적 찾기</div><div class="pipeline-desc">질적 찾기 오프찾</div></div></div>
                <div class="pipeline-arrow">➔</div>
            </div>
            <div class="pipeline-banner" style="background:#FFF3E0; border: 1px solid #FFCC80;" @click="goTo('dailyReport')">
                <div class="pipeline-info"><span class="pipeline-icon">🌱</span><div><div class="pipeline-title">일일보고</div><div class="pipeline-desc">오늘 하루 사역 기록</div></div></div>
                <div class="pipeline-arrow">➔</div>
            </div>
            <div class="pipeline-banner" style="background:#E8F5E9; border: 1px solid #A5D6A7;" @click="goTo('habjaeyang')">
                <div class="pipeline-info"><span class="pipeline-icon">📑</span><div><div class="pipeline-title">합재양 작성</div><div class="pipeline-desc">만남 합재양 작성 및 관리</div></div></div>
                <div class="pipeline-arrow">➔</div>
            </div>
            <div class="pipeline-banner" style="background:#E0F7FA; border: 1px solid #80DEEA;" @click="goTo('shortCard')">
                <div class="pipeline-info"><span class="pipeline-icon">📍</span><div><div class="pipeline-title">짧카 작성</div><div class="pipeline-desc">농부일지에 채울 지인 작성</div></div></div>
                <div class="pipeline-arrow">➔</div>
            </div>
            <div class="pipeline-banner" style="background:#FFF8E1; border: 1px solid #FFF59D;" @click="goTo('matching')">
                <div class="pipeline-info"><span class="pipeline-icon">🛡️</span><div><div class="pipeline-title">매칭 절대 지켜!</div><div class="pipeline-desc">약속이 잡힌 만남 현황</div></div></div>
                <div class="pipeline-arrow">➔</div>
            </div>

            <div class="pipeline-banner" style="background:#FCE4EC; border: 1px solid #F48FB1;" @click="openOnlineIntake">
                <div class="pipeline-info"><span class="pipeline-icon">🌐</span><div><div class="pipeline-title">온라인 유입확인</div><div class="pipeline-desc">유입시트 자동연동 현황</div></div></div>
                <div class="pipeline-arrow">➔</div>
            </div>
            <div class="pipeline-banner" style="background:#E3F2FD; border: 1px solid #90CAF9;" @click="openErp">
                <div class="pipeline-info"><span class="pipeline-icon">🗂️</span><div><div class="pipeline-title">ERP</div><div class="pipeline-desc">데이터 관리 시스템</div></div></div>
                <div class="pipeline-arrow">➔</div>
            </div>
            <div class="pipeline-banner" style="background:#E8F5E9; border: 1px solid #A5D6A7;" @click="goTo('feedback')">
                <div class="pipeline-info"><span class="pipeline-icon">⏱️</span><div><div class="pipeline-title">15분 피드백</div><div class="pipeline-desc">지역장/전도교관 피드백 신청</div></div></div>
                <div class="pipeline-arrow">➔</div>
            </div>
            <div class="pipeline-banner" style="background:#F3E5F5; border: 1px solid #CE93D8;" @click="openSuggestionModal">
                <div class="pipeline-info"><span class="pipeline-icon">📬</span><div><div class="pipeline-title">건의하기</div><div class="pipeline-desc">개발자에게 건의사항 전달</div></div></div>
                <div class="pipeline-arrow">➔</div>
            </div>
        </div>

        <!-- 건의함 모달 -->
        <teleport to="body">
            <div v-if="showSuggestionModal" class="editor-overlay" @click.self="showSuggestionModal = false">
                <div class="editor-popup">
                    <div class="editor-header">
                        <span class="editor-title">📬 개발자에게 건의하기</span>
                        <span class="editor-close" @click="showSuggestionModal = false">×</span>
                    </div>
                    <div class="editor-body">
                        <p style="font-size:13px; color:#888; margin-bottom:12px;">불편한 점, 추가됐으면 하는 기능을 남겨주세요.</p>
                        <div style="font-size:13px; font-weight:600; margin-bottom:4px;">주제</div>
                        <input
                            ref="suggestionSubjectRef"
                            v-model="suggestionSubject"
                            placeholder="예) 버튼 추가 요청"
                            style="width:100%; box-sizing:border-box; padding:10px; border:1px solid #ddd; border-radius:8px; font-size:14px; margin-bottom:12px;"
                        />
                        <div style="font-size:13px; font-weight:600; margin-bottom:4px;">내용</div>
                        <textarea
                            v-model="suggestionContent"
                            placeholder="내용을 입력하세요"
                            rows="5"
                            style="width:100%; box-sizing:border-box; padding:10px; border:1px solid #ddd; border-radius:8px; font-size:14px; resize:none;"
                        />
                        <button
                            class="editor-save-btn"
                            style="margin-top:12px; background:#7B1FA2;"
                            :disabled="suggestionSubmitting"
                            @click="submitSuggestion"
                        >
                            {{ suggestionSubmitting ? '전송 중...' : '전송하기' }}
                        </button>
                    </div>
                </div>
            </div>
        </teleport>

        <!-- editPlan 마이크로 팝업 -->
        <teleport to="body">
            <div v-if="showEditPlanPopup && editPlanData" class="editor-overlay">
                <div class="editor-popup" style="max-height:80vh;">
                    <div class="editor-header">
                        <span class="editor-title">🤔 어떻게 진행했어?</span>
                        <span class="editor-close" @click="showEditPlanPopup = false">×</span>
                    </div>
                    <div class="editor-body" style="text-align:center;">
                        <div style="font-size:13px; color:#888; margin-bottom:15px;">({{ editPlanData.startTime }} ~ {{ editPlanData.endTime }} 사역 점검)</div>

                        <div style="font-size:15px; font-weight:bold; color:#5D4037; margin-bottom:10px;">⏱️ 실제 투자한 시간</div>
                        <div class="edit-time-control">
                            <button class="edit-time-btn" @click="changeEditPlanTime(-0.5)">-</button>
                            <div class="edit-time-display">{{ editPlanTime }} <span style="font-size:14px; color:#888;">시간</span></div>
                            <button class="edit-time-btn" @click="changeEditPlanTime(0.5)">+</button>
                        </div>

                        <div style="font-size:15px; font-weight:bold; color:#5D4037; margin:20px 0 10px;">🗂️ 실제 진행한 사역</div>
                        <div style="font-size:11px; color:#888; margin-bottom:8px;">(터치해서 변경)</div>
                        <div class="edit-cat-list">
                            <div
                                v-for="cat in editPlanCategories"
                                :key="cat.id"
                                class="edit-cat-item"
                                :class="{ selected: editPlanCategory?.name === cat.name }"
                                :style="{ background: cat.color }"
                                @click="selectEditCategory(cat)"
                            >{{ cat.name }}</div>
                        </div>

                        <button class="editor-save-btn" style="margin-top:25px; background:#4CAF50;" @click="submitEditPlan" :disabled="editPlanSaving">
                            {{ editPlanSaving ? '저장 중...' : '💾 이대로 저장하기' }}
                        </button>
                    </div>
                </div>
            </div>
        </teleport>
    </div>
</template>

<style scoped>
.editor-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.5);
    z-index: 9999;
    display: flex;
    align-items: flex-end;
    justify-content: center;
}
.editor-popup {
    background: #fff;
    width: 100%;
    max-width: 500px;
    max-height: 90vh;
    border-radius: 24px 24px 0 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
.editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid #eee;
    position: sticky;
    top: 0;
    background: #fff;
    z-index: 10;
}
.editor-title {
    font-size: 18px;
    font-weight: bold;
}
.editor-close {
    font-size: 24px;
    cursor: pointer;
    color: #888;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
}
.editor-body {
    padding: 15px 20px 20px;
    overflow-y: auto;
    flex: 1;
}
.editor-save-btn {
    width: 100%;
    padding: 15px;
    border-radius: 12px;
    font-size: 16px;
    background: #FF9800;
    color: white;
    border: none;
    font-family: 'Jua';
    font-weight: bold;
    cursor: pointer;
    margin-top: 20px;
}
.editor-save-btn:disabled {
    opacity: 0.5;
}
.edit-time-control {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 20px;
    margin-bottom: 15px;
    background: #f9f9f9;
    padding: 15px;
    border-radius: 15px;
    border: 1px solid #eee;
}
.edit-time-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: none;
    background: #E0E0E0;
    font-size: 20px;
    font-weight: bold;
    color: #333;
    cursor: pointer;
}
.edit-time-display {
    font-size: 24px;
    font-weight: bold;
    color: #5D4037;
    width: 80px;
    text-align: center;
}
.edit-cat-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
    margin-top: 10px;
}
.edit-cat-item {
    padding: 8px 12px;
    border-radius: 15px;
    font-weight: bold;
    font-size: 13px;
    color: white;
    cursor: pointer;
    border: 1px solid #eee;
    opacity: 0.7;
    transition: 0.2s;
}
.edit-cat-item.selected {
    border: 3px solid #333;
    transform: scale(1.05);
    opacity: 1;
}
</style>
