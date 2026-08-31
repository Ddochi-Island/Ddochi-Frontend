<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useBoardStore } from '@/stores/board'
import { useApi, tokenStore } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'
import { useFormatters } from '@/composables/useFormatters'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const board = useBoardStore()
const { callApi } = useApi()
const { showAppAlert, showAppConfirm, showToast } = usePopup()
const { autoResize, copyText } = useFormatters()

const post = ref(null)
const isLiked = ref(false)
const isScraped = ref(false)
const likeCount = ref(0)
const comments = ref([])
const commentInput = ref('')
const commentSubmitting = ref(false)

const postId = computed(() => route.params.id)
const isAdmin = computed(() => auth.isAdmin)
const canDelete = computed(() => {
  if (!post.value) return false
  return isAdmin.value || String(post.value.sabun) === String(auth.currentSabun)
})

onMounted(() => {
  openPostDetail()
})

function openPostDetail() {
  callApi('/api/post/manage', {
    action: 'detail',
    sabun: auth.currentSabun,
    data: { postId: postId.value }
  }, (r) => {
    if (!r.success) {
      showAppAlert(r.message, () => router.push({ name: 'boardMain' }))
      return
    }
    post.value = r.post
    isLiked.value = r.isLiked
    isScraped.value = r.isScraped
    likeCount.value = r.post.likeCount || 0
    // ⚠️ board.viewerImages 는 글로벌 <ImageViewer /> 트리거 — 진입 시 자동 오픈 방지 위해
    // 여기서 set 하지 않음. 사용자가 인라인 이미지 탭하면 그때 set (openImageViewer 참조).
    loadComments()
  })
}

function openImageViewer(idx) {
  if (!post.value?.images?.length) return
  // 글로벌 ImageViewer 가 토큰 첨가된 URL 로 직접 fetch 하도록 미리 변환.
  board.viewerImages = post.value.images.map(withToken)
  board.viewerCurrentIdx = idx
}

function formatTimeAgo(dateObjOrString) {
  if (!dateObjOrString) return '방금 전'
  const date = new Date(dateObjOrString)
  if (isNaN(date.getTime())) return '방금 전'

  const now = new Date()
  const diffMs = now - date
  const diffMin = Math.floor(diffMs / (60 * 1000))

  if (diffMin < 1) return '방금 전'
  if (diffMin < 60) return `${diffMin}분 전`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}시간 전`

  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`
}

function formatCommentTime(c) {
  if (c.createdAt && c.createdAt._seconds) {
    return formatTimeAgo(new Date(c.createdAt._seconds * 1000))
  }
  return formatTimeAgo(c.createdAt)
}

function togglePostLike() {
  if (isLiked.value) {
    isLiked.value = false
    likeCount.value = Math.max(0, likeCount.value - 1)
  } else {
    isLiked.value = true
    likeCount.value += 1
  }

  callApi('/api/post/interact', {
    action: 'like',
    postId: postId.value,
    sabun: auth.currentSabun
  }, () => {})
}

function togglePostScrap() {
  if (isScraped.value) {
    isScraped.value = false
    showToast('스크랩 취소 🗑️')
  } else {
    isScraped.value = true
    showToast('내 스크랩에 담았어! 🔖')
  }

  callApi('/api/post/interact', {
    action: 'scrap',
    postId: postId.value,
    sabun: auth.currentSabun
  }, () => {})
}

function copyPostContent() {
  if (post.value) {
    copyText(post.value.content)
    showToast('본문 텍스트가 모두 복사되었어! 📋')
  }
}

function deletePost() {
  showAppConfirm('정말 이 글을 삭제할까? (복구 불가능!)', (yes) => {
    if (yes) {
      callApi('/api/post/manage', {
        action: 'delete',
        sabun: auth.currentSabun,
        data: { postId: postId.value }
      }, (r) => {
        showAppAlert(r.message, () => router.push({ name: 'boardMain' }))
      })
    }
  })
}

function loadComments() {
  callApi('/api/comment/manage', { action: 'list', postId: postId.value }, (r) => {
    if (r.success) {
      comments.value = r.list || []
    }
  })
}

function submitComment() {
  const content = commentInput.value.trim()
  if (!content) return

  commentSubmitting.value = true

  callApi('/api/comment/manage', {
    action: 'add',
    postId: postId.value,
    sabun: auth.currentSabun,
    content: content
  }, (r) => {
    commentSubmitting.value = false
    if (r.success) {
      commentInput.value = ''
      loadComments()
    }
  })
}

function deleteComment(commentId) {
  showAppConfirm('이 댓글을 삭제할까?', (yes) => {
    if (yes) {
      callApi('/api/comment/manage', {
        action: 'delete',
        commentId: commentId,
        postId: postId.value
      }, (r) => {
        if (r.success) loadComments()
      })
    }
  })
}

function canDeleteComment(c) {
  return isAdmin.value || String(c.sabun) === String(auth.currentSabun)
}

function goBack() {
  router.push({ name: 'boardMain' })
}

// `<img>` 태그는 Authorization 헤더를 보낼 수 없음.
// 정규 브라우저는 쿠키로 자동 인증되지만 (main middleware 가 cookie 도 읽음),
// Telegram WebApp 같이 쿠키 불안정한 환경에선 ?token= 쿼리 폴백 필요.
function withToken(url) {
  if (!url) return ''
  // 절대 URL (외부 / OCI direct) 면 그대로 — 토큰 노출 방지.
  if (/^https?:\/\//.test(url)) return url
  const t = tokenStore.getAccess()
  if (!t) return url
  return url + (url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(t)
}
</script>

<template>
  <div class="post-detail-screen">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
      <div
        v-if="post"
        class="detail-board-badge"
      >{{ post.boardName || '게시판' }}</div>
      <div v-else class="detail-board-badge"></div>
      <button
        class="btn-sm"
        style="background: none; color: #999; box-shadow: none; font-size: 24px; padding: 0;"
        @click="goBack"
      >✕</button>
    </div>

    <template v-if="post">
      <div class="post-detail-header">
        <div class="post-detail-title">{{ post.title }}</div>
        <div class="post-detail-info">
          <span>👤 {{ post.author }} ({{ post.authorTeam }})</span>
          <span>{{ formatTimeAgo(post.createdAtStr) }}</span>
        </div>
      </div>

      <!-- Images — 구분선 아래, 본문 위. lazy load + 클릭 시 글로벌 viewer 로 확대.
           ⚠️ post.images 직접 참조 (board.viewerImages 는 viewer 열 때만 set). -->
      <div v-if="post.images && post.images.length > 0" class="post-detail-images">
        <img
          v-for="(url, idx) in post.images"
          :key="idx"
          :src="withToken(url)"
          loading="lazy"
          decoding="async"
          @click="openImageViewer(idx)"
        />
      </div>

      <div class="post-detail-content">{{ post.content }}</div>

      <!-- Action buttons -->
      <div class="post-action-bar">
        <button
          class="post-action-btn"
          :class="{ liked: isLiked }"
          @click="togglePostLike"
        >
          <span>{{ isLiked ? '❤️' : '🤍' }}</span>
          <span>{{ likeCount }}</span>
        </button>
        <button
          class="post-action-btn"
          :class="{ scraped: isScraped }"
          @click="togglePostScrap"
        >
          <span>{{ isScraped ? '🏷️' : '🔖' }}</span>
          스크랩
        </button>
        <button
          class="post-action-btn"
          style="background: #EFEBE9; border-color: #EFEBE9;"
          @click="copyPostContent"
        >📋 본문복사</button>
      </div>

      <!-- Delete bar -->
      <div v-if="canDelete" style="text-align: right; margin-bottom: 20px;">
        <span
          style="color: #FF5252; font-size: 13px; font-weight: bold; cursor: pointer;"
          @click="deletePost"
        >🗑️ 이 글 삭제하기</span>
      </div>

      <!-- Comments -->
      <div class="comment-section">
        <div style="font-weight: bold; color: #5D4037; margin-bottom: 15px; font-size: 15px;">
          댓글 <span style="color: var(--accent-color);">{{ comments.length }}</span>개
        </div>

        <div class="comment-list">
          <div v-for="c in comments" :key="c.id" class="comment-item">
            <div class="comment-header">
              <span class="comment-author">{{ c.author }}</span>
              <div>
                <span>{{ formatCommentTime(c) }}</span>
                <span
                  v-if="canDeleteComment(c)"
                  style="color: #FF5252; cursor: pointer; margin-left: 10px;"
                  @click="deleteComment(c.id)"
                >삭제</span>
              </div>
            </div>
            <div class="comment-body">{{ c.content }}</div>
          </div>
        </div>

        <div class="comment-input-area">
          <textarea
            v-model="commentInput"
            class="comment-input auto-resize-box"
            placeholder="따뜻한 댓글을 남겨주세요!"
            @input="autoResize($event.target)"
          ></textarea>
          <button
            class="comment-submit-btn"
            :disabled="commentSubmitting"
            @click="submitComment"
          >등록</button>
        </div>
      </div>
    </template>

    <div v-else style="text-align: center; padding: 50px;">
      불러오는 중...
    </div>

  </div>
</template>

<style scoped>
.post-detail-screen {
  background: #fff;
  min-height: 100vh;
  padding: 20px;
  border-radius: 20px 20px 0 0;
}

.detail-board-badge {
  font-size: 12px;
  background: #EFEBE9;
  padding: 4px 10px;
  border-radius: 12px;
  color: #5D4037;
  font-weight: bold;
}

.post-detail-header {
  border-bottom: 1px solid #eee;
  padding-bottom: 15px;
  margin-bottom: 15px;
}

.post-detail-title {
  font-size: 22px;
  font-weight: bold;
  color: var(--btn-color);
  margin-bottom: 10px;
  line-height: 1.3;
}

.post-detail-info {
  font-size: 13px;
  color: #888;
  display: flex;
  justify-content: space-between;
}

.post-detail-content {
  font-family: 'Noto Sans KR', sans-serif;
  font-size: 15px;
  line-height: 1.6;
  color: #333;
  white-space: pre-wrap;
  word-break: break-all;
  margin-bottom: 30px;
}

/* 글 맨 위 인라인 첨부. 컨테이너 폭에 맞추고 비율은 그대로. */
.post-detail-images {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.post-detail-images img {
  width: 100%;
  height: auto;
  border-radius: 10px;
  border: 1px solid #eee;
  display: block;
  cursor: zoom-in;
  transition: transform 0.12s;
}
.post-detail-images img:active {
  transform: scale(0.99);
}

.post-action-bar {
  display: flex;
  justify-content: center;
  gap: 15px;
  margin-bottom: 30px;
  padding-top: 15px;
  border-top: 1px dashed #eee;
}

.post-action-btn {
  padding: 10px 20px;
  border-radius: 25px;
  font-size: 14px;
  font-family: 'Jua';
  cursor: pointer;
  border: 1px solid #ddd;
  background: #fff;
  color: #555;
  display: flex;
  align-items: center;
  gap: 5px;
  transition: 0.2s;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
}

.post-action-btn.liked {
  color: #FF5252;
  border-color: #FF5252;
  background: #FFEBEE;
}

.post-action-btn.scraped {
  color: #1976D2;
  border-color: #1976D2;
  background: #E3F2FD;
}

/* Comments */
.comment-section {
  background: #fafafa;
  border-radius: 12px;
  padding: 15px;
  margin-bottom: 20px;
}

.comment-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 15px;
}

.comment-item {
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
}

.comment-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.comment-header {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #888;
  margin-bottom: 5px;
}

.comment-author {
  font-weight: bold;
  color: #5D4037;
}

.comment-body {
  font-family: 'Noto Sans KR', sans-serif;
  font-size: 14px;
  color: #333;
  line-height: 1.4;
  white-space: pre-wrap;
}

.comment-input-area {
  display: flex;
  gap: 10px;
  align-items: flex-end;
}

.comment-input {
  flex: 1;
  min-height: 45px;
  max-height: 100px;
  border: 1px solid #ddd;
  border-radius: 10px;
  padding: 10px;
  font-family: 'Noto Sans KR', sans-serif;
  font-size: 14px;
  resize: none;
  outline: none;
}

.comment-submit-btn {
  background: var(--btn-color);
  color: white;
  border: none;
  border-radius: 10px;
  padding: 0 15px;
  height: 45px;
  font-family: 'Jua';
  cursor: pointer;
  font-size: 14px;
}

.auto-resize-box {
  overflow-y: hidden;
  resize: none;
  min-height: 80px;
}

</style>
