<script setup>
// ERP 이름 정리 — 찾기장소·홍보 학교의 원래 표기(오타·줄임말)를 표준 이름으로 묶음. 원래 입력값은 그대로 두고
// NAME_ALIASES에 "원래 표기 → 표준 이름"만 저장 → 찾기 분석이 집계할 때 적용. 지정 안 한 표기는 자동 규칙으로 묶임
import { ref, computed, watch, onMounted } from 'vue'
import { useErpLoad, natCmp } from './erpUtil'
import { useApi } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'

const { callApiPromise } = useApi()
const { showToast } = usePopup()
const kind = ref('place')
const { loading, error, data, load } = useErpLoad('/api/erp/names')
const q = ref('')
const edits = ref({})   // raw → 입력 중인 표준 이름
const saving = ref(false)

const reload = () => load({ kind: kind.value })
watch(kind, () => { edits.value = {}; q.value = ''; reload() })
onMounted(reload)

// 표준 이름별 묶음 — 건수 많은 순
const groups = computed(() => {
    const by = {}
    for (const r of data.value?.rows || []) (by[r.canonical] ||= { name: r.canonical, count: 0, raws: [] }).raws.push(r)
    for (const g of Object.values(by)) {
        g.count = g.raws.reduce((s, r) => s + r.count, 0)
        g.raws.sort((a, b) => b.count - a.count)
    }
    const word = q.value.trim()
    return Object.values(by)
        .filter((g) => !word || g.name.includes(word) || g.raws.some((r) => r.raw.includes(word)))
        .sort((a, b) => b.count - a.count || natCmp(a.name, b.name))
})
const names = computed(() => [...new Set((data.value?.rows || []).map((r) => r.canonical))].sort(natCmp))

// 비슷한 이름 제안 — 한쪽이 다른 쪽을 포함하거나 한 글자만 다른 표준 이름 쌍
function oneEditApart(a, b) {
    if (Math.abs(a.length - b.length) > 1 || a.length < 3) return false
    let i = 0, j = 0, diff = 0
    while (i < a.length && j < b.length) {
        if (a[i] === b[j]) { i++; j++; continue }
        if (++diff > 1) return false
        if (a.length > b.length) i++
        else if (a.length < b.length) j++
        else { i++; j++ }
    }
    return diff + (a.length - i) + (b.length - j) <= 1
}
const suggestions = computed(() => {
    const gs = groups.value.filter((g) => g.name !== '(미기록)')
    const out = []
    for (let i = 0; i < gs.length; i++) for (let j = i + 1; j < gs.length; j++) {
        const [a, b] = [gs[i], gs[j]]
        const contains = a.name.length >= 2 && b.name.length >= 2 && (a.name.includes(b.name) || b.name.includes(a.name))
        if (contains || oneEditApart(a.name, b.name)) out.push([a, b])
    }
    return out.slice(0, 20)
})

async function setAlias(raw, canonical) {
    const r = await callApiPromise('/api/erp/names/set', { kind: kind.value, raw, canonical })
    if (!r?.success) throw new Error(r?.message || '저장 실패')
}
async function saveOne(raw) {
    const to = (edits.value[raw] ?? '').trim()
    if (!to) return
    saving.value = true
    try { await setAlias(raw, to); showToast(`'${raw}' → '${to}'`); delete edits.value[raw]; await reload() }
    catch (e) { showToast(e.message) }
    saving.value = false
}
async function resetOne(raw) {
    saving.value = true
    try { await setAlias(raw, ''); showToast(`'${raw}' 지정 해제`); await reload() }
    catch (e) { showToast(e.message) }
    saving.value = false
}
// 묶음 전체를 다른 표준 이름으로 — 그 묶음의 모든 원래 표기에 지정
async function mergeGroup(from, toName) {
    saving.value = true
    try {
        for (const r of from.raws) await setAlias(r.raw, toName)
        showToast(`'${from.name}' ${from.raws.length}개 표기를 '${toName}'(으)로 묶었어요`)
        await reload()
    } catch (e) { showToast(e.message) }
    saving.value = false
}
const label = computed(() => (kind.value === 'place' ? '찾기장소' : '홍보 학교'))
</script>

<template>
    <section>
        <div class="erp-bar">
            <div class="erp-seg" role="group" aria-label="종류" style="margin: 0; border: none">
                <button :class="{ on: kind === 'place' }" :aria-pressed="kind === 'place'" @click="kind = 'place'">찾기장소</button>
                <button :class="{ on: kind === 'school' }" :aria-pressed="kind === 'school'" @click="kind = 'school'">홍보 학교</button>
            </div>
            <input v-model="q" class="erp-input" type="search" :placeholder="`${label} 이름 찾기`" aria-label="이름 찾기" style="flex: 1; min-width: 140px">
        </div>
        <p class="erp-note">
            원래 입력값은 그대로 두고 "원래 표기 → 표준 이름"만 저장해요. 찾기 분석이 이 이름으로 합쳐서 세요.
            지정 안 한 표기는 자동 규칙(역·학교·앞 떼기 등)으로 묶여요. {{ kind === 'place' ? 'shed 유입 전체' : '최근 1년 일일보고' }} 기준이에요.
        </p>

        <p v-if="loading" class="erp-empty">불러오는 중…</p>
        <p v-else-if="error" class="erp-error">{{ error }}</p>
        <template v-else-if="data">
            <div v-if="suggestions.length && !q" class="erp-section">
                <h3 class="erp-h3">같은 곳 같아요 <span class="erp-sub">비슷한 이름끼리 — 맞으면 남길 이름 쪽으로 합치세요</span></h3>
                <ul class="erp-names-sugg">
                    <li v-for="([a, b], i) in suggestions" :key="i">
                        <span><b>{{ a.name }}</b> <span class="erp-sub">{{ a.count }}건</span> ↔ <b>{{ b.name }}</b> <span class="erp-sub">{{ b.count }}건</span></span>
                        <span class="erp-names-actions">
                            <button class="erp-chip" :disabled="saving" @click="mergeGroup(b, a.name)">'{{ a.name }}'(으)로</button>
                            <button class="erp-chip" :disabled="saving" @click="mergeGroup(a, b.name)">'{{ b.name }}'(으)로</button>
                        </span>
                    </li>
                </ul>
            </div>

            <datalist id="erp-names-list"><option v-for="n in names" :key="n" :value="n" /></datalist>
            <div v-for="g in groups" :key="g.name" class="erp-section erp-names-group">
                <h3 class="erp-h3">{{ g.name }} <span class="erp-sub">{{ g.count }}건 · 표기 {{ g.raws.length }}개</span></h3>
                <table class="erp-table erp-table-left erp-names-table">
                    <thead><tr><th scope="col">원래 표기</th><th scope="col">건수</th><th scope="col">묶인 방식</th><th scope="col">표준 이름으로 바꾸기</th></tr></thead>
                    <tbody>
                        <tr v-for="r in g.raws" :key="r.raw">
                            <td>{{ r.raw || '(빈칸)' }}</td>
                            <td>{{ r.count }}</td>
                            <td>
                                <span v-if="r.aliased" class="erp-stage">직접 지정</span>
                                <span v-else class="erp-sub">자동</span>
                            </td>
                            <td>
                                <span class="erp-names-edit">
                                    <input v-model="edits[r.raw]" class="erp-input" list="erp-names-list" :placeholder="g.name" :aria-label="`${r.raw} 표준 이름`" @keyup.enter="saveOne(r.raw)">
                                    <button class="erp-btn" :disabled="saving || !(edits[r.raw] || '').trim()" @click="saveOne(r.raw)">저장</button>
                                    <button v-if="r.aliased" class="erp-chip" :disabled="saving" @click="resetOne(r.raw)">지정 해제</button>
                                </span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <p v-if="!groups.length" class="erp-empty">'{{ q }}'(이)가 들어간 이름이 없어요.</p>
        </template>
    </section>
</template>
