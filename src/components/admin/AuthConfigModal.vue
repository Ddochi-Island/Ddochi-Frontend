<script setup>
import { ref, onMounted } from 'vue'
import { useApi } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'

// [2026-05-12] legacy public/index.html L11012-11059 openAuthConfigScreen / submitAuthConfig 이식.
// 사명의 길 → 🔑 인증 설정 (패스키/토큰). backend: /api/auth-config/get|save.
//   get  → { success, passkeyHashSet, accessTtl, refreshTtl }
//   save → { newPasskey, accessTtl, refreshTtl } (newPasskey 비우면 패스키 변경 안 함)
// TTL 형식: ms 라이브러리 호환 (예: 15m, 1h, 7d, 30d).

const emit = defineEmits(['close'])
const { callApi, callApiPromise } = useApi()
const { showAppAlert } = usePopup()

const loading = ref(true)
const saving = ref(false)
const passkeyHashSet = ref(false)
const newPasskey = ref('')
const accessTtl = ref('15m')
const refreshTtl = ref('30d')

async function load() {
    loading.value = true
    try {
        const r = await callApiPromise('/api/auth-config/get', {})
        if (!r || !r.success) {
            showAppAlert(r?.message || '권한 없음', () => emit('close'))
            return
        }
        passkeyHashSet.value = !!r.passkeyHashSet
        accessTtl.value = r.accessTtl || '15m'
        refreshTtl.value = r.refreshTtl || '30d'
    } catch (_) {
        showAppAlert('설정을 불러오지 못했어.', () => emit('close'))
    } finally {
        loading.value = false
    }
}

function save() {
    if (saving.value) return
    saving.value = true
    callApi('/api/auth-config/save', {
        newPasskey: newPasskey.value.trim(),
        accessTtl: accessTtl.value.trim(),
        refreshTtl: refreshTtl.value.trim(),
    }, (r) => {
        saving.value = false
        showAppAlert(r?.message || (r?.success ? '저장 완료' : '저장 실패'), () => {
            if (r?.success) emit('close')
        })
    })
}

onMounted(load)
</script>

<template>
    <Teleport to="body">
        <div class="modal-overlay" @click.self="emit('close')">
            <div class="admin-modal-card">
                <div class="modal-header-sticky">
                    <div class="modal-title" style="margin:0; text-align:center; width:100%;">🔑 인증 설정</div>
                    <span class="modal-close-sticky" style="position:absolute; right:20px;" @click="emit('close')">×</span>
                </div>

                <div class="modal-content-scroll" style="padding:20px;">
                    <div v-if="loading" style="text-align:center; padding:30px;">설정을 가져오는 중... ⏳</div>

                    <template v-else>
                        <div class="hint-box">
                            * 패스키는 비워두면 변경 안 함<br>
                            * 토큰 만료는 ms 라이브러리 형식: <b>15m, 1h, 7d, 30d</b><br>
                            * 현재 패스키 설정: <b :class="passkeyHashSet ? 'badge-ok' : 'badge-warn'">{{ passkeyHashSet ? '✅ 설정됨' : '❌ 미설정 (검증 비활성)' }}</b>
                        </div>

                        <label class="row-label">🗝️ 새 패스키 (변경할 때만 입력)</label>
                        <div class="input-card">
                            <input type="password" v-model="newPasskey" placeholder="새 패스키" autocomplete="new-password">
                        </div>

                        <label class="row-label">⏱️ 액세스 토큰 만료</label>
                        <div class="input-card">
                            <input type="text" v-model="accessTtl" placeholder="예: 15m">
                        </div>

                        <label class="row-label">🔄 리프레시 토큰 만료</label>
                        <div class="input-card">
                            <input type="text" v-model="refreshTtl" placeholder="예: 30d">
                        </div>

                        <div class="btn-group" style="margin-top:20px;">
                            <button class="btn-pos" :disabled="saving" @click="save">
                                {{ saving ? '저장 중...' : '💾 저장' }}
                            </button>
                            <button class="btn-neg" @click="emit('close')">뒤로</button>
                        </div>
                    </template>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
.hint-box {
    font-size: 12px;
    color: #666;
    margin-bottom: 15px;
    line-height: 1.6;
    background: #FFF8E1;
    border: 1px solid #ffe082;
    border-radius: 10px;
    padding: 12px 14px;
}
.badge-ok { color: #2E7D32; }
.badge-warn { color: #c62828; }
.row-label {
    display: block;
    font-weight: bold;
    color: #5D4037;
    margin: 12px 0 6px;
    font-size: 13px;
}
.input-card {
    border: 1px solid #ddd;
    border-radius: 10px;
    background: #fff;
    padding: 0;
    margin-bottom: 4px;
}
.input-card input {
    width: 100%;
    padding: 12px;
    border: none;
    background: transparent;
    font-size: 15px;
    font-family: 'Jua';
    color: #333;
    outline: none;
    text-align: center;
}
</style>
