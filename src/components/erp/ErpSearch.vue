<script setup>
// ERP 섭외이력 조회 — 이름/전화번호로 사랑이를 찾고, 누르면 유입부터 매칭까지 전체 이력(타임라인)을 보여줌
import { ref } from 'vue'
import { useErpLoad, regionLabel, districtLabel, fmtDate, fmtDateTime } from './erpUtil'

const q = ref('')
const search = useErpLoad('/api/erp/search')
const detail = useErpLoad('/api/erp/sarang-detail')
const openId = ref(null)

function run() {
    if (!q.value.trim()) return
    openId.value = null
    search.load({ q: q.value.trim() })
}
function open(id) {
    openId.value = id
    detail.data.value = null
    detail.load({ sarangId: id })
}
const KIND_ICON = { inflow: '🌱', call: '📞', activity: '📝', match: '🤝' }
</script>

<template>
    <section>
        <!-- 상세 -->
        <template v-if="openId">
            <button class="erp-link" @click="openId = null">← 검색 결과로</button>
            <p v-if="detail.loading.value" class="erp-empty">불러오는 중…</p>
            <p v-else-if="detail.error.value" class="erp-error">{{ detail.error.value }}</p>
            <template v-else-if="detail.data.value">
                <div class="erp-card">
                    <h3 class="erp-h3">{{ detail.data.value.info.name }} <span class="erp-stage">{{ detail.data.value.info.stage }}</span></h3>
                    <dl class="erp-dl">
                        <dt>연락처</dt><dd>{{ detail.data.value.info.phone }}</dd>
                        <dt>나이·성별</dt><dd>{{ [detail.data.value.info.age, detail.data.value.info.gender, detail.data.value.info.mbti].filter(Boolean).join(' · ') || '–' }}</dd>
                        <dt>지역</dt><dd>{{ regionLabel(detail.data.value.info.region_code) }} {{ districtLabel(detail.data.value.info.district_code) }}</dd>
                        <dt>유입</dt><dd>{{ fmtDate(detail.data.value.info.inflow_date) }} · {{ detail.data.value.info.introducer_name }} · {{ detail.data.value.info.recruitment_type === 'ONLINE' ? '온라인' : '오프라인' }}</dd>
                        <template v-if="detail.data.value.info.location || detail.data.value.info.reaction">
                            <dt>유입 장소·반응</dt><dd>{{ [detail.data.value.info.location, detail.data.value.info.reaction].filter(Boolean).join(' · ') }}</dd>
                        </template>
                        <template v-if="detail.data.value.info.guide_name">
                            <dt>인도자·티엠자</dt><dd>{{ detail.data.value.info.guide_name }} · {{ detail.data.value.info.caller_name || '–' }}</dd>
                            <dt>교사</dt><dd>{{ detail.data.value.info.teacher_name || '미배정' }}</dd>
                            <dt>경로·도구</dt><dd>{{ [detail.data.value.info.route, detail.data.value.info.tool].filter(Boolean).join(' · ') || '–' }}</dd>
                        </template>
                    </dl>
                </div>
                <h3 class="erp-h3">이력 <span class="erp-sub">최신순</span></h3>
                <ol class="erp-timeline">
                    <li v-for="(t, i) in detail.data.value.timeline" :key="i" :class="'k-' + t.kind">
                        <span class="erp-tl-icon" aria-hidden="true">{{ KIND_ICON[t.kind] }}</span>
                        <div>
                            <div class="erp-tl-label">{{ t.label }}<span v-if="t.detail" class="erp-sub"> · {{ t.detail }}</span></div>
                            <div class="erp-sub">{{ fmtDateTime(t.at) }}<template v-if="t.actor"> · {{ t.actor }}</template></div>
                        </div>
                    </li>
                </ol>
            </template>
        </template>

        <!-- 검색 -->
        <template v-else>
            <form class="erp-bar" @submit.prevent="run">
                <input v-model="q" class="erp-input" type="search" placeholder="이름 또는 전화번호 4자리 이상" aria-label="이름 또는 전화번호">
                <button class="erp-btn" type="submit" :disabled="search.loading.value">검색</button>
            </form>
            <p v-if="search.loading.value" class="erp-empty">찾는 중…</p>
            <p v-else-if="search.error.value" class="erp-error">{{ search.error.value }}</p>
            <template v-else-if="search.data.value">
                <p v-if="!search.data.value.list.length" class="erp-empty">"{{ q }}"(으)로 찾은 사람이 없어요. 이름 일부나 전화번호 뒷자리로 다시 찾아보세요.</p>
                <p v-else class="erp-sub">{{ search.data.value.list.length }}명{{ search.data.value.list.length >= 100 ? ' (최대 100명까지 보여요)' : '' }}</p>
                <button v-for="p in search.data.value.list" :key="p.sarang_id" class="erp-row-btn" @click="open(p.sarang_id)">
                    <span>
                        <b>{{ p.name }}</b> <span class="erp-sub">{{ p.phone }}</span><br>
                        <span class="erp-sub">{{ regionLabel(p.region_code) }} {{ districtLabel(p.district_code) }} · 유입 {{ p.introducer_name }}<template v-if="p.guide_name"> · 인도 {{ p.guide_name }}</template> · {{ fmtDate(p.inflow_date) }}</span>
                    </span>
                    <span class="erp-stage">{{ p.stage }}</span>
                </button>
            </template>
            <p v-else class="erp-empty">이름이나 전화번호로 찾으면 유입부터 매칭까지 전체 이력을 볼 수 있어요.</p>
        </template>
    </section>
</template>
