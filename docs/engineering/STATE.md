---
project: imageopz-ui
updated: 2026-10-16 by Claude Code (task T-006c)
---

# STATE - imageopz-ui

## Current objective
Frontend for ImageOpz. Cross-repo objective and backend state: imageopz-server docs/engineering/STATE.md.

## Accepted baseline
- `main` @ `5bc2835` (T-DOCS-UI, PR #2). T-006c on branch `feat/direct-r2-uploads` (local commit, not pushed).
- Upload path: presign -> browser PUT to R2 -> complete (lib/uploads.ts), contract in imageopz-server
  docs/engineering/contracts/uploads-api.md. Limits in lib/uploadLimits.ts: free 10 MB / 3 files, Pro 50 MB / 30 files.
- Local runs on the T-006c tree (Node 24.22.0, pnpm 10.33.0): frozen install, lint, test (24 vitest tests), build pass.
  Main JS chunk 1,225.84 kB (376.34 kB gzip), above Vite's 500 kB warning.
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
| T-006c direct-to-R2 uploads, 50 MB Pro, vitest | not yet | - |

## Open tasks
| Task | Scope | Status |
|---|---|---|
| T-006c | Direct-to-R2 uploads in the UI | handed off on `feat/direct-r2-uploads`, owner to push and PR |
| T-008 | Staging end-to-end incl. R2 PUT from the browser (CORS origin for staging) | open (imageopz-server) |

## Known debt / follow-ups
- R2 CORS allows only the production origin and localhost:3000; preview/staging origins must be added before T-008.
- check-repo-safety.sh marker check scans code files only (T-006c); consider adding `*.svg`.
- App.tsx polling: `statuses.some(s => s.status === "done")` can throw on a null status entry.
- Free-tier 429 QUOTA_EXCEEDED shows "Not activated yet" instead of the paywall.
- `shadcn` (a CLI) is a runtime dependency and pulls express 5 / MCP SDK into the lockfile; move to devDependencies or drop.
- `vite` is listed in both dependencies and devDependencies; `tsx` appears unused.
- src/App.tsx is ~2,400 lines; single 1.2 MB bundle (no code splitting).
- DISABLE_HMR / AI Studio comment in vite.config.ts; no ESLint.

## Standing authorization
None. Each task grants its own; the owner commits and pushes.

## Next bounded step
Push `feat/direct-r2-uploads`, open the PR, merge after `check` and `build` pass; then T-008 staging end-to-end.
