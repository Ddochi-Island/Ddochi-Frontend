<script setup>
// ERP 매칭 명단 — 구 매칭 시트처럼 합당한자 날짜(재가한 날) 기준 기간 안 재가된 사람 한 줄씩. 인도 지역·반으로 좁히고 시트용(탭 구분) 복사
import { ref, computed, watch } from 'vue'
import ErpRangePicker from './ErpRangePicker.vue'
import { useErpLoad, monthOf, natCmp, regionLabel } from './erpUtil'
import { usePopup } from '@/composables/usePopup'

const { showToast } = usePopup()
const range = ref(monthOf())
const { loading, error, data, load } = useErpLoad('/api/erp/match-list')
const region = ref('')
const group = ref('')
const loaded = ref(null)
async function run() { const r = { ...range.value }; if (await load(r)) loaded.value = r }
watch(region, () => { group.value = '' })

const all = computed(() => data.value?.rows || [])
const regions = computed(() => [...new Set(all.value.map((r) => r.guide_region).filter(Boolean))].sort(natCmp))
const inRegion = computed(() => all.value.filter((r) => !region.value || r.guide_region === region.value))
const groups = computed(() => (region.value ? [...new Set(inRegion.value.map((r) => r.guide_group).filter(Boolean))].sort(natCmp) : []))
const rows = computed(() => inRegion.value.filter((r) => !group.value || r.guide_group === group.value))
const count = (list, key, v) => list.filter((r) => r[key] === v).length

const md = (ymd) => `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}`
// 시트처럼 M/D. 합당한자 날짜(hap_date)는 서버가 KST 날짜로 줌. 만남 날짜(MATCHED_AT·만남 예정일)는
// 입력한 벽시계 시각이 Z 붙은 채 저장돼 있어서 옮기지 않고 날짜만(옮기면 저녁 만남이 다음 날로 밀림)
const day = (iso) => (iso ? md(iso.slice(0, 10)) : '')
const onOff = (t) => (t === 'ONLINE' ? '온라인' : t === 'OFFLINE' ? '오프라인' : '')
const dist = (d) => (d ? `${d}구역` : '')
// 스프레드시트에 그대로 붙게 탭 구분(TSV) — 칸 안의 탭·줄바꿈은 공백으로
const cell = (v) => String(v ?? '').replace(/[\t\r\n]+/g, ' ').trim()
function copy() {
    const head = ['합당한자 날짜', '인도 지역', '인도 반', '인도 구역', '교사 지역', '교사 반', '교사 구역', '섭', '인', '교',
        '유형', '도구이름', '온/오프라인', '최초만남 예정날짜', '최초만남 진행결과', '이후만남 진행결과', '상담연결 날짜']
    const lines = rows.value.map((r) => [
        day(r.hap_date), r.guide_region ? regionLabel(r.guide_region) : '', r.guide_group, dist(r.guide_district),
        r.teacher_region ? regionLabel(r.teacher_region) : '', r.teacher_group, dist(r.teacher_district),
        r.name, r.guide_name, r.teacher_name, r.route, r.tool, onOff(r.recruitment_type),
        day(r.first_at), r.first_result, r.later_result, day(r.consult_at),
    ].map(cell).join('\t'))
    navigator.clipboard.writeText([head.join('\t'), ...lines].join('\n')).catch(() => {})
    showToast(`📋 ${rows.value.length}명 복사됨 — 시트에 붙여넣으세요`)
}
</script>

<template>
    <section>
        <div class="erp-bar">
            <span class="erp-label">합당한자 날짜</span>
            <ErpRangePicker v-model="range" />
            <button class="erp-btn" :disabled="loading" @click="run">🔍 조회</button>
        </div>

        <p v-if="loading" class="erp-empty">조회 중…</p>
        <p v-else-if="error" class="erp-error">{{ error }}</p>
        <template v-else-if="data && loaded">
            <div class="erp-section">
                <div class="erp-find-chips" role="group" aria-label="인도 지역">
                    <button :class="['erp-chip', { on: !region }]" :aria-pressed="!region" @click="region = ''">전체 {{ all.length }}</button>
                    <button v-for="rg in regions" :key="rg" :class="['erp-chip', { on: region === rg }]" :aria-pressed="region === rg" @click="region = rg">
                        {{ regionLabel(rg) }} {{ count(all, 'guide_region', rg) }}
                    </button>
                    <button class="erp-btn" style="margin-left: auto" :disabled="!rows.length" @click="copy">시트용 복사</button>
                </div>
                <div v-if="groups.length" class="erp-find-chips" role="group" aria-label="인도 반">
                    <button :class="['erp-chip', { on: !group }]" :aria-pressed="!group" @click="group = ''">{{ regionLabel(region) }} 전체</button>
                    <button v-for="g in groups" :key="g" :class="['erp-chip', { on: group === g }]" :aria-pressed="group === g" @click="group = g">
                        {{ g }} {{ count(inRegion, 'guide_group', g) }}
                    </button>
                </div>
                <h3 class="erp-h3">
                    {{ md(loaded.from) }}~{{ md(loaded.to) }} 매칭 명단 <span class="erp-sub">{{ rows.length }}명 · 합당한자 날짜 순서 · 날짜는 재가한 날 · 소속은 인도자·교사의 지금 소속</span>
                </h3>
                <p v-if="!rows.length" class="erp-empty">이 기간에 합당한자 날짜인 사람이 없어요.</p>
                <div v-else class="erp-table-wrap">
                    <table class="erp-table erp-table-left erp-match-table">
                        <thead>
                            <tr>
                                <th scope="col">합당한자 날짜</th><th scope="col">인도 소속</th><th scope="col">교사 소속</th>
                                <th scope="col">섭</th><th scope="col">인</th><th scope="col">교</th>
                                <th scope="col">유형</th><th scope="col">도구</th><th scope="col">온/오프</th>
                                <th scope="col">최초만남</th><th scope="col">최초 결과</th><th scope="col">이후 결과</th><th scope="col">상담연결</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="r in rows" :key="r.sarang_id">
                                <td>{{ day(r.hap_date) }}</td>
                                <td>{{ r.guide_region ? regionLabel(r.guide_region) : '—' }} {{ r.guide_group || '' }} {{ dist(r.guide_district) }}</td>
                                <td :class="{ 'erp-zero': !r.teacher_region }">{{ r.teacher_region ? `${regionLabel(r.teacher_region)} ${r.teacher_group || ''} ${dist(r.teacher_district)}` : '—' }}</td>
                                <td><b>{{ r.name }}</b></td>
                                <td>{{ r.guide_name || '—' }}</td>
                                <td :class="{ 'erp-zero': !r.teacher_name }">{{ r.teacher_name || '—' }}</td>
                                <td>{{ r.route || '—' }}</td>
                                <td>{{ r.tool || '—' }}</td>
                                <td>{{ onOff(r.recruitment_type) }}</td>
                                <td>{{ day(r.first_at) || '—' }}</td>
                                <td>{{ r.first_result || '—' }}</td>
                                <td>{{ r.later_result || '—' }}</td>
                                <td>{{ day(r.consult_at) || '—' }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </template>
        <p v-else class="erp-empty">합당한자 날짜 기간을 고르고 🔍 조회를 누르세요.</p>
    </section>
</template>

<style scoped>
.erp-match-table td { white-space: nowrap; }
</style>
