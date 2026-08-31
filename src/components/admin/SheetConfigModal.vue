<script setup>
// [2026-05-12] legacy openSheetConfigList / moveSheetConfig / saveSheetConfigOrder
// (legacy2/public/index.html L11119-11248) 정합 — 카드 리스트 + ▲▼ 순서 조절.
// V3 헬스 정보 (SHEET_CACHE_RUNS) 도 카드별로 시각화.
// 편집/신규는 별도 SheetEditModal.vue 로 분리 (legacy 처럼 sub-modal).
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { useApi } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'
import SheetEditModal from '@/components/admin/SheetEditModal.vue'

const emit = defineEmits(['close'])
const { callApi, callApiPromise } = useApi()
const { showAppAlert, showAppConfirm, showToast } = usePopup()

const loading = ref(true)
const syncing = ref(false)
const savingOrder = ref(false)
const configs = ref([])
const runs = ref([])
const editingIdx = ref(null)  // null | -1 (신규) | 0..N (편집)

// 동기화 진행률 (1초 polling) — backend POST /api/sheet-sync/progress
const syncProgress = ref({ current: 0, total: 0, percent: 0, currentName: null, elapsedMs: 0 })
let progressTimer = null

const failedCount = computed(() => runs.value.filter(r => r.status === 'failed').length)
const dirty = ref(false)  // 순서 변경 미저장 여부

async function loadAll() {
    loading.value = true
    try {
        const cfg = await callApiPromise('/api/get-sheet-configs', {})
        configs.value = (cfg.list || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0))
        // 동기화 헬스는 get-sheet-prospects (admin 시야) 에서 받음
        const r = await callApiPromise('/api/get-sheet-prospects', { team: '관리' })
        runs.value = r.runs || []
        dirty.value = false
    } catch (e) {
        showAppAlert('로드 실패: ' + e.message)
    } finally {
        loading.value = false
    }
}

function findRun(configId) { return runs.value.find(r => r.configId === configId) || null }

function statusClass(s) {
    return { ok: 'st-ok', failed: 'st-failed', partial: 'st-partial' }[s] || 'st-pending'
}
function statusBadge(s) {
    return ({ ok: '✅', failed: '❌', partial: '⚠️', pending: '⏳' })[s] || '⏳'
}
function statusLabel(s) {
    return ({ ok: '정상', failed: '실패', partial: '부분', pending: '대기' })[s] || s
}
function formatTime(iso) {
    if (!iso) return '—'
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    const diffMin = Math.floor((Date.now() - d.getTime()) / 60000)
    if (diffMin < 1) return '방금 전'
    if (diffMin < 60) return `${diffMin}분 전`
    if (diffMin < 60 * 24) return `${Math.floor(diffMin / 60)}시간 전`
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

function moveItem(idx, direction) {
    const target = idx + direction
    if (target < 0 || target >= configs.value.length) return
    const arr = configs.value.slice()
    const tmp = arr[idx]; arr[idx] = arr[target]; arr[target] = tmp
    configs.value = arr
    dirty.value = true
}

async function saveOrder() {
    if (savingOrder.value) return
    savingOrder.value = true
    try {
        const orders = configs.value.map((c, idx) => ({ id: c.id, order: idx }))
        const r = await callApiPromise('/api/manage-sheet-config-order', { orders })
        if (r?.success) {
            showAppAlert(r.message || '탭 순서 저장 완료')
            dirty.value = false
            await loadAll()
        } else {
            showAppAlert(r?.message || '순서 저장 실패')
        }
    } catch (e) {
        showAppAlert('순서 저장 실패: ' + e.message)
    } finally {
        savingOrder.value = false
    }
}

function openCreate() {
    if (dirty.value) {
        return showAppConfirm('변경된 순서가 저장되지 않았어. 무시하고 신규 등록할까?', (yes) => {
            if (yes) { dirty.value = false; editingIdx.value = -1 }
        })
    }
    editingIdx.value = -1
}

function openEdit(idx) {
    if (dirty.value) {
        return showAppConfirm('변경된 순서가 저장되지 않았어. 무시하고 편집할까?', (yes) => {
            if (yes) { dirty.value = false; editingIdx.value = idx }
        })
    }
    editingIdx.value = idx
}

function closeEdit(refresh) {
    editingIdx.value = null
    if (refresh) loadAll()
}

function deleteSheet(c) {
    showAppConfirm(`"${c.name}" 시트 설정을 삭제할까?`, (yes) => {
        if (!yes) return
        callApi('/api/delete-sheet-config', { id: c.id }, async (r) => {
            if (r.success) {
                showAppAlert(r.message || '삭제 완료')
                await loadAll()
            } else {
                showAppAlert(r.message || '삭제 실패')
            }
        })
    })
}

async function pollProgress() {
    try {
        const r = await callApiPromise('/api/sheet-sync/progress', {})
        if (r?.success) {
            syncProgress.value = {
                current: r.current || 0,
                total: r.total || 0,
                percent: r.percent || 0,
                currentName: r.currentName || null,
                elapsedMs: r.elapsedMs || 0,
            }
        }
    } catch (_) { /* swallow — 다음 tick 재시도 */ }
}

function startProgressPolling() {
    if (progressTimer) clearInterval(progressTimer)
    syncProgress.value = { current: 0, total: 0, percent: 0, currentName: null, elapsedMs: 0 }
    // 첫 tick 즉시
    pollProgress()
    progressTimer = setInterval(pollProgress, 1000)
}
function stopProgressPolling() {
    if (progressTimer) { clearInterval(progressTimer); progressTimer = null }
}

async function triggerSync() {
    if (syncing.value) return
    syncing.value = true
    startProgressPolling()
    try {
        const r = await callApiPromise('/api/sheet-sync/trigger', {})
        if (r.success) {
            showAppAlert(`동기화 완료: ${r.ok_count} ok / ${r.failed_count} failed (${Math.round((r.elapsedMs || 0) / 1000)}초)`)
            await loadAll()
        } else {
            showAppAlert(r.message || '동기화 실패')
        }
    } finally {
        syncing.value = false
        stopProgressPolling()
    }
}

const sendingId = ref(null)   // 발송 중인 configId
async function triggerSheetDashboard(configId, sheetName) {
    if (sendingId.value) return
    sendingId.value = configId
    try {
        const r = await callApiPromise('/api/send-sheet-dashboard', { configId })
        if (r.ok) {
            const item = (r.results || [])[0]
            if (item?.sent) showToast(`📋 "${sheetName}" 발송 완료!`)
            else showAppAlert(`발송 결과: ${item?.skipped || item?.error || '알 수 없음'}`)
        } else {
            showAppAlert('발송 실패: ' + (r.message || r.error || ''))
        }
    } catch (e) {
        showAppAlert('오류: ' + e.message)
    } finally {
        sendingId.value = null
    }
}

async function testTabAccess(c) {
    const r = await callApiPromise('/api/test-sheet-access', {
        spreadsheetId: c.spreadsheetId,
        sheetTabName: c.sheetTabName || '',
    })
    if (r.ok) {
        showAppAlert(`✅ 접근 성공\n탭 ${r.availableTabs.length}개 (예: ${r.availableTabs.slice(0, 5).join(', ')})`)
    } else {
        const tabs = (r.availableTabs || []).slice(0, 20).join(', ')
        showAppAlert(`❌ ${r.code}\n${r.message}${tabs ? `\n\n사용 가능 탭: ${tabs}` : ''}`)
    }
}

onMounted(loadAll)
onBeforeUnmount(stopProgressPolling)
</script>

<template>
    <Teleport to="body">
        <div class="modal-overlay" @click.self="emit('close')">
            <div class="admin-modal-card" style="max-width: 720px;">
                <div class="modal-header-sticky">
                    <div class="modal-title">📝 번호찾 시트 관리</div>
                    <span class="modal-close-sticky" @click="emit('close')">×</span>
                </div>

                <div class="modal-content-scroll">
                    <!-- 헬스 + 액션 바 -->
                    <div class="health-bar">
                        <div class="health-summary">
                            전체 <b>{{ configs.length }}</b>개 시트
                            <span v-if="failedCount > 0" class="health-fail">· 실패 {{ failedCount }}개</span>
                            <span v-else-if="configs.length > 0" class="health-ok">· 모두 정상</span>
                        </div>
                        <div class="health-actions">
                            <button class="btn-mini" :disabled="syncing" @click="triggerSync">
                                <template v-if="syncing">
                                    <span v-if="syncProgress.total > 0">
                                        🔄 {{ syncProgress.current }}/{{ syncProgress.total }} ({{ syncProgress.percent }}%)
                                    </span>
                                    <span v-else>동기화 중…</span>
                                </template>
                                <template v-else>🔄 지금 동기화</template>
                            </button>
                            <button class="btn-mini btn-pri" @click="openCreate">+ 새 시트</button>
                        </div>
                    </div>

                    <!-- 진행률 바 (동기화 중에만) -->
                    <div v-if="syncing && syncProgress.total > 0" class="progress-block">
                        <div class="progress-bar">
                            <div class="progress-fill" :style="{ width: syncProgress.percent + '%' }"></div>
                        </div>
                        <div class="progress-text">
                            <span class="progress-name">
                                {{ syncProgress.currentName ? `📄 ${syncProgress.currentName}` : '준비 중…' }}
                            </span>
                            <span class="progress-elapsed">{{ Math.round(syncProgress.elapsedMs / 1000) }}s</span>
                        </div>
                    </div>

                    <div v-if="loading" style="text-align:center; padding:30px; color:#888;">시트 목록을 불러오고 있어...</div>

                    <div v-else-if="configs.length === 0" class="empty-state">
                        등록된 시트가 없어. 위의 <b>+ 새 시트</b> 로 추가해줘!
                    </div>

                    <template v-else>
                        <div class="hint">화살표를 눌러 탭 순서를 변경하고 반드시 <b>저장</b>을 눌러줘!</div>

                        <!-- 시트 카드 리스트 -->
                        <div class="sheet-list">
                            <div v-for="(c, idx) in configs" :key="c.id"
                                class="sheet-card"
                                :class="{ 'is-failed': findRun(c.id)?.status === 'failed', 'is-ok': findRun(c.id)?.status === 'ok' }">
                                <!-- 좌측: 순서 화살표 -->
                                <div class="order-col">
                                    <button class="arrow-btn" :disabled="idx === 0" @click="moveItem(idx, -1)" title="위로">▲</button>
                                    <span class="order-num">{{ idx + 1 }}</span>
                                    <button class="arrow-btn" :disabled="idx === configs.length - 1" @click="moveItem(idx, 1)" title="아래로">▼</button>
                                </div>

                                <!-- 중앙: 시트 정보 -->
                                <div class="info-col" @click="openEdit(idx)">
                                    <div class="card-name">
                                        {{ c.name }}
                                        <span class="status-pill" :class="statusClass(findRun(c.id)?.status || 'pending')">
                                            {{ statusBadge(findRun(c.id)?.status || 'pending') }} {{ statusLabel(findRun(c.id)?.status || 'pending') }}
                                        </span>
                                    </div>
                                    <div class="card-meta">
                                        <span v-if="c.team">{{ c.team }}</span>
                                        <span v-if="c.path">· {{ c.path }}</span>
                                        <span v-if="c.tool">· {{ c.tool }}</span>
                                        <span v-if="c.onOff">· {{ c.onOff === 'online' ? '온라인' : c.onOff === 'offline' ? '오프라인' : c.onOff }}</span>
                                        <span v-if="c.isFreeForm" class="meta-tag">자유형식</span>
                                    </div>
                                    <div class="card-sync">
                                        마지막 sync: {{ formatTime(findRun(c.id)?.lastRunAt) }}
                                        <span v-if="findRun(c.id)?.rowCount" class="row-count">· {{ findRun(c.id).rowCount }}행</span>
                                    </div>
                                    <div v-if="findRun(c.id)?.error" class="card-error">
                                        ❌ {{ findRun(c.id).error.slice(0, 120) }}{{ findRun(c.id).error.length > 120 ? '…' : '' }}
                                    </div>
                                </div>

                                <!-- 우측: 액션 -->
                                <div class="action-col">
                                    <button class="btn-mini" @click.stop="openEdit(idx)" title="편집">✏️</button>
                                    <button class="btn-mini" @click.stop="testTabAccess(c)" title="시트 접근 확인">🔍</button>
                                    <button
                                        v-if="c.dashResultCol && c.dashChatId"
                                        class="btn-mini btn-dash"
                                        :disabled="sendingId === c.id"
                                        @click.stop="triggerSheetDashboard(c.id, c.name)"
                                        title="섭외명단 발송"
                                    >{{ sendingId === c.id ? '…' : '📋' }}</button>
                                    <button class="btn-mini btn-danger" @click.stop="deleteSheet(c)" title="삭제">🗑️</button>
                                </div>
                            </div>
                        </div>

                        <!-- 순서 저장 (변경 시에만 강조) -->
                        <button class="btn-pos save-order"
                            :class="{ 'is-dirty': dirty }"
                            :disabled="!dirty || savingOrder"
                            @click="saveOrder">
                            {{ savingOrder ? '저장 중…' : dirty ? '✅ 변경된 탭 순서 저장하기' : '순서 변경 없음' }}
                        </button>
                    </template>
                </div>
            </div>
        </div>

        <!-- 편집/신규 sub-modal -->
        <SheetEditModal v-if="editingIdx !== null"
            :sheet="editingIdx >= 0 ? configs[editingIdx] : null"
            @close="closeEdit(false)"
            @saved="closeEdit(true)" />
    </Teleport>
</template>

<style scoped>
.health-bar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    background: #FAFAFA;
    border: 1px solid #eee;
    border-radius: 10px;
    padding: 10px 14px;
    margin-bottom: 14px;
    font-size: 13px;
}
.health-summary { flex: 1 1 auto; }
.health-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.health-fail { color: #C62828; font-weight: bold; }
.health-ok { color: #2E7D32; }

.progress-block {
    background: #E3F2FD;
    border: 1px solid #BBDEFB;
    border-radius: 10px;
    padding: 10px 14px;
    margin-bottom: 14px;
}
.progress-bar {
    height: 8px;
    background: #fff;
    border-radius: 4px;
    overflow: hidden;
    box-shadow: inset 0 1px 2px rgba(0,0,0,0.1);
}
.progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #2196F3, #1976D2);
    transition: width 0.4s ease;
    border-radius: 4px;
}
.progress-text {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
    color: #1565C0;
    margin-top: 6px;
    gap: 8px;
}
.progress-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.progress-elapsed { color: #1976D2; font-weight: bold; flex-shrink: 0; }

.btn-mini {
    background: #fff;
    border: 1px solid #ccc;
    border-radius: 6px;
    padding: 6px 10px;
    cursor: pointer;
    font-size: 12px;
    font-family: 'Jua';
    color: #555;
    line-height: 1;
}
.btn-mini:hover { background: #f0f0f0; }
.btn-mini:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-mini.btn-pri { background: #4CAF50; color: #fff; border-color: #4CAF50; }
.btn-mini.btn-danger { background: #fff; color: #C62828; border-color: #ef9a9a; }
.btn-mini.btn-danger:hover { background: #ffebee; }
.btn-mini.btn-dash { background: #fff; color: #3949AB; border-color: #9FA8DA; }
.btn-mini.btn-dash:hover:not(:disabled) { background: #E8EAF6; }

.empty-state {
    text-align: center;
    padding: 40px 20px;
    color: #888;
    background: #FAFAFA;
    border-radius: 10px;
    font-size: 14px;
}
.hint {
    font-size: 12px;
    color: #888;
    text-align: center;
    margin-bottom: 10px;
}

.sheet-list { display: flex; flex-direction: column; gap: 10px; }

.sheet-card {
    display: flex;
    background: #fff;
    border: 1px solid #eee;
    border-left: 4px solid #ccc;
    border-radius: 10px;
    padding: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    gap: 8px;
    align-items: center;
}
.sheet-card.is-ok { border-left-color: #4CAF50; }
.sheet-card.is-failed { border-left-color: #F44336; background: #FFF8F8; }

.order-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
    width: 36px;
}
.arrow-btn {
    background: none;
    border: 1px solid transparent;
    border-radius: 4px;
    font-size: 14px;
    line-height: 1;
    padding: 4px 8px;
    cursor: pointer;
    color: #757575;
}
.arrow-btn:hover:not(:disabled) { background: #f0f0f0; border-color: #ccc; }
.arrow-btn:disabled { opacity: 0.2; cursor: default; }
.order-num {
    font-size: 11px;
    color: #aaa;
    font-weight: bold;
    line-height: 1;
}

.info-col {
    flex: 1;
    min-width: 0;
    cursor: pointer;
    padding: 0 4px;
}
.card-name {
    font-weight: bold;
    font-size: 14px;
    color: #333;
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
}
.status-pill {
    font-size: 10px;
    padding: 2px 8px;
    border-radius: 10px;
    font-weight: normal;
    background: #eee;
    color: #666;
}
.status-pill.st-ok { background: #E8F5E9; color: #2E7D32; }
.status-pill.st-failed { background: #FFEBEE; color: #C62828; }
.status-pill.st-partial { background: #FFF3E0; color: #F57C00; }
.status-pill.st-pending { background: #ECEFF1; color: #607D8B; }

.card-meta {
    font-size: 12px;
    color: #666;
    margin-bottom: 4px;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
}
.meta-tag {
    background: #FFF3E0;
    color: #E65100;
    padding: 1px 6px;
    border-radius: 6px;
    font-size: 10px;
    margin-left: 4px;
}
.card-sync {
    font-size: 11px;
    color: #888;
}
.row-count { color: #555; }
.card-error {
    margin-top: 6px;
    font-family: monospace;
    font-size: 11px;
    color: #C62828;
    background: #FFEBEE;
    padding: 6px 8px;
    border-radius: 6px;
    word-break: break-all;
}

.action-col {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex-shrink: 0;
}
.action-col .btn-mini {
    padding: 6px 8px;
    min-width: 32px;
}

.save-order {
    width: 100%;
    margin-top: 14px;
    background: #BDBDBD;
    transition: background 0.2s;
}
.save-order.is-dirty {
    background: #2196F3;
    box-shadow: 0 4px 10px rgba(33, 150, 243, 0.3);
}
.save-order:disabled { cursor: not-allowed; }

/* 모바일 미세 보정 */
@media (max-width: 480px) {
    .card-meta { font-size: 11px; }
    .action-col .btn-mini { padding: 6px; min-width: 30px; font-size: 14px; }
}
</style>
