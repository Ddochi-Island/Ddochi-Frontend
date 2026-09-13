<script setup>
// AdminScreen 의 '⚙️ 자동 거절 설정' modal.
// legacy public/index.html L12519-12586 (openAutoRejectConfigScreen /
// loadAutoRejectConfig / saveAutoRejectConfig) 정합.
//
// 의미: PROSPECTS '안받음' 처리 횟수가 count 도달 시 자동으로 'N번 안받음'
//      상태로 종료. count=0 → 자동 거절 사용 안 함.
//
// backend: services/main/src/routes/teams.js
//   /api/get-auto-reject-config  { team } → { success, count }
//   /api/save-auto-reject-config { team, count } → { success }

import { ref, onMounted } from 'vue'
import { useApi } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'

const emit = defineEmits(['close'])
const { callApi } = useApi()
const { showAppAlert } = usePopup()

const step = ref('teamSelect') // teamSelect | config
const teams = ref([])
const selectedTeam = ref('')
const count = ref(0)
const loading = ref(false)

function loadTeams() {
    callApi('/api/get-teams', {}, (r) => {
        if (!r?.success || !r.list?.length) return showAppAlert('지역 정보를 불러오지 못했어.')
        teams.value = r.list
    })
}

function pickTeam(team) {
    selectedTeam.value = team
    loading.value = true
    callApi('/api/get-auto-reject-config', { team }, (r) => {
        loading.value = false
        count.value = r?.count ?? 0
        step.value = 'config'
    })
}

function backToTeamSelect() {
    step.value = 'teamSelect'
    selectedTeam.value = ''
}

function saveConfig() {
    const n = Number(count.value)
    if (!Number.isFinite(n) || n < 0) return showAppAlert('0 이상의 올바른 숫자를 입력해줘!')
    callApi('/api/save-auto-reject-config', {
        team: selectedTeam.value, count: n,
    }, (r) => {
        if (!r?.success) return showAppAlert('⛔ 저장 실패: ' + (r?.message || '알 수 없는 에러'))
        showAppAlert(r.message || '저장 완료! ⚙️', () => emit('close'))
    })
}

onMounted(loadTeams)
</script>

<template>
    <Teleport to="body">
        <div class="modal-overlay" @click.self="emit('close')">
            <div class="admin-modal-card">
                <div class="modal-header-sticky">
                    <div class="modal-title" style="margin:0; text-align:center; width:100%;">⚙️ 자동 거절 설정</div>
                    <span class="modal-close-sticky" style="position:absolute; right:20px;" @click="emit('close')">×</span>
                </div>

                <div class="modal-content-scroll">
                    <!-- 팀 선택 -->
                    <template v-if="step === 'teamSelect'">
                        <div style="text-align:center; margin-bottom:15px; font-size:13px; color:#666;">설정할 지역을 선택해줘!</div>
                        <div v-if="!teams.length" style="text-align:center; padding:20px; color:#888;">지역 정보 불러오는 중...</div>
                        <div v-else class="btn-col">
                            <button v-for="team in teams" :key="team"
                                class="btn-pos" style="background:#795548; margin-bottom:8px;"
                                @click="pickTeam(team)">{{ team }}</button>
                        </div>
                    </template>

                    <!-- 설정 -->
                    <template v-else>
                        <div style="font-size:15px; font-weight:bold; color:#5D4037; margin-bottom:15px;">⚙️ {{ selectedTeam }} 자동 거절</div>

                        <div style="font-size:12px; color:#666; margin-bottom:20px; line-height:1.6; background:#EFEBE9; padding:12px; border-radius:8px;">
                            <b>'안받음'</b> 처리 횟수가 이 설정값에 도달하면<br>
                            자동으로 <b>N번 안받음</b> 상태로 종료 처리돼.<br>
                            <span style="color:#888;">(0 으로 설정하면 자동 거절을 사용하지 않아)</span>
                        </div>

                        <label class="ar-label">종료 기준 횟수</label>
                        <div style="display:flex; align-items:center; gap:10px;">
                            <input
                                v-model.number="count"
                                type="number"
                                inputmode="numeric"
                                pattern="[0-9]*"
                                min="0"
                                class="input-card ar-count-input"
                            />
                            <span style="font-size:18px; font-weight:bold; color:#555;">회</span>
                        </div>
                        <div v-if="loading" style="text-align:center; padding:10px; color:#888; font-size:12px;">불러오는 중...</div>

                        <div class="btn-group" style="margin-top:30px;">
                            <button class="btn-pos" style="background:#795548;" @click="saveConfig">💾 저장하기</button>
                            <button class="btn-neg" @click="backToTeamSelect">지역 다시 선택</button>
                        </div>
                    </template>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
.ar-label {
    text-align: left;
    display: block;
    font-size: 14px;
    font-weight: bold;
    margin-bottom: 10px;
    color: #5D4037;
}
.ar-count-input {
    margin: 0;
    flex: 1;
    text-align: center;
    font-size: 24px;
    font-weight: bold;
}
</style>
