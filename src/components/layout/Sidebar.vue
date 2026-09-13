<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { usePopup } from '@/composables/usePopup'
import { useApi, tokenStore } from '@/composables/useApi'
import { useRoles } from '@/composables/useRoles'
import MyGoalModal from '@/components/sidebar/MyGoalModal.vue'
import ActivityVenueModal from '@/components/sidebar/ActivityVenueModal.vue'
import WeeklyTemplateModal from '@/components/weekly/WeeklyTemplateModal.vue'
import SemesterCalendarModal from '@/components/sidebar/SemesterCalendarModal.vue'

const router = useRouter()
const auth = useAuthStore()
const { showAppAlert, showAppConfirm, showPopup, closePopup, showPasswordPrompt } = usePopup()
const { callApi, callApiPromise } = useApi()
const { hasRegionRole, hasTeamRole } = useRoles()

// 주간 일정 템플릿 권한 — backend dailyReport.js canAccess*Template 와 동일 룰.
// hasTeamRole 은 useRoles 에서 이미 region 자동 포함. admin 도 OR.
const canViewTeamTemplate = computed(() => auth.isAdmin || hasTeamRole.value)
const canViewRegionTemplate = computed(() => auth.isAdmin || hasRegionRole.value)

const isOpen = ref(false)

// 사이드바 모달 토글 state
// null | 'myGoal' | 'activityVenue' | 'weeklyTemplate' | 'semesterCalendar'
const activeModal = ref(null)
const weeklyScope = ref('personal')  // 'personal' | 'team' | 'region'
const weeklyTeam = ref('')
function openModal(name) { close(); activeModal.value = name }
function closeModal() { activeModal.value = null }

function open() { isOpen.value = true }
function close() { isOpen.value = false }

function goTo(name) { close(); router.push({ name }) }

function openPersonalStats() { close(); router.push({ name: 'personalStats' }) }

function openMyScrap() { close(); router.push({ name: 'boardMain', query: { tab: 'scrap' } }) }

function openMyPosts() {
    close()
    callApi('/api/my-archive', { sabun: auth.currentSabun, type: 'posts' }, (r) => {
        if (!r.success) return showAppAlert('데이터를 불러오지 못했어.')
        let html = '<div style="max-height:60vh; overflow-y:auto; padding:5px;">'
        if (r.list.length === 0) {
            html += '<div style="text-align:center; padding:20px; color:#888;">아직 작성한 글이 없어!</div>'
        } else {
            r.list.forEach(p => {
                const date = new Date(p.dateStr).toLocaleDateString()
                html += `<div style="background:#fff; padding:15px; border-radius:10px; border:1px solid #eee; margin-bottom:10px; cursor:pointer;" onclick="window.__openPost('${p.id}')">${p.title}<br><span style="font-size:12px;color:#888;">${date}</span></div>`
            })
        }
        html += '</div><div class="btn-group" style="margin-top:15px;"><button class="btn-neg" onclick="window.__closePopup()">닫기</button></div>'
        window.__openPost = (id) => { closePopup(); router.push({ name: 'postDetail', params: { id } }) }
        window.__closePopup = () => closePopup()
        showPopup('custom', '✏️ 내가 쓴 글', '', null, { html, raw: true })
    })
}

function openMyReports() {
    close()
    callApi('/api/my-archive', { sabun: auth.currentSabun, type: 'reports' }, (r) => {
        if (!r.success) return showAppAlert('데이터를 불러오지 못했어.')
        let html = '<div style="max-height:60vh; overflow-y:auto; padding:5px;">'
        if (r.list.length === 0) html += '<div style="text-align:center; padding:20px; color:#888;">기록 없음</div>'
        else r.list.forEach(rep => {
            html += `<div style="background:#fff; padding:15px; border-radius:12px; margin-bottom:10px; border:1px solid #eee;"><b>${rep.date?.split(' ')[0] || ''}</b> | 기분:${rep.mood}<br><span style="font-size:13px;color:#666;">${rep.activity}</span></div>`
        })
        html += '</div>'
        showPopup('custom', '🌱 내 일일보고', '', null, { html, raw: true })
    })
}

function openMyPrayers() {
    close()
    callApi('/api/my-archive', { sabun: auth.currentSabun, type: 'prayers' }, (r) => {
        if (!r.success) return showAppAlert('데이터를 불러오지 못했어.')
        let html = '<div style="max-height:60vh; overflow-y:auto; padding:5px;">'
        if (r.list.length === 0) html += '<div style="text-align:center; padding:20px; color:#888;">기록 없음</div>'
        else r.list.forEach(p => {
            const date = new Date(p.dateStr).toLocaleDateString()
            const badge = p.status === 'sent' ? '<span style="color:#1565C0;">✨</span>' : '<span style="color:#E65100;">🕊️</span>'
            html += `<div style="background:#fff; padding:15px; border-radius:12px; margin-bottom:10px; border:1px solid #eee;"><b>${date}</b> ${badge}<br><span style="font-size:14px;color:#333;white-space:pre-wrap;">${p.content}</span></div>`
        })
        html += '</div>'
        showPopup('custom', '🙏 내 향연 기록', '', null, { html, raw: true })
    })
}

function openAdminMode() {
    close()
    showPasswordPrompt(async (ok, password) => {
        if (!ok) return
        try {
            const r = await callApiPromise('/api/admin-unlock', { password })
            if (!r.success) return showAppAlert(r.message || '비밀번호가 틀렸어!')
            tokenStore.setTokens({ accessToken: r.accessToken, refreshToken: r.refreshToken })
            router.push({ name: 'admin' })
        } catch (e) {
            showAppAlert('서버 오류가 났어. 다시 시도해봐!')
        }
    })
}

function doLogout() {
    close()
    showAppConfirm('로그아웃 할거야?', (yes) => {
        if (yes) { auth.logout(); location.reload() }
    })
}

// 주간 일정 템플릿 (개인/팀/지역)
function openWeeklyTemplate(scope) {
    close()
    // 팀 scope + 관리자 → 팀 입력 팝업 (시스템 prompt 대신 인앱 팝업)
    if (scope === 'team' && auth.isAdmin) {
        showPopup('text', '편집할 지역 번호 (예: 3)?', '', (res) => {
            if (!res || res.text === undefined) return
            const t = String(res.text).trim()
            if (!t) return
            weeklyTeam.value = t
            weeklyScope.value = scope
            activeModal.value = 'weeklyTemplate'
        }, { value: auth.currentUserTeam || '' })
        return
    }
    weeklyTeam.value = auth.currentUserTeam || ''
    weeklyScope.value = scope
    activeModal.value = 'weeklyTemplate'
}

// 개강 일정 달력
function openSemesterCalendar() {
    openModal('semesterCalendar')
}

defineExpose({ open, close })
</script>

<template>
    <div v-if="isOpen" class="sidebar-overlay" @click="close"></div>
    <div class="sidebar" :class="{ open: isOpen }">
        <div class="sidebar-header">
            <div class="sidebar-profile">
                <span class="profile-emoji">{{ auth.isAdmin ? '👑' : '🦔' }}</span>
                <div>
                    <div class="profile-name">{{ auth.currentUserName || '이름없음' }}</div>
                    <div class="profile-team">{{ auth.currentUserTeam }} {{ auth.currentUserArea }}</div>
                </div>
            </div>
            <span class="sidebar-close" @click="close">×</span>
        </div>
        <div class="sidebar-content">
            <!-- <div class="sidebar-section">
                <div class="sidebar-title">📊 나의 사역 통계</div>
                <div class="sidebar-item" @click="openPersonalStats">📈 내 사역 통계 분석</div>
            </div>

            <div class="sidebar-section">
                <div class="sidebar-title">📁 내 서랍장</div>
                <div class="sidebar-item" @click="openMyScrap">🔖 내 스크랩북</div>
                <div class="sidebar-item" @click="openMyPosts">✏️ 내가 쓴 글</div>
                <div class="sidebar-item" @click="openMyReports">🌱 내 일일보고/잎사귀</div>
                <div class="sidebar-item" @click="openMyPrayers">🙏 내 향연 기록</div>
                <div class="sidebar-item" @click="openWeeklyTemplate('personal')">📅 내 주간 일정 템플릿</div>
                <div v-if="canViewTeamTemplate" class="sidebar-item" @click="openWeeklyTemplate('team')">📅 지역 주간 일정 템플릿</div>
                <div v-if="canViewRegionTemplate" class="sidebar-item" @click="openWeeklyTemplate('region')">📅 수지역 주간 일정 템플릿</div>
            </div>

            <div class="sidebar-section">
                <div class="sidebar-title">🛠️ 사역 지원 도구</div>
                <div class="sidebar-item" @click="openModal('tateamRegister')">🤝 타지역 교사건 등록</div>
                <div class="sidebar-item" @click="openSemesterCalendar">📅 개강 일정 달력</div>
                <div class="sidebar-item" @click="openModal('myGoal')">🏆 내 목표 설정</div>
                <div v-if="canViewTeamTemplate" class="sidebar-item" @click="openModal('activityVenue')">📍 활동지 입력</div>
            </div> -->

            <div class="sidebar-section">
                <div class="sidebar-title">🏆 주간 점수제</div>
                <div class="sidebar-item" @click="goTo('weeklyScore')">📊 이번 주 현황</div>
                <div class="sidebar-item" @click="goTo('leaderboard')">🥇 리더보드</div>
            </div>

            <div class="sidebar-section">
                <div class="sidebar-title">⚙️ 시스템 및 관리</div>
                <div class="sidebar-item" @click="openAdminMode">👑 사명의 길 (관리자)</div>
                <div class="sidebar-item" style="color:#F44336; font-weight:bold;" @click="doLogout">🚪 로그아웃</div>
            </div>
        </div>
    </div>

    <!-- 사이드바 모달 (v-if 토글) -->
    <MyGoalModal v-if="activeModal === 'myGoal'" @close="closeModal" />
    <ActivityVenueModal v-if="activeModal === 'activityVenue'" @close="closeModal" />
    <WeeklyTemplateModal v-if="activeModal === 'weeklyTemplate'"
        :scope="weeklyScope" :team="weeklyTeam" @close="closeModal" />
    <SemesterCalendarModal v-if="activeModal === 'semesterCalendar'" @close="closeModal" />
</template>
