import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ImageOpzApiError, type JobStatusResponse } from "./imageopzApi";
import {
  STATUS_UNAVAILABLE_AFTER,
  batchProgress,
  fetchStatuses,
  isStatusUnavailable,
  jobPhase,
  pickDueJobs,
  runPollLoop,
  statusRetryDelayMs,
  type JobHealth,
} from "./statusPolling";

function status(job_id: string, s: JobStatusResponse["status"], extra: Partial<JobStatusResponse> = {}): JobStatusResponse {
  return {
    job_id,
    status: s,
    original_filename: `${job_id}.jpg`,
    original_size: 100,
    created_at: "2026-10-16T00:00:00",
    expiry_date: "2026-10-23T00:00:00",
    progress: null,
    ...extra,
  } as JobStatusResponse;
}

describe("runPollLoop", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("keeps polling after a tick throws, with backoff", async () => {
    const onError = vi.fn();
    let calls = 0;
    const tick = vi.fn(async () => {
      calls++;
      if (calls === 1) throw new TypeError("Cannot read properties of null (reading 'status')");
      return calls < 3 ? 1000 : null;
    });
    runPollLoop({ tick, errorDelayMs: 2000, onError });
    await vi.advanceTimersByTimeAsync(0);
    expect(tick).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1999);
    expect(tick).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(tick).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1000);
    expect(tick).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(tick).toHaveBeenCalledTimes(3);
  });

  it("doubles the error delay up to the cap and resets after a good tick", async () => {
    const delays: number[] = [];
    let last = Date.now();
    let calls = 0;
    const tick = vi.fn(async () => {
      delays.push(Date.now() - last);
      last = Date.now();
      calls++;
      if (calls <= 4 || calls === 6) throw new Error("boom");
      return calls < 7 ? 500 : null;
    });
    runPollLoop({ tick, errorDelayMs: 1000, maxErrorDelayMs: 4000, onError: () => {} });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(delays).toEqual([0, 1000, 2000, 4000, 4000, 500, 1000]);
  });

  it("stop() cancels the next tick", async () => {
    const tick = vi.fn(async () => 1000);
    const stop = runPollLoop({ tick, errorDelayMs: 1000 });
    await vi.advanceTimersByTimeAsync(0);
    stop();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(tick).toHaveBeenCalledTimes(1);
  });

  it("a rejected status fetch keeps the loop alive until the job finishes", async () => {
    const health: JobHealth = new Map();
    const fetchStatus = vi
      .fn<(id: string) => Promise<JobStatusResponse>>()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(status("a", "done"));
    const pending = new Set(["a"]);
    const finished = vi.fn();
    runPollLoop({
      errorDelayMs: 1000,
      tick: async () => {
        const { picks } = pickDueJobs([...pending], health, Date.now(), 10, 0);
        const { fresh } = await fetchStatuses(picks, fetchStatus, health, { now: Date.now(), concurrency: 4 });
        for (const s of fresh) if (s.status === "done") pending.delete(s.job_id);
        if (pending.size === 0) {
          finished();
          return null;
        }
        return 500;
      },
    });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetchStatus).toHaveBeenCalledTimes(2);
    expect(finished).toHaveBeenCalledTimes(1);
  });
});

describe("fetchStatuses", () => {
  it("never throws: a failed job is counted and the others still update", async () => {
    const health: JobHealth = new Map();
    const fetchStatus = vi.fn(async (id: string) => {
      if (id === "a") throw new TypeError("Failed to fetch");
      return status(id, "processing");
    });
    const result = await fetchStatuses(["a", "b"], fetchStatus, health, { now: 0, concurrency: 2 });
    expect(result.fresh.map((s) => s.job_id)).toEqual(["b"]);
    expect(result.rateLimited).toBe(false);
    expect(health.get("a")).toEqual({ failures: 1, nextAttemptAt: statusRetryDelayMs(1) });
    expect(health.has("b")).toBe(false);
  });

  it("flags a 429 as rate limited", async () => {
    const health: JobHealth = new Map();
    const fetchStatus = vi.fn(async () => {
      throw new ImageOpzApiError("slow down", 429, null);
    });
    const result = await fetchStatuses(["a"], fetchStatus, health, { now: 0, concurrency: 1 });
    expect(result.rateLimited).toBe(true);
  });

  it("marks a job unavailable after N consecutive failures and clears it on success", async () => {
    const health: JobHealth = new Map();
    const failing = vi.fn(async () => {
      throw new ImageOpzApiError("bad gateway", 502, null);
    });
    let now = 0;
    for (let i = 1; i <= STATUS_UNAVAILABLE_AFTER; i++) {
      expect(isStatusUnavailable(health, "a")).toBe(false);
      await fetchStatuses(["a"], failing, health, { now, concurrency: 1 });
      now = health.get("a")!.nextAttemptAt;
    }
    expect(isStatusUnavailable(health, "a")).toBe(true);
    await fetchStatuses(["a"], async () => status("a", "processing"), health, { now, concurrency: 1 });
    expect(isStatusUnavailable(health, "a")).toBe(false);
    expect(health.has("a")).toBe(false);
  });
});

describe("pickDueJobs", () => {
  it("skips jobs still backing off and rotates through the rest", () => {
    const health: JobHealth = new Map([["b", { failures: 1, nextAttemptAt: 5000 }]]);
    const first = pickDueJobs(["a", "b", "c", "d"], health, 1000, 2, 0);
    expect(first.picks).toEqual(["a", "c"]);
    const second = pickDueJobs(["a", "b", "c", "d"], health, 1000, 2, first.cursor);
    expect(second.picks).toEqual(["d", "a"]);
    expect(pickDueJobs(["a", "b"], health, 5000, 5, 0).picks).toEqual(["a", "b"]);
  });

  it("per-job retry delay grows and is capped", () => {
    expect(statusRetryDelayMs(1)).toBe(2000);
    expect(statusRetryDelayMs(2)).toBe(4000);
    expect(statusRetryDelayMs(3)).toBe(8000);
    expect(statusRetryDelayMs(20)).toBe(30_000);
  });
});

describe("processing progress (progress is always null since server T-007)", () => {
  it("batchProgress counts completed files, ignoring progress values", () => {
    const statuses = {
      a: status("a", "done"),
      b: status("b", "processing", { progress: null }),
      c: status("c", "pending"),
      d: status("d", "rejected"),
    };
    expect(batchProgress(["a", "b", "c", "d", "e"], statuses)).toEqual({ completed: 2, total: 5, percent: 40 });
    expect(batchProgress(["b"], { b: status("b", "processing", { progress: 70 }) }).percent).toBe(0);
    expect(batchProgress([], {})).toEqual({ completed: 0, total: 0, percent: 0 });
  });

  it("jobPhase is an indeterminate state, never a percentage", () => {
    expect(jobPhase(status("a", "processing", { progress: null }), false)).toBe("processing");
    expect(jobPhase(status("a", "processing", { progress: 42 }), false)).toBe("processing");
    expect(jobPhase(status("a", "pending"), false)).toBe("queued");
    expect(jobPhase(undefined, false)).toBe("processing");
    expect(jobPhase(status("a", "done"), false)).toBe("done");
    expect(jobPhase(status("a", "failed"), true)).toBe("failed");
    expect(jobPhase(status("a", "rejected"), false)).toBe("rejected");
  });

  it("jobPhase reports unavailable for a job whose status keeps failing", () => {
    expect(jobPhase(status("a", "processing"), true)).toBe("unavailable");
    expect(jobPhase(undefined, true)).toBe("unavailable");
    expect(jobPhase(status("a", "done"), true)).toBe("done");
  });
});
