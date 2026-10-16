<script setup>
// ERP 찾기 분석 — 어디서 찾았나: 찾기 장소별(shed 도구 노방: 찾기 → 만픽·재가 비율)과 홍보 학교별(일일보고 홍보 횟수, 홍보는 에브리타임)
// 이름은 서버에서 묶어 옴(범계/범계역 → 범계, 가천대학교 → 가천대). 위 10개만, 더 보기로 전부
import { ref, computed } from 'vue'
import { pct, natCmp } from './erpUtil'

const props = defineProps({
    places: { type: Array, required: true },   // 이미 범위로 거른 [{ place, reg, meetFix, jaega }]
    schools: { type: Array, required: true },  // 이미 범위로 거른 [{ school, visits, last }]
    scope: { type: String, required: true },
})
const TOP = 10
const allPlaces = ref(false)
const allSchools = ref(false)

const placeRows = computed(() => {
    const by = {}
    for (const p of props.places) {
        const a = (by[p.place] ||= { name: p.place, reg: 0, meetFix: 0, jaega: 0 })
        a.reg += p.reg; a.meetFix += p.meetFix; a.jaega += p.jaega
    }
    return Object.values(by).sort((a, b) => b.reg - a.reg || b.jaega - a.jaega)
})
const schoolRows = computed(() => {
    const by = {}
    for (const s of props.schools) {
        const a = (by[s.school] ||= { name: s.school, visits: 0, last: '' })
        a.visits += s.visits
        if (s.last > a.last) a.last = s.last
    }
    return Object.values(by).sort((a, b) => b.visits - a.visits || natCmp(a.name, b.name))
})
const md = (d) => (d ? `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}` : '')
</script>

<template>
    <div class="erp-where">
        <div class="erp-where-col">
            <h3 class="erp-h3">찾기 장소별 <span class="erp-sub">{{ scope }} · 도구 노방(shed) · {{ placeRows.length }}곳</span></h3>
            <div class="erp-table-wrap">
                <table class="erp-table">
                    <thead><tr><th scope="col">장소</th><th scope="col">찾기</th><th scope="col">만픽</th><th scope="col">재가</th><th scope="col">찾기→만픽</th><th scope="col">찾기→재가</th></tr></thead>
                    <tbody>
                        <tr v-for="r in (allPlaces ? placeRows : placeRows.slice(0, TOP))" :key="r.name">
                            <th scope="row">{{ r.name }}</th>
                            <td>{{ r.reg }}</td>
                            <td :class="{ 'erp-zero': !r.meetFix }">{{ r.meetFix }}</td>
                            <td :class="{ 'erp-zero': !r.jaega }">{{ r.jaega }}</td>
                            <td>{{ pct(r.meetFix, r.reg) }}</td>
                            <td>{{ pct(r.jaega, r.reg) }}</td>
                        </tr>
                        <tr v-if="!placeRows.length"><th scope="row" colspan="6">이 기간에 shed로 찾은 사람이 없어요</th></tr>
                    </tbody>
                </table>
            </div>
            <button v-if="placeRows.length > TOP" class="erp-link erp-where-more" @click="allPlaces = !allPlaces">
                {{ allPlaces ? '접기' : `${placeRows.length - TOP}곳 더 보기` }}
            </button>
        </div>
        <div class="erp-where-col">
            <h3 class="erp-h3">홍보 학교별 <span class="erp-sub">{{ scope }} · 일일보고 홍보 학교(에브리타임) · {{ schoolRows.length }}곳</span></h3>
            <div class="erp-table-wrap">
                <table class="erp-table">
                    <thead><tr><th scope="col">학교</th><th scope="col">홍보 횟수</th><th scope="col">마지막 홍보</th></tr></thead>
                    <tbody>
                        <tr v-for="r in (allSchools ? schoolRows : schoolRows.slice(0, TOP))" :key="r.name">
                            <th scope="row">{{ r.name }}</th>
                            <td>{{ r.visits }}</td>
                            <td>{{ md(r.last) }}</td>
                        </tr>
                        <tr v-if="!schoolRows.length"><th scope="row" colspan="3">이 기간에 적힌 홍보 학교가 없어요</th></tr>
                    </tbody>
                </table>
            </div>
            <button v-if="schoolRows.length > TOP" class="erp-link erp-where-more" @click="allSchools = !allSchools">
                {{ allSchools ? '접기' : `${schoolRows.length - TOP}곳 더 보기` }}
            </button>
        </div>
    </div>
</template>
