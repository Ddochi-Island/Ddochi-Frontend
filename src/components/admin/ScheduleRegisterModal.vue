<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useApi } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'

// [2026-04-22] index2.html openScheduleRegister / renderScheduleRegForm /
// saveSemesterSchedule (L9588-9697) 이식.
// 관리자용 — 월별 5주차 기간 + 마팔/신카/개강 마일스톤 등록.
// V1 필드명(w1_s~w5_e, mapal/shinka/opening) 유지 (서버 V2 변환 전).

const emit = defineEmits(['close'])
const { callApi } = useApi()
const { showAppAlert } = usePopup()

const viewDate = ref(new Date())
const loading = ref(true)
const saving = ref(false)

const FIELDS = ['w1_s','w1_e','w2_s','w2_e','w3_s','w3_e','w4_s','w4_e','w5_s','w5_e','mapal','shinka','opening']
const form = reactive({})
for (const k of FIELDS) form[k] = ''

const monthKey = computed(() => {
    const y = viewDate.value.getFullYear()
    const m = String(viewDate.value.getMonth() + 1).padStart(2, '0')
    return `${y}-${m}`
})
const shortYear = computed(() => String(viewDate.value.getFullYear()).slice(2))
const monthNum = computed(() => viewDate.value.getMonth() + 1)

function load() {
    loading.value = true
    callApi('/api/get-semester-schedule', { monthKey: monthKey.value }, (r) => {
        loading.value = false
        const data = (r && r.data) || {}
        for (const k of FIELDS) form[k] = data[k] || ''
    })
}

function moveMonth(offset) {
    const d = new Date(viewDate.value)
    d.setMonth(d.getMonth() + offset)
    viewDate.value = d
    load()
}

function save() {
    if (saving.value) return
    saving.value = true
    const data = {}
    for (const k of FIELDS) data[k] = form[k] || ''
    callApi('/api/save-semester-schedule', { monthKey: monthKey.value, data }, (r) => {
        saving.value = false
        showAppAlert((r && r.message) || '저장 완료')
    })
}

onMounted(load)
</script>

<template>
    <Teleport to="body">
        <div class="modal-overlay" @click.self="emit('close')">
            <div class="admin-modal-card">
                <div class="modal-header-sticky">
                    <div class="modal-title" style="margin:0; text-align:center; width:100%;">🗓️ 개강스케쥴 등록</div>
                    <span class="modal-close-sticky" style="position:absolute; right:20px;" @click="emit('close')">×</span>
                </div>

                <div class="modal-content-scroll">
                    <div class="cal-wrapper">
                        <div class="cal-nav">
                            <button class="cal-nav-btn" @click="moveMonth(-1)">◀</button>
                            <span class="cal-title">{{ shortYear }}년 {{ monthNum }}월 개강일정</span>
                            <button class="cal-nav-btn" @click="moveMonth(1)">▶</button>
                        </div>

                        <div v-if="loading" style="text-align:center; padding:20px;">일정을 불러오고 있어...</div>

                        <div v-else class="sch-reg-container">
                            <!-- 주차 5개 (range input) -->
                            <div v-for="n in 5" :key="n" class="sch-reg-row">
                                <div class="sch-reg-label">{{ n }}주차</div>
                                <div class="sch-reg-inputs">
                                    <input type="date" class="sch-date-input" v-model="form[`w${n}_s`]">
                                    <span class="sch-tilde">~</span>
                                    <input type="date" class="sch-date-input" v-model="form[`w${n}_e`]">
                                </div>
                            </div>

                            <hr style="border:0; border-top:1px dashed #ddd; margin:15px 0;">

                            <!-- 마일스톤 3종 -->
                            <div class="sch-reg-row">
                                <div class="sch-reg-label">마팔</div>
                                <div class="sch-reg-inputs">
                                    <input type="date" class="sch-date-input" v-model="form.mapal">
                                </div>
                            </div>
                            <div class="sch-reg-row">
                                <div class="sch-reg-label">신카</div>
                                <div class="sch-reg-inputs">
                                    <input type="date" class="sch-date-input" v-model="form.shinka">
                                </div>
                            </div>
                            <div class="sch-reg-row">
                                <div class="sch-reg-label">개강</div>
                                <div class="sch-reg-inputs">
                                    <input type="date" class="sch-date-input" v-model="form.opening">
                                </div>
                            </div>
                        </div>

                        <div class="btn-group" style="margin-top:15px;">
                            <button class="btn-pos" :disabled="saving" @click="save">
                                {{ saving ? '저장 중...' : '저장하기 💾' }}
                            </button>
                            <button class="btn-neg" @click="emit('close')">닫기</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </Teleport>
</template>
