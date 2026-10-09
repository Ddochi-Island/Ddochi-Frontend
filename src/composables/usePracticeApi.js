// 튜토리얼(연습 모드)용 가짜 백엔드 — 합당한자 화면이 부르는 API를 메모리 상태로 흉내 냄. 서버/DB에 아무것도 안 감.
// 호출될 때마다 onPracticeCall 구독자에게 알려서 코치(TutorialCoach)가 "직접 해보기" 단계를 넘길 수 있게 함.

const iso = (d) => new Date(d).toISOString()
const now = () => iso(Date.now())
const daysAgo = (n) => iso(Date.now() - n * 86400e3)
const uid = () => Math.random().toString(16).slice(2, 10).toUpperCase()

const listeners = new Set()
export function onPracticeCall(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
}

function seed() {
    const inflow = (who, at) => ({ id: uid(), label: '유입', category: null, source: 'inflow', actorName: who, createdAt: at })
    const prospect = (id, name, age, team, introducer, createdAt, extra = {}) => ({
        sarangId: id, name, phone: '010-0000-' + id.slice(-4), age, mbti: 'ENFP', residenceStation: null,
        stage: '유입', currentProcess: null, isDropped: false, droppedReason: null, recruitmentType: 'OFFLINE',
        inflowDate: createdAt, createdAt, inflowMemberName: '연습회원', team, noAnswerCount: 0,
        inflowDetails: { regionName: '서울', reaction: '좋아함', location: '강남역', env: '대학생', introducerName: introducer,
            helperNames: '', tmReservedAt: null, appliedAt: createdAt },
        habJaeYang: null, timeline: [inflow(introducer, createdAt)], ...extra,
    })
    return {
        queue: [
            { intakeId: 'PRACTICE0001', name: '김연습', phone: '010-1234-0001', age: 22, mbti: 'ENFP', sourceLink: '4',
              regionName: '서울', reaction: '향 좋다고 함', location: '강남역', env: '대학생(휴학)', introducerName: '나',
              introducerRegion: '4', helperNames: '', tmReservedAt: iso(Date.now() + 3 * 3600e3), createdAt: now(), appliedAt: now() },
        ],
        rejected: [],
        prospects: [
            prospect('PRACTICE0002', '이예시', 24, '4', '나', now()),
            prospect('PRACTICE0003', '박공개', 21, '6', '다른지역', daysAgo(5)),
        ],
    }
}

let state = seed()
export function resetPractice() { state = seed() }

const LOG = {
    안받음: { label: '부재중', source: 'call' },
    티엠예약: { label: '예약 티엠', category: 'tmReserved', source: 'call' },
    만남픽스: { label: '만남 픽스', source: 'call' },
    비합처리: { label: '비합', source: 'call', drop: true },
    거절처리: { label: '거절', source: 'call', drop: true },
    무효처리: { label: '무효', source: 'call', drop: true },
    선문자: { label: '선문자발송', category: 'welcomeMsg', source: 'activity' },
    안받문: { label: '부재중문자발송', category: 'noAnswerMsg', source: 'activity' },
}

function handle(path, body) {
    const d = body?.data || body || {}
    const find = (id) => state.prospects.find(p => p.sarangId === id)
    switch (path) {
        case '/api/get-shed-prospects': return { success: true, list: state.prospects }
        case '/api/shed/pending-list': return { success: true, list: state.queue }
        case '/api/shed/rejected-list': return { success: true, list: state.rejected }
        case '/api/shed/lookup-teams': return { ok: true, teams: {} }
        case '/api/shed-call-status': return { success: true, calls: {}, presence: {} }
        case '/api/get-tm-script': return { success: true, mode: 'default', text: '' }
        case '/api/shed-register': {
            const i = state.queue.findIndex(q => q.intakeId === d.intakeId)
            if (i < 0) return { success: false, message: '이미 처리된 연습 건이에요' }
            const [q] = state.queue.splice(i, 1)
            state.prospects.unshift({
                sarangId: uid() + uid() + uid() + uid(), name: q.name, phone: q.phone, age: q.age, mbti: q.mbti,
                stage: '유입', isDropped: false, droppedReason: null, recruitmentType: 'OFFLINE', inflowDate: now(),
                createdAt: now(), inflowMemberName: '나', team: q.introducerRegion, noAnswerCount: 0,
                inflowDetails: { regionName: q.regionName, reaction: q.reaction, location: q.location, env: q.env,
                    introducerName: q.introducerName, helperNames: '', tmReservedAt: q.tmReservedAt, appliedAt: q.appliedAt },
                habJaeYang: null,
                timeline: [{ id: uid(), label: '유입', category: null, source: 'inflow', actorName: q.introducerName, createdAt: now() }],
            })
            return { success: true }
        }
        case '/api/shed-pending-reject': {
            const i = state.queue.findIndex(q => q.intakeId === d.intakeId)
            if (i >= 0) state.rejected.unshift(...state.queue.splice(i, 1))
            return { success: true }
        }
        case '/api/shed-pending-revive': {
            const i = state.rejected.findIndex(q => q.intakeId === d.intakeId)
            if (i >= 0) state.queue.unshift(...state.rejected.splice(i, 1))
            return { success: true }
        }
        case '/api/submit-result': {
            const p = find(d.rowIndex)
            const log = LOG[d.logType]
            if (!p || !log) return { success: true }
            p.timeline.unshift({ id: uid(), label: log.label, category: log.category || null, source: log.source, actorName: '나', createdAt: now() })
            if (d.logType === '안받음') p.noAnswerCount += 1
            if (d.logType === '티엠예약') p.inflowDetails.tmReservedAt = d.tmNote?.nextCallDate ? iso(d.tmNote.nextCallDate) : null
            if (d.logType === '만남픽스') p.stage = '만픽'
            if (log.drop) { p.isDropped = true; p.droppedReason = log.label }
            return { success: true }
        }
        case '/api/delete-log': {
            const p = find(d.rowIndex)
            if (p) {
                p.timeline = p.timeline.filter(l => l.id !== d.id)
                const last = p.timeline.find(l => l.source === 'call')
                p.isDropped = !!(last && ['비합', '거절', '무효'].includes(last.label))
                p.droppedReason = p.isDropped ? last.label : null
                if (!p.timeline.some(l => l.label === '만남 픽스')) p.stage = '유입'
            }
            return { success: true }
        }
        case '/api/run-shed-gacha': return { success: true, roulette: false, winner: 'inflow', winnerName: body?.inflowName || '' }
        default: return { success: true }  // 통화 시작/끝, 메모 저장, 스크립트 저장 등 — 연습에선 성공만
    }
}

// useApi()의 callApiPromise와 같은 모양
export function usePracticeApi() {
    async function callApiPromise(path, body) {
        await new Promise(r => setTimeout(r, 120))  // 실제처럼 아주 잠깐 기다림
        const res = JSON.parse(JSON.stringify(handle(path, body)))
        listeners.forEach(fn => fn(path, body))
        return res
    }
    return { callApiPromise }
}
