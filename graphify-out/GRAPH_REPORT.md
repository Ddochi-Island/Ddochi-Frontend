# Graph Report - Ddochi-Frontend  (2026-08-31)

## Corpus Check
- 130 files · ~119,587 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2395 nodes · 2867 edges · 164 communities (127 shown, 36 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 109 edges (avg confidence: 0.85)
- Token cost: 0 input · 186,743 output

## Community Hubs (Navigation)
- Sunhan Yanghagi Screen
- Online Intake Screen
- Sheet View Screen
- use Api Composable
- Intake Sync Modal
- Center Screen
- Daily Report Screen
- Matching History Screen
- Habjaeyang Screen
- User Management Modal
- Feedback Screen
- Weekly Template Modal Weekly Component
- Dolyo Habjaeyang Modal
- Tool Management Modal
- Dolyo Detail Screen
- use Dolyo Composable
- Sheet Config Modal
- Telegram Connect Modal
- Post Detail Screen
- Sheet Edit Modal
- Home Screen
- Matching Screen
- Vue Router Config
- Storage Pages Function (proxy)
- Dolyo Screen
- NPM Package Manifest
- Ministry Category Modal
- Sidebar Layout Component
- Report Popup
- Weekly Score Screen
- Area Telegram Connect Modal
- Habjaeyang View Popup
- App Modal Shared Component
- Time Block Painter Shared Component
- Area Score Screen
- Admin Screen
- Post Write Screen
- Admin Audit Log Modal
- Sunhan Yanghagi Screen (part 2)
- Shared Constants
- Activity Report Modal
- Goal Setting Modal
- Area Score Request Screen
- Activity Coord Modal
- Current Schedule Modal
- My Goal Modal
- Semester Calendar Modal
- README Docs
- Gacha Slot Overlay Screen
- Statistics Screen
- Pages Functions TS Config
- use Formatters Composable
- Reflection Viewer Modal
- Board Main Screen
- Report Screen
- Return Home Setting Modal
- Schedule Register Modal
- Daily Report Screen (part 2)
- Dolyo Approval Modal
- Dolyo Match Result Modal
- Prayer Screen
- Weekly Record Screen
- Activity Venue Modal
- Auto Reject Modal
- Path Management Modal
- Daily Report Screen (part 3)
- Week Start Personal Modal
- Weekly Block Editor Weekly Component
- Shared Constants (part 2)
- App
- Auth Config Modal
- Board Management Modal
- Center Screen (part 2)
- Habjaeyang Screen (part 2)
- Online Intake Screen (part 2)
- Nurture Log Detail Popup
- Schedule Popup
- Strategy Popup
- Dolyo Action Modal
- Personal Stats Screen
- Sunhan Yanghagi Screen (part 3)
- Week Start Global Modal
- Matching Screen (part 2)
- Teacher Edit Popup
- Sheet View Screen (part 2)
- PWA Manifest
- Shared Constants (part 3)
- Access Key Screen
- Daily Report Merge Preview Modal
- Login Screen
- Status Color Popup
- Sheet View Screen (part 3)
- Sunhan Yanghagi Screen (part 4)
- Loading Screen
- Online Intake Screen (part 3)
- Ttagi Form Popup
- Dolyo Delete Modal
- Matching Screen (part 3)
- Leaf Date Popup
- Ttagi View Popup
- Api Pages Function (proxy)
- User Management Modal (part 2)
- User Management Modal (part 3)
- Top Nav Layout Component
- Online Intake Screen (part 4)
- Leaf List Popup
- use Roles Composable
- CLAUDE Docs
- HTML Entry Point
- User Management Modal (part 4)
- Online Intake Screen (part 5)
- Dropout Reason Popup
- Logs Popup
- Sheet View Screen (part 4)
- Sheet View Screen (part 5)
- Weekly Template Modal Weekly Component (part 2)
- use Tm Note Draft Composable
- CLAUDE Docs (part 2)
- CLAUDE Docs (part 3)
- Dashboard Pages Function (proxy)
- Wrangler Deploy Script
- Intake Sync Modal (part 2)
- Image Viewer Shared Component
- Habjaeyang Screen (part 3)
- Habjaeyang Screen (part 4)
- Matching Screen (part 4)
- Final Result Popup
- Matching Info Popup
- use Daum Postcode Composable
- Tel Router Dashboard Modal
- Center Screen (part 3)
- Online Intake Screen (part 6)
- Match Result Popup
- Sunhan Yanghagi Screen (part 5)
- use Google Auth Composable
- Legacy Deploy Script
- Intake Sync Modal (part 3)
- Intake Sync Modal (part 4)
- Intake Sync Modal (part 5)
- Intake Sync Modal (part 6)
- Intake Sync Modal (part 7)
- App Toast Shared Component
- Sync Loading Overlay Layout Component
- Daily Report Screen (part 4)
- Leaderboard Screen
- Online Intake Screen (part 7)
- Sheet View Screen (part 6)
- Sunhan Yanghagi Screen (part 6)
- Sunhan Yanghagi Screen (part 7)
- Sunhan Yanghagi Screen (part 8)
- Sunhan Yanghagi Screen (part 9)
- Weekly Template Modal Weekly Component (part 3)
- Weekly Template Modal Weekly Component (part 4)
- admin Store
- auth Store
- board Store
- center Store
- prospect Store
- stats Store
- ui Store
- icon 192
- icon 512
- Security Contact (RFC 9116)

## God Nodes (most connected - your core abstractions)
1. `useDolyo()` - 23 edges
2. `legacy2/public/index.html (14k-line legacy monolith)` - 17 edges
3. `load()` - 16 edges
4. `useFormatters()` - 13 edges
5. `loadCenterAssets()` - 12 edges
6. `loadMatchingData()` - 12 edges
7. `getList()` - 12 edges
8. `onRequest()` - 11 edges
9. `compilerOptions` - 11 edges
10. `close()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `useApi()` --semantically_similar_to--> `src/api/client.ts (axios singleton)`  [INFERRED] [semantically similar]
  src/composables/useApi.js → README.md
- `Telegram WebApp vs browser token storage strategy` --rationale_for--> `useApi()`  [EXTRACTED]
  CLAUDE.md → src/composables/useApi.js
- `src/stores/auth.ts (Pinia auth store)` --shares_data_with--> `useApi()`  [INFERRED]
  README.md → src/composables/useApi.js
- `adminMenuItems` --conceptually_related_to--> `WIRED_MODALS (paired with adminMenuItems action keys)`  [AMBIGUOUS]
  src/constants/index.js → README.md
- `SPA mount point (#app + /src/main.js)` --references--> `router`  [INFERRED]
  index.html → src/router/index.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Three Pages Functions implementing single-domain topology** — claude_single_domain_topology, functions_api_path_proxy, functions_dashboard_path_proxy, functions_storage_path_proxy [EXTRACTED 1.00]
- **Components consolidated into src/constants/index.js** — src_constants_index_module, readme_constants_consolidation_worklog, src_screens_adminscreen_adminscreen, src_screens_prayerscreen_prayerscreen, src_composables_usedolyo_usedolyo, src_screens_statisticsscreen_statisticsscreen [EXTRACTED 1.00]
- **Telegram WebApp context flowing into SPA auth/token handling** — index_telegram_webapp_script, claude_token_storage_strategy, src_stores_auth_authstore [INFERRED 0.80]

## Communities (164 total, 36 thin omitted)

### Community 0 - "Sunhan Yanghagi Screen"
Cohesion: 0.02
Nodes (66): actionTarget, activeScriptText, activeTab, allShedProspects, asLoading, asRows, auth, BIHAP_OPTS (+58 more)

### Community 1 - "Online Intake Screen"
Cohesion: 0.03
Nodes (59): activeSheetTab, auth, { callApiPromise }, colFilters, COLS, DD_OPTS, ddPanelStyle, dropdownOpts (+51 more)

### Community 2 - "Sheet View Screen"
Cohesion: 0.03
Nodes (50): auth, { callApiPromise }, colFilters, COLS, DD_OPTS, ddPanelStyle, dropdownOpts, editCell (+42 more)

### Community 3 - "use Api Composable"
Cohesion: 0.05
Nodes (48): callApi 401 -> refresh-once -> retry -> logout flow, Cloudflare Cache API layer (per-sabun keyed), Ddochi-Backend repo (Django rewrite of API side), OCI Object Storage, Single-domain topology via three Pages Functions, tel_router (dashboard SPA backend), functions/api/[[path]].ts (transparent proxy to services/main), functions/dashboard/[[path]].ts (proxy to tel_router dashboard SPA) (+40 more)

### Community 4 - "Intake Sync Modal"
Cohesion: 0.04
Nodes (44): activeTab, { callApiPromise }, cfgName, colAddr, colAge, colDate, colName, colPhone (+36 more)

### Community 5 - "Center Screen"
Cohesion: 0.04
Nodes (22): auth, { callApi, callApiPromise }, center, finalResultState, { getDay, autoResize, copyText }, leafState, loading, logsPopupIdx (+14 more)

### Community 6 - "Daily Report Screen"
Cohesion: 0.04
Nodes (36): activity, auth, { callApi, callApiPromise }, copyLoading, dateChoice, dmRows, dupChoice, filteredSuggestions (+28 more)

### Community 7 - "Matching History Screen"
Cohesion: 0.05
Nodes (38): addDays(), auth, bottomSentinel, { callApi }, clearAllFilters(), colFilters, COLUMNS, displayGroups (+30 more)

### Community 8 - "Habjaeyang Screen"
Cohesion: 0.04
Nodes (35): acConfirmed, acOpen, acQuery, acStatus, auth, { autoResize, moveFocus }, { callApi, callApiPromise }, currentDocId (+27 more)

### Community 9 - "User Management Modal"
Cohesion: 0.04
Nodes (34): areas, bulkAreaId, bulkAreas, bulkPanel, bulkRoleIds, bulkTeamId, { callApi }, editingSabun (+26 more)

### Community 10 - "Feedback Screen"
Cohesion: 0.06
Nodes (41): auth, bookSlot(), { callApiPromise }, cancelBook(), computeSlotTimes(), copyToast, createSlot(), creating (+33 more)

### Community 11 - "Weekly Template Modal Weekly Component"
Cohesion: 0.05
Nodes (25): activePaletteTab, auth, { callApi, callApiPromise }, canSetUndefined, categories, currentCategory, editorState, emit (+17 more)

### Community 12 - "Dolyo Habjaeyang Modal"
Cohesion: 0.06
Nodes (30): auth, buildPayload(), emit, FAITH_LIST, form, isCustomPath, isEdit, moveFocus() (+22 more)

### Community 13 - "Tool Management Modal"
Cohesion: 0.07
Nodes (25): auth, { callApi, callApiPromise }, emit, loading, morningTime, newTimeInput, save(), saving (+17 more)

### Community 14 - "Dolyo Detail Screen"
Cohesion: 0.07
Nodes (29): actionLogsReverse, block(), { deleteActionLog }, emit, faithText, fd, hasFinalResult, hasHj (+21 more)

### Community 15 - "use Dolyo Composable"
Cohesion: 0.09
Nodes (27): errorMsg, filteredList, filterPanelOpen, filterStage, filterStatus, getAvailableScopes(), getStage(), list (+19 more)

### Community 16 - "Sheet Config Modal"
Cohesion: 0.08
Nodes (21): { callApi, callApiPromise }, closeEdit(), configs, deleteSheet(), dirty, editingIdx, emit, failedCount (+13 more)

### Community 17 - "Telegram Connect Modal"
Cohesion: 0.08
Nodes (28): activeTabIndex, { callApi }, cancelPairing(), CHANNEL_DEFS, chatIds, chatTitles, copyCommand(), cronLoading (+20 more)

### Community 18 - "Post Detail Screen"
Cohesion: 0.07
Nodes (25): auth, { autoResize, copyText }, board, { callApi }, canDelete, commentInput, comments, commentSubmitting (+17 more)

### Community 19 - "Sheet Edit Modal"
Cohesion: 0.08
Nodes (24): activePalette, bgOf(), btnColorOf(), { callApi, callApiPromise }, colAssignments, deleteSelf(), emit, form (+16 more)

### Community 20 - "Home Screen"
Cohesion: 0.06
Nodes (18): auth, { callApi, callApiPromise }, editPlanCategories, editPlanCategory, editPlanData, editPlanSaving, editPlanTime, route (+10 more)

### Community 21 - "Matching Screen"
Cohesion: 0.07
Nodes (21): auth, { callApi }, displayGroups, { getDay }, habjaeyangViewIdx, isDesktop, loading, matchResultIdx (+13 more)

### Community 23 - "Storage Pages Function (proxy)"
Cohesion: 0.13
Nodes (25): RFC-3986, b64urlToBytes(), b64urlToText(), enc, err(), JwtPayload, verifyHs256(), bytesToHex() (+17 more)

### Community 24 - "Dolyo Screen"
Cohesion: 0.07
Nodes (14): allTeams, allZonesInTeam, auth, availableScopes, detailDocId, detailItem, filterChipLabel, formItem (+6 more)

### Community 25 - "NPM Package Manifest"
Cohesion: 0.08
Nodes (25): canvas-confetti, dependencies, canvas-confetti, pinia, vue, vue-router, vuedraggable, devDependencies (+17 more)

### Community 26 - "Ministry Category Modal"
Cohesion: 0.10
Nodes (22): ACTIVITY_LABEL_MAP, ACTIVITY_OPTIONS, auth, { callApi }, cancelEdit(), canSetUndefined, COLOR_PALETTE, deleteCategory() (+14 more)

### Community 27 - "Sidebar Layout Component"
Cohesion: 0.11
Nodes (23): activeModal, auth, { callApi, callApiPromise }, canViewRegionTemplate, canViewTeamTemplate, close(), doLogout(), goTo() (+15 more)

### Community 28 - "Report Popup"
Cohesion: 0.10
Nodes (21): { autoResize }, captureScroll(), dateText, emit, handleSubmit(), methodText, openDateSelect(), openMethodSelect() (+13 more)

### Community 29 - "Weekly Score Screen"
Cohesion: 0.10
Nodes (22): addDays(), auth, { callApiPromise }, currentWeekStart(), daysLeft, DOW_LABEL, formatWeekLabel(), growthPct (+14 more)

### Community 30 - "Area Telegram Connect Modal"
Cohesion: 0.13
Nodes (24): activeTabIndex, { callApi }, cancelPairing(), cancelTeamPairing(), chatIds, chatTitles, copyCommand(), copyTeamCommand() (+16 more)

### Community 31 - "Habjaeyang View Popup"
Cohesion: 0.09
Nodes (21): buildCopyText(), copyHistory(), emit, historyIcon(), props, RESULT_ICON, { showToast }, viewIdx (+13 more)

### Community 32 - "App Modal Shared Component"
Cohesion: 0.10
Nodes (12): currentPopup, dateInput, dateUndecided, { popupStack, passwordState, closePopup }, reasonInput, reasonType, textInput, textInputRef (+4 more)

### Community 33 - "Time Block Painter Shared Component"
Cohesion: 0.12
Nodes (17): activeTab, auth, blocks, { callApi }, categories, clearBlocks(), currentCategory, emit (+9 more)

### Community 34 - "Area Score Screen"
Cohesion: 0.10
Nodes (17): addArea(), areaDetails, { callApi, callApiPromise }, { copyText }, load(), loading, mission, otherTeams (+9 more)

### Community 35 - "Admin Screen"
Cohesion: 0.10
Nodes (14): activeModal, auth, { callApi, callApiPromise }, debugMode, handleAdminAction(), openModal(), router, { showAppAlert, showAppConfirm } (+6 more)

### Community 36 - "Post Write Screen"
Cohesion: 0.10
Nodes (16): auth, { autoResize }, board, { callApi, callApiMultipart }, compressImage(), currentPostImages, fileInput, handleImageSelect() (+8 more)

### Community 37 - "Admin Audit Log Modal"
Cohesion: 0.11
Nodes (12): ACTION_LABEL, { callApi }, DOMAIN_LABEL, domainOf(), emit, errorMsg, expandedId, FILTER_OPTIONS (+4 more)

### Community 38 - "Sunhan Yanghagi Screen (part 2)"
Cohesion: 0.16
Nodes (20): cancelHabjaeyang(), cancelNoAnswerMsg(), closeAction(), closeNoAnswerMsg(), deleteLog(), doMeetingFix(), doNoAnswer(), doNoAnswerWithMsg() (+12 more)

### Community 39 - "Shared Constants"
Cohesion: 0.11
Nodes (19): dayDisplayOrder, helpText, hjFields, HOUR_MS, MATCH_RESULT_HIDE_MS, mbtiOptions, pathMap, phaseOrder (+11 more)

### Community 40 - "Activity Report Modal"
Cohesion: 0.12
Nodes (15): { callApi, callApiPromise }, emit, form, pickTeam(), previewError, previewImageUrl, previewIsDummy, previewLoading (+7 more)

### Community 41 - "Goal Setting Modal"
Cohesion: 0.11
Nodes (14): ALL_METRIC_KEYS, areas, { callApi, callApiPromise }, computedTotal, emit, EXTRA_METRICS, goalsByArea, METRICS (+6 more)

### Community 42 - "Area Score Request Screen"
Cohesion: 0.12
Nodes (16): auth, buildRequestText(), { callApi, callApiPromise }, { copyText }, ITEM_OPTIONS, itemCode, itemLabel, loading (+8 more)

### Community 43 - "Activity Coord Modal"
Cohesion: 0.12
Nodes (14): { callApi }, emit, form, hasChatId, pickTeam(), previewError, previewLoading, previewText (+6 more)

### Community 44 - "Current Schedule Modal"
Cohesion: 0.12
Nodes (14): { callApi }, emit, form, pickTeam(), previewError, previewHtml, previewLoading, previewText (+6 more)

### Community 45 - "My Goal Modal"
Cohesion: 0.12
Nodes (15): auth, { callApi, callApiPromise }, current, emit, goals, INDUCER_ROWS, loadAll(), loading (+7 more)

### Community 46 - "Semester Calendar Modal"
Cohesion: 0.14
Nodes (16): calendarCells, { callApi }, emit, getMidDate(), load(), loading, monthKey, monthNum (+8 more)

### Community 47 - "README Docs"
Cohesion: 0.12
Nodes (17): Ddochi/frontend (legacy monorepo source, ported from), legacy2/public/index.html (14k-line legacy monolith), leafOptions, phaseColorMap, prayerVerses, BoardMainScreen.vue (/board), CenterScreen.vue (/center), DailyReportScreen.vue (/daily-report) (+9 more)

### Community 48 - "Gacha Slot Overlay Screen"
Cohesion: 0.15
Nodes (16): clearTimer(), done(), emit, fireConfetti(), leverPulled, phase, props, pullLever() (+8 more)

### Community 49 - "Statistics Screen"
Cohesion: 0.12
Nodes (8): auth, { callApi }, currentPeriod, errorMessage, loading, periodData, sortedGroups, stats

### Community 50 - "Pages Functions TS Config"
Cohesion: 0.12
Nodes (15): compilerOptions, esModuleInterop, isolatedModules, lib, module, moduleResolution, noEmit, skipLibCheck (+7 more)

### Community 51 - "use Formatters Composable"
Cohesion: 0.13
Nodes (6): services/main/src/util/businessDate.js KST_OFFSET_MS (backend), useFormatters(), getBusinessDateObj(), getBusinessDateStr(), KR_TIME_DIFF_MS, sidebar/ActivityVenueModal.vue

### Community 52 - "Reflection Viewer Modal"
Cohesion: 0.12
Nodes (10): { callApi }, dateFrom, dateTo, emit, errorMsg, list, loading, scope (+2 more)

### Community 53 - "Board Main Screen"
Cohesion: 0.15
Nodes (12): auth, board, { callApi }, executePostSearch(), loading, loadPosts(), openBoardMain(), posts (+4 more)

### Community 54 - "Report Screen"
Cohesion: 0.12
Nodes (8): auth, { callApi }, currentPeriod, errorMessage, loading, periodData, sortedGroups, stats

### Community 55 - "Return Home Setting Modal"
Cohesion: 0.15
Nodes (13): activeTabIndex, { callApi, callApiPromise }, emit, loading, loadTeamConfig(), loadTeams(), msgRefs, rowState (+5 more)

### Community 56 - "Schedule Register Modal"
Cohesion: 0.14
Nodes (13): { callApi }, emit, FIELDS, form, load(), loading, monthKey, monthNum (+5 more)

### Community 57 - "Daily Report Screen (part 2)"
Cohesion: 0.19
Nodes (15): actuallySubmit(), buildSubmitPayload(), currentReportDateKey(), doSubmitWithKey(), fetchExisting(), fmtKstKey(), fmtKstLabel(), formatPromoItem() (+7 more)

### Community 58 - "Dolyo Approval Modal"
Cohesion: 0.15
Nodes (10): CANCEL_OPTIONS, commit(), emit, props, reasonText, reasonType, { setApproval }, { showAppAlert, showToast } (+2 more)

### Community 59 - "Dolyo Match Result Modal"
Cohesion: 0.16
Nodes (11): BIHAP_OPTIONS, commitManpix(), commitSubReason(), emit, GEOJEOL_OPTIONS, pickedType, props, { setMatchResult } (+3 more)

### Community 60 - "Prayer Screen"
Cohesion: 0.15
Nodes (11): auth, { autoResize }, { callApi }, content, onInput(), router, savePrayerDraft(), { showAppAlert } (+3 more)

### Community 61 - "Weekly Record Screen"
Cohesion: 0.14
Nodes (9): adminData, auth, { callApi }, dateKeys, errorMessage, loading, router, statsMap (+1 more)

### Community 62 - "Activity Venue Modal"
Cohesion: 0.16
Nodes (9): auth, { callApi }, DEFAULT_SLOTS(), emit, form, loading, loadVenue(), onDateChange() (+1 more)

### Community 63 - "Auto Reject Modal"
Cohesion: 0.17
Nodes (9): { callApi }, count, emit, loading, saveConfig(), selectedTeam, { showAppAlert }, step (+1 more)

### Community 64 - "Path Management Modal"
Cohesion: 0.18
Nodes (9): { callApiPromise }, deletePath(), editing, emit, loadAll(), loading, paths, saveEdit() (+1 more)

### Community 65 - "Daily Report Screen (part 3)"
Cohesion: 0.18
Nodes (13): getTodayDate(), loadDraft(), loadPathPrefs(), loadReportForName(), loadReportNameOptions(), loadYesterdayPlan(), onBlocksUpdate(), onMoodInput() (+5 more)

### Community 66 - "Week Start Personal Modal"
Cohesion: 0.17
Nodes (10): { callApi, callApiPromise }, effective, emit, global, loading, personal, save(), saving (+2 more)

### Community 67 - "Weekly Block Editor Weekly Component"
Cohesion: 0.17
Nodes (11): actCat, cleanName, DAY_NAMES, emit, endIdx, isActivity, memo, props (+3 more)

### Community 68 - "Shared Constants (part 2)"
Cohesion: 0.23
Nodes (12): Ddochi-Frontend CLAUDE.md, README describes an earlier, now-outdated architecture, Frontend constants agreed with backend enums/response keys, Ddochi-Frontend README.md, CHANNEL_LABELS, CHANNELS, FAITH_LABEL_MAP, OFFLINE_CHANNELS (+4 more)

### Community 69 - "App"
Cohesion: 0.17
Nodes (10): auth, { callApiPromise }, { closeDaumPostcode }, debugMode, isFullScreen, route, showNav, sidebarRef (+2 more)

### Community 70 - "Auth Config Modal"
Cohesion: 0.20
Nodes (11): accessTtl, { callApi, callApiPromise }, emit, load(), loading, newPasskey, passkeyHashSet, refreshTtl (+3 more)

### Community 71 - "Board Management Modal"
Cohesion: 0.21
Nodes (11): addBoard(), { callApi }, deleteBoard(), emit, errorMsg, list, load(), loading (+3 more)

### Community 72 - "Center Screen (part 2)"
Cohesion: 0.17
Nodes (12): applyCenterSort(), handleLeafDateSubmit(), handleLogDelete(), handleNurtureLogSubmit(), handleReportSubmit(), handleScheduleSubmit(), handleSort(), handleStatusSubmit() (+4 more)

### Community 73 - "Habjaeyang Screen (part 2)"
Cohesion: 0.18
Nodes (12): clearDraft(), collectSubmitData(), doActualSubmit(), DRAFT_KEY(), finishAndGoHome(), onRegConfirmYes(), onRegRegisterNo(), onRegRegisterYes() (+4 more)

### Community 74 - "Online Intake Screen (part 2)"
Cohesion: 0.18
Nodes (12): closeTmPopup(), commitTmChange(), deleteTmEntryByIdx(), filteredRows, formatTmEntries(), onTmKeydown(), parseTmEntries(), popupColValues (+4 more)

### Community 75 - "Nurture Log Detail Popup"
Cohesion: 0.18
Nodes (9): auth, { autoResize }, emit, form, handleSubmit(), props, reactionRef, reflectionRef (+1 more)

### Community 76 - "Schedule Popup"
Cohesion: 0.18
Nodes (8): DAYS, emit, handleSubmit(), props, { showAppAlert }, subStep, tempSchedule, timeInput

### Community 77 - "Strategy Popup"
Cohesion: 0.20
Nodes (8): emit, errorMsg, handleSubmit(), handleSuccessOk(), isMobile, linkInput, props, step

### Community 78 - "Dolyo Action Modal"
Cohesion: 0.20
Nodes (8): { addAction }, content, date, emit, onSave(), props, saving, { showToast }

### Community 79 - "Personal Stats Screen"
Cohesion: 0.22
Nodes (8): auth, { callApi }, currentPeriod, currentTab, drawFunnel(), getInducerFunnels(), getTeacherFunnels(), statsData

### Community 80 - "Sunhan Yanghagi Screen (part 3)"
Cohesion: 0.20
Nodes (11): ddochiListAll, ddochiPhones, doneList, hjNeededList, normPhone(), prospectEffTeam(), rejectedList, rowEffTeam() (+3 more)

### Community 81 - "Week Start Global Modal"
Cohesion: 0.22
Nodes (8): { callApi, callApiPromise }, currentGlobal, emit, loading, save(), saving, selected, { showAppAlert }

### Community 82 - "Matching Screen (part 2)"
Cohesion: 0.22
Nodes (10): editGuideName(), editMatchAction(), editSubName(), handleMatchResultPick(), handleTeacherSubmit(), handleTtagiFormSubmit(), loadMatchingData(), scrollToToday() (+2 more)

### Community 83 - "Teacher Edit Popup"
Cohesion: 0.22
Nodes (8): auth, emit, handleSubmit(), isTa, name, props, { showAppAlert }, step

### Community 84 - "Sheet View Screen (part 2)"
Cohesion: 0.22
Nodes (10): applyRowLogic(), commitTmChange(), confirmManpik(), connectSSE(), deleteTmEntryByIdx(), expireStaleInflows(), formatTmEntries(), load() (+2 more)

### Community 85 - "PWA Manifest"
Cohesion: 0.22
Nodes (8): background_color, description, display, icons, name, short_name, start_url, theme_color

### Community 86 - "Shared Constants (part 3)"
Cohesion: 0.28
Nodes (9): WIRED_MODALS (paired with adminMenuItems action keys), common/TimeBlockPainter.vue, ACTIVITY_HOUR_END, ACTIVITY_HOUR_START, adminMenuItems, dayLabels, pathGroupMap, AdminScreen.vue (/admin) (+1 more)

### Community 87 - "Access Key Screen"
Cohesion: 0.22
Nodes (6): auth, { callApi }, isLoading, keyInput, router, { showAppAlert }

### Community 88 - "Daily Report Merge Preview Modal"
Cohesion: 0.33
Nodes (8): changedRows, clip(), emit, leafParse(), merged, pick(), props, toNum()

### Community 89 - "Login Screen"
Cohesion: 0.22
Nodes (7): auth, { callApi }, { navigateAfterLogin }, passkeyInput, sabunInput, { showAppAlert }, submitting

### Community 90 - "Status Color Popup"
Cohesion: 0.25
Nodes (7): COLORS, emit, handleSubmit(), props, reason, selectedColor, selectedDisplay

### Community 91 - "Sheet View Screen (part 3)"
Cohesion: 0.22
Nodes (9): closeTmPopup(), filteredRows, onTmKeydown(), parseTmEntries(), popupColValues, submitTmInput(), todayMMDDHHMM(), togglePopupVal() (+1 more)

### Community 92 - "Sunhan Yanghagi Screen (part 4)"
Cohesion: 0.25
Nodes (9): ddochiList, displayTmStatus(), isFinal(), isLongTermReserved(), matchesShedSearch(), searchTmActiveList, searchTmDoneList, searchUnregList (+1 more)

### Community 93 - "Loading Screen"
Cohesion: 0.25
Nodes (5): auth, { callApi }, loadingText, { navigateAfterLogin }, router

### Community 94 - "Online Intake Screen (part 3)"
Cohesion: 0.32
Nodes (8): applyRowLogic(), clearIndoja(), closeIndojaPopup(), confirmManpik(), onIndojaKeydown(), saveRowDeferred(), statusForResult(), submitIndojaInput()

### Community 95 - "Ttagi Form Popup"
Cohesion: 0.29
Nodes (6): { autoResize }, emit, form, handleSubmit(), props, { showAppConfirm }

### Community 96 - "Dolyo Delete Modal"
Cohesion: 0.33
Nodes (6): emit, onConfirm(), props, { showAppAlert, showToast }, { softDelete }, submitting

### Community 97 - "Matching Screen (part 3)"
Cohesion: 0.33
Nodes (7): getBottomAreaType(), getMilrimNewDate(), getResDisplay(), getRightStatusHtml(), inputMatchResult(), isTeacherAssigned(), showHasConsultBtn()

### Community 98 - "Leaf Date Popup"
Cohesion: 0.33
Nodes (5): dateValue, emit, handleSubmit(), props, { showAppAlert }

### Community 99 - "Ttagi View Popup"
Cohesion: 0.29
Nodes (5): { autoResize }, emit, props, { showToast }, wrapRef

### Community 100 - "Api Pages Function (proxy)"
Cohesion: 0.47
Nodes (5): Env, FORWARDED_HEADERS, hasBody(), jsonError(), onRequest()

### Community 101 - "User Management Modal (part 2)"
Cohesion: 0.33
Nodes (6): cancelForm(), confirmBulk(), confirmSwap(), exitSelectMode(), load(), save()

### Community 102 - "User Management Modal (part 3)"
Cohesion: 0.33
Nodes (6): emptyForm(), enterSelectMode(), loadMeta(), openAdd(), openEdit(), openSwap()

### Community 103 - "Top Nav Layout Component"
Cohesion: 0.33
Nodes (3): auth, openSidebar, router

### Community 104 - "Online Intake Screen (part 4)"
Cohesion: 0.33
Nodes (6): di(), handleTableClick(), onTbodyMouseover(), openFilterPopup(), openIndojaPopup(), openTmPopup()

### Community 105 - "Leaf List Popup"
Cohesion: 0.33
Nodes (4): emit, LEAF_TYPES, leafMap, props

### Community 106 - "use Roles Composable"
Cohesion: 0.47
Nodes (5): _hasRegion(), _hasTeam(), REGION_ROLES, TEAM_ROLES, useRoles()

### Community 107 - "CLAUDE Docs"
Cohesion: 0.50
Nodes (4): LoadingScreen bounce-through auth-hydration pattern, LoadingScreen.vue, app, router

### Community 108 - "HTML Entry Point"
Cohesion: 0.40
Nodes (5): Telegram WebApp vs browser token storage strategy, SPA mount point (#app + /src/main.js), Daum postcode.v2.js script tag, manifest.json (PWA manifest), telegram-web-app.js script tag

### Community 109 - "User Management Modal (part 4)"
Cohesion: 0.40
Nodes (5): filteredList, globalStaff, minPosOrder(), posOrder(), teamStaff

### Community 110 - "Online Intake Screen (part 5)"
Cohesion: 0.70
Nodes (5): cancelEdit(), commitEdit(), onInputKeydown(), onTextareaKeydown(), selectOption()

### Community 111 - "Dropout Reason Popup"
Cohesion: 0.50
Nodes (4): emit, handleSubmit(), reason, { showAppAlert }

### Community 112 - "Logs Popup"
Cohesion: 0.50
Nodes (3): emit, handleClick(), props

### Community 113 - "Sheet View Screen (part 4)"
Cohesion: 0.70
Nodes (5): cancelEdit(), commitEdit(), onInputKeydown(), onTextareaKeydown(), selectOption()

### Community 114 - "Sheet View Screen (part 5)"
Cohesion: 0.40
Nodes (5): di(), handleTableClick(), onTbodyMouseover(), openFilterPopup(), openTmPopup()

### Community 115 - "Weekly Template Modal Weekly Component (part 2)"
Cohesion: 0.40
Nodes (5): adjustZoom(), applyZoom(), loadAll(), onTouchMove(), resetZoom()

### Community 116 - "use Tm Note Draft Composable"
Cohesion: 0.80
Nodes (4): clearTmNoteDraft(), key(), loadTmNoteDraft(), saveTmNoteDraft()

### Community 117 - "CLAUDE Docs (part 2)"
Cohesion: 0.50
Nodes (4): constants/index.js as single source for cross-component constants, 2026-05-09 constants consolidation work log, Domain-file split (enums.js/timings.js/domains.js) deferred until ~150 lines, src/constants/index.js

### Community 118 - "CLAUDE Docs (part 3)"
Cohesion: 0.50
Nodes (4): ddochiseom-frontend (Cloudflare Pages project), JWT_SECRET must match services/main's, synced on rotation, page.ddochi.cloud custom domain, wrangler.toml

### Community 121 - "Intake Sync Modal (part 2)"
Cohesion: 0.50
Nodes (4): deleteConfig(), loadConfigs(), saveConfig(), syncNow()

### Community 123 - "Habjaeyang Screen (part 3)"
Cohesion: 0.50
Nodes (4): acGuideOpts, acInflowOpts, acTmNameOpts, filterNames()

### Community 124 - "Habjaeyang Screen (part 4)"
Cohesion: 0.50
Nodes (4): applyFormData(), initForm(), loadDraft(), populateFromTmItem()

### Community 125 - "Matching Screen (part 4)"
Cohesion: 0.67
Nodes (4): deleteLog(), handleApprStatusClick(), handleContainerClick(), showApprDecisionPopup()

### Community 126 - "Final Result Popup"
Cohesion: 0.50
Nodes (3): currentVal, emit, props

### Community 128 - "use Daum Postcode Composable"
Cohesion: 0.67
Nodes (3): useDaumPostcode(), closeDaumPostcode(), execDaumPostcode()

### Community 130 - "Center Screen (part 3)"
Cohesion: 0.67
Nodes (3): handleDropoutSubmit(), handleFinalCenter(), submitFinalResult()

### Community 131 - "Online Intake Screen (part 6)"
Cohesion: 0.67
Nodes (3): connectSSE(), load(), prospectToCells()

### Community 133 - "Sunhan Yanghagi Screen (part 5)"
Cohesion: 0.67
Nodes (3): onNoteInput(), scheduleNoteSave(), toggleTag()

## Ambiguous Edges - Review These
- `adminMenuItems` → `WIRED_MODALS (paired with adminMenuItems action keys)`  [AMBIGUOUS]
  README.md · relation: conceptually_related_to

## Knowledge Gaps
- **1199 isolated node(s):** `deploy.sh script`, `Env`, `FORWARDED_HEADERS`, `Env`, `FORWARDED_REQ_HEADERS` (+1194 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1638 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **36 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `adminMenuItems` and `WIRED_MODALS (paired with adminMenuItems action keys)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `SPA mount point (#app + /src/main.js)` connect `HTML Entry Point` to `CLAUDE Docs`?**
  _High betweenness centrality (0.002) - this node is a cross-community bridge._
- **Why does `useApi()` connect `use Api Composable` to `HTML Entry Point`?**
  _High betweenness centrality (0.002) - this node is a cross-community bridge._
- **Are the 19 inferred relationships involving `useDolyo()` (e.g. with `getAvailableScopes()` and `getStage()`) actually correct?**
  _`useDolyo()` has 19 INFERRED edges - model-reasoned connections that need verification._
- **Are the 11 inferred relationships involving `useFormatters()` (e.g. with `autoResize()` and `copyText()`) actually correct?**
  _`useFormatters()` has 11 INFERRED edges - model-reasoned connections that need verification._
- **What connects `deploy.sh script`, `Env`, `FORWARDED_HEADERS` to the rest of the system?**
  _1199 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Sunhan Yanghagi Screen` be split into smaller, more focused modules?**
  _Cohesion score 0.022222222222222223 - nodes in this community are weakly interconnected._