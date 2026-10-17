---
project: imageopz-ui
updated: 2026-10-17 by Claude Code (task T-008c3)
---

# STATE - imageopz-ui

## Current objective
Frontend for ImageOpz. Cross-repo objective and backend state: imageopz-server docs/engineering/STATE.md.

## Accepted baseline
- `main` @ `3434424` (T-008b3, PR #6). T-008c3 on branch `fix/download-links` (local commit, not pushed).
- Upload path: presign -> browser PUT to R2 -> complete (lib/uploads.ts), contract in imageopz-server
  docs/engineering/contracts/uploads-api.md. Limits in lib/uploadLimits.ts: free 10 MB / 3 files, Pro 50 MB / 30 files.
- Status polling: lib/statusPolling.ts (per-job retry with backoff, "temporarily unavailable" after 3 failed fetches,
  loop survives a failing tick, a job is given up as failed "no longer available" after 3 consecutive 404s).
  Processing progress counts finished files; the backend sends `progress = null` (server T-007).
- Downloads: lib/downloads.ts calls /status on every click and opens the fresh presigned link (15 min, server
  T-008c2); local history (lib/resultsStore.ts) stores job ids only; no link -> "no longer available" message.
- API client: every request goes through `apiFetch` (lib/imageopzApi.ts), the single credentials policy
  (`VITE_IMAGEOPZ_SEND_COOKIES="false"` -> `omit`, else `include`); session id in lib/session.ts (localStorage,
  sent as X-Session-Id on every call incl. logout); all VITE_ variables read in lib/config.ts; a production build
  without `VITE_IMAGEOPZ_API_BASE_URL`, `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` renders a "not configured"
  screen (the Supabase client is null when unset). Env per Vercel environment: docs/engineering/deploy/UI-ENVIRONMENTS.md.
- Pro user with 429 QUOTA_EXCEEDED (credits used up / Pro expired) gets the paywall as a "Renew Pro" prompt.
- Local runs on the T-008c3 tree (Node 24.22.0, pnpm 10.33.0): frozen install, lint, test (88 vitest tests), build pass.
  Main JS chunk 1,230.80 kB (378.35 kB gzip), above Vite's 500 kB warning.
- Not verified against a live backend or R2 (T-008 staging).
- Deployed: none (ImageOpz offline). Hosting: Vercel (vercel.json).

## CI and repo settings
- `repo-safety` workflow, job `check` - required by ruleset 25144456 "main protection" (PR required, no force-push or deletion).
- `ui-ci` workflow, job `build` (install, lint, test, build) - not required yet; owner may add it after a green run.

## Done (PR, squash SHA)
| Task | PR | SHA |
|---|---|---|
| Malware remediation: auto-run task, payload, remote-code loader, tracked .env, decoy assets | #1 | fd1032e |
| T-DOCS-UI agent docs, CI, AI Studio cleanup, Node 24, LICENSE | #2 | 5bc2835 |
| T-006c direct-to-R2 uploads, 50 MB Pro, vitest | #3 | b509117 |
| T-006c amendment: svg in repo-safety code scan | #4 | 49e0c95 |
| T-006d upload UX fixes (polling crash, quota paywall, indeterminate processing) | #5 | f6f19ce |
| T-008b3 header-only session mode (logout fix), config validation, UI environment docs | #6 | 3434424 |
| T-008c3 fresh download links, Supabase config screen, 404 give-up, Pro renew prompt, env docs DNS | not yet | - |

## Open tasks
| Task | Scope | Status |
|---|---|---|
| T-008c3 | Fresh download links (server UI2), env docs DNS, go-live follow-ups | handed off on `fix/download-links`, owner to push and PR |
| Owner | `staging` branch, Vercel domain + env vars (DNS is on Vercel, no CNAME step; UI-ENVIRONMENTS.md owner steps) | open |
| Owner | imageopz-server registers.md: mark UI2 done after T-008c3 merges | open |
| T-008 | Staging end-to-end incl. R2 PUT from the browser (CORS origin for staging) | open (imageopz-server) |

## Known debt / follow-ups
- R2 CORS allows only the production origin and localhost:3000; the staging origin must be added before T-008.
  Vercel Preview URLs stay out of API/R2 CORS by design (uploads fail on previews).
- /status is called without the Supabase bearer, so download ownership is by session id; after logout older history
  items show "no longer available" even for the same account (server accepts the bearer for account-owned jobs).
- "Download all" in My Results opens one tab per file; browsers allow only the first popup per click.
- Server `CORS_ALLOW_CREDENTIALS` can go to false once this UI is deployed in that environment (DEPLOY-PLAN section 7).
- check-repo-safety.sh marker check scans code files incl. .svg only; .json/.md not scanned.
- Stall guard (2 min without a status change) now only sees status transitions since progress is null; a single file
  processing longer than 2 min would be stopped as "taking too long". Revisit after T-008 timings.
- A job whose /status keeps failing with non-404 errors is retried every 30 s while the tab is open (by design).
- `shadcn` (a CLI) is a runtime dependency and pulls express 5 / MCP SDK into the lockfile; move to devDependencies or drop.
- `vite` is listed in both dependencies and devDependencies; `tsx` appears unused.
- src/App.tsx is ~2,400 lines; single 1.2 MB bundle (no code splitting).
- DISABLE_HMR / AI Studio comment in vite.config.ts; no ESLint.

## Standing authorization
None. Each task grants its own; the owner commits and pushes.

## Next bounded step
Push `fix/download-links`, open the PR, merge after `check` and `build` pass; owner Vercel staging setup
(UI-ENVIRONMENTS.md); then T-008 staging end-to-end incl. a download after 15+ minutes.
