<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useBoardStore } from '@/stores/board'
import { useApi } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'

const router = useRouter()
const auth = useAuthStore()
const board = useBoardStore()
const { callApi } = useApi()
const { showAppAlert } = usePopup()

const searchKeyword = ref('')
const posts = ref([])
const loading = ref(true)

onMounted(() => {
  openBoardMain()
})

function openBoardMain() {
  searchKeyword.value = ''
  board.currentBoardTab = 'all'
  loading.value = true

  callApi('/api/board/manage', { action: 'get' }, (r) => {
    if (r.success) {
      board.globalBoards = r.list
      loadPosts()
    }
  })
}

function selectTab(tabId) {
  board.currentBoardTab = tabId
  searchKeyword.value = ''
  loadPosts()
}

function executePostSearch() {
  const keyword = searchKeyword.value.trim()
  if (keyword.length < 2) return showAppAlert('검색어는 2글자 이상 입력해줘!')
  loadPosts(keyword)
}

function loadPosts(keyword = null) {
  loading.value = true
  posts.value = []

  callApi('/api/post/manage', {
    action: 'list',
    tab: board.currentBoardTab,
    boardId: board.currentBoardTab,
    keyword: keyword,
    sabun: auth.currentSabun
  }, (r) => {
    loading.value = false
    if (!r?.success) {
      const msg = r?.message || '글 목록을 불러오지 못했어'
      showAppAlert('⛔ ' + msg)
      return
    }
    posts.value = r.list || []
  })
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

function openPostDetail(postId) {
  router.push({ name: 'postDetail', params: { id: postId } })
}

function openPostWrite() {
  if (board.globalBoards.length === 0) return showAppAlert('게시판이 하나도 없어! 관리자에게 문의해줘.')
  router.push({ name: 'postWrite' })
}
</script>

<template>
  <div class="board-main-screen">
    <div class="header" style="margin-bottom: 10px;">
      <h3>📖 전도 노트</h3>
      <p>우리들의 노하우 창고</p>
    </div>

    <div class="search-bar">
      <input
        v-model="searchKeyword"
        type="text"
        class="input-card"
        style="margin: 0; flex: 1;"
        placeholder="제목, 내용 검색"
        @keypress.enter="executePostSearch"
      />
      <button class="btn-pos search-btn" @click="executePostSearch">🔍</button>
    </div>

    <div class="board-tab-container">
      <div
        class="board-tab-btn"
        :class="{ active: board.currentBoardTab === 'all' }"
        @click="selectTab('all')"
      >전체글</div>
      <div
        class="board-tab-btn"
        :class="{ active: board.currentBoardTab === 'best' }"
        @click="selectTab('best')"
      >🔥 인기글</div>
      <div
        class="board-tab-btn"
        :class="{ active: board.currentBoardTab === 'scrap' }"
        @click="selectTab('scrap')"
      >🔖 내 스크랩</div>
      <div
        v-for="b in board.globalBoards"
        :key="b.id"
        class="board-tab-btn"
        :class="{ active: board.currentBoardTab === b.id }"
        @click="selectTab(b.id)"
      >{{ b.name }}</div>
    </div>

    <div class="post-list-container" style="min-height: 300px;">
      <div v-if="loading" style="text-align: center; padding: 50px;">
        글을 불러오고 있어... ⏳
      </div>
      <div v-else-if="posts.length === 0" style="text-align: center; color: #888; padding: 50px;">
        작성된 글이 없어요 텅~ 💨
      </div>
      <template v-else>
        <div
          v-for="p in posts"
          :key="p.id"
          class="post-card"
          :class="{ notice: p.isNotice }"
          @click="openPostDetail(p.id)"
        >
          <div class="post-title">
            <span v-if="p.isNotice" class="post-badge" style="margin-right: 5px;">📌 공지</span>
            {{ p.title }}
            <span v-if="p.hasImage" class="post-has-image">📷 사진</span>
          </div>
          <div class="post-meta">
            <div class="post-meta-left">
              <span style="font-weight: bold; color: #5D4037;">{{ p.boardName || '기타' }}</span>
              <span>|</span>
              <span>{{ p.author }}</span>
              <span>|</span>
              <span>{{ formatTimeAgo(p.createdAtStr) }}</span>
            </div>
            <div class="post-meta-right">
              <span style="color: #FF5252;">❤️ {{ p.likeCount || 0 }}</span>
              <span style="color: #1976D2;">💬 {{ p.commentCount || 0 }}</span>
            </div>
          </div>
        </div>
      </template>
    </div>

    <button class="post-fab" @click="openPostWrite">✏️</button>
  </div>
</template>

<style scoped>
.search-bar {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
}

/* .btn-pos 의 flex:1 을 끄고 정사각 아이콘 버튼 크기로 고정 */
.search-btn {
  flex: 0 0 48px;
  width: 48px;
  height: 48px;
  padding: 0;
  margin: 0;
  border-radius: 10px;
  font-size: 18px;
}

.board-tab-container {
  display: flex;
  overflow-x: auto;
  gap: 10px;
  margin-bottom: 15px;
  padding-bottom: 5px;
}

.board-tab-btn {
  flex: 0 0 auto;
  padding: 10px 16px;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 20px;
  font-family: 'Jua';
  font-size: 14px;
  color: #555;
  cursor: pointer;
  transition: 0.2s;
  white-space: nowrap;
}

.board-tab-btn.active {
  background: var(--btn-color);
  color: white;
  border-color: var(--btn-color);
}

.post-card {
  background: #fff;
  padding: 15px;
  border-radius: 12px;
  margin-bottom: 12px;
  box-shadow: var(--shadow);
  border: 1px solid #eee;
  cursor: pointer;
  position: relative;
}

.post-card.notice {
  background: #FFFDE7;
  border: 1px solid #FFF59D;
}

.post-title {
  font-size: 16px;
  font-weight: bold;
  color: #333;
  margin-bottom: 8px;
  line-height: 1.4;
  display: flex;
  align-items: center;
  gap: 5px;
}

.post-meta {
  font-size: 12px;
  color: #888;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.post-meta-left {
  display: flex;
  gap: 8px;
  align-items: center;
}

.post-meta-right {
  display: flex;
  gap: 8px;
  align-items: center;
  font-weight: bold;
}

.post-badge {
  background: #FF5252;
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
}

.post-has-image {
  background: #E0E0E0;
  border-radius: 4px;
  padding: 2px 5px;
  font-size: 10px;
  color: #555;
}

.post-fab {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 60px;
  height: 60px;
  background: var(--accent-color);
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 24px;
  color: white;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
  cursor: pointer;
  z-index: 100;
  border: none;
}

.post-fab:active {
  transform: scale(0.95);
}
</style>
