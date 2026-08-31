<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useBoardStore } from '@/stores/board'
import { useApi } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'
import { useFormatters } from '@/composables/useFormatters'

const router = useRouter()
const auth = useAuthStore()
const board = useBoardStore()
const { callApi, callApiMultipart } = useApi()
const { showAppAlert, showPopup, closePopup } = usePopup()
const { autoResize } = useFormatters()

const selectedBoardId = ref('')
const writeTitle = ref('')
const writeContent = ref('')
const isNotice = ref(false)
const currentPostImages = ref([])
const submitting = ref(false)
const fileInput = ref(null)

const isAdmin = computed(() => auth.isAdmin)

onMounted(() => {
  if (board.globalBoards.length === 0) {
    showAppAlert('게시판이 하나도 없어! 관리자에게 문의해줘.', () => {
      router.push({ name: 'boardMain' })
    })
    return
  }
  selectedBoardId.value = board.globalBoards[0]?.id || ''
})

function triggerFileInput() {
  fileInput.value?.click()
}

async function handleImageSelect(e) {
  const files = Array.from(e.target.files)
  if (files.length + currentPostImages.value.length > 3) {
    return showAppAlert('사진은 최대 3장까지만 올릴 수 있어! 📸')
  }

  showPopup('custom', '사진 업로드 중...', '', null, {
    html: '<div style="text-align:center;padding:20px;">사진을 압축 + 업로드하고 있어... ⏳</div>'
  })

  for (const file of files) {
    try {
      const base64 = await compressImage(file)
      // dataURL → Blob → multipart 업로드 → storage_id 수령.
      // 미리보기는 base64 그대로 (서버 왕복 안 하고 즉시 보임).
      const blob = await (await fetch(base64)).blob()
      const fd = new FormData()
      fd.append('files', blob, `image-${Date.now()}.jpg`)
      const id = await new Promise((resolve, reject) => {
        callApiMultipart('/api/storage/upload', fd, (r) => {
          if (r?.success && Array.isArray(r.ids) && r.ids[0]) resolve(r.ids[0])
          else reject(new Error(r?.message || '업로드 실패'))
        })
      })
      currentPostImages.value.push({ id, preview: base64 })
    } catch (err) {
      console.error(err)
      showAppAlert('이미지 업로드 실패: ' + (err.message || err))
    }
  }

  closePopup()
  e.target.value = ''
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (e) => {
      const img = new Image()
      img.src = e.target.result
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX_WIDTH = 800
        let width = img.width
        let height = img.height

        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width
          width = MAX_WIDTH
        }
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)

        const dataUrl = canvas.toDataURL('image/jpeg', 0.6)
        resolve(dataUrl)
      }
      img.onerror = (error) => reject(error)
    }
    reader.onerror = (error) => reject(error)
  })
}

function removeWriteImage(idx) {
  currentPostImages.value.splice(idx, 1)
}

function submitPost() {
  if (!writeTitle.value.trim() || !writeContent.value.trim()) {
    return showAppAlert('제목과 내용을 모두 적어줘!')
  }

  submitting.value = true

  const selBoard = board.globalBoards.find((b) => b.id === selectedBoardId.value)
  const boardName = selBoard ? selBoard.name : ''

  const payload = {
    boardId: selectedBoardId.value,
    boardName: boardName,
    title: writeTitle.value.trim(),
    content: writeContent.value.trim(),
    images: currentPostImages.value.map((im) => im.id),
    isNotice: isNotice.value
  }

  callApi('/api/post/manage', { action: 'create', sabun: auth.currentSabun, data: payload }, (r) => {
    submitting.value = false
    if (r.success) {
      showAppAlert('글 등록 완료! ✨', () => {
        router.push({ name: 'boardMain' })
      })
    }
  })
}

function goBack() {
  router.push({ name: 'boardMain' })
}
</script>

<template>
  <div class="post-write-screen">
    <div class="header">
      <h3>📝 글쓰기</h3>
    </div>

    <label>게시판 선택</label>
    <div class="input-card" style="margin-bottom: 15px;">
      <select v-model="selectedBoardId" style="padding: 0;">
        <option v-for="b in board.globalBoards" :key="b.id" :value="b.id">{{ b.name }}</option>
      </select>
    </div>

    <label>제목</label>
    <div class="input-card" style="margin-bottom: 15px;">
      <input v-model="writeTitle" type="text" placeholder="제목을 입력하세요" />
    </div>

    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 15px; margin-bottom: 5px;">
      <label style="margin: 0;">내용</label>
      <label
        v-if="isAdmin"
        style="margin: 0; cursor: pointer; display: flex; align-items: center; font-size: 14px; color: #E65100;"
      >
        <input v-model="isNotice" type="checkbox" style="width: auto; margin-right: 5px;" />
        📌 공지로 등록
      </label>
    </div>

    <button
      class="btn-sm"
      style="background: #EFEBE9; color: #5D4037; box-shadow: none; margin-bottom: 10px; display: flex; align-items: center; gap: 5px;"
      @click="triggerFileInput"
    >
      📷 사진 첨부하기 (최대 3장)
    </button>
    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      multiple
      style="display: none;"
      @change="handleImageSelect"
    />

    <div class="write-img-preview">
      <div v-for="(im, idx) in currentPostImages" :key="idx" class="write-img-box">
        <img :src="im.preview" />
        <div class="write-img-del" @click="removeWriteImage(idx)">✕</div>
      </div>
    </div>

    <div class="input-card" style="padding: 0;">
      <textarea
        v-model="writeContent"
        class="auto-resize-box"
        style="min-height: 250px; padding: 15px; font-family: 'Noto Sans KR', sans-serif;"
        placeholder="자유롭게 작성해주세요!"
        @input="autoResize($event.target)"
      ></textarea>
    </div>

    <div class="btn-group" style="margin-top: 20px;">
      <button class="btn-pos" :disabled="submitting" @click="submitPost">
        {{ submitting ? '등록 중...' : '등록하기' }}
      </button>
      <button class="btn-neg" @click="goBack">취소</button>
    </div>
  </div>
</template>

<style scoped>
.write-img-preview {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  margin-bottom: 15px;
  padding-bottom: 5px;
}

.write-img-box {
  position: relative;
  width: 80px;
  height: 80px;
  flex: 0 0 auto;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #ddd;
}

.write-img-box img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.write-img-del {
  position: absolute;
  top: 2px;
  right: 2px;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 12px;
  cursor: pointer;
}

.auto-resize-box {
  overflow-y: hidden;
  resize: none;
  min-height: 80px;
}
</style>
