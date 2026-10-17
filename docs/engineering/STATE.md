---
project: imageopz-ui
updated: 2026-10-17 by Claude Code (task T-008b3)
---

# STATE - imageopz-ui

## Current objective
Frontend for ImageOpz. Cross-repo objective and backend state: imageopz-server docs/engineering/STATE.md.

## Accepted baseline
- `main` @ `f6f19ce` (T-006d, PR #5). T-008b3 on branch `fix/session-cookie-mode` (local commit, not pushed).
- Upload path: presign -> browser PUT to R2 -> complete (lib/uploads.ts), contract in imageopz-server
  docs/engineering/contracts/uploads-api.md. Limits in lib/uploadLimits.ts: free 10 MB / 3 files, Pro 50 MB / 30 files.
- Status polling: lib/statusPolling.ts (per-job retry with backoff, "temporarily unavailable" after 3 failed fetches,
  loop survives a failing tick). Processing progress counts finished files; the backend sends `progress = null` (server T-007).
- API client: every request goes through `apiFetch` (lib/imageopzApi.ts), the single credentials policy
  (`VITE_IMAGEOPZ_SEND_COOKIES="false"` -> `omit`, else `include`); session id in lib/session.ts (localStorage,
  sent as X-Session-Id on every call incl. logout); all VITE_ variables read in lib/config.ts; a production build
  without `VITE_IMAGEOPZ_API_BASE_URL` renders a "not configured" screen. Env per Vercel environment:
  docs/engineering/deploy/UI-ENVIRONMENTS.md.
- Local runs on the T-008b3 tree (Node 24.22.0, pnpm 10.33.0): frozen install, lint, test (70 vitest tests), build pass.
  Main JS chunk 1,228.21 kB (377.28 kB gzip), above Vite's 500 kB warning.
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
| T-008b3 header-only session mode (logout fix), config validation, UI environment docs | not yet | - |

## Open tasks
| Task | Scope | Status |
|---|---|---|
| T-008b3 | Header-only sessions, config validation, UI-ENVIRONMENTS.md | handed off on `fix/session-cookie-mode`, owner to push and PR |
| Owner | `staging` branch, Vercel domain + env vars, Cloudflare CNAME (UI-ENVIRONMENTS.md owner steps) | open |
| T-008 | Staging end-to-end incl. R2 PUT from the browser (CORS origin for staging) | open (imageopz-server) |

## Known debt / follow-ups
- R2 CORS allows only the production origin and localhost:3000; the staging origin must be added before T-008.
  Vercel Preview URLs stay out of API/R2 CORS by design (uploads fail on previews).
- Missing `VITE_SUPABASE_URL` still throws at module load (supabase-js `createClient`), i.e. a blank page; the
  config error screen covers only the API base URL.
- Server `CORS_ALLOW_CREDENTIALS` can go to false once this UI is deployed in that environment (DEPLOY-PLAN section 7).
- check-repo-safety.sh marker check scans code files incl. .svg only; .json/.md not scanned.
- Stall guard (2 min without a status change) now only sees status transitions since progress is null; a single file
  processing longer than 2 min would be stopped as "taking too long". Revisit after T-008 timings.
- A job whose /status keeps failing (e.g. permanent 404) is retried every 30 s while the tab is open; no give-up.
- Pro 429 QUOTA_EXCEEDED (credits used up / Pro expired) still shows a toast with the server message, not a renew prompt.
- `shadcn` (a CLI) is a runtime dependency and pulls express 5 / MCP SDK into the lockfile; move to devDependencies or drop.
- `vite` is listed in both dependencies and devDependencies; `tsx` appears unused.
- src/App.tsx is ~2,400 lines; single 1.2 MB bundle (no code splitting).
- DISABLE_HMR / AI Studio comment in vite.config.ts; no ESLint.

## Standing authorization
None. Each task grants its own; the owner commits and pushes.

## Next bounded step
Push `fix/session-cookie-mode`, open the PR, merge after `check` and `build` pass; owner Vercel/Cloudflare staging
setup (UI-ENVIRONMENTS.md); then T-008 staging end-to-end.
