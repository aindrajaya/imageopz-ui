---
project: imageopz-ui
updated: 2026-10-16 by Claude Code (task T-006d)
---

# STATE - imageopz-ui

## Current objective
Frontend for ImageOpz. Cross-repo objective and backend state: imageopz-server docs/engineering/STATE.md.

## Accepted baseline
- `main` @ `49e0c95` (svg repo-safety fix, PR #4). T-006d on branch `fix/upload-ux` (local commit, not pushed).
- Upload path: presign -> browser PUT to R2 -> complete (lib/uploads.ts), contract in imageopz-server
  docs/engineering/contracts/uploads-api.md. Limits in lib/uploadLimits.ts: free 10 MB / 3 files, Pro 50 MB / 30 files.
- Status polling: lib/statusPolling.ts (per-job retry with backoff, "temporarily unavailable" after 3 failed fetches,
  loop survives a failing tick). Processing progress counts finished files; the backend sends `progress = null` (server T-007).
- Local runs on the T-006d tree (Node 24.22.0, pnpm 10.33.0): frozen install, lint, test (39 vitest tests), build pass.
  Main JS chunk 1,227.30 kB (376.94 kB gzip), above Vite's 500 kB warning.
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
| T-006d upload UX fixes (polling crash, quota paywall, indeterminate processing) | not yet | - |

## Open tasks
| Task | Scope | Status |
|---|---|---|
| T-006d | Upload UX fixes before go-live | handed off on `fix/upload-ux`, owner to push and PR |
| T-008 | Staging end-to-end incl. R2 PUT from the browser (CORS origin for staging) | open (imageopz-server) |

## Known debt / follow-ups
- R2 CORS allows only the production origin and localhost:3000; preview/staging origins must be added before T-008.
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
Push `fix/upload-ux`, open the PR, merge after `check` and `build` pass; then T-008 staging end-to-end.
