<script setup>
// ERP 주간 보고서 — 기간(주/달/직접) 안의 일일보고·섭외·전환율·TM 활동·이관 대기열·매칭 결과를 지역별(지역 하나 고르면 구역별)로,
// 같은 길이의 바로 앞 기간과 비교. 지역·구역·보고 싶은 항목을 필터로 고르고, 고른 필터는 이 기기에 기억.
import { ref, computed, watch } from 'vue'
import ErpRangePicker from './ErpRangePicker.vue'
import { useErpLoad, weekOf, sumBy, total, natCmp, regionLabel, districtLabel, fmtDate, fmtDateTime } from './erpUtil'

const range = ref(weekOf())
const { loading, error, data, load } = useErpLoad('/api/erp/weekly')

// ── 필터 (지역·구역·항목) — localStorage는 이 기기 편의용, 못 읽어도 기본값으로 동작 ──
const PREF_KEY = 'erp_weekly_filters'
function readPrefs() { try { return JSON.parse(localStorage.getItem(PREF_KEY)) || {} } catch { return {} } }
const saved = readPrefs()
const regionSel = ref(saved.regions || [])      // [] = 전체
const districtSel = ref(saved.districts || [])  // 지역 하나 골랐을 때만 의미, [] = 전체
const hidden = ref(saved.hidden || [])          // 끈 항목 key
watch([regionSel, districtSel, hidden], () => {
    try { localStorage.setItem(PREF_KEY, JSON.stringify({ regions: regionSel.value, districts: districtSel.value, hidden: hidden.value })) } catch { /* 저장 못 해도 화면은 그대로 */ }
}, { deep: true })

// 템플릿에선 ref가 풀려서 배열이 넘어옴 — 배열을 직접 고침
const toggleIn = (arr, v) => { const i = arr.indexOf(v); i >= 0 ? arr.splice(i, 1) : arr.push(v) }
function toggleRegion(r) { toggleIn(regionSel.value, r); districtSel.value = [] }

const allRows = computed(() => (data.value ? [...data.value.cur, ...data.value.prev, ...data.value.queueNow] : []))
const regions = computed(() => [...new Set(allRows.value.map((r) => r.region).filter(Boolean))].sort(natCmp))
const oneRegion = computed(() => (regionSel.value.length === 1 ? regionSel.value[0] : null))
const districts = computed(() => (oneRegion.value
    ? [...new Set(allRows.value.filter((r) => r.region === oneRegion.value).map((r) => r.district).filter(Boolean))].sort(natCmp) : []))

const inScope = (r) => (!regionSel.value.length || regionSel.value.includes(r.region))
    && (!oneRegion.value || !districtSel.value.length || districtSel.value.includes(r.district))
const keyOf = (r) => (oneRegion.value ? r.district : r.region)
const labelOf = (k) => (oneRegion.value ? districtLabel(k) : regionLabel(k))

// ── 항목 정의 — cols: [key, 라벨, 계산(합계행 → 값)?, 형식] ──
const n = (k) => (r) => r[k] || 0
const ratio = (a, b) => (r) => (b(r) ? a(r) / b(r) : null)
const avg = (sumK, cntK) => (r) => (r[cntK] ? r[sumK] / r[cntK] : null)
const found = (r) => (r.inflowOn || 0) + (r.inflowOff || 0)
const calls = (r) => ['NO_ANSWER', 'RESERVED_TM', 'MEET_FIX', 'REJECT', 'UNFIT', 'INVALID'].reduce((s, c) => s + (r['tm_' + c] || 0), 0)

const SECTIONS = [
    { key: 'daily', title: '일일보고', note: '제출 당시 소속 기준', cols: [
        ['reports', '보고'], ['talk', '말걸기'], ['dm', 'DM'], ['qr', 'QR'], ['online_intake', '온라인 찾기']] },
    { key: 'search', title: '섭외', note: '유입자 지역 기준', cols: [
        ['inflowOff', '오프 찾기'], ['inflowOn', '온 찾기'], ['meetFix', '만픽'], ['hjy', '합재양'], ['jaega', '재가']] },
    { key: 'conv', title: '단계별 전환율', note: '기간 안에 일어난 건수끼리 비교 — 같은 사람을 끝까지 따라간 비율은 전환 퍼널에서', cols: [
        ['c1', '찾기→만픽', ratio(n('meetFix'), found), 'pct'], ['c2', '만픽→재가', ratio(n('jaega'), n('meetFix')), 'pct'],
        ['c3', '재가→만남', ratio(n('met'), n('jaega')), 'pct'], ['c4', '만남→상연', ratio(n('match_CONSULT_WIN'), n('met')), 'pct']] },
    { key: 'tm', title: 'TM 활동', note: '통화한 사람의 현재 소속 기준 · 첫 통화는 기간 안에 이관받은 사람 기준', cols: [
        ['calls', '통화', calls], ['tm_callers', '티엠자'], ['tm_people', '통화한 사람'],
        ['tm_NO_ANSWER', '부재중'], ['tm_RESERVED_TM', '예약'], ['tm_MEET_FIX', '만픽'], ['tm_REJECT', '거절'], ['tm_UNFIT', '비합'], ['tm_INVALID', '무효'],
        ['fixRate', '만픽률', ratio(n('tm_MEET_FIX'), calls), 'pct'], ['firstCall', '첫 통화까지', avg('ft_hours', 'ft_n'), 'hours']] },
    { key: 'queue', title: '이관 대기열', note: '유입자 지역 기준 · 신청 = shed 신청 시각, 이관·반려 = 처리 시각', cols: [
        ['q_in', '신청'], ['q_accepted', '이관'], ['q_rejected', '반려'], ['wait', '평균 대기', avg('q_wait_hours', 'q_accepted'), 'hours'],
        ['q_late', '4일 넘겨 이관'], ['waiting', '지금 대기', null, 'now'], ['waitingOld', '그중 4일 넘김', null, 'now']] },
    { key: 'match', title: '매칭 결과', note: '인도자 지역 · 만남 예정일 기준', cols: [
        ['met', '만남'], ['match_CONSULT_WIN', '상연'], ['match_SECOND_MEET', '2차'], ['match_DROPOUT', '탈락'], ['match_UNFIT', '비합'],
        ['match_CANCEL', '취소'], ['match_DELAY', '밀림'], ['match_PENDING', '진행 예정']] },
    { key: 'lists', title: '재가·매칭 명단' },
]
const visible = computed(() => SECTIONS.filter((s) => !hidden.value.includes(s.key)))

const table = computed(() => {
    if (!data.value) return { rows: [], sum: {}, prevSum: {}, nowSum: {} }
    const cur = data.value.cur.filter(inScope)
    const prev = data.value.prev.filter(inScope)
    const now = data.value.queueNow.filter(inScope)
    const by = (rows) => Object.fromEntries(sumBy(rows, keyOf).map((r) => [r.key, r]))
    const curBy = by(cur), prevBy = by(prev), nowBy = by(now)
    const keys = [...new Set([...cur, ...prev, ...now].map(keyOf))].sort(natCmp)
    return {
        rows: keys.map((k) => ({ key: k, label: labelOf(k), cur: curBy[k] || {}, prev: prevBy[k] || {}, now: nowBy[k] || {} })),
        sum: total(cur), prevSum: total(prev), nowSum: total(now),
    }
})

// 칸 하나 — 값 + 앞 기간 대비 증감 (비율은 %p, 시간은 시간 차)
function cell(col, cur, prev, now) {
    const [key, , calc, fmt] = col
    if (fmt === 'now') return { text: String(now[key] || 0), zero: !now[key] }
    const v = calc ? calc(cur) : cur[key] || 0
    const p = calc ? calc(prev) : prev[key] || 0
    if (v == null) return { text: '–', zero: true }
    const text = fmt === 'pct' ? `${Math.round(v * 1000) / 10}%` : fmt === 'hours' ? `${Math.round(v)}시간` : String(v)
    let d = null
    if (p != null) {
        const diff = fmt === 'pct' ? Math.round((v - p) * 1000) / 10 : Math.round(v - p)
        const unit = fmt === 'pct' ? '%p' : fmt === 'hours' ? 'h' : ''
        // 첫 통화·대기 시간은 줄어드는 게 좋은 것 — 색만 반대로
        const good = fmt === 'hours' ? diff < 0 : diff > 0
        d = diff ? { t: `${diff > 0 ? '▲' : '▼'}${Math.abs(diff)}${unit}`, cls: good ? 'up' : 'down' } : { t: '–', cls: '' }
    }
    return { text, zero: !v, d }
}

const scopeOk = (r) => (!regionSel.value.length || regionSel.value.includes(r.region_code))
    && (!oneRegion.value || !districtSel.value.length || districtSel.value.includes(r.district_code))
const jaegaList = computed(() => (data.value?.jaegaDetails || []).filter(scopeOk))
const matchList = computed(() => (data.value?.matchDetails || []).filter(scopeOk))
const scopeLabel = computed(() => (!regionSel.value.length ? '전체 지역'
    : regionSel.value.map(regionLabel).join(', ') + (districtSel.value.length ? ' ' + districtSel.value.map(districtLabel).join(', ') : '')))
</script>

<template>
    <section>
        <div class="erp-bar">
            <span class="erp-label">기간</span>
            <ErpRangePicker v-model="range" />
            <button class="erp-btn" :disabled="loading" @click="load(range)">🔍 집계</button>
        </div>

        <p v-if="loading" class="erp-empty">집계 중…</p>
        <p v-else-if="error" class="erp-error">{{ error }}</p>
        <template v-else-if="data">
            <div class="erp-section erp-filter">
                <div class="erp-filter-row">
                    <span class="erp-label">지역</span>
                    <button :class="['erp-chip', { on: !regionSel.length }]" :aria-pressed="!regionSel.length" @click="regionSel = []; districtSel = []">전체</button>
                    <button v-for="r in regions" :key="r" :class="['erp-chip', { on: regionSel.includes(r) }]" :aria-pressed="regionSel.includes(r)"
                            @click="toggleRegion(r)">{{ regionLabel(r) }}</button>
                </div>
                <div v-if="oneRegion" class="erp-filter-row">
                    <span class="erp-label">구역</span>
                    <button :class="['erp-chip', { on: !districtSel.length }]" :aria-pressed="!districtSel.length" @click="districtSel = []">전체</button>
                    <button v-for="d in districts" :key="d" :class="['erp-chip', { on: districtSel.includes(d) }]" :aria-pressed="districtSel.includes(d)"
                            @click="toggleIn(districtSel, d)">{{ districtLabel(d) }}</button>
                </div>
                <div class="erp-filter-row">
                    <span class="erp-label">항목</span>
                    <button v-for="s in SECTIONS" :key="s.key" :class="['erp-chip', { on: !hidden.includes(s.key) }]" :aria-pressed="!hidden.includes(s.key)"
                            @click="toggleIn(hidden, s.key)">{{ s.title }}</button>
                </div>
            </div>
            <p><span class="erp-range-info">{{ data.range.from }} ~ {{ data.range.to }} · {{ scopeLabel }} · ▲▼는 앞 기간({{ data.prevRange.from }} ~ {{ data.prevRange.to }}) 대비</span></p>
            <p v-if="!visible.length" class="erp-empty">보고 싶은 항목을 위에서 하나 이상 켜 주세요.</p>

            <template v-for="sec in visible" :key="sec.key">
                <div v-if="sec.cols" class="erp-section">
                    <h3 class="erp-h3">{{ sec.title }} <span class="erp-sub">{{ sec.note }}</span></h3>
                    <div class="erp-table-wrap">
                        <table class="erp-table">
                            <thead>
                                <tr><th scope="col">{{ oneRegion ? '구역' : '지역' }}</th><th v-for="c in sec.cols" :key="c[0]" scope="col">{{ c[1] }}</th></tr>
                            </thead>
                            <tbody>
                                <tr v-for="r in table.rows" :key="r.key ?? 'none'">
                                    <th scope="row">{{ r.label }}</th>
                                    <td v-for="c in sec.cols" :key="c[0]" :class="{ 'erp-zero': cell(c, r.cur, r.prev, r.now).zero }">
                                        {{ cell(c, r.cur, r.prev, r.now).text }}
                                        <small v-if="cell(c, r.cur, r.prev, r.now).d" :class="['erp-delta', cell(c, r.cur, r.prev, r.now).d.cls]">{{ cell(c, r.cur, r.prev, r.now).d.t }}</small>
                                    </td>
                                </tr>
                            </tbody>
                            <tfoot>
                                <tr>
                                    <th scope="row">합계</th>
                                    <td v-for="c in sec.cols" :key="c[0]">
                                        {{ cell(c, table.sum, table.prevSum, table.nowSum).text }}
                                        <small v-if="cell(c, table.sum, table.prevSum, table.nowSum).d" :class="['erp-delta', cell(c, table.sum, table.prevSum, table.nowSum).d.cls]">{{ cell(c, table.sum, table.prevSum, table.nowSum).d.t }}</small>
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                <template v-else>
                    <details class="erp-section">
                        <summary><h3 class="erp-h3">재가 명단 <span class="erp-sub">{{ jaegaList.length }}명</span></h3></summary>
                        <div class="erp-table-wrap">
                            <table class="erp-table erp-table-left">
                                <thead><tr><th scope="col">날짜</th><th scope="col">이름</th><th scope="col">유입자</th><th scope="col">인도자</th><th scope="col">소속</th></tr></thead>
                                <tbody>
                                    <tr v-for="(r, i) in jaegaList" :key="i">
                                        <td>{{ fmtDate(r.at) }}</td><td>{{ r.name }}</td><td>{{ r.introducer_name }}</td><td>{{ r.guide_name || '–' }}</td>
                                        <td>{{ regionLabel(r.region_code) }} {{ districtLabel(r.district_code) }}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </details>
                    <details class="erp-section">
                        <summary><h3 class="erp-h3">매칭 명단 <span class="erp-sub">{{ matchList.length }}건</span></h3></summary>
                        <div class="erp-table-wrap">
                            <table class="erp-table erp-table-left">
                                <thead><tr><th scope="col">만남</th><th scope="col">이름</th><th scope="col">인도자</th><th scope="col">교사</th><th scope="col">도구</th><th scope="col">결과</th><th scope="col">소속</th></tr></thead>
                                <tbody>
                                    <tr v-for="(r, i) in matchList" :key="i">
                                        <td>{{ fmtDateTime(r.at) }}</td><td>{{ r.name }}</td><td>{{ r.guide_name || '–' }}</td><td>{{ r.teacher_name || '–' }}</td>
                                        <td>{{ r.tool || '–' }}</td><td>{{ r.match_degree }}차 {{ r.result_label }}</td>
                                        <td>{{ regionLabel(r.region_code) }} {{ districtLabel(r.district_code) }}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </details>
                </template>
            </template>
        </template>
        <p v-else class="erp-empty">기간을 고르고 🔍 집계를 누르세요.</p>
    </section>
</template>
