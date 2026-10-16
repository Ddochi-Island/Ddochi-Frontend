<script setup>
// ERP(관리자 분석) — 구 erp.ddochi.cloud를 앱 안으로 옮긴 화면. 구 ERP처럼 왼쪽 메뉴 + 오른쪽 업무 화면(토스 스타일), 앱 상단바 위를 덮는 전체 화면.
// 데이터는 /api/erp/*(관리자 전용). 메뉴별 화면은 components/erp/, 공통 스타일(.erp-*)은 이 파일 아래 비scoped 스타일에.
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import ErpSearch from '@/components/erp/ErpSearch.vue'
import ErpTmStats from '@/components/erp/ErpTmStats.vue'
import ErpFunnel from '@/components/erp/ErpFunnel.vue'
import ErpWeekly from '@/components/erp/ErpWeekly.vue'
import ErpFind from '@/components/erp/ErpFind.vue'

const router = useRouter()
const route = useRoute()

// 코드는 구 ERP 메뉴 코드 그대로
const MENU = [
    { key: 'search', code: 'OR001', label: '섭외 조회', comp: ErpSearch },
    { key: 'find', code: 'ST001', label: '찾기 분석', comp: ErpFind },
    { key: 'weekly', code: 'ST006', label: '주간 보고서', comp: ErpWeekly },
    { key: 'tm', code: 'ST002', label: 'TM 결과 집계', comp: ErpTmStats },
    { key: 'funnel', code: 'ST004', label: '전환 퍼널 분석', comp: ErpFunnel },
]
const active = computed(() => MENU.find((t) => t.key === route.query.tab) || MENU[0])
const setTab = (key) => router.replace({ query: { ...route.query, tab: key } })
const exit = () => router.push({ name: 'home' })
</script>

<template>
    <div class="erp">
        <nav class="erp-nav" aria-label="ERP 메뉴">
            <div class="erp-brand">또치섬 ERP</div>
            <div class="erp-divider"></div>
            <ul class="erp-menu">
                <li v-for="t in MENU" :key="t.key">
                    <button :class="['erp-menu-item', { active: t.key === active.key }]" :aria-current="t.key === active.key ? 'page' : null"
                            @click="setTab(t.key)">{{ t.label }}</button>
                </li>
            </ul>
            <button class="erp-exit" @click="exit">← 또치섬으로</button>
        </nav>
        <main class="erp-work">
            <h1 class="erp-doc-title"><span class="code">{{ active.code }}</span>{{ active.label }}</h1>
            <!-- KeepAlive: 메뉴를 오가도 집계 결과/검색어가 남아 있게 -->
            <KeepAlive>
                <component :is="active.comp" :key="active.key" />
            </KeepAlive>
        </main>
    </div>
</template>

<style>
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css');

/* 구 ERP "Toss UI Override" 팔레트 */
.erp {
    --e-bg: #F2F4F6; --e-card: #fff; --e-line: #E5E8EB; --e-head: #F8F9FA; --e-text: #191F28; --e-sub: #6B7684; --e-faint: #8B95A1;
    --e-blue: #3182F6; --e-blue-dark: #1B64DA; --e-blue-soft: #EBF3FF; --e-up: #1F7A38; --e-down: #D62828;
    position: fixed; inset: 0; z-index: 950; display: grid; grid-template-columns: 200px 1fr;
    background: var(--e-bg); color: var(--e-text); font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif; font-size: 14px;
}
.erp button, .erp input, .erp select { font-family: inherit; }

.erp-nav { background: var(--e-card); border-right: 1px solid var(--e-line); padding: 0 8px 12px; display: flex; flex-direction: column; overflow-y: auto; }
.erp-brand { padding: 20px 8px 10px; font-size: 15px; font-weight: 700; letter-spacing: -0.3px; }
.erp-divider { height: 1px; background: var(--e-line); margin: 8px 0; }
.erp-menu { list-style: none; margin: 0; padding: 0; }
.erp-menu-item { display: block; width: 100%; text-align: left; border: none; background: none; padding: 10px 14px; margin-bottom: 2px; border-radius: 8px;
    font-size: 13px; font-weight: 500; color: var(--e-sub); cursor: pointer; }
.erp-menu-item:hover { background: var(--e-bg); color: var(--e-text); }
.erp-menu-item.active { background: var(--e-blue-soft); color: var(--e-blue); font-weight: 700; }
.erp-exit { margin-top: auto; border: none; background: none; padding: 10px 14px; text-align: left; font-size: 13px; color: var(--e-faint); cursor: pointer; border-radius: 8px; }
.erp-exit:hover { background: var(--e-bg); color: var(--e-text); }

.erp-work { overflow: auto; padding: 20px 24px 40px; }
.erp-doc-title { display: flex; align-items: center; gap: 8px; margin: 0 0 16px; color: var(--e-text); font-size: 18px; font-weight: 700; }
.erp-doc-title .code { background: var(--e-blue-soft); color: var(--e-blue); font-size: 11px; font-weight: 600; padding: 2px 6px; border-radius: 4px; }

/* 조회 조건 바 */
.erp-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; background: var(--e-card); border: 1px solid var(--e-line); border-radius: 12px;
    padding: 12px 16px; margin-bottom: 12px; }
.erp-bar.plain { background: none; border: none; padding: 0; }
.erp-label { font-size: 13px; font-weight: 600; color: var(--e-text); }
.erp-range { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.erp-quick, .erp-dates { display: flex; align-items: center; gap: 4px; }
.erp-range input[type="date"], .erp-input { font-size: 13px; padding: 6px 10px; border: 1px solid var(--e-line); border-radius: 8px; background: #fff; color: var(--e-text); min-width: 0; }
.erp-range input:disabled { background: var(--e-head); color: var(--e-sub); }
form.erp-bar .erp-input { flex: 1; }
.erp-select { flex: none; width: auto; }
.erp-chip, .erp-btn { border: 1px solid var(--e-line); background: #fff; color: var(--e-text); border-radius: 8px; padding: 6px 14px; font-size: 13px; cursor: pointer; }
.erp-chip:hover { border-color: #B0C4DE; }
.erp-chip.on { background: var(--e-blue-soft); border-color: #C8DEFF; color: var(--e-blue); font-weight: 600; }
.erp-btn { background: var(--e-blue); border-color: var(--e-blue); color: #fff; font-weight: 600; }
.erp-btn:hover { background: var(--e-blue-dark); }
.erp-btn:disabled { opacity: .5; cursor: default; }
.erp-link { background: none; border: none; padding: 2px 0; color: var(--e-blue); font-size: 13px; font-weight: 500; cursor: pointer; text-align: left; }
.erp-link:hover { text-decoration: underline; }
.erp-link:disabled { color: var(--e-text); cursor: default; text-decoration: none; }

/* 보기 탭 (구 fn-view-tabs) */
.erp-seg { display: flex; border-bottom: 1px solid var(--e-line); margin: 0 0 8px; }
.erp-seg button { border: 1px solid var(--e-line); border-bottom: none; background: var(--e-bg); color: var(--e-sub); padding: 6px 16px; margin-right: 2px;
    border-radius: 8px 8px 0 0; font-size: 13px; font-weight: 500; cursor: pointer; }
.erp-seg button.on { background: #fff; color: var(--e-blue); font-weight: 700; margin-bottom: -1px; }

.erp-note { font-size: 12px; color: var(--e-sub); background: var(--e-head); border: 1px solid var(--e-line); border-radius: 8px; padding: 6px 10px; margin: 0 0 12px; line-height: 1.6; }
.erp-range-info { display: inline-block; font-size: 12px; color: var(--e-blue); background: var(--e-blue-soft); border: 1px solid #C8DEFF; border-radius: 20px; padding: 3px 12px; margin: 0 0 10px; }
.erp-empty { padding: 40px; text-align: center; color: #B0B8C1; font-size: 13px; }
.erp-error { padding: 12px 16px; border-radius: 12px; background: #FDE8E8; color: var(--e-down); font-size: 13px; }
.erp-sub { font-size: 12px; color: var(--e-faint); font-weight: normal; }
.erp-crumbs { margin-bottom: 8px; font-size: 13px; color: var(--e-sub); }

/* 섹션 카드 (구 wk-section / pa-section) */
.erp-section { background: var(--e-card); border: 1px solid var(--e-line); border-radius: 12px; padding: 16px 20px; margin-bottom: 12px; }
.erp-h3 { margin: 0 0 10px; font-size: 13px; font-weight: 700; color: var(--e-text); border-left: 3px solid var(--e-blue); padding-left: 6px; }
details.erp-section > summary { cursor: pointer; }
details.erp-section > summary .erp-h3 { display: inline-block; margin: 0; }
details[open].erp-section > summary { margin-bottom: 10px; }

/* 그리드 (구 table.grid) */
.erp-table-wrap { overflow: auto; border: 1px solid var(--e-line); border-radius: 12px; background: #fff; }
.erp-table { width: 100%; border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
.erp-table th, .erp-table td { border: 1px solid var(--e-line); padding: 6px 10px; white-space: nowrap; }
.erp-table tr > :first-child { border-left: none; }
.erp-table tr > :last-child { border-right: none; }
.erp-table thead tr:first-child > * { border-top: none; }
.erp-table thead th { background: var(--e-head); color: var(--e-sub); font-weight: 600; text-align: center; position: sticky; top: 0; z-index: 1; }
.erp-table td { text-align: right; }
.erp-table-left td { text-align: left; }
.erp-table tbody th { text-align: left; font-weight: 600; background: #FAFBFC; }
.erp-table tbody tr:nth-child(even) td { background: #FAFBFC; }
.erp-table tbody tr:hover td, .erp-table tbody tr:hover th { background: var(--e-blue-soft); }
.erp-table tfoot th, .erp-table tfoot td { background: var(--e-head); font-weight: 700; }
.erp-table tfoot th { text-align: left; }
.erp-zero { color: #C4CAD1; }
/* 찾기 분석 — 활동량(노랑)·찾기(파랑) 칸 묶음, 지역 줄 클릭 */
.erp-find-toggle { background: none; border: none; padding: 0 0 0 12px; font: inherit; font-weight: 600; color: var(--e-text); cursor: pointer; }
.erp-find-name { padding-left: 26px; }
.erp-find thead th.erp-grp { border-bottom: 2px solid var(--e-line); }
.erp-find .act, .erp-table.erp-find tbody tr td.act { background: #FFFBEA; }
.erp-find thead .act { color: #8A6D1F; }
.erp-find .find, .erp-table.erp-find tbody tr td.find { background: #F0F7FF; }
.erp-find thead .find { color: var(--e-blue); }
.erp-col-toggle { background: none; border: none; padding: 0; font: inherit; font-weight: 600; color: inherit; cursor: pointer; white-space: nowrap; }
.erp-col-toggle:hover { text-decoration: underline; }
.erp-find .sub, .erp-table.erp-find tbody tr td.sub { background: #E6F0FD; font-size: 12px; }
.erp-find-chips-sub { margin: 16px 0 0; align-items: center; }
.erp-find .eff, .erp-table.erp-find tbody tr td.eff { background: #F3F0FF; }
.erp-find thead .eff { color: #6250D6; }
.erp-where { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-top: 16px; }
.erp-where-more { margin-top: 6px; }
@media (max-width: 900px) { .erp-where { grid-template-columns: 1fr; } }
.erp-find-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.erp-find tr.erp-find-pick { cursor: pointer; }
.erp-find tr.erp-find-person th { padding-left: 46px; font-weight: 400; color: var(--e-sub); }
.erp-find tr.erp-find-person td { font-size: 12px; color: var(--e-sub); }
.erp-find tr.erp-find-pick .erp-find-toggle span { color: var(--e-faint); }
.erp-delta { font-size: 11px; font-weight: 600; margin-left: 2px; color: var(--e-faint); }
.erp-delta.up { color: var(--e-up); }
.erp-delta.down { color: var(--e-down); }

/* 섭외 조회 (구 ph-*) */
.erp-row-btn { display: flex; align-items: center; justify-content: space-between; gap: 10px; width: 100%; text-align: left; background: #fff;
    border: 1px solid var(--e-line); border-radius: 12px; padding: 14px 18px; margin-bottom: 8px; cursor: pointer; color: var(--e-text); }
.erp-row-btn:hover { box-shadow: 0 2px 12px rgba(0, 0, 0, .08); border-color: #B0C4DE; }
.erp-row-name { font-size: 14px; font-weight: 600; }
.erp-row-meta { font-size: 12px; color: var(--e-faint); margin-top: 2px; }
.erp-stage { flex: none; font-size: 11px; font-weight: 500; color: var(--e-blue); background: var(--e-blue-soft); padding: 2px 10px; border-radius: 20px; white-space: nowrap; }
.erp-detail { background: #fff; border: 1px solid var(--e-line); border-radius: 12px; padding: 20px 24px; }
.erp-detail-name { font-size: 20px; font-weight: 700; margin-bottom: 6px; display: flex; align-items: center; gap: 8px; }
.erp-sec { font-size: 13px; font-weight: 700; margin: 20px 0 8px; padding-bottom: 6px; border-bottom: 1px solid var(--e-bg); }
/* 진행 단계 표시줄 */
.erp-steps { display: flex; list-style: none; margin: 14px 0 18px; padding: 0; gap: 3px; }
.erp-steps li { flex: 1; text-align: center; font-size: 11px; color: var(--e-faint); padding-top: 9px; position: relative; white-space: nowrap; }
.erp-steps li::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 5px; border-radius: 3px; background: var(--e-line); }
.erp-steps li.done::before { background: #A9C9FB; }
.erp-steps li.done { color: var(--e-sub); }
.erp-steps li.now::before { background: var(--e-blue); }
.erp-steps li.now { color: var(--e-blue); font-weight: 700; }

/* 인적사항 — 항목명 / 값 두 칸씩 */
.erp-info { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 24px; margin: 0; }
.erp-info > div { display: grid; grid-template-columns: 76px 1fr; gap: 8px; padding: 7px 0; border-bottom: 1px solid var(--e-bg); font-size: 13px; }
.erp-info > div.wide { grid-column: 1 / -1; }
.erp-info dt { color: var(--e-faint); }
.erp-info dd { margin: 0; font-weight: 600; word-break: keep-all; }

/* 전체 이력 — 세로선 + 종류별 점 */
.erp-tl { list-style: none; margin: 0; padding: 0; position: relative; }
.erp-tl li { display: grid; grid-template-columns: 96px 14px 1fr; gap: 10px; padding: 0 0 14px; font-size: 13px; position: relative; }
.erp-tl li:not(:last-child)::after { content: ''; position: absolute; left: 112px; top: 14px; bottom: -2px; width: 2px; background: var(--e-line); }
.erp-tl-date { color: var(--e-faint); font-size: 12px; white-space: nowrap; padding-top: 1px; font-variant-numeric: tabular-nums; }
.erp-tl-dot { width: 10px; height: 10px; margin: 4px 2px 0; border-radius: 50%; background: #C4CAD1; position: relative; z-index: 1; }
.erp-tl-body { min-width: 0; }
.erp-tl-title { font-weight: 600; line-height: 1.5; }
.erp-tl-who { color: var(--e-faint); font-size: 12px; margin-top: 1px; word-break: keep-all; }
.erp-tl li.tone-start .erp-tl-dot { background: #22A45D; }
.erp-tl li.tone-key .erp-tl-dot { background: var(--e-blue); }
.erp-tl li.tone-key .erp-tl-title { color: var(--e-blue); }
.erp-tl li.tone-bad .erp-tl-dot { background: var(--e-down); }
.erp-tl li.tone-bad .erp-tl-title { color: var(--e-down); }
.erp-tl li.tone-match .erp-tl-dot { background: #7B5CF5; box-shadow: 0 0 0 3px #EEE9FE; }
.erp-tl li.tone-match .erp-tl-body { background: #F7F5FF; border-radius: 8px; padding: 8px 12px; margin-top: -6px; }

/* 스텝 깔때기 (구 fn-step) */
.erp-funnel { background: #fff; border: 1px solid var(--e-line); border-radius: 12px; padding: 12px 14px 16px; margin-bottom: 12px; }
.erp-step-row { display: flex; justify-content: center; margin: 1px 0; }
.erp-step { display: flex; align-items: center; justify-content: space-between; gap: 14px; min-width: 220px; max-width: 100%; padding: 9px 18px;
    border-radius: 12px; color: #fff; box-shadow: 0 1px 4px rgba(0, 0, 0, .08); }
.erp-step .name { font-weight: 700; font-size: 13px; flex: none; }
.erp-step .count { font-size: 22px; font-weight: 700; line-height: 1; flex: none; }
.erp-step .pct { font-size: 11px; opacity: .92; flex: 1; text-align: right; }
.erp-drop-ind { display: table; margin: 4px auto; padding: 3px 12px; background: #FDE8E8; color: var(--e-down); font-size: 11px; font-weight: 700;
    border: 1px dashed var(--e-down); border-radius: 20px; }
.erp-drop-ind.hold { background: #E6F5EA; color: var(--e-up); border-color: var(--e-up); }
.erp-drop-ind .pct { font-weight: 400; opacity: .9; margin-left: 4px; }

.erp :focus-visible { outline: 2px solid var(--e-blue); outline-offset: 2px; }

/* 휴대폰 — 왼쪽 메뉴를 위쪽 가로줄로 */
@media (max-width: 760px) {
    .erp { grid-template-columns: 1fr; grid-template-rows: auto 1fr; }
    .erp-nav { flex-direction: row; align-items: center; gap: 4px; padding: 8px 16px; border-right: none; border-bottom: 1px solid var(--e-line); overflow-x: auto; }
    .erp-brand, .erp-divider { display: none; }
    .erp-menu { display: flex; gap: 4px; }
    .erp-menu-item { white-space: nowrap; margin: 0; padding: 8px 12px; }
    .erp-exit { order: -1; margin: 0; padding: 8px 10px; white-space: nowrap; }
    .erp-work { padding: 16px 16px 32px; }
    .erp-detail { padding: 16px; }
    .erp-info { grid-template-columns: 1fr; }
    .erp-steps li { font-size: 10px; }
    .erp-tl li { grid-template-columns: 72px 14px 1fr; gap: 8px; }
    .erp-tl li:not(:last-child)::after { left: 86px; }
    .erp-step { min-width: 0; width: 100% !important; padding: 9px 12px; }
}
</style>
