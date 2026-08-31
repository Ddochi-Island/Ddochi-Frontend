<script setup>
// ToolManagementModal — admin 의 🛠️ 도구 등록 관리.
// Phase 14 (V3.17): TOOLS_CONFIGS.TEAM_ID 추가 후 신규 구현.
// legacy index.html (2026-05-11 스냅샷) 의 openToolManagementScreen / renderToolManagementPopup
// 1:1 정합 — 팀 탭 (전체 + 팀 목록) + 공용/팀 배지 + 모달 + 드롭다운.
//
// 룰:
//   - team='' / team='전체' → 공용 (TEAM_ID NULL)
//   - team='1팀' (DISPLAY_NAME) → 해당 팀 전용
//   - '전체' 탭: 모든 도구 (공용 + 팀별)
//   - 팀 탭: 해당 팀 전용 + 공용

import { ref, computed, onMounted } from 'vue'
import { useApi } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'

const emit = defineEmits(['close'])
const { callApiPromise } = useApi()
const { showAppAlert, showAppConfirm } = usePopup()

const loading = ref(true)
const tools = ref([])             // [{id, toolName, team, teamId, ...}]
const teamList = ref([])          // ['1팀', '2팀', ...] (DISPLAY_NAME)
const currentTab = ref('전체')
const editing = ref(null)         // null | { id?, toolName, team }

const tabs = computed(() => ['전체', ...teamList.value])

const filteredTools = computed(() => {
  if (currentTab.value === '전체') return tools.value
  return tools.value.filter((t) => {
    const team = (t.team || '').trim()
    return !team || team === '전체' || team === currentTab.value
  })
})

async function loadAll() {
  loading.value = true
  try {
    const [toolRes, teamRes] = await Promise.all([
      callApiPromise('/api/get-tool-configs', {}),
      callApiPromise('/api/get-teams', {}),
    ])
    tools.value = toolRes.success ? toolRes.list : []
    teamList.value = teamRes.success ? (teamRes.list || []) : []
  } catch (e) {
    showAppAlert('로드 실패: ' + e.message)
  } finally {
    loading.value = false
  }
}

function openCreate() {
  // 현재 팀 탭이 '전체' 가 아니면 그 팀을 기본 선택
  editing.value = {
    id: '',
    toolName: '',
    team: currentTab.value === '전체' ? '' : currentTab.value,
  }
}

function openEdit(t) {
  editing.value = {
    id: t.id,
    toolName: t.toolName || t.name || '',
    team: t.team || '',
  }
}

function cancelEdit() { editing.value = null }

async function saveEdit() {
  if (!editing.value) return
  const e = editing.value
  const name = (e.toolName || '').trim()
  if (!name) return showAppAlert('도구 이름을 입력해줘!')

  const payload = {
    config: {
      id: e.id || undefined,
      toolName: name,
      team: (e.team || '').trim(),   // '' → 공용
    },
  }
  await doSave(payload, false)
}

// force=true 면 backend 의 name_conflict 가드 우회
async function doSave(payload, force) {
  try {
    const r = await callApiPromise('/api/save-tool-config', { ...payload, force })
    if (r.success) {
      showAppAlert(r.message || '저장 완료')
      editing.value = null
      await loadAll()
      return
    }
    // V3.17 — 같은 이름 도구 중복 감지 (선택 모호성 위험 — 사용자 confirm 받고 강제 진행)
    if (r.code === 'name_conflict') {
      const labels = (r.existing || []).map(x => x.teamLabel).join(', ')
      const msg = `이미 "${payload.config.toolName}" 도구가 ${labels} 에 있어.\n그래도 분리해서 등록할까?\n\n⚠️ 같은 이름 도구는 RegisterProspect 에서 같이 노출돼 사용자가 혼동할 수 있어.`
      showAppConfirm(msg, (yes) => {
        if (yes) doSave(payload, true)
      })
      return
    }
    showAppAlert(r.message || '저장 실패')
  } catch (err) {
    showAppAlert('저장 실패: ' + err.message)
  }
}

function deleteTool(t) {
  showAppConfirm(`"${t.toolName}" 도구를 삭제할까?`, async (yes) => {
    if (!yes) return
    try {
      const r = await callApiPromise('/api/delete-tool-config', { id: t.id })
      if (r.success) {
        showAppAlert(r.message || '삭제 완료')
        editing.value = null   // 수정 폼에서 삭제 호출된 경우 폼 닫고 목록 복귀
        await loadAll()
      } else {
        showAppAlert(r.message || '삭제 실패')
      }
    } catch (err) {
      showAppAlert('삭제 실패: ' + err.message)
    }
  })
}

function isPublic(t) {
  const team = (t.team || '').trim()
  return !team || team === '전체'
}

onMounted(loadAll)
</script>

<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="emit('close')">
      <div class="admin-modal-card" style="max-width: 560px;">
        <!-- 편집 폼이 열려있으면 폼만 렌더, 아니면 목록 -->
        <template v-if="editing">
          <div class="modal-header-sticky">
            <div class="modal-title">🛠️ 도구 {{ editing.id ? '수정' : '등록' }}</div>
            <span class="modal-close-sticky" @click="cancelEdit">×</span>
          </div>
          <div class="modal-content-scroll">
            <label class="form-label">적용 팀</label>
            <select v-model="editing.team" class="input-card" style="margin-bottom:15px;">
              <option value="">전체 (공용)</option>
              <option v-for="t in teamList" :key="t" :value="t">{{ t }}</option>
            </select>

            <label class="form-label">도구 이름</label>
            <input v-model="editing.toolName" type="text" class="input-card" placeholder="예: 도구이름" />

            <div class="form-actions">
              <button class="btn-pos" @click="saveEdit">{{ editing.id ? '수정하기' : '등록하기' }}</button>
              <button v-if="editing.id" class="btn-neg" style="background:#F44336;color:white;" @click="deleteTool({ id: editing.id, toolName: editing.toolName })">삭제</button>
              <button class="btn-neg" @click="cancelEdit">뒤로</button>
            </div>
          </div>
        </template>

        <template v-else>
          <div class="modal-header-sticky">
            <div class="modal-title">🛠️ 도구 등록 관리</div>
            <span class="modal-close-sticky" @click="emit('close')">×</span>
          </div>

          <!-- 팀 탭 -->
          <div class="tab-row">
            <div
              v-for="t in tabs"
              :key="t"
              class="tab-btn"
              :class="{ active: currentTab === t }"
              @click="currentTab = t"
            >
              {{ t }}
            </div>
          </div>

          <div class="modal-content-scroll">
            <div v-if="loading" style="text-align:center; padding:30px; color:#888;">로딩 중...</div>

            <template v-else>
              <div v-if="filteredTools.length === 0" class="empty-state">
                등록된 도구가 없어.<br>+ 버튼으로 새 도구를 등록해줘!
              </div>

              <div v-for="t in filteredTools" :key="t.id" class="tool-card">
                <div>
                  <div class="tool-name">{{ t.toolName }}</div>
                  <span :class="['badge', isPublic(t) ? 'badge-public' : 'badge-team']">
                    {{ isPublic(t) ? '공용' : t.team }}
                  </span>
                </div>
                <div class="tool-actions">
                  <button class="btn-mini btn-edit" @click="openEdit(t)">✏️</button>
                  <button class="btn-mini btn-del" @click="deleteTool(t)">🗑️</button>
                </div>
              </div>
            </template>
          </div>

          <div class="modal-footer">
            <button class="btn-pos" style="width:100%; background:#5D4037;" @click="openCreate">
              + 새 도구 등록
            </button>
          </div>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.tab-row {
  display: flex;
  gap: 6px;
  padding: 8px 14px;
  overflow-x: auto;
  border-bottom: 1px solid #eee;
  flex-shrink: 0;
}
.tab-btn {
  padding: 6px 14px;
  border-radius: 16px;
  font-size: 13px;
  font-weight: 600;
  color: #666;
  background: #f5f5f5;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
}
.tab-btn.active {
  background: #5D4037;
  color: #fff;
}

.empty-state {
  text-align: center;
  color: #888;
  padding: 30px 20px;
  line-height: 1.6;
}

.tool-card {
  background: #fff;
  padding: 14px 15px;
  border-radius: 12px;
  margin-bottom: 10px;
  border: 1px solid #eee;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.tool-name {
  font-weight: bold;
  font-size: 15px;
  margin-bottom: 5px;
  color: #333;
}
.badge {
  display: inline-block;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: bold;
}
.badge-public {
  background: #E8F5E9;
  color: #388E3C;
}
.badge-team {
  background: #E3F2FD;
  color: #1976D2;
}
.tool-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
.btn-edit {
  background: #FF9800;
  color: white;
}
.btn-del {
  background: #F44336;
  color: white;
}

.form-label {
  font-size: 12px;
  font-weight: bold;
  color: #5D4037;
  display: block;
  margin-bottom: 5px;
}
.form-actions {
  display: flex;
  gap: 8px;
  margin-top: 20px;
}
.form-actions button { flex: 1; }

.modal-footer {
  padding: 12px 15px;
  border-top: 1px solid #eee;
  flex-shrink: 0;
}
</style>
