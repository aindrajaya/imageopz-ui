# T-006c - Direct-to-R2 uploads in the UI (presign -> PUT -> complete), 50 MB Pro limit
Baseline main@5bc2835, branch `feat/direct-r2-uploads`. Change type: feature. Rigor: Standard. Executor: Claude Code.
Spec: imageopz-server docs/engineering/contracts/uploads-api.md (server main@4ee31e5, read-only).
Authorization: edit imageopz-ui; `pnpm add -D vitest@<exact>`; frozen install, lint, build, test. Registry network only.
No backend runs, no R2 calls, no push. Local commits only, no co-author trailer.

## Contract
1. Safety gate. 2. lib/uploads.ts (presign, XHR PUT, complete, orchestrator). 3. App.tsx uses uploadBatch, per-file
states, Cancel; optimizeImages removed. 4. Shared limits (Pro 50 MB / 30, free 10 MB / 3). 5. vitest tests, `test`
script, CI step. 6. .env.example, check-repo-safety.sh scope, STATE.md, this file. 7. Verify, bundle delta, gitleaks.

## Handoff (2026-10-16)

### 1. Safety gate - passed
- `git merge-base --is-ancestor fd1032e HEAD` true (HEAD = 5bc2835).
- Config files: vite.config.ts (unchanged, read first) and the new vitest.config.ts; grep for
  `eval(|atob(|fetch(|child_process` in `*.config.*`: no matches.
- scripts/check-repo-safety.sh exit 0 before the first pnpm command and after every change.

### 2-4. Implementation
- lib/uploads.ts (no React): `presignUploads`, `putToR2` (XMLHttpRequest, byte progress, AbortSignal), `completeUploads`,
  `uploadBatch` (pool of 4, configurable), `aggregateProgress`, `describeRejection` / `describeFailure` (en, id).
- lib/imageopzApi.ts: `optimizeImages` and its response types removed; `getApiBaseUrl`, `buildAuthHeaders`,
  `shouldSendCookies`, `readJson`, `tryReadError` exported so uploads use the same identity and cookie rules;
  `JobStatusEnum` gains `uploading` and `rejected`; `rejection_reason` added to `JobStatusResponse`.
- lib/uploadLimits.ts: FREE 10 MiB / 3 files, PRO 50 MiB / 30 files (server app/config.py uses `x * 1024 * 1024`),
  accepted types with extensions, `isAcceptedImage` (type + extension + name length + size).
  Used by the dropzone (`accept`, `maxSize`, `maxFiles`), onDrop (validation, toasts) and the en/id copy that said 25MB.
- src/App.tsx: startProcessing runs uploadBatch, then the existing status polling for accepted jobs only.
  Per-file rows: queued, uploading (n%), uploaded, processing (n%), done, rejected (reason), failed (reason).
  Cancel button while uploading: aborts in-flight PUTs, no /complete, back to the preview with the files kept.
  "Optimize another" during upload aborts too and does not bounce back to the preview.
  If nothing is accepted, the per-file reasons stay on screen with a "Start over" button.
  Result view lists files that were not processed with their reason. Polling treats `rejected` as terminal.

### Contract conformance
| Contract item | Where handled |
|---|---|
| Presign body `files[].name/size/content_type` | `presignUploads` (size = `File.size`, type lower-cased); `auth_token` omitted |
| `name` 1-255 chars, `.jpg/.jpeg/.png/.webp`; types jpeg/png/webp | `isAcceptedImage` in onDrop; dropzone `accept` = `ACCEPTED_IMAGE_TYPES` |
| Identity (cookie or X-Session-Id, optional Bearer) on both endpoints | `postJson` -> `buildAuthHeaders` + `credentials` per `VITE_IMAGEOPZ_SEND_COOKIES` (same as other calls); token passed only when `accountClaimed`, as before |
| Same identity for presign and complete | Identity captured once per batch; a 404 from a changed identity -> `job_not_found` text ("signed in or out?") |
| 201 `files[]` job_id/upload_url/method/headers/expires_at | `uploadBatch` maps by index, throws if the count differs |
| `complete_by` | Not tracked: /complete follows the PUTs directly; a late call yields `rejected/expired`, shown per file |
| 400 UNSUPPORTED_TYPE, 413 FILE_TOO_LARGE, 422 | Thrown as ImageOpzApiError, App toast with the server message; pre-empted by client limits |
| 429 QUOTA_EXCEEDED / ACTIVATION_PENDING (`retry_after_ms`) | Existing App 429 branch (activation bridge, auto-retry after `retry_after_ms`); Pro 429 -> toast |
| 503 UPLOADS_UNAVAILABLE (presign) | Toast with the server message, back to preview (no retry: nothing reserved) |
| PUT with exactly method + headers, no credentials, browser sets Content-Length | `putToR2`: `open(method)`, returned headers except Content-Length, `withCredentials = false` |
| PUT 200 | item `uploaded` |
| PUT 403 (wrong type/length, expired) - never retry | `put_forbidden`, or `url_expired` when R2 code is `ExpiredRequest`; excluded from /complete |
| PUT network error / 5xx - retry with backoff while `expires_at` ahead | Up to 3 attempts, 1 s then 2 s; stops with `url_expired` once `expires_at` (UTC, no offset -> `parseUtc`) passed |
| Concurrency 4-6 | `DEFAULT_UPLOAD_CONCURRENCY = 4`, `concurrency` option |
| /complete once with all ids whose PUT returned 200 | `remaining` = items in `uploaded`; skipped entirely if none |
| 200 `pending` | item `processing`, job polled |
| 200 `processing` / `done` / `failed` | reported as is (`processing`/`done`/`failed`), polled |
| 200 `rejected` + reason | item `rejected`, `describeRejection` (expired, missing, size_mismatch, type_mismatch, invalid_image, too_many_pixels, presign_failed) |
| 404 JOB_NOT_FOUND `details.job_ids` | those -> `job_not_found`; rest retried |
| 400 TOO_MANY_JOBS / other 4xx | remaining -> `complete_failed`, no retry |
| 503 QUEUE_UNAVAILABLE / STORAGE_UNAVAILABLE `details.jobs` | per-job states applied; only `uploading` jobs retried |
| /complete network error, 5xx, 503 without a job list | retry all remaining with backoff, up to 4 attempts, then `complete_failed` |
| Abort: stop PUTs, no /complete | `signal` aborts XHRs and backoff sleeps; aborted batch never calls /complete (credits: sweeper) |
| Poll /status only for accepted jobs | `acceptedJobIds` (not rejected) feed `jobOrder` / polling |
| /status `rejected` + `rejection_reason` | terminal in polling; shown via `describeRejection` |

### 5. Tests - vitest 4.1.11 (devDependency, exact)
Reason: the contract asks for unit tests of the orchestrator; no test runner existed. 4.1.11 (2026-08-18) is the newest
release older than two weeks on the 4.x line; 5.0.5 was one day old. Peer `vite ^6`, resolves to the existing vite
6.4.2; 25 new registry packages, no tarball/git sources, no new install scripts (pnpm's ignored list unchanged:
core-js, esbuild x2, msw). vitest.config.ts is separate from vite.config.ts so tests never read `.env` or the dev
proxy. `test` script `vitest run`; ui-ci.yml job `build` runs `pnpm run test` between lint and build.

lib/uploads.test.ts (node environment, fake XMLHttpRequest, stubbed fetch): 24 passed, 0 failed.
| Test | Result |
|---|---|
| request shapes: presign, PUT and complete match the contract | pass |
| omits credentials when VITE_IMAGEOPZ_SEND_COOKIES is false and the bearer when there is no token | pass |
| does not forward a Content-Length header to the PUT | pass |
| surfaces presign errors as ImageOpzApiError without any PUT | pass |
| caps concurrent PUTs at 4 by default | pass |
| honours a custom concurrency | pass |
| aggregates byte progress across files | pass |
| aggregateProgress counts settled files as complete | pass |
| abort stops in-flight PUTs, never starts queued ones and skips /complete | pass |
| skips /complete for files uploaded before an abort | pass |
| retries 5xx and network errors with backoff, then completes | pass |
| never retries a 403 and leaves the job out of /complete | pass |
| maps a 403 ExpiredRequest to url_expired without retrying | pass |
| gives up after maxPutAttempts | pass |
| stops retrying once the presigned URL has expired | pass |
| on a partial 503 retries only the jobs still uploading | pass |
| retries all ids on a 503 without a job list and on network errors | pass |
| drops JOB_NOT_FOUND ids and retries the rest | pass |
| does not retry a 4xx and marks the jobs complete_failed | pass |
| gives up after maxCompleteAttempts | pass |
| is not called when every PUT failed | pass |
| reports rejected reasons from a 200 | pass |
| limits: matches the backend tiers | pass |
| limits: checks type, extension and tier size | pass |

### 6. Housekeeping
- .env.example: APP_URL removed; VITE_IMAGEOPZ_SEND_COOKIES, VITE_PUBLIC_POSTHOG_PROJECT_TOKEN,
  VITE_PUBLIC_POSTHOG_HOST added (empty / documented default). Matches every `import.meta.env.VITE_*` in code.
- check-repo-safety.sh: the obfuscation-marker check now scans `code_files` (.ts .tsx .js .jsx .mjs .cjs .html .sh,
  excluding the script) instead of all tracked files minus lockfiles/.github. Other checks unchanged.
  Read-only replay against 8179d01 with `git grep` / `git cat-file` (no checkout), same patterns and scopes:
  combined eval+fetch check FAIL vite.config.ts; vite.config eval check FAIL vite.config.ts; `.env is tracked` FAIL.
  The marker check itself matched nothing at 8179d01 under the old scope or the new one, so no detection was lost there.
- AGENTS.md: `pnpm run test` command replaces "No test suite exists yet".

### 7. Verification (Node 24.22.0, pnpm 10.33.0, macOS)
| Step | Result |
|---|---|
| check-repo-safety.sh | exit 0 |
| pnpm install --frozen-lockfile | pass |
| pnpm run lint (tsc --noEmit, includes tests) | pass, no output |
| pnpm run test | 1 file, 24 tests passed |
| pnpm run build | pass, built in 2.66s (chunk-size warning as before) |
| gitleaks 8.30.1 `dir --redact .` | no leaks, exit 0 |

Bundle (baseline built from a clean worktree of 5bc2835, same lockfile):
| Asset | Before | After | Delta |
|---|---|---|---|
| JS | 1,215.34 kB (372.68 kB gzip) | 1,225.84 kB (376.34 kB gzip) | +10.50 kB (+3.66 kB gzip) |
| CSS | 68.52 kB (11.72 kB gzip) | 69.06 kB (11.76 kB gzip) | +0.54 kB (+0.04 kB gzip) |
Total +3.70 kB gzip, inside the ~5 kB budget.

### Changed files
.env.example, .github/workflows/ui-ci.yml, AGENTS.md, docs/engineering/STATE.md, this file, lib/imageopzApi.ts,
lib/uploadLimits.ts (new), lib/uploads.ts (new), lib/uploads.test.ts (new), package.json (CRLF kept), pnpm-lock.yaml,
scripts/check-repo-safety.sh, src/App.tsx, vitest.config.ts (new).

### Follow-ups (not in scope)
- Not verified against real R2 or a backend: live end-to-end belongs to T-008 staging. R2 CORS allows only
  https://imageopz.aindrajaya.my.id and http://localhost:3000; Vercel preview/staging origins need adding or the PUT preflight fails.
- check-repo-safety.sh: the marker check does not scan .json, .md or other non-code files; consider `*.mts`/`*.cts`.
- Pre-existing: App.tsx polling `statuses.some(s => s.status === "done")` can throw when a status fetch failed (null entry).
- Pre-existing: a free-tier 429 QUOTA_EXCEEDED shows "Not activated yet" and starts the activation bridge instead of the paywall.
- Failed PUTs keep their reserved credit until `complete_by` + sweeper (per this task); calling /complete for them
  would release it at once (contract allows it).
- Upload progress updates React state on every XHR progress event; throttle if 30-file batches feel slow.
- When nothing is accepted the processing spinner keeps spinning next to "Start over" (cosmetic).
- docs/content-seo.v1.md still says 10MB only (marketing copy, not code).
- Carried over: shadcn as runtime dependency, vite listed twice, tsx unused, 1.2 MB bundle, App.tsx size; vitest 5.x available.

### Owner commands
```
git push -u origin feat/direct-r2-uploads
gh pr create --base main --head feat/direct-r2-uploads --title "feat: direct-to-R2 uploads (presign -> PUT -> complete), 50 MB Pro limit (T-006c)" --body-file docs/engineering/tasks/T-006c-direct-uploads.md
gh pr checks --watch && gh pr merge --squash --delete-branch
```

## Amendment (2026-10-16) - svg in repo-safety code scan
Change: `*.svg` added to `code_files()` in scripts/check-repo-safety.sh, so both the obfuscation-marker search and
the eval+atob/fetch check scan SVG (SVG can carry script). Nothing else changed.
Verification:
- HEAD: exit 0 (no tracked .svg files today).
- Read-only replay against 8179d01 (`git grep` / `git cat-file`, no checkout), same detections as before:
  eval+fetch check FAIL vite.config.ts; vite.config eval check FAIL vite.config.ts; `.env is tracked` FAIL.
  The 3 decoy font .svg files at 8179d01 are now scanned and contain no markers.
