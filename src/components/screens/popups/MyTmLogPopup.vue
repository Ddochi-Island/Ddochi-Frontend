<script setup>
// 합당한자 화면 "내 티엠 내역" — 고른 날(기본 오늘) 내가 돌린 통화를 로그 표로 보여주고, 체크한 줄만 [티엠 결과] 보고 양식으로 복사
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useApi } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'

const emit = defineEmits(['close'])
const { callApiPromise } = useApi()
const { showToast } = usePopup()

const date = ref('')  // 비우고 부르면 서버가 가장 최근에 티엠 돌린 날로 채움
const days = ref([])  // 드롭다운 — 티엠 돌린 날만 [{ date, count }], 최근 90일
const list = ref([])
const loading = ref(false)
const error = ref('')

async function load() {
    loading.value = true
    error.value = ''
    const r = await callApiPromise('/api/shed/my-tm-log', { date: date.value })
    loading.value = false
    if (!r?.success) { error.value = r?.message || '불러오지 못했어요. 잠시 뒤 다시 열어 주세요.'; list.value = []; return }
    days.value = r.days || []
    date.value = r.date
    list.value = r.list || []
    picked.value = new Set(list.value.map((_, i) => i))  // 새로 불러오면 전부 선택
}
const picked = ref(new Set())
function toggle(i) {
    const s = new Set(picked.value)
    s.has(i) ? s.delete(i) : s.add(i)
    picked.value = s
}
const allPicked = computed(() => list.value.length > 0 && picked.value.size === list.value.length)
function toggleAll() { picked.value = allPicked.value ? new Set() : new Set(list.value.map((_, i) => i)) }

// 결과 뒤 괄호: 거절/비합 사유, 예약 티엠 시각, 부재중 문자 발송 여부
function resultText(x) {
    const extra = x.reservedAt || x.subReason || (x.noAnswerMsg ? '부재중 문자 발송' : '')
    return extra ? `${x.result}(${extra})` : x.result
}
const WEEK = ['일', '월', '화', '수', '목', '금', '토']
function dayLabel(ymd) {
    const [y, m, d] = ymd.split('-').map(Number)
    return `${m}/${d}(${WEEK[new Date(y, m - 1, d).getDay()]})`
}
const timeOf = (iso) => new Date(iso).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false })
const rows = computed(() => list.value.map((x) => ({ time: timeOf(x.at), name: x.name, type: x.type, result: resultText(x), kind: x.result })))
// 복사용 — 단톡 [티엠 결과] 보고 양식. 활동시간 = 고른 통화 중 첫 시각~마지막 시각
const text = computed(() => {
    const sel = rows.value.filter((_, i) => picked.value.has(i))
    return [
        '[티엠 결과]', '',
        `활동시간 : ${sel.length ? `${sel[0].time}-${sel[sel.length - 1].time}` : '00-00'}`, '',
        `티엠수 ${sel.length}건`,
        '섭외자/섭외유형/티엠결과',
        ...sel.map((r) => `- ${r.name}/${r.type}/${r.result}`),
    ].join('\n')
})
const KIND = { '부재중': 'na', '예약 티엠': 'rsv', '만남 픽스': 'fix', '거절': 'bad', '비합': 'bad', '무효': 'bad' }

function copy() {
    navigator.clipboard.writeText(text.value).catch(() => {})
    showToast('📋 티엠 내역 복사됨')
}
// 날짜 드롭다운 — 기본 <select> 목록은 OS 메뉴(맥은 검정)로 떠서 앱 색과 안 맞아 직접 그림. ↑↓ Enter Esc 지원
const menuOpen = ref(false)
const activeIdx = ref(0)
const pickRef = ref(null)
const menuRef = ref(null)
const currentDay = computed(() => days.value.find((d) => d.date === date.value))
async function openMenu() {
    if (!days.value.length) return
    activeIdx.value = Math.max(0, days.value.findIndex((d) => d.date === date.value))
    menuOpen.value = true
    await nextTick()
    menuRef.value?.focus()
    menuRef.value?.children[activeIdx.value]?.scrollIntoView({ block: 'nearest' })
}
function closeMenu() { menuOpen.value = false }
function pickDay(d) {
    closeMenu()
    pickRef.value?.querySelector('button')?.focus()
    if (d !== date.value) { date.value = d; load() }
}
function onMenuKey(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        activeIdx.value = (activeIdx.value + (e.key === 'ArrowDown' ? 1 : -1) + days.value.length) % days.value.length
        menuRef.value?.children[activeIdx.value]?.scrollIntoView({ block: 'nearest' })
    } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        pickDay(days.value[activeIdx.value].date)
    } else if (e.key === 'Escape' || e.key === 'Tab') {
        closeMenu()
    }
}
function onDocDown(e) { if (menuOpen.value && !pickRef.value?.contains(e.target)) closeMenu() }
onMounted(() => { load(); document.addEventListener('mousedown', onDocDown) })
onUnmounted(() => document.removeEventListener('mousedown', onDocDown))
</script>

<template>
    <div class="modal-overlay" @click.self="emit('close')">
        <div class="modal-card tl-modal" role="dialog" aria-label="내 티엠 내역">
            <span class="modal-close" @click="emit('close')">&times;</span>
            <div class="modal-title">📋 내 티엠 내역</div>
            <div class="tl-bar">
                <div ref="pickRef" class="tl-pick">
                    <button type="button" class="tl-date" aria-haspopup="listbox" :aria-expanded="menuOpen" aria-label="티엠 돌린 날"
                            :disabled="!days.length" @click="menuOpen ? closeMenu() : openMenu()" @keydown.down.prevent="openMenu">
                        <span>{{ currentDay ? `${dayLabel(currentDay.date)} - 티엠수 ${currentDay.count}건` : '티엠 기록 없음' }}</span>
                        <span class="tl-caret" :class="{ up: menuOpen }" aria-hidden="true">▾</span>
                    </button>
                    <ul v-if="menuOpen" ref="menuRef" class="tl-menu" role="listbox" tabindex="-1" :aria-activedescendant="`tl-day-${activeIdx}`" @keydown="onMenuKey">
                        <li v-for="(d, i) in days" :id="`tl-day-${i}`" :key="d.date" role="option" :aria-selected="d.date === date"
                            :class="{ on: d.date === date, active: i === activeIdx }" @mouseenter="activeIdx = i" @click="pickDay(d.date)">
                            <span class="tl-day">{{ dayLabel(d.date) }}</span>
                            <span class="tl-n">티엠수 {{ d.count }}건</span>
                        </li>
                    </ul>
                </div>
                <button class="tl-copy" :disabled="loading || !picked.size" @click="copy">{{ picked.size }}건 복사</button>
            </div>
            <p v-if="loading" class="tl-empty">불러오는 중…</p>
            <p v-else-if="error" class="tl-error">{{ error }}</p>
            <p v-else-if="!list.length" class="tl-empty">최근 90일 동안 돌린 티엠이 없어요.</p>
            <template v-else>
                <div class="tl-count">티엠수 <b>{{ rows.length }}</b>건 · 복사할 줄을 체크하세요</div>
                <div class="tl-log">
                    <table class="tl-table">
                        <thead><tr><th scope="col" class="c"><input type="checkbox" :checked="allPicked" aria-label="전체 선택" @change="toggleAll"></th><th scope="col">시간</th><th scope="col">섭외자</th><th scope="col">유형</th><th scope="col">티엠결과</th></tr></thead>
                        <tbody>
                            <tr v-for="(r, i) in rows" :key="i" :class="['k-' + (KIND[r.kind] || 'etc'), { off: !picked.has(i) }]" @click="toggle(i)">
                                <td class="c"><input type="checkbox" :checked="picked.has(i)" :aria-label="`${r.time} ${r.name} 선택`" @click.stop @change="toggle(i)"></td>
                                <td class="t">{{ r.time }}</td><td>{{ r.name }}</td><td>{{ r.type }}</td><td class="res">{{ r.result }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </template>
        </div>
    </div>
</template>

<style scoped>
.tl-modal { max-width: 420px; }
.tl-bar { display: flex; gap: 8px; margin: 8px 0 10px; }
.tl-pick { flex: 1; min-width: 0; position: relative; }
.tl-date { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 12px;
    border: 1px solid #c5e1a5; border-radius: 8px; font: inherit; background: #fff; color: #33691e; cursor: pointer; text-align: left; }
.tl-date:hover { border-color: #aed581; }
.tl-date:disabled { opacity: .5; cursor: default; }
.tl-caret { color: #7cb342; transition: transform .15s; }
.tl-caret.up { transform: rotate(180deg); }
.tl-menu { position: absolute; z-index: 5; top: calc(100% + 4px); left: 0; right: 0; max-height: 280px; overflow: auto; margin: 0; padding: 4px;
    list-style: none; background: #fff; border: 1px solid #c5e1a5; border-radius: 10px; box-shadow: 0 8px 20px rgba(51, 105, 30, .15); outline: none; }
.tl-menu li { display: flex; justify-content: space-between; gap: 10px; padding: 8px 10px; border-radius: 6px; color: #33691e; cursor: pointer; font-size: 14px; }
.tl-menu li.active { background: #f1f8e9; }
.tl-menu li.on { background: #dcedc8; font-weight: 700; }
.tl-menu .tl-n { color: #7cb342; font-variant-numeric: tabular-nums; }
.tl-menu li.on .tl-n { color: #33691e; }
@media (prefers-reduced-motion: reduce) { .tl-caret { transition: none; } }
.tl-copy { padding: 7px 16px; border: none; border-radius: 8px; background: #558b2f; color: #fff; font-family: "Jua", sans-serif; cursor: pointer; }
.tl-copy:disabled { opacity: .4; cursor: default; }
.tl-count { font-size: 13px; color: #558b2f; margin-bottom: 6px; text-align: left; }
.tl-log { max-height: 60vh; overflow: auto; border: 1px solid #dcedc8; border-radius: 10px; background: #fbfdf7; }
.tl-table { width: 100%; border-collapse: collapse; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px;
    text-align: left; color: #33691e; font-variant-numeric: tabular-nums; }
.tl-table th { position: sticky; top: 0; background: #f1f8e9; color: #689f38; font-weight: 600; padding: 7px 8px; border-bottom: 1px solid #dcedc8; white-space: nowrap; }
.tl-table td { padding: 6px 8px; border-bottom: 1px dashed #e6efd9; vertical-align: top; }
.tl-table tr:last-child td { border-bottom: none; }
.tl-table tbody tr { cursor: pointer; }
.tl-table tr.off td { opacity: .4; }
.tl-table .c { width: 28px; padding-right: 0; }
.tl-table input[type="checkbox"] { accent-color: #558b2f; width: 16px; height: 16px; margin: 0; vertical-align: middle; }
.tl-table td.t { color: #9e9e9e; white-space: nowrap; }
.tl-table td:nth-child(2), .tl-table td:nth-child(3) { white-space: nowrap; }
.tl-table .k-na .res { color: #8d6e63; }
.tl-table .k-rsv .res { color: #1565c0; }
.tl-table .k-fix .res { color: #2e7d32; font-weight: 700; }
.tl-table .k-bad .res { color: #c62828; }
.tl-empty { padding: 24px 0; text-align: center; color: #8d6e63; }
.tl-error { padding: 10px 12px; border-radius: 8px; background: #fdecea; color: #b71c1c; }
.tl-copy:focus-visible, .tl-date:focus-visible { outline: 3px solid #aed581; outline-offset: 2px; }
</style>
