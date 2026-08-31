<script setup>
import { ref, onMounted } from 'vue'
import { useApi } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'
import { dayLabels } from '@/constants'

const emit = defineEmits(['close'])
const { callApi, callApiPromise } = useApi()
const { showAppAlert } = usePopup()

const loading = ref(true)
const saving = ref(false)
// null = 글로벌 따르기 / 0~6 = 직접 선택
const selected = ref(null)
const personal = ref(null)
const global = ref(0)
const effective = ref(0)

async function load() {
    loading.value = true
    try {
        const r = await callApiPromise('/api/get-week-start-dow', {})
        if (r && r.success) {
            personal.value = r.personal != null ? Number(r.personal) : null
            global.value = Number(r.global ?? 0)
            effective.value = Number(r.effective ?? 0)
            selected.value = personal.value
        }
    } catch (_) {}
    loading.value = false
}

function save() {
    if (saving.value) return
    saving.value = true
    callApi('/api/set-week-start-personal', { dow: selected.value }, (r) => {
        saving.value = false
        if (r && r.success) {
            showAppAlert(r.message || '저장 완료!', () => emit('close'))
        } else {
            showAppAlert(r?.message || '저장 실패')
        }
    })
}

function followGlobal() { selected.value = null }

onMounted(load)
</script>

<template>
    <Teleport to="body">
        <div class="modal-overlay" @click.self="emit('close')">
            <div class="modal-card" style="max-width:420px;">
                <div class="modal-header-sticky">
                    <div class="modal-title" style="margin:0; text-align:center; width:100%;">
                        📅 내 주간 시작 요일
                    </div>
                    <span class="modal-close-sticky" style="position:absolute; right:20px;" @click="emit('close')">×</span>
                </div>

                <div class="modal-content-scroll" style="padding:20px;">
                    <div v-if="loading" style="text-align:center; padding:30px;">불러오는 중... ⏳</div>

                    <template v-else>
                        <div style="font-size:13px; color:#555; line-height:1.6; margin-bottom:16px;">
                            나의 <b>주간 통계 시작 요일</b>. <br>
                            "글로벌 따르기" 를 선택하면 관리자가 정한 기본값({{ dayLabels[global] }}요일) 사용.
                        </div>

                        <button class="follow-btn" :class="{ active: selected === null }"
                            @click="followGlobal">
                            🌐 글로벌 따르기 (현재: {{ dayLabels[global] }}요일)
                        </button>

                        <div style="font-size:12px; color:#999; margin:14px 0 8px; text-align:center;">또는 직접 선택</div>

                        <div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:6px; margin-bottom:18px;">
                            <button v-for="(label, idx) in dayLabels" :key="idx"
                                class="dow-btn"
                                :class="{ active: selected === idx, sun: idx === 0, sat: idx === 6 }"
                                @click="selected = idx">
                                {{ label }}
                            </button>
                        </div>

                        <div style="font-size:12px; color:#888; margin-bottom:14px; text-align:center;">
                            현재 적용: <b style="color:#1976D2;">{{ dayLabels[effective] }}요일</b>
                            <span v-if="personal != null" style="color:#888;"> (개인 설정)</span>
                            <span v-else style="color:#888;"> (글로벌 따르기)</span>
                        </div>

                        <button class="btn-pos" :disabled="saving"
                            style="width:100%; padding:12px; background:#1976D2; border-radius:10px; font-size:14px;"
                            @click="save">
                            {{ saving ? '저장 중...' : '💾 저장' }}
                        </button>
                    </template>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
.follow-btn {
    width: 100%;
    padding: 12px;
    border: 1px solid #ddd;
    background: #fff;
    border-radius: 10px;
    font-family: 'Jua';
    font-size: 13px;
    color: #555;
    cursor: pointer;
    transition: all 0.15s;
}
.follow-btn.active {
    background: #E3F2FD;
    border-color: #1976D2;
    color: #1976D2;
    font-weight: bold;
}
.dow-btn {
    padding: 12px 0;
    border: 1px solid #ddd;
    background: #fff;
    border-radius: 8px;
    font-family: 'Jua';
    font-size: 14px;
    color: #333;
    cursor: pointer;
    transition: all 0.15s;
}
.dow-btn.sun { color: #d32f2f; }
.dow-btn.sat { color: #1976d2; }
.dow-btn.active {
    background: #1976D2;
    border-color: #1976D2;
    color: #fff;
    font-weight: bold;
}
.dow-btn.active.sun, .dow-btn.active.sat {
    color: #fff;
}
</style>
