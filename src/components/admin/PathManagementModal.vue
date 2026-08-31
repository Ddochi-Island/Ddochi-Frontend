<script setup>
import { ref, onMounted } from 'vue'
import { useApi } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'

const emit = defineEmits(['close'])
const { callApiPromise } = useApi()
const { showAppAlert, showAppConfirm } = usePopup()

const loading = ref(true)
const paths = ref([])
const editing = ref(null)  // null | { id?, pathName }

async function loadAll() {
  loading.value = true
  try {
    const r = await callApiPromise('/api/get-path-configs', {})
    paths.value = r.success ? r.list : []
  } catch (e) {
    showAppAlert('로드 실패: ' + e.message)
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editing.value = { id: '', pathName: '', onOff: 'online' }
}

function openEdit(p) {
  editing.value = { id: p.id, pathName: p.pathName || p.name || '', onOff: p.onOff || 'online' }
}

function cancelEdit() { editing.value = null }

async function saveEdit() {
  const name = (editing.value?.pathName || '').trim()
  if (!name) return showAppAlert('경로 이름을 입력해줘!')
  try {
    const r = await callApiPromise('/api/save-path-config', {
      config: { id: editing.value.id || undefined, pathName: name, onOff: editing.value.onOff || 'online' },
    })
    if (r.success) {
      showAppAlert(r.message || '저장 완료')
      editing.value = null
      await loadAll()
    } else {
      showAppAlert(r.message || '저장 실패')
    }
  } catch (err) {
    showAppAlert('저장 실패: ' + err.message)
  }
}

function deletePath(p) {
  showAppConfirm(`"${p.pathName}" 경로를 삭제할까?`, async (yes) => {
    if (!yes) return
    try {
      const r = await callApiPromise('/api/delete-path-config', { id: p.id })
      if (r.success) {
        showAppAlert(r.message || '삭제 완료')
        editing.value = null
        await loadAll()
      } else {
        showAppAlert(r.message || '삭제 실패')
      }
    } catch (err) {
      showAppAlert('삭제 실패: ' + err.message)
    }
  })
}

onMounted(loadAll)
</script>

<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="emit('close')">
      <div class="admin-modal-card" style="max-width: 480px;">
        <template v-if="editing">
          <div class="modal-header-sticky">
            <div class="modal-title">🛤️ 경로 {{ editing.id ? '수정' : '등록' }}</div>
            <span class="modal-close-sticky" @click="cancelEdit">×</span>
          </div>
          <div class="modal-content-scroll">
            <label class="form-label">경로 이름</label>
            <input v-model="editing.pathName" type="text" class="input-card" placeholder="예: 도구노방" />

            <label class="form-label" style="margin-top:14px;">온/오프라인</label>
            <div style="display:flex; gap:8px; margin-bottom:4px;">
              <button
                type="button"
                @click="editing.onOff = 'online'"
                :style="editing.onOff === 'online'
                  ? 'flex:1; padding:9px 0; border-radius:8px; border:1.5px solid #4285F4; background:#EBF2FF; color:#4285F4; font-weight:700; font-size:14px; cursor:pointer;'
                  : 'flex:1; padding:9px 0; border-radius:8px; border:1.5px solid #ddd; background:#fff; color:#aaa; font-size:14px; cursor:pointer;'"
              >온라인</button>
              <button
                type="button"
                @click="editing.onOff = 'offline'"
                :style="editing.onOff === 'offline'
                  ? 'flex:1; padding:9px 0; border-radius:8px; border:1.5px solid #4285F4; background:#EBF2FF; color:#4285F4; font-weight:700; font-size:14px; cursor:pointer;'
                  : 'flex:1; padding:9px 0; border-radius:8px; border:1.5px solid #ddd; background:#fff; color:#aaa; font-size:14px; cursor:pointer;'"
              >오프라인</button>
            </div>

            <div class="form-actions">
              <button class="btn-pos" @click="saveEdit">{{ editing.id ? '수정하기' : '등록하기' }}</button>
              <button v-if="editing.id" class="btn-neg" style="background:#F44336;color:white;" @click="deletePath({ id: editing.id, pathName: editing.pathName })">삭제</button>
              <button class="btn-neg" @click="cancelEdit">뒤로</button>
            </div>
          </div>
        </template>

        <template v-else>
          <div class="modal-header-sticky">
            <div class="modal-title">🛤️ 섭외 경로 관리</div>
            <span class="modal-close-sticky" @click="emit('close')">×</span>
          </div>
          <div class="modal-content-scroll">
            <div v-if="loading" style="text-align:center; padding:30px; color:#888;">로딩 중...</div>
            <template v-else>
              <div v-if="paths.length === 0" class="empty-state">
                등록된 경로가 없어.<br>+ 버튼으로 새 경로를 등록해줘!
              </div>
              <div v-for="p in paths" :key="p.id" class="path-card">
                <div>
                  <div class="path-name">{{ p.pathName }}</div>
                  <span :class="['badge', p.onOff === 'offline' ? 'badge-offline' : 'badge-online']">
                    {{ p.onOff === 'offline' ? '오프라인' : '온라인' }}
                  </span>
                </div>
                <div class="path-actions">
                  <button class="btn-mini btn-edit" @click="openEdit(p)">✏️</button>
                  <button class="btn-mini btn-del" @click="deletePath(p)">🗑️</button>
                </div>
              </div>
            </template>
          </div>
          <div class="modal-footer">
            <button class="btn-pos" style="width:100%; background:#5D4037;" @click="openCreate">+ 새 경로 등록</button>
          </div>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.empty-state {
  text-align: center;
  color: #888;
  padding: 30px 20px;
  line-height: 1.6;
}
.path-card {
  background: #fff;
  padding: 14px 15px;
  border-radius: 12px;
  margin-bottom: 10px;
  border: 1px solid #eee;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.path-name {
  font-weight: bold;
  font-size: 15px;
  color: #333;
  margin-bottom: 4px;
}
.badge {
  display: inline-block;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: bold;
}
.badge-online  { background: #E3F2FD; color: #1976D2; }
.badge-offline { background: #FFF3E0; color: #E65100; }
.path-actions { display: flex; gap: 8px; }
.btn-edit { background: #FF9800; color: white; }
.btn-del  { background: #F44336; color: white; }
.form-label {
  font-size: 12px;
  font-weight: bold;
  color: #5D4037;
  display: block;
  margin-bottom: 5px;
}
.form-actions { display: flex; gap: 8px; margin-top: 20px; }
.form-actions button { flex: 1; }
.modal-footer { padding: 12px 15px; border-top: 1px solid #eee; flex-shrink: 0; }
</style>
