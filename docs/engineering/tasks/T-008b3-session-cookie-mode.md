# T-008b3 - Header-only session mode (logout fix) and UI environment setup for staging/prod
Baseline main@f6f19ce (PR #5), branch `fix/session-cookie-mode`. Change type: bug fix + docs. Rigor: Standard.
Executor: Claude Code. Spec (read-only): imageopz-server docs/engineering/deploy/DEPLOY-PLAN.md section 7,
docs/engineering/contracts/uploads-api.md.
Authorization: edit imageopz-ui; frozen install, lint, test, build after the safety gate. No network beyond the pnpm
registry, no Vercel CLI/dashboard, no push. Local commit, no co-author trailer.

## Contract
0. Safety gate; STATE.md records T-006d as PR #5 (f6f19ce). 1. One credentials helper for every API request, failing
test on the old `logoutSession`, source guard test. 2. Header-only mode end to end at client level. 3. Config module
with a production error state for a missing API base URL. 4. docs/engineering/deploy/UI-ENVIRONMENTS.md and
.env.example. 5. Verify; bundle delta <= ~1 kB gzip.

## Handoff (2026-10-17)

### 0. Safety gate - passed
- HEAD = f6f19ce on `main`, tree clean; branch `fix/session-cookie-mode` created from it.
- vite.config.ts, vitest.config.ts and package.json scripts read: unchanged from T-006d (no loaders, no eval/fetch).
- check-repo-safety.sh exit 0 before the first pnpm command and after the change.
- STATE.md: T-006d recorded as PR #5, f6f19ce.

### 1. Single credentials policy
`lib/imageopzApi.ts`:
- `apiCredentials()` returns `"omit"` when `VITE_IMAGEOPZ_SEND_COOKIES` is `"false"` (trimmed), otherwise `"include"`.
- `apiFetch(path, init)` is the only `fetch` call to the API; `init` is typed `Omit<RequestInit, "credentials">`, so
  callers cannot pass their own; it prefixes `getApiBaseUrl()` and sets `credentials: apiCredentials()`.
- `shouldSendCookies()` is removed.

API calls migrated to the helper:
| Call | Function | Before |
|---|---|---|
| GET /api/v1/status/{id} | `getJobStatus` | flag |
| POST /api/v1/session/reconcile | `reconcileSession` | flag |
| POST /api/v1/checkout/lemonsqueezy | `createLemonSqueezyCheckout` | flag |
| POST /api/v1/session/restore | `restoreProSession` | flag |
| GET /api/v1/session/me | `getSessionMe` | flag |
| POST /api/v1/session/logout | `logoutSession` | **always `include`, no X-Session-Id** (the bug) |
| POST /api/v1/uploads/presign | `presignUploads` (lib/uploads.ts `postJson`) | flag |
| POST /api/v1/uploads/complete | `completeUploads` (lib/uploads.ts `postJson`) | flag |
Not an API call: the presigned R2 PUT (`putToR2`, XMLHttpRequest, `withCredentials = false`), unchanged. No other
fetch/XHR exists in lib/, src/, components/ or context/.

Semantics change: before, any value other than `"true"` (e.g. `"0"`, `"no"`) disabled cookies; now only `"false"` does,
as the task specifies. Unset still means cookies on.

### 2. Header-only mode end to end
`lib/session.ts` (no React):
- `getOrCreateSessionId()` / `storeSessionId()` / `newSessionId()`: localStorage `imageopz_session_id`, tolerant of
  blocked storage. App.tsx and AuthCallback.tsx now use it instead of their two copies of the create-or-read logic;
  checkout's returned `session_id` goes through `storeSessionId`.
- `logoutAndRotateSession(sessionId)`: calls `logoutSession({ sessionId })` (now sends X-Session-Id), stores the
  server's new `session_id`. If the request fails: header-only mode stores a fresh local id anyway (the session is
  nothing but the id we send, so dropping it is a logout); cookie mode rethrows and keeps the id (the cookie would still
  name the old session) - the old behaviour, App shows "Logout failed".

What depended on the cookie and how it works now (cookies off):
| Behaviour | With cookie | Header-only |
|---|---|---|
| Session identity | `imageopz_sid` cookie or header | X-Session-Id from localStorage on every call; already passed by all callers (status, me, reconcile, restore, checkout, presign, complete), now also logout |
| Logout | server cleared/rotated the cookie | server gets the old id in the header and returns a new id; UI stores it; on failure the UI rotates locally |
| Checkout / restore binding Pro to the session | cookie or header | header (server tests `test_header_only_session.py`, DEPLOY-PLAN section 7) |
| New visitor | server set a cookie on first call | UI creates the id before the first call (unchanged) |

### 3. Config validation
- `lib/config.ts`: `readConfig()` reads all eight VITE_ variables (direct `import.meta.env.VITE_*` access, so Vite
  still inlines them), trims, strips the API URL's trailing slashes. Used by imageopzApi, supabaseClient, AuthContext
  (redirect URL) and main.tsx; no other code reads `import.meta.env.VITE_*`.
- `getConfigError()`: in production builds (`import.meta.env.PROD`) a missing `VITE_IMAGEOPZ_API_BASE_URL` returns a
  message; main.tsx then renders "ImageOpz is not configured" with that message instead of the app (and skips PostHog).
- PostHog is initialised only when `VITE_PUBLIC_POSTHOG_PROJECT_TOKEN` is set (staging can run with analytics off;
  before, `posthog.init(undefined)` was called).

### 4. Environment docs
docs/engineering/deploy/UI-ENVIRONMENTS.md. Summary:
| Variable | Production | staging (branch `staging`, staging.imageopz.aindrajaya.my.id) | Preview |
|---|---|---|---|
| `VITE_IMAGEOPZ_API_BASE_URL` | prod api run.app URL (T-008c) | staging api run.app URL | staging api URL |
| `VITE_IMAGEOPZ_SEND_COOKIES` | `false` | `false` | `false` |
| `VITE_IMAGEOPZ_USE_VITE_PROXY` | unset | unset | unset |
| `VITE_SUPABASE_URL` / `_ANON_KEY` | prod project | staging project | staging project |
| `VITE_SUPABASE_REDIRECT_URL` | prod origin /auth/callback | staging origin /auth/callback | unset |
| `VITE_PUBLIC_POSTHOG_*` | prod project | unset (off) or separate project | unset |
Plus the "every VITE_ value ships to the browser" warning, owner steps (staging branch, Vercel domain assignment,
Cloudflare CNAME DNS only, env vars, Supabase redirect URLs, server CORS), and the note that Preview URLs are not in
API/R2 CORS, so uploads fail on previews by design. `.env.example` updated (placeholders only).

### Tests - failing first
Written before the implementation; first run on the f6f19ce code:
```
 FAIL  lib/imageopzApi.test.ts > credentials policy > logoutSession omits cookies when VITE_IMAGEOPZ_SEND_COOKIES=false
AssertionError: expected 'include' to be 'omit' // Object.is equality
 FAIL  lib/imageopzApi.test.ts > credentials policy > session/logout omits cookies and sends X-Session-Id in header-only mode
AssertionError: expected 'include' to be 'omit' // Object.is equality
 FAIL  lib/imageopzApi.test.ts > credentials policy > {status,session/me,session/reconcile,session/restore,checkout,uploads/presign,uploads/complete} includes cookies when the flag is unset or not "false"
AssertionError: expected [ 'include', 'include', 'omit' ] to deeply equal [ 'include', 'include', 'include' ]
 FAIL  lib/imageopzApi.test.ts > no API call sets credentials directly > only lib/imageopzApi.ts sets credentials or calls fetch
AssertionError: expected [ 'lib/imageopzApi.ts', …(1) ] to deeply equal [ 'lib/imageopzApi.ts' ]
 FAIL  lib/config.test.ts   Error: Cannot find module './config'
 FAIL  lib/session.test.ts  Error: Cannot find module './session'
 Test Files  3 failed | 2 passed (5)
      Tests  10 failed | 48 passed (58)
```
After the implementation: 5 files, 70 passed (39 existing + 31 new).
| New test file | Covers |
|---|---|
| lib/imageopzApi.test.ts | logout omits cookies with the flag off; all 8 API calls: `omit` + X-Session-Id with the flag off, `include` when unset/`"true"`/other; source guard: only lib/imageopzApi.ts has `credentials:` or `fetch(` (once each); XMLHttpRequest only in uploads.ts with `withCredentials = false` |
| lib/session.test.ts | id created once and reused; blocked storage; logout sends old id as header without cookies and stores the server id; header-only logout failure still rotates the id; cookie-mode failure throws and keeps it |
| lib/config.test.ts | all VITE_ variables read; cookie flag parsing; blank = unset; production error for missing API URL; no error with URL or outside production |
App.tsx/main.tsx wiring has no DOM test (no DOM test setup); covered by lint/build, manual check on staging.

### 5. Verification (Node 24.22.0, pnpm 10.33.0, macOS)
| Step | Result |
|---|---|
| check-repo-safety.sh | exit 0 (before and after) |
| pnpm install --frozen-lockfile | pass, lockfile unchanged, no new dependencies |
| pnpm run lint (tsc --noEmit) | pass, no output |
| pnpm run test | 5 files, 70 tests passed |
| pnpm run build | pass (chunk-size warning as before); built JS contains `"omit"` |
| gitleaks 8.30.1 `dir --redact .` | no leaks found |

Bundle (baseline built from the untouched f6f19ce tree on this branch before any edit):
| Asset | Before | After | Delta |
|---|---|---|---|
| JS | 1,227.30 kB (376.94 kB gzip) | 1,228.21 kB (377.28 kB gzip) | +0.91 kB (+0.34 kB gzip) |
| CSS | 69.06 kB (11.76 kB gzip) | 69.14 kB (11.78 kB gzip) | +0.08 kB (+0.02 kB gzip) |
Total +0.36 kB gzip, inside the ~1 kB budget.

### Changed files
.env.example, components/auth/AuthCallback.tsx, context/AuthContext.tsx, lib/config.ts (new), lib/config.test.ts (new),
lib/imageopzApi.ts, lib/imageopzApi.test.ts (new), lib/session.ts (new), lib/session.test.ts (new),
lib/supabaseClient.ts, lib/uploads.ts, src/App.tsx, src/main.tsx, docs/engineering/deploy/UI-ENVIRONMENTS.md (new),
docs/engineering/STATE.md, this file.

### Follow-ups (not in scope)
- Missing `VITE_SUPABASE_URL` still throws in supabase-js `createClient` at module load (blank page). Either add it to
  `getConfigError` and load App lazily, or create the client only when configured.
- Server: set `CORS_ALLOW_CREDENTIALS=false` per environment once this UI is deployed there (DEPLOY-PLAN section 7).
- The T-008c run.app URLs are written as patterns (`imageopz-api-<env>-<PROJECT_NUMBER>.asia-northeast1.run.app`);
  the owner fills the real values in Vercel.
- Magic links do not complete on Preview deployments (redirect URL not allowed), same as uploads (CORS). Expected.
- Carried over: shadcn runtime dependency, vite listed twice, tsx unused, 1.2 MB bundle, App.tsx size, no ESLint.

### Owner commands
```
git push -u origin fix/session-cookie-mode
gh pr create --base main --head fix/session-cookie-mode --title "fix: header-only session mode (logout), config validation, UI environment docs (T-008b3)" --body-file docs/engineering/tasks/T-008b3-session-cookie-mode.md
gh pr checks --watch && gh pr merge --squash --delete-branch
```
