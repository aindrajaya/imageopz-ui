---
project: imageopz-ui
updated: 2026-10-15 by Claude Code (task T-DOCS-UI)
---

# STATE - imageopz-ui

## Current objective
Frontend for ImageOpz. Cross-repo objective and backend state: imageopz-server docs/engineering/STATE.md.

## Accepted baseline
- `main` @ `fd1032e` (PR #1, malware remediation). T-DOCS-UI on branch `chore/ui-baseline`, not yet merged.
- Local runs on the T-DOCS-UI tree (Node 24.22.0, pnpm 10.33.0): frozen install, `tsc --noEmit` and `vite build` pass.
  Main JS chunk 1,215 kB (373 kB gzip), above Vite's 500 kB warning.
- Deployed: none (ImageOpz offline). Hosting: Vercel (vercel.json).

## CI and repo settings
- `repo-safety` workflow, job `check` - required by ruleset 25144456 "main protection" (PR required, no force-push or deletion).
- `ui-ci` workflow, job `build` (added by T-DOCS-UI) - not required yet; owner may add it after the first green run.

## Done (PR, squash SHA)
| Task | PR | SHA |
|---|---|---|
| Malware remediation: auto-run task, payload, remote-code loader, tracked .env, decoy assets | #1 | fd1032e |
| T-DOCS-UI agent docs, CI, AI Studio cleanup, Node 24, LICENSE | this PR | - |

## Open tasks
| Task | Scope | Status |
|---|---|---|
| T-006c | Frontend upload change for presigned uploads (see imageopz-server) | open |

## Known debt / follow-ups
- `.env.example` lacks VITE_PUBLIC_POSTHOG_PROJECT_TOKEN, VITE_PUBLIC_POSTHOG_HOST, VITE_IMAGEOPZ_SEND_COOKIES (used in code); APP_URL is unused (AI Studio leftover).
- `shadcn` (a CLI) is a runtime dependency and pulls express 5 / MCP SDK into the lockfile; move to devDependencies or drop.
- `vite` is listed in both dependencies and devDependencies; `tsx` appears unused.
- src/App.tsx is ~2,300 lines; single 1.2 MB bundle (no code splitting).
- DISABLE_HMR / AI Studio comment in vite.config.ts; no ESLint, no tests.

## Standing authorization
None. Each task grants its own; the owner commits and pushes.

## Next bounded step
Merge T-DOCS-UI after `check` and `build` pass, then add `build` to the ruleset's required checks.
