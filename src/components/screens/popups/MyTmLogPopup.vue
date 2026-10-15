<script setup>
// 합당한자 화면 "내 티엠 내역" — 고른 날(기본 오늘) 내가 돌린 통화를 로그 표로 보여주고, 체크한 줄만 [티엠 결과] 보고 양식으로 복사
import { ref, computed, onMounted } from 'vue'
import { useApi } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'

const emit = defineEmits(['close'])
const { callApiPromise } = useApi()
const { showToast } = usePopup()

const pad = (n) => String(n).padStart(2, '0')
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }

const date = ref(today())
const list = ref([])
const loading = ref(false)
const error = ref('')

async function load() {
    loading.value = true
    error.value = ''
    const r = await callApiPromise('/api/shed/my-tm-log', { date: date.value })
    loading.value = false
    if (!r?.success) { error.value = r?.message || '불러오지 못했어요. 잠시 뒤 다시 열어 주세요.'; list.value = []; return }
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
onMounted(load)
</script>

<template>
    <div class="modal-overlay" @click.self="emit('close')">
        <div class="modal-card tl-modal" role="dialog" aria-label="내 티엠 내역">
            <span class="modal-close" @click="emit('close')">&times;</span>
            <div class="modal-title">📋 내 티엠 내역</div>
            <div class="tl-bar">
                <input v-model="date" type="date" class="tl-date" aria-label="날짜" @change="load">
                <button class="tl-copy" :disabled="loading || !picked.size" @click="copy">{{ picked.size }}건 복사</button>
            </div>
            <p v-if="loading" class="tl-empty">불러오는 중…</p>
            <p v-else-if="error" class="tl-error">{{ error }}</p>
            <p v-else-if="!list.length" class="tl-empty">이 날은 돌린 티엠이 없어요.</p>
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
.tl-date { flex: 1; padding: 7px 10px; border: 1px solid #c5e1a5; border-radius: 8px; font: inherit; }
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
