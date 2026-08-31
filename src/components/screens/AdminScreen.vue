<script setup>
import { ref, inject } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { useApi, tokenStore } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'
import TelegramConnectModal from '@/components/admin/TelegramConnectModal.vue'
import GoalSettingModal from '@/components/admin/GoalSettingModal.vue'
import ActivityCoordModal from '@/components/admin/ActivityCoordModal.vue'
import ActivityReportModal from '@/components/admin/ActivityReportModal.vue'
import CurrentScheduleModal from '@/components/admin/CurrentScheduleModal.vue'
import ScheduleRegisterModal from '@/components/admin/ScheduleRegisterModal.vue'
import SheetConfigModal from '@/components/admin/SheetConfigModal.vue'
import WeekStartGlobalModal from '@/components/admin/WeekStartGlobalModal.vue'
import ToolManagementModal from '@/components/admin/ToolManagementModal.vue'
import PathManagementModal from '@/components/admin/PathManagementModal.vue'
import ReflectionViewerModal from '@/components/admin/ReflectionViewerModal.vue'
import MinistryCategoryModal from '@/components/admin/MinistryCategoryModal.vue'
import NotificationTimeModal from '@/components/admin/NotificationTimeModal.vue'
import AdminAuditLogModal from '@/components/admin/AdminAuditLogModal.vue'
import AutoRejectModal from '@/components/admin/AutoRejectModal.vue'
import BoardManagementModal from '@/components/admin/BoardManagementModal.vue'
import ReturnHomeSettingModal from '@/components/admin/ReturnHomeSettingModal.vue'
import AuthConfigModal from '@/components/admin/AuthConfigModal.vue'
import TelRouterDashboardModal from '@/components/admin/TelRouterDashboardModal.vue'
import UserManagementModal from '@/components/admin/UserManagementModal.vue'
import IntakeSyncModal from '@/components/admin/IntakeSyncModal.vue'
import { adminMenuItems } from '@/constants'

const router = useRouter()
const auth = useAuthStore()
const debugMode = inject('debugMode')
const ui = useUiStore()
const { callApi, callApiPromise } = useApi()
const { showAppAlert, showAppConfirm } = usePopup()

// 시스템 모니터 (외부) — 모진호 운영 hw-monitor
const SYSTEM_MONITOR_URL = 'https://hw-monitor.ddochi.cloud/'

// [2026-04-22] 설정 모달 토글 state. null | 'telegramConnect' | 'goalSetting' | ...
const activeModal = ref(null)
function openModal(name) { activeModal.value = name }
function closeModal() { activeModal.value = null }

// 배선 완료된 모달 이름 집합 (stub 과 구분)
const WIRED_MODALS = new Set(['userManagement', 'telegramConnect', 'goalSetting', 'activityCoord', 'activityReport', 'currentSchedule', 'scheduleRegister', 'sheetConfig', 'weekStartGlobal', 'toolManagement', 'pathManagement', 'ministryCategory', 'notificationTime', 'auditLog', 'autoReject', 'returnHome', 'boardManagement', 'authConfig', 'reflectionViewer', 'intakeSync'])

function openWeeklyRecord() {
  router.push({ name: 'weeklyRecord' })
}
function openSystemMonitor() {
  window.open(SYSTEM_MONITOR_URL, '_blank', 'noopener,noreferrer')
}
function openCronLogs() {
  const token = tokenStore.getAccess()
  const url = token ? `/api/cron-logs?token=${encodeURIComponent(token)}` : '/api/cron-logs'
  window.open(url, '_blank', 'noopener,noreferrer')
}

function handleAdminAction(action) {
  if (action === 'syncStats') { syncStatistics(); return }
  if (WIRED_MODALS.has(action)) { openModal(action); return }
  showAppAlert(`${action} 기능은 준비 중입니다.`)
}

function toggleDebugMode() {
  debugMode.value = !debugMode.value
  localStorage.setItem('ddochi_debug', debugMode.value ? 'true' : 'false')
  showAppAlert(debugMode.value ? '디버그 모드 ON 🛠️' : '디버그 모드 OFF')
}

// 건의함
const showSuggestionsPanel = ref(false)
const suggestionsList = ref([])
const suggestionsLoading = ref(false)

async function openSuggestionsPanel() {
  showSuggestionsPanel.value = true
  suggestionsLoading.value = true
  const r = await callApiPromise('/api/suggestions/list', {})
  suggestionsLoading.value = false
  suggestionsList.value = r.success ? r.list : []
}

function syncStatistics() {
  showAppConfirm('시트 데이터를 지금 갱신하시겠습니까?', (yes) => {
    if (yes) {
      ui.setProcessing(true)
      // Phase 14-E: legacy /api/sync-stats stub 제거 후 V3.14 sheet-sync 로 alias.
      callApi('/api/sheet-sync/trigger', {}, (r) => {
        ui.setProcessing(false)
        if (r.success) {
          showAppAlert(`동기화 완료: ${r.ok_count || 0} ok / ${r.failed_count || 0} failed (${Math.round((r.elapsedMs || 0) / 1000)}초)`)
        } else {
          showAppAlert(r.message || '동기화 실패')
        }
      })
    }
  })
}
</script>

<template>
  <div class="admin-screen">
    <div class="header">
      <span class="header-emoji">👑</span>
      <h3>사명의 길</h3>
      <p>{{ auth.currentUserTeam }} 설정</p>
    </div>

    <!-- Admin Menu (메인에 바로 표시) -->
    <div class="btn-col" style="margin-bottom: 20px;">
      <button v-for="item in adminMenuItems" :key="item.action" class="btn-pos" :style="{ background: item.color }" @click="handleAdminAction(item.action)">
        {{ item.label }}
      </button>
      <div style="border-top:1px dashed #ccc; margin:10px 0;"></div>
      <button class="btn-pos" style="background:#00838F;" @click="openSystemMonitor()">🖥️ 시스템 모니터</button>
      <button class="btn-pos" style="background:#1a237e;" @click="openModal('telRouterDashboard')">📡 텔레그램 라우터 대시보드</button>
      <button class="btn-pos" style="background:#37474F;" @click="openCronLogs()">📋 크론 로그 보기</button>
      <button class="btn-pos" style="background:#455A64;" @click="openModal('authConfig')">🔑 인증 설정 (패스키/토큰)</button>
      <button class="btn-pos" style="background:#607D8B;" @click="openModal('auditLog')">📋 설정 변경 로그</button>
      <button class="btn-pos" :style="{ background: debugMode ? '#4CAF50' : '#9E9E9E' }" @click="toggleDebugMode()">
        🛠️ 디버그 모드 {{ debugMode ? 'ON' : 'OFF' }}
      </button>
      <button class="btn-pos" style="background:#7B1FA2;" @click="openSuggestionsPanel()">📬 건의함 열람</button>
    </div>

    <!-- 건의함 패널 -->
    <div v-if="showSuggestionsPanel" style="margin-bottom:20px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <strong style="font-size:15px;">📬 건의함</strong>
        <span style="cursor:pointer; color:#999; font-size:20px;" @click="showSuggestionsPanel = false">×</span>
      </div>
      <div v-if="suggestionsLoading" style="text-align:center; color:#aaa; padding:20px;">불러오는 중...</div>
      <div v-else-if="!suggestionsList.length" style="text-align:center; color:#aaa; padding:20px;">건의 내용이 없어요.</div>
      <div v-else>
        <div v-for="item in suggestionsList" :key="item.num" style="background:#fafafa; border:1px solid #eee; border-radius:8px; padding:12px; margin-bottom:8px;">
          <div style="font-size:12px; color:#888; margin-bottom:6px;">#{{ item.num }} · {{ item.author_name }} · {{ item.created_at }}</div>
          <div style="font-size:13px; font-weight:600; color:#555; margin-bottom:4px;">주제: {{ item.subject }}</div>
          <div style="font-size:14px; white-space:pre-wrap; color:#333;">{{ item.content }}</div>
        </div>
      </div>
    </div>

    <!-- 설정 모달 (v-if 로 토글) -->
    <UserManagementModal v-if="activeModal === 'userManagement'" @close="closeModal" />
    <TelegramConnectModal v-if="activeModal === 'telegramConnect'" @close="closeModal" />
    <GoalSettingModal v-if="activeModal === 'goalSetting'" @close="closeModal" />
    <ActivityCoordModal v-if="activeModal === 'activityCoord'" @close="closeModal" />
    <ActivityReportModal v-if="activeModal === 'activityReport'" @close="closeModal" />
    <CurrentScheduleModal v-if="activeModal === 'currentSchedule'" @close="closeModal" />
    <ScheduleRegisterModal v-if="activeModal === 'scheduleRegister'" @close="closeModal" />
    <SheetConfigModal v-if="activeModal === 'sheetConfig'" @close="closeModal" />
    <WeekStartGlobalModal v-if="activeModal === 'weekStartGlobal'" @close="closeModal" />
    <ToolManagementModal v-if="activeModal === 'toolManagement'" @close="closeModal" />
    <PathManagementModal v-if="activeModal === 'pathManagement'" @close="closeModal" />
    <ReflectionViewerModal v-if="activeModal === 'reflectionViewer'" @close="closeModal" />
    <MinistryCategoryModal v-if="activeModal === 'ministryCategory'" @close="closeModal" />
    <NotificationTimeModal v-if="activeModal === 'notificationTime'" @close="closeModal" />
    <AdminAuditLogModal v-if="activeModal === 'auditLog'" @close="closeModal" />
    <AutoRejectModal v-if="activeModal === 'autoReject'" @close="closeModal" />
    <BoardManagementModal v-if="activeModal === 'boardManagement'" @close="closeModal" />
    <ReturnHomeSettingModal v-if="activeModal === 'returnHome'" @close="closeModal" />
    <AuthConfigModal v-if="activeModal === 'authConfig'" @close="closeModal" />
    <TelRouterDashboardModal v-if="activeModal === 'telRouterDashboard'" @close="closeModal" />
    <IntakeSyncModal v-if="activeModal === 'intakeSync'" @close="closeModal" />
  </div>
</template>

<style scoped>
/* 주간 전적 stats 영역은 WeeklyRecordScreen.vue 로 이동 (2026-05-12). */
</style>
