# frontend

Vue 3 + Vite + TypeScript SPA — rebuilds `legacy2/public/index.html` (single
14k-line file) as a structured component tree.

## 화면 구성

라우터에 등록된 17개 스크린은 모두 `src/screens/` 에 있다.
대부분은 placeholder 셸 — 레거시 SPA 의 화면별 로직을 점진적으로 이식한다.

| Route | Component | Legacy element |
|---|---|---|
| `/login` | `LoginScreen.vue` | `#loginScreen` |
| `/` | `HomeScreen.vue` | `#homeScreen` |
| `/matching` | `MatchingScreen.vue` | `#matchingScreen` |
| `/register` | `RegisterProspectScreen.vue` | `#registerProspectScreen` |
| `/tm` | `TmAssetScreen.vue` | `#tmAssetScreen` |
| `/habjaeyang` | `HabjaeyangScreen.vue` | `#habjaeyangScreen` |
| `/center` | `CenterScreen.vue` | `#centerScreen` |
| `/dolyo` | `DolyoScreen.vue` | `#dolyoScreen` |
| `/admin` | `AdminScreen.vue` | `#adminScreen` |
| `/daily-report` | `DailyReportScreen.vue` | `#dailyReportScreen` |
| `/prayer` | `PrayerScreen.vue` | `#prayerScreen` |
| `/personal-stats` | `PersonalStatsScreen.vue` | `#personalStatsScreen` |
| `/statistics` | `StatisticsScreen.vue` | `#statisticsScreen` |
| `/board` | `BoardMainScreen.vue` | `#boardMainScreen` |
| `/board/write` | `PostWriteScreen.vue` | `#postWriteScreen` |
| `/board/:postId` | `PostDetailScreen.vue` | `#postDetailScreen` |

## API 통신

SPA는 **services/main 만** 호출한다. 다른 서비스(`data_router`, `tel_router`,
`erp`, `render`)에 직접 접근하지 않으며, main 이 게이트웨이 역할.

- `src/api/client.ts` — axios 싱글턴, base URL = `import.meta.env.VITE_API_BASE_URL || '/api'`
- `src/stores/auth.ts` — Pinia 스토어, localStorage 영속, Telegram WebApp `initData` 보관

빌드 시점에 `VITE_API_BASE_URL` 가 SPA 코드에 굳어진다 — dev 모드에선 비워두고
vite proxy 를 쓰고, 프로덕션에선 main 의 외부 URL(예: `https://api.example.com/api`)
을 넣는다.

## 개발

```sh
npm install
npm run dev         # http://localhost:5173, /api → http://localhost:8080 (vite proxy)
```

`VITE_API_TARGET` 환경변수로 프록시 대상을 바꿀 수 있다.

## 빌드 + 배포 (Cloudflare Pages)

```sh
# 한 번만:
npx wrangler login                                 # 브라우저 OAuth
npx wrangler pages project create ddochiseom-frontend --production-branch=main

# JWT_SECRET 을 VM main 과 같은 값으로 동기화 (한 번만, 회전 시마다)
ssh ddochi@<VM> 'grep ^JWT_SECRET= ~/ddochiseom/.env | cut -d= -f2-' \
  | npx wrangler pages secret put JWT_SECRET --project-name=ddochiseom-frontend

# 배포 (반복):
npm run deploy                                      # = npm run build && wrangler pages deploy dist
npm run deploy -- --branch preview                  # preview branch로 배포
```

`npm run deploy` 가 하는 일:

1. `npm run build` — `vite build` → `dist/`
2. `wrangler pages deploy dist` — CF Pages 에 정적 자산 + Functions 업로드.

`wrangler.toml` 의 vars:
- `ORIGIN_API_URL` = `https://app.ddochi.cloud` — Pages Function `/api/[[path]]`
  가 fetch 할 tunnel hostname.

Custom domain (`page.ddochi.cloud` 등) 은 dashboard 에서 추가 (wrangler CLI 미지원):
**Workers & Pages → ddochiseom-frontend → Custom domains → Set up a custom domain**.
같은 CF 계정의 zone 이면 DNS 자동.

같은 오리진(`page.ddochi.cloud`)에서 SPA 와 `/api` 가 모두 동작하므로 CORS 불필요.

## 작업 일지

### 2026-05-09 — 컴포넌트 하드코딩 → `constants/` 일괄 분리

화면 컴포넌트에 흩어져 있던 데이터성 상수를 [src/constants/index.js](src/constants/index.js) 단일 소스로 통합. 운영자가 라벨/임계값 조정 시 한 곳만 고치면 끝. `constants/index.js` 헤더 주석에 도메인별 인덱스와 추가 룰을 박았다.

#### 매핑 표 (이전 위치 → 현재 export)

| 이전 위치 | 항목 | 새 export | 비고 |
|---|---|---|---|
| `screens/PrayerScreen.vue:17` | 자체 prayerVerses 5개 | `prayerVerses` | 기존 constants 의 dead 5개와 합쳐 **10개 풀** |
| `screens/AdminScreen.vue:33` | pathMap (그룹화용 11개) | `pathGroupMap` | 이름 충돌 회피 — 기존 `pathMap` 은 다른 도메인 (raw→display) |
| `screens/AdminScreen.vue:42` | dayLabels (요일 7개) | `dayLabels` | WeeklyTemplateModal 의 `DAY_NAMES` 도 이쪽으로 통합 |
| `screens/AdminScreen.vue:44` | adminMenuItems (메뉴 12개) | `adminMenuItems` | `WIRED_MODALS` 와 짝 — action 키 동기화 필수 |
| `screens/DolyoDetail.vue:69-70` | BIHAP / GEOJEOL (TM 결과 분류) | `TM_RESULT_BIHAP`, `TM_RESULT_GEOJEOL` | 백엔드 `tmResultDetail` enum 과 합의된 값 |
| `screens/DolyoDetail.vue:82` + `composables/useDolyo.js:51` | FAITH_MAP / faithLabels (이중 정의) | `FAITH_LABEL_MAP` | useDolyo 는 `as faithLabels` 별칭 import 로 후방 호환 |
| `composables/useDolyo.js:50` | stageLabels (인도권 단계 4개) | `stageLabels` | |
| `composables/useDolyo.js` (filter 인라인) | stage name → index 매핑 | `stageNameToIndex` | |
| `screens/DailyReportScreen.vue:118` | leafOptions (잎사귀 7개) | `leafOptions` | |
| `screens/StatisticsScreen.vue:15-20` | CHANNELS / OFFLINE_CHANNELS / CHANNEL_LABELS | `CHANNELS`, `OFFLINE_CHANNELS`, `CHANNEL_LABELS` | 백엔드 응답 키와 일치 |
| `screens/TmAssetScreen.vue:26` | statusOrder (`\uXXXX` 이스케이프) | `TM_STATUS_ORDER` | 평문 한글로 정리 — 가독성 ↑ |
| `screens/TmAssetScreen.vue:37` | `36 * 60 * 60 * 1000` | `TM_END_HIDE_MS` | '끝난거'/'최종종료' 항목 숨김 임계값 |
| `screens/MatchingScreen.vue:25` | `48 * 60 * 60 * 1000` | `MATCH_RESULT_HIDE_MS` | matchResultDetail 결과 숨김 |
| `screens/MatchingScreen.vue:26` | `3 * 60 * 60 * 1000` | `REJECT_HIDE_MS` | '반려' 항목 숨김 |
| `screens/CenterScreen.vue:28` | phaseColor 인라인 맵 | `phaseColorMap` | |
| `composables/useFormatters.js:43` | `KR_TIME_DIFF` (9h) | `KR_TIME_DIFF_MS` | 백엔드 `services/main/src/util/businessDate.js KST_OFFSET_MS` 와 동일 |
| `sidebar/ActivityVenueModal.vue:24` | `9 * 60 * 60 * 1000` (raw) | `KR_TIME_DIFF_MS` | KST 오프셋 — 잔재 마지막 1건 |
| `common/TimeBlockPainter.vue:37` + `weekly/WeeklyTemplateModal.vue:25` | `for (let h = 9; h <= 23)` | `ACTIVITY_HOUR_START` / `ACTIVITY_HOUR_END` | 두 컴포넌트가 같은 매직넘버 공유하던 것 |

#### 도메인별 파일 분리는 보류

`enums.js / timings.js / domains.js` 식의 분리는 검토했으나 단일 `index.js` 가 ~130줄로 가독성 충분 → 보류. ~150줄 넘으면 도메인별 파일로 split + `index.js` 가 re-export 하는 구조로 마이그.

#### 가이드 (이후 변경 시)

- 새 컴포넌트에서 5개 이상 데이터 배열 / 비즈니스 매직넘버를 만들기 전에 `constants/index.js` 헤더의 도메인 인덱스를 먼저 본다 — 같은 도메인 섹션에 추가.
- 백엔드 enum 과 결합된 항목 (`TM_RESULT_BIHAP` 등) 변경 시 백엔드 동기화 필수.
- 도메인이 다른데 이름이 겹칠 우려가 있으면 (`pathMap` vs `pathGroupMap` 처럼) 명시적인 이름으로 새 export 를 만든다 — 기존 export 의 의미를 비틀지 않는다.
