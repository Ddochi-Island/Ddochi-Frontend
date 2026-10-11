<script setup>
// ERP 섭외 조회(OR001) — 이름/전화번호로 사랑이를 찾고, 누르면 유입부터 매칭까지 전체 이력을 보여줌 (구 ERP 섭외이력 조회 화면 모양)
import { ref, computed } from 'vue'
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
const info = computed(() => detail.data.value?.info)
const meetings = computed(() => (detail.data.value?.timeline || []).filter((t) => t.kind === 'match'))
const history = computed(() => (detail.data.value?.timeline || []).filter((t) => t.kind !== 'match'))
const join = (...xs) => xs.filter(Boolean).join(' · ') || '—'
</script>

<template>
    <section>
        <!-- 상세 -->
        <template v-if="openId">
            <button class="erp-link" style="margin-bottom: 12px" @click="openId = null">← 검색 결과로</button>
            <p v-if="detail.loading.value" class="erp-empty">이력 불러오는 중…</p>
            <p v-else-if="detail.error.value" class="erp-error">{{ detail.error.value }}</p>
            <div v-else-if="info" class="erp-detail">
                <div class="erp-detail-name">{{ info.name }} <span class="erp-stage">{{ info.stage }}</span></div>
                <div class="erp-detail-meta">
                    연락처: <b>{{ info.phone }}</b> · 나이/성별: <b>{{ join(info.age, info.gender, info.mbti) }}</b><br>
                    지역: <b>{{ regionLabel(info.region_code) }} {{ districtLabel(info.district_code) }}</b> · 유입자: <b>{{ info.introducer_name || '—' }}</b>
                    · 유입일: <b>{{ fmtDate(info.inflow_date) }}</b> · <b>{{ info.recruitment_type === 'ONLINE' ? '온라인' : '오프라인' }}</b><br>
                    인도자: <b>{{ info.guide_name || '—' }}</b> · 티엠자: <b>{{ info.caller_name || '—' }}</b> · 교사: <b>{{ info.teacher_name || '—' }}</b><br>
                    경로/도구: <b>{{ join(info.route, info.tool) }}</b>
                    <template v-if="info.location || info.reaction"><br>유입 장소/반응: <b>{{ join(info.location, info.reaction) }}</b></template>
                </div>

                <div class="erp-sec">만남 기록 ({{ meetings.length }}건)</div>
                <div v-for="(m, i) in meetings" :key="i" class="erp-meet">
                    <div class="erp-meet-title">{{ fmtDateTime(m.at) }} · {{ m.label }}</div>
                    <div class="erp-meet-sub">교사 {{ m.actor || '미정' }}<template v-if="m.detail"> · {{ m.detail }}</template></div>
                </div>
                <div v-if="!meetings.length" class="erp-sub">만남 기록 없음</div>

                <div class="erp-sec">이력 ({{ history.length }}건)</div>
                <ol class="erp-tl">
                    <li v-for="(h, i) in history" :key="i">
                        <div class="erp-tl-date">{{ fmtDateTime(h.at) }}</div>
                        <div class="erp-tl-body">
                            {{ h.label }}<template v-if="h.detail"> · {{ h.detail }}</template>
                            <div class="erp-tl-who">{{ h.actor }}</div>
                        </div>
                    </li>
                </ol>
            </div>
        </template>

        <!-- 검색 -->
        <template v-else>
            <form class="erp-bar" @submit.prevent="run">
                <label class="erp-label" for="erp-q">이름 또는 전화번호</label>
                <input id="erp-q" v-model="q" class="erp-input" type="search" placeholder="예: 홍길동 · 01012345678">
                <button class="erp-btn" type="submit" :disabled="search.loading.value">검색</button>
            </form>
            <p v-if="search.loading.value" class="erp-empty">검색 중…</p>
            <p v-else-if="search.error.value" class="erp-error">{{ search.error.value }}</p>
            <template v-else-if="search.data.value">
                <p v-if="!search.data.value.list.length" class="erp-empty">검색 결과가 없습니다. 이름 일부나 전화번호 뒷자리로 다시 찾아보세요.</p>
                <button v-for="p in search.data.value.list" :key="p.sarang_id" class="erp-row-btn" @click="open(p.sarang_id)">
                    <span>
                        <span class="erp-row-name">{{ p.name }}</span>
                        <span class="erp-row-meta" style="display: block">
                            {{ p.guide_name || p.introducer_name || '—' }} {{ p.guide_name ? '인도' : '유입' }} · {{ regionLabel(p.region_code) }} {{ districtLabel(p.district_code) }} · {{ fmtDate(p.inflow_date) }}
                        </span>
                    </span>
                    <span class="erp-stage">{{ p.stage }}</span>
                </button>
                <p v-if="search.data.value.list.length >= 100" class="erp-sub">최대 100명까지 보여요. 더 좁혀서 찾아보세요.</p>
            </template>
            <p v-else class="erp-empty">이름 또는 전화번호로 검색하세요.</p>
        </template>
    </section>
</template>
