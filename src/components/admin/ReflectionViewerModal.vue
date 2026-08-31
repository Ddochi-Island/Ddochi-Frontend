<script setup>
// AdminScreen 의 '💭 느낀점 열람하기' modal.
// DAILY_REPORTS.REFLECTION 을 기간/팀 필터로 모아보는 화면.

import { ref, onMounted } from 'vue'
import { useApi } from '@/composables/useApi'

const emit = defineEmits(['close'])
const { callApi } = useApi()

const list = ref([])
const teams = ref([])
const scope = ref('team')
const loading = ref(true)
const errorMsg = ref('')

function todayStr() {
    const d = new Date()
    const p = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
function daysAgoStr(n) {
    const d = new Date()
    d.setDate(d.getDate() - n)
    const p = (x) => String(x).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const dateFrom = ref(daysAgoStr(13))
const dateTo = ref(todayStr())
const teamId = ref('')

function load() {
    loading.value = true
    errorMsg.value = ''
    callApi('/api/daily-report/reflections', {
        dateFrom: dateFrom.value,
        dateTo: dateTo.value,
        teamId: teamId.value || undefined,
    }, (r) => {
        loading.value = false
        if (!r?.success) {
            errorMsg.value = r?.message || '목록을 불러오지 못했어.'
            return
        }
        list.value = r.list || []
        teams.value = r.teams || []
        scope.value = r.scope || 'team'
    })
}

function formatDate(s) {
    if (!s) return ''
    const d = new Date(s)
    if (Number.isNaN(d.getTime())) return String(s).slice(0, 10)
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function moodEmoji(m) {
    const n = Number(m)
    if (!n) return ''
    if (n >= 9) return '😆'
    if (n >= 7) return '🙂'
    if (n >= 5) return '😐'
    if (n >= 3) return '😔'
    return '😢'
}

onMounted(load)
</script>

<template>
    <Teleport to="body">
        <div class="modal-overlay" @click.self="emit('close')">
            <div class="modal-card" style="height:85vh; padding:0; max-width:760px;">
                <div class="modal-header-sticky">
                    <div class="modal-title" style="margin:0;">💭 느낀점 열람하기</div>
                    <span class="modal-close-sticky" @click="emit('close')">×</span>
                </div>

                <div class="modal-content-scroll" style="padding:16px;">
                    <div class="rv-info">
                        일일보고에 적힌 "오늘 깨달았거나 힘들었던 것" 을 기간별로 모아봐.
                    </div>

                    <div class="rv-filter">
                        <input type="date" v-model="dateFrom" class="rv-date">
                        <span class="rv-tilde">~</span>
                        <input type="date" v-model="dateTo" class="rv-date">
                        <select v-if="scope === 'all'" v-model="teamId" class="rv-team-sel">
                            <option value="">전체 팀</option>
                            <option v-for="t in teams" :key="t.teamId" :value="t.teamId">{{ t.name }}</option>
                        </select>
                        <button class="rv-load-btn" @click="load">🔍 조회</button>
                    </div>

                    <div v-if="loading" class="rv-status">불러오는 중... ⏳</div>
                    <div v-else-if="errorMsg" class="rv-status err">⛔ {{ errorMsg }}</div>
                    <div v-else-if="list.length === 0" class="rv-status">이 기간에 작성된 느낀점이 없어!</div>

                    <div v-else class="rv-list">
                        <div v-for="(r, i) in list" :key="i" class="rv-row">
                            <div class="rv-row-head">
                                <span class="rv-date">{{ formatDate(r.date) }}</span>
                                <span class="rv-name">{{ r.name }}</span>
                                <span v-if="scope === 'all'" class="rv-badge">{{ r.teamName }}</span>
                                <span v-if="r.mood" class="rv-mood">{{ moodEmoji(r.mood) }} {{ r.mood }}</span>
                            </div>
                            <div class="rv-text">{{ r.reflection }}</div>
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
.rv-info {
    font-size: 12px;
    color: #666;
    text-align: center;
    margin-bottom: 12px;
    line-height: 1.4;
}
.rv-filter {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin-bottom: 14px;
}
.rv-date {
    border: 1px solid #ddd;
    border-radius: 6px;
    padding: 5px 6px;
    font-size: 12px;
    font-family: inherit;
}
.rv-tilde { color: #999; font-size: 12px; }
.rv-team-sel {
    border: 1px solid #ddd;
    border-radius: 6px;
    padding: 5px 6px;
    font-size: 12px;
    font-family: inherit;
}
.rv-load-btn {
    border: none;
    border-radius: 6px;
    background: #00897B;
    color: #fff;
    padding: 6px 12px;
    font-size: 12px;
    cursor: pointer;
    margin-left: auto;
}

.rv-status {
    text-align: center;
    padding: 30px;
    color: #888;
    font-size: 13px;
}
.rv-status.err { color: #C62828; }

.rv-list { display: flex; flex-direction: column; gap: 8px; }
.rv-row {
    background: #fff;
    padding: 10px 12px;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.07);
    text-align: left;
}
.rv-row-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
    flex-wrap: wrap;
}
.rv-date {
    font-size: 11px;
    color: #999;
    font-family: monospace;
}
.rv-name {
    font-size: 14px;
    font-weight: bold;
    color: #333;
}
.rv-badge {
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 4px;
    background: #E0F2F1;
    color: #00695C;
}
.rv-mood {
    font-size: 12px;
    color: #666;
    margin-left: auto;
}
.rv-text {
    font-size: 13px;
    color: #444;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
}
</style>
