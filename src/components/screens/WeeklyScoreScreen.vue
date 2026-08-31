<script setup>
import { ref, computed, onMounted } from 'vue'
import { useApi } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'
import { useAuthStore } from '@/stores/auth'
import AreaTelegramConnectModal from '@/components/admin/AreaTelegramConnectModal.vue'

const { callApiPromise } = useApi()
const { showAppAlert } = usePopup()
const auth = useAuthStore()

const loading = ref(true)
const thisWeek = ref(null)
const prevWeek = ref(null)
const showTelegramModal = ref(false)

function kstToday() {
    const KST_OFFSET = 9 * 3600 * 1000
    const nowKst = new Date(Date.now() + KST_OFFSET)
    return `${nowKst.getUTCFullYear()}-${String(nowKst.getUTCMonth() + 1).padStart(2, '0')}-${String(nowKst.getUTCDate()).padStart(2, '0')}`
}

function currentWeekStart() {
    const KST_OFFSET = 9 * 3600 * 1000
    const nowKst = new Date(Date.now() + KST_OFFSET)
    const dow = nowKst.getUTCDay()
    const daysSinceMonday = (dow + 6) % 7
    const monday = new Date(nowKst.getTime() - daysSinceMonday * 86400000)
    return `${monday.getUTCFullYear()}-${String(monday.getUTCMonth() + 1).padStart(2, '0')}-${String(monday.getUTCDate()).padStart(2, '0')}`
}

function addDays(dateStr, n) {
    const [y, m, d] = dateStr.split('-').map(Number)
    const dt = new Date(Date.UTC(y, m - 1, d))
    dt.setUTCDate(dt.getUTCDate() + n)
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

const weekStart = ref(currentWeekStart())
const isCurrentWeek = computed(() => weekStart.value === currentWeekStart())

function prevWeekNav() { weekStart.value = addDays(weekStart.value, -7) }
function nextWeekNav() {
    const next = addDays(weekStart.value, 7)
    if (next <= currentWeekStart()) weekStart.value = next
}

function formatWeekLabel(ws) {
    const we = addDays(ws, 6)
    const [, m1, d1] = ws.split('-')
    const [, m2, d2] = we.split('-')
    return `${Number(m1)}.${Number(d1)} ~ ${Number(m2)}.${Number(d2)}`
}

// 내 구역
const myArea = computed(() => {
    if (!thisWeek.value) return null
    const myAreaName = auth.currentUserArea
    return thisWeek.value.areas.find(a => a.areaName === myAreaName) || null
})

// 전주 내 구역 그린pt
const prevMyGreenPt = computed(() => {
    if (!prevWeek.value || !myArea.value) return 0
    return prevWeek.value.areas.find(a => a.areaId === myArea.value.areaId)?.greenPt || 0
})

// 전주 대비 증가분%
const growthPct = computed(() => {
    if (!myArea.value) return null
    const prev = prevMyGreenPt.value
    const curr = myArea.value.greenPt
    if (prev === 0) return curr > 0 ? null : 0
    return Math.round((curr - prev) / prev * 1000) / 10
})

// 마감까지 남은 일수
const daysLeft = computed(() => {
    if (!thisWeek.value) return null
    const KST_OFFSET = 9 * 3600 * 1000
    const nowKst = new Date(Date.now() + KST_OFFSET)
    const [y, m, d] = thisWeek.value.weekEnd.split('-').map(Number)
    const endKst = new Date(Date.UTC(y, m - 1, d + 1))
    return Math.max(0, Math.ceil((endKst.getTime() - nowKst.getTime()) / 86400000))
})

// 그린pt 기준 전주 대비 증가율 순위
const ranked = computed(() => {
    if (!thisWeek.value) return []
    const prevMap = {}
    if (prevWeek.value) prevWeek.value.areas.forEach(a => { prevMap[a.areaId] = a.greenPt })
    return [...thisWeek.value.areas]
        .map(a => {
            const prev = prevMap[a.areaId] || 0
            const pct = prev > 0 ? (a.greenPt - prev) / prev * 100 : (a.greenPt > 0 ? 999 : 0)
            return { ...a, prev, pct }
        })
        .sort((a, b) => b.pct - a.pct)
})

function formatPct(pct) {
    if (pct === 999) return '신규'
    const sign = pct >= 0 ? '+' : ''
    return `${sign}${Math.round(pct * 10) / 10}%`
}

function formatGrowth(pct) {
    if (pct === null) return '신규'
    if (pct === 999) return '신규'
    const sign = pct >= 0 ? '+' : ''
    return `${sign}${Math.round(pct * 10) / 10}%`
}

const DOW_LABEL = ['일', '월', '화', '수', '목', '금', '토']
function formatDateLabel(dateStr) {
    if (!dateStr) return ''
    const [y, m, d] = dateStr.split('-').map(Number)
    const dow = DOW_LABEL[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
    return `${m}.${d}(${dow})`
}

async function load() {
    loading.value = true
    const ws = weekStart.value
    const prevWs = addDays(ws, -7)
    // 전주는 오늘과 동일 요일 기준 누적까지만 비교 (월요일이면 전주 월요일까지)
    const prevWeekEnd = addDays(kstToday(), -7)
    const [r1, r2] = await Promise.all([
        callApiPromise('/api/score/weekly', { week_start: ws }),
        callApiPromise('/api/score/weekly', { week_start: prevWs, week_end: prevWeekEnd }),
    ])
    loading.value = false
    if (!r1.success) return showAppAlert(r1.message || '불러오기 실패')
    thisWeek.value = r1.data
    if (r2.success) prevWeek.value = r2.data
}

// 주차 변경 시 재로딩
import { watch } from 'vue'
watch(weekStart, load)
onMounted(load)
</script>

<template>
    <div class="ws-wrap">
        <!-- 헤더 -->
        <div class="ws-header">
            <button class="ws-nav-btn" @click="prevWeekNav">‹</button>
            <div class="ws-header-center">
                <div class="ws-week-label">{{ formatWeekLabel(weekStart) }}</div>
                <div v-if="isCurrentWeek && daysLeft !== null" class="ws-days-left" :class="{ urgent: daysLeft <= 1 }">
                    {{ daysLeft === 0 ? '오늘 마감' : `마감 ${daysLeft}일` }}
                </div>
                <div v-else-if="!isCurrentWeek" class="ws-fixed-badge">확정</div>
            </div>
            <div class="ws-header-right">
                <button class="ws-tg-btn" @click="showTelegramModal = true" title="텔레그램 연결">
                    💬
                </button>
                <button class="ws-nav-btn" @click="nextWeekNav" :disabled="isCurrentWeek">›</button>
            </div>
        </div>

        <!-- 로딩 -->
        <div v-if="loading" class="ws-loading">
            <div class="ws-spinner"></div>
        </div>

        <template v-else-if="thisWeek">
            <!-- 내 구역 히어로 카드 -->
            <div v-if="myArea" class="ws-hero-card">
                <div class="ws-hero-area">{{ myArea.areaName }}</div>
                <div class="ws-hero-pts">
                    <div class="ws-hero-green">
                        <div class="ws-hero-pt-val">{{ myArea.greenPt.toFixed(1) }}</div>
                        <div class="ws-hero-pt-label">그린pt</div>
                        <div class="ws-hero-growth" :class="growthPct !== null && growthPct >= 0 ? 'up' : 'down'">
                            {{ formatGrowth(growthPct) }}
                        </div>
                    </div>
                    <div class="ws-hero-divider"></div>
                    <div class="ws-hero-blue">
                        <div class="ws-hero-pt-val blue">{{ myArea.approvedCount }}</div>
                        <div class="ws-hero-pt-label">합자찾</div>
                        <div class="ws-hero-pt-sub">블루 {{ myArea.bluePt }}pt</div>
                    </div>
                </div>
                <!-- 오늘 기록 (이번 주만) -->
                <div v-if="isCurrentWeek" class="ws-today-row">
                    <span class="ws-today-label">{{ formatDateLabel(thisWeek.today) }}</span>
                    <span class="ws-today-item">말걸기 {{ myArea.today.talkCount }}</span>
                    <span class="ws-today-item">번호찾 {{ myArea.today.regCount }}</span>
                    <span class="ws-today-item">디엠 {{ myArea.today.dmCount }}</span>
                    <span class="ws-today-item">유입 {{ myArea.today.onlineIntakeCount }}</span>
                    <span v-if="myArea.today.promoCount > 0" class="ws-today-item">홍보 {{ myArea.today.promoCount }}</span>
                    <span class="ws-today-green">{{ myArea.today.greenPt.toFixed(1) }}pt</span>
                </div>
            </div>
            <div v-else class="ws-no-area">내 구역 데이터가 없어요</div>

            <!-- 전체 순위 -->
            <div class="ws-rank-card">
                <div class="ws-rank-title">
                    전체 순위
                    <span class="ws-rank-sub">그린pt 증가율 기준</span>
                </div>
                <div class="ws-rank-header-row">
                    <span class="ws-col-rank"></span>
                    <span class="ws-col-name"></span>
                    <span class="ws-col-green">그린pt</span>
                    <span class="ws-col-blue">합자찾</span>
                </div>
                <div v-if="ranked.length === 0" class="ws-empty">데이터가 없어요</div>
                <div v-for="(a, i) in ranked" :key="a.areaId"
                    class="ws-rank-row" :class="{ 'my-area': a.areaName === auth.currentUserArea }">
                    <span class="ws-col-rank rank-num" :class="['gold','silver','bronze'][i] || ''">{{ i + 1 }}</span>
                    <div class="ws-col-name">
                        <span class="ws-rank-name">{{ a.areaName }}</span>
                        <span v-if="a.areaName === auth.currentUserArea" class="ws-my-badge">내 구역</span>
                    </div>
                    <div class="ws-col-green">
                        <span class="ws-green-pt">{{ a.greenPt.toFixed(1) }}</span>
                        <span class="ws-green-pct" :class="a.pct >= 0 ? 'up' : 'down'">{{ formatPct(a.pct) }}</span>
                    </div>
                    <div class="ws-col-blue">
                        <span class="ws-blue-cnt">{{ a.approvedCount }}개</span>
                    </div>
                </div>
            </div>
        </template>

        <!-- 텔레그램 연결 모달 -->
        <AreaTelegramConnectModal v-if="showTelegramModal" @close="showTelegramModal = false; load()" />
    </div>
</template>

<style scoped>
.ws-wrap { background: #f2f4f6; min-height: 100vh; padding-bottom: 32px; }

/* 헤더 */
.ws-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px 10px;
    background: #fff;
    border-bottom: 1px solid #f0f0f0;
    position: sticky;
    top: 0;
    z-index: 10;
}
.ws-header-center { display: flex; flex-direction: column; align-items: center; gap: 3px; }
.ws-header-right { display: flex; align-items: center; gap: 6px; }
.ws-week-label { font-size: 15px; font-weight: 700; color: #191f28; }
.ws-days-left { font-size: 11px; font-weight: 700; color: #4e5968; background: #f2f4f6; border-radius: 20px; padding: 2px 8px; }
.ws-days-left.urgent { background: #fff0e6; color: #e06b00; }
.ws-fixed-badge { font-size: 11px; font-weight: 700; color: #8b95a1; background: #f2f4f6; border-radius: 20px; padding: 2px 8px; }
.ws-nav-btn { width: 34px; height: 34px; background: #f2f4f6; border: none; border-radius: 10px; font-size: 18px; color: #4e5968; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.ws-nav-btn:disabled { color: #c8d1db; cursor: default; }
.ws-tg-btn { width: 34px; height: 34px; background: #f2f4f6; border: none; border-radius: 10px; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; }

/* 로딩 */
.ws-loading { display: flex; justify-content: center; align-items: center; height: 60vh; }
.ws-spinner { width: 32px; height: 32px; border: 3px solid #e5e8eb; border-top-color: #00c471; border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* 히어로 카드 */
.ws-hero-card { background: #fff; margin: 12px 16px 8px; border-radius: 20px; padding: 20px; }
.ws-hero-area { font-size: 13px; font-weight: 700; color: #8b95a1; margin-bottom: 14px; }
.ws-hero-pts { display: flex; align-items: center; gap: 0; margin-bottom: 16px; }
.ws-hero-green { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; }
.ws-hero-blue  { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; }
.ws-hero-divider { width: 1px; height: 56px; background: #f2f4f6; margin: 0 12px; }
.ws-hero-pt-val { font-size: 44px; font-weight: 800; letter-spacing: -1.5px; line-height: 1; color: #00c471; }
.ws-hero-pt-val.blue { color: #3182f6; }
.ws-hero-pt-label { font-size: 12px; color: #8b95a1; font-weight: 600; }
.ws-hero-pt-sub { font-size: 11px; color: #c8d1db; }
.ws-hero-growth { font-size: 14px; font-weight: 700; }
.ws-hero-growth.up { color: #00c471; }
.ws-hero-growth.down { color: #ff4040; }

/* 오늘 기록 */
.ws-today-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; padding-top: 14px; border-top: 1px solid #f2f4f6; }
.ws-today-label { font-size: 11px; font-weight: 700; color: #8b95a1; }
.ws-today-item { font-size: 12px; color: #4e5968; background: #f2f4f6; border-radius: 6px; padding: 2px 7px; }
.ws-today-green { margin-left: auto; font-size: 13px; font-weight: 800; color: #00c471; }

.ws-no-area { text-align: center; padding: 32px; color: #8b95a1; font-size: 14px; }

/* 전체 순위 */
.ws-rank-card { background: #fff; margin: 0 16px; border-radius: 20px; padding: 20px; }
.ws-rank-title { font-size: 15px; font-weight: 800; color: #191f28; margin-bottom: 14px; display: flex; align-items: baseline; gap: 8px; }
.ws-rank-sub { font-size: 11px; color: #8b95a1; font-weight: 500; }

.ws-rank-header-row { display: flex; align-items: center; padding: 0 4px 8px; border-bottom: 1px solid #f2f4f6; margin-bottom: 4px; }
.ws-rank-row { display: flex; align-items: center; padding: 10px 4px; border-radius: 10px; margin-bottom: 2px; }
.ws-rank-row.my-area { background: #f2fdf7; }

.ws-col-rank { width: 28px; flex-shrink: 0; }
.ws-col-name { flex: 1; display: flex; align-items: center; gap: 6px; min-width: 0; }
.ws-col-green { width: 90px; flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; }
.ws-col-blue  { width: 50px; flex-shrink: 0; text-align: right; }

.ws-rank-header-row .ws-col-green,
.ws-rank-header-row .ws-col-blue { font-size: 11px; color: #8b95a1; font-weight: 600; }

.rank-num { font-size: 15px; font-weight: 800; color: #c8d1db; }
.rank-num.gold   { color: #f5a623; }
.rank-num.silver { color: #8b95a1; }
.rank-num.bronze { color: #cd7f32; }

.ws-rank-name { font-size: 14px; font-weight: 600; color: #191f28; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ws-my-badge { font-size: 10px; font-weight: 700; background: #e8faf3; color: #00c471; border-radius: 4px; padding: 1px 5px; flex-shrink: 0; }

.ws-green-pt { font-size: 15px; font-weight: 700; color: #191f28; }
.ws-green-pct { font-size: 11px; font-weight: 600; }
.ws-green-pct.up { color: #00c471; }
.ws-green-pct.down { color: #ff4040; }

.ws-blue-cnt { font-size: 14px; font-weight: 700; color: #3182f6; }

.ws-empty { text-align: center; padding: 24px; color: #8b95a1; font-size: 14px; }
</style>
