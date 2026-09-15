<script setup>
// 🎯 구역 점수 — 구역장/부구역장은 오늘 체크리스트 + 주간 총점,
// 지역장/전도팀장은 팀 산하 구역 현황 + 타 팀 총점 + 2일 미션.
// backend: POST /api/area-score/today, /api/area-score/toggle, /api/area-score/mission/complete

import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'
import { useFormatters } from '@/composables/useFormatters'

const router = useRouter()
const { callApi, callApiPromise } = useApi()
const { showAppAlert, showToast, showAppConfirm } = usePopup()
const { copyText } = useFormatters()

const loading = ref(true)
const view = ref(null) // 'area_lead' | 'sub_area_lead' | 'team_coach' | 'region_admin' | null
const today = ref(null)
const week = ref(null)
const team = ref(null)
const otherTeams = ref([])
const mission = ref([])
const regionTeams = ref([])

// team_coach 구역 상세 (areaId → { loading, days[] })
const areaDetails = ref({})

async function toggleAreaDetail(areaId) {
    if (areaDetails.value[areaId]) {
        delete areaDetails.value[areaId]
        return
    }
    areaDetails.value[areaId] = { loading: true, days: [] }
    const r = await callApiPromise('/api/area-score/area-detail', { areaId })
    if (!r.success) { delete areaDetails.value[areaId]; return showAppAlert(r.message) }
    areaDetails.value[areaId] = { loading: false, days: r.days }
}

async function addArea() {
    const r = await callApiPromise('/api/area-score/area/add', {})
    if (!r.success) return showAppAlert(r.message)
    showToast(`${r.name} 추가되었어요!`)
    load()
}

async function removeLastArea() {
    if (!team.value?.districts?.length) return showAppAlert('삭제할 구역이 없어요')
    const last = team.value.districts[team.value.districts.length - 1]
    showAppConfirm(`${last.name}을 삭제할까요?`, async (yes) => {
        if (!yes) return
        const r = await callApiPromise('/api/area-score/area/remove-last', {})
        if (!r.success) return showAppAlert(r.message)
        showToast(`${r.name} 삭제되었어요`)
        load()
    })
}

const progressPct = computed(() => {
    if (!today.value) return 0
    return Math.min(100, Math.round((today.value.points / today.value.goal) * 100))
})

function load() {
    loading.value = true
    callApi('/api/area-score/today', {}, (r) => {
        loading.value = false
        if (!r?.success) {
            showAppAlert(r?.message || '불러오기 실패')
            return
        }
        view.value = r.view
        if (r.view === 'area_lead' || r.view === 'sub_area_lead') {
            today.value = r.today
            week.value = r.week
        } else if (r.view === 'team_coach') {
            team.value = r.team
            otherTeams.value = r.otherTeams || []
            mission.value = r.mission || []
            week.value = r.week
        } else if (r.view === 'region_admin') {
            regionTeams.value = r.regionTeams || []
            week.value = r.week
        }
    })
}

function copyRegionOverview() {
    const lines = [`[구역 점수 전체 현황] ${week.value.start} ~ ${week.value.end} (일~토)`, '']
    for (const t of regionTeams.value) {
        lines.push(`■ ${t.teamName} (주간 총점 ${t.weekTotal.toFixed(1)})`)
        for (const d of t.districts) {
            lines.push(`  ${d.name}: 오늘 ${d.today.toFixed(1)} / 주간 ${d.week.toFixed(1)}`)
        }
        const missionText = t.mission.map((b) => `${b.label} ${b.done ? '완료' : '미완료'}`).join(' / ')
        lines.push(`  지역장교관 미션: ${missionText}`)
        lines.push('')
    }
    copyText(lines.join('\n'))
    showToast('전체 현황이 복사되었어요 📋')
}

async function toggleItem(item) {
    if (item.locked) {
        router.push({ name: 'areaScoreRequests', query: { itemCode: item.code } })
        return
    }
    const r = await callApiPromise('/api/area-score/toggle', { itemCode: item.code, done: !item.done })
    if (!r.success) return showAppAlert(r.message || '처리 실패')
    item.done = !item.done
    today.value.points = r.points
}

async function completeMissionBlock(block) {
    const r = await callApiPromise('/api/area-score/mission/complete', { blockCode: block.code })
    if (!r.success) return showAppAlert(r.message || '처리 실패')
    block.done = true
    showAppAlert('미션 완료 체크되었습니다! 🔥')
}

onMounted(load)
</script>

<template>
    <div class="screen">
        <div class="header">
            <span class="header-emoji">🎯</span>
            <h3>구역 점수</h3>
            <p v-if="week">{{ week.start }} ~ {{ week.end }} (일~토)</p>
        </div>

        <div v-if="loading" style="text-align:center; padding:30px;">불러오는 중...</div>

        <div v-else-if="!view" class="input-card" style="text-align:center; padding:30px;">
            구역 점수 기능은 구역장 · 부구역장 · 지역장 · 전도팀장 · 전도교관 · 지역총무 · 수지역장만 이용할 수 있어요.
        </div>

        <!-- ── 구역장 / 부구역장 ─────────────────────────────────── -->
        <template v-else-if="view === 'area_lead' || view === 'sub_area_lead'">
            <div class="input-card">
                <label style="margin-top:0;">오늘 목표</label>
                <div style="display:flex; align-items:baseline; gap:6px; margin-bottom:8px;">
                    <span style="font-size:28px; color:var(--btn-color); font-weight:bold;">{{ today.points.toFixed(1) }}</span>
                    <span style="color:#999;">/ {{ today.goal.toFixed(1) }}점</span>
                </div>
                <div style="height:10px; border-radius:6px; background:#EEE; overflow:hidden;">
                    <div :style="{ width: progressPct + '%', height: '100%', background: 'var(--accent-color)' }"></div>
                </div>
            </div>

            <div class="input-card">
                <label style="margin-top:0;">세부 항목</label>
                <div v-for="item in today.items" :key="item.code"
                     style="display:flex; align-items:center; gap:10px; padding:10px 0; border-top:1px dashed #eee;">
                    <button v-if="item.locked" class="btn-locked" style="width:auto; padding:6px 10px;" @click="toggleItem(item)">🔒 재가 요청</button>
                    <button v-else class="btn-approve"
                            :style="{ width: 'auto', padding: '6px 10px', background: item.done ? '#4CAF50' : '#B0BEC5' }"
                            @click="toggleItem(item)">{{ item.done ? '✓ 완료' : '체크' }}</button>
                    <div style="flex:1;">
                        <div>{{ item.label }}</div>
                        <div style="font-size:12px; color:#999;">{{ item.points }}점</div>
                    </div>
                </div>
            </div>

            <div class="input-grid-2">
                <div class="input-card" style="text-align:center;">
                    <div style="font-size:12px; color:#999;">이번주 구역 총점</div>
                    <div style="font-size:22px; color:var(--btn-color); font-weight:bold;">{{ week.areaTotal.toFixed(1) }}</div>
                </div>
                <div class="input-card" style="text-align:center;">
                    <div style="font-size:12px; color:#999;">이번주 지역 총점</div>
                    <div style="font-size:22px; color:var(--btn-color); font-weight:bold;">{{ week.teamTotal.toFixed(1) }}</div>
                </div>
            </div>

            <button v-if="view === 'sub_area_lead'" class="btn-sm" style="display:block; margin:15px auto 0;"
                    @click="router.push({ name: 'areaScoreRequests' })">📝 재가 요청서 보기</button>
        </template>

        <!-- ── 수지역장 / 전도교관 / 지역총무 ───────────────────────────── -->
        <template v-else-if="view === 'region_admin'">
            <button class="btn" @click="copyRegionOverview">📋 전체 현황 복사하기</button>

            <div v-for="t in regionTeams" :key="t.teamId" class="input-card">
                <label style="margin-top:0; display:flex; align-items:center; justify-content:space-between;">
                    <span>{{ t.teamName }}</span>
                    <span style="color:var(--btn-color);">주간 총점 {{ t.weekTotal.toFixed(1) }}</span>
                </label>
                <table class="admin-stats-table">
                    <thead><tr><th>구역</th><th>오늘</th><th>주간</th></tr></thead>
                    <tbody>
                        <tr v-for="d in t.districts" :key="d.areaId">
                            <td class="stat-label">{{ d.name }}</td>
                            <td>{{ d.today.toFixed(1) }}</td>
                            <td>{{ d.week.toFixed(1) }}</td>
                        </tr>
                    </tbody>
                </table>
                <div style="font-size:12px; color:#888; margin-top:8px;">
                    지역장교관 미션:
                    <span v-for="(b, i) in t.mission" :key="b.code">
                        {{ b.label }} {{ b.done ? '✅' : '⬜' }}<span v-if="i < t.mission.length - 1"> / </span>
                    </span>
                </div>
            </div>
        </template>

        <!-- ── 지역장 / 전도팀장 ─────────────────────────────────── -->
        <template v-else-if="view === 'team_coach'">
            <div class="input-card">
                <label style="margin-top:0; display:flex; align-items:center; justify-content:space-between;">
                    <span>우리 지역 구역별 현황</span>
                    <span style="font-size:12px; color:#999;">터치하면 상세보기</span>
                </label>
                <div v-for="d in team.districts" :key="d.areaId">
                    <div style="display:flex; align-items:center; gap:8px; padding:8px 0; border-top:1px dashed #eee; cursor:pointer;" @click="toggleAreaDetail(d.areaId)">
                        <span style="flex:1; font-weight:bold;">{{ d.name }}</span>
                        <span style="font-size:13px; color:#555;">오늘 {{ d.today.toFixed(1) }}</span>
                        <span style="font-size:13px; color:var(--btn-color);">주간 {{ d.week.toFixed(1) }}</span>
                        <span style="color:#aaa; font-size:12px;">{{ areaDetails[d.areaId] ? '▲' : '▼' }}</span>
                    </div>
                    <div v-if="areaDetails[d.areaId]" style="background:#f9f9f9; border-radius:8px; padding:8px 10px; margin-bottom:6px; font-size:12px;">
                        <div v-if="areaDetails[d.areaId].loading" style="color:#aaa; text-align:center; padding:6px;">불러오는 중...</div>
                        <template v-else>
                            <div v-if="!areaDetails[d.areaId].days.length" style="color:#aaa; text-align:center; padding:6px;">이번 주 기록 없음</div>
                            <div v-for="day in areaDetails[d.areaId].days" :key="day.dateKey" style="margin-bottom:6px;">
                                <div style="font-weight:bold; color:#555; margin-bottom:2px;">{{ day.dateKey }} ({{ day.points.toFixed(1) }}점)</div>
                                <div style="display:flex; flex-wrap:wrap; gap:4px;">
                                    <span v-if="day.items.offline_search.done" style="padding:2px 8px; border-radius:10px; font-size:11px; color:#333; background:#FFCC80;">오프라인{{ day.items.offline_search.byName ? ' · ' + day.items.offline_search.byName : '' }}</span>
                                    <span v-if="day.items.online_search.done"  style="padding:2px 8px; border-radius:10px; font-size:11px; color:#333; background:#A5D6A7;">온라인{{ day.items.online_search.byName ? ' · ' + day.items.online_search.byName : '' }}</span>
                                    <span v-if="day.items.teacher_match.done"  style="padding:2px 8px; border-radius:10px; font-size:11px; color:#333; background:#90CAF9;">교사매칭{{ day.items.teacher_match.byName ? ' · ' + day.items.teacher_match.byName : '' }}</span>
                                    <span v-if="day.items.gospel_room.done"    style="padding:2px 8px; border-radius:10px; font-size:11px; color:#333; background:#CE93D8;">복음방{{ day.items.gospel_room.byName ? ' · ' + day.items.gospel_room.byName : '' }}</span>
                                </div>
                            </div>
                        </template>
                    </div>
                </div>
            </div>

            <div class="input-card" style="text-align:center;">
                <div style="font-size:12px; color:#999;">우리 지역 주간 총점</div>
                <div style="font-size:26px; color:var(--btn-color); font-weight:bold;">{{ team.weekTotal.toFixed(1) }}</div>
                <div style="font-size:13px; color:#aaa; margin-top:4px;">목표 {{ team.weekGoal }}점 (구역당 2점)</div>
            </div>

            <div class="input-card">
                <label style="margin-top:0; display:flex; align-items:center; justify-content:space-between;">
                    <span>구역 관리</span>
                    <span style="font-size:12px; color:#999;">맨 마지막 구역만 추가/삭제</span>
                </label>
                <div style="display:flex; gap:10px; margin-top:6px;">
                    <button class="btn-sm" style="flex:1;" @click="addArea">+ 구역 추가</button>
                    <button class="btn-neg" style="flex:1; font-size:14px; padding:8px;" @click="removeLastArea">- 마지막 구역 삭제</button>
                </div>
            </div>

            <div class="input-card">
                <label style="margin-top:0;">타 지역 주간 총점</label>
                <table class="admin-stats-table">
                    <thead><tr><th>지역</th><th>주간 총점</th></tr></thead>
                    <tbody>
                        <tr v-for="t in otherTeams" :key="t.teamId">
                            <td class="stat-label">{{ t.name }}</td>
                            <td>{{ t.weekTotal.toFixed(1) }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div class="input-card">
                <label style="margin-top:0;">지역장교관 2일 미션 <span style="font-size:12px; color:#999;">(오프라인 찾기 1건 / 2일)</span></label>
                <div v-for="b in mission" :key="b.code"
                     style="display:flex; align-items:center; justify-content:space-between; padding:8px 0; border-top:1px dashed #eee;">
                    <span>{{ b.label }}</span>
                    <button v-if="b.done" class="btn-approve" style="width:auto; padding:5px 12px;">✓ 완료</button>
                    <button v-else class="btn-sm" @click="completeMissionBlock(b)">완료 체크</button>
                </div>
            </div>
        </template>

        <button class="btn-neg" style="max-width:200px; margin:20px auto 0; display:block;" @click="router.back()">뒤로</button>
    </div>
</template>
