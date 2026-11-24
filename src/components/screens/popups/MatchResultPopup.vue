<script setup>
// MatchingScreen 결과 입력 — 13개 목록(2026-11-25 사용자 요청: 취소/탈락 구분 없이 사유가 곧 결과). 텔레그램 /r_ 버튼과 같은 순서.
// 색은 legacy 클래스 재사용(.res-btn-cancel/delay/bi/2nd/consult)

defineProps({})

const emit = defineEmits(['close', 'pick'])

const OPTIONS = [
    { label: '상담연결', cls: 'res-btn-consult' },
    { label: '2차만남(단기)', cls: 'res-btn-2nd' },
    { label: '2차만남(장기)', cls: 'res-btn-2nd' },
    { label: '연락두절', cls: 'res-btn-cancel' },
    { label: '갈급부족', cls: 'res-btn-cancel' },
    { label: '환경비합', cls: 'res-btn-bi' },
    { label: '밀림(섭외자미룸)', cls: 'res-btn-delay' },
    { label: '밀림(교사못구함)', cls: 'res-btn-delay' },
    { label: '경계심', cls: 'res-btn-cancel' },
    { label: '중복섭외', cls: 'res-btn-cancel' },
    { label: '정신질환', cls: 'res-btn-bi' },
    { label: '인성비합', cls: 'res-btn-bi' },
    { label: '병가', cls: 'res-btn-cancel' },
]
</script>

<template>
    <Teleport to="body">
        <div class="modal-overlay" @click.self="emit('close')">
            <div class="modal-card">
                <span class="modal-close" @click="emit('close')">&times;</span>
                <div class="modal-title">어떻게 됐어?!</div>
                <div class="reason-grid">
                    <div
                        v-for="o in OPTIONS"
                        :key="o.label"
                        class="reason-btn"
                        :class="o.cls"
                        @click="emit('pick', o.label)"
                    >{{ o.label }}</div>
                </div>
            </div>
        </div>
    </Teleport>
</template>
