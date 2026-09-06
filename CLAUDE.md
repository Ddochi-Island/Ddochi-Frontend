# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Vue 3 + Vite SPA rebuilding the legacy `legacy2/public/index.html` (a single ~14k-line file) as a
structured component tree, plus a small set of Cloudflare Pages Functions that make the SPA,
`/api/*`, `/dashboard/*`, and `/storage/*` all resolve on one hostname (`page.ddochi.cloud`) so
the browser never talks cross-origin. Ported from `Ddochi/frontend` (see `Ddochi-Backend` repo for
the Django rewrite of the API side).

## Commands

```bash
npm install
npm run dev              # http://localhost:5173 — /api → :8080, /dashboard → :8081 (vite proxy)
npm run build             # vite build → dist/
npm run preview           # serve dist/ with the same proxy setup as dev
npm run deploy             # build + `wrangler pages deploy dist`
npm run deploy -- --branch preview
```

No test suite, no lint config. `VITE_API_TARGET` overrides the dev proxy target if you're pointing
at a non-default backend port. Verify changes by running `npm run build` (catches Vue/import
errors) and exercising the screen in `npm run dev`.

### First-time Cloudflare Pages setup

```bash
npx wrangler login
npx wrangler pages project create ddochiseom-frontend --production-branch=main
# JWT_SECRET must match services/main's — sync it once and on every rotation:
npx wrangler pages secret put JWT_SECRET --project-name=ddochiseom-frontend
```

Custom domains (`page.ddochi.cloud`) are added from the CF dashboard, not the CLI:
**Workers & Pages → ddochiseom-frontend → Custom domains**.

## Architecture

**Single-domain topology via three separate Pages Functions, each with its own auth model** —
don't assume they work the same way just because they're all catch-all proxies:

- `functions/api/[[path]].ts` → `services/main` (Django backend). **Transparent proxy** — auth is
  main's job via `Authorization: Bearer` JWT; this Function only does header allowlisting, a 50MB
  body cap, and a 28s timeout. It does not itself check tokens.
- `functions/dashboard/[[path]].ts` → `tel_router`'s dashboard SPA. Also a transparent proxy;
  tel_router's own SPA handles its JWT auth client-side.
- `functions/storage/[[path]].ts` → OCI Object Storage. **This one does real work**: verifies the
  JWT itself (`functions/lib/jwt.ts`, HS256, shared secret with main), then SigV4-signs
  (`functions/lib/sigv4.ts`) and fetches from OCI, with a Cloudflare Cache API layer keyed per-sabun
  in front. Missing/invalid token → 401 (XHR) or 302 to `/login` (browser nav); expired token always
  redirects to `/login?next=<original>` so the user returns to the file after re-auth.

All three share `ORIGIN_API_URL` (the Cloudflare Tunnel hostname for main/tel_router) from
`wrangler.toml`'s `[vars]`. Secrets (`JWT_SECRET`, OCI keys) are never in `wrangler.toml` — they're
set via `wrangler pages secret put` and read only inside the Functions.

**Token storage picks localStorage vs. cookie based on runtime context**
(`src/composables/useApi.js`): inside a Telegram WebApp (`window.Telegram.WebApp.initData` present)
it uses `localStorage`, since cookies are unreliable in that embedded container; in a normal browser
it uses a `SameSite=Lax` cookie, to survive Safari ITP / private-mode localStorage resets. Both are
read on lookup for safe migration between the two contexts. `useApi()`'s `callApi` also handles the
401 → refresh-once → retry → logout-on-failure flow transparently, so screen components never see
raw 401s. Both the new main response shape (`{ accessToken, refreshToken, user }`) and the legacy
one (`{ success, name, team, area, role }`) are absorbed by `useAuthStore.setUser()` — don't assume
one shape when reading login/refresh responses.

**Routing** (`src/router/index.js`) uses hash history with a `meta.requiresAuth` guard, plus a
bounce-through-`LoadingScreen` pattern: on the very first navigation, if there's a saved sabun but
the auth store hasn't hydrated yet, the guard redirects to `loading` and stashes the real target in
`sessionStorage.ddochi_initial_target` — `LoadingScreen` does the actual silent re-login and then
restores that target. Don't "simplify" this by redirecting straight to the target route; a direct
redirect skips the silent-login step and dumps the user on `/login` on every hard refresh.

**Role checks mirror the backend, not a local enum.** `src/composables/useRoles.js` does substring
matching against Korean job-title strings (`지역장`, `팀장`, etc.) and is an explicit mirror of
`services/main/src/auth/roles.js` — a region role auto-includes team role. If backend role strings
change, this file needs a matching update.

**`src/constants/index.js` is the single source for cross-component constants** (magic numbers,
label maps, enums shared with the backend). Before adding a new data array or magic number in a
screen component, check whether it belongs in an existing domain section there first — several
past duplicates (`KR_TIME_DIFF_MS`, `FAITH_LABEL_MAP`, etc.) got consolidated into it specifically
because the same constant existed in two components. Anything keyed to a backend enum (e.g.
`TM_RESULT_BIHAP`) needs a matching change on the main side if it changes. The file's own header
comment carries a domain index — check it before adding a 6th section rather than a new file
(the file was deliberately kept as one ~130-line module instead of splitting into
`enums.js`/`timings.js`; only split once it clears ~150 lines).

**Screen components repeat a `load()`/`getList()` + `useApi().callApi` pattern.** Most files under
`src/components/screens/` fetch their own data on mount via a local `load()` (or `getList()`)
function that calls `callApi`/`callApiPromise` directly rather than going through a store — Pinia
stores (`src/stores/*.js`) exist only for state that's genuinely shared across screens (auth, board,
admin config, etc.), not as a blanket data layer. Don't route a screen-local fetch through a new
store unless another screen actually needs that state too.

**`README.md` describes an earlier version of this app** (`src/screens/`, `src/api/client.ts` as an
axios singleton, TypeScript, a 17-route table) that no longer matches the current tree
(`src/components/screens/`, `src/composables/useApi.js` as a plain-fetch adapter, JavaScript, ~28
routes in `src/router/index.js`). Trust the source over the README for anything structural; the
README's deploy/Cloudflare instructions and the `constants/index.js` consolidation work-log at its
end are still accurate.
