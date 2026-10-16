// Job status polling helpers: per-job retry with backoff, a loop that survives errors, file-count progress.
// No React in this module.
import { ImageOpzApiError, type JobStatusEnum, type JobStatusResponse } from "./imageopzApi";

// Consecutive failed /status fetches before a file shows "temporarily unavailable".
export const STATUS_UNAVAILABLE_AFTER = 3;
const STATUS_RETRY_BASE_MS = 2000;
const STATUS_RETRY_MAX_MS = 30_000;

// Jobs whose last status fetch failed; a job leaves the map on its next successful fetch.
export type JobHealth = Map<string, { failures: number; nextAttemptAt: number }>;

export function statusRetryDelayMs(failures: number): number {
  return Math.min(STATUS_RETRY_MAX_MS, STATUS_RETRY_BASE_MS * 2 ** Math.max(0, failures - 1));
}

export function isStatusUnavailable(health: JobHealth, jobId: string): boolean {
  return (health.get(jobId)?.failures ?? 0) >= STATUS_UNAVAILABLE_AFTER;
}

export function isTerminalStatus(status: JobStatusEnum | undefined): boolean {
  return status === "done" || status === "failed" || status === "rejected";
}

// Up to `max` jobs that are not backing off, rotating from `cursor` so large batches are all visited.
export function pickDueJobs(
  pending: string[],
  health: JobHealth,
  now: number,
  max: number,
  cursor: number
): { picks: string[]; cursor: number } {
  const picks: string[] = [];
  if (pending.length === 0) return { picks, cursor: 0 };
  const start = cursor % pending.length;
  let next = start;
  for (let i = 0; i < pending.length && picks.length < max; i++) {
    const id = pending[(start + i) % pending.length];
    next = (start + i + 1) % pending.length;
    if ((health.get(id)?.nextAttemptAt ?? 0) <= now) picks.push(id);
  }
  return { picks, cursor: next };
}

// Fetches each id; a rejected fetch counts against that job only and never rejects the whole call.
export async function fetchStatuses(
  ids: string[],
  fetchStatus: (id: string) => Promise<JobStatusResponse>,
  health: JobHealth,
  options: { now: number; concurrency: number }
): Promise<{ fresh: JobStatusResponse[]; rateLimited: boolean }> {
  const fresh: JobStatusResponse[] = [];
  let rateLimited = false;
  let next = 0;
  const worker = async () => {
    while (next < ids.length) {
      const id = ids[next++];
      try {
        const s = await fetchStatus(id);
        health.delete(id);
        if (s && typeof s.status === "string") fresh.push(s);
      } catch (e) {
        if (e instanceof ImageOpzApiError && e.status === 429) rateLimited = true;
        const failures = (health.get(id)?.failures ?? 0) + 1;
        health.set(id, { failures, nextAttemptAt: options.now + statusRetryDelayMs(failures) });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(options.concurrency, ids.length)) }, worker));
  return { fresh, rateLimited };
}

// Runs `tick` now and again after the delay it returns (null ends the loop). A thrown tick is reported
// through onError and retried after a doubling delay, so one bad response never ends polling.
export function runPollLoop(options: {
  tick: () => Promise<number | null>;
  errorDelayMs: number;
  maxErrorDelayMs?: number;
  onError?: (error: unknown) => void;
}): () => void {
  const maxErrorDelay = options.maxErrorDelayMs ?? STATUS_RETRY_MAX_MS;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let errors = 0;
  const run = async () => {
    timer = null;
    if (stopped) return;
    let delay: number | null;
    try {
      delay = await options.tick();
      errors = 0;
    } catch (e) {
      errors++;
      options.onError?.(e);
      delay = Math.min(maxErrorDelay, options.errorDelayMs * 2 ** (errors - 1));
    }
    if (!stopped && delay !== null) timer = setTimeout(run, delay);
  };
  timer = setTimeout(run, 0);
  return () => {
    stopped = true;
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
}

// The backend no longer reports per-job progress (always null), so the batch advances by finished files.
export function batchProgress(
  jobIds: readonly string[],
  statuses: Readonly<Record<string, JobStatusResponse | undefined>>
): { completed: number; total: number; percent: number } {
  const total = jobIds.length;
  const completed = jobIds.filter((id) => isTerminalStatus(statuses[id]?.status)).length;
  return { completed, total, percent: total > 0 ? (completed / total) * 100 : 0 };
}

export type JobPhase = "queued" | "processing" | "done" | "failed" | "rejected" | "unavailable";

// Display phase of an accepted job; processing is indeterminate, never a percentage.
export function jobPhase(status: JobStatusResponse | undefined, unavailable: boolean): JobPhase {
  if (status && isTerminalStatus(status.status)) return status.status as JobPhase;
  if (unavailable) return "unavailable";
  return status?.status === "pending" ? "queued" : "processing";
}
