# T-006d - Upload UX fixes before go-live
Baseline main@49e0c95 (PR #4), branch `fix/upload-ux`. Change type: bug fix. Rigor: Standard. Executor: Claude Code.
Spec: imageopz-server docs/engineering/contracts/uploads-api.md (read-only); server T-007 (`progress` always null).
Authorization: edit imageopz-ui; frozen install, lint, test, build after the safety gate. No push. Local commit, no co-author trailer.

## Contract
0. Safety gate; STATE.md records PR #3 and #4. 1. Polling survives failed /status, per-job backoff, "temporarily
unavailable" after N failures. 2. Free 429 QUOTA_EXCEEDED shows the upgrade prompt. 3. Indeterminate per-file processing,
overall bar counts finished files. 4. AGENTS.md "Learned" entry. 5. Verify, bundle delta <= ~2 kB gzip. Tests first.

## Handoff (2026-10-16)

### 0. Safety gate - passed
- `git fetch` failed in the sandbox (ssh known_hosts not readable); local `origin/main` = `main` = 49e0c95, which `gh pr list`
  confirms as the PR #4 merge commit (PR #3 = b509117).
- `git merge-base --is-ancestor fd1032e HEAD` true. Since T-006c (b509117..49e0c95) only STATE.md, the T-006c task file and
  check-repo-safety.sh changed; vite.config.ts, vitest.config.ts and package.json scripts unchanged (read again).
  grep for `eval(|atob(|fetch(|child_process` in `*.config.*`: no matches.
- check-repo-safety.sh exit 0 before the first pnpm command and after the change.

### 1. Polling crash
Root cause: the tick built `statuses` with `null` for each failed /status fetch, and on completion ran
`statuses.some(s => s.status === "done")` -> TypeError. Inside the timer callback that rejection was unhandled and no
next timeout was scheduled, so polling stopped silently; on the first tick it fell into the start catch ("Request failed").
Fix, lib/statusPolling.ts (no React):
- `fetchStatuses` never rejects; a failed fetch records `{failures, nextAttemptAt}` for that job only (2 s, 4 s, 8 s ... cap 30 s),
  a success clears it; a 429 still drives the existing global poll backoff.
- `pickDueJobs` skips jobs still backing off and keeps the rotating cursor.
- `isStatusUnavailable` after `STATUS_UNAVAILABLE_AFTER = 3` consecutive failures; App shows "temporarily unavailable"
  ("sementara tidak tersedia") for that file and keeps retrying.
- `runPollLoop` replaces the hand-rolled setTimeout chain: a throwing tick is logged (console.warn) and retried after a
  doubling delay (2.5 s base, 30 s cap) instead of ending the loop; `stop()` is what `stopPolling` calls.
- App: completion counts use `allKnown` (non-null); the 2-minute stall guard is skipped while any file is unavailable.

### 2. Free quota exhausted
`classifyStartError(err, isPro)` in lib/uploads.ts maps the presign errors from the contract:
free 429 `QUOTA_EXCEEDED` -> `quota_exceeded` (App opens the paywall dialog and refreshes /session/me so the credit
count syncs); 429 `ACTIVATION_PENDING` -> activation bridge with `details.retry_after_ms` (unchanged behaviour);
everything else (Pro 429, unknown 429, 4xx/5xx, network) -> toast with the server message. The "Not activated yet"
fallback, which also started the activation bridge for any free 429, is gone.

### 3. Processing progress
- `batchProgress(jobIds, statuses)`: completed = done/failed/rejected; percent = completed / total. App's overall
  percent (and the stage text thresholds) use it; the spinner centre shows `completed/total` once uploads finish
  (upload phase still shows byte %).
- `jobPhase(status, unavailable)`: queued (pending) / processing (no percentage, even if a number arrives) / done /
  failed / rejected / unavailable. Queued and processing rows show a small spinning Loader2 icon (lucide, already a dependency).
- The stall signature no longer includes `progress`.

### Tests - failing first
Written before the implementation; first run (lib/statusPolling.ts and `classifyStartError` absent):
```
 FAIL  lib/statusPolling.test.ts [ lib/statusPolling.test.ts ]
Error: Cannot find module './statusPolling' imported from .../lib/statusPolling.test.ts
 FAIL  lib/uploads.test.ts > classifyStartError > sends a free user out of credits to the upgrade prompt
TypeError: classifyStartError is not a function
 FAIL  lib/uploads.test.ts > classifyStartError > keeps ACTIVATION_PENDING on the activation bridge with retry_after_ms
 FAIL  lib/uploads.test.ts > classifyStartError > shows the server message for other errors, Pro quota errors and unknown 429s
      Tests  3 failed | 24 passed (27)
```
After the implementation: 2 files, 39 passed, 0 failed (24 existing + 15 new).
| New test | Item | Result |
|---|---|---|
| runPollLoop: keeps polling after a tick throws, with backoff | 1 | pass |
| runPollLoop: doubles the error delay up to the cap and resets after a good tick | 1 | pass |
| runPollLoop: stop() cancels the next tick | 1 | pass |
| runPollLoop: a rejected status fetch keeps the loop alive until the job finishes | 1 | pass |
| fetchStatuses: never throws: a failed job is counted and the others still update | 1 | pass |
| fetchStatuses: flags a 429 as rate limited | 1 | pass |
| fetchStatuses: marks a job unavailable after N consecutive failures and clears it on success | 1 | pass |
| pickDueJobs: skips jobs still backing off and rotates through the rest | 1 | pass |
| pickDueJobs: per-job retry delay grows and is capped | 1 | pass |
| classifyStartError: sends a free user out of credits to the upgrade prompt | 2 | pass |
| classifyStartError: keeps ACTIVATION_PENDING on the activation bridge with retry_after_ms | 2 | pass |
| classifyStartError: shows the server message for other errors, Pro quota errors and unknown 429s | 2 | pass |
| batchProgress counts completed files, ignoring progress values | 3 | pass |
| jobPhase is an indeterminate state, never a percentage | 3 | pass |
| jobPhase reports unavailable for a job whose status keeps failing | 3 | pass |
The App.tsx wiring itself has no test (no DOM test setup); it is covered by lint/build and needs a manual check in T-008.

### 4. AGENTS.md
"Learned" section added with the 2026-10-16 entry from the task.

### 5. Verification (Node 24.22.0, pnpm 10.33.0, macOS)
| Step | Result |
|---|---|
| check-repo-safety.sh | exit 0 |
| pnpm install --frozen-lockfile | pass, lockfile unchanged, no new dependencies |
| pnpm run lint (tsc --noEmit) | pass, no output |
| pnpm run test | 2 files, 39 tests passed |
| pnpm run build | pass (chunk-size warning as before) |
| gitleaks 8.30.1 `dir --redact .` | no leaks found |

Bundle (baseline built from the same tree at 49e0c95 before any edit):
| Asset | Before | After | Delta |
|---|---|---|---|
| JS | 1,225.84 kB (376.34 kB gzip) | 1,227.30 kB (376.94 kB gzip) | +1.46 kB (+0.60 kB gzip) |
| CSS | 69.06 kB (11.76 kB gzip) | 69.06 kB (11.76 kB gzip) | 0 |
Total +0.60 kB gzip, inside the ~2 kB budget.

### Changed files
AGENTS.md, docs/engineering/STATE.md, this file, lib/statusPolling.ts (new), lib/statusPolling.test.ts (new),
lib/uploads.ts, lib/uploads.test.ts, src/App.tsx.

### Follow-ups (not in scope)
- Stall guard now only sees status transitions (progress is null): one file processing > 2 min is stopped as
  "taking too long". Check real processing times in T-008, then raise or drop the guard.
- A job whose /status fails permanently (e.g. 404 after an identity change) is retried every 30 s with no give-up.
- Pro 429 QUOTA_EXCEEDED (credits used up / Pro expired) shows a toast, not a renew prompt.
- Free QUOTA_EXCEEDED also covers "too many files for the tier"; the client pre-validates 3 files, so the paywall is
  the right prompt in practice.
- With one file, the stage text stays on the first stage until it finishes (no intermediate signal from the backend).
- Activation toasts are English-only (pre-existing).
- Carried over from T-006c: R2 CORS origins for staging, repo-safety scope, shadcn runtime dependency, vite listed twice,
  tsx unused, 1.2 MB bundle, App.tsx size.

### Owner commands
```
git push -u origin fix/upload-ux
gh pr create --base main --head fix/upload-ux --title "fix: upload UX before go-live - polling resilience, quota paywall, indeterminate processing (T-006d)" --body-file docs/engineering/tasks/T-006d-upload-ux.md
gh pr checks --watch && gh pr merge --squash --delete-branch
```
