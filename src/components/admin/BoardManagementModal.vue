<script setup>
// AdminScreen 의 '📖 전도 노트 게시판 관리' modal.
// BOARDS 는 전역 — admin 만 추가/삭제 가능. 그 외 사용자는 GET 만.
// legacy server.js:4241-4263 + index.html:12891-12933 패턴.

import { ref, onMounted } from 'vue'
import { useApi } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'

const emit = defineEmits(['close'])

const { callApi } = useApi()
const { showAppAlert, showAppConfirm, showToast } = usePopup()

const list = ref([])
const loading = ref(true)
const errorMsg = ref('')
const newName = ref('')

function load() {
    loading.value = true
    errorMsg.value = ''
    callApi('/api/board/manage', { action: 'get' }, (r) => {
        loading.value = false
        if (!r?.success) {
            errorMsg.value = '게시판 목록을 불러오지 못했어'
            return
        }
        list.value = r.list || []
    })
}

function addBoard() {
    const name = newName.value.trim()
    if (!name) return showAppAlert('게시판 이름을 입력해줘!')
    callApi('/api/board/manage', { action: 'add', boardName: name }, (r) => {
        if (!r?.success) {
            showAppAlert('⛔ 추가 실패: ' + (r?.message || '알 수 없는 에러'))
            return
        }
        newName.value = ''
        showToast(r.message || '✅ 게시판 추가됨')
        load()
    })
}

function deleteBoard(b) {
    showAppConfirm(`'${b.name}' 게시판을 삭제할까? (게시글은 지워지지 않지만 보드 연결이 끊겨)`, (yes) => {
        if (!yes) return
        callApi('/api/board/manage', { action: 'delete', boardId: b.id }, (r) => {
            if (!r?.success) {
                showAppAlert('⛔ 삭제 실패: ' + (r?.message || '알 수 없는 에러'))
                return
            }
            showToast(r.message || '✅ 게시판 삭제됨')
            load()
        })
    })
}

function onEnter(e) {
    // 한글 IME composition 중에는 Enter 가 두 번 잡힐 수 있어 isComposing 체크
    if (e.isComposing) return
    addBoard()
}

onMounted(load)
</script>

<template>
    <Teleport to="body">
        <div class="modal-overlay" @click.self="emit('close')">
            <div class="modal-card" style="height:auto; max-height:85vh; padding:0;">
                <div class="modal-header-sticky">
                    <div class="modal-title" style="margin:0;">📖 전도 노트 게시판 관리</div>
                    <span class="modal-close-sticky" @click="emit('close')">×</span>
                </div>

                <div class="modal-content-scroll" style="padding:20px;">
                    <div class="bm-info">전역 게시판 — 관리자만 추가/삭제. 삭제는 soft delete (기존 글은 보존).</div>

                    <div v-if="loading" style="text-align:center; padding:30px; color:#888;">불러오는 중... ⏳</div>
                    <div v-else-if="errorMsg" style="text-align:center; padding:20px; color:red;">{{ errorMsg }}</div>

                    <div v-else class="bm-list">
                        <div v-if="list.length === 0" style="text-align:center; color:#888; padding:20px;">
                            생성된 게시판이 없어!
                        </div>
                        <div v-for="b in list" :key="b.id" class="bm-row">
                            <span class="bm-name">{{ b.name }}</span>
                            <button class="bm-btn-delete" @click="deleteBoard(b)">🗑</button>
                        </div>
                    </div>

                    <div class="bm-add-area">
                        <div class="bm-form-title">📖 새 게시판 추가</div>
                        <div class="bm-add-row">
                            <input
                                v-model="newName"
                                type="text"
                                class="input-card bm-input"
                                placeholder="새 게시판 이름"
                                maxlength="50"
                                @keydown.enter="onEnter"
                            />
                            <button class="btn-pos bm-add-btn" @click="addBoard">추가</button>
                        </div>
                    </div>

                    <div class="btn-group" style="margin-top:15px;">
                        <button class="btn-neg" @click="emit('close')">뒤로가기</button>
                    </div>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
.bm-info {
    font-size: 12px;
    color: #666;
    text-align: center;
    margin-bottom: 12px;
}

.bm-list {
    margin-bottom: 20px;
}
.bm-row {
    background: #fff;
    padding: 10px 12px;
    border-radius: 8px;
    margin-bottom: 6px;
    box-shadow: 0 1px 2px rgba(0,0,0,0.06);
    display: grid;
    grid-template-columns: 1fr 40px;
    align-items: center;
    gap: 8px;
    min-height: 44px;
}
.bm-name {
    font-weight: bold;
    font-size: 16px;
    color: #333;
    text-align: left;
    word-break: break-all;
    line-height: 1.25;
}
.bm-btn-delete {
    border: none;
    border-radius: 6px;
    padding: 6px 10px;
    cursor: pointer;
    font-size: 16px;
    font-family: inherit;
    background: #F44336;
    color: white;
    transition: 0.15s;
}
.bm-btn-delete:hover { background: #D32F2F; }

.bm-add-area {
    background: #FAFAFA;
    padding: 15px;
    border-radius: 10px;
    border: 1px solid #eee;
    text-align: left;
}
.bm-form-title {
    font-size: 14px;
    font-weight: bold;
    color: #5D4037;
    margin-bottom: 12px;
}
.bm-add-row {
    display: flex;
    gap: 8px;
    align-items: center;
}
.bm-input {
    margin: 0;
    flex: 1;
}
.bm-add-btn {
    padding: 10px 18px;
    border-radius: 10px;
    flex-shrink: 0;
}
</style>
