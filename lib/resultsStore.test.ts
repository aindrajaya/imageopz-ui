import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadStoredResults, saveResultBatch } from "./resultsStore";

const KEY = "imageopz_results_v1";
let store: Map<string, string>;

beforeEach(() => {
  store = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const future = "2999-01-01T00:00:00Z";

describe("local results history", () => {
  it("stores job ids and file details, never a download URL", () => {
    saveResultBatch({
      session_id: "sid",
      created_at: "2026-10-17T00:00:00Z",
      expires_at: future,
      items: [{ job_id: "a", filename: "a.jpg", url: "https://r2.test/a?X-Amz-Signature=s", original_size: 10 } as never],
    });
    const raw = store.get(KEY) ?? "";
    expect(raw).toContain('"job_id":"a"');
    expect(raw).not.toContain("r2.test");
    expect(raw).not.toContain('"url"');
  });

  it("drops URLs left by older versions and rewrites storage", () => {
    store.set(
      KEY,
      JSON.stringify([
        {
          id: "sid:t",
          session_id: "sid",
          created_at: "2026-10-16T00:00:00Z",
          expires_at: future,
          items: [{ job_id: "a", filename: "a.jpg", url: "https://r2.test/a?old" }],
        },
      ])
    );
    const batches = loadStoredResults();
    expect(batches[0].items[0]).toEqual({ job_id: "a", filename: "a.jpg" });
    expect(store.get(KEY)).not.toContain("r2.test");
  });
});
