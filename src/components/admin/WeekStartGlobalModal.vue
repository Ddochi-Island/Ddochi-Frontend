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
const selected = ref(0)
const currentGlobal = ref(0)

async function load() {
    loading.value = true
    try {
        const r = await callApiPromise('/api/get-week-start-dow', {})
        if (r && r.success) {
            currentGlobal.value = Number(r.global ?? 0)
            selected.value = currentGlobal.value
        }
    } catch (_) {}
    loading.value = false
}

function save() {
    if (saving.value) return
    saving.value = true
    callApi('/api/set-week-start-global', { dow: selected.value }, (r) => {
        saving.value = false
        if (r && r.success) {
            currentGlobal.value = selected.value
            showAppAlert(r.message || '저장 완료!', () => emit('close'))
        } else {
            showAppAlert(r?.message || '저장 실패')
        }
    })
}

onMounted(load)
</script>

<template>
    <Teleport to="body">
        <div class="modal-overlay" @click.self="emit('close')">
            <div class="modal-card" style="max-width:420px;">
                <div class="modal-header-sticky">
                    <div class="modal-title" style="margin:0; text-align:center; width:100%;">
                        📅 주간 시작 요일 (글로벌)
                    </div>
                    <span class="modal-close-sticky" style="position:absolute; right:20px;" @click="emit('close')">×</span>
                </div>

                <div class="modal-content-scroll" style="padding:20px;">
                    <div v-if="loading" style="text-align:center; padding:30px;">불러오는 중... ⏳</div>

                    <template v-else>
                        <div style="font-size:13px; color:#555; line-height:1.6; margin-bottom:16px;">
                            모든 사용자의 <b>주간 통계 시작 요일</b> 기본값입니다.<br>
                            개인 사용자는 자기 설정에서 다르게 override 가능해요.
                        </div>

                        <div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:6px; margin-bottom:18px;">
                            <button v-for="(label, idx) in dayLabels" :key="idx"
                                class="dow-btn"
                                :class="{ active: selected === idx, sun: idx === 0, sat: idx === 6 }"
                                @click="selected = idx">
                                {{ label }}
                            </button>
                        </div>

                        <div style="font-size:12px; color:#888; margin-bottom:14px; text-align:center;">
                            현재 글로벌: <b style="color:#0288D1;">{{ dayLabels[currentGlobal] }}요일</b>
                            <span v-if="selected !== currentGlobal" style="color:#E65100;"> → {{ dayLabels[selected] }}요일 로 변경</span>
                        </div>

                        <button class="btn-pos" :disabled="saving"
                            style="width:100%; padding:12px; background:#0288D1; border-radius:10px; font-size:14px;"
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
    background: #0288D1;
    border-color: #0288D1;
    color: #fff;
    font-weight: bold;
}
.dow-btn.active.sun, .dow-btn.active.sat {
    color: #fff;
}
</style>
