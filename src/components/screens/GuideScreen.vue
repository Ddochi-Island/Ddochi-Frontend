<script setup>
// 사용 가이드 — 주제별 단계 카드(튜토리얼). 주제·보이는 직책은 composables/useGuides.js에.
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useVisibleGuides } from '@/composables/useGuides'

const router = useRouter()
const route = useRoute()

const GUIDES = useVisibleGuides()
const topic = computed(() => GUIDES.value[route.query.topic] || null)
const index = ref(0)
const step = computed(() => topic.value?.steps[index.value])
const isLast = computed(() => topic.value && index.value === topic.value.steps.length - 1)

function go(i) {
    if (!topic.value) return
    index.value = Math.max(0, Math.min(topic.value.steps.length - 1, i))
}
function openTopic(key) {
    index.value = 0
    router.replace({ name: 'guide', query: { topic: key } })
}
function back() {
    if (topic.value) router.replace({ name: 'guide' })
    else router.back()
}
function onKey(e) {
    if (!topic.value) return
    if (e.key === 'ArrowRight') go(index.value + 1)
    if (e.key === 'ArrowLeft') go(index.value - 1)
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
    <div class="screen guide">
        <div class="guide-top">
            <button class="guide-back" @click="back">← {{ topic ? '가이드 목록' : '뒤로' }}</button>
        </div>

        <!-- 주제 목록 -->
        <template v-if="!topic">
            <h2 class="guide-h">📖 사용 가이드</h2>
            <p class="guide-sub">따라 하면 끝나는 단계별 안내예요.</p>
            <p v-if="!Object.keys(GUIDES).length" class="guide-sub">지금 볼 수 있는 가이드가 아직 없어요.</p>
            <button v-for="(g, key) in GUIDES" :key="key" class="guide-topic" @click="openTopic(key)">
                <span class="guide-topic-icon">{{ g.icon }}</span>
                <span>
                    <span class="guide-topic-title">{{ g.title }}</span>
                    <span class="guide-topic-desc">{{ g.summary }}</span>
                </span>
            </button>
        </template>

        <!-- 단계 카드 -->
        <template v-else>
            <h2 class="guide-h">{{ topic.icon }} {{ topic.title }}</h2>
            <div class="guide-progress" role="tablist" :aria-label="`${topic.steps.length}단계 중 ${index + 1}단계`">
                <button v-for="(s, i) in topic.steps" :key="i" role="tab" :aria-selected="i === index"
                        :aria-label="`${i + 1}단계: ${s.title}`"
                        :class="['guide-dot', i === index ? 'on' : '', i < index ? 'done' : '']" @click="go(i)"></button>
            </div>

            <article class="guide-card" :key="index">
                <div class="guide-step-no">{{ index + 1 }} / {{ topic.steps.length }}</div>
                <h3 class="guide-step-title">{{ step.title }}</h3>
                <p v-for="(line, i) in step.body" :key="i" class="guide-line">{{ line }}</p>
                <ul v-if="step.list" class="guide-list">
                    <li v-for="(li, i) in step.list" :key="i">{{ li }}</li>
                </ul>

                <!-- 실제 화면 모양(작은 그림) -->
                <div v-if="step.mock" class="guide-mock" aria-hidden="true">
                    <!-- 데이터로 그리는 그림: [{ t, kind: hl|ok|muted|head|me|bot|wide, btn: [..] }] -->
                    <template v-if="Array.isArray(step.mock)">
                        <div v-for="(r, i) in step.mock" :key="i"
                             :class="r.kind === 'me' || r.kind === 'bot' ? ['mk-bubble', r.kind] : r.kind === 'wide' ? 'mk-btn-wide' : r.kind === 'muted' ? 'mk-muted' : ['mk-row', r.kind ? 'mk-' + r.kind : '']">
                            <span>{{ r.t }}</span>
                            <span v-for="b in (r.btn || [])" :key="b" class="mk-btn">{{ b }}</span>
                        </div>
                    </template>
                    <template v-else-if="step.mock === 'bot'">
                        <div class="mk-search">🔍 <b>@logDdochi_Bot</b></div>
                        <div class="mk-row"><span class="mk-avatar">🤖</span> 기록이 <span class="mk-muted">@logDdochi_Bot</span> <span class="mk-btn">초대</span></div>
                    </template>
                    <template v-else-if="step.mock === 'admin'">
                        <div class="mk-row mk-head">⚙️ 메뉴</div>
                        <div class="mk-row">🏆 주간 점수제</div>
                        <div class="mk-row mk-hl">👑 사명의 길 (관리자)</div>
                        <div class="mk-row mk-muted">🔒 비밀번호 입력</div>
                    </template>
                    <template v-else-if="step.mock === 'tabs'">
                        <div class="mk-btn-wide">💬 텔레그램 연결</div>
                        <div class="mk-tabs"><span>1</span><span>2</span><span>3</span><span class="on">4</span><span>5</span><span>6</span><span class="v">135 연합</span></div>
                    </template>
                    <template v-else-if="step.mock === 'pair'">
                        <div class="mk-row">매칭현황판 <span class="mk-muted">미연결</span> <span class="mk-btn">연결</span></div>
                        <div class="mk-row mk-hl"><code>/pair@logDdochi_Bot AB12CD34</code> <span class="mk-btn">📋 복사</span></div>
                        <div class="mk-muted">⏳ 방에 명령어를 붙여넣으면 자동으로 등록돼</div>
                    </template>
                    <template v-else-if="step.mock === 'chat'">
                        <div class="mk-bubble me"><code>/pair@logDdochi_Bot AB12CD34</code></div>
                        <div class="mk-bubble bot">📢 4지역 매칭 현황판<br><span class="mk-muted">(연결되자마자 첫 판이 올라와요)</span></div>
                    </template>
                    <template v-else-if="step.mock === 'done'">
                        <div class="mk-row mk-ok">매칭현황판 ✅ [4지역] 만남취합창 <span class="mk-btn">🔄 재연결</span> <span class="mk-btn red">해제</span></div>
                    </template>
                </div>

                <p v-if="step.tip" class="guide-tip">💡 {{ step.tip }}</p>
            </article>

            <div class="guide-nav">
                <button class="guide-nav-btn ghost" :disabled="index === 0" @click="go(index - 1)">← 이전</button>
                <button v-if="!isLast" class="guide-nav-btn" @click="go(index + 1)">다음 →</button>
                <button v-else class="guide-nav-btn" @click="back">다 했어요 🎉</button>
            </div>
        </template>
    </div>
</template>

<style scoped>
.guide { max-width: 560px; margin: 0 auto; padding: 16px; }
.guide-top { margin-bottom: 8px; }
.guide-back { background: none; border: none; color: var(--btn-color); font-family: 'Jua'; font-size: 15px; cursor: pointer; padding: 6px 0; }
.guide-h { margin: 4px 0 6px; font-size: 22px; color: var(--text-color); }
.guide-sub { margin: 0 0 16px; color: #8D6E63; }

.guide-topic { display: flex; gap: 12px; align-items: flex-start; width: 100%; text-align: left; background: var(--card-bg);
    border: 1px solid #EFE3D3; border-radius: 14px; padding: 14px; box-shadow: var(--shadow); cursor: pointer; font-family: 'Jua'; color: var(--text-color); }
.guide-topic-icon { font-size: 28px; line-height: 1; }
.guide-topic-title { display: block; font-size: 17px; margin-bottom: 4px; }
.guide-topic-desc { display: block; font-size: 13px; color: #8D6E63; line-height: 1.5; }

.guide-progress { display: flex; gap: 6px; margin: 10px 0 14px; }
.guide-dot { flex: 1; height: 6px; border: none; border-radius: 3px; background: #EFE3D3; cursor: pointer; padding: 0; }
.guide-dot.done { background: #C8A97E; }
.guide-dot.on { background: var(--btn-color); }

.guide-card { background: var(--card-bg); border-radius: 16px; padding: 18px; box-shadow: var(--shadow); animation: guide-in .18s ease-out; }
@keyframes guide-in { from { opacity: 0; transform: translateX(8px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .guide-card { animation: none; } }
.guide-step-no { font-size: 12px; color: #A1887F; margin-bottom: 4px; }
.guide-step-title { margin: 0 0 10px; font-size: 19px; color: var(--text-color); }
.guide-line { margin: 0 0 6px; line-height: 1.6; color: #5D4037; }
.guide-list { margin: 6px 0 0; padding-left: 20px; line-height: 1.7; color: #5D4037; }
.guide-tip { margin: 12px 0 0; padding: 10px 12px; background: #FFF8E1; border-radius: 10px; font-size: 13px; line-height: 1.6; color: #6D4C41; }

.guide-mock { margin-top: 12px; padding: 12px; background: #F7F2EC; border: 1px dashed #D7C4AE; border-radius: 12px;
    display: flex; flex-direction: column; gap: 8px; font-size: 13px; }
.mk-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; background: #fff; border-radius: 8px; padding: 8px 10px; }
.mk-head { background: #FFF3E0; }
.mk-hl { outline: 2px solid #FFB74D; }
.mk-ok { background: #E8F5E9; }
.mk-muted { color: #A1887F; }
.mk-btn { margin-left: auto; background: var(--btn-color); color: #fff; border-radius: 6px; padding: 3px 8px; font-size: 12px; }
.mk-btn + .mk-btn { margin-left: 4px; }
.mk-btn.red { background: #E57373; }
.mk-btn-wide { background: #1976D2; color: #fff; border-radius: 8px; padding: 8px; text-align: center; }
.mk-search { background: #fff; border-radius: 20px; padding: 8px 12px; }
.mk-avatar { font-size: 18px; }
.mk-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
.mk-tabs span { background: #fff; border-radius: 14px; padding: 4px 10px; }
.mk-tabs .on { background: var(--btn-color); color: #fff; }
.mk-tabs .v { border: 1px dashed #B39DDB; }
.mk-bubble { max-width: 85%; border-radius: 12px; padding: 8px 10px; }
.mk-bubble.me { align-self: flex-end; background: #DCF8C6; }
.mk-bubble.bot { align-self: flex-start; background: #fff; }
.guide-mock code { font-size: 12px; word-break: break-all; }

.guide-nav { display: flex; gap: 10px; margin-top: 14px; }
.guide-nav-btn { flex: 1; padding: 13px; border: none; border-radius: 12px; background: var(--btn-color); color: #fff; font-family: 'Jua'; font-size: 16px; cursor: pointer; }
.guide-nav-btn.ghost { background: #EFE3D3; color: var(--btn-color); }
.guide-nav-btn:disabled { opacity: .4; cursor: default; }
.guide-nav-btn:focus-visible, .guide-dot:focus-visible, .guide-topic:focus-visible, .guide-back:focus-visible { outline: 3px solid #FFB74D; outline-offset: 2px; }
</style>
