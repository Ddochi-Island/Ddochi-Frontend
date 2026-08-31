<script setup>
// 📊 주간 전적 — 팀의 7일치 (오늘 포함) area×{reg/tm/man/appr} 표.
// AdminScreen 에 inline 으로 있던 stats 영역을 별도 page 로 추출 (2026-05-12).
// backend: POST /api/get-weekly-record (구. /api/get-admin-stats).

import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useApi } from '@/composables/useApi'
import { dayLabels } from '@/constants'

const router = useRouter()
const auth = useAuthStore()
const { callApi } = useApi()

const loading = ref(true)
const errorMessage = ref('')
const adminData = ref(null)
const teamAreas = ref([])
const dateKeys = ref([])
const statsMap = ref({})

function load() {
    loading.value = true
    errorMessage.value = ''
    callApi('/api/get-weekly-record', { sabun: auth.currentSabun }, (r) => {
        loading.value = false
        if (!r?.success) {
            errorMessage.value = r?.message || '오류 발생'
            return
        }
        adminData.value = r.data
        teamAreas.value = r.data.teamAreas || []
        dateKeys.value = r.data.dateKeys || []
        statsMap.value = r.data.stats || {}
    })
}

function getDayLabel(dateStr) {
    const y = 2000 + parseInt(dateStr.substring(0, 2))
    const m = parseInt(dateStr.substring(3, 5)) - 1
    const d = parseInt(dateStr.substring(6, 8))
    const dateObj = new Date(y, m, d)
    return dayLabels[dateObj.getDay()]
}


function formatArrayCell(arr) {
    if (!arr || arr.length === 0) return '-'
    return arr.length
}

function formatArrayNames(arr) {
    if (!arr || arr.length === 0) return ''
    return `(${arr.join(', ')})`
}

load()
</script>

<template>
    <div class="weekly-record-screen">
        <div class="header">
            <span class="header-emoji">📊</span>
            <h3>주간 전적</h3>
            <p>{{ auth.currentUserTeam }} · 최근 7일</p>
        </div>

        <div v-if="loading" style="text-align:center; padding:30px;">데이터 불러오는 중...</div>
        <div v-else-if="errorMessage" style="text-align:center; padding:20px; color:#C62828;">오류 발생: {{ errorMessage }}</div>

        <template v-else>
            <div v-for="date in dateKeys" :key="date" style="margin-bottom:30px;">
                <template v-if="statsMap[date]">
                    <div class="date-label">{{ date }} ({{ getDayLabel(date) }})</div>

                    <table class="admin-stats-table">
                        <thead>
                            <tr>
                                <th style="width:100px;">구분</th>
                                <th v-for="area in teamAreas" :key="area">{{ area }}</th>
                                <th style="background:#FFF3E0; color:#E65100;">총계</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td class="stat-label" style="background:#E3F2FD; color:#1565C0;">온라인 유입</td>
                                <td v-for="area in teamAreas" :key="area">
                                    {{ statsMap[date][area]?.online_intake || 0 }}
                                </td>
                                <td style="font-weight:bold; background:#FFF3E0;">{{ statsMap[date]['Total']?.online_intake || 0 }}</td>
                            </tr>

                            <tr>
                                <td class="stat-label" style="background:#FFF9C4; color:#F57F17;">오프번찾</td>
                                <td v-for="area in teamAreas" :key="area">
                                    {{ formatArrayCell(statsMap[date][area]?.shed_reg) }}
                                    <span v-if="(statsMap[date][area]?.shed_reg || []).length > 0" class="names">{{ formatArrayNames(statsMap[date][area].shed_reg) }}</span>
                                </td>
                                <td style="background:#FFFDE7; font-weight:bold;">
                                    {{ formatArrayCell(statsMap[date]['Total']?.shed_reg) }}
                                    <span v-if="(statsMap[date]['Total']?.shed_reg || []).length > 0" class="names">{{ formatArrayNames(statsMap[date]['Total'].shed_reg) }}</span>
                                </td>
                            </tr>

                            <tr>
                                <td class="stat-label" style="background:#EFEBE9;">티엠결과</td>
                                <td v-for="area in teamAreas" :key="area">{{ statsMap[date][area]?.tm || 0 }}</td>
                                <td style="font-weight:bold; background:#FFF3E0;">{{ statsMap[date]['Total']?.tm || 0 }}</td>
                            </tr>

                            <tr>
                                <td class="stat-label" style="background:#E1BEE7; color:#4A148C;">만남픽스</td>
                                <td v-for="area in teamAreas" :key="area">
                                    {{ formatArrayCell(statsMap[date][area]?.man) }}
                                    <span v-if="(statsMap[date][area]?.man || []).length > 0" class="names">{{ formatArrayNames(statsMap[date][area].man) }}</span>
                                </td>
                                <td style="background:#F3E5F5; font-weight:bold;">
                                    {{ formatArrayCell(statsMap[date]['Total']?.man) }}
                                    <span v-if="(statsMap[date]['Total']?.man || []).length > 0" class="names">{{ formatArrayNames(statsMap[date]['Total'].man) }}</span>
                                </td>
                            </tr>

                            <tr>
                                <td class="stat-label" style="background:#E8F5E9; color:#2E7D32;">재가</td>
                                <td v-for="area in teamAreas" :key="area">
                                    {{ formatArrayCell(statsMap[date][area]?.appr) }}
                                    <span v-if="(statsMap[date][area]?.appr || []).length > 0" class="names">{{ formatArrayNames(statsMap[date][area].appr) }}</span>
                                </td>
                                <td style="background:#F1F8E9; font-weight:bold;">
                                    {{ formatArrayCell(statsMap[date]['Total']?.appr) }}
                                    <span v-if="(statsMap[date]['Total']?.appr || []).length > 0" class="names">{{ formatArrayNames(statsMap[date]['Total'].appr) }}</span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </template>
            </div>
        </template>

        <div class="btn-group" style="margin-top:20px;">
            <button class="btn-neg" @click="router.back()">뒤로</button>
        </div>
    </div>
</template>

<style scoped>
.weekly-record-screen { padding: 15px; }
.header { text-align: center; margin-bottom: 20px; }
.header-emoji { font-size: 40px; }
.header h3 { margin: 5px 0; color: #5D4037; }
.header p { color: #888; font-size: 13px; margin: 0; }

.date-label {
    font-size: 18px;
    font-weight: bold;
    color: #5D4037;
    margin-bottom: 5px;
    padding-left: 5px;
    border-left: 5px solid var(--accent-color);
}
.admin-stats-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 10px;
    background: var(--card-bg);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: var(--shadow);
}
.admin-stats-table th, .admin-stats-table td {
    padding: 12px 8px;
    border: 1px solid #eee;
    text-align: center;
    font-size: 13px;
    color: #333;
    vertical-align: middle;
}
.admin-stats-table th {
    background: #F2EBE9;
    font-weight: bold;
    color: #5D4037;
    white-space: nowrap;
}
.admin-stats-table tr:nth-child(even) { background: #FAFAFA; }
.admin-stats-table td.stat-label {
    text-align: left;
    font-weight: bold;
    color: var(--btn-color);
    width: 120px;
    white-space: nowrap;
}
.admin-stats-table td span.names {
    font-size: 11px;
    color: #666;
    display: block;
    margin-top: 3px;
    white-space: normal;
    word-break: keep-all;
}
</style>
