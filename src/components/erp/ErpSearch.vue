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
const join = (...xs) => xs.filter(Boolean).join(' · ') || '—'

// 진행 단계 표시줄 — SARANG.STAGE 순서. 성홀 이후(성따/복방/센)는 상따 다음 칸 하나로 묶음
const STEPS = ['유입', '티엠', '만픽', '합재양', '재가', '매칭', '상따', '성홀+']
// 화면 이름 — DB 값(유입/상따)은 그대로 두고 보이는 이름만 바꿈 (10/14 명칭 변경)
const STAGE_NAME = { 유입: '찾기', 상따: '상연' }
const stageName = (s) => STAGE_NAME[s] || s
const stepIndex = computed(() => {
    const i = STEPS.indexOf(info.value?.stage)
    return i >= 0 ? i : STEPS.length - 1
})

// 이력 + 만남 기록을 한 타임라인으로, 찾기부터 시간 순서대로(위 → 아래)
const TONE = { 재가처리: 'key', 합재양작성: 'key', 반려처리: 'bad', '만남 픽스': 'key', 비합: 'bad', 거절: 'bad', 무효: 'bad' }
const timeline = computed(() =>
    [...(detail.data.value?.timeline || [])].reverse().map((t) => ({
        ...t,
        tone: t.kind === 'inflow' ? 'start' : t.kind === 'match' ? 'match' : TONE[t.label] || '',
        sub: t.kind === 'match' ? join(t.actor ? `교사 ${t.actor}` : '교사 미정', ...(t.detail || '').split(' / '))
            : join(t.detail, t.actor),
    })))
</script>

<template>
    <section>
        <!-- 상세 -->
        <template v-if="openId">
            <button class="erp-link" style="margin-bottom: 12px" @click="openId = null">← 검색 결과로</button>
            <p v-if="detail.loading.value" class="erp-empty">이력 불러오는 중…</p>
            <p v-else-if="detail.error.value" class="erp-error">{{ detail.error.value }}</p>
            <div v-else-if="info" class="erp-detail">
                <div class="erp-detail-name">{{ info.name }} <span class="erp-stage">{{ stageName(info.stage) }}</span></div>

                <ol class="erp-steps" :aria-label="`진행 단계: ${stageName(info.stage)}`">
                    <li v-for="(st, i) in STEPS" :key="st" :class="{ done: i < stepIndex, now: i === stepIndex }">{{ stageName(st) }}</li>
                </ol>

                <dl class="erp-info">
                    <div><dt>연락처</dt><dd>{{ info.phone }}</dd></div>
                    <div><dt>나이·성별</dt><dd>{{ join(info.age, info.gender, info.mbti) }}</dd></div>
                    <div><dt>지역</dt><dd>{{ regionLabel(info.region_code) }} {{ districtLabel(info.district_code) }}</dd></div>
                    <div><dt>찾기일</dt><dd>{{ fmtDate(info.inflow_date) }} · {{ info.recruitment_type === 'ONLINE' ? '온라인' : '오프라인' }}</dd></div>
                    <div><dt>유입자</dt><dd>{{ info.introducer_name || '—' }}</dd></div>
                    <div v-if="info.helper_names"><dt>조력자</dt><dd>{{ info.helper_names }}</dd></div>
                    <div><dt>인도자</dt><dd>{{ info.guide_name || '—' }}</dd></div>
                    <div><dt>티엠자</dt><dd>{{ info.caller_name || '—' }}</dd></div>
                    <div><dt>교사</dt><dd>{{ info.teacher_name || '—' }}</dd></div>
                    <div><dt>경로·도구</dt><dd>{{ join(info.route, info.tool) }}</dd></div>
                    <div v-if="info.location"><dt>찾기 장소</dt><dd>{{ info.location }}</dd></div>
                    <div v-if="info.reaction" class="wide"><dt>반응</dt><dd>{{ info.reaction }}</dd></div>
                </dl>

                <div class="erp-sec">전체 이력 <span class="erp-sub">찾기부터 시간 순서 · {{ timeline.length }}건</span></div>
                <ol class="erp-tl">
                    <li v-for="(t, i) in timeline" :key="i" :class="'tone-' + (t.tone || 'plain')">
                        <div class="erp-tl-date">{{ fmtDateTime(t.at) }}</div>
                        <span class="erp-tl-dot" aria-hidden="true"></span>
                        <div class="erp-tl-body">
                            <div class="erp-tl-title">{{ t.label }}</div>
                            <div class="erp-tl-who">{{ t.sub }}</div>
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
                    <span class="erp-stage">{{ stageName(p.stage) }}</span>
                </button>
                <p v-if="search.data.value.list.length >= 100" class="erp-sub">최대 100명까지 보여요. 더 좁혀서 찾아보세요.</p>
            </template>
            <p v-else class="erp-empty">이름 또는 전화번호로 검색하세요.</p>
        </template>
    </section>
</template>
