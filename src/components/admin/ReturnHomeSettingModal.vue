<script setup>
import { ref, reactive, onMounted, nextTick, watch } from 'vue'
import { useApi } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'

// [2026-05-12] legacy openReturnHomeSettingScreen / loadReturnHomeConfig /
// saveReturnHomeSetting (legacy2/public/index.html L10016-10120) 이식.
// Phase 16-G — 팀별 귀가 알림 (returnHomeMsg + returnHomeTime) 설정.

const emit = defineEmits(['close'])
const { callApi, callApiPromise } = useApi()
const { showAppAlert } = usePopup()

const teams = ref([])
const activeTabIndex = ref(0)
const loading = ref(true)
// rowState[team] = { msg, time, loaded }
const rowState = reactive({})
// contenteditable refs (team 별)
const msgRefs = {}

// 10분 단위 HH:MM 옵션 (00:00 ~ 23:50, 144개)
const timeOptions = (() => {
    const opts = []
    for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m += 10) {
            opts.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
        }
    }
    return opts
})()

function loadTeams() {
    loading.value = true
    callApi('/api/get-teams', {}, (r) => {
        loading.value = false
        if (!r || !r.success) return showAppAlert('지역 정보를 불러오지 못했어.')
        teams.value = r.list || []
        for (const team of teams.value) {
            rowState[team] = { msg: '', time: '', loaded: false }
        }
        // 첫 탭 자동 로드
        if (teams.value.length) loadTeamConfig(teams.value[0])
    })
}

async function loadTeamConfig(team) {
    if (rowState[team]?.loaded) return
    try {
        const r = await callApiPromise('/api/get-return-home-config', { team })
        if (!r || !r.success) {
            rowState[team] = { msg: '', time: '', loaded: true }
            return
        }
        rowState[team] = { msg: r.msg || '', time: r.time || '', loaded: true }
        // contenteditable 에 HTML 주입 (legacy 와 동일 패턴 — v-model 대신 직접 innerHTML)
        await nextTick()
        const el = msgRefs[team]
        if (el && r.msg) el.innerHTML = r.msg
    } catch (e) {
        showAppAlert('설정을 불러오지 못했어: ' + e.message)
    }
}

// 탭 전환 시 해당 팀 config 로드
watch(activeTabIndex, (i) => {
    const team = teams.value[i]
    if (team) loadTeamConfig(team)
})

// 텔레그램 호환 HTML 정제 (legacy sanitizeForTelegram L12362 1:1 정합).
// 텔레그램은 <b>,<i>,<u>,<s>,<a>,<code>,<pre> 허용. 나머지는 strip.
function sanitizeForTelegram(htmlString) {
    let text = htmlString
    // 1. block 요소와 <br>을 \n 으로
    text = text.replace(/<br\s*\/?>/gi, '\n')
    text = text.replace(/<\/p>|<\/div>/gi, '\n')
    text = text.replace(/<p[^>]*>|<div[^>]*>/gi, '')
    // 2. 미지원 태그 strip (내부 텍스트는 유지)
    text = text.replace(/<\/?(span|font|style|script|html|body|head|meta)[^>]*>/gi, '')
    // 3. 특수 문자 디코딩
    text = text.replace(/&nbsp;/gi, ' ')
    // 4. 불필요한 연속 줄바꿈 정리
    return text.trim().replace(/\n{3,}/g, '\n\n')
}

async function saveConfig(team) {
    const el = msgRefs[team]
    const time = rowState[team]?.time || ''
    if (!el || !el.innerText.trim() || !time) {
        return showAppAlert('메시지와 시간을 모두 꼼꼼하게 입력해줘!')
    }
    const cleanedHtml = sanitizeForTelegram(el.innerHTML)
    try {
        const r = await callApiPromise('/api/save-return-home-config', {
            team, msg: cleanedHtml, time,
        })
        if (r?.success) {
            showAppAlert('저장 완료! 정해진 시간에 발송될거야 🏠')
            rowState[team].msg = cleanedHtml
        } else {
            showAppAlert(r?.message || '저장 실패ㅠ')
        }
    } catch (e) {
        showAppAlert('저장 실패: ' + e.message)
    }
}

function setMsgRef(team) {
    return (el) => { if (el) msgRefs[team] = el }
}

onMounted(loadTeams)
</script>

<template>
    <Teleport to="body">
        <div class="modal-overlay" @click.self="emit('close')">
            <div class="admin-modal-card">
                <div class="modal-header-sticky">
                    <div class="modal-title" style="margin:0; text-align:center; width:100%;">🏠 귀할 정하기</div>
                    <span class="modal-close-sticky" style="position:absolute; right:20px;" @click="emit('close')">×</span>
                </div>

                <div class="modal-content-scroll">
                    <div v-if="loading" style="text-align:center; padding:20px;">지역 정보 불러오는 중...</div>

                    <template v-else>
                        <!-- 팀 탭 -->
                        <div style="display:flex; overflow-x:auto; gap:5px; margin-bottom:15px; padding-bottom:5px;">
                            <div v-for="(team, i) in teams" :key="team" class="sheet-tab-btn"
                                :class="{ active: activeTabIndex === i }" @click="activeTabIndex = i">
                                {{ team }}
                            </div>
                        </div>

                        <!-- 팀별 패널 -->
                        <div v-for="(team, i) in teams" :key="team" v-show="activeTabIndex === i" class="team-panel">
                            <div class="team-panel-title">🏠 {{ team }} 귀할 정하기</div>
                            <div style="font-size:13px; color:#666; margin-bottom:15px;">
                                텔레그램에서 서식(굵게 등)을 넣은 글을 복사해서 붙여넣어봐!
                            </div>

                            <label class="field-label">📝 메시지 내용</label>
                            <div class="rh-editor" contenteditable="true" :ref="setMsgRef(team)"></div>

                            <label class="field-label" style="margin-top:15px;">⏰ 발송 시간</label>
                            <div class="input-card" style="margin-top:5px; padding:0;">
                                <select v-model="rowState[team].time"
                                    style="width:100%; padding:12px; border:none; background:transparent; text-align:center; font-size:16px; color:inherit;">
                                    <option value="">- 발송 시간 선택 -</option>
                                    <option v-for="t in timeOptions" :key="t" :value="t">{{ t }}</option>
                                </select>
                            </div>

                            <button class="btn-pos" style="background:#FFB74D; width:100%; margin-top:15px;"
                                @click="saveConfig(team)">💾 저장하기</button>
                        </div>
                    </template>

                    <div class="btn-group" style="margin-top:15px;">
                        <button class="btn-neg" @click="emit('close')">닫기</button>
                    </div>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
.team-panel {
    background: #fff;
    padding: 15px;
    border-radius: 12px;
    border: 1px solid #eee;
    box-shadow: 0 2px 5px rgba(0,0,0,0.05);
}
.team-panel-title {
    font-weight: bold;
    color: #333;
    margin-bottom: 10px;
    font-size: 16px;
    border-bottom: 2px solid #f0f0f0;
    padding-bottom: 5px;
}
.field-label {
    text-align: left;
    display: block;
    font-size: 14px;
    font-weight: bold;
    color: #FF8F00;
    margin-bottom: 6px;
}
.rh-editor {
    min-height: 120px;
    padding: 15px;
    line-height: 1.5;
    outline: none;
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 10px;
    overflow-y: auto;
    font-family: 'Noto Sans KR', sans-serif;
    font-size: 14px;
    color: #333;
}
.rh-editor:focus { border-color: #FFB74D; }
</style>
