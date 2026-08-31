<script setup>
import { ref, computed, onMounted } from 'vue'
import { useApi } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'
import { useAuthStore } from '@/stores/auth'

// [2026-05-11] legacy public/index.html L14808-14916 openNotificationTimeManager / saveNotificationTimes 이식.
// 관리자 모드 → ⏰ 실시간 알림 시간 설정. backend: /api/manage-notification-times (Phase 9-B).
//   get  → { success, times: ['HH:MM',...], morningTime: 'HH:MM' }
//   save → { team, times, morningTime }
// 정책: legacy 동일. 시간 0개 저장 시 confirm. 아침 브리핑 빈 값 reject.

const emit = defineEmits(['close'])
const { callApi, callApiPromise } = useApi()
const { showAppAlert, showAppConfirm } = usePopup()
const auth = useAuthStore()

const loading = ref(true)
const saving = ref(false)
const morningTime = ref('08:30')
const times = ref([])  // ['HH:MM', ...] sorted
const newTimeInput = ref('')

// legacy 백도어 정합: 12144000-* 사번이면 '관리'. 그 외에는 본인 팀.
const targetTeam = computed(() => {
    if (String(auth.currentSabun || '').startsWith('12144000-')) return '관리'
    return auth.currentUserTeam || '미배정'
})

async function load() {
    loading.value = true
    try {
        const r = await callApiPromise('/api/manage-notification-times', {
            action: 'get',
            team: targetTeam.value,
        })
        if (r && r.success) {
            times.value = [...(r.times || [])].sort()
            morningTime.value = r.morningTime || '08:30'
        } else {
            showAppAlert('설정을 불러오지 못했어.')
        }
    } catch (_) {
        showAppAlert('설정을 불러오지 못했어.')
    } finally {
        loading.value = false
    }
}

function addTime() {
    const val = (newTimeInput.value || '').trim()
    if (!val) return showAppAlert('시간을 선택해줘!')
    if (times.value.includes(val)) return showAppAlert('이미 등록된 시간이야!')
    times.value = [...times.value, val].sort()
    newTimeInput.value = ''
}

function removeTime(idx) {
    times.value = times.value.filter((_, i) => i !== idx)
}

function save() {
    if (!morningTime.value) return showAppAlert('아침 브리핑 시간을 설정해줘!')

    const doSave = () => {
        if (saving.value) return
        saving.value = true
        callApi('/api/manage-notification-times', {
            action: 'save',
            team: targetTeam.value,
            times: times.value,
            morningTime: morningTime.value,
        }, (r) => {
            saving.value = false
            showAppAlert(r?.message || (r?.success ? '저장됐어!' : '저장 실패'), () => {
                if (r?.success) emit('close')
            })
        })
    }

    if (times.value.length === 0) {
        showAppConfirm(
            '낮 시간 알림이 0개면 실시간 취합 알림이 발송되지 않아! 저장할까?',
            (yes) => { if (yes) doSave() }
        )
    } else {
        doSave()
    }
}

onMounted(load)
</script>

<template>
    <Teleport to="body">
        <div class="modal-overlay" @click.self="emit('close')">
            <div class="modal-card" style="max-width:440px;">
                <div class="modal-header-sticky">
                    <div class="modal-title" style="margin:0; text-align:center; width:100%;">
                        ⏰ 알림 시간 관리
                    </div>
                    <span class="modal-close-sticky" style="position:absolute; right:20px;" @click="emit('close')">×</span>
                </div>

                <div class="modal-content-scroll" style="padding:20px;">
                    <div v-if="loading" style="text-align:center; padding:30px;">설정을 가져오는 중... ⏳</div>

                    <template v-else>
                        <div class="info-banner">
                            텔레그램 봇이 개인별로 <b>실시간 계획 취합 알림</b>과
                            <b>아침 일정 브리핑</b>을 보내는 시간을 정합니다.
                        </div>

                        <!-- 🌅 아침 브리핑 -->
                        <div class="section-title morning">🌅 아침 브리핑 단톡방 발송 시간</div>
                        <div class="input-row">
                            <div class="input-card">
                                <input type="time" v-model="morningTime" class="time-input">
                            </div>
                        </div>

                        <hr style="border:0; border-top:1px dashed #ddd; margin:20px 0;">

                        <!-- 🏃 낮 시간 -->
                        <div class="section-title day">🏃 낮 시간 실시간 알림 시간</div>
                        <div class="input-row">
                            <div class="input-card" style="flex:1;">
                                <input type="time" v-model="newTimeInput" class="time-input"
                                    @keydown.enter.prevent="addTime">
                            </div>
                            <button class="btn-pos add-btn" @click="addTime">추가</button>
                        </div>

                        <div class="time-chips">
                            <div v-for="(t, idx) in times" :key="t" class="time-chip">
                                <span class="time-label">{{ t }}</span>
                                <span class="remove-x" @click="removeTime(idx)">×</span>
                            </div>
                            <div v-if="times.length === 0" class="empty-hint">
                                낮 시간 알림이 0개입니다. 추가하지 않으면 실시간 취합 알림이 발송되지 않아요.
                            </div>
                        </div>

                        <div class="btn-group" style="margin-top:24px;">
                            <button class="btn-pos save-btn" :disabled="saving" @click="save">
                                {{ saving ? '저장 중...' : '설정 저장' }}
                            </button>
                            <button class="btn-neg" @click="emit('close')">취소</button>
                        </div>
                    </template>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
.info-banner {
    display: block;
    background: #E3F2FD;
    color: #1565C0;
    border: 1px solid #BBDEFB;
    padding: 12px 14px;
    border-radius: 10px;
    font-size: 13px;
    line-height: 1.5;
    text-align: left;
}
.section-title {
    font-size: 14px;
    font-weight: bold;
    margin: 18px 0 10px;
}
.section-title.morning { color: #E65100; }
.section-title.day { color: #1565C0; }
.input-row {
    display: flex;
    gap: 10px;
    margin-bottom: 12px;
    align-items: center;
}
.input-card {
    flex: 1;
    margin: 0;
    padding: 0;
    border: 1px solid #ddd;
    border-radius: 10px;
    background: #fff;
}
.time-input {
    width: 100%;
    padding: 12px;
    border: none;
    background: transparent;
    text-align: center;
    font-size: 16px;
    font-family: 'Jua';
    color: #333;
    outline: none;
}
.add-btn {
    width: 70px;
    margin: 0;
    border-radius: 10px;
    padding: 12px 0;
    background: #0288D1;
    color: #fff;
    font-family: 'Jua';
    border: none;
    cursor: pointer;
}
.time-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin: 12px 0 0;
    min-height: 40px;
}
.time-chip {
    background: #f0f0f0;
    border: 1px solid #ddd;
    border-radius: 20px;
    padding: 6px 12px;
    display: flex;
    align-items: center;
    gap: 8px;
}
.time-label {
    font-weight: bold;
    color: #333;
    font-size: 15px;
    font-family: 'Jua';
}
.remove-x {
    background: #FF5252;
    color: #fff;
    border-radius: 50%;
    width: 18px;
    height: 18px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    cursor: pointer;
    user-select: none;
}
.empty-hint {
    font-size: 12px;
    color: #888;
    padding: 8px 0;
}
.save-btn {
    background: #0288D1;
    width: 100%;
}
</style>
