<script setup>
// ERP(관리자 분석) — 구 erp.ddochi.cloud를 앱 안으로 옮긴 화면. 탭: 섭외이력 조회 / TM 결과 집계 / 전환 퍼널 / 주간 보고서.
// 데이터는 /api/erp/*(관리자 전용). 탭별 화면은 components/erp/, 공통 스타일(.erp-*)은 이 파일 아래 비scoped 스타일에.
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import ErpSearch from '@/components/erp/ErpSearch.vue'
import ErpTmStats from '@/components/erp/ErpTmStats.vue'
import ErpFunnel from '@/components/erp/ErpFunnel.vue'
import ErpWeekly from '@/components/erp/ErpWeekly.vue'

const router = useRouter()
const route = useRoute()

const TABS = [
    { key: 'search', label: '🔎 섭외이력', comp: ErpSearch },
    { key: 'weekly', label: '📅 주간 보고서', comp: ErpWeekly },
    { key: 'tm', label: '📞 TM 집계', comp: ErpTmStats },
    { key: 'funnel', label: '🔻 전환 퍼널', comp: ErpFunnel },
]
const active = computed(() => TABS.find((t) => t.key === route.query.tab) || TABS[0])
const setTab = (key) => router.replace({ query: { ...route.query, tab: key } })
</script>

<template>
    <div class="screen erp">
        <div class="erp-top">
            <button class="erp-link" @click="router.back()">← 뒤로</button>
            <h2 class="erp-title">🗂️ ERP</h2>
        </div>
        <div class="erp-tabs" role="tablist" aria-label="ERP 메뉴">
            <button v-for="t in TABS" :key="t.key" role="tab" :aria-selected="t.key === active.key"
                    :class="['erp-tab', { on: t.key === active.key }]" @click="setTab(t.key)">{{ t.label }}</button>
        </div>
        <!-- KeepAlive: 탭을 오가도 집계 결과/검색어가 남아 있게 -->
        <KeepAlive>
            <component :is="active.comp" :key="active.key" role="tabpanel" />
        </KeepAlive>
    </div>
</template>

<style>
.erp { max-width: 1100px; margin: 0 auto; padding: 16px; color: var(--text-color); }
.erp-top { display: flex; align-items: center; gap: 12px; }
.erp-title { margin: 0; font-size: 22px; }
.erp-tabs { display: flex; gap: 6px; margin: 12px 0 14px; overflow-x: auto; padding-bottom: 2px; }
.erp-tab { flex: none; border: 1px solid #E5D5C3; background: var(--card-bg); color: var(--btn-color); border-radius: 999px;
    padding: 8px 14px; font-family: 'Jua'; font-size: 15px; cursor: pointer; }
.erp-tab.on { background: var(--btn-color); border-color: var(--btn-color); color: #fff; }

.erp-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 10px; }
.erp-range { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.erp-quick, .erp-dates { display: flex; align-items: center; gap: 4px; }
.erp-range input[type="date"], .erp-input { font: inherit; font-size: 14px; padding: 7px 8px; border: 1px solid #D7C4AE; border-radius: 8px;
    background: #fff; color: var(--text-color); min-width: 0; }
.erp-range input:disabled { background: #F5EFE8; }
.erp-bar form, form.erp-bar .erp-input { flex: 1; }
.erp-select { flex: none; width: auto; }
.erp-chip { border: 1px solid #E5D5C3; background: #FBF6EF; color: var(--btn-color); border-radius: 8px; padding: 6px 10px;
    font-family: 'Jua'; font-size: 13px; cursor: pointer; }
.erp-btn { border: none; background: var(--btn-color); color: #fff; border-radius: 8px; padding: 8px 18px; font-family: 'Jua'; font-size: 15px; cursor: pointer; }
.erp-btn:disabled { opacity: .5; cursor: default; }
.erp-link { background: none; border: none; padding: 4px 0; color: var(--btn-color); font: inherit; font-family: 'Jua'; cursor: pointer; text-align: left; }
.erp-link:disabled { color: var(--text-color); cursor: default; }
.erp-seg { display: inline-flex; border: 1px solid #D7C4AE; border-radius: 8px; overflow: hidden; }
.erp-seg button { border: none; background: #fff; color: var(--btn-color); padding: 7px 12px; font-family: 'Jua'; font-size: 14px; cursor: pointer; }
.erp-seg button.on { background: var(--btn-color); color: #fff; }

.erp-note { margin: 0 0 10px; font-size: 13px; color: #8D6E63; line-height: 1.5; }
.erp-empty { padding: 28px 12px; text-align: center; color: #8D6E63; }
.erp-error { padding: 12px; border-radius: 8px; background: #FDECEA; color: #B71C1C; }
.erp-sub { font-size: 12px; color: #A1887F; font-weight: normal; }
.erp-h3 { margin: 4px 0 8px; font-size: 17px; }
.erp-block { margin-bottom: 18px; }
details.erp-block > summary { cursor: pointer; }
.erp-crumbs { margin-bottom: 8px; font-size: 14px; }

.erp-table-wrap { overflow-x: auto; background: var(--card-bg); border-radius: 12px; box-shadow: var(--shadow); }
.erp-table { width: 100%; border-collapse: collapse; font-size: 14px; font-variant-numeric: tabular-nums; }
.erp-table th, .erp-table td { padding: 8px 10px; border-bottom: 1px solid #F1E6D8; white-space: nowrap; }
.erp-table thead th { background: #FBF6EF; font-weight: normal; color: #8D6E63; font-size: 13px; position: sticky; top: 0; }
.erp-table td { text-align: right; }
.erp-table-left td { text-align: left; }
.erp-table tbody th, .erp-table tfoot th { text-align: left; font-weight: normal; }
.erp-table tfoot td, .erp-table tfoot th { background: #FBF6EF; font-weight: bold; border-bottom: none; }
.erp-table tr.erp-click { cursor: pointer; }
.erp-table tr.erp-click:hover { background: #FFF8E1; }
.erp-zero { color: #C9B8A6; }
.erp-delta { font-size: 11px; color: #A1887F; }
.erp-delta.up { color: #2E7D32; }
.erp-delta.down { color: #C62828; }

.erp-row-btn { display: flex; justify-content: space-between; align-items: center; gap: 10px; width: 100%; text-align: left;
    background: var(--card-bg); border: 1px solid #F1E6D8; border-radius: 12px; padding: 10px 12px; margin-bottom: 6px;
    font: inherit; color: var(--text-color); cursor: pointer; line-height: 1.6; }
.erp-row-btn:hover { border-color: #D7C4AE; }
.erp-stage { flex: none; font-size: 12px; background: #EFE3D3; color: var(--btn-color); border-radius: 999px; padding: 2px 9px; vertical-align: middle; }
.erp-card { background: var(--card-bg); border-radius: 12px; box-shadow: var(--shadow); padding: 14px 16px; margin: 8px 0 16px; }
.erp-dl { display: grid; grid-template-columns: max-content 1fr; gap: 6px 14px; margin: 0; font-size: 14px; }
.erp-dl dt { color: #8D6E63; }
.erp-dl dd { margin: 0; }
.erp-timeline { list-style: none; margin: 0; padding: 0; }
.erp-timeline li { display: flex; gap: 10px; padding: 9px 0; border-bottom: 1px solid #F1E6D8; font-size: 14px; line-height: 1.5; }
.erp-tl-icon { flex: none; width: 24px; text-align: center; }
.erp-timeline li.k-match .erp-tl-label { font-weight: bold; }

.erp-funnel { list-style: none; margin: 0 0 16px; padding: 14px 16px; background: var(--card-bg); border-radius: 12px; box-shadow: var(--shadow); }
.erp-funnel li { display: grid; grid-template-columns: 84px 1fr 48px 110px; align-items: center; gap: 8px; padding: 5px 0; font-size: 14px; }
.erp-funnel-track { height: 18px; background: #F5EFE8; border-radius: 4px; overflow: hidden; }
.erp-funnel-bar { display: block; height: 100%; background: var(--accent-color); border-radius: 4px; }
.erp-funnel-n { text-align: right; font-variant-numeric: tabular-nums; font-weight: bold; }
.erp-funnel-step { font-size: 12px; color: #8D6E63; }

.erp button:focus-visible, .erp select:focus-visible, .erp input:focus-visible, .erp summary:focus-visible { outline: 3px solid var(--accent-color); outline-offset: 2px; }
@media (max-width: 520px) {
    .erp { padding: 12px 16px; }
    .erp-funnel li { grid-template-columns: 70px 1fr 40px; }
    .erp-funnel-step { grid-column: 2 / 4; }
}
</style>
