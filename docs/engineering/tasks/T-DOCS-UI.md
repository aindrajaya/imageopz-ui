# T-DOCS-UI - Agent workflow baseline, CI and cleanup
Baseline main@fd1032e, branch `chore/ui-baseline`. Rigor: Standard. Executor: Claude Code.
Authorization: edits inside imageopz-ui; frozen install, lint and build only after the safety gate; read-only gh. No commit/push.

## Contract
1. Safety gate before any pnpm command. 2. Remove AI Studio leftovers (Gemini define/env, unused deps, debug log, garbled comment), refresh lockfile.
3. Node 24 (.nvmrc, engines). 4. CI workflow `ui-ci` job `build`. 5. .gitleaksignore fingerprint. 6. SECURITY.md.
7. AGENTS.md, CLAUDE.md symlink, STATE.md, this file, LICENSE. 8. Verify.

## Handoff (2026-10-15)
### 1. Safety gate - passed
- `git merge-base --is-ancestor fd1032e HEAD` true (HEAD = fd1032e).
- Only config file is vite.config.ts; grep for `eval(|atob(|fetch(|child_process` in `*.config.*`: no matches.
- scripts/check-repo-safety.sh read first (read-only checks), exit 0.

### 2. Cleanup
- vite.config.ts: removed `process.env.GEMINI_API_KEY` define and the debug `console.log`; mojibake em-dash in the HMR comment replaced with a hyphen. CRLF line endings kept.
- .env.example: GEMINI_API_KEY block removed.
- package.json: removed `@google/genai`, `express`, `@types/express` (the types go with express).
  Proof: `git grep -nE "@google/genai|from ['\"]express['\"]|require\(['\"]express|['\"]express['\"]"` over all tracked files except the lockfile matched only package.json.
- Lockfile: `pnpm install --lockfile-only --ignore-scripts` -> 581 lines removed, 0 added. All 532 packages resolve by integrity hash; no tarball, git or non-registry URLs.
  express@5.2.1 remains transitively via @modelcontextprotocol/sdk <- shadcn (follow-up).
- package.json `license` changed from "MIT" to "UNLICENSED" to match the all-rights-reserved LICENSE.

### 3-4. Node 24 and CI
- .nvmrc `24`; engines `>=24 <25`.
- .github/workflows/ui-ci.yml: ubuntu-24.04, contents: read, job `build`. Versions discovered with `gh release list` / `gh api` (2026-10-15):
  | Action | Latest | Used | Runtime (action.yml) |
  |---|---|---|---|
  | actions/checkout | v7.0.1 (2026-07-20) | `@v7` (tag = v7.0.1 commit 3d3c42e) | node24 |
  | actions/setup-node | v7.1.0 (2026-10-08) | `@v7` (tag = v7.1.0 commit 949feb2) | node24 |
  | pnpm/action-setup | v6.1.0 (2026-09-05) | SHA `ea17c68` (v6.1.0) | node24 |
  The floating pnpm `v6` tag lags v6.1.0 by one commit, and pnpm/action-setup is third-party, so it is pinned by SHA. v6.1.0 notes: "support pnpm v12"; setup-node v7.1.0 notes include "Support absolute paths in node-version-file" and an ESM migration note for v7.
- repo-safety.yml unchanged.

### 5-7. Docs
- .gitleaksignore: the 8179d01 `.env` fingerprint with the required comment. Verified: `gitleaks git --log-opts=--all` reports exactly this fingerprint without the file and no leaks with it.
- SECURITY.md, AGENTS.md (37 lines), CLAUDE.md -> AGENTS.md, STATE.md, LICENSE (copied from imageopz-server).

### 8. Verification (Node 24.22.0, pnpm 10.33.0, macOS)
| Step | Result | Duration |
|---|---|---|
| pnpm install --frozen-lockfile | pass; build scripts of core-js, esbuild, msw blocked by pnpm (not approved) | 10s |
| pnpm run lint (tsc --noEmit) | pass, no output | 2s |
| pnpm run build | pass, 2335 modules, "built in 2.39s" | 5s |
| check-repo-safety.sh | exit 0 | - |
| gitleaks 8.30.1 `dir --redact .` | no leaks (~1.55 MB scanned) | <1s |
Build output: index.html 1.67 kB; CSS 68.49 kB (11.69 kB gzip); JS 1,215.34 kB (372.68 kB gzip, chunk-size warning); Geist fonts 58 kB; dist/ 1.4 MB.
dist/ contains no GEMINI reference.

### Follow-ups (not in scope)
- .env.example missing VITE_PUBLIC_POSTHOG_PROJECT_TOKEN, VITE_PUBLIC_POSTHOG_HOST, VITE_IMAGEOPZ_SEND_COOKIES; APP_URL unused.
- Move `shadcn` to devDependencies or drop it; dedupe `vite` (listed twice); `tsx` appears unused.
- Code-split the 1.2 MB bundle; App.tsx ~2,300 lines; no ESLint or tests.
- repo-safety.yml still uses actions/checkout@v4 and ubuntu-latest (left unchanged by contract).

## Amendment (2026-10-15) - repo-safety rule 3 false positive
Problem: after the T-DOCS-UI commit, check-repo-safety.sh failed on HEAD because this task file describes the
download-and-execute patterns in prose, and the check scanned every tracked file.
Change: the check that flags a file combining a dynamic-evaluation call with a base64-decode or network-fetch call now
scans only tracked code files (.ts .tsx .js .jsx .mjs .cjs .html .sh), still excluding the script itself.
Unchanged: the obfuscation-marker check (all tracked files except lockfiles, the script and .github/), the vite.config
dynamic-evaluation check, the .env/.gitignore checks and the install-script check. The script still uses only git, grep
and file (xargs feeds grep).
Verification:
- HEAD (6e21540 + this change): exit 0 (before the change: exit 1 on this file).
- Read-only replay against 8179d01 with `git grep` (no checkout): the combined-call check and the vite.config check
  both fire on vite.config.ts.
