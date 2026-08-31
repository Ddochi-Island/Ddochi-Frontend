<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import { useRouter } from "vue-router";
import { useApi, tokenStore } from "@/composables/useApi";
import { usePopup } from "@/composables/usePopup";
import { useAuthStore } from "@/stores/auth";

// DB 인덱스 (cells 배열):
// 결과(0) 상태(1) 찾은날짜(2) 도구(3) 경로(4) 인도자(5) 나이(6) 이름(7)
// 거주지(8) 번호(9) 환경/정보(10) 티엠(11) 횟수(12) 날짜(13) 예약일시(14)

const COLS = [
  { label: "결과",      di: 0                         },
  { label: "상태",      di: 1                         },
  { label: "찾은날짜",  di: 2                         },
  { label: "이름",      di: 7,  sticky: true, sw: 72  },
  { label: "나이",      di: 6                         },
  { label: "거주지",    di: 8                         },
  { label: "번호",      di: 9,  sticky: true, sw: 110 },
  { label: "경로",      di: 4                         },
  { label: "도구",      di: 3                         },
  { label: "환경/정보", di: 10                        },
  { label: "인도",      di: 5                         },
  { label: "티엠",      di: 11, sticky: true          },
  { label: "횟수",      di: 12                        },
  { label: "날짜",      di: 13                        },
  { label: "예약일시",  di: 14                        },
];
const HEADERS = COLS.map(c => c.label);
function di(ci) { return COLS[ci]?.di ?? ci; }
const STICKY_LEFT = (() => {
  let off = 0; const m = {};
  COLS.forEach((col, ci) => { if (col.sticky) { m[ci] = off; off += col.sw || 0; } });
  return m;
})();

function colGroup(ci) {
  if (ci <= 1) return "grp1";
  if (ci <= 10) return "grp2";
  return "grp3";
}

// ci:9(환경/정보)만 auto — 나머지는 고정폭
const FIXED_COL_W = { 0:96, 1:100, 2:80, 3:72, 4:34, 5:58, 6:110, 7:60, 8:64, 10:52, 11:64, 12:34, 13:80, 14:110 };
function colWidth(ci) {
  const w = FIXED_COL_W[ci];
  return w != null ? { width: w + 'px' } : {};
}

const RESULT_OPTS = [
  { value: "선문자필요", emoji: "🟡", bg: "#F9A825", fg: "#fff" },
  { value: "미진행", emoji: "⬜", bg: "#9E9E9E", fg: "#fff" },
  { value: "리트", emoji: "⬛", bg: "#424242", fg: "#fff" },
  { value: "티엠예약", emoji: "🟢", bg: "#2E7D32", fg: "#fff" },
  { value: "합자찾", emoji: "🔵", bg: "#1565C0", fg: "#fff" },
  { value: "장기관리", emoji: "🟣", bg: "#6A1B9A", fg: "#fff" },
  { value: "환경비합", emoji: "🟠", bg: "#E65100", fg: "#fff" },
  { value: "거리비합", emoji: "🟠", bg: "#E65100", fg: "#fff" },
  { value: "나이비합", emoji: "🟠", bg: "#E65100", fg: "#fff" },
  { value: "인성비합", emoji: "🟠", bg: "#E65100", fg: "#fff" },
  { value: "정신질환", emoji: "🟠", bg: "#E65100", fg: "#fff" },
  { value: "5회안받음", emoji: "🔴", bg: "#C62828", fg: "#fff" },
  { value: "수신거절", emoji: "🔴", bg: "#C62828", fg: "#fff" },
  { value: "경계거절", emoji: "🔴", bg: "#C62828", fg: "#fff" },
  { value: "갈부거절", emoji: "🔴", bg: "#C62828", fg: "#fff" },
  { value: "중복섭외자", emoji: "🟤", bg: "#4E342E", fg: "#fff" },
  { value: "중복신청자", emoji: "⬛", bg: "#37474F", fg: "#fff" },
  { value: "장난/비방", emoji: "⬛", bg: "#37474F", fg: "#fff" },
  { value: "본인아님", emoji: "⬛", bg: "#37474F", fg: "#fff" },
];
const STATUS_OPTS = [
  { value: "진행가능", emoji: "🟢", bg: "#2E7D32", fg: "#fff" },
  { value: "최종종료", emoji: "⬛", bg: "#212121", fg: "#fff" },
  { value: "확정일 기입 필요", emoji: "🔴", bg: "#C62828", fg: "#fff" },
  { value: "장기관리대상", emoji: "🟡", bg: "#F9A825", fg: "#fff" },
  { value: "선문자필요", emoji: "🟠", bg: "#E65100", fg: "#fff" },
];
const DD_OPTS = { 0: RESULT_OPTS, 1: STATUS_OPTS };
const DATETIME_DI = 14;
const READONLY_DIS = new Set([1, 2, 3, 7, 8, 9, 12, 13]);
const TEXTAREA_DI = 10;

function parseTmEntries(raw) {
  if (!raw || !raw.trim()) return [];
  return raw.trim().split(/\s+/).filter(Boolean).map((token, i) => {
    const pipe = token.indexOf('|');
    return pipe >= 0
      ? { idx: i + 1, name: token.slice(0, pipe), date: token.slice(pipe + 1) }
      : { idx: i + 1, name: token, date: '' };
  });
}
function formatTmEntries(entries) {
  return entries.map(e => e.date ? `${e.name}|${e.date}` : e.name).join(' ');
}
function todayMMDDHHMM() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}/${p(d.getDate())}@${p(d.getHours())}:${p(d.getMinutes())}`;
}

function fmtFoundDate(val) {
  const m = String(val || '').match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/);
  return m ? `${m[2]}/${m[3]} ${m[4]}:${m[5]}` : (val || '');
}

const TERMINATE_RESULTS = new Set([
  "환경비합", "거리비합", "나이비합", "인성비합", "정신질환",
  "5회안받음", "수신거절", "경계거절", "갈부거절",
  "중복섭외자", "중복신청자", "장난/비방", "본인아님", "합자찾",
]);

function getOptConfig(dbDi, value) {
  if (!value) return null;
  return (DD_OPTS[dbDi] || []).find((o) => o.value === value) || null;
}

// 결과값 → 상태값 매핑. 결과가 바뀌는 모든 경로(직접 수정 / 티엠 칸 자동전환)에서
// 공통으로 써서 "상태는 항상 결과에 종속" 을 보장한다. 못 찾으면 null (건드리지 않음).
function statusForResult(result, yeyakIlsi) {
  if (TERMINATE_RESULTS.has(result)) return "최종종료";
  if (result === "티엠예약") return yeyakIlsi ? "진행가능" : "확정일 기입 필요";
  if (result === "장기관리") return "장기관리대상";
  if (result === "리트") return "진행가능";
  if (result === "미진행") return "진행가능";
  if (result === "선문자필요") return "선문자필요";
  return null;
}

function applyRowLogic(cells, changedDi) {
  const c = cells.slice();
  const yeyakIlsi = c[14] || "";
  const p = (n) => String(n).padStart(2, "0");
  const nowStr = () => {
    const d = new Date();
    return `${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  };

  if (changedDi === 11) {
    const hadTm = !!(cells[12] && String(cells[12]).trim());
    const tmVal = c[11].trim();
    if (tmVal) {
      const tokens = tmVal.split(/\s+/).filter(Boolean);
      c[12] = String(tokens.length);
      const lastToken = tokens[tokens.length - 1];
      const pipe = lastToken.indexOf('|');
      c[13] = pipe >= 0 ? lastToken.slice(pipe + 1).replace('@', ' ') : nowStr();
    } else {
      c[12] = '';
      c[13] = '';
    }
    const nowHasTm = !!tmVal;
    // 티엠 칸이 비어있다가 채워지면 선문자필요→리트, 기록이 다 지워져 다시 비면 리트→선문자필요.
    // 이미 다른 결과(비합 등)로 처리된 건은 티엠 칸을 건드려도 자동으로 안 바뀜.
    if (!hadTm && nowHasTm && c[0] === "선문자필요") {
      c[0] = "리트";
    } else if (hadTm && !nowHasTm && c[0] === "리트") {
      c[0] = "선문자필요";
    }
  }

  // 상태는 항상 결과에 종속 — changedDi 와 무관하게 매번 재계산해서 항상 일치시킴.
  const derivedStatus = statusForResult(c[0] || "", yeyakIlsi);
  if (derivedStatus !== null) c[1] = derivedStatus;

  return c;
}

const ROW_BG = {
  '리트':     '#FFFDE7',
  '티엠예약': '#E8F5E9',
  '장기관리': '#F3E5F5',
};
const ROW_BG_GRAY = new Set(['환경비합','거리비합','나이비합','인성비합','정신질환','5회안받음','수신거절','경계거절','갈부거절','합자찾','중복섭외자','중복신청자','장난/비방','본인아님']);

function rowBg(result) {
  if (!result) return '';
  if (ROW_BG[result]) return ROW_BG[result];
  if (ROW_BG_GRAY.has(result)) return '#F0F0F0';
  return '';
}

const ZONE_COLORS = {
  '1': '#FCE4EC', '2': '#EDE7F6', '3': '#E8EAF6', '4': '#E3F2FD',
  '5': '#E0F7FA', '6': '#F1F8E9', '7': '#FFF8E1', '8': '#FFF3E0', '9': '#FBE9E7',
};
const nameZoneMap = ref({});

function zoneBg(val) {
  const s = String(val || '').trim();
  const numMatch = s.match(/^(\d+)/);
  if (numMatch) return ZONE_COLORS[numMatch[1]] || '';
  const zone = nameZoneMap.value[s];
  return zone ? (ZONE_COLORS[zone] || '') : '';
}
function cellBg(dbIdx, cells) {
  if (dbIdx === 11) return zoneBg((cells[11] || '').split(/\s+/)[0].split('|')[0]);
  return '';
}

function prospectToCells(p) {
  const g = (...keys) => { for (const k of keys) if (p[k] != null && p[k] !== '') return String(p[k]); return ''; };
  const tmLog = g('tm_log', 'TM_LOG');
  const tokens = tmLog.trim() ? tmLog.trim().split(/\s+/).filter(Boolean) : [];
  const lastToken = tokens.at(-1) || '';
  const pipe = lastToken.indexOf('|');
  const lastDate = pipe >= 0 ? lastToken.slice(pipe + 1).replace('@', ' ') : '';
  const cells = new Array(15).fill('');
  cells[0]  = g('tm_result', 'TM_RESULT');
  cells[1]  = g('tm_status', 'TM_STATUS');
  cells[2]  = g('created_ts', 'CREATED_TS');
  cells[3]  = g('tool', 'TOOL');
  cells[4]  = g('path', 'PATH');
  cells[5]  = g('manager_name', 'MANAGER_NAME');
  cells[6]  = p.age ?? p.AGE ? String(p.age ?? p.AGE) : '';
  cells[7]  = g('name', 'NAME');
  cells[8]  = g('residence', 'RESIDENCE');
  cells[9]  = g('phone', 'PHONE');
  cells[10] = g('extra_info', 'EXTRA_INFO');
  cells[11] = tmLog;
  cells[12] = tokens.length ? String(tokens.length) : '';
  cells[13] = lastDate;
  cells[14] = g('reserved_at', 'RESERVED_AT');
  return cells;
}

const router = useRouter();
const auth = useAuthStore();
const { callApiPromise } = useApi();
const { showAppAlert, showAppConfirm, showToast } = usePopup();

const loading = ref(true);
const saving = ref(false);
const rows = ref([]);

// 시트 탭 — 우리 팀에 연결된 시트(연동 설정)마다 탭 하나. 1개뿐이면 탭 자체를 안 보여줌.
const sheetTabs = ref([]);
const activeSheetTab = ref(null); // INTAKE_CONFIG_ID | null(탭 없음/전부)
async function loadSheetConfigs() {
  try {
    const r = await callApiPromise("/api/intake/list-configs", {});
    if (!r.ok) return;
    const myTeam = auth.currentUserTeam;
    const mine = (r.configs || []).filter(c => (c.TEAM_NAME ?? c.team_name) === myTeam);
    sheetTabs.value = mine.map(c => ({ id: c.INTAKE_CONFIG_ID ?? c.intake_config_id, name: c.NAME ?? c.name }));
    if (sheetTabs.value.length > 1 && !activeSheetTab.value) {
      activeSheetTab.value = sheetTabs.value[0].id;
    }
  } catch (_) { /* 탭 없이도 화면은 정상 동작해야 하니 조용히 무시 */ }
}
// _origIdx 는 rows.value 기준 원본 인덱스 — 탭 필터링 전에 먼저 붙여서
// 이후 저장/삭제 등이 항상 rows.value[_origIdx] 로 올바른 행을 가리키게 한다.
const indexedRows = computed(() => rows.value.map((row, idx) => ({ ...row, _origIdx: idx })));
const sheetFilteredRows = computed(() => {
  if (sheetTabs.value.length <= 1 || !activeSheetTab.value) return indexedRows.value;
  return indexedRows.value.filter(r => r.sheetConfigId === activeSheetTab.value);
});
const newCountByTab = computed(() => {
  const map = {};
  for (const row of rows.value) {
    if (row.cells[0] !== "선문자필요") continue;
    const key = row.sheetConfigId;
    map[key] = (map[key] || 0) + 1;
  }
  return map;
});

const colFilters = ref({});
const filterPopup = ref(null);
const filterSearch = ref('');

const filteredRows = computed(() => {
  const tmFilter = colFilters.value[11];
  const filtered = sheetFilteredRows.value
    .filter(row => {
      for (const [ciStr, allowed] of Object.entries(colFilters.value)) {
        if (!allowed) continue;
        const ci = parseInt(ciStr);
        if (ci === 11) {
          const names = parseTmEntries(row.cells[11] || '').map(e => e.name);
          if (!names.some(n => allowed.has(n))) return false;
        } else {
          if (!allowed.has(row.cells[ci] || '')) return false;
        }
      }
      return true;
    });
  if (tmFilter) {
    return filtered.slice().sort((a, b) => {
      const dateOf = row => parseTmEntries(row.cells[11] || '')
        .filter(e => tmFilter.has(e.name))
        .map(e => e.date).sort().at(-1) || '';
      return dateOf(b).localeCompare(dateOf(a));
    });
  }
  return filtered;
});

const hasAnyFilter = computed(() => Object.values(colFilters.value).some(Boolean));
function colHasFilter(ci) { return !!colFilters.value[ci]; }

const userNames = ref([]);

const popupColValues = computed(() => {
  if (!filterPopup.value) return [];
  const ci = filterPopup.value.ci;
  const q = filterSearch.value.trim().toLowerCase();
  if (ci === 11) {
    const validNames = new Set(userNames.value);
    const names = [...new Set(rows.value.flatMap(r => parseTmEntries(r.cells[11] || '').map(e => e.name)))].filter(n => n && validNames.has(n)).sort();
    return q ? names.filter(n => n.toLowerCase().includes(q)) : names;
  }
  const vals = [...new Set(rows.value.map(r => r.cells[ci] || ''))].sort();
  return q ? vals.filter(v => v.toLowerCase().includes(q)) : vals;
});

const popupAllSelected = computed(() => {
  if (!filterPopup.value) return true;
  const s = colFilters.value[filterPopup.value.ci];
  if (!s) return true;
  return popupColValues.value.every(v => s.has(v));
});

function isPopupValChecked(val) {
  const s = colFilters.value[filterPopup.value?.ci];
  return !s || s.has(val);
}

function openFilterPopup(screenCi, event) {
  const dbDi = di(screenCi);
  const rect = event.currentTarget.getBoundingClientRect();
  if (filterPopup.value?.ci === dbDi) { filterPopup.value = null; return; }
  filterSearch.value = '';
  filterPopup.value = { ci: dbDi, x: rect.left, y: rect.bottom };
}
function closeFilterPopup() { filterPopup.value = null; filterSearch.value = ''; }

function togglePopupVal(val) {
  const ci = filterPopup.value?.ci;
  if (ci == null) return;
  const allVals = ci === 11
    ? [...new Set(rows.value.flatMap(r => parseTmEntries(r.cells[11] || '').map(e => e.name))).values()].filter(Boolean)
    : [...new Set(rows.value.map(r => r.cells[ci] || ''))];
  const s = colFilters.value[ci] ? new Set(colFilters.value[ci]) : new Set(allVals);
  if (s.has(val)) s.delete(val); else s.add(val);
  if (allVals.every(v => s.has(v))) {
    const next = { ...colFilters.value }; delete next[ci]; colFilters.value = next;
  } else {
    colFilters.value = { ...colFilters.value, [ci]: s };
  }
}

function toggleSelectAll() {
  const ci = filterPopup.value?.ci;
  if (ci == null) return;
  const visible = popupColValues.value;
  const allVals = ci === 11
    ? [...new Set(rows.value.flatMap(r => parseTmEntries(r.cells[11] || '').map(e => e.name))).values()].filter(Boolean)
    : [...new Set(rows.value.map(r => r.cells[ci] || ''))];
  const prev = colFilters.value[ci] ? new Set(colFilters.value[ci]) : new Set(allVals);
  if (popupAllSelected.value) {
    visible.forEach(v => prev.delete(v));
  } else {
    visible.forEach(v => prev.add(v));
  }
  if (allVals.every(v => prev.has(v))) {
    const next = { ...colFilters.value }; delete next[ci]; colFilters.value = next;
  } else {
    colFilters.value = { ...colFilters.value, [ci]: prev };
  }
}

function clearColFilter(ci) {
  const next = { ...colFilters.value }; delete next[ci]; colFilters.value = next;
}
function clearAllFilters() { colFilters.value = {}; }

const filterPopupStyle = computed(() => {
  if (!filterPopup.value) return { display: 'none' };
  const panelW = 220;
  const left = Math.min(filterPopup.value.x, window.innerWidth - panelW - 8);
  return { position: 'fixed', left: Math.max(4, left) + 'px', top: filterPopup.value.y + 'px', zIndex: 10002 };
});

const textareaRef = ref(null);
const editCell = ref(null);
const editValue = ref("");
const floatRect = ref(null);
let activeTd = null;
let isMounted = true;
const pendingSave = new Map();

const tmPopup = ref(false);
const tmPopupRowIdx = ref(-1);
const tmInput = ref('');
const tmInputError = ref(false);
const tmInputRef = ref(null);
const vvHeight = ref(0);

const indojaPopup = ref(false);
const indojaPopupRowIdx = ref(-1);
const indojaInput = ref('');
const indojaInputError = ref(false);
const indojaInputRef = ref(null);

const hoverTooltip = ref(null);

function onTbodyMouseover(e) {
  const td = e.target.closest("td[data-ci]");
  if (!td) { hoverTooltip.value = null; return; }
  const screenCi = parseInt(td.dataset.ci);
  const dbDi = di(screenCi);
  const ri = parseInt(td.dataset.ri);
  const val = (rows.value[ri]?.cells[dbDi] || "").trim();

  // 찾은날짜(화면2=DB2)
  if (screenCi === 2) {
    if (!val) { hoverTooltip.value = null; return; }
    const rect = td.getBoundingClientRect();
    hoverTooltip.value = { text: val, x: rect.left, y: rect.bottom + 6, mode: "pre" };
    return;
  }
  // 거주지(화면5=DB8)
  if (screenCi === 5) {
    if (!val || val.length <= 5) { hoverTooltip.value = null; return; }
    const rect = td.getBoundingClientRect();
    hoverTooltip.value = { text: val, x: rect.left, y: rect.bottom + 6, mode: "pre" };
    return;
  }
  // 환경/정보(화면9=DB10)
  if (screenCi === 9) {
    if (!val) { hoverTooltip.value = null; return; }
    const rect = td.getBoundingClientRect();
    hoverTooltip.value = { text: val, x: rect.left, y: rect.bottom + 6, mode: "pre" };
    return;
  }
  // 티엠(화면11=DB11): 2개 이상일 때만
  if (screenCi === 11) {
    if (!val || !val.includes(" ")) { hoverTooltip.value = null; return; }
    const rect = td.getBoundingClientRect();
    hoverTooltip.value = { text: val, x: rect.left, y: rect.bottom + 6, mode: "list" };
    return;
  }
  hoverTooltip.value = null;
}
function onTbodyMouseleave() { hoverTooltip.value = null; }

const isDropdown = computed(() => editCell.value != null && !!DD_OPTS[editCell.value.ci]);
const isDatetime = computed(() => editCell.value?.ci === DATETIME_DI);
const isTextarea = computed(() => editCell.value?.ci === TEXTAREA_DI);

function autoResizeTextarea() {
  const el = textareaRef.value;
  if (!el) return;
  el.style.height = "auto";
  const minH = floatRect.value?.height || 26;
  el.style.height = Math.max(el.scrollHeight, minH) + "px";
}
watch(editValue, () => { if (isTextarea.value) nextTick(autoResizeTextarea); });
watch(isTextarea, (v) => { if (v) nextTick(autoResizeTextarea); });

const dropdownOpts = computed(() => editCell.value != null ? DD_OPTS[editCell.value.ci] || [] : []);

const ddPanelStyle = computed(() => {
  const r = floatRect.value;
  if (!r || !isDropdown.value) return { display: "none" };
  const spaceBelow = window.innerHeight - (r.top + r.height);
  if (spaceBelow < 280) {
    return { position: "fixed", left: r.left + "px", top: r.top + "px", transform: "translateY(-100%)", minWidth: "150px", zIndex: 10001 };
  }
  return { position: "fixed", left: r.left + "px", top: r.top + r.height + "px", transform: "none", minWidth: "150px", zIndex: 10001 };
});

function selectOption(val) {
  const prevRowIdx = editCell.value?.rowIdx;
  const prevCi = editCell.value?.ci;

  if (prevCi === 0 && val === '합자찾') {
    cancelEdit();
    manpikPendingRowIdx.value = prevRowIdx;
    manpikConfirm.value = true;
    return;
  }

  editValue.value = val;
  commitEdit();

  if (prevCi === 0 && val === "티엠예약") {
    nextTick(() => {
      const td = document.querySelector(`td[data-ri="${prevRowIdx}"][data-di="${DATETIME_DI}"]`);
      if (!td) return;
      if (activeTd) activeTd.classList.remove("sv-cell-active");
      activeTd = td;
      td.classList.add("sv-cell-active");
      const rect = td.getBoundingClientRect();
      floatRect.value = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
      editCell.value = { rowIdx: prevRowIdx, ci: DATETIME_DI };
      const raw = rows.value[prevRowIdx]?.cells[DATETIME_DI] || "";
      editValue.value = raw.includes(" ") ? raw.replace(" ", "T") : raw;
      nextTick(() => {
        const el = document.querySelector(".sv-float-datetime");
        el?.focus();
        el?.showPicker?.();
      });
    });
  }
}

const floatStyle = computed(() => {
  const r = floatRect.value;
  if (!r || !editCell.value) return { display: "none" };
  return { position: "fixed", left: r.left + "px", top: r.top + "px", minWidth: r.width + "px", width: r.width + "px", height: r.height + "px" };
});
const floatTextareaStyle = computed(() => {
  const r = floatRect.value;
  if (!r || !editCell.value) return { display: "none" };
  return { position: "fixed", left: r.left + "px", top: r.top + "px", minWidth: Math.max(r.width, 180) + "px", width: Math.max(r.width, 180) + "px", minHeight: r.height + "px", overflow: "hidden", resize: "none" };
});

const tmPopupStyle = computed(() => {
  const kbHeight = window.innerHeight - (vvHeight.value || window.innerHeight);
  return { bottom: kbHeight + 'px' };
});

async function load() {
  loading.value = true;
  try {
    const r = await callApiPromise("/api/intake/list-prospects", {});
    if (!r.ok) { showAppAlert("조회 실패: " + (r.error || "")); loading.value = false; return; }
    rows.value = (r.prospects || []).map(p => ({
      id: p.id ?? p.ID,
      cells: prospectToCells(p),
      sheetConfigId: p.sheet_config_id ?? p.SHEET_CONFIG_ID ?? null,
    }));
  } catch (e) {
    showAppAlert("조회 중 오류: " + e.message);
  }
  loading.value = false;
}

function saveRowDeferred(rowIdx, cells) {
  const row = rows.value[rowIdx];
  if (!row) return;
  if (pendingSave.has(row.id)) clearTimeout(pendingSave.get(row.id));
  const cellsCopy = cells.slice();
  pendingSave.set(row.id, setTimeout(async () => {
    pendingSave.delete(row.id);
    try {
      const r = await callApiPromise("/api/intake/save-row", { id: row.id, cells: cellsCopy });
      if (!r.ok && isMounted) showToast("저장 실패: " + (r.error || ""));
    } catch (e) {
      if (isMounted) showToast("저장 오류: " + e.message);
    }
  }, 600));
}

function handleTableClick(event) {
  const td = event.target.closest("td[data-ci]");
  if (!td) return;
  const rowIdx = parseInt(td.dataset.ri);
  const screenCi = parseInt(td.dataset.ci);
  const ci = di(screenCi);
  if (READONLY_DIS.has(ci)) return;

  if (ci === 11) {
    if (editCell.value) commitEdit();
    if (activeTd) activeTd.classList.remove("sv-cell-active");
    activeTd = td;
    td.classList.add("sv-cell-active");
    openTmPopup(rowIdx);
    return;
  }

  if (ci === 5) {
    if (editCell.value) commitEdit();
    if (activeTd) activeTd.classList.remove("sv-cell-active");
    activeTd = td;
    td.classList.add("sv-cell-active");
    openIndojaPopup(rowIdx);
    return;
  }

  if (editCell.value) commitEdit();
  if (activeTd) activeTd.classList.remove("sv-cell-active");
  activeTd = td;
  td.classList.add("sv-cell-active");
  const rect = td.getBoundingClientRect();
  floatRect.value = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  editCell.value = { rowIdx, ci };
  let raw = rows.value[rowIdx]?.cells[ci] || "";
  if (ci === DATETIME_DI && typeof raw === 'string' && raw.includes(" ")) raw = raw.replace(" ", "T");
  editValue.value = raw;
  nextTick(() => {
    const el = document.querySelector(".sv-float-input, .sv-float-datetime, .sv-float-textarea");
    el?.focus();
    if (el?.type === "datetime-local") el.showPicker?.();
  });
}

async function commitEdit() {
  if (!editCell.value || !isMounted) return;
  const { rowIdx, ci } = editCell.value;
  const row = rows.value[rowIdx];
  if (!row) { cancelEdit(); return; }
  const original = row.cells[ci] || "";
  let newVal = editValue.value;
  if (ci === DATETIME_DI && newVal.includes("T")) newVal = newVal.replace("T", " ");
  editCell.value = null;
  floatRect.value = null;
  if (activeTd) { activeTd.classList.remove("sv-cell-active"); activeTd = null; }
  if (newVal === original) return;
  row.cells[ci] = newVal;
  const updatedCells = applyRowLogic(row.cells, ci);
  for (let i = 0; i < updatedCells.length; i++) rows.value[rowIdx].cells[i] = updatedCells[i];
  saveRowDeferred(rowIdx, updatedCells);
}

function cancelEdit() {
  editCell.value = null;
  floatRect.value = null;
  if (activeTd) { activeTd.classList.remove("sv-cell-active"); activeTd = null; }
}

function onInputKeydown(e) {
  if (e.isComposing || e.keyCode === 229) return;
  if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); commitEdit(); }
  if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
}
function onTextareaKeydown(e) {
  if (e.isComposing || e.keyCode === 229) return;
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commitEdit(); }
  if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
}

const manpikConfirm = ref(false);
const manpikPendingRowIdx = ref(-1);

function confirmManpik() {
  const rowIdx = manpikPendingRowIdx.value;
  manpikConfirm.value = false;
  manpikPendingRowIdx.value = -1;
  const row = rows.value[rowIdx];
  if (!row) return;
  row.cells[0] = '합자찾';
  const updatedCells = applyRowLogic(row.cells, 0);
  for (let i = 0; i < updatedCells.length; i++) rows.value[rowIdx].cells[i] = updatedCells[i];
  saveRowDeferred(rowIdx, updatedCells);
  router.push({ name: 'habjaeyang' });
}
function cancelManpik() { manpikConfirm.value = false; manpikPendingRowIdx.value = -1; }

function openTmPopup(rowIdx) {
  tmPopupRowIdx.value = rowIdx;
  tmInput.value = '';
  tmInputError.value = false;
  tmPopup.value = true;
  nextTick(() => tmInputRef.value?.focus());
}
function closeTmPopup() {
  if (activeTd) { activeTd.classList.remove('sv-cell-active'); activeTd = null; }
  tmPopup.value = false;
  tmPopupRowIdx.value = -1;
  tmInput.value = '';
  tmInputError.value = false;
}
function onTmKeydown(e) {
  if (e.isComposing || e.keyCode === 229) return;
  if (e.key === 'Enter') { e.preventDefault(); submitTmInput(); }
  if (e.key === 'Escape') { e.preventDefault(); closeTmPopup(); }
}
function submitTmInput() {
  const name = tmInput.value.trim();
  if (!name) return;
  if (userNames.value.length > 0 && !userNames.value.includes(name)) {
    tmInputError.value = true;
    setTimeout(() => {
      tmInputError.value = false;
      tmInput.value = '';
      nextTick(() => tmInputRef.value?.focus());
    }, 600);
    return;
  }
  const rowIdx = tmPopupRowIdx.value;
  const row = rows.value[rowIdx];
  if (!row) return;
  const entries = parseTmEntries(row.cells[11]);
  entries.push({ idx: entries.length + 1, name, date: todayMMDDHHMM() });
  commitTmChange(rowIdx, entries);
  tmInput.value = '';
  nextTick(() => tmInputRef.value?.focus());
}
function deleteTmEntryByIdx(origIdx) {
  const rowIdx = tmPopupRowIdx.value;
  const row = rows.value[rowIdx];
  if (!row) return;
  const entries = parseTmEntries(row.cells[11]);
  entries.splice(origIdx, 1);
  commitTmChange(rowIdx, entries);
}
function commitTmChange(rowIdx, entries) {
  const row = rows.value[rowIdx];
  if (!row) return;
  row.cells[11] = formatTmEntries(entries);
  const updatedCells = applyRowLogic(row.cells, 11);
  for (let i = 0; i < updatedCells.length; i++) rows.value[rowIdx].cells[i] = updatedCells[i];
  saveRowDeferred(rowIdx, updatedCells);
}

function openIndojaPopup(rowIdx) {
  indojaPopupRowIdx.value = rowIdx;
  indojaInput.value = '';
  indojaInputError.value = false;
  indojaPopup.value = true;
  nextTick(() => indojaInputRef.value?.focus());
}
function closeIndojaPopup() {
  if (activeTd) { activeTd.classList.remove('sv-cell-active'); activeTd = null; }
  indojaPopup.value = false;
  indojaPopupRowIdx.value = -1;
  indojaInput.value = '';
  indojaInputError.value = false;
}
function onIndojaKeydown(e) {
  if (e.isComposing || e.keyCode === 229) return;
  if (e.key === 'Enter') { e.preventDefault(); submitIndojaInput(); }
  if (e.key === 'Escape') { e.preventDefault(); closeIndojaPopup(); }
}
function submitIndojaInput() {
  const name = indojaInput.value.trim();
  if (!name) return;
  if (userNames.value.length > 0 && !userNames.value.includes(name)) {
    indojaInputError.value = true;
    setTimeout(() => {
      indojaInputError.value = false;
      indojaInput.value = '';
      nextTick(() => indojaInputRef.value?.focus());
    }, 600);
    return;
  }
  const rowIdx = indojaPopupRowIdx.value;
  const row = rows.value[rowIdx];
  if (!row) return;
  row.cells[5] = name;
  saveRowDeferred(rowIdx, row.cells);
  closeIndojaPopup();
}
function clearIndoja() {
  const rowIdx = indojaPopupRowIdx.value;
  const row = rows.value[rowIdx];
  if (!row) return;
  row.cells[5] = '';
  saveRowDeferred(rowIdx, row.cells);
  closeIndojaPopup();
}

function confirmDeleteRow(rowIdx) {
  const row = rows.value[rowIdx];
  if (!row) return;
  showAppConfirm(`${rowIdx + 1}번째 행을 삭제할까?`, async (yes) => {
    if (!yes) return;
    saving.value = true;
    try {
      const r = await callApiPromise("/api/intake/delete-row", { id: row.id });
      if (!r.ok) { showAppAlert("삭제 실패: " + (r.error || "")); saving.value = false; return; }
      rows.value.splice(rowIdx, 1);
      showToast("행이 삭제됐어!");
    } catch (e) {
      showAppAlert("삭제 중 오류: " + e.message);
    }
    saving.value = false;
  });
}

const VP_DEFAULT = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
const VP_ZOOMABLE = 'width=device-width, initial-scale=1.0';
function setViewport(content) {
  const el = document.querySelector('meta[name="viewport"]');
  if (el) el.setAttribute('content', content);
}
function onVisualViewportResize() {
  vvHeight.value = window.visualViewport?.height ?? window.innerHeight;
}

let sseSource = null;
function connectSSE() {
  const token = tokenStore.getAccess();
  const url = token && tokenStore.isWebApp()
    ? `/api/intake/events?token=${encodeURIComponent(token)}`
    : '/api/intake/events';
  sseSource = new EventSource(url);
  sseSource.addEventListener('reload', () => {
    if (!editCell.value && !tmPopup.value && !indojaPopup.value) load();
  });
  sseSource.onerror = () => {
    sseSource.close();
    setTimeout(connectSSE, 5000);
  };
}

onMounted(() => {
  const defaultAllowed = new Set(STATUS_OPTS.filter(o => o.value !== '최종종료').map(o => o.value));
  defaultAllowed.add('');
  colFilters.value = { 1: defaultAllowed };
  load();
  loadSheetConfigs();
  setViewport(VP_ZOOMABLE);
  vvHeight.value = window.visualViewport?.height ?? window.innerHeight;
  window.visualViewport?.addEventListener('resize', onVisualViewportResize);
  connectSSE();
  callApiPromise('/api/daily-report/list-names', {}).then(r => {
    if (r.success) {
      userNames.value = (r.names || []).map(u => u.name);
      const map = {};
      for (const u of r.names || []) {
        if (u.name && u.areaId) map[u.name] = String(u.areaId);
      }
      nameZoneMap.value = map;
    }
  }).catch(() => {});
});
onUnmounted(() => {
  isMounted = false;
  pendingSave.forEach((t) => clearTimeout(t));
  editCell.value = null;
  setViewport(VP_DEFAULT);
  window.visualViewport?.removeEventListener('resize', onVisualViewportResize);
  sseSource?.close();
});
</script>

<template>
  <div class="sv-screen">
    <div class="sv-topbar">
      <span class="sv-title">온라인 유입확인</span>
      <span v-if="hasAnyFilter && !loading" class="sv-filter-count">{{ filteredRows.length }}건</span>
      <button v-if="hasAnyFilter && !loading" class="sv-filter-clear" @click="clearAllFilters">✕ 필터해제</button>
      <span v-if="saving" class="sv-saving">저장 중...</span>
    </div>

    <div v-if="sheetTabs.length > 1" class="sv-sheet-tabs">
      <button
        v-for="tab in sheetTabs" :key="tab.id"
        class="sv-sheet-tab" :class="{ on: activeSheetTab === tab.id }"
        @click="activeSheetTab = tab.id"
      >
        {{ tab.name }}
        <span v-if="newCountByTab[tab.id]" class="sv-sheet-tab-badge">{{ newCountByTab[tab.id] }}</span>
      </button>
    </div>

    <div v-if="loading" class="sv-loading">
      <div class="sv-spinner"></div>
      <div>불러오는 중...</div>
    </div>

    <div v-else class="sv-wrap">
      <table class="sv-table">
        <colgroup>
          <col v-for="(_, ci) in COLS" :key="ci" :style="colWidth(ci)" />
          <col style="width:24px" />
        </colgroup>
        <thead>
          <tr>
            <th
              v-for="(col, ci) in HEADERS" :key="ci"
              class="sv-th"
              :class="[colGroup(ci), { 'sv-th-filtered': colHasFilter(di(ci)), 'sv-td-founddate': ci === 2, 'sv-td-addr': ci === 5, 'sv-col-name': ci === 3, 'sv-col-beonho': ci === 6 }]"
              :style="COLS[ci]?.sticky ? { position: 'sticky', left: STICKY_LEFT[ci] + 'px', zIndex: 3 } : {}"
              @click.stop="openFilterPopup(ci, $event)"
            >{{ col }}<span class="sv-th-fbtn" :class="{ 'sv-th-fbtn-on': colHasFilter(di(ci)) }">▾</span></th>
            <th class="sv-th sv-th-del"></th>
          </tr>
        </thead>
        <tbody @click.stop="handleTableClick" @mouseover="onTbodyMouseover" @mouseleave="onTbodyMouseleave">
          <tr
            v-for="row in filteredRows" :key="row.id" class="sv-row"
            :data-row-id="row.id"
            :style="rowBg(row.cells[0]) ? { '--row-bg': rowBg(row.cells[0]) } : {}"
          >
            <td
              v-for="(_, ci) in HEADERS" :key="ci" class="sv-td"
              :class="{ 'sv-td-ro': READONLY_DIS.has(di(ci)), 'sv-td-center': ci === 2 || ci === 4 || ci === 12, 'sv-td-founddate': ci === 2, 'sv-td-addr': ci === 5, 'sv-col-name': ci === 3, 'sv-col-beonho': ci === 6 }"
              :style="[cellBg(di(ci), row.cells) ? { background: cellBg(di(ci), row.cells) } : {}, COLS[ci]?.sticky ? { position: 'sticky', left: STICKY_LEFT[ci] + 'px', zIndex: 1 } : {}]"
              :data-ri="row._origIdx" :data-ci="ci" :data-di="di(ci)"
            >
              <span v-if="getOptConfig(di(ci), row.cells[di(ci)])" class="sv-badge"
                :style="{ background: getOptConfig(di(ci), row.cells[di(ci)]).bg, color: getOptConfig(di(ci), row.cells[di(ci)]).fg }">
                {{ getOptConfig(di(ci), row.cells[di(ci)]).emoji }} {{ row.cells[di(ci)] }}
              </span>
              <!-- 찾은날짜(화면2=DB2): MM/DD HH:MM 표시 -->
              <template v-else-if="ci === 2">{{ fmtFoundDate(row.cells[2]) }}</template>
              <!-- 티엠(화면11=DB11): 이름+뱃지 -->
              <template v-else-if="ci === 11 && row.cells[11]">
                <span class="sv-tm-first">{{ row.cells[11].split(/\s+/).filter(Boolean).at(-1).split('|')[0] }}</span>
                <span v-if="row.cells[11].split(/\s+/).filter(Boolean).length > 1" class="sv-tm-more">+{{ row.cells[11].split(/\s+/).filter(Boolean).length - 1 }}</span>
              </template>
              <template v-else>{{ row.cells[di(ci)] }}</template>
            </td>
            <td class="sv-td sv-td-del" @click.stop="confirmDeleteRow(row._origIdx)">✕</td>
          </tr>
          <tr v-if="!rows.length">
            <td :colspan="HEADERS.length + 1" class="sv-empty-row">유입 동기화 후 데이터가 나타나요!</td>
          </tr>
          <tr v-else-if="!filteredRows.length">
            <td :colspan="HEADERS.length + 1" class="sv-empty-row">필터 조건에 맞는 행이 없어.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- hover 툴팁 -->
    <Teleport to="body">
      <div v-if="hoverTooltip" class="sv-hover-tooltip" :style="{ left: hoverTooltip.x + 'px', top: hoverTooltip.y + 'px' }">
        <template v-if="hoverTooltip.mode === 'pre'">
          <div class="sv-hover-tooltip-pre">{{ hoverTooltip.text }}</div>
        </template>
        <template v-else>
          <div v-for="(token, i) in hoverTooltip.text.split(/\s+/)" :key="i" class="sv-hover-tooltip-item">{{ token.split('|')[0] }}</div>
        </template>
      </div>
    </Teleport>

    <!-- TM 팝업 -->
    <Teleport to="body">
      <template v-if="tmPopup">
        <div class="sv-tm-backdrop" @click="closeTmPopup"></div>
        <div class="sv-tm-popup" :style="tmPopupStyle">
          <div class="sv-tm-input-row">
            <input ref="tmInputRef" class="sv-tm-input" :class="{ 'sv-tm-input-error': tmInputError }"
              v-model="tmInput" placeholder="이름 입력 후 엔터..."
              @keydown="onTmKeydown" @click.stop />
            <button class="sv-tm-enter-btn" @mousedown.prevent="submitTmInput">입력</button>
          </div>
          <div class="sv-tm-divider"></div>
          <div class="sv-tm-list">
            <template v-if="tmPopupRowIdx >= 0 && rows[tmPopupRowIdx]">
              <div v-for="entry in [...parseTmEntries(rows[tmPopupRowIdx].cells[11])].reverse()" :key="entry.idx" class="sv-tm-entry">
                <span class="sv-tm-seq">{{ entry.idx }}회</span>
                <span class="sv-tm-name">{{ entry.name }}</span>
                <span class="sv-tm-date">{{ entry.date.replace('@', ' ') }}</span>
                <button class="sv-tm-del" @mousedown.prevent="deleteTmEntryByIdx(entry.idx - 1)">✕</button>
              </div>
              <div v-if="!rows[tmPopupRowIdx].cells[11]" class="sv-tm-empty">아직 티엠 기록이 없어. 이름을 입력해봐!</div>
            </template>
          </div>
        </div>
      </template>
    </Teleport>

    <!-- 인도자 팝업 -->
    <Teleport to="body">
      <template v-if="indojaPopup">
        <div class="sv-tm-backdrop" @click="closeIndojaPopup"></div>
        <div class="sv-tm-popup" :style="tmPopupStyle">
          <div class="sv-tm-input-row">
            <input ref="indojaInputRef" class="sv-tm-input" :class="{ 'sv-tm-input-error': indojaInputError }"
              v-model="indojaInput" placeholder="이름 입력 후 엔터..."
              @keydown="onIndojaKeydown" @click.stop />
            <button class="sv-tm-enter-btn" @mousedown.prevent="submitIndojaInput">입력</button>
          </div>
          <div class="sv-tm-divider"></div>
          <div class="sv-tm-list">
            <template v-if="indojaPopupRowIdx >= 0 && rows[indojaPopupRowIdx]">
              <div v-if="rows[indojaPopupRowIdx].cells[5]" class="sv-tm-entry">
                <span class="sv-tm-name">{{ rows[indojaPopupRowIdx].cells[5] }}</span>
                <button class="sv-tm-del" @mousedown.prevent="clearIndoja">✕</button>
              </div>
              <div v-else class="sv-tm-empty">인도자를 입력해봐!</div>
            </template>
          </div>
        </div>
      </template>
    </Teleport>

    <!-- 합자찾 확인 팝업 -->
    <Teleport to="body">
      <template v-if="manpikConfirm">
        <div class="sv-tm-backdrop" @click="cancelManpik"></div>
        <div class="sv-manpik-popup">
          <div class="sv-manpik-msg">합재양 작성으로 넘어가시겠습니까?</div>
          <div class="sv-manpik-btns">
            <button class="sv-manpik-btn-yes" @mousedown.prevent="confirmManpik">넘어가기</button>
            <button class="sv-manpik-btn-no" @mousedown.prevent="cancelManpik">취소</button>
          </div>
        </div>
      </template>
    </Teleport>

    <!-- 헤더 필터 팝업 -->
    <Teleport to="body">
      <template v-if="filterPopup">
        <div class="sv-fp-backdrop" @click="closeFilterPopup"></div>
        <div class="sv-fp-panel" :style="filterPopupStyle">
          <div class="sv-fp-top">
            <input v-model="filterSearch" class="sv-fp-search" placeholder="🔍 검색..." @click.stop />
          </div>
          <div class="sv-fp-selectall" @mousedown.prevent="toggleSelectAll">
            <input type="checkbox" :checked="popupAllSelected" @click.prevent />
            <span>전체 선택</span>
          </div>
          <div class="sv-fp-divider"></div>
          <div class="sv-fp-list">
            <div v-for="val in popupColValues" :key="val" class="sv-fp-item" @mousedown.prevent="togglePopupVal(val)">
              <input type="checkbox" :checked="isPopupValChecked(val)" @click.prevent />
              <span class="sv-fp-lbl">{{ val === '' ? '(빈값)' : val }}</span>
            </div>
            <div v-if="!popupColValues.length" class="sv-fp-empty">일치하는 값 없음</div>
          </div>
          <div class="sv-fp-footer">
            <button class="sv-fp-ok" @mousedown.prevent="closeFilterPopup">확인</button>
            <button class="sv-fp-clr" @mousedown.prevent="() => { clearColFilter(filterPopup.ci); closeFilterPopup(); }">초기화</button>
          </div>
        </div>
      </template>
    </Teleport>

    <!-- 플로팅 편집기 -->
    <Teleport to="body">
      <template v-if="editCell">
        <template v-if="isDropdown">
          <div class="sv-dd-backdrop" @click="cancelEdit"></div>
          <div class="sv-dd-panel" :style="ddPanelStyle">
            <div class="sv-dd-clear" @mousedown.prevent="selectOption('')">— 선택 안 함</div>
            <div v-for="opt in dropdownOpts" :key="opt.value" class="sv-dd-item"
              :style="{ background: opt.bg, color: opt.fg }" @mousedown.prevent="selectOption(opt.value)">
              {{ opt.emoji }} {{ opt.value }}
            </div>
          </div>
        </template>
        <textarea v-else-if="isTextarea" ref="textareaRef" class="sv-float-textarea" :style="floatTextareaStyle"
          v-model="editValue" @blur="commitEdit" @keydown="onTextareaKeydown" @click.stop></textarea>
        <input v-else-if="isDatetime" type="datetime-local" class="sv-float-datetime" :style="floatStyle"
          v-model="editValue" @blur="commitEdit" @keydown="onInputKeydown" @click.stop />
        <input v-else class="sv-float-input" :style="floatStyle"
          v-model="editValue" @blur="commitEdit" @keydown="onInputKeydown" @click.stop />
      </template>
    </Teleport>
  </div>
</template>

<style scoped>
.sv-screen {
  display: flex; flex-direction: column;
  height: calc(100vh - 50px);
  background: var(--bg-color, #fff9e6);
  font-family: "Jua", sans-serif; font-size: 13px;
  color: var(--text-color, #5d4037); overflow: hidden;
}
.sv-topbar {
  display: flex; align-items: center; gap: 8px; padding: 10px 14px;
  background: var(--card-bg, #fff);
  box-shadow: var(--shadow, 0 4px 10px rgba(141,110,99,.15));
  flex-shrink: 0; z-index: 20;
}
.sv-title { flex: 1; font-size: 16px; font-weight: bold; color: var(--btn-color, #6d4c41); }
.sv-saving { font-size: 11px; color: var(--btn-color, #6d4c41); opacity: .7; }
.sv-loading { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: var(--btn-color, #6d4c41); }
.sv-spinner { width: 28px; height: 28px; border: 3px solid rgba(109,76,65,.15); border-top-color: var(--btn-color,#6d4c41); border-radius: 50%; animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.sv-filter-count { font-size: 11px; color: #a08070; white-space: nowrap; }
.sv-filter-clear { font-size: 11px; padding: 3px 8px; border: 1px solid #d7cdc6; border-radius: 8px; background: none; color: #c62828; cursor: pointer; flex-shrink: 0; font-family: "Jua",sans-serif; }
.sv-filter-clear:hover { background: #fde8e8; }
.sv-sheet-tabs {
  display: flex; gap: 6px; padding: 8px 14px; overflow-x: auto;
  background: var(--card-bg, #fff); border-top: 1px solid #eee2d9; flex-shrink: 0;
}
.sv-sheet-tab {
  display: flex; align-items: center; gap: 5px; white-space: nowrap;
  font-size: 12px; padding: 6px 12px; border-radius: 16px; border: 1px solid #e5ddd6;
  background: #f7f3ee; color: #8d6e63; cursor: pointer; font-family: "Jua",sans-serif;
}
.sv-sheet-tab.on { background: var(--btn-color,#6d4c41); border-color: var(--btn-color,#6d4c41); color: #fff; }
.sv-sheet-tab-badge {
  font-size: 10px; font-weight: bold; padding: 1px 6px; border-radius: 10px;
  background: #E65100; color: #fff;
}
.sv-sheet-tab.on .sv-sheet-tab-badge { background: #fff; color: #E65100; }
.sv-th { cursor: pointer; }
.sv-th-fbtn { color: rgba(255,255,255,.45); font-size: 9px; padding-left: 2px; }
.sv-th:hover .sv-th-fbtn { color: #fff; }
.sv-th-fbtn-on { color: #FFD54F; }
.sv-th-filtered { border-bottom: 2px solid #FFD54F !important; }
.sv-wrap { flex: 1; overflow: auto; -webkit-overflow-scrolling: touch; }
.sv-table { border-collapse: separate; border-spacing: 0; font-size: 12px; font-family: "Noto Sans KR",Arial,sans-serif; background: var(--card-bg,#fff); table-layout: fixed; min-width: 100%; }
thead { position: sticky; top: 0; z-index: 10; }
.sv-th { background: #f0ebe4; border-top: 1px solid #e5ddd6; border-right: 1px solid #e5ddd6; border-bottom: 1px solid #e5ddd6; border-left: none; padding: 6px 8px; font-weight: bold; font-size: 11px; color: var(--text-color,#5d4037); white-space: nowrap; text-align: center; min-width: 60px; user-select: none; font-family: "Jua",sans-serif; }
.sv-th:first-child { border-left: 1px solid #e5ddd6; }
.sv-th-del { width: 24px; min-width: 24px; }
.sv-th.grp1 { background: #1a237e; color: #fff; }
.sv-th.grp2 { background: #1b5e20; color: #fff; }
.sv-th.grp3 { background: #4a148c; color: #fff; }
.sv-row:hover .sv-td { background: #fdf6ee; }
.sv-row:hover .sv-td-del { background: #fde8e8; }
.sv-td { border-top: none; border-right: 1px solid #ede5dc; border-bottom: 1px solid #ede5dc; border-left: none; padding: 4px 6px; height: 26px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px; cursor: cell; vertical-align: middle; text-align: center; background: var(--row-bg, var(--card-bg,#fff)); }
.sv-td:first-child { border-left: 1px solid #ede5dc; }
.sv-td-del { border-top: none; border-right: 1px solid #ede5dc; border-bottom: 1px solid #ede5dc; border-left: none; text-align: center; padding: 0; width: 24px; min-width: 24px; cursor: pointer; font-size: 10px; color: #c62828; opacity: .25; vertical-align: middle; background: var(--row-bg, var(--card-bg,#fff)); }
.sv-row:hover .sv-td-del { opacity: 1; }
.sv-empty-row { text-align: center; padding: 36px; color: #bca99c; font-size: 13px; font-family: "Jua",sans-serif; border: 1px solid #ede5dc; }
:global(.sv-cell-active) { outline: 2px solid var(--btn-color,#6d4c41) !important; outline-offset: -2px; background: #fffdf8 !important; }
</style>

<style>
.sv-badge { display: inline-block; padding: 1px 7px; border-radius: 10px; font-size: 11px; font-weight: bold; white-space: nowrap; line-height: 1.6; }
.sv-float-textarea { resize: none; overflow: hidden; padding: 4px 6px; box-sizing: border-box; line-height: 1.5; }
.sv-td-ro { cursor: not-allowed !important; }
.sv-td-center { text-align: center; }
.sv-td-narrow { max-width: 34px; min-width: 34px; width: 34px; }
.sv-td-founddate { max-width: 80px; min-width: 80px; width: 80px; }
.sv-td-addr { max-width: 58px; min-width: 48px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sv-col-name   { min-width: 72px;  width: 72px;  }
.sv-col-beonho { min-width: 110px; width: 110px; }
.sv-tm-first { font-size: 12px; }
.sv-tm-more { font-size: 10px; color: #a0896e; margin-left: 2px; }
.sv-hover-tooltip { position: fixed; z-index: 9999; background: #4e342e; color: #fff; border-radius: 10px; padding: 8px 12px; font-size: 12px; pointer-events: none; box-shadow: 0 4px 14px rgba(0,0,0,.22); max-width: 260px; }
.sv-hover-tooltip-item { white-space: nowrap; line-height: 1.8; }
.sv-hover-tooltip-pre { white-space: pre-line; line-height: 1.6; word-break: break-word; }
.sv-manpik-popup { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #fff; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,.25); z-index: 10002; padding: 24px 20px 16px; width: 280px; text-align: center; }
.sv-manpik-msg { font-size: 15px; font-weight: bold; color: #5d4037; font-family: "Jua",sans-serif; margin-bottom: 20px; line-height: 1.5; }
.sv-manpik-btns { display: flex; gap: 10px; }
.sv-manpik-btn-yes { flex: 1; font-family: "Jua",sans-serif; font-size: 14px; padding: 10px; background: #6d4c41; color: #fff; border: none; border-radius: 10px; cursor: pointer; }
.sv-manpik-btn-yes:active { filter: brightness(.9); }
.sv-manpik-btn-no { flex: 1; font-family: "Jua",sans-serif; font-size: 14px; padding: 10px; background: #f0ebe4; color: #5d4037; border: none; border-radius: 10px; cursor: pointer; }
.sv-manpik-btn-no:active { filter: brightness(.95); }
.sv-dd-backdrop { position: fixed; inset: 0; z-index: 10000; }
.sv-dd-panel { position: fixed; background: #fff; border: 1px solid #e5ddd6; border-radius: 12px; box-shadow: 0 6px 24px rgba(109,76,65,.18); overflow-y: auto; max-height: 320px; padding: 6px; z-index: 10001; display: flex; flex-direction: column; gap: 3px; }
.sv-dd-clear { padding: 5px 12px; border-radius: 8px; font-size: 12px; cursor: pointer; color: #a0896e; background: #f7f1eb; }
.sv-dd-clear:hover { background: #ede5dc; }
.sv-dd-item { padding: 5px 12px; border-radius: 8px; font-size: 12px; font-weight: bold; cursor: pointer; white-space: nowrap; }
.sv-dd-item:hover { filter: brightness(1.15); }
.sv-float-input, .sv-float-datetime, .sv-float-textarea { position: fixed; z-index: 9999; border: 2px solid var(--btn-color,#6d4c41); outline: none; padding: 2px 6px; font-size: 12px; font-family: "Noto Sans KR",Arial,sans-serif; color: #5d4037; background: #fffdf8; box-shadow: 0 3px 10px rgba(109,76,65,.18); box-sizing: border-box; }
.sv-tm-backdrop { position: fixed; inset: 0; z-index: 10001; background: rgba(0,0,0,.3); }
.sv-tm-popup { position: fixed; left: 0; right: 0; background: #fff; border-radius: 20px 20px 0 0; box-shadow: 0 -4px 20px rgba(0,0,0,.2); z-index: 10002; display: flex; flex-direction: column; max-height: 55vh; overflow: hidden; }
.sv-tm-input-row { display: flex; align-items: center; padding: 12px 16px; gap: 8px; flex-shrink: 0; }
.sv-tm-input { flex: 1; font-family: "Noto Sans KR",Arial,sans-serif; font-size: 16px; padding: 10px 14px; border: 2px solid #d7cdc6; border-radius: 12px; outline: none; color: #5d4037; background: #faf7f4; transition: border-color .15s; }
.sv-tm-input:focus { border-color: #6d4c41; }
.sv-tm-input-error { border-color: #c62828 !important; background: #fde8e8 !important; animation: sv-shake .35s ease; }
@keyframes sv-shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-6px)} 60%{transform:translateX(6px)} 80%{transform:translateX(-3px)} }
.sv-tm-enter-btn { font-family: "Jua",sans-serif; font-size: 14px; padding: 10px 16px; background: #6d4c41; color: #fff; border: none; border-radius: 12px; cursor: pointer; white-space: nowrap; flex-shrink: 0; }
.sv-tm-enter-btn:active { filter: brightness(.9); }
.sv-tm-divider { height: 1px; background: #ede5dc; flex-shrink: 0; }
.sv-tm-list { overflow-y: auto; flex: 1; padding: 6px 0; -webkit-overflow-scrolling: touch; }
.sv-tm-entry { display: flex; align-items: center; gap: 8px; padding: 10px 16px; border-bottom: 1px solid #f0ebe4; }
.sv-tm-seq { font-size: 12px; color: #a08070; min-width: 28px; font-family: "Noto Sans KR",sans-serif; }
.sv-tm-name { flex: 1; font-size: 15px; font-weight: bold; color: #5d4037; font-family: "Noto Sans KR",sans-serif; }
.sv-tm-date { font-size: 12px; color: #a08070; font-family: "Noto Sans KR",sans-serif; }
.sv-tm-del { font-size: 12px; padding: 4px 8px; border: 1px solid #e5ddd6; border-radius: 8px; background: #fde8e8; color: #c62828; cursor: pointer; flex-shrink: 0; }
.sv-tm-del:active { background: #f9a9a9; }
.sv-tm-empty { padding: 24px 16px; text-align: center; color: #bca99c; font-family: "Jua",sans-serif; font-size: 13px; }
.sv-fp-backdrop { position: fixed; inset: 0; z-index: 10001; }
.sv-fp-panel { position: fixed; background: #fff; border: 1px solid #e5ddd6; border-radius: 12px; box-shadow: 0 6px 24px rgba(109,76,65,.22); z-index: 10002; width: 220px; display: flex; flex-direction: column; overflow: hidden; max-height: 65vh; font-family: "Noto Sans KR",Arial,sans-serif; }
.sv-fp-top { padding: 8px 10px 4px; }
.sv-fp-search { width: 100%; box-sizing: border-box; font-family: "Noto Sans KR",Arial,sans-serif; font-size: 12px; padding: 5px 8px; border: 1px solid #d7cdc6 !important; border-radius: 8px; outline: none; background: #fff !important; }
.sv-fp-search:focus { border-color: #a0897a; }
.sv-fp-selectall { display: flex; align-items: center; gap: 6px; padding: 6px 12px; cursor: pointer; font-size: 12px; font-weight: bold; color: #5d4037; user-select: none; }
.sv-fp-selectall:hover { background: #f7f1eb; }
.sv-fp-selectall input[type="checkbox"] { pointer-events: none; width: auto; flex-shrink: 0; }
.sv-fp-divider { height: 1px; background: #ede5dc; flex-shrink: 0; }
.sv-fp-list { overflow-y: auto; flex: 1; padding: 4px 0; -webkit-overflow-scrolling: touch; }
.sv-fp-item { display: flex; align-items: center; gap: 6px; padding: 5px 12px; cursor: pointer; font-size: 12px; color: #5d4037; user-select: none; }
.sv-fp-item:hover { background: #f7f1eb; }
.sv-fp-item input[type="checkbox"] { pointer-events: none; width: auto; flex-shrink: 0; }
.sv-fp-lbl { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sv-fp-empty { padding: 12px; text-align: center; font-size: 12px; color: #bca99c; }
.sv-fp-footer { display: flex; gap: 6px; padding: 8px 10px; border-top: 1px solid #ede5dc; flex-shrink: 0; }
.sv-fp-ok { flex: 1; font-family: "Jua",sans-serif; font-size: 13px; padding: 7px; background: #6d4c41; color: #fff; border: none; border-radius: 8px; cursor: pointer; }
.sv-fp-ok:hover { background: #5d3c31; }
.sv-fp-clr { font-family: "Jua",sans-serif; font-size: 12px; padding: 7px 10px; border: 1px solid #d7cdc6; border-radius: 8px; background: none; color: #a08070; cursor: pointer; }
.sv-fp-clr:hover { background: #f7f1eb; }
</style>
