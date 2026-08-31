<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useApi } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'
import { useAuthStore } from '@/stores/auth'
import { KR_TIME_DIFF_MS } from '@/constants'

// [2026-04-22] index2.html openActivityVenueScreen / loadActivityVenue /
// renderAvSlots / updateAvSlot / addAvSlot / removeAvSlot / saveActivityVenue
// (L9340-9439) 이식. 지역 권한자용 활동지 + 타임슬롯 관리.

const emit = defineEmits(['close'])
const { callApi } = useApi()
const { showAppAlert } = usePopup()
const auth = useAuthStore()

const DEFAULT_SLOTS = () => ([
    { label: '1타임(14-16)', host: '', startTime: '14:00', endTime: '16:00' },
    { label: '2타임(16-19)', host: '', startTime: '16:00', endTime: '19:00' },
    { label: '3타임(19-)',  host: '', startTime: '19:00', endTime: '21:00' }
])

function todayKstStr() {
    const now = new Date()
    const kst = new Date(now.getTime() + now.getTimezoneOffset() * 60 * 1000 + KR_TIME_DIFF_MS)
    return `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, '0')}-${String(kst.getDate()).padStart(2, '0')}`
}

const form = reactive({
    date: todayKstStr(),
    venue: '',
    showInCalendar: false,
    slots: DEFAULT_SLOTS()
})
const loading = ref(false)

function loadVenue(dateStr) {
    loading.value = true
    callApi('/api/activity-schedule/get', { date: dateStr }, (r) => {
        loading.value = false
        const data = (r && r.data) || { venue: '', slots: [], showInCalendar: false }
        form.date = dateStr
        form.venue = data.venue || ''
        form.showInCalendar = !!data.showInCalendar
        // backend 응답 키는 'slots' (schedule.js:122). legacy 호환 위해 timeSlots 도 fallback.
        const incoming = Array.isArray(data.slots) ? data.slots
            : (Array.isArray(data.timeSlots) ? data.timeSlots : [])
        const slots = incoming.length > 0 ? incoming : DEFAULT_SLOTS()
        form.slots = slots.map(s => ({
            label: s.label || '',
            host: s.host || '',
            startTime: s.startTime || '',
            endTime: s.endTime || ''
        }))
    })
}

function onDateChange(e) {
    loadVenue(e.target.value)
}

function addSlot() {
    form.slots.push({ label: '', host: '', startTime: '', endTime: '' })
}
function removeSlot(i) {
    form.slots.splice(i, 1)
}

function save() {
    // backend (schedule.js:161) 는 req.body.slots 받음. 키 이름 일치.
    const slots = form.slots.filter(s => s.label || s.startTime)
    callApi('/api/activity-schedule/save', {
        sabun: auth.currentSabun,
        date: form.date,
        venue: (form.venue || '').trim(),
        slots,
        showInCalendar: form.showInCalendar
    }, (r) => {
        showAppAlert((r && r.message) || '저장 완료')
    })
}

onMounted(() => loadVenue(form.date))
</script>

<template>
    <Teleport to="body">
        <div class="modal-overlay" @click.self="emit('close')">
            <div class="admin-modal-card">
                <div class="modal-header-sticky">
                    <div class="modal-title" style="margin:0; text-align:center; width:100%;">📍 활동지 입력</div>
                    <span class="modal-close-sticky" style="position:absolute; right:20px;" @click="emit('close')">×</span>
                </div>

                <div class="modal-content-scroll">
                    <label style="font-size:12px; color:#888; font-weight:bold;">날짜</label>
                    <div class="input-card" style="margin-bottom:12px;">
                        <input type="date" :value="form.date" @change="onDateChange"
                            style="width:100%; padding:10px; font-size:14px; font-family:'Jua'; border:none; background:transparent; color:#333;">
                    </div>

                    <label style="font-size:12px; color:#888; font-weight:bold;">활동지 (예: 홍익대학교)</label>
                    <div class="input-card" style="margin-bottom:12px;">
                        <input type="text" v-model="form.venue" placeholder="활동지"
                            style="width:100%; padding:10px; font-size:14px; font-family:'Jua'; border:none; background:transparent; color:#333;">
                    </div>

                    <label style="display:flex; align-items:center; gap:8px; background:#FCE4EC; padding:10px 12px; border-radius:8px; margin-bottom:15px; cursor:pointer; font-size:13px; color:#AD1457;">
                        <input type="checkbox" v-model="form.showInCalendar" style="width:16px; height:16px; cursor:pointer;">
                        📅 개강 일정 달력에도 표기
                    </label>

                    <div style="font-weight:bold; margin-bottom:8px;">⏰ 타임 슬롯</div>

                    <div v-if="loading" style="text-align:center; padding:10px; color:#888;">불러오는 중...</div>

                    <div v-for="(slot, i) in form.slots" :key="i"
                        style="background:#FFF3E0; border-radius:10px; padding:10px; margin-bottom:8px;">
                        <div style="display:flex; gap:5px; margin-bottom:5px;">
                            <input type="text" v-model="slot.label" placeholder="라벨 (예: 1타임(14-16))"
                                style="flex:1; padding:6px; font-size:12px; border:1px solid #ccc; border-radius:6px;">
                            <button type="button" @click="removeSlot(i)"
                                style="background:#EF5350; color:white; border:none; border-radius:6px; padding:0 10px; cursor:pointer;">✕</button>
                        </div>
                        <div style="display:flex; gap:5px; margin-bottom:5px; align-items:center;">
                            <input type="time" v-model="slot.startTime"
                                style="padding:6px; font-size:12px; border:1px solid #ccc; border-radius:6px;">
                            <span>~</span>
                            <input type="time" v-model="slot.endTime"
                                style="padding:6px; font-size:12px; border:1px solid #ccc; border-radius:6px;">
                        </div>
                        <input type="text" v-model="slot.host" placeholder="주관자"
                            style="width:100%; padding:6px; font-size:12px; border:1px solid #ccc; border-radius:6px;">
                    </div>

                    <button type="button" class="btn-sm"
                        style="width:100%; background:#26A69A; color:white; padding:8px; margin-top:5px;"
                        @click="addSlot">➕ 타임 추가</button>

                    <button class="btn-pos" style="width:100%; background:#E91E63; margin-top:15px;" @click="save">💾 저장</button>
                </div>
            </div>
        </div>
    </Teleport>
</template>
