// ─────────────────────────────────────────────────────────────────────
// frontend/src/constants — 데이터성 상수 단일 소스.
//
// 컨벤션:
//   - 화면 컴포넌트(*.vue) / composable(*.js) 안에 박혀 있던 5개 이상 항목의
//     배열·객체 / 비즈니스 의미가 있는 매직넘버 / enum 라벨 매핑은 모두 여기로.
//   - 단순 UI 라벨("저장","취소") · 인라인 스타일 · CSS 색상은 제외.
//   - 도메인별로 섹션 주석(// === XXX ===)으로 묶고, 새 항목은 같은 섹션에 추가.
//   - 백엔드 enum 과 합의된 값(TM_RESULT_BIHAP 등)은 변경 시 백엔드와 동기화 필수.
//
// 인덱스 (현재 도메인):
//   1. path 매핑              pathMap, pathGroupMap
//   2. 일반 라벨/필드          dayLabels, helpText, hjFields, ttagiFields, mbtiOptions
//   3. prospect funnel        phaseOrder, statusColors, statusTextMap, phaseColorMap
//   4. 인도권 (dolyo)         TM_RESULT_BIHAP, TM_RESULT_GEOJEOL, FAITH_LABEL_MAP,
//                              stageLabels, stageNameToIndex
//   5. 일일보고               leafOptions
//   6. 통계 채널              CHANNELS, OFFLINE_CHANNELS, CHANNEL_LABELS
//   7. TM/매칭 상태/타이밍    TM_STATUS_ORDER, HOUR_MS, KR_TIME_DIFF_MS,
//                              TM_END_HIDE_MS, MATCH_RESULT_HIDE_MS, REJECT_HIDE_MS
//   8. 시간블럭(painter) 범위  ACTIVITY_HOUR_START, ACTIVITY_HOUR_END
//   9. 어드민 메뉴/구절        adminMenuItems, prayerVerses
//
// 도메인별 파일 분리(enums.js / timings.js)는 ~150줄 넘으면 검토.
// ─────────────────────────────────────────────────────────────────────

// path display map — raw 경로명 → 화면용 짧은 라벨. CenterScreen / TmAssetScreen 사용.
export const pathMap = { '도구노방': '노방', '생노': '생노', '큐알': '큐알', '바따장': '바따장', '인스타디엠': '디엠', '온라인폼': '온폼', '소모임': '소모임', '온찾': '온찾', '인스타광고': '인스타광고' }

// path group map — 다양한 raw 입력 (도구노방 / 노방 / 오프찾 등) 을 통계용 5개
// 그룹 (오프찾 / 광고 / 디엠 / 온폼 / 지인) 으로 정규화. AdminScreen 통계 그룹핑 전용
// — pathMap 과 도메인이 달라 이름을 분리.
export const pathGroupMap = {
  '도구노방': '오프찾', '오프찾': '오프찾', '노방': '오프찾',
  '인스타광고': '광고', '광고': '광고',
  '인스타디엠': '디엠', '디엠': '디엠', '인스타DM': '디엠',
  '온라인폼': '온폼', '온폼': '온폼',
  '지인': '지인',
}

// JS Date.getDay() (일=0) 인덱스로 그대로 룩업.
export const dayLabels = ['일', '월', '화', '수', '목', '금', '토']
// 화면 표시 순서 (월요일 시작). 데이터 dow 인덱스는 0=일~6=토 유지하되
// WeeklyTemplateModal 등의 7일 grid 표시 순서만 [월,화,수,목,금,토,일] 로.
export const dayDisplayOrder = [1, 2, 3, 4, 5, 6, 0]

export const helpText = {
    '환경비합': '군대, 지방, 해외, 시간불가 등', '나이비합': '지역 기준 초과', '인성비합': '사회성 결여, 공격적 등', '정신질환': '약물 복용 등', '중복섭외': '이전 섭외 이력', 'N번 안받음': '지역 기준 횟수 초과', '수신거절': '차단 및 거절', '의심/경계': '신천지 의심 등', '거리부담': '멀어서 어렵다', '메리트부족': '바빠서, 귀찮아서', '대면부담': '만나기 부담', '환경반려': '환경문제로 반려', '인성반려': '인성문제로 반려', '중섭반려': '중복으로 반려', '답장안옴': '연락두절', '매칭취소': '매칭 후 취소됨', '잘못올림': '실수'
}

export const hjFields = [
    { id: 'guide', label: '인도자 이름', type: 'text' }, { id: 'tmName', label: '티엠자 이름', type: 'text' }, { id: 'path', label: '섭외경로', type: 'select', opts: ['도구노방', '생노', '큐알', '바따장', '인스타디엠', '온라인폼', '소모임', '온찾', '인스타광고'] }, { id: 'tool', label: '섭외도구', type: 'toolSelect', opts: [] }, { id: 'mtDate', label: '매칭일자', type: 'date' }, { id: 'mtTime', label: '매칭시간', type: 'time' }, { id: 'mtPlace', label: '매칭장소', type: 'text' }, { id: 'subName', label: '섭외자 이름', type: 'text' }, { id: 'gender', label: '성별', type: 'select', opts: ['남', '여'] }, { id: 'age', label: '나이', type: 'number' }, { id: 'contact', label: '연락처', type: 'tel' }, { id: 'nearSt', label: '거주지 근처 역', type: 'text' }, { id: 'gwacheonMin', label: '과천까지(분)', type: 'minSelect' }, { id: 'gwacheonTransfer', label: '과천 환승', type: 'transferSelect' }, { id: 'centerMin', label: '센터까지(분)', type: 'minSelect' }, { id: 'centerTransfer', label: '센터 환승', type: 'transferSelect' }, { id: 'mbti', label: 'MBTI', type: 'text' }, { id: 'job', label: '학교(전공)/직장', type: 'text' }, { id: 'sch', label: '일정(학원,알바 등)', type: 'textarea' }, { id: 'plan', label: '1년 환경 구체적으로(군입대, 여행, 수술 등)', type: 'textarea' }, { id: 'purpose', label: '신청목적(메리트)', type: 'text' }, { id: 'selfImage', label: '나의 이미지(성격)', type: 'textarea' }, { id: 'trouble', label: '되고 싶은 내적 이미지(or 가장 고민되는 부분)', type: 'textarea' }, { id: 'att', label: '인성(전화 태도)', type: 'text' }, { id: 'wary', label: '경계', type: 'text' }, { id: 'dist', label: '거리부담', type: 'text' }, { id: 'etc', label: '특이사항', type: 'text' }, { id: 'centerEnv', label: '센터 환경', type: 'ox' }, { id: 'drug', label: '약물복용', type: 'ox' }, { id: 'mental', label: '정신질환', type: 'ox' }
]

export const ttagiFields = [
    { id: 'fixDay', label: '고정 요일, 시간' },
    { id: 'point', label: '따기 포인트' },
    { id: 'pointCause', label: '따기 포인트의 원인(가정사, 인간관계)' },
    { id: 'lack', label: '결핍' },
    { id: 'thought', label: '따포의 원인으로 생겨난 사고회로' },
    { id: 'ment', label: '사용한 따기멘트' },
    { id: 'reaction', label: '입막음에 대한 반응' },
    { id: 'bihap', label: '비합요소' },
    { id: 'check', label: '추가 파악해야할 내용(피드백받고 작성)' }
]

export const phaseOrder = { '매칭': 0, '상따': 1, '성흘': 2, '성따': 3, '복등': 4, '센터': 5, '탈락': 6 }
export const statusColors = ['⚪️', '🔴', '🟠', '🟡', '🟢', '🔵']
export const statusTextMap = { '🔴': '위험', '🟠': '불안', '🟡': '경계', '🟢': '관심', '🔵': '안정', '⚪️': '미정' }

// CenterScreen — phase 별 카드 표시 색상.
// phaseOrder 의 키와 동기화. 누락 키는 호출부에서 '#333' fallback.
export const phaseColorMap = {
  '매칭': '#795548', '상따': '#9C27B0', '성흘': '#0288D1', '성따': '#42A5F5',
  '복등': '#1B5E20', '센터': '#FBC02D', '탈락': '#F57C00',
}

export const mbtiOptions = ['-', 'ENFJ', 'ENFP', 'ENTJ', 'ENTP', 'ESFJ', 'ESFP', 'ESTJ', 'ESTP', 'INFJ', 'INFP', 'INTJ', 'INTP', 'ISFJ', 'ISFP', 'ISTJ', 'ISTP']

// 인도권 detail — TM 결과(tmResultDetail) 분류용. 백엔드 enum 과 합의된 한글값.
// 추가/변경 시 helpText (위쪽 정의) 의 키와도 동기화.
export const TM_RESULT_BIHAP   = ['환경비합', '거리비합', '나이비합', '인성비합', '정신질환', '중복섭외']
export const TM_RESULT_GEOJEOL = ['N번 안받음', '수신거절', '의심/경계', '거리부담', '대면부담', '메리트부족']

// 농부일지 (DolyoDetail farmerDiary) faith 코드 → 표시 라벨.
// useDolyo 의 faithLabels 와 동일 — 단일 소스로 통합.
export const FAITH_LABEL_MAP = { '무': '무신앙', '휴': '휴면', '신앙': '신앙인' }

// 인도권 단계 라벨 — getStage(item) 0~3 인덱스로 룩업.
// '씨앗' → 'stage0' 정렬용 키는 별도 stageNameToIndex 참조.
export const stageLabels = ['씨앗 🌰', '새싹 🌿', '떡잎 🍀', '열매 🍎']
export const stageNameToIndex = { '씨앗': 0, '새싹': 1, '떡잎': 2, '열매': 3 }

// 일일보고 잎사귀 종류. '-' 은 sentinel (선택 안 함).
export const leafOptions = ['-', '생노잎', '간증잎', '성구잎', '특강자', '타로잎', '인도잎', '기타잎']

// 일일보고 번호찾 결과 종류.
export const regResultOptions = ['미진행', '만픽', '탈락', '부재중', '예약']

// 통계 화면 — 종합/개인 통계의 채널 코드. 백엔드 응답 키와 일치.
// CHANNELS: 일반 채널, OFFLINE_CHANNELS: 오프라인 추가 채널.
// CHANNEL_LABELS: 코드 → 한글 표시. 'jiin' 은 합쳐진 분류라 라벨만 따로.
export const CHANNELS = ['dm', 'ad', 'somoim', 'form', 'onchat', 'qr']
export const OFFLINE_CHANNELS = ['nobang', 'saengno', 'badda']
export const CHANNEL_LABELS = {
  dm: '디엠', ad: '광고', somoim: '소모임', form: '온폼', onchat: '온찾', qr: '큐알',
  nobang: '노방', saengno: '생노', badda: '바따장', jiin: '지인',
}

// TM 자산 화면 — 상태 정렬 우선순위 (작을수록 위). 레거시 index.html 의
// statusOrder 와 정합 (묻어둠 3, 예약됨 4) — 묻어둠을 하는중 바로 아래로 모은다.
// '끝난거' 와 '최종종료' 는 동일 우선순위로 묶어 끝쪽 정렬.
export const TM_STATUS_ORDER = {
  '하기전': 1, '하는중': 2, '묻어둠': 3, '예약됨': 4, '끝난거': 5, '최종종료': 5,
}

// 시간 단위 (ms). 다른 timing 상수의 기반.
export const HOUR_MS = 60 * 60 * 1000

// KST 오프셋 (ms). useFormatters.getKstDate() 가 사용.
// 백엔드의 services/main/src/util/businessDate.js KST_OFFSET_MS 와 동일 값 (9h).
export const KR_TIME_DIFF_MS = 9 * HOUR_MS

// TM/매칭 화면의 시간 임계값 (ms). "끝난" 항목 / 매칭 결과 / 반려 결과를 N시간 후 숨김.
// 운영 중 조정 시 한 곳만 고치면 끝.
export const TM_END_HIDE_MS       = 36 * HOUR_MS  // TmAssetScreen: '끝난거'/'최종종료' 항목 숨김
export const MATCH_RESULT_HIDE_MS = 48 * HOUR_MS  // MatchingScreen: matchResultDetail 결과 숨김
export const REJECT_HIDE_MS       = 3  * HOUR_MS  // MatchingScreen: '반려' 항목 숨김

// 일일계획/주간템플릿 시간블럭 painter 의 슬롯 범위 (시).
// TimeBlockPainter 는 (start)..(end) 시간대 30분 단위로 슬롯 생성.
// WeeklyTemplateModal 도 동일 범위 사용. 운영 시간대 조정 시 한 곳만 고치면 끝.
export const ACTIVITY_HOUR_START = 9
export const ACTIVITY_HOUR_END   = 23

// AdminScreen 의 사명의 길 메뉴. WIRED_MODALS 와 짝 — action 키가 일치해야 한다.
// 추가/제거 시 AdminScreen.vue 의 WIRED_MODALS 도 동기화.
// 배포판 legacy2 의 openAdminMode 메뉴 (line 11074~) 정합.
// 배선 완료 (WIRED_MODALS) / 미배선 (stub alert) 은 AdminScreen.vue 에서 분기.
export const adminMenuItems = [
  { label: '👥 명단 관리', color: '#1565C0', action: 'userManagement' },
  { label: '🎯 목표 설정', color: '#F57C00', action: 'goalSetting' },
  { label: '💬 텔레그램 연결', color: '#1976D2', action: 'telegramConnect' },
  { label: '🛠️ 도구 등록', color: '#9C27B0', action: 'toolManagement' },
  { label: '🛤️ 섭외 경로 설정', color: '#E91E63', action: 'pathManagement' },
  { label: '📥 유입시트 자동연동', color: '#2E7D32', action: 'intakeSync' },
  { label: '💭 느낀점 열람하기', color: '#00897B', action: 'reflectionViewer' },
]

// PrayerScreen 진입 시 random pick 으로 1개 노출. 5개 + 5개 (서로 다른 풀이
// 두 곳에 흩어져 있던 것을 2026-05-09 에 합침) = 10개 풀.
export const prayerVerses = [
    "구하라 그러면 너희에게 주실 것이요 찾으라 그러면 찾을 것이요 문을 두드리라 그러면 너희에게 열릴 것이니 (마 7:7)",
    "너는 내게 부르짖으라 내가 네게 응답하겠고 네가 알지 못하는 크고 비밀한 일을 네게 보이리라 (렘 33:3)",
    "쉬지 말고 기도하라 범사에 감사하라 이는 그리스도 예수 안에서 너희를 향하신 하나님의 뜻이니라 (살전 5:17-18)",
    "아무 것도 염려하지 말고 오직 모든 일에 기도와 간구로, 너희 구할 것을 감사함으로 하나님께 아뢰라 (빌 4:6)",
    "이러므로 너희 죄를 서로 고하며 병 낫기를 위하여 서로 기도하라 의인의 간구는 역사하는 힘이 많으니라 (약 5:16)",
    "여호와는 나의 목자시니 내게 부족함이 없으리로다 - 시편 23:1",
    "너희 염려를 다 주께 맡기라 이는 그가 너희를 돌보심이라 - 베드로전서 5:7",
    "내가 너를 강하게 하리라 참으로 너를 도와주리라 - 이사야 41:10",
    "여호와를 기뻐하라 그가 네 마음의 소원을 이루어 주시리로다 - 시편 37:4",
    "항상 기뻐하라 쉬지 말고 기도하라 범사에 감사하라 - 데살로니가전서 5:16-18"
]
