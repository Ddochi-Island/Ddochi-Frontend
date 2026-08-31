<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useStatsStore } from '@/stores/stats'
import { useApi } from '@/composables/useApi'
import { CHANNELS, OFFLINE_CHANNELS, CHANNEL_LABELS } from '@/constants'

const auth = useAuthStore()
const stats = useStatsStore()
const { callApi } = useApi()

const currentPeriod = ref('weekly')
const loading = ref(true)
const errorMessage = ref('')

onMounted(() => {
  openStatisticsScreen()
})

function openStatisticsScreen() {
  loading.value = true
  errorMessage.value = ''
  currentPeriod.value = 'weekly'

  callApi('/api/get-comprehensive-stats', { sabun: auth.currentSabun }, (r) => {
    loading.value = false
    if (!r.success) {
      errorMessage.value = r.message || '오류가 발생했어.'
      return
    }
    stats.comprehensiveStatsData = r
  })
}

function switchPeriod(period) {
  currentPeriod.value = period
}

const sortedGroups = computed(() => {
  if (!stats.comprehensiveStatsData?.targetGroups) return []
  return [...stats.comprehensiveStatsData.targetGroups].sort((a, b) => {
    if (a === 'Total') return 1
    if (b === 'Total') return -1
    return a.localeCompare(b)
  })
})

const periodData = computed(() => {
  if (!stats.comprehensiveStatsData?.data) return null
  const s = stats.comprehensiveStatsData.data
  return currentPeriod.value === 'weekly' ? s.weekly?.curr : s.monthly?.curr
})

function getRate(num, den, color) {
  if (den > 0) {
    const pct = ((num / den) * 100).toFixed(1)
    return { value: num, pct: `${pct}%`, color }
  }
  return { value: num, pct: '0%', color: '#aaa' }
}

function getSnapshotData(group) {
  if (!periodData.value || !periodData.value[group]) return null
  return periodData.value[group].snapshot
}

function getCohortData(group) {
  if (!periodData.value || !periodData.value[group]) return null
  return periodData.value[group].cohort
}

function groupLabel(g) {
  return g === 'Total' ? '총합계' : g
}

function isTotalRow(g) {
  return g === 'Total'
}

function rateCell(num, den, color) {
  if (den > 0) {
    const pct = ((num / den) * 100).toFixed(1)
    return `${num}<br><span style="color:${color}; font-size:10px;">(${pct}%)</span>`
  }
  return `${num}<br><span style="color:#aaa; font-size:10px;">(0%)</span>`
}
</script>

<template>
  <div class="statistics-screen">
    <div class="header">
      <h3>📈 종합 통계 현황</h3>
      <p>실시간 데이터 기반입니다.</p>
    </div>

    <div class="stats-tab-container">
      <button
        class="stats-tab-btn"
        :class="{ active: currentPeriod === 'weekly' }"
        @click="switchPeriod('weekly')"
      >주간 통계</button>
      <button
        class="stats-tab-btn"
        :class="{ active: currentPeriod === 'monthly' }"
        @click="switchPeriod('monthly')"
      >월간 통계</button>
    </div>

    <!-- Loading -->
    <div v-if="loading" style="text-align: center; padding: 50px;">
      데이터를 열심히 계산 중이야... ⏳
    </div>

    <!-- Error -->
    <div v-else-if="errorMessage" style="text-align: center; color: red; padding: 20px;">
      {{ errorMessage }}
    </div>

    <!-- Data -->
    <template v-else-if="periodData">
      <!-- Table 1: Snapshot -->
      <div style="font-weight: bold; color: #5D4037; font-size: 16px; margin-bottom: 10px; margin-top: 10px;">
        📊 발생 기준 (스냅샷)
      </div>
      <div style="font-size: 11px; color: #888; margin-bottom: 5px;">
        * 이번 기간 동안 <b>새로 발생한</b> 번호찾기와 재가 건수입니다.
      </div>
      <div class="stats-table-wrapper">
        <table class="stats-table">
          <thead>
            <tr>
              <th class="sticky-col">조직</th>
              <th>구분</th>
              <th>디엠</th><th>광고</th><th>소모임</th><th>온폼</th><th>온찾</th><th>큐알</th>
              <th style="color: #1565C0;">온라인 총계</th>
              <th>노방</th><th>생노</th><th>바따장</th>
              <th style="color: #E65100;">오프 총계</th>
              <th>지인</th>
              <th>전체 총계</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="g in sortedGroups" :key="'snap-' + g">
              <template v-if="getSnapshotData(g)">
                <!-- Reg row -->
                <tr :style="isTotalRow(g) ? 'background:#FFFDE7; font-weight:bold;' : ''">
                  <td
                    class="sticky-col"
                    rowspan="2"
                    :style="isTotalRow(g) ? 'background:#FFFDE7; font-weight:bold;' : ''"
                  >{{ groupLabel(g) }}</td>
                  <td style="font-weight: bold;">번호찾</td>
                  <td>{{ getSnapshotData(g).reg.dm }}</td>
                  <td>{{ getSnapshotData(g).reg.ad }}</td>
                  <td>{{ getSnapshotData(g).reg.somoim }}</td>
                  <td>{{ getSnapshotData(g).reg.form }}</td>
                  <td>{{ getSnapshotData(g).reg.onchat }}</td>
                  <td>{{ getSnapshotData(g).reg.qr }}</td>
                  <td style="color: #1565C0; font-weight: bold; background: #E3F2FD;">{{ getSnapshotData(g).reg.onTotal }}</td>
                  <td>{{ getSnapshotData(g).reg.nobang }}</td>
                  <td>{{ getSnapshotData(g).reg.saengno }}</td>
                  <td>{{ getSnapshotData(g).reg.badda }}</td>
                  <td style="color: #E65100; font-weight: bold; background: #FFF3E0;">{{ getSnapshotData(g).reg.offTotal }}</td>
                  <td>{{ getSnapshotData(g).reg.jiin }}</td>
                  <td style="font-weight: bold;">{{ getSnapshotData(g).reg.total }}</td>
                </tr>
                <!-- Manfix row -->
                <tr :style="isTotalRow(g) ? 'background:#FFFDE7; font-weight:bold;' : ''">
                  <td style="font-weight: bold; color: #4CAF50;">재가창출</td>
                  <td v-html="rateCell(getSnapshotData(g).approval.dm, getSnapshotData(g).reg.dm, '#E53935')"></td>
                  <td v-html="rateCell(getSnapshotData(g).approval.ad, getSnapshotData(g).reg.ad, '#E53935')"></td>
                  <td v-html="rateCell(getSnapshotData(g).approval.somoim, getSnapshotData(g).reg.somoim, '#E53935')"></td>
                  <td v-html="rateCell(getSnapshotData(g).approval.form, getSnapshotData(g).reg.form, '#E53935')"></td>
                  <td v-html="rateCell(getSnapshotData(g).approval.onchat, getSnapshotData(g).reg.onchat, '#E53935')"></td>
                  <td v-html="rateCell(getSnapshotData(g).approval.qr, getSnapshotData(g).reg.qr, '#E53935')"></td>
                  <td
                    style="color: #1565C0; font-weight: bold; background: #E3F2FD;"
                    v-html="rateCell(getSnapshotData(g).approval.onTotal, getSnapshotData(g).reg.onTotal, '#E53935')"
                  ></td>
                  <td v-html="rateCell(getSnapshotData(g).approval.nobang, getSnapshotData(g).reg.nobang, '#E53935')"></td>
                  <td v-html="rateCell(getSnapshotData(g).approval.saengno, getSnapshotData(g).reg.saengno, '#E53935')"></td>
                  <td v-html="rateCell(getSnapshotData(g).approval.badda, getSnapshotData(g).reg.badda, '#E53935')"></td>
                  <td
                    style="color: #E65100; font-weight: bold; background: #FFF3E0;"
                    v-html="rateCell(getSnapshotData(g).approval.offTotal, getSnapshotData(g).reg.offTotal, '#E53935')"
                  ></td>
                  <td v-html="rateCell(getSnapshotData(g).approval.jiin, getSnapshotData(g).reg.jiin, '#E53935')"></td>
                  <td style="font-weight: bold;" v-html="rateCell(getSnapshotData(g).approval.total, getSnapshotData(g).reg.total, '#E53935')"></td>
                </tr>
              </template>
            </template>
          </tbody>
        </table>
      </div>

      <!-- Table 2: Cohort -->
      <div style="font-weight: bold; color: #5D4037; font-size: 16px; margin-bottom: 10px; margin-top: 30px;">
        ⚔️ 방어 기준 (코호트)
      </div>
      <div style="font-size: 11px; color: #888; margin-bottom: 5px;">
        * 이번 기간 내에 <b>약속이 잡혀 있던 만픽 인원(미정 제외)</b>을 얼마나 방어(매칭)했는지 보여줍니다.
      </div>
      <div class="stats-table-wrapper">
        <table class="stats-table">
          <thead>
            <tr>
              <th class="sticky-col">조직</th>
              <th>구분</th>
              <th>디엠</th><th>광고</th><th>소모임</th><th>온폼</th><th>온찾</th><th>큐알</th>
              <th style="color: #1565C0;">온라인 총계</th>
              <th>노방</th><th>생노</th><th>바따장</th>
              <th style="color: #E65100;">오프 총계</th>
              <th>지인</th>
              <th>전체 총계</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="g in sortedGroups" :key="'cohort-' + g">
              <template v-if="getCohortData(g)">
                <!-- Scheduled row -->
                <tr :style="isTotalRow(g) ? 'background:#FFFDE7; font-weight:bold;' : ''">
                  <td
                    class="sticky-col"
                    rowspan="2"
                    :style="isTotalRow(g) ? 'background:#FFFDE7; font-weight:bold;' : ''"
                  >{{ groupLabel(g) }}</td>
                  <td style="font-weight: bold;">예정만픽</td>
                  <td>{{ getCohortData(g).scheduled.dm }}</td>
                  <td>{{ getCohortData(g).scheduled.ad }}</td>
                  <td>{{ getCohortData(g).scheduled.somoim }}</td>
                  <td>{{ getCohortData(g).scheduled.form }}</td>
                  <td>{{ getCohortData(g).scheduled.onchat }}</td>
                  <td>{{ getCohortData(g).scheduled.qr }}</td>
                  <td style="color: #1565C0; font-weight: bold; background: #E3F2FD;">{{ getCohortData(g).scheduled.onTotal }}</td>
                  <td>{{ getCohortData(g).scheduled.nobang }}</td>
                  <td>{{ getCohortData(g).scheduled.saengno }}</td>
                  <td>{{ getCohortData(g).scheduled.badda }}</td>
                  <td style="color: #E65100; font-weight: bold; background: #FFF3E0;">{{ getCohortData(g).scheduled.offTotal }}</td>
                  <td>{{ getCohortData(g).scheduled.jiin }}</td>
                  <td style="font-weight: bold;">{{ getCohortData(g).scheduled.total }}</td>
                </tr>
                <!-- Matched row -->
                <tr :style="isTotalRow(g) ? 'background:#FFFDE7; font-weight:bold;' : ''">
                  <td style="font-weight: bold; color: #9C27B0;">매칭성사</td>
                  <td v-html="rateCell(getCohortData(g).matched.dm, getCohortData(g).scheduled.dm, '#2E7D32')"></td>
                  <td v-html="rateCell(getCohortData(g).matched.ad, getCohortData(g).scheduled.ad, '#2E7D32')"></td>
                  <td v-html="rateCell(getCohortData(g).matched.somoim, getCohortData(g).scheduled.somoim, '#2E7D32')"></td>
                  <td v-html="rateCell(getCohortData(g).matched.form, getCohortData(g).scheduled.form, '#2E7D32')"></td>
                  <td v-html="rateCell(getCohortData(g).matched.onchat, getCohortData(g).scheduled.onchat, '#2E7D32')"></td>
                  <td v-html="rateCell(getCohortData(g).matched.qr, getCohortData(g).scheduled.qr, '#2E7D32')"></td>
                  <td
                    style="color: #1565C0; font-weight: bold; background: #E3F2FD;"
                    v-html="rateCell(getCohortData(g).matched.onTotal, getCohortData(g).scheduled.onTotal, '#2E7D32')"
                  ></td>
                  <td v-html="rateCell(getCohortData(g).matched.nobang, getCohortData(g).scheduled.nobang, '#2E7D32')"></td>
                  <td v-html="rateCell(getCohortData(g).matched.saengno, getCohortData(g).scheduled.saengno, '#2E7D32')"></td>
                  <td v-html="rateCell(getCohortData(g).matched.badda, getCohortData(g).scheduled.badda, '#2E7D32')"></td>
                  <td
                    style="color: #E65100; font-weight: bold; background: #FFF3E0;"
                    v-html="rateCell(getCohortData(g).matched.offTotal, getCohortData(g).scheduled.offTotal, '#2E7D32')"
                  ></td>
                  <td v-html="rateCell(getCohortData(g).matched.jiin, getCohortData(g).scheduled.jiin, '#2E7D32')"></td>
                  <td style="font-weight: bold;" v-html="rateCell(getCohortData(g).matched.total, getCohortData(g).scheduled.total, '#2E7D32')"></td>
                </tr>
              </template>
            </template>
          </tbody>
        </table>
      </div>
    </template>

    <!-- backend placeholder (Phase 5-B 풀 포팅 전) graceful 메시지 -->
    <div v-else style="text-align:center; padding:50px; color:#888;">
      <div style="font-size:40px; margin-bottom:10px;">📊</div>
      <div style="font-weight:bold; margin-bottom:8px;">통계 준비 중이야!</div>
      <div style="font-size:13px; line-height:1.5;">
        {{ stats.comprehensiveStatsData?.message || '아직 데이터가 없어. 잠시 후 다시 시도해줘!' }}
      </div>
    </div>
  </div>
</template>


<style scoped>
.stats-tab-container {
  display: flex;
  margin-bottom: 15px;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: var(--shadow);
}

.stats-tab-btn {
  flex: 1;
  padding: 12px;
  background: #fff;
  border: none;
  text-align: center;
  cursor: pointer;
  font-weight: bold;
  color: #aaa;
  font-family: 'Jua';
  font-size: 15px;
  transition: 0.2s;
}

.stats-tab-btn.active {
  background: var(--btn-color);
  color: white;
}

.stats-table-wrapper {
  overflow-x: auto;
  background: white;
  border-radius: 12px;
  box-shadow: var(--shadow);
  margin-bottom: 20px;
  border: 1px solid #eee;
}

.stats-table {
  width: 100%;
  border-collapse: collapse;
  text-align: center;
  min-width: 800px;
}

.stats-table th,
.stats-table td {
  padding: 10px 5px;
  border: 1px solid #eee;
  font-size: 12px;
  white-space: nowrap;
  vertical-align: middle;
}

.stats-table th {
  background: #F2EBE9;
  color: #5D4037;
  font-weight: bold;
  position: sticky;
  top: 0;
  z-index: 1;
}

.stats-table .sticky-col {
  position: sticky;
  left: 0;
  background: #fff;
  z-index: 2;
  border-right: 2px solid #ddd;
  font-weight: bold;
  color: #333;
}

.stats-table th.sticky-col {
  z-index: 3;
  background: #F2EBE9;
}
</style>
