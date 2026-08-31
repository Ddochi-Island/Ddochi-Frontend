<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useApi } from '@/composables/useApi'

const auth = useAuthStore()
const { callApi } = useApi()

const currentTab = ref('inducer')
const currentPeriod = ref('weekly')
const statsData = ref(null)

function switchTab(tab) { currentTab.value = tab }
function switchPeriod(period) { currentPeriod.value = period }

function drawFunnel(label, value, prevValue, rateLabel, extraDesc = '', isLast = false) {
    let rate = 0
    if (prevValue && prevValue > 0) rate = ((value / prevValue) * 100).toFixed(1)
    let barWidth = 100
    if (prevValue > 0) barWidth = Math.min(100, Math.max(2, (value / prevValue) * 100))
    else if (prevValue === 0) barWidth = value > 0 ? 100 : 0

    let rateColor = '#FF9800'
    if (rate >= 50) rateColor = '#4CAF50'
    if (rate < 10) rateColor = '#F44336'

    return { label, value, prevValue, rateLabel, rate, rateColor, barWidth, extraDesc, isLast }
}

function getInducerFunnels() {
    if (!statsData.value) return []
    const ind = statsData.value[currentPeriod.value].inducer
    return {
        online: [
            drawFunnel('디엠 발송', ind.dm, null, ''),
            drawFunnel('번호찾 (경로: 디엠)', ind.regDm, ind.dm, '디엠변환'),
            drawFunnel('만남픽스', ind.manOn, ind.regOn, '번찾→만', `※ 번찾만은 "온라인 전체 번호찾기(${ind.regOn}건)" 대비 비율입니다.`),
            drawFunnel('재가', ind.jaeOn, ind.manOn, '만찾재'),
            drawFunnel('진행된 매칭', ind.matOn, ind.jaeOn, '재가→매', '', true),
        ],
        offline: [
            drawFunnel('번호찾', ind.regOff, null, ''),
            drawFunnel('만남픽스', ind.manOff, ind.regOff, '번찾만'),
            drawFunnel('재가', ind.jaeOff, ind.manOff, '만찾재'),
            drawFunnel('진행된 매칭', ind.matOff, ind.jaeOff, '재가→매', '', true),
        ]
    }
}

function getTeacherFunnels() {
    if (!statsData.value) return []
    const tea = statsData.value[currentPeriod.value].teacher
    return [
        drawFunnel('진행된 매칭 (배당 건수)', tea.matched, null, ''),
        drawFunnel('상담따기 성공', tea.ttagi, tea.matched, '상담 성공률', '', true),
    ]
}

onMounted(() => {
    callApi('/api/get-personal-stats', { sabun: auth.currentSabun }, (r) => {
        if (r.success) statsData.value = r.stats
    })
})
</script>

<template>
    <div class="screen">
        <div class="header">
            <span class="header-emoji">📊</span>
            <h3>내 사역 통계 분석</h3>
            <p>나의 사역 강점과 약점을 파악해보자!</p>
        </div>

        <div class="ps-tab-container">
            <button class="ps-tab-btn" :class="{ active: currentTab === 'inducer' }" @click="switchTab('inducer')">🚩 인도자 전적</button>
            <button class="ps-tab-btn" :class="{ active: currentTab === 'teacher' }" @click="switchTab('teacher')">👨‍🏫 교사 전적</button>
        </div>

        <div style="display:flex; justify-content:center; gap:10px; margin-bottom:20px;">
            <button class="btn-sm" :style="{ background: currentPeriod === 'weekly' ? 'var(--btn-color)' : '#B0BEC5', padding: '8px 20px' }" @click="switchPeriod('weekly')">이번 주</button>
            <button class="btn-sm" :style="{ background: currentPeriod === 'monthly' ? 'var(--btn-color)' : '#B0BEC5', padding: '8px 20px' }" @click="switchPeriod('monthly')">이번 달</button>
        </div>

        <div v-if="!statsData" style="text-align:center;padding:40px;">데이터 분석 중... ⏳</div>

        <template v-if="statsData && currentTab === 'inducer'">
            <div style="font-weight:bold; color:#1565C0; font-size:16px; margin-bottom:10px;">📱 온라인 퍼널</div>
            <div class="funnel-container">
                <template v-for="(f, i) in getInducerFunnels().online" :key="'on'+i">
                    <div class="funnel-step">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                            <span class="funnel-label">{{ f.label }}</span>
                            <span class="funnel-value">{{ f.value }}건</span>
                        </div>
                        <div style="background:#eee; height:12px; border-radius:6px; overflow:hidden;">
                            <div :style="{ width: f.barWidth + '%', background: f.isLast ? '#9C27B0' : 'var(--accent-color)', height: '100%', transition: 'width 0.5s ease' }"></div>
                        </div>
                        <div v-if="f.prevValue !== null" class="funnel-rate" :style="{ color: f.rateColor }">↳ {{ f.rateLabel }}: <b>{{ f.rate }}%</b></div>
                        <div v-if="f.extraDesc" style="font-size:11px; color:#888; margin-top:3px;">{{ f.extraDesc }}</div>
                    </div>
                    <div v-if="!f.isLast" style="text-align:center; color:#ddd; margin: 8px 0; font-size:12px;">▼</div>
                </template>
            </div>

            <div style="font-weight:bold; color:#E65100; font-size:16px; margin-top:25px; margin-bottom:10px;">🏃 오프라인 퍼널</div>
            <div class="funnel-container">
                <template v-for="(f, i) in getInducerFunnels().offline" :key="'off'+i">
                    <div class="funnel-step">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                            <span class="funnel-label">{{ f.label }}</span>
                            <span class="funnel-value">{{ f.value }}건</span>
                        </div>
                        <div style="background:#eee; height:12px; border-radius:6px; overflow:hidden;">
                            <div :style="{ width: f.barWidth + '%', background: f.isLast ? '#9C27B0' : 'var(--accent-color)', height: '100%' }"></div>
                        </div>
                        <div v-if="f.prevValue !== null" class="funnel-rate" :style="{ color: f.rateColor }">↳ {{ f.rateLabel }}: <b>{{ f.rate }}%</b></div>
                    </div>
                    <div v-if="!f.isLast" style="text-align:center; color:#ddd; margin: 8px 0; font-size:12px;">▼</div>
                </template>
            </div>
        </template>

        <template v-if="statsData && currentTab === 'teacher'">
            <div style="font-weight:bold; color:#2E7D32; font-size:16px; margin-bottom:10px;">👨‍🏫 교사 방어율</div>
            <div class="funnel-container">
                <template v-for="(f, i) in getTeacherFunnels()" :key="'tea'+i">
                    <div class="funnel-step">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                            <span class="funnel-label">{{ f.label }}</span>
                            <span class="funnel-value">{{ f.value }}건</span>
                        </div>
                        <div style="background:#eee; height:12px; border-radius:6px; overflow:hidden;">
                            <div :style="{ width: f.barWidth + '%', background: f.isLast ? '#9C27B0' : 'var(--accent-color)', height: '100%' }"></div>
                        </div>
                        <div v-if="f.prevValue !== null" class="funnel-rate" :style="{ color: f.rateColor }">↳ {{ f.rateLabel }}: <b>{{ f.rate }}%</b></div>
                    </div>
                    <div v-if="!f.isLast" style="text-align:center; color:#ddd; margin: 8px 0; font-size:12px;">▼</div>
                </template>
            </div>
        </template>
    </div>
</template>
