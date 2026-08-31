<script setup>
// 유입시트 자동연동 위저드
// URL 붙여넣기 → 시트 렌더링 → 시작행 클릭 → 열 매핑 → 경로/도구 → 저장
import { ref, computed, onMounted } from 'vue'
import { useApi } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'

const SERVICE_ACCOUNT_EMAIL = 'sheet-bot@telegram-bot-487318.iam.gserviceaccount.com'

const emit = defineEmits(['close'])
const { callApiPromise } = useApi()
const { showAppAlert, showAppConfirm, showToast } = usePopup()

// ── 목록 화면 ──────────────────────────────────────────────────────────────
const viewMode = ref('list')  // 'list' | 'wizard'
const configs = ref([])
const loadingConfigs = ref(false)
const syncingId = ref(null)

async function loadConfigs() {
  loadingConfigs.value = true
  try {
    const r = await callApiPromise('/api/intake/list-configs', {})
    configs.value = r.configs || []
  } catch (e) {
    showAppAlert('목록 로드 실패: ' + e.message)
  } finally {
    loadingConfigs.value = false
  }
}

async function deleteConfig(id, name) {
  showAppConfirm(`"${name}" 연동 설정을 삭제할까요?`, async (yes) => {
    if (!yes) return
    try {
      await callApiPromise('/api/intake/delete-config', { id })
      showToast('삭제됨')
      await loadConfigs()
    } catch (e) {
      showAppAlert('삭제 실패: ' + e.message)
    }
  })
}

async function syncNow(cfg) {
  syncingId.value = cfg.intake_config_id
  try {
    const r = await callApiPromise('/api/intake/sync-now', { id: cfg.intake_config_id })
    if (!r.ok) { showAppAlert('동기화 실패: ' + (r.error || '알 수 없는 오류')); return; }
    showAppAlert(`동기화 완료: ${r.inserted}건 추가됨`)
    await loadConfigs()
  } catch (e) {
    showAppAlert('동기화 실패: ' + e.message)
  } finally {
    syncingId.value = null
  }
}

// ── 위저드 상태 ────────────────────────────────────────────────────────────
// step: 'url' | 'start-row' | 'col-phone' | 'col-name' |
//       'ask-age' | 'col-age' | 'ask-addr' | 'col-addr' |
//       'ask-extra' | 'col-extra' | 'ask-more-extra' |
//       'path' | 'tool' | 'cfg-name' | 'review'
const step = ref('url')
const urlInput = ref('')
const sheetId = ref('')
const tabs = ref([])
const activeTab = ref('')
const rows = ref([])
const loadingSheet = ref(false)

// 매핑 결과
const startRow = ref(null)      // 0-based row index (클릭된 행)
const colDate = ref(null)
const colPhone = ref(null)
const colName = ref(null)
const colAge = ref(null)
const colAddr = ref(null)
const extras = ref([])          // [{colIndex, label, cellsIndex}]

// 팀 / 경로 / 도구
const teamOptions = ref([])       // [{id, name}]
const selectedTeamId = ref('')
const pathOptions = ref([])
const toolOptions = ref([])
const selectedPath = ref('')
const newPathInput = ref('')
const selectedTool = ref('')
const newToolInput = ref('')

// 설정 이름
const cfgName = ref('')

// 현재 extra 추가 중 임시
const pendingExtraLabel = ref('')
const pendingExtraColIndex = ref(null)

const EXTRA_LABELS = [
  { label: '세부설명', cellsIndex: 10 },
  { label: '찾은날짜', cellsIndex: 2 },
]

const STEP_GUIDE = {
  'url': '구글 시트 URL을 붙여넣기 하세요.',
  'start-row': '데이터가 시작되는 행을 클릭하세요.',
  'col-intake-date': '📅 유입일이 있는 열을 클릭하세요.',
  'col-phone': '📞 전화번호가 있는 열을 클릭하세요.',
  'col-name': '👤 이름이 있는 열을 클릭하세요.',
  'ask-age': '나이(연령) 열이 있나요?',
  'col-age': '🎂 나이 열을 클릭하세요.',
  'ask-addr': '거주지 열이 있나요?',
  'col-addr': '🏠 거주지 열을 클릭하세요.',
  'ask-extra': '추가로 저장할 열이 있나요?',
  'col-extra': '저장할 열을 클릭하세요.',
  'ask-more-extra': '또 저장할 열이 있나요?',
  'path': '섭외 경로를 선택하세요.',
  'tool': '도구(유입 경로)를 선택하세요.',
  'team': '🏷️ 이 시트가 어느 팀 유입인지 선택하세요.',
  'cfg-name': '이 연동 설정의 이름을 입력하세요.',
  'review': '설정을 확인하고 저장하세요.',
}

const selectedTeamName = computed(() =>
  teamOptions.value.find(t => t.id === selectedTeamId.value)?.name || '(미선택)'
)

const headerRow = computed(() => rows.value[0] || [])
const maxCols = computed(() => Math.max(...rows.value.map(r => r.length), 0))
const colLabels = computed(() => {
  const labels = []
  for (let i = 0; i < maxCols.value; i++) {
    labels.push(headerRow.value[i] || colLetter(i))
  }
  return labels
})

function colLetter(i) {
  let s = ''
  while (i >= 0) { s = String.fromCharCode(65 + (i % 26)) + s; i = Math.floor(i / 26) - 1 }
  return s
}

// 열 hover 추적 (열 전체 하이라이트용)
const hoveredCol = ref(null)

function isColumnStep() {
  return ['col-intake-date', 'col-phone', 'col-name', 'col-age', 'col-addr', 'col-extra'].includes(step.value)
}

function isRowStep() {
  return step.value === 'start-row'
}

function isSelectedCol(colIdx) {
  return [colDate.value, colPhone.value, colName.value, colAge.value, colAddr.value,
    ...extras.value.map(e => e.colIndex)].includes(colIdx)
}

function colColor(colIdx) {
  if (colIdx === colDate.value)  return '#00838F'
  if (colIdx === colPhone.value) return '#1976D2'
  if (colIdx === colName.value)  return '#7B1FA2'
  if (colIdx === colAge.value)   return '#E65100'
  if (colIdx === colAddr.value)  return '#2E7D32'
  for (const e of extras.value) {
    if (e.colIndex === colIdx) return '#5C6BC0'
  }
  return null
}

async function fetchSheet() {
  if (!urlInput.value.trim()) return
  loadingSheet.value = true
  try {
    const r = await callApiPromise('/api/intake/sheet-meta', { url: urlInput.value.trim() })
    if (!r.ok) return showAppAlert(r.error || '시트 로드 실패')
    sheetId.value = r.sheetId
    tabs.value = r.tabs
    rows.value = r.rows
    activeTab.value = r.tabs[0]?.title || ''
    step.value = 'start-row'
  } catch (e) {
    showAppAlert(e.message || '시트 로드 실패')
  } finally {
    loadingSheet.value = false
  }
}

async function switchTab(tabTitle) {
  if (tabTitle === activeTab.value) return
  activeTab.value = tabTitle
  try {
    const r = await callApiPromise('/api/intake/sheet-tab-rows', { sheetId: sheetId.value, tabName: tabTitle })
    if (r.ok) rows.value = r.rows
  } catch (e) { /* 무시 */ }
}

function onRowClick(rowIdx) {
  if (!isRowStep()) return
  startRow.value = rowIdx
  step.value = 'col-intake-date'
}

function onColClick(colIdx) {
  if (!isColumnStep()) return
  if (step.value === 'col-intake-date') { colDate.value  = colIdx; step.value = 'col-phone'; return }
  if (step.value === 'col-phone') { colPhone.value = colIdx; step.value = 'col-name'; return }
  if (step.value === 'col-name')  { colName.value  = colIdx; step.value = 'ask-age';  return }
  if (step.value === 'col-age')   { colAge.value   = colIdx; step.value = 'ask-addr'; return }
  if (step.value === 'col-addr')  { colAddr.value  = colIdx; step.value = 'ask-extra'; return }
  if (step.value === 'col-extra') {
    pendingExtraColIndex.value = colIdx
    step.value = 'ask-more-extra'
  }
}

function answerYes() {
  if (step.value === 'ask-age')   { step.value = 'col-age';   return }
  if (step.value === 'ask-addr')  { step.value = 'col-addr';  return }
  if (step.value === 'ask-extra') { pendingExtraLabel.value = '세부설명'; step.value = 'col-extra'; return }
  if (step.value === 'ask-more-extra') {
    // 이전 extra 확정
    if (pendingExtraColIndex.value != null) {
      const usedCellsIndices = extras.value.map(e => e.cellsIndex)
      const available = EXTRA_LABELS.filter(l => !usedCellsIndices.includes(l.cellsIndex))
      const cellsIndex = available[0]?.cellsIndex ?? 10
      extras.value.push({ colIndex: pendingExtraColIndex.value, label: pendingExtraLabel.value, cellsIndex })
      pendingExtraColIndex.value = null
    }
    pendingExtraLabel.value = ''
    step.value = 'col-extra'
  }
}

function answerNo() {
  if (step.value === 'ask-age')   { step.value = 'ask-addr'; return }
  if (step.value === 'ask-addr')  { step.value = 'ask-extra'; return }
  if (step.value === 'ask-extra') { loadPathTool(); return }
  if (step.value === 'ask-more-extra') {
    if (pendingExtraColIndex.value != null) {
      const usedCellsIndices = extras.value.map(e => e.cellsIndex)
      const available = EXTRA_LABELS.filter(l => !usedCellsIndices.includes(l.cellsIndex))
      const cellsIndex = available[0]?.cellsIndex ?? 10
      extras.value.push({ colIndex: pendingExtraColIndex.value, label: pendingExtraLabel.value, cellsIndex })
      pendingExtraColIndex.value = null
    }
    loadPathTool()
  }
}

async function loadPathTool() {
  try {
    const [pathRes, toolRes, teamRes] = await Promise.all([
      callApiPromise('/api/get-path-configs', {}),
      callApiPromise('/api/get-tool-configs', {}),
      callApiPromise('/api/get-teams', {}),
    ])
    pathOptions.value = (pathRes.list || []).map(p => p.name || p.pathName).filter(Boolean)
    toolOptions.value = (toolRes.list || []).map(t => t.toolName || t.name).filter(Boolean)
    teamOptions.value = teamRes.success ? (teamRes.teams || []) : []
  } catch (_) {}
  step.value = 'path'
}

function confirmPath() {
  const val = (newPathInput.value.trim() || selectedPath.value || '').trim()
  if (!val) return showAppAlert('경로를 선택하거나 입력하세요')
  selectedPath.value = val
  newPathInput.value = ''
  step.value = 'tool'
}

function confirmTool() {
  step.value = 'team'
}

function confirmTeam() {
  if (!selectedTeamId.value) return showAppAlert('팀을 선택하세요')
  step.value = 'cfg-name'
}

function confirmCfgName() {
  if (!cfgName.value.trim()) return showAppAlert('이름을 입력하세요')
  step.value = 'review'
}

const saving = ref(false)
async function saveConfig() {
  if (!selectedTeamId.value) return showAppAlert('팀을 선택하세요')
  saving.value = true
  try {
    const r = await callApiPromise('/api/intake/save-config', {
      name: cfgName.value.trim(),
      sheetId: sheetId.value,
      tabName: activeTab.value,
      startRow: startRow.value + 1,  // 1-indexed
      teamId: selectedTeamId.value,
      pathName: newPathInput.value.trim() ? '' : selectedPath.value,
      toolName: newToolInput.value.trim() ? '' : selectedTool.value,
      newPathName: newPathInput.value.trim() || '',
      newToolName: newToolInput.value.trim() || '',
      colDate: colDate.value ?? null,
      colPhone: colPhone.value,
      colName: colName.value,
      colAge: colAge.value ?? null,
      colAddr: colAddr.value ?? null,
      colExtras: extras.value.length ? extras.value : null,
    })
    if (!r?.ok) return showAppAlert(r?.error || '저장 실패')
    showToast('설정 저장 완료!')
    viewMode.value = 'list'
    await loadConfigs()
  } catch (e) {
    showAppAlert('저장 실패: ' + e.message)
  } finally {
    saving.value = false
  }
}

function resetWizard() {
  step.value = 'url'
  emailCopied.value = false
  urlInput.value = ''
  sheetId.value = ''
  tabs.value = []
  rows.value = []
  startRow.value = null
  colDate.value = null
  colPhone.value = null
  colName.value = null
  colAge.value = null
  colAddr.value = null
  extras.value = []
  selectedPath.value = ''
  newPathInput.value = ''
  selectedTool.value = ''
  newToolInput.value = ''
  selectedTeamId.value = ''
  cfgName.value = ''
  pendingExtraLabel.value = ''
  pendingExtraColIndex.value = null
}

function startWizard() {
  resetWizard()
  viewMode.value = 'wizard'
}

const emailCopied = ref(false)

function copyEmail() {
  navigator.clipboard?.writeText(SERVICE_ACCOUNT_EMAIL)
  showToast('이메일 복사됨')
  emailCopied.value = true
}

// ── 스텝 인디케이터 ────────────────────────────────────────────────────────
const STEP_SEQUENCE = ['start-row', 'col-intake-date', 'col-phone', 'col-name', 'ask-age', 'col-age', 'ask-addr', 'col-addr', 'ask-extra', 'col-extra', 'ask-more-extra']

const stepSeqIdx = computed(() => {
  const idx = STEP_SEQUENCE.indexOf(step.value)
  return idx === -1 ? STEP_SEQUENCE.length : idx
})

const isSheetVisible = computed(() =>
  rows.value.length > 0 && !['url', 'path', 'tool', 'team', 'cfg-name', 'review'].includes(step.value)
)

const stepIndicator = computed(() => {
  const cur = stepSeqIdx.value
  const L = colLabels.value
  return [
    {
      id: 'start-row', label: '시작행',
      state: cur > 0 ? 'done' : 'active',
      val: startRow.value !== null ? `${startRow.value + 1}행` : '',
    },
    {
      id: 'col-intake-date', label: '📅 유입일',
      state: cur > 1 ? 'done' : cur === 1 ? 'active' : 'pending',
      val: colDate.value !== null ? L[colDate.value] : '',
    },
    {
      id: 'col-phone', label: '📞 전화',
      state: cur > 2 ? 'done' : cur === 2 ? 'active' : 'pending',
      val: colPhone.value !== null ? L[colPhone.value] : '',
    },
    {
      id: 'col-name', label: '👤 이름',
      state: cur > 3 ? 'done' : cur === 3 ? 'active' : 'pending',
      val: colName.value !== null ? L[colName.value] : '',
    },
    {
      id: 'ask-age', label: '나이',
      state: cur > 5 ? 'done' : (cur === 4 || cur === 5) ? 'active' : 'pending',
      val: colAge.value !== null ? L[colAge.value] : (cur > 5 ? '건너뜀' : ''),
    },
    {
      id: 'ask-addr', label: '거주지',
      state: cur > 7 ? 'done' : (cur === 6 || cur === 7) ? 'active' : 'pending',
      val: colAddr.value !== null ? L[colAddr.value] : (cur > 7 ? '건너뜀' : ''),
    },
    {
      id: 'ask-extra', label: '추가열',
      state: cur > 10 ? 'done' : cur >= 8 ? 'active' : 'pending',
      val: extras.value.length ? `${extras.value.length}개` : (cur > 10 ? '없음' : ''),
    },
  ]
})

function goToStep(targetId) {
  const order = ['start-row', 'col-intake-date', 'col-phone', 'col-name', 'ask-age', 'ask-addr', 'ask-extra']
  const idx = order.indexOf(targetId)
  if (idx < 0) return
  if (idx <= 0) startRow.value = null
  if (idx <= 1) colDate.value = null
  if (idx <= 2) colPhone.value = null
  if (idx <= 3) colName.value = null
  if (idx <= 4) colAge.value = null
  if (idx <= 5) colAddr.value = null
  if (idx <= 6) { extras.value = []; pendingExtraColIndex.value = null; pendingExtraLabel.value = '' }
  step.value = targetId
}

onMounted(loadConfigs)
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal-box" :style="isSheetVisible ? { maxWidth: '95vw', width: '95vw' } : {}">

      <!-- 헤더 -->
      <div class="modal-header">
        <span style="font-size:20px;">📥</span>
        <h3>유입시트 자동연동</h3>
        <button class="close-btn" @click="emit('close')">✕</button>
      </div>

      <!-- ── 목록 화면 ───────────────────────────────────────────────────── -->
      <div v-if="viewMode === 'list'" class="list-view">
        <div class="list-toolbar">
          <span v-if="configs.length" class="list-count">{{ configs.length }}개 연동 중</span>
          <button class="btn-primary" @click="startWizard">+ 새 시트 연결</button>
        </div>

        <div v-if="loadingConfigs" class="center-msg">불러오는 중...</div>
        <div v-else-if="!configs.length" class="center-msg">
          연동된 시트가 없습니다.<br>
          <small>위에서 서비스 계정 이메일로 시트를 공유 후 "새 시트 연결"을 눌러주세요.</small>
        </div>

        <div v-for="cfg in configs" :key="cfg.intake_config_id" class="config-card">
          <div class="config-info">
            <strong>{{ cfg.name }}</strong>
            <span class="config-meta">🏷️ {{ cfg.team_name || '팀 미지정' }}</span>
            <span class="config-meta">{{ cfg.path_name || '경로 없음' }} / {{ cfg.tool_name || '도구 없음' }}</span>
            <span class="config-meta">{{ cfg.sheet_tab_name }} · {{ cfg.start_row }}행부터</span>
            <span v-if="cfg.last_synced_at" class="config-meta sync-time">마지막 동기화: {{ new Date(cfg.last_synced_at).toLocaleString('ko-KR') }}</span>
          </div>
          <div class="config-actions">
            <button class="btn-sync" :disabled="syncingId === cfg.intake_config_id"
              @click="syncNow(cfg)">
              {{ syncingId === cfg.intake_config_id ? '동기화 중...' : '지금 동기화' }}
            </button>
            <button class="btn-del" @click="deleteConfig(cfg.intake_config_id, cfg.name)">삭제</button>
          </div>
        </div>
      </div>

      <!-- ── 위저드 ─────────────────────────────────────────────────────── -->
      <div v-else class="wizard-view">

        <!-- URL 입력 단계 -->
        <div v-if="step === 'url'" class="step-url">

          <!-- STEP 1: 이메일 복사 -->
          <div class="onboard-step">
            <div class="onboard-num">1</div>
            <div class="onboard-body">
              <p class="onboard-title">아래 이메일을 복사하세요</p>
              <div class="email-block">
                <span class="email-text">{{ SERVICE_ACCOUNT_EMAIL }}</span>
                <button class="btn-copy-big" @click="copyEmail">📋 복사</button>
              </div>
            </div>
          </div>

          <!-- STEP 2: 공유 방법 설명 -->
          <div v-if="emailCopied" class="onboard-step">
            <div class="onboard-num">2</div>
            <div class="onboard-body">
              <p class="onboard-title">구글 시트에서 공유 설정</p>
              <ol class="share-steps">
                <li>연동할 구글 시트를 열어주세요</li>
                <li>우측 상단 <strong>공유</strong> 버튼을 누르세요</li>
                <li>복사한 이메일을 입력하고 <strong>뷰어</strong>로 설정하세요</li>
                <li><strong>보내기</strong>를 눌러 완료하세요</li>
              </ol>
            </div>
          </div>

          <!-- STEP 3: URL 붙여넣기 -->
          <div v-if="emailCopied" class="onboard-step">
            <div class="onboard-num">3</div>
            <div class="onboard-body">
              <p class="onboard-title">공유한 시트의 URL을 붙여넣으세요</p>
              <input v-model="urlInput" placeholder="https://docs.google.com/spreadsheets/d/..."
                class="url-input" @keyup.enter="fetchSheet" />
              <button class="btn-primary" :disabled="loadingSheet || !urlInput.trim()" @click="fetchSheet">
                {{ loadingSheet ? '불러오는 중...' : '시트 불러오기 →' }}
              </button>
            </div>
          </div>

          <button class="btn-back" @click="viewMode = 'list'">← 목록으로</button>
        </div>

        <!-- 시트 렌더링 + 가이드 (start-row ~ col-extra 단계) -->
        <template v-if="rows.length && step !== 'url' && step !== 'path' && step !== 'tool' && step !== 'team' && step !== 'cfg-name' && step !== 'review'">

          <!-- 탭 전환 -->
          <div class="tab-row">
            <button v-for="tab in tabs" :key="tab.title"
              :class="['tab-btn', { active: activeTab === tab.title }]"
              @click="switchTab(tab.title)">{{ tab.title }}</button>
          </div>

          <!-- 스텝 인디케이터 -->
          <div class="step-indicator">
            <template v-for="(s, si) in stepIndicator" :key="s.id">
              <button
                :class="['step-chip', s.state]"
                :disabled="s.state !== 'done'"
                @click="goToStep(s.id)">
                <span class="chip-icon">{{ s.state === 'done' ? '✓' : s.state === 'active' ? '▶' : '○' }}</span>
                {{ s.label }}
                <span v-if="s.val" class="chip-val">{{ s.val }}</span>
              </button>
              <span v-if="si < stepIndicator.length - 1" class="step-sep">›</span>
            </template>
          </div>

          <!-- 가이드 카드 -->
          <div class="guide-card">
            <div class="guide-text">{{ STEP_GUIDE[step] }}</div>
            <div v-if="step === 'ask-age' || step === 'ask-addr' || step === 'ask-extra' || step === 'ask-more-extra'"
              class="yes-no-row">
              <button class="btn-yes" @click="answerYes">있어요</button>
              <button class="btn-no" @click="answerNo">없어요</button>
            </div>
            <!-- extra 라벨 선택 -->
            <div v-if="step === 'col-extra'" class="extra-label-row">
              <span>종류:</span>
              <button v-for="el in EXTRA_LABELS" :key="el.cellsIndex"
                :class="['label-chip', { active: pendingExtraLabel === el.label }]"
                @click="pendingExtraLabel = el.label">{{ el.label }}</button>
            </div>
          </div>

          <!-- 매핑 현황 뱃지 -->
          <div class="mapping-badges">
            <span v-if="colDate !== null"  class="badge date">📅 {{ colLabels[colDate] }}</span>
            <span v-if="colPhone !== null" class="badge phone">📞 {{ colLabels[colPhone] }}</span>
            <span v-if="colName !== null"  class="badge name">👤 {{ colLabels[colName] }}</span>
            <span v-if="colAge !== null"   class="badge age">🎂 {{ colLabels[colAge] }}</span>
            <span v-if="colAddr !== null"  class="badge addr">🏠 {{ colLabels[colAddr] }}</span>
            <span v-for="e in extras" :key="e.colIndex" class="badge extra">📌 {{ colLabels[e.colIndex] }} → {{ e.label }}</span>
          </div>

          <!-- 시트 테이블 -->
          <div class="sheet-scroll" @mouseleave="hoveredCol = null">
            <table class="sheet-table">
              <thead>
                <tr>
                  <th class="row-num-th">#</th>
                  <th v-for="(lbl, ci) in colLabels" :key="ci"
                    :class="['col-th', { 'col-hover': isColumnStep(), 'col-selected': isSelectedCol(ci), 'col-hovered': isColumnStep() && hoveredCol === ci }]"
                    :style="colColor(ci) ? { background: colColor(ci), color: '#fff' } : {}"
                    @mouseover="hoveredCol = ci"
                    @click="onColClick(ci)">
                    {{ lbl }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, ri) in rows" :key="ri"
                  :class="['sheet-row', {
                    'row-hover': isRowStep(),
                    'row-selected': ri === startRow,
                    'row-before-start': startRow !== null && ri < startRow,
                  }]"
                  @click="isRowStep() && onRowClick(ri)">
                  <td class="row-num">{{ ri + 1 }}</td>
                  <td v-for="ci in maxCols" :key="ci - 1"
                    :class="{ 'col-selected-cell': isSelectedCol(ci - 1), 'col-hovered-cell': isColumnStep() && hoveredCol === ci - 1 }"
                    :style="colColor(ci - 1) ? { borderLeft: `3px solid ${colColor(ci - 1)}` } : {}"
                    @mouseover.stop="hoveredCol = ci - 1"
                    @click="isColumnStep() && onColClick(ci - 1)">
                    {{ row[ci - 1] || '' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <button class="btn-back" @click="viewMode = 'list'">← 목록으로</button>
        </template>

        <!-- 경로 선택 -->
        <div v-if="step === 'path'" class="step-form">
          <div class="guide-box">
            <p class="guide-text">🛤️ 이 시트의 섭외 경로를 선택하세요.</p>
            <select v-model="selectedPath" class="form-select">
              <option value="">-- 선택 --</option>
              <option v-for="p in pathOptions" :key="p" :value="p">{{ p }}</option>
            </select>
            <div class="divider-or">또는 직접 입력</div>
            <input v-model="newPathInput" placeholder="새 경로 이름 (사명의 길에 추가됨)" class="form-input" />
            <button class="btn-primary" @click="confirmPath">다음 →</button>
          </div>
          <button class="btn-back" @click="step = 'ask-extra'">← 이전</button>
        </div>

        <!-- 도구 선택 -->
        <div v-if="step === 'tool'" class="step-form">
          <div class="guide-box">
            <p class="guide-text">🛠️ 도구(유입 루트)를 선택하세요.</p>
            <select v-model="selectedTool" class="form-select">
              <option value="">-- 선택 안 함 --</option>
              <option v-for="t in toolOptions" :key="t" :value="t">{{ t }}</option>
            </select>
            <div class="divider-or">또는 직접 입력</div>
            <input v-model="newToolInput" placeholder="새 도구 이름 (사명의 길에 추가됨)" class="form-input" />
            <button class="btn-primary" @click="confirmTool">다음 →</button>
          </div>
          <button class="btn-back" @click="step = 'path'">← 이전</button>
        </div>

        <!-- 팀 선택 -->
        <div v-if="step === 'team'" class="step-form">
          <div class="guide-box">
            <p class="guide-text">🏷️ 이 시트가 어느 팀 유입인지 선택하세요.</p>
            <select v-model="selectedTeamId" class="form-select">
              <option value="">-- 선택 --</option>
              <option v-for="t in teamOptions" :key="t.id" :value="t.id">{{ t.name }}</option>
            </select>
            <button class="btn-primary" @click="confirmTeam">다음 →</button>
          </div>
          <button class="btn-back" @click="step = 'tool'">← 이전</button>
        </div>

        <!-- 설정 이름 -->
        <div v-if="step === 'cfg-name'" class="step-form">
          <div class="guide-box">
            <p class="guide-text">📝 이 연동 설정의 이름을 입력하세요.<br><span style="font-size:12px;opacity:.75;">온라인 유입확인 화면에서 탭 이름으로 표시돼요.</span></p>
            <input v-model="cfgName" placeholder="예: 스모어 주일 유입" class="form-input" @keyup.enter="confirmCfgName" />
            <button class="btn-primary" @click="confirmCfgName">다음 →</button>
          </div>
          <button class="btn-back" @click="step = 'team'">← 이전</button>
        </div>

        <!-- 확인 및 저장 -->
        <div v-if="step === 'review'" class="step-form">
          <div class="guide-box">
            <p class="guide-text" style="font-weight:600;">설정 확인</p>
            <table class="review-table">
              <tr><th>이름</th><td>{{ cfgName }}</td></tr>
              <tr><th>팀</th><td>{{ selectedTeamName }}</td></tr>
              <tr><th>탭</th><td>{{ activeTab }}</td></tr>
              <tr><th>시작 행</th><td>{{ (startRow ?? 0) + 1 }}행</td></tr>
              <tr><th>유입일 열</th><td>{{ colDate !== null ? colLabels[colDate] : '미설정' }}</td></tr>
              <tr><th>전화번호 열</th><td>{{ colPhone !== null ? colLabels[colPhone] : '미설정' }}</td></tr>
              <tr><th>이름 열</th><td>{{ colName !== null ? colLabels[colName] : '미설정' }}</td></tr>
              <tr v-if="colAge !== null"><th>나이 열</th><td>{{ colLabels[colAge] }}</td></tr>
              <tr v-if="colAddr !== null"><th>거주지 열</th><td>{{ colLabels[colAddr] }}</td></tr>
              <tr v-for="e in extras" :key="e.colIndex">
                <th>{{ e.label }} 열</th><td>{{ colLabels[e.colIndex] }}</td>
              </tr>
              <tr><th>경로</th><td>{{ newPathInput || selectedPath || '(없음)' }}</td></tr>
              <tr><th>도구</th><td>{{ newToolInput || selectedTool || '(없음)' }}</td></tr>
            </table>
            <button class="btn-primary" :disabled="saving" @click="saveConfig">
              {{ saving ? '저장 중...' : '💾 저장하기' }}
            </button>
          </div>
          <button class="btn-back" @click="step = 'cfg-name'">← 이전</button>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,.5);
  display: flex; align-items: center; justify-content: center;
  z-index: 3000; padding: 16px;
}
.modal-box {
  background: #fff;
  border-radius: 12px;
  width: 100%; max-width: 900px;
  max-height: 92vh;
  display: flex; flex-direction: column;
  overflow: hidden;
}
.modal-header {
  display: flex; align-items: center; gap: 8px;
  padding: 16px 20px; border-bottom: 1px solid #e0e0e0;
  flex-shrink: 0;
}
.modal-header h3 { flex: 1; margin: 0; font-size: 17px; }
.close-btn { background: none; border: none; font-size: 18px; cursor: pointer; color: #666; }

/* 목록 */
.list-view { padding: 16px 20px; overflow-y: auto; flex: 1; }
.sa-info-block {
  background: #F3F6FF; border: 1px solid #BBDEFB; border-radius: 10px;
  padding: 14px 16px; margin-bottom: 14px;
  display: flex; flex-direction: column; gap: 10px;
}
.sa-hint { font-size: 13px; color: #444; margin: 0; }
.sa-email-row {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
}
.sa-email {
  font-family: monospace; font-size: 13px; color: #1565C0;
  word-break: break-all; flex: 1; min-width: 0;
}
.list-toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.list-count { font-size: 13px; color: #666; }
.center-msg { text-align: center; padding: 40px 20px; color: #888; line-height: 1.8; }

.config-card {
  display: flex; align-items: center; gap: 12px;
  border: 1px solid #e0e0e0; border-radius: 10px;
  padding: 12px 16px; margin-bottom: 10px;
}
.config-info { flex: 1; display: flex; flex-direction: column; gap: 3px; }
.config-info strong { font-size: 15px; }
.config-meta { font-size: 12px; color: #777; }
.sync-time { color: #2E7D32; }
.config-actions { display: flex; gap: 6px; flex-shrink: 0; }
.btn-sync {
  background: #1976D2; color: #fff; border: none; border-radius: 6px;
  padding: 6px 12px; font-size: 12px; cursor: pointer;
}
.btn-sync:disabled { background: #90CAF9; cursor: default; }
.btn-del {
  background: #f5f5f5; color: #c62828; border: 1px solid #e0e0e0; border-radius: 6px;
  padding: 6px 10px; font-size: 12px; cursor: pointer;
}

/* 위저드 */
.wizard-view {
  display: flex; flex-direction: column; flex: 1; overflow: hidden; padding: 0;
}
.step-url, .step-form {
  padding: 20px; overflow-y: auto; flex: 1;
  display: flex; flex-direction: column; gap: 16px;
}

/* 온보딩 스텝 카드 */
.onboard-step {
  display: flex; gap: 16px; align-items: flex-start;
  background: #fff; border: 1px solid #e0e0e0; border-radius: 12px;
  padding: 16px 20px;
}
.onboard-num {
  width: 28px; height: 28px; border-radius: 50%;
  background: #1976D2; color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; font-weight: 700; flex-shrink: 0; margin-top: 2px;
}
.onboard-body { flex: 1; display: flex; flex-direction: column; gap: 10px; }
.onboard-title { font-size: 15px; font-weight: 600; color: #1a1a1a; margin: 0; }

.email-block {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  background: #F3F6FF; border: 1px solid #BBDEFB; border-radius: 8px;
  padding: 10px 14px;
}
.email-text {
  font-family: monospace; font-size: 13px; color: #1565C0;
  word-break: break-all; flex: 1;
}
.btn-copy-big {
  background: #1976D2; color: #fff; border: none; border-radius: 8px;
  padding: 8px 16px; font-size: 13px; font-weight: 600;
  cursor: pointer; white-space: nowrap; flex-shrink: 0;
}
.btn-copy-big:active { background: #1565C0; }

.share-steps {
  margin: 0; padding-left: 18px;
  display: flex; flex-direction: column; gap: 6px;
}
.share-steps li { font-size: 14px; color: #333; line-height: 1.6; }
.share-steps strong { color: #1565C0; }
.guide-box {
  background: #f8f9fa; border-radius: 10px; padding: 20px;
  display: flex; flex-direction: column; gap: 12px;
}
.guide-text { font-size: 15px; font-weight: 500; color: #1a1a1a; }
.url-input, .form-input, .form-select {
  width: 100%; padding: 10px 12px; border: 1px solid #ccc; border-radius: 8px;
  font-size: 14px; box-sizing: border-box;
}
.divider-or {
  text-align: center; color: #aaa; font-size: 12px;
  border-top: 1px solid #e0e0e0; padding-top: 10px;
}
.btn-primary {
  background: #1976D2; color: #fff; border: none; border-radius: 8px;
  padding: 10px 20px; font-size: 14px; cursor: pointer; font-weight: 600;
  align-self: flex-start;
}
.btn-primary:disabled { background: #90CAF9; cursor: default; }
.btn-back {
  background: none; border: none; color: #666; font-size: 13px;
  cursor: pointer; padding: 8px 0; text-align: left;
}
.email-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.email-row code { font-size: 13px; color: #1565C0; word-break: break-all; }

/* 탭 */
.tab-row {
  display: flex; gap: 4px; padding: 8px 16px; background: #f5f5f5;
  border-bottom: 1px solid #e0e0e0; flex-wrap: wrap; flex-shrink: 0;
}
.tab-btn {
  padding: 4px 12px; border-radius: 14px; border: 1px solid #ccc;
  background: #fff; font-size: 13px; cursor: pointer;
}
.tab-btn.active { background: #1976D2; color: #fff; border-color: #1976D2; }

/* 가이드 카드 */
.guide-card {
  padding: 12px 16px; background: #E3F2FD; border-bottom: 1px solid #90CAF9;
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap; flex-shrink: 0;
}
.yes-no-row { display: flex; gap: 8px; }
.btn-yes { background: #2E7D32; color: #fff; border: none; border-radius: 6px; padding: 6px 14px; cursor: pointer; font-size: 13px; }
.btn-no  { background: #666;     color: #fff; border: none; border-radius: 6px; padding: 6px 14px; cursor: pointer; font-size: 13px; }
.extra-label-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.label-chip {
  border: 1px solid #90CAF9; border-radius: 12px; padding: 3px 10px;
  font-size: 12px; background: #fff; cursor: pointer;
}
.label-chip.active { background: #1976D2; color: #fff; border-color: #1976D2; }

/* 매핑 뱃지 */
.mapping-badges {
  display: flex; gap: 6px; padding: 6px 16px; flex-wrap: wrap; flex-shrink: 0;
  background: #fafafa; border-bottom: 1px solid #eee;
}
.badge {
  font-size: 12px; border-radius: 10px; padding: 2px 8px;
}
.badge.date  { background: #E0F2F1; color: #00695C; }
.badge.phone { background: #E3F2FD; color: #1565C0; }
.badge.name  { background: #F3E5F5; color: #6A1B9A; }
.badge.age   { background: #FFF3E0; color: #E65100; }
.badge.addr  { background: #E8F5E9; color: #1B5E20; }
.badge.extra { background: #EDE7F6; color: #4527A0; }

/* 시트 테이블 */
.sheet-scroll {
  overflow: auto; flex: 1;
}
.sheet-table {
  border-collapse: collapse; font-size: 13px; white-space: nowrap; width: 100%;
}
.col-th, .row-num-th {
  position: sticky; top: 0; background: #f5f5f5;
  border: 1px solid #ddd; padding: 6px 10px; font-size: 12px;
  z-index: 1;
}
.col-th.col-hover { cursor: pointer; }
.col-th.col-hovered { background: rgba(25, 118, 210, 0.18) !important; }
.col-th.col-selected { color: #fff; }
.row-num-th { left: 0; z-index: 2; }
.row-num { position: sticky; left: 0; background: #fafafa; border: 1px solid #eee; padding: 4px 8px; font-size: 11px; color: #aaa; }
.sheet-row td { border: 1px solid #eee; padding: 4px 10px; max-width: 160px; overflow: hidden; text-overflow: ellipsis; }
.sheet-row.row-hover { cursor: pointer; }
.sheet-row.row-hover:hover { background: #E8F5E9; }
.sheet-row.row-selected { background: #C8E6C9 !important; }
.sheet-row.row-before-start { opacity: 0.4; }
.col-selected-cell { background: rgba(25, 118, 210, 0.05); }
.col-hovered-cell { background: rgba(25, 118, 210, 0.1); cursor: pointer; }

/* 리뷰 */
.review-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.review-table th { text-align: right; padding: 6px 12px; color: #555; width: 120px; font-weight: normal; }
.review-table td { padding: 6px 12px; font-weight: 600; }
.review-table tr:nth-child(even) td { background: #f5f5f5; }

/* 스텝 인디케이터 */
.step-indicator {
  display: flex; align-items: center; gap: 4px; padding: 8px 16px;
  background: #fff; border-bottom: 1px solid #e0e0e0; flex-wrap: wrap;
  flex-shrink: 0;
}
.step-chip {
  display: flex; align-items: center; gap: 4px;
  border-radius: 14px; padding: 4px 10px; font-size: 12px;
  border: 1px solid #ddd; background: #f5f5f5; cursor: default;
}
.step-chip.done {
  background: #E8F5E9; border-color: #A5D6A7; color: #2E7D32; cursor: pointer;
}
.step-chip.done:hover { background: #C8E6C9; }
.step-chip.active { background: #1976D2; border-color: #1976D2; color: #fff; }
.step-chip.pending { color: #bbb; border-color: #eee; }
.chip-icon { font-size: 11px; }
.chip-val { font-weight: 600; margin-left: 2px; }
.step-sep { color: #ccc; font-size: 14px; user-select: none; }
</style>
