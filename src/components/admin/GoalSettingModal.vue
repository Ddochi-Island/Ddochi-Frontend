<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useApi } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'

// [2026-04-22] index2.html openGoalSettingScreen / loadTeamGoals / saveTeamGoals
// (L9067-9206) 이식. 팀 선택 → 구역별 목표 입력 (reg/tm/appr + qr/flyer/promo/dm).

const emit = defineEmits(['close'])
const { callApi, callApiPromise } = useApi()
const { showAppAlert } = usePopup()

const step = ref('teamSelect') // teamSelect | goalForm | loading
const teams = ref([])
const selectedTeam = ref('')
const areas = ref([])
// goalsByArea[areaKey] = { reg, tm, appr, qr, flyer, promo, dm }
const goalsByArea = reactive({})
const saving = ref(false)

const METRICS = [
    { key: 'talk', label: '말걸기' },
    { key: 'reg', label: '번호' },
    { key: 'tm', label: 'TM' },
    { key: 'appr', label: '재가' }
]
const EXTRA_METRICS = [
    { key: 'qr', label: 'QR' },
    { key: 'flyer', label: '전단지' },
    { key: 'promo', label: '홍보' },
    { key: 'dm', label: 'DM' }
]
const ALL_METRIC_KEYS = [...METRICS, ...EXTRA_METRICS].map(m => m.key)

// 🏆 팀 전체 목표 = 모든 구역 목표의 합 (자동 계산, readonly).
// 사용자가 구역 값을 바꾸면 Total 도 즉시 따라옴.
const computedTotal = computed(() => {
    const sum = Object.fromEntries(ALL_METRIC_KEYS.map(k => [k, 0]))
    for (const key of Object.keys(goalsByArea)) {
        if (key === 'Total') continue
        const row = goalsByArea[key] || {}
        for (const k of ALL_METRIC_KEYS) {
            sum[k] += parseInt(row[k]) || 0
        }
    }
    return sum
})

async function loadTeams() {
    const r = await callApiPromise('/api/get-teams', {})
    if (!r || !r.success || !r.list?.length) {
        showAppAlert('팀 정보를 불러오지 못했어. (데이터 없음)')
        return
    }
    teams.value = r.list
}

async function pickTeam(team) {
    selectedTeam.value = team
    step.value = 'loading'

    try {
        // Phase 14-F: /api/get-admin-stats 대신 신규 /api/get-team-areas 사용.
        // (admin-stats 는 req.user.sabun 기준 자기 팀 areas 만 반환해서 다른 팀 선택 불가했음.
        //  ORACLE_SCHEMA.md §AREAS 직접 조회로 분리 — admin / 지역권한자 다 OK.)
        const [areasRes, goalRes] = await Promise.all([
            callApiPromise('/api/get-team-areas', { team }),
            callApiPromise('/api/get-telegram-goals', { team })
        ])
        if (!areasRes || !areasRes.success) {
            showAppAlert(areasRes?.message || '구역 정보를 가져오지 못했어.')
            step.value = 'teamSelect'
            return
        }
        areas.value = areasRes.areas || []
        const savedGoals = (goalRes && goalRes.goals) || {}

        for (const key of Object.keys(goalsByArea)) delete goalsByArea[key]
        const defaultRow = () => ({ talk: 0, reg: 0, tm: 0, appr: 0, qr: 0, flyer: 0, promo: 0, dm: 0 })
        // Total 은 computedTotal 로 자동 계산 — goalsByArea 에 두지 않음 (구역 변경 시 동기화 안 되는 버그 방지).
        // 기존 저장된 Total 값이 있더라도 무시하고 구역 합으로 덮어씀 (정합 보장).
        areas.value.forEach(area => {
            goalsByArea[area] = { ...defaultRow(), ...(savedGoals[area] || {}) }
        })
        step.value = 'goalForm'
    } catch (err) {
        showAppAlert('데이터 로딩 중 에러가 발생했어 😢: ' + err.message)
        step.value = 'teamSelect'
    }
}

function backToTeamSelect() {
    step.value = 'teamSelect'
    selectedTeam.value = ''
}

function distributeTotal(key, rawValue) {
    const n = parseInt(rawValue) || 0
    const areaKeys = Object.keys(goalsByArea)
    const count = areaKeys.length
    if (count === 0) return
    const base = Math.floor(n / count)
    const remainder = n % count
    areaKeys.forEach((areaKey, i) => {
        goalsByArea[areaKey][key] = base + (i < remainder ? 1 : 0)
    })
}

function saveGoals() {
    const team = selectedTeam.value
    if (!team) return
    saving.value = true
    const goals = {}
    for (const key of Object.keys(goalsByArea)) {
        const row = goalsByArea[key]
        goals[key] = {
            talk: parseInt(row.talk) || 0,
            reg: parseInt(row.reg) || 0,
            tm: parseInt(row.tm) || 0,
            appr: parseInt(row.appr) || 0,
            qr: parseInt(row.qr) || 0,
            flyer: parseInt(row.flyer) || 0,
            promo: parseInt(row.promo) || 0,
            dm: parseInt(row.dm) || 0
        }
    }
    // Total 은 computed 의 현재 값 (구역 합) 으로 저장.
    goals['Total'] = { ...computedTotal.value }
    callApi('/api/save-telegram-goals', { team, goals }, (r) => {
        saving.value = false
        showAppAlert((r && r.message) || (r && r.success ? '저장 완료!' : '저장 실패 ㅠ'), () => {
            if (r && r.success) emit('close')
        })
    })
}

onMounted(loadTeams)
</script>

<template>
    <Teleport to="body">
        <div class="modal-overlay" @click.self="emit('close')">
            <div class="admin-modal-card">
                <div class="modal-header-sticky">
                    <div class="modal-title" style="margin:0; text-align:center; width:100%;">🎯 목표 설정</div>
                    <span class="modal-close-sticky" style="position:absolute; right:20px;" @click="emit('close')">×</span>
                </div>

                <div class="modal-content-scroll">
                    <!-- 팀 선택 화면 -->
                    <template v-if="step === 'teamSelect'">
                        <div style="text-align:center; margin-bottom:10px;">설정할 팀을 선택해줘!</div>
                        <div v-if="!teams.length" style="text-align:center; padding:20px; color:#888;">팀 정보 불러오는 중...</div>
                        <div v-else class="btn-col">
                            <button v-for="team in teams" :key="team"
                                class="btn-pos" style="background:#5D4037; margin-bottom:8px;"
                                @click="pickTeam(team)">{{ team }}</button>
                        </div>
                    </template>

                    <!-- 로딩 -->
                    <template v-else-if="step === 'loading'">
                        <div style="text-align:center; padding:30px;">구역 정보와 기존 목표를 가져오는 중...</div>
                    </template>

                    <!-- 목표 입력 화면 -->
                    <template v-else>
                        <div style="font-size:15px; font-weight:bold; color:#5D4037; margin-bottom:5px;">🎯 {{ selectedTeam }} 목표 설정</div>
                        <div style="font-size:12px; color:#666; margin-bottom:10px;">각 항목의 목표 수치를 입력해줘 (숫자만)</div>

                        <!-- 🏆 팀 전체 목표 — 직접 입력 시 구역 균등 분배 / 구역 수정 시 자동 합산 -->
                        <div style="background:#FFF3E0; padding:10px; border-radius:10px; margin-bottom:10px; border:1px solid #eee;">
                            <div style="font-weight:bold; color:#E65100; margin-bottom:3px;">🏆 팀 전체 목표</div>
                            <div style="font-size:10px; color:#888; margin-bottom:8px;">직접 입력하면 구역에 균등 분배 · 구역 수정하면 자동 합산</div>
                            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:5px; margin-bottom:5px;">
                                <div v-for="m in METRICS" :key="m.key">
                                    <span style="font-size:10px;">{{ m.label }}</span>
                                    <input type="number" :value="computedTotal[m.key]"
                                        @change="distributeTotal(m.key, $event.target.value)"
                                        style="width:100%; text-align:center; border:1px solid #F57C00; border-radius:5px; padding:4px; background:#FFF8E1; color:#333; font-weight:bold;">
                                </div>
                            </div>
                            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:5px;">
                                <div v-for="m in EXTRA_METRICS" :key="m.key">
                                    <span style="font-size:10px;">{{ m.label }}</span>
                                    <input type="number" :value="computedTotal[m.key]"
                                        @change="distributeTotal(m.key, $event.target.value)"
                                        style="width:100%; text-align:center; border:1px solid #F57C00; border-radius:5px; padding:4px; background:#FFF8E1; color:#333; font-weight:bold;">
                                </div>
                            </div>
                        </div>

                        <!-- 📍 구역별 목표 -->
                        <div v-for="(row, key) in goalsByArea" :key="key"
                            style="background:#FAFAFA; padding:10px; border-radius:10px; margin-bottom:10px; border:1px solid #eee;">
                            <div style="font-weight:bold; color:#5D4037; margin-bottom:5px;">📍 {{ key }}</div>
                            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:5px; margin-bottom:5px;">
                                <div v-for="m in METRICS" :key="m.key">
                                    <span style="font-size:10px;">{{ m.label }}</span>
                                    <input type="number" v-model.number="row[m.key]"
                                        style="width:100%; text-align:center; border:1px solid #ddd; border-radius:5px; padding:4px;">
                                </div>
                            </div>
                            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:5px;">
                                <div v-for="m in EXTRA_METRICS" :key="m.key">
                                    <span style="font-size:10px;">{{ m.label }}</span>
                                    <input type="number" v-model.number="row[m.key]"
                                        style="width:100%; text-align:center; border:1px solid #ddd; border-radius:5px; padding:4px;">
                                </div>
                            </div>
                        </div>

                        <div class="btn-group" style="margin-top:15px;">
                            <button class="btn-pos" :disabled="saving" @click="saveGoals">
                                {{ saving ? '저장 중...' : '저장하기' }}
                            </button>
                            <button class="btn-neg" @click="backToTeamSelect">팀 다시 선택</button>
                        </div>
                    </template>
                </div>
            </div>
        </div>
    </Teleport>
</template>
