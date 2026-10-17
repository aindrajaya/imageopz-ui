# T-008c3 - UI: fresh download links, env docs DNS fix, remaining go-live UI follow-ups

Project: imageopz-ui. Baseline: `main` @ `3434424` (T-008b3, PR #6). Branch: `fix/download-links`.
Change type: bug fix + docs. Rigor: Standard. Executor: Claude Code.
Authorization: edit imageopz-ui; pnpm install --frozen-lockfile, lint, test, build (safety gate first). Server repo
read-only (../imageopz-server: contracts, DEPLOY-PLAN, registers UI2). No push; local commits, no co-author trailer.

## Contract
0. Safety gate as in T-006c.
1. UI2 (test-first): never open a stored or cached download URL. On every download click (result page and My
   Results), call /status for that job, then open the r2_url it returns; if none is returned (expired, cleaned, not
   owner), show a clear message. Remove persisted download URLs from local history (store job ids only).
2. UI-ENVIRONMENTS.md: DNS for aindrajaya.my.id is on Vercel (no Cloudflare CNAME step; Vercel creates the record
   when the domain is assigned); outputs are private presigned links (no public asset domain).
3. Follow-ups (test-first where logic): missing VITE_SUPABASE_URL shows the "not configured" screen, not a blank page;
   status polling gives up on a permanent 404 for a job; an expired-Pro or out-of-credits Pro user sees a renew prompt
   instead of a toast.
4. Verify lint, test, build, bundle delta (<= ~1.5 kB gzip), safety script, gitleaks.

## Handoff (2026-10-17)

### 0. Safety gate - passed
- `git merge-base --is-ancestor fd1032e HEAD` true (HEAD = 3434424).
- Read vite.config.ts, vitest.config.ts and package.json scripts (unchanged by this task); grep for
  `eval(|atob(|fetch(|child_process` in `*.config.*`: no matches.
- scripts/check-repo-safety.sh exit 0 before the first pnpm command and after all changes.

### 1. Fresh download links (UI2)
- New lib/downloads.ts (no React):
  - `freshDownloadUrl(jobId, fetchStatus)`: calls /status; `ok` + URL only for `done` with a non-empty `r2_url`;
    `unavailable` for no URL or 404 (expired, cleaned up, not this session's job); `error` for anything else.
  - `openFreshDownloads(jobIds, fetchStatus)`: opens one blank tab per job synchronously inside the click (popup
    blockers refuse `window.open` after an await), sets `opener = null`, then points each tab at its fresh URL or
    closes it; falls back to a direct `noopener,noreferrer` open if the blank tab was blocked.
  - `describeDownloadProblems(outcome, lang)`: en/id message for unavailable and retryable failures.
- src/App.tsx: `handleDownload(jobIds)` replaces `handleDownloadUrl(url)`; buttons are keyed on `status === "done"`
  (not on a polled `r2_url`); failures show a toast. `r2_url` dropped from the stall-guard signature (it changes on
  every poll since T-008c2). History saves every done job without a URL.
- components/results/MyResults.tsx: "Download" / "Download all" call /status per click (session id from
  lib/session.ts), inline alert on failure; the stored URL line under each file is gone.
- lib/resultsStore.ts: `StoredResultItem` has no `url`; `saveResultBatch` strips one if passed; `loadStoredResults`
  strips URLs left by older versions and rewrites storage.

### 2. UI-ENVIRONMENTS.md
- Owner step 3: DNS is on Vercel (`dig +short NS aindrajaya.my.id` -> `ns1.vercel-dns.com.`, `ns2.vercel-dns.com.`,
  checked 2026-10-17); Vercel creates the record when the domain is assigned; no Cloudflare CNAME step.
- New "Downloads" section: private outputs bucket, presigned 15-min links from /status for the owner only, no public
  asset domain or VITE_ variable, no CORS needed for downloads.
- Supabase URL and anon key marked required for production builds (also in .env.example).

### 3. Follow-ups
- Missing Supabase settings: `lib/supabaseClient.ts` exports `supabase: SupabaseClient | null` (null when unset)
  instead of calling `createClient` with an empty URL, which threw at module load (blank page). `getConfigError`
  lists every missing required variable in production builds (`VITE_IMAGEOPZ_API_BASE_URL`, `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY`), so src/main.tsx shows the config screen. AuthContext and AuthCallback handle the null
  client (dev without Supabase: signed out, sign-in throws the existing "not configured" error, callback goes home).
- Permanent 404: `fetchStatuses` counts consecutive 404s per job (`notFound` in `JobHealth`) and returns `gone` after
  `STATUS_GONE_AFTER` = 3 (about 6 s with the 2 s / 4 s backoff); any other outcome restarts the count. App.tsx
  records a gone job via `goneJobStatus` as a finished `failed` job with "This file is no longer available." /
  "File ini sudah tidak tersedia.", so polling stops and the batch completes. Other errors still retry (30 s cap).
- Renew prompt: `classifyStartError` returns `renew_pro` for a Pro user's 429 `QUOTA_EXCEEDED` (credits used up or Pro
  expired). App.tsx opens the paywall with `paywallReason = "renew"`: title "Renew Pro" / "Perpanjang Pro" and an
  explanation, same buy flow (checkout is open to Pro users); the reason resets when the dialog closes.

### Tests - red first
New and changed tests before the implementation (`pnpm run test`):
```
 FAIL  lib/downloads.test.ts  Error: Cannot find module './downloads'
 FAIL  lib/config.test.ts > getConfigError > reports missing Supabase settings in production builds
 FAIL  lib/resultsStore.test.ts > local results history > stores job ids and file details, never a download URL
 FAIL  lib/resultsStore.test.ts > local results history > drops URLs left by older versions and rewrites storage
 FAIL  lib/statusPolling.test.ts > permanent 404 ... > gives up on a job after N consecutive 404s
 FAIL  lib/statusPolling.test.ts > permanent 404 ... > restarts the 404 count after any other outcome
 FAIL  lib/statusPolling.test.ts > permanent 404 ... > goneJobStatus turns the job into a finished failure ...
 FAIL  lib/supabaseClient.test.ts > supabase client > loads without Supabase settings ...  Error: supabaseUrl is required.
 FAIL  lib/uploads.test.ts > classifyStartError > sends a Pro user whose credits ran out or whose Pro expired ...
 Test Files  6 failed | 2 passed (8)
      Tests  8 failed | 71 passed (79)
```
After the implementation: 8 files, 88 passed (70 before this task, 18 new).

| Test file | Covers |
|---|---|
| lib/downloads.test.ts (new) | fresh URL from /status per click; null/blank/not-done and 404 -> unavailable; network error -> error; tabs opened before /status answers, opener cleared, then pointed at fresh URLs; tab closed for a job without a link; fallback when the blank tab is blocked; en/id messages; source guard: no `window.open(` or `.r2_url` in src/, components/, context/ |
| lib/resultsStore.test.ts (new) | saved history has job ids and no URL; legacy URLs stripped and storage rewritten |
| lib/supabaseClient.test.ts (new) | module loads with Supabase unset (client null); client created when set |
| lib/config.test.ts | production error names missing Supabase URL / anon key; no error when all set |
| lib/statusPolling.test.ts | gone after 3 consecutive 404s; count restarts after another outcome; `goneJobStatus` is terminal and counts toward progress |
| lib/uploads.test.ts | Pro 429 QUOTA_EXCEEDED -> `renew_pro` (the old assertion "Pro quota error shows the server message" was replaced) |

App.tsx and MyResults wiring has no DOM test (no DOM test setup); covered by lint, build and the source guard.
Manual check on staging: download after 15+ min on the result page and in My Results; download after logout shows
the unavailable message.

### 4. Verification (Node 24.22.0, pnpm 10.33.0, macOS)
| Step | Result |
|---|---|
| check-repo-safety.sh | exit 0 (before and after) |
| pnpm install --frozen-lockfile | pass, lockfile unchanged, no new dependencies |
| pnpm run lint (tsc --noEmit) | pass, no output |
| pnpm run test | 8 files, 88 tests passed |
| pnpm run build | pass (chunk-size warning as before) |
| gitleaks 8.30.1 `dir --redact .` | no leaks found |

Bundle (baseline: `git archive 3434424` built in a scratch directory with the same node_modules):
| Asset | Before | After | Delta |
|---|---|---|---|
| JS | 1,228.21 kB (377.28 kB gzip) | 1,230.80 kB (378.35 kB gzip) | +2.59 kB (+1.07 kB gzip) |
| CSS | 69.14 kB (11.78 kB gzip) | 69.42 kB (11.79 kB gzip) | +0.28 kB (+0.01 kB gzip) |
Total +1.08 kB gzip, inside the ~1.5 kB budget.

### Changed files
.env.example, components/auth/AuthCallback.tsx, components/results/MyResults.tsx, context/AuthContext.tsx,
lib/config.ts, lib/config.test.ts, lib/downloads.ts (new), lib/downloads.test.ts (new), lib/resultsStore.ts,
lib/resultsStore.test.ts (new), lib/statusPolling.ts, lib/statusPolling.test.ts, lib/supabaseClient.ts,
lib/supabaseClient.test.ts (new), lib/uploads.ts, lib/uploads.test.ts, src/App.tsx,
docs/engineering/deploy/UI-ENVIRONMENTS.md, docs/engineering/STATE.md, this file.

### Follow-ups (not in scope)
- imageopz-server registers.md: mark UI2 done once this merges (server repo was read-only here).
- /status is called without the Supabase bearer, so ownership is by session id. After logout the session id rotates and
  older history items show "no longer available", even for the same account. Sending the bearer for account-owned
  jobs would let signed-in users download from any session (server already accepts it).
- "Download all" in My Results opens one tab per file; most browsers allow only the first popup per click. Same as
  before; a zip or sequential download would fix it.
- The stall guard (2 min without a status change) is unchanged; revisit after T-008 timings.
- Carried over: shadcn runtime dependency, vite listed twice, tsx unused, 1.2 MB bundle, App.tsx size, no ESLint.

### Owner commands
```
git push -u origin fix/download-links
gh pr create --base main --head fix/download-links --title "fix: fresh download links, Supabase config screen, 404 give-up, Pro renew prompt (T-008c3)" --body-file docs/engineering/tasks/T-008c3-download-links.md
gh pr checks --watch && gh pr merge --squash --delete-branch
```
