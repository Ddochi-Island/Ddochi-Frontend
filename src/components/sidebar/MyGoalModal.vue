<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useApi } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'
import { useAuthStore } from '@/stores/auth'

// [2026-04-22] v2-test DB 스키마 (SCHEMA_REDESIGN.md §3.1 personal_goals) 기준 재작성.
// V2 필드명: dm/qr/nf/mh/ec/sc/tec/tsc
//   nf=번호찾, mh=만남픽스, ec=만남성사, sc=상담따기, tec=교사 매칭성사, tsc=교사 상담따기
// 서버 /api/my-goal save 는 V1/V2 둘 다 수용(mapV1[k] || k), get 은 V2 raw 반환.
// get-personal-stats 응답은 아직 V1 shape (inducer.regOn/regOff/manOn/... ) → V2 로 집계.

const emit = defineEmits(['close'])
const { callApi, callApiPromise } = useApi()
const { showAppAlert } = usePopup()
const auth = useAuthStore()

import { dayLabels } from '@/constants'

const loading = ref(true)
const saving = ref(false)
// V3.16: effective week-start dow (user override > global > 0). 안내 문구 동적.
const weekStartLabel = ref('일요일')

const current = reactive({
    dm: 0, qr: 0, nf: 0, mh: 0, ec: 0, sc: 0,
    tec: 0, tsc: 0
})
const goals = reactive({
    dm: 0, qr: 0, nf: 0, mh: 0, ec: 0, sc: 0,
    tec: 0, tsc: 0
})

const INDUCER_ROWS = [
    { key: 'dm', label: '📩 디엠 (건)' },
    { key: 'qr', label: '📷 큐알 (건)' },
    { key: 'nf', label: '📝 번호찾 (건)' },
    { key: 'mh', label: '🤝 만남픽스 (건)' },
    { key: 'ec', label: '🛡️ 만남성사 (건)' },
    { key: 'sc', label: '🌾 상담따기 (건)' }
]
const TEACHER_ROWS = [
    { key: 'tec', label: '🛡️ 교사 매칭성사 (건)' },
    { key: 'tsc', label: '🌾 교사 상담따기 (건)' }
]

function progressPct(cur, goal) {
    if (!goal || goal <= 0) return 0
    return Math.min(100, Math.round((cur / goal) * 100))
}
function progressColor(cur, goal) {
    return goal > 0 && cur >= goal ? '#4CAF50' : '#FFB74D'
}

// V1→V2 매핑표 (get-personal-stats 응답 V1 shape 를 V2 로 집계)
function mapStatsToV2(weekly) {
    if (!weekly) return null
    const ind = weekly.inducer || {}
    const tch = weekly.teacher || {}
    return {
        dm: ind.dm || 0,
        qr: ind.qr || 0,
        nf: (ind.regOn || 0) + (ind.regOff || 0),
        mh: (ind.manOn || 0) + (ind.manOff || 0),
        ec: (ind.matOn || 0) + (ind.matOff || 0),
        sc: (ind.ttagiOn || 0) + (ind.ttagiOff || 0),
        tec: tch.matched || 0,
        tsc: tch.ttagi || 0
    }
}

// 혹시 모를 구(V1) 필드가 응답에 남아있을 경우 V2 필드로 옮김 (서버가 점진 마이그 중일 수 있음)
const V1_TO_V2 = { reg: 'nf', man: 'mh', mat: 'ec', ttagi: 'sc', tMat: 'tec', tTtagi: 'tsc' }

async function loadAll() {
    loading.value = true
    try {
        const [goalRes, statsRes, weekRes] = await Promise.all([
            callApiPromise('/api/my-goal', { sabun: auth.currentSabun, action: 'get' }),
            callApiPromise('/api/get-personal-stats', { sabun: auth.currentSabun }),
            callApiPromise('/api/get-week-start-dow', {})
        ])
        // V3.16: 안내 문구 동적
        if (weekRes && weekRes.success && weekRes.effective != null) {
            weekStartLabel.value = `${dayLabels[Number(weekRes.effective)]}요일`
        }

        // 1) 목표 로드 — 기본 V2 필드명
        const g = (goalRes && goalRes.goals) || {}
        for (const k of Object.keys(goals)) goals[k] = g[k] || 0
        // 2) V1 필드가 남아있으면 V2 로 흡수 (하위호환)
        for (const [v1Key, v2Key] of Object.entries(V1_TO_V2)) {
            if (g[v1Key] !== undefined && g[v1Key] !== null && !g[v2Key]) {
                goals[v2Key] = g[v1Key]
            }
        }

        // 3) 실적(현재 달성량)
        const weekly = (statsRes && statsRes.success && statsRes.stats) ? statsRes.stats.weekly : null
        const mapped = mapStatsToV2(weekly)
        if (mapped) Object.assign(current, mapped)
    } catch (err) {
        showAppAlert('데이터 로딩 중 에러가 발생했어 😢')
        console.error(err)
    } finally {
        loading.value = false
    }
}

function save() {
    if (saving.value) return
    saving.value = true
    // V2 필드명 그대로 전송 (서버 mapV1 pass-through)
    const payload = {}
    for (const k of Object.keys(goals)) payload[k] = parseInt(goals[k]) || 0

    callApi('/api/my-goal', { sabun: auth.currentSabun, action: 'save', goals: payload }, (r) => {
        saving.value = false
        if (r && r.success) {
            showAppAlert((r && r.message) || '저장 완료!', () => loadAll())
        } else {
            showAppAlert((r && r.message) || '저장 실패 ㅠ')
        }
    })
}

onMounted(loadAll)
</script>

<template>
    <Teleport to="body">
        <div class="modal-overlay" @click.self="emit('close')">
            <div class="admin-modal-card">
                <div class="modal-header-sticky">
                    <div class="modal-title" style="margin:0; text-align:center; width:100%;">🏆 나의 주간 목표</div>
                    <span class="modal-close-sticky" style="position:absolute; right:20px;" @click="emit('close')">×</span>
                </div>

                <div class="modal-content-scroll">
                    <div v-if="loading" style="text-align:center; padding:30px;">
                        나의 목표와 실적을 불러오고 있어... ⏳
                    </div>

                    <template v-else>
                        <div style="font-size:12px; color:#666; margin-bottom:15px; line-height:1.5;">
                            이번 주({{ weekStartLabel }} 기준) 목표를 설정하고 달성도를 확인해봐! 🔥<br>
                            입력한 목표는 나에게만 보입니다.
                        </div>

                        <div style="font-size:14px; font-weight:bold; color:#E65100; margin-bottom:8px;">🚩 인도자 목표</div>
                        <div v-for="row in INDUCER_ROWS" :key="row.key"
                            style="background:#FAFAFA; border:1px solid #eee; padding:10px; border-radius:10px; margin-bottom:10px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                                <label style="font-size:13px; font-weight:bold; color:#5D4037; margin:0;">{{ row.label }}</label>
                                <div style="display:flex; align-items:center; gap:5px;">
                                    <span style="font-size:12px; color:#888;">달성: {{ current[row.key] }} /</span>
                                    <input type="number" v-model.number="goals[row.key]" class="input-card"
                                        style="margin:0; padding:2px 5px; width:50px; text-align:center; font-size:14px; border:1px solid #ddd; background:#fff;">
                                </div>
                            </div>
                            <div style="background:#e0e0e0; height:8px; border-radius:4px; overflow:hidden;">
                                <div :style="{ background: progressColor(current[row.key], goals[row.key]), height:'100%', width: progressPct(current[row.key], goals[row.key]) + '%', transition:'0.3s' }"></div>
                            </div>
                        </div>

                        <div style="border-top:1px dashed #ddd; margin:20px 0;"></div>

                        <div style="font-size:14px; font-weight:bold; color:#2E7D32; margin-bottom:8px;">👨‍🏫 교사 목표</div>
                        <div v-for="row in TEACHER_ROWS" :key="row.key"
                            style="background:#FAFAFA; border:1px solid #eee; padding:10px; border-radius:10px; margin-bottom:10px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                                <label style="font-size:13px; font-weight:bold; color:#5D4037; margin:0;">{{ row.label }}</label>
                                <div style="display:flex; align-items:center; gap:5px;">
                                    <span style="font-size:12px; color:#888;">달성: {{ current[row.key] }} /</span>
                                    <input type="number" v-model.number="goals[row.key]" class="input-card"
                                        style="margin:0; padding:2px 5px; width:50px; text-align:center; font-size:14px; border:1px solid #ddd; background:#fff;">
                                </div>
                            </div>
                            <div style="background:#e0e0e0; height:8px; border-radius:4px; overflow:hidden;">
                                <div :style="{ background: progressColor(current[row.key], goals[row.key]), height:'100%', width: progressPct(current[row.key], goals[row.key]) + '%', transition:'0.3s' }"></div>
                            </div>
                        </div>

                        <div class="btn-group" style="margin-top:25px;">
                            <button class="btn-pos" :disabled="saving" style="background:#FFB74D;" @click="save">
                                {{ saving ? '저장 중...' : '목표 저장하기 🎯' }}
                            </button>
                            <button class="btn-neg" @click="emit('close')">닫기</button>
                        </div>
                    </template>
                </div>
            </div>
        </div>
    </Teleport>
</template>
