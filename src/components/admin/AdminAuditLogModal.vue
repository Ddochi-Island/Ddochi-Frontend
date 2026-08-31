<script setup>
// AdminScreen 의 '📋 설정 변경 로그' modal (V3.17 Phase 16-J).
// ADMIN_AUDIT_LOGS append-only 이력 — 누가/언제/무엇을/before-after.

import { ref, computed, onMounted } from 'vue'
import { useApi } from '@/composables/useApi'

const emit = defineEmits(['close'])
const { callApi } = useApi()

const list = ref([])
const loading = ref(true)
const errorMsg = ref('')
const filterKind = ref('all')
const expandedId = ref(null)

// kind = '{domain}.{action}' — domain 기준 그루핑 라벨
const DOMAIN_LABEL = {
    ministry:  '🎨 사역 블록',
    tool:      '🛠️ 도구',
    broadcast: '💬 알림·채널',
    role:      '🔑 사용자 권한',
    sheet:     '📝 시트',
    board:     '📖 게시판',
    auth:      '🔐 인증',
    semester:  '🗓️ 개강스케쥴',
}
function domainOf(kind) { return String(kind || '').split('.')[0] }
function domainLabel(d) { return DOMAIN_LABEL[d] || d }

const ACTION_LABEL = {
    create:  { icon: '＋', text: '추가', color: '#2E7D32', bg: '#E8F5E9' },
    update:  { icon: '✎',  text: '수정', color: '#1565C0', bg: '#E3F2FD' },
    delete:  { icon: '🗑', text: '삭제', color: '#C62828', bg: '#FFEBEE' },
    restore: { icon: '↩', text: '복원', color: '#5D4037', bg: '#EFEBE9' },
}
function actionInfo(a) { return ACTION_LABEL[a] || { icon: '·', text: a, color: '#555', bg: '#eee' } }

const FILTER_OPTIONS = [
    { key: 'all',       label: '전체' },
    { key: 'tool',      label: '🛠️ 도구' },
    { key: 'broadcast', label: '💬 알림·채널' },
    { key: 'ministry',  label: '🎨 사역 블록' },
    { key: 'sheet',     label: '📝 시트' },
    { key: 'board',     label: '📖 게시판' },
    { key: 'auth',      label: '🔐 인증' },
    { key: 'semester',  label: '🗓️ 개강' },
]

const filtered = computed(() => {
    if (filterKind.value === 'all') return list.value
    return list.value.filter((r) => domainOf(r.kind) === filterKind.value)
})

function formatAt(s) {
    if (!s) return ''
    const d = new Date(s)
    if (Number.isNaN(d.getTime())) return String(s).slice(0, 16)
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// before/after diff — 변경된 키만 추출.
function diffKeys(before, after) {
    const out = []
    const keys = new Set([
        ...Object.keys(before || {}),
        ...Object.keys(after  || {}),
    ])
    for (const k of keys) {
        const b = before?.[k]
        const a = after?.[k]
        if (JSON.stringify(b) !== JSON.stringify(a)) {
            out.push({ key: k, before: b, after: a })
        }
    }
    return out
}

function preview(v) {
    if (v === null || v === undefined) return '∅'
    if (typeof v === 'string') return v.length > 80 ? v.slice(0, 80) + '…' : v
    try { return JSON.stringify(v).slice(0, 120) } catch (_) { return String(v) }
}

function toggleExpand(id) {
    expandedId.value = expandedId.value === id ? null : id
}

function load() {
    loading.value = true
    errorMsg.value = ''
    expandedId.value = null
    const body = { limit: 300 }
    if (filterKind.value !== 'all') body.kindPrefix = filterKind.value
    callApi('/api/get-admin-audit-log', body, (r) => {
        loading.value = false
        if (!r?.success) {
            errorMsg.value = r?.message || '목록을 불러오지 못했어.'
            return
        }
        list.value = r.list || []
    })
}

onMounted(load)
</script>

<template>
    <Teleport to="body">
        <div class="modal-overlay" @click.self="emit('close')">
            <div class="modal-card" style="height:85vh; padding:0; max-width:760px;">
                <div class="modal-header-sticky">
                    <div class="modal-title" style="margin:0;">📋 설정 변경 로그</div>
                    <span class="modal-close-sticky" @click="emit('close')">×</span>
                </div>

                <div class="modal-content-scroll" style="padding:16px;">
                    <div class="al-info">
                        모든 admin mutation 의 append-only 이력 — 행을 탭하면 before/after 가 보여.
                    </div>

                    <div class="al-filter">
                        <button
                            v-for="o in FILTER_OPTIONS" :key="o.key"
                            class="al-chip"
                            :class="{ active: filterKind === o.key }"
                            @click="filterKind = o.key; load()"
                        >{{ o.label }}</button>
                        <button class="al-chip al-reload" @click="load">🔄</button>
                    </div>

                    <div v-if="loading" class="al-status">불러오는 중... ⏳</div>
                    <div v-else-if="errorMsg" class="al-status err">⛔ {{ errorMsg }}</div>
                    <div v-else-if="filtered.length === 0" class="al-status">기록이 없어!</div>

                    <div v-else class="al-list">
                        <div v-for="r in filtered" :key="r.id" class="al-row">
                            <div class="al-row-head" @click="toggleExpand(r.id)">
                                <span class="al-kind">{{ domainLabel(domainOf(r.kind)) }}</span>
                                <span class="al-action-pill"
                                    :style="{ background: actionInfo(r.action).bg, color: actionInfo(r.action).color }">
                                    {{ actionInfo(r.action).icon }} {{ actionInfo(r.action).text }}
                                </span>
                                <span class="al-at">{{ formatAt(r.at) }}</span>
                                <span class="al-toggle">{{ expandedId === r.id ? '▾' : '▸' }}</span>
                            </div>
                            <div class="al-target" @click="toggleExpand(r.id)">{{ r.target }}</div>
                            <div class="al-actor">
                                <b>{{ r.actorName }}</b>
                                <span v-if="r.actorPosition" class="al-badge pos">{{ r.actorPosition }}</span>
                                <span v-if="r.actorTeam" class="al-badge team">{{ r.actorTeam }}</span>
                                <span class="al-sabun">({{ r.actorSabun }})</span>
                            </div>

                            <!-- 확장: before/after diff -->
                            <div v-if="expandedId === r.id" class="al-diff">
                                <div v-if="r.action === 'create'" class="al-diff-section">
                                    <div class="al-diff-label">새로 생성된 값</div>
                                    <pre>{{ JSON.stringify(r.after, null, 2) }}</pre>
                                </div>
                                <div v-else-if="r.action === 'delete'" class="al-diff-section">
                                    <div class="al-diff-label">삭제된 값</div>
                                    <pre>{{ JSON.stringify(r.before, null, 2) }}</pre>
                                </div>
                                <template v-else-if="r.action === 'update' && r.before && r.after">
                                    <div v-if="diffKeys(r.before, r.after).length === 0" class="al-diff-section empty">
                                        변경된 필드가 없어 (no-op).
                                    </div>
                                    <table v-else class="al-diff-table">
                                        <thead>
                                            <tr>
                                                <th style="width:25%;">필드</th>
                                                <th>이전</th>
                                                <th>이후</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr v-for="d in diffKeys(r.before, r.after)" :key="d.key">
                                                <td><code>{{ d.key }}</code></td>
                                                <td class="diff-before">{{ preview(d.before) }}</td>
                                                <td class="diff-after">{{ preview(d.after) }}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </template>
                                <div v-else class="al-diff-section empty">
                                    스냅샷 정보가 없어.
                                </div>
                                <div class="al-diff-meta">
                                    kind: <code>{{ r.kind }}</code> · ref: <code>{{ r.refId }}</code>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="btn-group" style="margin-top:15px;">
                        <button class="btn-neg" @click="emit('close')">뒤로가기</button>
                    </div>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
.al-info {
    font-size: 12px;
    color: #666;
    text-align: center;
    margin-bottom: 12px;
    line-height: 1.4;
}
.al-filter {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 12px;
}
.al-chip {
    border: 1px solid #ddd;
    background: #fff;
    border-radius: 14px;
    padding: 5px 11px;
    font-size: 12px;
    cursor: pointer;
    font-family: inherit;
    color: #555;
    transition: 0.15s;
}
.al-chip:hover { background: #f5f5f5; }
.al-chip.active {
    background: #2E7D32;
    color: white;
    border-color: #2E7D32;
}
.al-chip.al-reload { margin-left: auto; }

.al-status {
    text-align: center;
    padding: 30px;
    color: #888;
    font-size: 13px;
}
.al-status.err { color: #C62828; }

.al-list { display: flex; flex-direction: column; gap: 8px; }
.al-row {
    background: #fff;
    padding: 10px 12px;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.07);
    text-align: left;
}
.al-row-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
    cursor: pointer;
    flex-wrap: wrap;
}
.al-kind {
    font-size: 11px;
    color: #888;
    font-weight: bold;
}
.al-action-pill {
    font-size: 10px;
    font-weight: bold;
    padding: 1px 7px;
    border-radius: 10px;
}
.al-at {
    font-size: 11px;
    color: #999;
    font-family: monospace;
    margin-left: auto;
}
.al-toggle { color: #999; font-size: 12px; }
.al-target {
    font-size: 14px;
    color: #333;
    font-weight: bold;
    margin-bottom: 4px;
    word-break: break-all;
    cursor: pointer;
}
.al-actor {
    font-size: 12px;
    color: #555;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
}
.al-badge {
    font-size: 10px;
    padding: 1px 5px;
    border-radius: 4px;
}
.al-badge.pos { background: #E3F2FD; color: #1565C0; }
.al-badge.team { background: #FFF3E0; color: #E65100; }
.al-sabun {
    font-size: 11px;
    color: #aaa;
    font-family: monospace;
}

/* diff 확장부 */
.al-diff {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px dashed #ddd;
}
.al-diff-section { font-size: 12px; }
.al-diff-section.empty { color: #888; font-style: italic; }
.al-diff-label {
    font-size: 11px;
    color: #888;
    font-weight: bold;
    margin-bottom: 4px;
}
.al-diff pre {
    background: #FAFAFA;
    border: 1px solid #eee;
    border-radius: 6px;
    padding: 8px 10px;
    font-size: 11px;
    line-height: 1.4;
    overflow-x: auto;
    margin: 0;
}
.al-diff-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
}
.al-diff-table th, .al-diff-table td {
    border: 1px solid #eee;
    padding: 5px 7px;
    text-align: left;
    vertical-align: top;
    word-break: break-all;
}
.al-diff-table th { background: #FAFAFA; color: #666; font-weight: bold; }
.diff-before { background: #FFF8E1; color: #BF360C; }
.diff-after  { background: #E8F5E9; color: #1B5E20; }
.al-diff-table code { background: #ECEFF1; padding: 1px 4px; border-radius: 3px; font-size: 10px; }
.al-diff-meta {
    margin-top: 8px;
    font-size: 10px;
    color: #aaa;
}
.al-diff-meta code { background: #ECEFF1; padding: 1px 4px; border-radius: 3px; }
</style>
