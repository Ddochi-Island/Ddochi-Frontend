<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter, useRoute, onBeforeRouteLeave } from 'vue-router'
import { useApi } from '@/composables/useApi'
import { usePopup } from '@/composables/usePopup'
import { useTmStore } from '@/stores/tm'
import { useAuthStore } from '@/stores/auth'
import GachaSlotOverlay from '@/components/screens/GachaSlotOverlay.vue'
import DuplicateHistoryPopup from '@/components/screens/popups/DuplicateHistoryPopup.vue'

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxeppzAwBF4n0uSXjvaD7lZBLfdoA3kX_V4VXcb6cuX7ckOXZ6WLTIPqFbeuqraDVMLTw/exec'

const router = useRouter()
const route = useRoute()
const isQualityFind = computed(() => route.name === 'qualityFind')
const tm = useTmStore()
const auth = useAuthStore()
const { callApiPromise } = useApi()
const { showAppAlert, showAppConfirm, showToast } = usePopup()

// ── 탭 ──────────────────────────────────────────────────────────────
// 항상 유입자 팀 기준 — 링크 번호 fallback 없음
const prospectEffTeam = (p) => p.team ? `${p.team}팀` : undefined
const rowEffTeam = (r) => r.event ? `${r.event}팀` : undefined

const loading = ref(true)
const asLoading = ref(false)
const error = ref('')
const activeTab = ref('전체')
const showEnded = ref(false)   // false: 진행중만, true: 종료된 건만

// ── 종료된 건 ─────────────────────────────────────────────────────────
const expandedDoneId = ref(null)
const regachaVisible = ref(false)
const regachaResult = ref(null)
const regachaProspect = ref(null)
const cancelling = ref(false)

// ── 이관받기 중복 팝업 ────────────────────────────────────────────────
const shedDupList = ref([])
const shedDupExistingId = ref(null)

// ── 데이터 ───────────────────────────────────────────────────────────
const allShedProspects = ref([])
const qualityTeams = ['2', '4', '6']
const sunhanTeams  = ['1', '3', '5']
const shedProspects = computed(() => {
  return allShedProspects.value.filter(p =>
    isQualityFind.value ? qualityTeams.includes(p.team) : sunhanTeams.includes(p.team)
  )
})
const asRows = ref([])

const filteredAsRows = computed(() => {
  return asRows.value.filter(r =>
    isQualityFind.value ? qualityTeams.includes(r.event) : sunhanTeams.includes(r.event)
  )
})

// ── 통화 상태 ─────────────────────────────────────────────────────────
const callingDocId = ref(null)                // 내가 현재 통화중인 prospectId (UPPER)
const callStatus = reactive({})               // 폴링 결과: { [UPPER_ID]: { callerName } }
const presence = reactive({})                 // 폴링 결과: { [sabun]: { name, lastHeartbeat } }
let pollTimer = null

// ── TM 액션 상태 ──────────────────────────────────────────────────────
// type: 'reserve' | 'bihap' | 'geojeol' | 'muyou'
const actionTarget = ref(null)   // { docId, type }
const reserveDate = ref('')
const saving = ref(false)

// ── 선문자 팝업 ───────────────────────────────────────────────────────
const welcomeMsgTarget = ref(null)   // { docId, phone, name, age }
const welcomeChecked = ref(false)
const welcomeSaving = ref(false)

// ── 반려 토글 ─────────────────────────────────────────────────────────
const showRejected = ref(false)

// ── 통합 검색 ────────────────────────────────────────────────────────
const showShedSearch = ref(false)
const shedSearchQuery = ref('')
const shedSearchInputRef = ref(null)

// ── 미등록 전화번호 보기 ───────────────────────────────────────────────
const unregPhoneOpen = reactive({})

// ── TM 노트 ───────────────────────────────────────────────────────────
const noteToggles = reactive({})     // { [docId]: Set<string> }
const noteText = reactive({})        // { [docId]: string }
const noteTimers = reactive({})

const NOTE_TAGS = [
  '거주지', '과천까지', '센터까지', 'MBTI', '학교(직장)',
  '일정(학원,알바)', '1년 환경', '메리트', '내 이미지',
  '되고싶은모습', '인성', '경계', '약복용',
]

// TM_SUB_REASON_CODES(sql/10_tm_result_codes.sql)와 1:1로 맞춘 코드/라벨 — 백엔드가
// SUB_REASON을 (RESULT_CODE, SUB_CODE) FK로 검증하므로 여기서도 code를 그대로 보냄.
const BIHAP_OPTS   = [
  { code: 'ENV_UNFIT', label: '환경비합' }, { code: 'DISTANCE_UNFIT', label: '거리비합' },
  { code: 'AGE_UNFIT', label: '나이비합' }, { code: 'PERSONALITY_UNFIT', label: '인성비합' },
  { code: 'MENTAL_HEALTH', label: '정신질환' }, { code: 'DUPLICATE', label: '중복섭외' },
]
const GEOJEOL_OPTS = [
  { code: 'N_REJECT', label: 'N번 안받음' }, { code: 'OPT_OUT', label: '수신거절' },
  { code: 'SUSPICIOUS', label: '의심/경계' }, { code: 'DISTANCE_BURDEN', label: '거리부담' },
  { code: 'FACE_TO_FACE_BURDEN', label: '대면부담' }, { code: 'NO_BENEFIT', label: '메리트부족' },
]
const MUYOU_OPTS   = [
  { code: 'DUPLICATE_APPLY', label: '중복신청' }, { code: 'PRANK', label: '장난/비방' }, { code: 'NOT_SELF', label: '본인아님' },
]

// ── 안받음 팝업 ───────────────────────────────────────────────────────
const noAnswerMsgTarget = ref(null)   // { docId, phone, name, age }
const noAnswerChecked = ref(false)
const noAnswerSaving = ref(false)

// ── TM 스크립트 ───────────────────────────────────────────────────────
const DEFAULT_WELCOME_SCRIPT = `안녕하세요, 향과 휴식을 선물하는 브랜드 Shed 입니다 🌿

오늘 사쉐 증정 이벤트에 참여해주셔서 감사합니다

쉐드는 '향과 휴식'을 테마로, 일상 속 내가 원하는 공간에서 편안하게 향을 즐길 수 있는 제품과 경험을 만들어가는 브랜드입니다.

📌 쉐드 브랜드 둘러보기
홈페이지: https://shedevent.vercel.app/shedme
인스타그램: @shed.scent_official
https://www.instagram.com/shed.scent_official

잠시 후 이벤트 참여 및 체험 패키지와 관련해 간단한 전화 안내를 드릴 예정입니다 📞
감사합니다 :)

— Shed`

const DEFAULT_NO_ANSWER_SCRIPT = `안녕하세요! 쉐드(Shed)입니다 🌿
조금 전 이벤트 관련 안내차 전화드렸는데 통화가 어려우신 것 같아 문자 남겨요 :)

통화 가능하신 시간대 편하게 답장 남겨주시면 맞춰서 다시 연락드리겠습니다!

감사합니다:)`

const DEFAULT_SCRIPT = `➖➖➖➖➖➖➖➖➖

🍭 어그로 및 사쉐 소개


안녕하세요~! 향수 브랜드 준비 중인데 의견 한 번만 주실 수 있으실까요!
(이어폰 빼거나 멈추면) 혹시 이중에서 쓰고 계시거나, 쓰고 싶으신 향 있으실까요?
(고민하고 있을때) 저희가 저희가 향수 제품을 준비 중인데 저희가 만들 제품이 반응이 괜찮을지 시장조사하고 개선할 점도 찾고 하고 있는데 2-3분만 의견 주실 수 있을까요 ㅠ
여기선 비굴미가 중요함. 전재산을 걸고 사업을 할거라는 마인드로 간절함+비굴미
말을 안받아줘도 바로 빼지 말고 진짜 간절한 창업자 마인드로 2번정도는 시도해보기. 이어폰을 뺴게 하면 성공입니다
(뭔데요?) 아 감사해요 저희 창업 동아리 하고 있는 학생들인데 향수, 향기를 테마로 브랜드를 만들려고 하고 있어요., 근데 외출 할 때 쓰는 향수는 이미 유명한 브랜드가 많고 이미 사용중이신 제품들을 계속 쓰시는 경향이 있어서 저희는 좀 틈새시장이라고 해야할까요? 사쉐라는 제품군에 주력해보려고 해요.
혹시 사쉐라고 들어보셨나요?
만 25세 ↓ 창업 동아리 / 만 25세 ↑ 창업 준비생
✅쓰고 있다  » 오~! 어떻게 좀 사쉐를 접하게 되셨어요? => 대부분은 선물이지만 간혹 자기 돈으로 산 사람도 있음.
          ▼
✅선물 받았다  » 아 역시..! 저희가 사쉐를 메인 제품으로 잡은게 다른 향 제품 대비 단가도 저렴하고 디자인이 예뻐서 선물하기에 좋겠다는 생각 때문이었거든요~ 사쉐를 선물 받았을 때, 그리고 쓰시면서 좀 어떠셨어요? 만족스러우셨을까요?
          ▼
✅만족스러웠다 » 오 그렇죠! 저희도 그런 부분을 생각해서 내가 쓰기에도, 선물하기에도 좋은 사쉐를 만들어보자! 라고 생각했어요.


❎처음들어봤다 » 오-! 그렇군요, 아무래도 아직 생소한 제품군이다 보니 못들어보셨을 수도 있을 것 같아요~


사쉐는 이렇게 종이봉투처럼 생긴 방향제인데요, 안에 사쉐스톤이라고 하는 향을 담은 푹신한 돌맹이들이 들어있어서 3주 정도 은은하게 향을 내는 제품이에요! 원하는 장소에 걸어두기만 하면 되니 내가 원하는 곳에서 원하는 향을 즐길 수 있다는 장점이 있어요. 여기 사진 보시는 것처럼 차에 놓거나, 방이나 옷장에 걸어둬서 내가 원하는 향을 간편하게 배치할 수 있어요.

➖➖➖➖➖➖➖➖➖

🎁Q1. 휴식-향 연결성

저희가 또 브랜드 헤리티지로 밀고 싶은게 바로 '향과 휴식'이거든요.
보통의 향수들은 나한테 그 향을 더해서, 꾸미고 치장하는데에 목적이 있는데, 저희는 향을 통해 생각을 덜어내고 느슨함과 편안함을 주는것, 휴식을 선물하는게 제품의 기획 방향이에요.

그래서 저희가 지금 브랜드 슬로건으로 만들고 싶은게 '휴식을 선물하다' 인데, 들어보셨을때 어떻게 느껴지세요? 휴식과 향이 느끼기에 머릿 속에서 잘 연결이 되시는지? 원하는 향으로 가득한 공간에서 편안하게 쉬는 장면이 떠오르셨으면 좋겠다고 생각했어요.

❎ 연결이 잘 안되는거 같아요 » 아.. 그렇군요? 변순데 흠... 그래도 사람들이 보통 아로마 향이 마음을 편안하게 해준다고 하는데, 향 때문에 기분이 좋아졌던 경험이 혹시 있으실까요?

✅잘 맞는 것 같아요 » 음음! 보통 향 브랜드들이 아로마 계열의 향으로 디퓨저를 만들어서 많이 판매하거든요. 향으로 마음이 편해졌던 경험이 혹시 있으실까요?

➖➖➖➖➖➖➖➖➖

🎁Q2. 휴식-스트레스 경험

그렇구나.. 감사해요! 저희가 고객들의 휴식시간을 타겟해서 제품을 만들려다 보니, 사람들은 어떤걸 하면 진짜 쉬었다고 느낄까? 어떻게 쉴까 하는 고민이 들더라구요. 사람들이 쉬고싶어하는 순간에 저희가 만든 향이 같이 있으면 참 좋겠다 싶어서요!

※혹시 어떨때 진짜 휴식했다. 쉬었다. 재충전 됐다 라고 느끼시나요?


✅활동적인 것에서 휴식을 느낀다고 하면 » 오 그렇구나... (옆사람 보면서) 생각보다 액티비티 한걸 할 떄 쉬었다고 생각하는 분들이.. 롤온처럼 들고다니면서 쓸 수 있는 것도 좀 필요하겠다. (서로 끄덕끄덕)

✅그냥 누워있다, 아무것도 안한다 » 오.. 역시 바쁜 현대인이시네요..! 직장..인?이세요? (고등학생..?)
(대답듣고) 오~ 용산에는 뭐하러 오신거에요? 쉬러오셨나요 아니면 일하러 오셨나요! / 어디서 오셨어요?

🔥거리 파악하고 비합이면 » 아하... 아 의견 너무 감사드려요..! 주신 의견 가지고 휴식에 어울리는 제품 잘 만들어보겠습니다!

➖➖➖➖➖➖➖➖➖

🏆 브랜드 차별점 1 = 디렉팅

저희가 이렇게 발로 뛰면서 시장조사를 해보니까, 향을 좋아하시는 분들은 이미 자기가 좋아하는 향의 종류, 즐겨쓰는 브랜드들이 정해져 있더라구요! 저희처럼 소규모 스타트업이 막 마케팅비를 쏟아부으면서 쟁쟁한 브랜드들과 경쟁하는게 좋은 선택은 아닌 것 같아서 저희는 수요층을 좀 바꿔보려고 생각해봤어요.

향에 대해 잘은 모르지만, 선물받거나 누가 골라준다면 써보고 싶다고 의견을 주시는 분들이 많더라고요 특히 남성 분들은 향이 너무 어렵고 귀찮은데 맘에 드는 향이 생기면 브랜드나 가격 안따지고 그것만 계속 쓰신다는 분들도 계시고.. 그래서 향을 잘 모르는 고객층에 다가갈 수 있도록 우리가 향을 골라주면 어떨까? 라는 생각에 향을 골라주는 개념의 디렉팅이라는 걸 기획 해보게 되었어요.

근데 여기서? 저희는 휴식을 키워드로 골랐으니까. 향을 골라주는 것에서 더 발전시켜서 고객들의 휴식에 대한 고민도 풀어주면 좋겠다 생각을 하게 되었어요.

사실 대부분의 사람들이 쉴 때 자거나 OTT를 보거나 릴스숏츠를 보신다고 하는데.. 근데 정말 이게 쉰걸까? 하는 고민도 있고 분명 몸은 편하게 누워있는데, 스트레스는 안없어지니까 머리는 아프고 쉬어도 쉰거 같지가 않다는 말도 많이 하시구요.(특히 직장인 분들 ㅎ) 그래서 이런 두가지 유형을 다 잡을 수 있도록 디렉팅 세션이라는 것을 넣어서 패키지 제품 구성을 생각해봤어요.

➖➖➖➖➖➖➖➖➖

🏆브랜드 차별점 2 = 프로그램 패키지

그래서 저희가 기획한 제품은 이런 식이에요.
고객이 제품을 구매하거나 선물하면 먼저는 디렉팅이라는 프로그램을 통해 내가 어떨 때 스트레스에서 벗어나서 휴식을 하는지 찾아보고 그 휴식시간에 딱 맞는 향 골라 드리고, 저희 제품을 배송해드린뒤, 이 후에 리츄얼 워크북이라고 해서 사쉐의 향이 남아있는 시간동안 가볍게 해볼 수 있는 스탬프 다이어리를 어플로 드려요. QnA 100, 이런거 해보셨나요? 그런 느낌이에요. 이렇게 패키지 형태로 제품을 기획해봤어요.


⚠️매칭 설명 중요⚠️
디렉팅은 크게 두 가지 챕터가 있는데, 먼저 휴식을 방해하는 스트레스 요소 찾기. 우리가 진짜 마음까지 편안한 휴식을 하려면 내가 어떤 스트레스들을 받고 있는지를 먼저 알아야 그걸 벗어난 진짜 재충전의 휴식을 할 수 있다고 생각이 들어서 넣었어요. 그리고 두번째로 스트레스를 벗어나는 생각 루틴 찾기와 그걸 도와줄 수 있는 휴식의 향 고르기. 이렇게 잡아봤어요.

❓ 어떨때 좀 스트레스를 많이 받는 거 같으세요?
» 저는 ~~할떄 스트레스를 받는데, 그럴때 그냥 단거를 먹어버리고 케이크 사서 집가서 유튜브 보면서 퍼먹고.. 그렇게 하는데 그러고 나면 쉬었는데 오히려 기분이 더 안좋아지더라구요! 그래서 이런 방향으로의 휴식이 아닌, 진짜 스트레스를 해소하고 재충전이 되는 휴식을 찾아보면 시간이 디렉팅이에요.

❓들어보셨을때 제품 기획이 좀 어떻게 느껴지시나요?
» 저희가 이렇게 여쭤보고 다니다보니 향수나 향은 그냥 내가 골라서 사는건데 왜 너네가 골라주냐. 이런 의견도 있고, 제품 구성이 번잡한것 같다. 이런 의견도 좀 있더라구요. 좀 어떻게 느껴지세요?

✅ 긍정적 » 오 그렇군요.. 어떤게 좀 좋다고 느껴지셨어요? (대답듣고) 구렇구나..! 그럼 이 패키지 상품! 얼마면 살 것 같다! (마이크 넘기듯이, 대답 듣고) 아 음.... 변수인데.... 그 가격을 얘기해주신 이유가 있으시다면?
음음... 그렇군요... 아 저희도 고민이 많은 것 같아요. 긍정적으로 평가해주시는 분들은 많이 계신데 그렇게 끌리지는 않는다고 얘기해주시는 분들도 계셔서, 저희가 진짜 실제로 제품을 받아서 써보시고 의견을 주실 분들이 좀 필요한데, 저희가 제품을 비용없이 제공해드릴테니 디렉팅도 받아보시고 사쉐 제품도 받아서 써보시고 어떘는지, 얼마정도면 괜찮을 것 같은지 의견을 주실 수 있으실까요? 추가적인 비용은 절대 없고 딱 디렉팅, 제품 수령만 하시면 돼요!

❎  부정적 » 아 그렇군요.. 어떤게 좀 애매하다고 느껴지셨어요?
귀찮은거같다, 그정도는 시간을 안쓸거 같다 » 아하.. 그러게요 이게 아무래도 그냥 사쉐를 올영가서 주워오는게 아니다보니..  그렇게 느끼기도 하시더라구요. 저희도 고민이 많은 것 같아요.. 음... 근데 저희가 또 생각하는건 선물받은 입장의 고객인데, 내가 사지 않았지만 선물이니까 한번 사용해봤는데 괜찮네? 싶으면 또 다른 사람한테 선물하고 싶어질 수도 있을거 같아서요. 저희가 진짜 실제로 제품을 받아서 써보시고 의견을 주실 분들이 좀 필요한데, 저희가 제품을 비용없이 제공해드릴테니 디렉팅도 받아보시고 사쉐 제품도 받아서 써보시고 어떘는지, 얼마정도면 괜찮을 것 같은지 의견을 주실 수 있으실까요? 추가적인 비용은 절대 없고 딱 디렉팅, 제품 수령만 하시면 돼요!

➖➖➖➖➖➖➖➖➖

🙏 매칭 띄운 이후

❎대면 부담 분기 » 아 음... 그렇구나... 사실 저희도 이 만나서 한다는 경험에 대해서 고민이긴 해요. 그렇지만 이게 저희는 단순히 향을 팔고 싶은게 아니라 내 스트레스에 대해 생각하고, 진짜 휴식을 찾아가는 경험을 판다는 생각도 있다보니, 그 경험이 기억에 남을만하게, 더 만족스럽게 제공하고 싶어서 오프라인으로 생각하고 있긴 했어요. 30-40분의 시간으로 내 스트레스 원인도 찾고, 어울리는 향도 찾는거죠. 어때요?
          ▼
❎그래도 대면은 좀.. » 그렇구나 대면으로 했다고 했을때, 어떤게 제일 소비자들에게 외면 받을 것 같아요? (대답 듣고) 음... 그러면 이거를 온라인으로 굴리면 어떨 것 같아요? 저희가 이런 의견들을 받으면서 온라인으로 안하고 싶긴 했는데 수요가 있을 거 같긴 해서 준비를 해놓긴 했거든요. 온라인이 더 잘 팔릴거 같다고 느끼세요? 같은 가격이더라도?
          ▼
✅온라인이 낫다고 하면 »  아 그렇구나... 그러면 한번 체험해보시고 의견 주실 수 있을까요? -> 만픽
줌은 반드시 먼저 띄우지 않고, 온라인으로 하면 자기는 하고싶다라고 명확하게 먼저 밝히는 인원들에게만 멘트 사용해주시고 만픽 잡으시면 됩니다.
✅ 긍정 분기 » 바로 만픽하고 일정 파악하시면 됩니다~

➖➖➖➖➖➖➖➖➖`

const scriptModalOpen = ref(false)
const scriptTab = ref('tm')   // 'tm' | 'welcome' | 'noAnswer'
const scriptModes = reactive({ tm: 'default', welcome: 'default', noAnswer: 'default' })
const personalScripts = reactive({ tm: '', welcome: '', noAnswer: '' })
const scriptDrafts = reactive({ tm: '', welcome: '', noAnswer: '' })
const scriptOpen = reactive({})           // { [docId]: boolean } — 카드별 스크립트 펼침

const activeScriptText = computed(() => {
  return (scriptModes.tm === 'personal' && personalScripts.tm) ? personalScripts.tm : DEFAULT_SCRIPT
})

async function loadScript() {
  for (const scriptType of ['tm', 'welcome', 'noAnswer']) {
    const r = await callApiPromise('/api/get-tm-script', { scriptType }).catch(() => null)
    if (r?.success) {
      scriptModes[scriptType] = r.mode || 'default'
      personalScripts[scriptType] = r.text || ''
    }
  }
}
function switchScriptTab(tab) {
  scriptTab.value = tab
  scriptDrafts[tab] = personalScripts[tab]
}
function openScriptModal(tab = 'tm') {
  scriptTab.value = tab
  scriptDrafts[tab] = personalScripts[tab]
  scriptModalOpen.value = true
}
async function savePersonalScript() {
  const tab = scriptTab.value
  personalScripts[tab] = scriptDrafts[tab]
  await callApiPromise('/api/save-tm-script', {
    data: { scriptType: tab, mode: scriptModes[tab], text: personalScripts[tab] },
  }).catch(() => null)
  showToast('저장됐어요!')
}
function toggleScript(docId) {
  scriptOpen[docId] = !scriptOpen[docId]
}

// ── 유틸 ─────────────────────────────────────────────────────────────
function normPhone(p) { return String(p || '').replace(/[^0-9]/g, '') }
function copyPhone(phone) {
  if (!phone) return
  navigator.clipboard.writeText(phone).catch(() => {})
  showToast('📋 ' + phone + ' 복사됨')
}

const ddochiPhones = computed(() => new Set(shedProspects.value.map(p => normPhone(p.phone))))

// 동적 탭: 모든 카드의 유효팀을 수집해 정렬, 앞에 '전체' 추가
const TABS = computed(() => {
  const set = new Set()
  for (const p of shedProspects.value) { const t = prospectEffTeam(p); if (t) set.add(t) }
  for (const r of filteredAsRows.value) { const t = rowEffTeam(r); if (t) set.add(t) }
  return ['전체', ...[...set].sort()]
})

const ddochiListAll = computed(() => {
  if (activeTab.value === '전체') return shedProspects.value
  return shedProspects.value.filter(p => prospectEffTeam(p) === activeTab.value)
})

const ddochiList = computed(() => {
  const today = new Date().toISOString().slice(0, 10)
  const filtered = ddochiListAll.value.filter(p => {
    if (p.hasHabjaeyang) return false  // Section D에서 별도 표시
    if (p.isDropped && p.droppedReason === '반려') return false  // Section B 반려 토글에서 별도 표시
    return showEnded.value ? isFinal(p) : !isFinal(p)
  })
  return filtered.slice().sort((a, b) => {
    const aLong = isLongTermReserved(a), bLong = isLongTermReserved(b)
    if (aLong !== bLong) return aLong ? 1 : -1  // 장기(72시간 초과 예약)는 맨 아래
    if (aLong && bLong) return String(a.reservedAt).localeCompare(String(b.reservedAt))
    const aToday = !!(a.reservedAt && String(a.reservedAt).startsWith(today))
    const bToday = !!(b.reservedAt && String(b.reservedAt).startsWith(today))
    if (aToday !== bToday) return aToday ? -1 : 1
    if (aToday && bToday) return String(a.reservedAt).localeCompare(String(b.reservedAt))
    const aTs = a.lastTmTs || ''
    const bTs = b.lastTmTs || ''
    if (!aTs && !bTs) return 0
    if (!aTs) return -1  // 한 번도 안 돈 사람 → 맨 위
    if (!bTs) return 1
    return aTs.localeCompare(bTs)  // 오래된 순
  })
})

const visibleDdochiList = computed(() =>
  callingDocId.value && !isDesktop.value
    ? ddochiList.value.filter(p => p.docId.toUpperCase() === callingDocId.value)
    : ddochiList.value
)

// ── 데스크탑 레이아웃 ──────────────────────────────────────────────────
const isDesktop = ref(false)
function checkDesktop() { isDesktop.value = window.innerWidth >= 1024 }
const callingProspect = computed(() =>
  callingDocId.value ? ddochiList.value.find(p => p.docId.toUpperCase() === callingDocId.value) : null
)

const unregList = computed(() => {
  const list = filteredAsRows.value.filter(r => !ddochiPhones.value.has(normPhone(r.phone)))
  if (activeTab.value === '전체') return list
  return list.filter(r => rowEffTeam(r) === activeTab.value)
})

const hjNeededList = computed(() => {
  // STAGE='만픽'은 만남픽스는 됐는데 합재양은 아직 안 쓴 상태 — 합재양을 쓰는 순간
  // STAGE가 '합재양'으로 넘어가니(submit_result 쪽), 이 조건 하나로 충분함.
  const base = shedProspects.value.filter(p => p.status === '만픽')
  if (activeTab.value === '전체') return base
  return base.filter(p => prospectEffTeam(p) === activeTab.value)
})

const doneList = computed(() => {
  const base = shedProspects.value.filter(p => p.hasHabjaeyang)
  if (activeTab.value === '전체') return base
  return base.filter(p => prospectEffTeam(p) === activeTab.value)
})

const rejRows = ref([])
const rejectedList = computed(() => {
  if (activeTab.value === '전체') return rejRows.value
  return rejRows.value.filter(r => rowEffTeam(r) === activeTab.value)
})

const tabUnregCount = computed(() => {
  const m = {}
  const unreg = filteredAsRows.value.filter(r => !ddochiPhones.value.has(normPhone(r.phone)))
  for (const tab of TABS.value) {
    if (tab === '전체') continue
    m[tab] = unreg.filter(r => rowEffTeam(r) === tab).length
  }
  return m
})

const tabActiveCount = computed(() => {
  const m = {}
  for (const tab of TABS.value) {
    if (tab === '전체') continue
    m[tab] = shedProspects.value.filter(p => prospectEffTeam(p) === tab && !isFinal(p)).length
  }
  return m
})

// ── 통합 검색 computed ────────────────────────────────────────────────
const shedSearchNorm = computed(() => shedSearchQuery.value.trim().toLowerCase())
const shedSearchDigits = computed(() => shedSearchQuery.value.replace(/[^0-9]/g, ''))

function matchesShedSearch(q, qDigits, name, introducer, phone, tmLogs) {
  if (q) {
    if ((name || '').toLowerCase().includes(q)) return true
    if ((introducer || '').toLowerCase().includes(q)) return true
    if (tmLogs?.length) {
      for (const log of tmLogs) {
        if ((log.line || '').toLowerCase().includes(q)) return true
      }
    }
  }
  if (qDigits && phone && normPhone(phone).includes(qDigits)) return true
  return false
}

const searchUnregList = computed(() => {
  const q = shedSearchNorm.value
  const qd = shedSearchDigits.value
  if (!q) return []
  return unregList.value.filter(r =>
    matchesShedSearch(q, qd, r.name, r.introducer, r.phone, null)
  )
})
const searchTmActiveList = computed(() => {
  const q = shedSearchNorm.value
  const qd = shedSearchDigits.value
  if (!q) return []
  return shedProspects.value.filter(p => !isFinal(p) &&
    matchesShedSearch(q, qd, p.name, p.shedMeta?.introducer, p.phone, p.tmLogs)
  )
})
const searchTmDoneList = computed(() => {
  const q = shedSearchNorm.value
  const qd = shedSearchDigits.value
  if (!q) return []
  return shedProspects.value.filter(p => isFinal(p) &&
    matchesShedSearch(q, qd, p.name, p.shedMeta?.introducer, p.phone, p.tmLogs)
  )
})

// ── 데이터 로드 ───────────────────────────────────────────────────────
function initNoteState(p) {
  if (noteToggles[p.docId] === undefined) {
    noteToggles[p.docId] = new Set(p.tmNote?.toggles || [])
    noteText[p.docId] = p.tmNote?.text || ''
  }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const ddochiRes = await callApiPromise('/api/get-shed-prospects', { data: {} })
    // sarang 스키마 응답(sarangId/habJaeYang/timeline)을 기존 컴포넌트가 쓰는 필드명으로 매핑.
    allShedProspects.value = ddochiRes?.success ? (ddochiRes.list || []).map(p => ({
      ...p,
      docId: p.sarangId,
      status: p.stage,
      region: p.inflowDetails?.regionName,
      managerName: p.inflowMemberName,
      guideName: p.habJaeYang?.guideName || '',
      hasGuide: !!p.habJaeYang?.guideName,
      hjTmName: p.habJaeYang?.callerName || '',
      hasHabjaeyang: !!p.habJaeYang,
      createdTs: p.createdAt,
      reservedAt: p.inflowDetails?.tmReservedAt,
      shedMeta: {
        mbti: p.mbti,
        env: p.inflowDetails?.env,
        reaction: p.inflowDetails?.reaction,
        introducer: p.inflowDetails?.introducerName,
        helperNames: p.inflowDetails?.helperNames,
        tmLocation: p.inflowDetails?.location,
      },
      tmLogs: p.timeline || [],
      lastTmLine: p.timeline?.[0]?.label || null,
      lastTmTs: p.timeline?.[0]?.createdAt || null,
    })) : []
    for (const p of allShedProspects.value) initNoteState(p)
  } catch (e) {
    error.value = e.message
  }
  loading.value = false

  // DB pending 건 로드 (자동이관된 미확인 건) — SARANG_INTAKE_QUEUE
  asLoading.value = true
  try {
    const asRes = await callApiPromise('/api/shed/pending-list').catch(() => null)
    asRows.value = asRes?.success ? (asRes.list || []).map(r => ({
      ...r,
      prospectId: r.intakeId,
      event: r.sourceLink,
      region: r.regionName,
      rest: r.mbti,
      tmLocation: r.location,
      introducer: r.introducerName,
    })) : []
  } catch {}
  asLoading.value = false

  // 반려된 큐 항목 (회생 가능)
  try {
    const rejRes = await callApiPromise('/api/shed/rejected-list').catch(() => null)
    rejRows.value = rejRes?.success ? (rejRes.list || []).map(r => ({
      ...r,
      event: r.sourceLink,
      region: r.regionName,
      rest: r.mbti,
      tmLocation: r.location,
      introducer: r.introducerName,
    })) : []
  } catch {}

  // 유입자 실제 소속팀으로 이관 — shed 링크 번호(SOURCE_LINK)는 신청 당시 고정값이라,
  // 유입자가 다른 팀 소속이면 그 팀 화면/탭에 뜨도록 event를 실제 팀으로 덮어씀.
  const names = [...new Set([...asRows.value, ...rejRows.value].map(r => r.introducer).filter(Boolean))]
  if (names.length) {
    try {
      const teamsRes = await callApiPromise('/api/shed/lookup-teams', { names }).catch(() => null)
      const teams = teamsRes?.ok ? teamsRes.teams || {} : {}
      for (const r of [...asRows.value, ...rejRows.value]) {
        if (teams[r.introducer]) r.event = teams[r.introducer]
      }
    } catch {}
  }
}

// ── 통화 폴링 ─────────────────────────────────────────────────────────
async function pollCalls() {
  try {
    const r = await callApiPromise('/api/shed-call-status', { data: { callingProspectId: callingDocId.value || null } })
    if (r?.success) {
      for (const k of Object.keys(callStatus)) delete callStatus[k]
      Object.assign(callStatus, r.calls || {})
      for (const k of Object.keys(presence)) delete presence[k]
      Object.assign(presence, r.presence || {})
    }
  } catch {}
}

function startPolling() { pollCalls(); pollTimer = setInterval(pollCalls, 3500) }
function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null } }

// ── 접속자 현황 ───────────────────────────────────────────────────────
const callingSabuns = computed(() => new Set(Object.values(callStatus).map((c) => c.callerSabun)))
const presenceEntries = computed(() =>
  Object.entries(presence)
    .map(([sabun, v]) => ({ sabun, name: v.name, isMe: sabun === auth.currentSabun, isCalling: callingSabuns.value.has(sabun) }))
)
const presenceCalling = computed(() => presenceEntries.value.filter((p) => p.isCalling).sort((a, b) => b.isMe - a.isMe))
const presenceWaiting = computed(() => presenceEntries.value.filter((p) => !p.isCalling).sort((a, b) => b.isMe - a.isMe))
async function leavePresence() {
  try { await callApiPromise('/api/shed-presence-leave', { data: {} }) } catch {}
}

// ── 전화걸기/끊기 ─────────────────────────────────────────────────────
async function startCall(p) {
  const pid = p.docId.toUpperCase()
  if (callingDocId.value && callingDocId.value !== pid) {
    showAppAlert('먼저 끊어주세요!')
    return
  }
  if (callingDocId.value === pid) return
  if (p.phone) {
    navigator.clipboard.writeText(p.phone).catch(() => {})
    showToast('📋 ' + p.phone + ' 복사됨')
  }
  const r = await callApiPromise('/api/shed-call-start', { data: { prospectId: pid } })
  if (r?.success) { callingDocId.value = pid; initNoteState(p) }
}

async function endCall() {
  if (!callingDocId.value) return
  await callApiPromise('/api/shed-call-end', { data: { prospectId: callingDocId.value } })
  callingDocId.value = null
  closeAction()
}

function isMyCalling(p) { return callingDocId.value === p.docId.toUpperCase() }
function isOtherCalling(p) { return !!callStatus[p.docId.toUpperCase()] && !isMyCalling(p) }
function callerOf(p) { return callStatus[p.docId.toUpperCase()]?.callerName || '' }
function hasWelcomeMsg(p) { return p.tmLogs?.some(l => l.category === 'welcomeMsg') }
// "실제 통화 시도가 있었는지" 판단(예약 시간 표시용) — 선문자/부재중문자 발송은
// 통화를 시도한 게 아니라서 이걸로 기존 예약을 무효화하면 안 됨. source==='call'인
// TM_LOGS 기반 로그만 셈(유입, 문자발송 같은 activity/inflow는 제외).
function hasRealLog(p) { return p.tmLogs?.some(l => l.source === 'call') }

// 펼친 로그 목록도 최신순 — p.tmLogs 자체가 이미 최신순 정렬이라(배지/요약 로직이
// [0]=최신에 의존) 그대로 씀.
function orderedLogs(logs) {
  return logs || []
}

// ── 선문자 ────────────────────────────────────────────────────────────
function openWelcomeMsg(p) {
  welcomeMsgTarget.value = { docId: p.docId, phone: p.phone, name: p.name, age: p.age }
  welcomeChecked.value = false
  if (p.phone) {
    navigator.clipboard.writeText(p.phone).catch(() => {})
    showToast('📋 ' + p.phone + ' 복사됨')
  }
}
function closeWelcomeMsg() { welcomeMsgTarget.value = null }
function copyWelcomePhone() {
  const phone = welcomeMsgTarget.value?.phone
  if (!phone) return
  navigator.clipboard.writeText(phone).catch(() => {})
  showToast('📋 ' + phone + ' 복사됨')
}
function copyWelcomeScript() {
  const text = (scriptModes.welcome === 'personal' && personalScripts.welcome) ? personalScripts.welcome : DEFAULT_WELCOME_SCRIPT
  navigator.clipboard.writeText(text).catch(() => {})
  showToast('📋 스크립트 복사됨')
}
async function doWelcomeMsg() {
  if (!welcomeChecked.value || welcomeSaving.value) return
  welcomeSaving.value = true
  const r = await callApiPromise('/api/submit-result', { data: { rowIndex: welcomeMsgTarget.value.docId, logType: '선문자' } })
  welcomeSaving.value = false
  if (r?.success) { closeWelcomeMsg(); showToast('선문자 완료!'); load() }
  else showAppAlert(r?.message || '오류')
}

// ── TM 노트 ───────────────────────────────────────────────────────────
function toggleTag(docId, tag) {
  if (!noteToggles[docId]) noteToggles[docId] = new Set()
  if (noteToggles[docId].has(tag)) noteToggles[docId].delete(tag)
  else noteToggles[docId].add(tag)
  scheduleNoteSave(docId)
}

function onNoteInput(docId, e) {
  noteText[docId] = e.target.value
  scheduleNoteSave(docId)
}

function scheduleNoteSave(docId) {
  if (noteTimers[docId]) clearTimeout(noteTimers[docId])
  noteTimers[docId] = setTimeout(() => {
    callApiPromise('/api/shed-note-save', {
      data: { prospectId: docId.toUpperCase(), toggles: Array.from(noteToggles[docId] || []), text: noteText[docId] || '' },
    })
  }, 800)
}

// ── TM 액션 ───────────────────────────────────────────────────────────
function openAction(docId, type) {
  if (actionTarget.value?.docId === docId && actionTarget.value?.type === type) {
    actionTarget.value = null
  } else {
    actionTarget.value = { docId, type }
    reserveDate.value = ''
  }
}
function closeAction() { actionTarget.value = null }

async function doNoAnswer(p) {
  if (saving.value) return
  const hasNoAnswerMsg = p.tmLogs?.some(l => l.category === 'noAnswerMsg')
  if (!hasNoAnswerMsg) {
    noAnswerMsgTarget.value = { docId: p.docId, phone: p.phone, name: p.name, age: p.age }
    noAnswerChecked.value = false
    if (p.phone) {
      navigator.clipboard.writeText(p.phone).catch(() => {})
      showToast('📋 ' + p.phone + ' 복사됨')
    }
    return
  }
  saving.value = true
  const r = await callApiPromise('/api/submit-result', { data: { rowIndex: p.docId, logType: '안받음' } })
  saving.value = false
  if (r?.success) { showToast('안받음!'); if (isMyCalling(p)) await endCall(); load() }
  else showAppAlert(r?.message || '오류')
}

// ── 안받음 팝업 ──────────────────────────────────────────────────────
function closeNoAnswerMsg() { noAnswerMsgTarget.value = null }
function copyNoAnswerPhone() {
  const phone = noAnswerMsgTarget.value?.phone
  if (!phone) return
  navigator.clipboard.writeText(phone).catch(() => {})
  showToast('📋 ' + phone + ' 복사됨')
}
function copyNoAnswerScript() {
  const text = (scriptModes.noAnswer === 'personal' && personalScripts.noAnswer) ? personalScripts.noAnswer : DEFAULT_NO_ANSWER_SCRIPT
  navigator.clipboard.writeText(text).catch(() => {})
  showToast('📋 스크립트 복사됨')
}
async function cancelNoAnswerMsg() {
  const target = noAnswerMsgTarget.value
  closeNoAnswerMsg()
  saving.value = true
  const r = await callApiPromise('/api/submit-result', { data: { rowIndex: target.docId, logType: '안받음' } })
  saving.value = false
  if (r?.success) { showToast('안받음!'); load() }
  else showAppAlert(r?.message || '오류')
}
async function doNoAnswerWithMsg() {
  if (!noAnswerChecked.value || noAnswerSaving.value) return
  noAnswerSaving.value = true
  const target = noAnswerMsgTarget.value
  await callApiPromise('/api/submit-result', { data: { rowIndex: target.docId, logType: '안받음' } })
  const r = await callApiPromise('/api/submit-result', { data: { rowIndex: target.docId, logType: '안받문' } })
  noAnswerSaving.value = false
  if (r?.success) { closeNoAnswerMsg(); showToast('안받음 + 부재중문자 완료!'); load() }
  else showAppAlert(r?.message || '오류')
}

async function doReserve(p) {
  if (!reserveDate.value) return showAppAlert('날짜를 선택해주세요')
  if (saving.value) return
  saving.value = true
  const r = await callApiPromise('/api/submit-result', {
    data: { rowIndex: p.docId, logType: '티엠예약', tmNote: { nextCallDate: reserveDate.value } },
  })
  saving.value = false
  closeAction()
  if (r?.success) { showToast('예약 완료!'); if (isMyCalling(p)) await endCall(); load() }
  else showAppAlert(r?.message || '오류')
}

async function doMeetingFix(p) {
  if (saving.value) return
  showAppConfirm(`${p.name}님 만남픽스로 보고할거야?`, async (ok) => {
    if (!ok) return
    saving.value = true
    const r = await callApiPromise('/api/submit-result', { data: { rowIndex: p.docId, logType: '만남픽스' } })
    saving.value = false
    if (!r?.success) { showAppAlert(r?.message || '오류'); return }
    if (isMyCalling(p)) await endCall()
    showAppConfirm('합재양을 작성할거야?', (ok2) => {
      if (ok2) {
        goHabjaeyang(p)
      } else {
        showToast('만남픽스!')
        load()
      }
    })
  })
}

function goHabjaeyang(p) {
  // 번호찾 때 이미 파악된 정보 중 합재양 폼과 겹치는 것만 넘김 — 환경/일정/반응처럼
  // 개념이 애매하게 겹치는 건 자동 이관하면 오히려 혼동돼서 제외. 거주지 근처 역은
  // 현재 수집 경로가 없어 항상 비어있으므로 이관 대상에서 제외.
  tm.shedContext = {
    docId: p.docId,
    name: p.name,
    phone: p.phone,
    age: p.age,
    mbti: p.mbti,
    introducer: p.shedMeta?.introducer,
    memo: noteText[p.docId] || p.tmNote?.text || '',
  }
  router.push({ name: 'habjaeyang' })
}

async function submitBihap(p, reason) {
  if (saving.value) return
  saving.value = true
  const r = await callApiPromise('/api/submit-result', { data: { rowIndex: p.docId, logType: '비합처리', logContent: reason } })
  saving.value = false
  closeAction()
  if (r?.success) { showToast('비합처리!'); if (isMyCalling(p)) await endCall(); load() }
  else showAppAlert(r?.message || '오류')
}

async function submitGeojeol(p, reason) {
  if (saving.value) return
  saving.value = true
  const r = await callApiPromise('/api/submit-result', { data: { rowIndex: p.docId, logType: '거절처리', logContent: reason } })
  saving.value = false
  closeAction()
  if (r?.success) { showToast('거절처리!'); if (isMyCalling(p)) await endCall(); load() }
  else showAppAlert(r?.message || '오류')
}

async function submitMuyou(p, reason) {
  if (saving.value) return
  saving.value = true
  const r = await callApiPromise('/api/submit-result', { data: { rowIndex: p.docId, logType: '무효처리', logContent: reason } })
  saving.value = false
  closeAction()
  if (r?.success) { showToast('무효처리!'); if (isMyCalling(p)) await endCall(); load() }
  else showAppAlert(r?.message || '오류')
}

async function deleteLog(p, log) {
  showAppConfirm('이 로그를 삭제할까요?', async (ok) => {
    if (!ok) return
    const r = await callApiPromise('/api/delete-log', { rowIndex: p.docId, id: log.id, source: 'tm' })
    if (r?.success) { showToast('삭제됨!'); load() }
    else showAppAlert(r?.message || '삭제 실패')
  })
}

async function cancelHabjaeyang(p) {
  showAppConfirm(`${p.name}님의 합재양 제출을 취소할까요?\n만남픽스 로그도 함께 삭제되고 찾기현황판에서도 제거됩니다.`, async (ok) => {
    if (!ok) return
    cancelling.value = true
    const r = await callApiPromise('/api/cancel-shed-habjaeyang', { docId: p.docId })
    cancelling.value = false
    if (r?.success) { showToast('취소 완료!'); expandedDoneId.value = null; load() }
    else showAppAlert(r?.message || '취소 실패')
  })
}

async function doRegacha(p) {
  const inflowName = p.shedMeta?.introducer || ''
  const tmName = p.hjTmName || ''
  if (!inflowName || !tmName) { showAppAlert('유입자 또는 티엠자 정보가 없어요'); return }
  regachaProspect.value = p
  cancelling.value = true
  const r = await callApiPromise('/api/run-shed-gacha', {
    docId: p.docId,
    inflowName,
    tmName,
  })
  cancelling.value = false
  if (!r?.success) { showAppAlert(r?.message || '가챠 오류'); return }
  regachaResult.value = r
  regachaVisible.value = true
}

function onRegachaDone() {
  regachaVisible.value = false
  regachaResult.value = null
  regachaProspect.value = null
  expandedDoneId.value = null
  load()
}

function fmtTmDt(val) {
  if (!val) return ''
  const d = new Date(val)
  if (isNaN(d.getTime())) return String(val).replace('T', ' ').slice(0, 16)
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  const pad = n => String(n).padStart(2, '0')
  return `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth() + 1)}-${pad(kst.getUTCDate())} ${pad(kst.getUTCHours())}:${pad(kst.getUTCMinutes())}`
}

function copyProspect(p) {
  const lines = []
  lines.push(`${p.name}${p.age ? ` (${p.age}세)` : ''} / ${p.phone || '-'}`)
  if (p.region) lines.push(`지역: ${p.region}`)
  if (p.shedMeta?.env) lines.push(`환경: ${p.shedMeta.env}`)
  if (p.shedMeta?.reaction) lines.push(`반응: ${p.shedMeta.reaction}`)
  if (p.shedMeta?.introducer) lines.push(`유입: ${p.shedMeta.introducer}`)
  if (p.shedMeta?.helperNames) lines.push(`조력자: ${p.shedMeta.helperNames}`)
  if ((p.tmLogs?.[0]?.category === 'tmReserved' || !hasRealLog(p)) && p.reservedAt) {
    lines.push(`예약: ${p.reservedAt}`)
  } else if (p.noAnswerCount) {
    lines.push(`안받음: ${p.noAnswerCount}회`)
  }
  if (p.tmLogs?.[0]?.label) lines.push(`최근기록: ${fmtInflowTs(p.tmLogs[0].createdAt)} · ${p.tmLogs[0].label} · ${p.tmLogs[0].actorName || '-'}`)
  navigator.clipboard.writeText(lines.join('\n')).catch(() => {})
  showToast('📋 복사됨')
}

function fmtInflowTs(val) {
  if (!val) return ''
  const s = String(val)
  // "26.08.10 20:49" (YY.MM.DD HH:MM)
  const dotM = s.match(/^\d{2}\.(\d{2})\.(\d{2})\s+(\d{2}:\d{2})/)
  if (dotM) return dotM[1] + '/' + dotM[2] + ' ' + dotM[3]
  // "2026-08-10 20:49"
  const dashM = s.match(/^\d{4}-(\d{2})-(\d{2})\s+(\d{2}:\d{2})/)
  if (dashM) return dashM[1] + '/' + dashM[2] + ' ' + dashM[3]
  // ISO or Date.toString() fallback
  const d = new Date(s)
  if (!isNaN(d.getTime())) {
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return mm + '/' + dd + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
  }
  return ''
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

async function doRegister(asRow) {
  if (saving.value) return

  const isDup = asRow.numberStatus === 'pending_dup'
  const fields = [
    ['연락처', asRow.phone],
    ['지역', asRow.region],
    ['MBTI', asRow.rest],
    ['환경', asRow.env],
    ['반응', asRow.reaction],
    ['유입자', asRow.introducer],
    ['조력자', asRow.helperNames],
    ['유입장소', asRow.tmLocation],
  ].filter(([, v]) => v)

  const msg = [
    isDup ? '<div class="confirm-warn">⚠️ 이미 ddochi에 등록된 번호예요.</div>' : '',
    `<div class="confirm-head">[${escapeHtml(asRow.event)}팀] ${escapeHtml(asRow.name)}${asRow.age ? ` <span class="confirm-age">(${escapeHtml(asRow.age)}세)</span>` : ''}</div>`,
    '<div class="confirm-grid">' + fields.map(([k, v]) => `<span class="k">${k}</span><span class="v">${escapeHtml(v)}</span>`).join('') + '</div>',
    `<div class="confirm-q">${isDup ? '그래도 이관받을까요?' : '이관받을까요?'}</div>`,
  ].filter(Boolean).join('')

  showAppConfirm(msg, async (ok) => {
    if (!ok) return
    saving.value = true
    const r = await callApiPromise('/api/shed-register', { intakeId: asRow.prospectId })
    saving.value = false
    if (r?.success) { showToast('등록 완료!'); load() }
    else if (r?.duplicates?.length > 0) {
      shedDupList.value = r.duplicates
      shedDupExistingId.value = r.existingId
    }
    else showAppAlert(r?.message || '등록 실패')
  })
}

function closeShedDupPopup() {
  shedDupList.value = []
  shedDupExistingId.value = null
}

async function rejectShedDup() {
  const existingId = shedDupExistingId.value
  closeShedDupPopup()
  if (!existingId) return
  const r = await callApiPromise('/api/shed-reject-duplicate', { data: { existingId } })
  if (r?.success) showToast('반려 처리 완료')
  else showAppAlert(r?.message || '반려 처리 실패')
}

async function doReject(asRow) {
  if (saving.value) return
  const msg = [
    `[${asRow.event}팀] ${asRow.name}${asRow.age ? ` (${asRow.age}세)` : ''}`,
    `연락처 : ${asRow.phone || '-'}`,
    '',
    '반려하시겠어요? (반려 목록에서 회생 가능)',
  ].join('\n')
  showAppConfirm(msg, async (ok) => {
    if (!ok) return
    saving.value = true
    const r = await callApiPromise('/api/shed-pending-reject', { intakeId: asRow.prospectId })
    saving.value = false
    if (r?.success) { showToast('반려 처리 완료'); load() }
    else showAppAlert(r?.message || '반려 실패')
  })
}

async function doRevive(row) {
  if (saving.value) return
  showAppConfirm(`${row.name} 을(를) 회생시킬까요?\n이관받기 목록으로 복귀됩니다.`, async (ok) => {
    if (!ok) return
    saving.value = true
    const r = await callApiPromise('/api/shed-pending-revive', { intakeId: row.intakeId })
    saving.value = false
    if (r?.success) { showToast('회생 완료!'); load() }
    else showAppAlert(r?.message || '회생 실패')
  })
}

// ── 헬퍼 ─────────────────────────────────────────────────────────────
const TM_STATUS_LABEL = { before:'하기전', active:'진행가능', reserved:'예약됨', longTerm:'장기', done:'끝난거' }
const TM_STATUS_COLOR = { before:'#757575', active:'#7CB342', reserved:'#7B1FA2', longTerm:'#795548', done:'#388E3C' }
const LONG_TERM_HOURS = 72

// 만남픽스(STAGE='만픽')는 티엠 관점에선 끝난 건이라 종료 처리 — 진행중 목록에서
// 빠지고 "종료" 토글 안에서만 보임. 합재양 작성 전까지는 hjNeededList(Section C)에
// 별도로도 노출돼서(합재양 작성하기 버튼과 함께) 놓치지 않게 함. 합재양을 쓰면
// hasHabjaeyang=true가 되어 ddochiList에서 아예 빠지고 Section D(doneList)로 감.
function isFinal(p) { return p.isDropped || p.status === '만픽' }
// 예약일이 지금부터 72시간 넘게 남았으면 '장기' — reservedAt 기준으로 매 로드 시점마다 재계산
// (별도 DB 상태/크론 없음 — 화면 새로고침할 때마다 항상 최신으로 맞음)
function isLongTermReserved(p) {
  if (!p.reservedAt) return false
  const d = new Date(String(p.reservedAt).replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return false
  return d.getTime() - Date.now() > LONG_TERM_HOURS * 60 * 60 * 1000
}
// TM_STATUS가 없어져서(스펙 원안 복귀) reservedAt 유무·잔여시간만으로 판단 —
// 실제로도 이 배지는 예약됨/장기 둘만 의미 있게 쓰이고 있었음(하기전/진행가능/
// 끝난거는 각각 필터링되거나 다른 섹션으로 빠져서 여기 안 보임).
// 예약시간 메타줄과 같은 기준: 실제 통화기록이 생기면(그 결과가 재예약이 아닌 한)
// 옛 예약은 더 이상 유효하지 않은 걸로 봄 — 안 그러면 안받음/거절 처리해도
// "예약됨" 배지만 계속 남는 모순이 생김.
function displayTmStatus(p) {
  if (!p.reservedAt) return null
  if (hasRealLog(p) && p.tmLogs?.[0]?.category !== 'tmReserved') return null
  return isLongTermReserved(p) ? 'longTerm' : 'reserved'
}
function formatReservedAt(s) {
  // Django(:8000)는 "YYYY-MM-DDTHH:MM:SSZ" ISO 형식으로 내려줌 — 옛 백엔드의
  // "YYYY-MM-DD HH:MM"(공백 구분) 형식도 같이 지원
  const m = String(s || '').match(/^\d{4}-(\d{2})-(\d{2})[ T](\d{2}:\d{2})/)
  return m ? `${m[1]}/${m[2]} ${m[3]}` : s
}
function finalLabel(p) {
  if (p.isDropped) return p.droppedReason || '종료'
  if (p.status === '만픽') return '만남픽스, 합재양 작성 필요'
  return p.status || '끝'
}

// ── 라이프사이클 ──────────────────────────────────────────────────────
onMounted(() => { checkDesktop(); window.addEventListener('resize', checkDesktop); load(); loadScript(); startPolling() })
onUnmounted(() => { window.removeEventListener('resize', checkDesktop); stopPolling(); if (callingDocId.value) endCall(); leavePresence() })
onBeforeRouteLeave(async () => { stopPolling(); if (callingDocId.value) await endCall(); await leavePresence() })
</script>

<template>
  <div class="sy-screen">
    <!-- 상단 바 -->
    <div class="sy-topbar">
      <button class="sy-back" @click="router.back()">←</button>
      <span class="sy-title">{{ isQualityFind ? '🌿 질적 찾기' : '🐑 선한 양치기' }}</span>
      <button class="sy-script-reg" @click="openScriptModal('tm')">📝 스크립트 등록</button>
      <button class="sy-refresh" @click="load" :disabled="loading">↻</button>
      <button class="sy-search-btn" @click="showShedSearch = true; nextTick(() => shedSearchInputRef?.focus())">🔍 검색</button>
    </div>

    <!-- 접속자 현황 -->
    <div v-if="presenceEntries.length > 0" class="sy-presence">
      <span class="sy-presence-label">👀 지금 보는 중 ({{ presenceEntries.length }})</span>
      <div class="sy-presence-chips">
        <span
          v-for="p in presenceCalling" :key="p.sabun"
          class="sy-presence-chip calling" :class="{ me: p.isMe }"
        >🔴 {{ p.isMe ? '나' : p.name }}</span>
        <span
          v-for="p in presenceWaiting" :key="p.sabun"
          class="sy-presence-chip" :class="{ me: p.isMe }"
        >{{ p.isMe ? '나' : p.name }}</span>
      </div>
    </div>

    <!-- 탭 -->
    <div class="sy-tabs">
      <button
        v-for="t in TABS" :key="t"
        class="sy-tab" :class="{ on: activeTab === t }"
        @click="activeTab = t"
      >
        {{ t }}
        <span v-if="t !== '전체' && tabUnregCount[t]" class="sy-tab-badge sy-tab-badge-unreg">{{ tabUnregCount[t] }}</span>
        <span v-else-if="t !== '전체' && tabActiveCount[t]" class="sy-tab-badge sy-tab-badge-active">{{ tabActiveCount[t] }}</span>
      </button>
    </div>

    <div v-if="loading" class="sy-loading">
      <div class="sy-spinner"></div>
      <div>불러오는 중...</div>
    </div>
    <div v-else-if="error" class="sy-error">⚠️ {{ error }}</div>

    <div v-else class="sy-wrap" :class="{ 'scroll-locked': callingDocId && !isDesktop, 'sy-wrap-desktop': isDesktop }">
      <div class="sy-left">

      <!-- ── Section B: ddochi 미등록 (최우선) ── -->
      <template v-if="!callingDocId || isDesktop">
        <div class="sy-section-label sy-section-label-row">
          <span>📋 ddochi 미등록{{ !asLoading && unregList.length ? ` (${unregList.length}명)` : '' }}</span>
          <div style="display:flex;gap:6px;align-items:center">
            <div v-if="asLoading" class="sy-spinner sy-spinner-sm"></div>
            <button v-if="rejectedList.length || showRejected" class="sy-endtoggle" :class="{ on: showRejected }" @click="showRejected = !showRejected">
              반려{{ rejectedList.length ? ` (${rejectedList.length})` : '' }}
            </button>
          </div>
        </div>

        <!-- 반려 목록 (이관받기에서 반려한 큐 항목 — 되살리면 이관받기 목록으로 복귀) -->
        <template v-if="showRejected">
          <div v-if="!rejectedList.length" class="sy-empty-sub">반려된 건이 없어요</div>
          <div v-else class="sy-cards">
            <div v-for="r in rejectedList" :key="r.intakeId" class="sy-card unreg" style="opacity:0.7">
              <div class="sy-card-header">
                <span class="sy-name">{{ r.name }}</span>
                <span v-if="r.age" class="sy-age">({{ r.age }}세)</span>
                <span v-if="r.createdAt" class="sy-inflow-ts">{{ fmtInflowTs(r.createdAt) }}</span>
                <span class="sy-link-badge sy-intr-badge">{{ rowEffTeam(r) }}</span>
                <span class="sy-final-badge">반려</span>
              </div>
              <div v-if="r.region || r.env || r.reaction || r.introducer || r.tmLocation || r.rest" class="sy-fields">
                <span v-if="r.region" class="sy-field"><b>지역</b>{{ r.region }}</span>
                <span v-if="r.rest" class="sy-field"><b>MBTI</b>{{ r.rest }}</span>
                <span v-if="r.env" class="sy-field"><b>환경</b>{{ r.env }}</span>
                <span v-if="r.reaction" class="sy-field"><b>반응</b>{{ r.reaction }}</span>
                <span v-if="r.introducer" class="sy-field"><b>유입</b>{{ r.introducer }}</span>
                <span v-if="r.helperNames" class="sy-field"><b>조력자</b>{{ r.helperNames }}</span>
                <span v-if="r.tmLocation" class="sy-field"><b>유입장소</b>{{ r.tmLocation }}</span>
              </div>
              <div class="sy-actions" style="margin-top:6px;">
                <button class="ab reg" @click="doRevive(r)" :disabled="saving">회생하기</button>
              </div>
            </div>
          </div>
        </template>

        <!-- 미등록 목록 -->
        <template v-else>
          <div v-if="asLoading" class="sy-as-loading-row">불러오는 중...</div>
          <div v-else-if="unregList.length" class="sy-cards">
            <div v-for="(r, i) in unregList" :key="i" class="sy-card unreg">
              <div class="sy-card-header">
                <span class="sy-name">{{ r.name }}</span>
                <span v-if="r.age" class="sy-age">({{ r.age }}세)</span>
                <span v-if="r.timestamp" class="sy-inflow-ts">{{ fmtInflowTs(r.timestamp) }}</span>
                <span v-if="r.numberStatus === 'pending_dup'" class="sy-link-badge" style="background:#ff5252;color:#fff;">중복</span>
                <span class="sy-link-badge sy-intr-badge">{{ rowEffTeam(r) }}</span>
              </div>
              <div v-if="r.region || r.env || r.reaction || r.introducer || r.tmLocation || r.rest" class="sy-fields">
                <span v-if="r.region" class="sy-field"><b>지역</b>{{ r.region }}</span>
                <span v-if="r.rest" class="sy-field"><b>MBTI</b>{{ r.rest }}</span>
                <span v-if="r.env" class="sy-field"><b>환경</b>{{ r.env }}</span>
                <span v-if="r.reaction" class="sy-field"><b>반응</b>{{ r.reaction }}</span>
                <span v-if="r.introducer" class="sy-field"><b>유입</b>{{ r.introducer }}</span>
                <span v-if="r.helperNames" class="sy-field"><b>조력자</b>{{ r.helperNames }}</span>
                <span v-if="r.tmLocation" class="sy-field"><b>유입장소</b>{{ r.tmLocation }}</span>
              </div>
              <div class="sy-actions" style="margin-top:6px;">
                <button class="ab reg" @click="doRegister(r)" :disabled="saving">이관받기</button>
                <button class="ab cancel" @click="doReject(r)" :disabled="saving">반려하기</button>
              </div>
            </div>
          </div>
          <div v-else class="sy-empty-sub">미등록 건이 없어요</div>
        </template>
      </template>

      <!-- ── Section C: 합재양 작성 필요 ── -->
      <template v-if="hjNeededList.length && (!callingDocId || isDesktop)">
        <div class="sy-section-label sy-section-label-row" style="margin-top:16px">
          <span>📝 합재양 작성 필요 ({{ hjNeededList.length }}명)</span>
        </div>
        <div class="sy-cards">
          <div v-for="p in hjNeededList" :key="p.docId" class="sy-card hj-needed">
            <div class="sy-card-header">
              <span class="sy-name">{{ p.name }}</span>
              <span v-if="p.age" class="sy-age">({{ p.age }}세)</span>
              <span v-if="p.createdTs" class="sy-inflow-ts">{{ fmtInflowTs(p.createdTs) }}</span>
              <span class="sy-link-badge sy-intr-badge">{{ p.team + '팀' }}</span>
              <span class="sy-tm-badge" style="background:#1565C0">만남픽스✓</span>
            </div>
            <div class="sy-actions" style="margin-top:6px">
              <button class="ab reg" @click="goHabjaeyang(p)">합재양 작성하기</button>
              <button class="ab cancel" @click="deleteLog(p, p.tmLogs[0])">되돌리기</button>
            </div>
          </div>
        </div>
      </template>

      <!-- ── Section A: ddochi TM 관리 ── -->
      <template v-if="ddochiListAll.length">
        <div class="sy-section-label sy-section-label-row" style="margin-top:16px">
          <span>🗂️ ddochi TM 관리 ({{ ddochiList.length }}명)</span>
          <button class="sy-endtoggle" :class="{ on: showEnded }" @click="showEnded = !showEnded">
            {{ showEnded ? '종료' : '진행' }}
          </button>
        </div>

        <div v-if="!ddochiList.length" class="sy-empty-sub">
          {{ showEnded ? '종료된 건이 없어요' : '진행중인 건이 없어요' }}
        </div>

        <div v-else class="sy-cards">
          <div v-for="p in visibleDdochiList" :key="p.docId" class="sy-card"
               :class="{ final: isFinal(p), 'sy-card-calling': isMyCalling(p) && !isDesktop, 'sy-card-active-desktop': isMyCalling(p) && isDesktop }">

            <button class="sy-copy-btn" @click.stop="copyProspect(p)">복사</button>

            <!-- 스크롤 영역 (통화중 모바일: flex 1, overflow-y auto) -->
            <div :class="{ 'sy-card-scroll-area': isMyCalling(p) && !isDesktop }">

              <!-- 헤더 -->
              <div class="sy-card-header">
                <span class="sy-name">{{ p.name }}</span>
                <span v-if="p.age" class="sy-age">({{ p.age }}세)</span>
                <template v-if="!isFinal(p)">
                  <span v-if="isOtherCalling(p)" class="sy-calling-badge">🔴 통화중 ({{ callerOf(p) }})</span>
                  <span v-else-if="isMyCalling(p) && isDesktop" class="sy-calling-mine-badge">🟢 통화중</span>
                  <button v-else-if="!isMyCalling(p) && !hasWelcomeMsg(p)" class="sy-call-btn sy-call-btn-sm sy-welcome-btn" @click="openWelcomeMsg(p)">💌 선문자</button>
                  <button v-else-if="!isMyCalling(p)" class="sy-call-btn sy-call-btn-sm" @click="startCall(p)">📞 전화걸기</button>
                  <template v-else>
                    <span class="sy-phone-num" style="cursor:pointer;" @click="copyPhone(p.phone)">📞 {{ p.phone }}</span>
                    <button class="ab cancel hangup" @click="endCall">끊기</button>
                    <button class="sy-script-toggle" :class="{ on: scriptOpen[p.docId] }" @click="toggleScript(p.docId)">📝 스크립트</button>
                  </template>
                </template>
                <span v-if="p.createdTs" class="sy-inflow-ts">{{ fmtInflowTs(p.createdTs) }}</span>
                <span class="sy-link-badge sy-intr-badge">{{ p.team + '팀' }}</span>
                <span v-if="displayTmStatus(p)" class="sy-tm-badge" :style="{ background: TM_STATUS_COLOR[displayTmStatus(p)] || '#757575' }">
                  {{ TM_STATUS_LABEL[displayTmStatus(p)] || displayTmStatus(p) }}
                </span>
                <span v-if="isFinal(p)" class="sy-final-badge">{{ finalLabel(p) }}</span>
              </div>

              <!-- Shed 메타 -->
              <div class="sy-meta">
                <span v-if="p.tmLogs?.[0]?.category === 'tmReserved' || (!hasRealLog(p) && p.reservedAt)" class="meta-reserved" :class="{ longterm: isLongTermReserved(p) }">{{ p.reservedAt ? formatReservedAt(p.reservedAt) : '예약됨' }}</span>
                <span v-else-if="p.noAnswerCount" class="meta-warn">안받음 {{ p.noAnswerCount }}회</span>
                <span v-if="p.shedMeta?.env" class="sy-field"><b>환경</b>{{ p.shedMeta.env }}</span>
                <span v-if="p.shedMeta?.reaction" class="sy-field"><b>반응</b>{{ p.shedMeta.reaction }}</span>
                <span v-if="p.shedMeta?.introducer" class="sy-field"><b>유입</b>{{ p.shedMeta.introducer }}</span>
                <span v-if="p.shedMeta?.helperNames" class="sy-field"><b>조력자</b>{{ p.shedMeta.helperNames }}</span>
                <span v-if="p.shedMeta?.tmLocation" class="sy-field"><b>유입장소</b>{{ p.shedMeta.tmLocation }}</span>
              </div>

              <!-- TM 로그 — 데스크탑은 우측 패널에 전체가 이미 보이니 왼쪽 카드는 항상 최근
                   1줄만. 모바일은 우측 패널이 없어서 통화중일 때만 전체 스크롤로 펼침. -->
              <div v-if="p.tmLogs?.length" class="sy-logs" :class="{ expanded: isMyCalling(p) && !isDesktop }">
                <div v-for="log in (isMyCalling(p) && !isDesktop ? orderedLogs(p.tmLogs) : p.tmLogs.slice(0, 1))" :key="log.id" class="sy-log-row">
                  <span class="sy-log-line">{{ fmtInflowTs(log.createdAt) }} · {{ log.label }} · {{ log.actorName || '-' }}</span>
                  <button class="sy-log-del" @click="deleteLog(p, log)" title="삭제">×</button>
                </div>
              </div>

              <!-- TM 액션 버튼 (모바일 통화중일 때만) -->
              <div v-if="!isFinal(p) && isMyCalling(p) && !isDesktop" class="sy-actions">

                <!-- 기본 버튼들 -->
                <template v-if="!actionTarget || actionTarget.docId !== p.docId">
                  <button class="ab na" @click="doNoAnswer(p)" :disabled="saving">안받음</button>
                  <button class="ab re" @click="openAction(p.docId, 'reserve')" :disabled="saving">예약</button>
                  <button class="ab mp" @click="doMeetingFix(p)" :disabled="saving">만남픽스</button>
                  <button class="ab bh" @click="openAction(p.docId, 'bihap')" :disabled="saving">비합</button>
                  <button class="ab gj" @click="openAction(p.docId, 'geojeol')" :disabled="saving">거절</button>
                  <button class="ab my" @click="openAction(p.docId, 'muyou')" :disabled="saving">무효</button>
                </template>

                <!-- 예약 -->
                <template v-else-if="actionTarget.type === 'reserve'">
                  <input class="sy-date-input" type="datetime-local" v-model="reserveDate" />
                  <button class="ab re" @click="doReserve(p)" :disabled="saving">저장</button>
                  <button class="ab cancel" @click="closeAction">취소</button>
                </template>

                <!-- 비합 서브사유 -->
                <template v-else-if="actionTarget.type === 'bihap'">
                  <div class="sy-subreasons">
                    <button v-for="opt in BIHAP_OPTS" :key="opt.code"
                      class="ab sub" @click="submitBihap(p, opt.code)" :disabled="saving">{{ opt.label }}</button>
                    <button class="ab cancel" @click="closeAction">취소</button>
                  </div>
                </template>

                <!-- 거절 서브사유 -->
                <template v-else-if="actionTarget.type === 'geojeol'">
                  <div class="sy-subreasons">
                    <button v-for="opt in GEOJEOL_OPTS" :key="opt.code"
                      class="ab sub" @click="submitGeojeol(p, opt.code)" :disabled="saving">{{ opt.label }}</button>
                    <button class="ab cancel" @click="closeAction">취소</button>
                  </div>
                </template>

                <!-- 무효 서브사유 -->
                <template v-else-if="actionTarget.type === 'muyou'">
                  <div class="sy-subreasons">
                    <button v-for="opt in MUYOU_OPTS" :key="opt.code"
                      class="ab sub" @click="submitMuyou(p, opt.code)" :disabled="saving">{{ opt.label }}</button>
                    <button class="ab cancel" @click="closeAction">취소</button>
                  </div>
                </template>
              </div>

              <!-- 스크립트 (모바일 통화중 + 토글 켠 경우, 읽기전용) -->
              <div v-if="isMyCalling(p) && !isDesktop && scriptOpen[p.docId]" class="sy-script-box">
                <pre class="sy-script-text">{{ activeScriptText }}</pre>
              </div>

            </div><!-- /스크롤 영역 -->

            <!-- 토글 + 메모 하단 고정 (모바일 통화중일 때만) -->
            <div v-if="isMyCalling(p) && !isDesktop" class="sy-note-sticky">
              <div class="sy-note-tags">
                <button
                  v-for="tag in NOTE_TAGS" :key="tag"
                  class="sy-note-tag"
                  :class="{ on: noteToggles[p.docId]?.has(tag) }"
                  @click="toggleTag(p.docId, tag)"
                >{{ noteToggles[p.docId]?.has(tag) ? '✓ ' + tag : tag }}</button>
              </div>
              <textarea
                class="sy-note-text"
                :value="noteText[p.docId]"
                @input="onNoteInput(p.docId, $event)"
                placeholder="자유롭게 메모..."
                rows="4"
              ></textarea>
            </div>

          </div>
        </div>
      </template>

      <!-- ── Section D: 종료된 건(합재양 작성 완료) — 토글과 무관하게 항상 표시.
           Section A "진행/종료" 토글은 ddochiList(TM 진행중 vs 만픽인데 합재양
           미작성) 전용이라 여기엔 안 걸침 — 안 그러면 토글 버튼이 속한 Section A
           자체가 비어서 안 보일 때(ddochiListAll=0) 종료된 건도 같이 못 보게 됨. -->
      <template v-if="doneList.length && (!callingDocId || isDesktop)">
        <div class="sy-section-label sy-section-label-row" style="margin-top:16px">
          <span>✅ 종료된 건 ({{ doneList.length }}명)</span>
        </div>
        <div class="sy-cards">
          <div v-for="p in doneList" :key="p.docId" class="sy-card sy-card-done"
               @click="expandedDoneId = expandedDoneId === p.docId ? null : p.docId">
            <div class="sy-card-header">
              <span class="sy-name">{{ p.name }}</span>
              <span v-if="p.age" class="sy-age">({{ p.age }}세)</span>
              <span v-if="p.createdTs" class="sy-inflow-ts">{{ fmtInflowTs(p.createdTs) }}</span>
              <span class="sy-link-badge sy-intr-badge">{{ p.team + '팀' }}</span>
              <span class="sy-done-guide" v-if="p.hasGuide">인도자: {{ p.guideName }}</span>
              <span class="sy-done-noguide" v-else>인도자 미정 🎰</span>
              <span v-if="p.hjCreatedTs" class="sy-done-date">{{ p.hjCreatedTs }}</span>
              <span class="sy-done-chevron">{{ expandedDoneId === p.docId ? '▲' : '▼' }}</span>
            </div>
            <div v-if="expandedDoneId === p.docId" class="sy-done-actions" @click.stop>
              <button v-if="!p.hasGuide" class="ab mp" @click="doRegacha(p)" :disabled="cancelling">🎰 재가챠</button>
              <button class="ab cancel" @click="cancelHabjaeyang(p)" :disabled="cancelling">합재양 제출 취소하기</button>
            </div>
          </div>
        </div>
      </template>

      <div v-if="!ddochiListAll.length && !unregList.length && !asLoading" class="sy-empty">
        데이터가 없어요!
      </div>
      </div><!-- /sy-left -->

      <!-- ── 우측 패널 (데스크탑 전용) ── -->
      <div v-if="isDesktop" class="sy-right">
        <template v-if="callingProspect">
          <div class="sy-right-card">
            <div class="sy-right-scroll">
              <div class="sy-card-header">
                <span class="sy-name">{{ callingProspect.name }}</span>
                <span v-if="callingProspect.age" class="sy-age">({{ callingProspect.age }}세)</span>
                <span class="sy-phone-num" style="cursor:pointer;" @click="copyPhone(callingProspect.phone)">📞 {{ callingProspect.phone }}</span>
                <button class="ab cancel hangup" @click="endCall">끊기</button>
                <button class="sy-script-toggle" :class="{ on: scriptOpen[callingProspect.docId] }" @click="toggleScript(callingProspect.docId)">📝 스크립트</button>
                <span class="sy-link-badge sy-intr-badge">{{ callingProspect.team + '팀' }}</span>
              </div>
              <div class="sy-meta">
                <span v-if="callingProspect.tmLogs?.[0]?.category === 'tmReserved' || (!hasRealLog(callingProspect) && callingProspect.reservedAt)" class="meta-reserved">{{ callingProspect.reservedAt ? formatReservedAt(callingProspect.reservedAt) : '예약됨' }}</span>
                <span v-else-if="callingProspect.noAnswerCount" class="meta-warn">안받음 {{ callingProspect.noAnswerCount }}회</span>
                <span v-if="callingProspect.region" class="sy-field"><b>지역</b>{{ callingProspect.region }}</span>
                <span v-if="callingProspect.shedMeta?.mbti" class="sy-field"><b>MBTI</b>{{ callingProspect.shedMeta.mbti }}</span>
                <span v-if="callingProspect.shedMeta?.env" class="sy-field"><b>환경</b>{{ callingProspect.shedMeta.env }}</span>
                <span v-if="callingProspect.shedMeta?.reaction" class="sy-field"><b>반응</b>{{ callingProspect.shedMeta.reaction }}</span>
                <span v-if="callingProspect.shedMeta?.introducer" class="sy-field"><b>유입</b>{{ callingProspect.shedMeta.introducer }}</span>
                <span v-if="callingProspect.shedMeta?.helperNames" class="sy-field"><b>조력자</b>{{ callingProspect.shedMeta.helperNames }}</span>
                <span v-if="callingProspect.shedMeta?.tmLocation" class="sy-field"><b>유입장소</b>{{ callingProspect.shedMeta.tmLocation }}</span>
              </div>
              <div v-if="callingProspect.tmLogs?.length" class="sy-logs expanded">
                <div v-for="log in orderedLogs(callingProspect.tmLogs)" :key="log.id" class="sy-log-row">
                  <span class="sy-log-line">{{ fmtInflowTs(log.createdAt) }} · {{ log.label }} · {{ log.actorName || '-' }}</span>
                  <button class="sy-log-del" @click="deleteLog(callingProspect, log)">×</button>
                </div>
              </div>
              <div v-if="!isFinal(callingProspect)" class="sy-actions">
                <template v-if="!actionTarget || actionTarget.docId !== callingProspect.docId">
                  <button class="ab na" @click="doNoAnswer(callingProspect)" :disabled="saving">안받음</button>
                  <button class="ab re" @click="openAction(callingProspect.docId, 'reserve')" :disabled="saving">예약</button>
                  <button class="ab mp" @click="doMeetingFix(callingProspect)" :disabled="saving">만남픽스</button>
                  <button class="ab bh" @click="openAction(callingProspect.docId, 'bihap')" :disabled="saving">비합</button>
                  <button class="ab gj" @click="openAction(callingProspect.docId, 'geojeol')" :disabled="saving">거절</button>
                  <button class="ab my" @click="openAction(callingProspect.docId, 'muyou')" :disabled="saving">무효</button>
                </template>
                <template v-else-if="actionTarget.type === 'reserve'">
                  <input class="sy-date-input" type="datetime-local" v-model="reserveDate" />
                  <button class="ab re" @click="doReserve(callingProspect)" :disabled="saving">저장</button>
                  <button class="ab cancel" @click="closeAction">취소</button>
                </template>
                <template v-else-if="actionTarget.type === 'bihap'">
                  <div class="sy-subreasons">
                    <button v-for="opt in BIHAP_OPTS" :key="opt.code" class="ab sub" @click="submitBihap(callingProspect, opt.code)" :disabled="saving">{{ opt.label }}</button>
                    <button class="ab cancel" @click="closeAction">취소</button>
                  </div>
                </template>
                <template v-else-if="actionTarget.type === 'geojeol'">
                  <div class="sy-subreasons">
                    <button v-for="opt in GEOJEOL_OPTS" :key="opt.code" class="ab sub" @click="submitGeojeol(callingProspect, opt.code)" :disabled="saving">{{ opt.label }}</button>
                    <button class="ab cancel" @click="closeAction">취소</button>
                  </div>
                </template>
                <template v-else-if="actionTarget.type === 'muyou'">
                  <div class="sy-subreasons">
                    <button v-for="opt in MUYOU_OPTS" :key="opt.code" class="ab sub" @click="submitMuyou(callingProspect, opt.code)" :disabled="saving">{{ opt.label }}</button>
                    <button class="ab cancel" @click="closeAction">취소</button>
                  </div>
                </template>
              </div>
              <div v-if="scriptOpen[callingProspect.docId]" class="sy-script-box">
                <pre class="sy-script-text">{{ activeScriptText }}</pre>
              </div>
            </div><!-- /sy-right-scroll -->
            <div class="sy-note-sticky">
              <div class="sy-note-tags">
                <button v-for="tag in NOTE_TAGS" :key="tag" class="sy-note-tag"
                  :class="{ on: noteToggles[callingProspect.docId]?.has(tag) }"
                  @click="toggleTag(callingProspect.docId, tag)">{{ noteToggles[callingProspect.docId]?.has(tag) ? '✓ ' + tag : tag }}</button>
              </div>
              <textarea class="sy-note-text"
                :value="noteText[callingProspect.docId]"
                @input="onNoteInput(callingProspect.docId, $event)"
                placeholder="자유롭게 메모..." rows="4"></textarea>
            </div>
          </div>
        </template>
        <div v-else class="sy-right-placeholder">
          <div class="sy-right-placeholder-text">📞 전화할 사람을 선택하세요</div>
        </div>
      </div><!-- /sy-right -->
    </div>

    <!-- 재가챠 슬롯머신 -->
    <GachaSlotOverlay
      v-if="regachaVisible && regachaResult"
      :visible="regachaVisible"
      :inflowName="regachaResult.inflowName"
      :tmName="regachaResult.tmName"
      :winner="regachaResult.winner"
      :currentRound="regachaResult.currentRound"
      :nextProb="regachaResult.nextProb"
      @done="onRegachaDone"
    />

    <DuplicateHistoryPopup
      v-if="shedDupList.length > 0"
      :list="shedDupList"
      :showProceed="false"
      @close="closeShedDupPopup"
      @reject="rejectShedDup"
    />

    <!-- 통합 검색 팝업 -->
    <div v-if="showShedSearch" class="modal-overlay" @click.self="showShedSearch = false">
      <div class="modal-card sy-search-modal">
        <span class="modal-close" @click="showShedSearch = false">&times;</span>
        <div class="modal-title">🔍 통합 검색</div>
        <input
          ref="shedSearchInputRef"
          class="sy-search-input"
          v-model="shedSearchQuery"
          placeholder="이름 또는 유입자 이름 입력..."
        />

        <div class="sy-search-body">
          <!-- 미등록 -->
          <template v-if="searchUnregList.length">
            <div class="sy-search-section-title">📋 미등록 ({{ searchUnregList.length }})</div>
            <div v-for="(r, i) in searchUnregList" :key="i" class="sy-search-row">
              <span class="sy-search-name">{{ r.name }}</span>
              <span v-if="r.age" class="sy-search-age">({{ r.age }}세)</span>
              <span class="sy-search-badge unreg">{{ r.event }}팀</span>
              <span v-if="r.introducer" class="sy-search-sub">유입: {{ r.introducer }}</span>
            </div>
          </template>

          <!-- TM진행 -->
          <template v-if="searchTmActiveList.length">
            <div class="sy-search-section-title" :style="{ marginTop: searchUnregList.length ? '12px' : '0' }">🗂️ TM진행 ({{ searchTmActiveList.length }})</div>
            <div v-for="p in searchTmActiveList" :key="p.docId" class="sy-search-row">
              <span class="sy-search-name">{{ p.name }}</span>
              <span v-if="p.age" class="sy-search-age">({{ p.age }}세)</span>
              <span class="sy-search-badge active">{{ p.team + '팀' }}</span>
              <span v-if="p.noAnswerCount" class="sy-search-sub warn">안받음 {{ p.noAnswerCount }}회</span>
              <span v-else-if="p.reservedAt" class="sy-search-sub">예약: {{ formatReservedAt(p.reservedAt) }}</span>
              <span v-if="p.shedMeta?.introducer" class="sy-search-sub">유입: {{ p.shedMeta.introducer }}</span>
              <button class="sy-search-call-btn" @click="showShedSearch = false; startCall(p)">📞</button>
            </div>
          </template>

          <!-- TM종료 -->
          <template v-if="searchTmDoneList.length">
            <div class="sy-search-section-title" :style="{ marginTop: (searchUnregList.length || searchTmActiveList.length) ? '12px' : '0' }">✅ TM종료 ({{ searchTmDoneList.length }})</div>
            <div v-for="p in searchTmDoneList" :key="p.docId" class="sy-search-row">
              <span class="sy-search-name">{{ p.name }}</span>
              <span v-if="p.age" class="sy-search-age">({{ p.age }}세)</span>
              <span class="sy-search-badge done">{{ p.team + '팀' }}</span>
              <span class="sy-search-final">{{ finalLabel(p) }}</span>
              <span v-if="p.shedMeta?.introducer" class="sy-search-sub">유입: {{ p.shedMeta.introducer }}</span>
            </div>
          </template>

          <div v-if="!shedSearchNorm" class="sy-search-empty">이름 또는 유입자를 입력하세요</div>
          <div v-else-if="!searchUnregList.length && !searchTmActiveList.length && !searchTmDoneList.length" class="sy-search-empty">검색 결과가 없어요</div>
        </div>
      </div>
    </div>

    <!-- 선문자 팝업 -->
    <div v-if="welcomeMsgTarget" class="modal-overlay" @click.self="closeWelcomeMsg">
      <div class="sy-welcome-modal">
        <div class="sy-welcome-info">
          <span class="sy-welcome-name">{{ welcomeMsgTarget.name }}<span v-if="welcomeMsgTarget.age" class="sy-welcome-age"> ({{ welcomeMsgTarget.age }}세)</span></span>
          <span class="sy-welcome-phone" @click="copyWelcomePhone">📞 {{ welcomeMsgTarget.phone }}</span>
        </div>
        <button class="sy-popup-copy-script" @click="copyWelcomeScript">📋 스크립트 복사</button>
        <label class="sy-welcome-check" :class="{ checked: welcomeChecked }">
          <input type="checkbox" v-model="welcomeChecked" />
          선문자 발송 완료
        </label>
        <div class="sy-welcome-actions">
          <button class="sy-welcome-save" :disabled="!welcomeChecked || welcomeSaving" @click="doWelcomeMsg">저장하기</button>
          <button class="sy-welcome-cancel" @click="closeWelcomeMsg">취소</button>
        </div>
      </div>
    </div>

    <!-- 안받음 팝업 -->
    <div v-if="noAnswerMsgTarget" class="modal-overlay" @click.self="cancelNoAnswerMsg">
      <div class="sy-welcome-modal">
        <div class="sy-welcome-info">
          <span class="sy-welcome-name">{{ noAnswerMsgTarget.name }}<span v-if="noAnswerMsgTarget.age" class="sy-welcome-age"> ({{ noAnswerMsgTarget.age }}세)</span></span>
          <span class="sy-welcome-phone" @click="copyNoAnswerPhone">📞 {{ noAnswerMsgTarget.phone }}</span>
        </div>
        <div class="sy-na-msg-desc">📩 부재중 문자를 발송해야 해!</div>
        <button class="sy-popup-copy-script" @click="copyNoAnswerScript">📋 스크립트 복사</button>
        <label class="sy-welcome-check" :class="{ checked: noAnswerChecked }">
          <input type="checkbox" v-model="noAnswerChecked" />
          부재중문자 발송 완료
        </label>
        <div class="sy-welcome-actions">
          <button class="sy-welcome-save" :disabled="!noAnswerChecked || noAnswerSaving" @click="doNoAnswerWithMsg">저장하기</button>
          <button class="sy-welcome-cancel" @click="cancelNoAnswerMsg">취소 (안받음만)</button>
        </div>
      </div>
    </div>

    <!-- 스크립트 등록 팝업 -->
    <div v-if="scriptModalOpen" class="modal-overlay" @click.self="scriptModalOpen = false">
      <div class="modal-card sy-script-modal">
        <span class="modal-close" @click="scriptModalOpen = false">&times;</span>
        <div class="modal-title">📝 스크립트 등록</div>

        <div class="sy-script-tabs">
          <button :class="['sy-script-tab-btn', { on: scriptTab === 'tm' }]" @click="switchScriptTab('tm')">티엠</button>
          <button :class="['sy-script-tab-btn', { on: scriptTab === 'welcome' }]" @click="switchScriptTab('welcome')">선문자</button>
          <button :class="['sy-script-tab-btn', { on: scriptTab === 'noAnswer' }]" @click="switchScriptTab('noAnswer')">안받문</button>
        </div>

        <div class="modal-content-scroll">
          <div class="sy-script-mode">
            <label><input type="radio" value="default" v-model="scriptModes[scriptTab]" /> 기본 스크립트 사용</label>
            <label><input type="radio" value="personal" v-model="scriptModes[scriptTab]" /> 개인 스크립트 사용</label>
          </div>

          <div class="sy-script-block">
            <div class="sy-script-label">기본 스크립트 (읽기전용)</div>
            <pre class="sy-script-preview">{{ scriptTab === 'tm' ? DEFAULT_SCRIPT : scriptTab === 'welcome' ? DEFAULT_WELCOME_SCRIPT : DEFAULT_NO_ANSWER_SCRIPT }}</pre>
          </div>

          <div class="sy-script-block">
            <div class="sy-script-label">개인 스크립트</div>
            <textarea
              class="sy-script-textarea"
              v-model="scriptDrafts[scriptTab]"
              placeholder="본인 스크립트를 붙여넣으세요"
            ></textarea>
            <button class="ab reg" @click="savePersonalScript">저장</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sy-screen {
  display: flex; flex-direction: column;
  height: calc(100vh - 50px);
  background: #f9fbe7;
  font-family: "Jua", sans-serif;
  font-size: 13px; color: #33691e;
  overflow: hidden;
}
.sy-topbar {
  display: flex; align-items: center; gap: 8px; padding: 10px 14px;
  background: #fff; box-shadow: 0 2px 8px rgba(100,140,50,.12); flex-shrink: 0;
}
.sy-back, .sy-refresh {
  font-size: 18px; padding: 4px 8px; background: none; border: none;
  color: #558b2f; cursor: pointer;
}
.sy-refresh:disabled { opacity: .4; }
.sy-title { flex: 1; font-size: 16px; font-weight: bold; color: #33691e; }
.sy-script-reg {
  font-size: 11px; padding: 5px 10px; border-radius: 8px;
  border: 1px solid #c5e1a5; background: #f1f8e9; color: #558b2f;
  font-family: "Jua", sans-serif; cursor: pointer; white-space: nowrap;
}
.sy-script-reg:hover { background: #dcedc8; }

.sy-presence {
  display: flex; align-items: center; gap: 8px; padding: 6px 14px;
  background: #fff; border-top: 1px solid #dcedc8; flex-shrink: 0;
  overflow-x: auto;
}
.sy-presence-label {
  font-size: 11px; color: #558b2f; font-weight: bold; white-space: nowrap; flex-shrink: 0;
}
.sy-presence-chips { display: flex; gap: 5px; }
.sy-presence-chip {
  display: inline-block; padding: 2px 8px; border-radius: 10px;
  font-size: 11px; font-weight: bold; white-space: nowrap;
  background: #f1f8e9; color: #558b2f;
}
.sy-presence-chip.calling { background: #FFEBEE; color: #C62828; }
.sy-presence-chip.me { outline: 1.5px solid currentColor; }

.sy-tabs {
  display: flex; gap: 6px; padding: 8px 14px; overflow-x: auto;
  background: #fff; border-top: 1px solid #dcedc8; flex-shrink: 0;
}
.sy-tab {
  display: flex; align-items: center; gap: 5px; white-space: nowrap;
  font-size: 12px; padding: 6px 14px; border-radius: 16px;
  border: 1px solid #c5e1a5; background: #f1f8e9;
  color: #558b2f; cursor: pointer; font-family: "Jua", sans-serif;
}
.sy-tab.on { background: #558b2f; border-color: #558b2f; color: #fff; }
.sy-tab-badge {
  font-size: 10px; font-weight: bold; padding: 1px 6px; border-radius: 10px;
}
.sy-tab-badge-unreg { background: #e65100; color: #fff; }
.sy-tab-badge-active { background: #2E7D32; color: #fff; }
.sy-tab.on .sy-tab-badge-unreg { background: #fff; color: #e65100; }
.sy-tab.on .sy-tab-badge-active { background: #fff; color: #2E7D32; }

.sy-loading {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 12px; color: #558b2f;
}
.sy-spinner {
  width: 28px; height: 28px; border: 3px solid rgba(85,139,47,.15);
  border-top-color: #558b2f; border-radius: 50%; animation: spin .8s linear infinite;
}
.sy-spinner-sm { width: 14px; height: 14px; border-width: 2px; flex-shrink: 0; }
.sy-as-loading-row { padding: 8px 4px; font-size: 11px; color: #aaa; }
@keyframes spin { to { transform: rotate(360deg); } }
.sy-error { flex: 1; display: flex; align-items: center; justify-content: center; color: #c62828; padding: 24px; text-align: center; }

.sy-wrap { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 10px 12px 24px; }
.sy-wrap.scroll-locked { overflow: hidden; }

.sy-section-label {
  font-size: 12px; font-weight: bold; color: #558b2f;
  padding: 6px 2px; border-bottom: 1px solid #c5e1a5;
}
.sy-section-label-row {
  display: flex; align-items: center; justify-content: space-between;
}

.sy-endtoggle {
  font-size: 11px; font-weight: bold; padding: 3px 12px; border-radius: 12px;
  border: 1px solid #558b2f; background: #f1f8e9; color: #558b2f;
  font-family: "Jua", sans-serif; cursor: pointer;
}
.sy-endtoggle.on { background: #757575; border-color: #757575; color: #fff; }

.sy-empty-sub { text-align: center; padding: 16px; color: #aaa; font-size: 12px; }

.sy-cards { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }

.sy-card {
  position: relative;
  background: #fff; border-radius: 12px; padding: 12px;
  border: 1px solid #dcedc8; box-shadow: 0 1px 4px rgba(100,140,50,.08);
}
.sy-copy-btn {
  position: absolute; top: 8px; right: 8px;
  font-size: 10px; padding: 2px 7px; border-radius: 6px;
  border: 1px solid #ddd; background: #f5f5f5; color: #999;
  cursor: pointer; font-family: "Noto Sans KR", Arial, sans-serif;
}
.sy-copy-btn:active { background: #e0e0e0; }
.sy-card.final { opacity: 0.6; }
.sy-card.unreg { border-color: #FFE0B2; background: #FFFDE7; }

/* 통화중 카드: 고정 높이 + flex 컬럼 */
.sy-card-calling {
  display: flex; flex-direction: column;
  max-height: calc(100vh - 220px);
  overflow: hidden;
  padding: 0;
}
.sy-card-calling > .sy-card-scroll-area {
  flex: 1; min-height: 0; overflow-y: auto;
  padding: 12px 12px 0;
  scrollbar-width: none;
}
.sy-card-calling > .sy-card-scroll-area::-webkit-scrollbar { display: none; }

/* 하단 고정 토글 + 메모 */
.sy-note-sticky {
  flex-shrink: 0;
  padding: 8px 12px 12px;
  border-top: 1px solid #dcedc8;
  background: #fff;
}

.sy-card-header {
  display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-bottom: 6px;
}
.sy-name { font-weight: bold; font-size: 15px; color: #2E7D32; }
.sy-age { font-size: 12px; color: #888; }

.sy-link-badge {
  display: inline-block; padding: 2px 8px; border-radius: 10px;
  font-size: 11px; font-weight: bold; color: #fff;
}
.lk1 { background: #1565c0; }
.lk3 { background: #6a1b9a; }
.lk5 { background: #e65100; }
.sy-intr-badge { background: #00695c; }
.sy-inflow-ts { font-size: 11px; color: #aaa; }

.sy-tm-badge {
  display: inline-block; padding: 2px 8px; border-radius: 10px;
  font-size: 11px; font-weight: bold; color: #fff;
}
.sy-final-badge {
  display: inline-block; padding: 2px 8px; border-radius: 10px;
  font-size: 11px; font-weight: bold; background: #388E3C; color: #fff;
}

.sy-meta {
  display: flex; flex-wrap: wrap; gap: 8px;
  font-size: 11px; color: #666; margin-bottom: 6px;
  font-family: "Noto Sans KR", Arial, sans-serif;
}

/* 신청자 상세 필드 — 라벨을 칩으로 분리해서 긴 값도 줄 구분이 명확하게 보이도록 */
.sy-fields {
  display: flex; flex-wrap: wrap; gap: 5px 10px;
  margin-bottom: 6px;
}
.sy-field {
  display: inline-flex; align-items: baseline; gap: 5px;
  font-size: 12px; color: #444; max-width: 100%;
  font-family: "Noto Sans KR", Arial, sans-serif;
}
.sy-field b {
  flex-shrink: 0; font-size: 10.5px; font-weight: bold; color: #558b2f;
  background: #f1f8e9; padding: 1px 6px; border-radius: 5px;
}
.meta-warn { color: #e53935; font-weight: bold; }
.meta-reserved { color: #7B1FA2; font-weight: bold; }
.meta-reserved.longterm { color: #795548; }

/* TM 로그 */
.sy-logs { margin-bottom: 6px; }
.sy-logs.expanded { max-height: 84px; overflow-y: auto; scrollbar-width: none; }
.sy-logs.expanded::-webkit-scrollbar { display: none; }
.sy-log-row {
  display: flex; align-items: center; gap: 4px;
  padding: 3px 6px; background: #f5f5f5; border-radius: 6px;
  margin-bottom: 3px;
}
.sy-log-line {
  flex: 1; font-size: 11px; color: #666;
  font-family: "Noto Sans KR", Arial, sans-serif;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.sy-log-del {
  flex-shrink: 0; background: none; border: none;
  color: #bbb; font-size: 15px; cursor: pointer; padding: 0 2px; line-height: 1;
}
.sy-log-del:hover { color: #e53935; }

/* 액션 버튼 */
.sy-actions { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 6px; }

.ab {
  padding: 5px 10px; border-radius: 8px; border: none; font-size: 11px;
  font-family: "Jua", sans-serif; font-weight: bold; cursor: pointer; color: #fff;
  white-space: nowrap;
}
.ab:disabled { opacity: 0.5; cursor: not-allowed; }
.ab.na  { background: #E53935; }
.ab.re  { background: #7B1FA2; }
.ab.mp  { background: #1565C0; }
.ab.bh  { background: #E65100; }
.ab.gj  { background: #C62828; }
.ab.my  { background: #4E342E; }
.ab.sub { background: #546E7A; }
.ab.reg { background: #2E7D32; }
.ab.cancel { background: #9E9E9E; }
.ab.hangup { background: #B71C1C; }

.sy-subreasons { display: flex; flex-wrap: wrap; gap: 5px; }

.sy-date-input {
  font-size: 12px; padding: 5px 8px; border: 1px solid #c5e1a5;
  border-radius: 8px; font-family: "Noto Sans KR", Arial, sans-serif;
  flex: 1; min-width: 160px; max-width: 220px;
}

/* 전화걸기 */
.sy-phone-section { margin-top: 8px; }

.sy-calling-badge {
  display: inline-block; padding: 4px 10px; border-radius: 8px;
  background: #FFEBEE; color: #C62828; font-size: 12px; font-weight: bold;
}

.sy-phone-num {
  font-size: 12px; font-weight: bold; color: #1565C0;
  font-family: "Noto Sans KR", Arial, sans-serif;
}

.sy-call-btn {
  padding: 6px 14px; border-radius: 8px; border: 1px solid #c5e1a5;
  background: #f1f8e9; color: #558b2f; font-size: 12px;
  font-family: "Jua", sans-serif; cursor: pointer;
}
.sy-call-btn:hover { background: #dcedc8; }
.sy-call-btn-sm {
  padding: 2px 9px; border-radius: 8px; border: 1px solid #c5e1a5;
  background: #f1f8e9; color: #558b2f; font-size: 11px;
  font-family: "Jua", sans-serif; cursor: pointer;
}
.sy-call-btn-sm:hover { background: #dcedc8; }

.sy-script-toggle {
  padding: 2px 9px; border-radius: 8px; border: 1px solid #7B1FA2;
  background: #F3E5F5; color: #7B1FA2; font-size: 11px;
  font-family: "Jua", sans-serif; cursor: pointer;
}
.sy-script-toggle.on { background: #7B1FA2; color: #fff; }

.sy-script-box {
  margin-top: 8px; padding: 10px; border-radius: 8px;
  background: #F3E5F5; border: 1px solid #E1BEE7;
  max-height: 30vh; overflow-y: auto;
}
.sy-script-text {
  margin: 0; font-size: 12px; color: #4A148C; font-weight: normal;
  font-family: "Noto Sans KR", Arial, sans-serif;
  white-space: pre-wrap; word-break: break-word;
}

.sy-meta-pipe {
  display: block; font-size: 11px; color: #666;
  margin-bottom: 6px; font-family: "Noto Sans KR", Arial, sans-serif;
  white-space: normal; word-break: break-word;
}

/* TM 노트 */
.sy-note { margin-top: 10px; }

.sy-note-tags {
  display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 8px;
}
.sy-note-tag {
  padding: 4px 9px; border-radius: 14px; border: 1px solid #c5e1a5;
  background: #f1f8e9; color: #558b2f; font-size: 11px;
  font-family: "Noto Sans KR", Arial, sans-serif; cursor: pointer;
  transition: background .15s, color .15s;
}
.sy-note-tag.on {
  background: #2E7D32; border-color: #2E7D32; color: #fff;
}

.sy-note-text {
  width: 100%; box-sizing: border-box;
  border: 1px solid #c5e1a5; border-radius: 8px;
  padding: 8px; font-size: 12px; resize: vertical;
  font-family: "Noto Sans KR", Arial, sans-serif;
  background: #fafff5;
}

.sy-empty { text-align: center; padding: 36px; color: #aaa; font-size: 13px; }

.sy-card.hj-needed {
  border-color: #90CAF9; background: #E3F2FD; cursor: pointer;
}
.sy-card.hj-needed:active { background: #BBDEFB; }

/* ── 데스크탑 마스터-디테일 ────────────────────────────────────────────── */
@media (min-width: 1024px) {
  .sy-wrap-desktop {
    display: grid;
    grid-template-columns: 400px 1fr;
    overflow: hidden;
    padding: 0;
  }
  .sy-left {
    overflow-y: auto;
    padding: 10px 12px 24px;
    border-right: 2px solid #dcedc8;
    height: 100%;
    box-sizing: border-box;
  }
  .sy-right {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    background: #fff;
  }
  .sy-right-card {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }
  .sy-right-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 16px 20px 0;
    scrollbar-width: none;
  }
  .sy-right-scroll::-webkit-scrollbar { display: none; }
  .sy-right .sy-note-sticky { padding: 12px 20px 16px; }
  .sy-right-placeholder {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .sy-right-placeholder-text { font-size: 15px; color: #bbb; }
  .sy-card-active-desktop {
    border-color: #4CAF50;
    border-width: 2px;
    box-shadow: 0 0 0 3px rgba(76,175,80,.12);
  }
  .sy-calling-mine-badge {
    display: inline-block;
    padding: 2px 8px; border-radius: 8px;
    background: #E8F5E9; color: #2E7D32;
    font-size: 12px; font-weight: bold;
  }
}

/* 스크립트 등록 팝업 */
.sy-script-modal { max-width: 420px; text-align: left; }
.sy-script-mode {
  display: flex; gap: 16px; margin-bottom: 14px;
  font-size: 13px; color: #444; font-family: "Noto Sans KR", Arial, sans-serif;
}
.sy-script-mode label { display: flex; align-items: center; gap: 5px; cursor: pointer; white-space: nowrap; }
.sy-script-block { margin-bottom: 16px; }
.sy-script-label {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 12px; font-weight: bold; color: #558b2f; margin-bottom: 6px;
  font-family: "Noto Sans KR", Arial, sans-serif;
}
.sy-script-hint { font-size: 10px; font-weight: normal; color: #aaa; }
.sy-script-preview {
  margin: 0; padding: 10px; border-radius: 8px;
  background: #f5f5f5; color: #666; font-size: 12px;
  font-family: "Noto Sans KR", Arial, sans-serif;
  white-space: pre-wrap; word-break: break-word;
  max-height: 160px; overflow-y: auto;
}
.sy-script-textarea {
  width: 100%; box-sizing: border-box; min-height: 160px;
  border: 1px solid #c5e1a5; border-radius: 8px;
  padding: 8px; font-size: 12px; resize: vertical;
  font-family: "Noto Sans KR", Arial, sans-serif;
  background: #fafff5; margin-bottom: 8px;
}

/* ── 종료된 건 ── */
.sy-card-done {
  cursor: pointer;
  border-color: #A5D6A7;
  background: #F1F8E9;
}
.sy-card-done:active { background: #DCEDC8; }
.sy-done-guide {
  font-size: 11px; color: #2E7D32; font-weight: bold;
  padding: 2px 8px; border-radius: 10px; background: #C8E6C9;
}
.sy-done-noguide {
  font-size: 11px; color: #E65100; font-weight: bold;
  padding: 2px 8px; border-radius: 10px; background: #FFF3E0;
}
.sy-done-date {
  font-size: 11px; color: #888; margin-left: auto;
}
.sy-done-chevron {
  font-size: 12px; color: #888; margin-left: 6px;
}
.sy-done-actions {
  display: flex; flex-wrap: wrap; gap: 6px;
  margin-top: 8px; padding-top: 8px;
  border-top: 1px solid #C8E6C9;
}

/* ── 통합 검색 버튼 ── */
.sy-search-btn {
  font-size: 11px; padding: 5px 10px; border-radius: 8px;
  border: 1px solid #c5e1a5; background: #f1f8e9; color: #558b2f;
  font-family: "Jua", sans-serif; cursor: pointer; white-space: nowrap;
}
.sy-search-btn:hover { background: #dcedc8; }

/* ── 검색 팝업 ── */
.sy-search-modal { max-width: 400px; width: 92vw; text-align: left; max-height: 80vh; display: flex; flex-direction: column; }
.sy-search-input {
  width: 100%; box-sizing: border-box;
  border: 1px solid #c5e1a5; border-radius: 8px;
  padding: 9px 12px; font-size: 14px;
  font-family: "Noto Sans KR", Arial, sans-serif;
  background: #fafff5; margin-bottom: 10px; outline: none;
}
.sy-search-input:focus { border-color: #558b2f; }
.sy-search-body { flex: 1; overflow-y: auto; }
.sy-search-section-title {
  font-size: 12px; font-weight: bold; color: #558b2f;
  padding: 4px 2px; border-bottom: 1px solid #c5e1a5; margin-bottom: 6px;
}
.sy-search-row {
  display: flex; align-items: center; flex-wrap: wrap; gap: 5px;
  padding: 6px 4px; border-radius: 6px;
  border-bottom: 1px solid #f0f0f0;
  font-family: "Noto Sans KR", Arial, sans-serif;
}
.sy-search-row:last-child { border-bottom: none; }
.sy-search-name { font-weight: bold; font-size: 14px; color: #2E7D32; }
.sy-search-age { font-size: 11px; color: #888; }
.sy-search-sub { font-size: 11px; color: #666; }
.sy-search-sub.warn { color: #e53935; font-weight: bold; }
.sy-search-badge {
  font-size: 10px; font-weight: bold; padding: 1px 7px; border-radius: 10px; color: #fff;
}
.sy-search-badge.unreg { background: #e65100; }
.sy-search-badge.active { background: #00695c; }
.sy-search-badge.done { background: #757575; }
.sy-search-final {
  font-size: 11px; font-weight: bold; padding: 1px 7px; border-radius: 10px;
  background: #388E3C; color: #fff;
}
.sy-search-call-btn {
  margin-left: auto; background: #e8f5e9; border: 1px solid #a5d6a7;
  border-radius: 6px; padding: 4px 9px; font-size: 14px; cursor: pointer; line-height: 1;
}
.sy-search-call-btn:hover { background: #c8e6c9; }
.sy-search-empty { text-align: center; padding: 20px; color: #aaa; font-size: 12px; }

/* 선문자 버튼 */
.sy-welcome-btn {
  background: #FFF8E1 !important; border-color: #FFD54F !important; color: #E65100 !important;
}
.sy-welcome-btn:hover { background: #FFE082 !important; }

/* 선문자 팝업 */
.sy-welcome-modal {
  background: #fff; border-radius: 14px; padding: 16px 18px;
  width: 260px; box-shadow: 0 4px 24px rgba(0,0,0,.18);
  display: flex; flex-direction: column; gap: 10px;
}
.sy-welcome-info { display: flex; flex-direction: column; gap: 3px; }
.sy-welcome-name { font-size: 15px; font-weight: bold; color: #2E7D32; }
.sy-welcome-age { font-size: 12px; color: #888; font-weight: normal; }
.sy-welcome-phone {
  font-size: 13px; color: #1565C0; font-weight: bold;
  font-family: "Noto Sans KR", Arial, sans-serif;
  cursor: pointer;
}
.sy-welcome-phone:active { opacity: 0.7; }
.sy-welcome-check {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; cursor: pointer; padding: 7px 12px;
  border-radius: 8px; border: 1.5px solid #c5e1a5;
  background: #f1f8e9; color: #558b2f; font-family: "Jua", sans-serif;
  transition: background .15s, border-color .15s;
}
.sy-welcome-check.checked { background: #2E7D32; border-color: #2E7D32; color: #fff; }
.sy-welcome-check input { display: none; }
.sy-welcome-actions { display: flex; gap: 8px; }
.sy-welcome-save {
  flex: 1; padding: 7px; border-radius: 8px; border: none;
  background: #2E7D32; color: #fff; font-size: 13px;
  font-family: "Jua", sans-serif; cursor: pointer;
}
.sy-welcome-save:disabled { background: #bdbdbd; cursor: not-allowed; }
.sy-welcome-cancel {
  flex: 1; padding: 7px; border-radius: 8px;
  background: #f1f8e9; color: #558b2f; font-size: 13px;
  font-family: "Jua", sans-serif; cursor: pointer;
  border: 1px solid #c5e1a5;
}
.sy-welcome-cancel:hover { background: #dcedc8; }

/* 팝업 내 스크립트 복사 버튼 */
.sy-popup-copy-script {
  width: 100%; padding: 6px 10px; border-radius: 8px;
  border: 1px solid #c5e1a5; background: #f1f8e9; color: #558b2f;
  font-size: 12px; font-family: "Jua", sans-serif; cursor: pointer;
}
.sy-popup-copy-script:active { background: #dcedc8; }

/* 안받음 팝업 설명 */
.sy-na-msg-desc {
  font-size: 13px; color: #E65100; font-weight: bold;
  text-align: center; padding: 7px; background: #FFF3E0; border-radius: 8px;
}

/* 스크립트 탭 */
.sy-script-tabs { display: flex; gap: 5px; margin-bottom: 12px; }
.sy-script-tab-btn {
  flex: 1; padding: 6px 8px; border-radius: 8px;
  border: 1px solid #c5e1a5; background: #f1f8e9; color: #558b2f;
  font-size: 12px; font-family: "Jua", sans-serif; cursor: pointer;
}
.sy-script-tab-btn.on { background: #558b2f; border-color: #558b2f; color: #fff; }
</style>
