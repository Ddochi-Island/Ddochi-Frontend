<script setup>
import { inject } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useVisibleGuides } from "@/composables/useGuides";

const router = useRouter();
const auth = useAuthStore();
const openSidebar = inject("openSidebar");
const guides = useVisibleGuides(); // 볼 수 있는 가이드가 없으면 버튼 숨김

function handleSmartBack() {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push({ name: "home" });
  }
}

function goHome() {
  router.push({ name: "home" });
}
</script>

<template>
  <div class="top-nav">
    <div class="nav-info">
      {{ auth.currentUserTeam || "" }}지역 {{ auth.currentUserArea || "" }}구역
      {{ auth.currentUserName || "" }}
    </div>
    <div class="nav-actions">
      <button class="nav-btn" @click="handleSmartBack">뒤로</button>
      <button v-if="Object.keys(guides).length" class="nav-btn" aria-label="사용 가이드" @click="router.push({ name: 'guide' })">📖 가이드</button>
      <button class="nav-btn" @click="goHome">홈</button>
      <button
        class="nav-btn nav-btn-menu"
        style="font-size: 16px; padding: 2px 8px; font-weight: bold"
        @click="openSidebar"
      >
        ⚙️
      </button>
    </div>
  </div>
</template>
