import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aggregateProgress, classifyStartError, parseUtc, uploadBatch, type UploadItem, type UploadProgress } from "./uploads";
import { ImageOpzApiError } from "./imageopzApi";
import { FREE_LIMITS, PRO_LIMITS, isAcceptedImage } from "./uploadLimits";

const API = "https://api.test";
const FUTURE = "2999-01-01T00:00:00";

type XhrOutcome = { status: number; body?: string } | "network" | "hang";

// Minimal XMLHttpRequest double: records requests and answers through `respond`.
class FakeXHR {
  static instances: FakeXHR[] = [];
  static inFlight = 0;
  static maxInFlight = 0;
  static respond: (xhr: FakeXHR) => XhrOutcome = () => ({ status: 200 });

  method = "";
  url = "";
  headers: Record<string, string> = {};
  body: unknown = null;
  withCredentials = true;
  status = 0;
  responseText = "";
  aborted = false;
  upload: { onprogress: ((e: { loaded: number; total: number; lengthComputable: boolean }) => void) | null } = {
    onprogress: null,
  };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  onabort: (() => void) | null = null;
  private settled = false;

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }
  send(body: unknown) {
    this.body = body;
    FakeXHR.instances.push(this);
    FakeXHR.inFlight++;
    FakeXHR.maxInFlight = Math.max(FakeXHR.maxInFlight, FakeXHR.inFlight);
    const outcome = FakeXHR.respond(this);
    if (outcome === "hang") return;
    setTimeout(() => {
      if (this.settled) return;
      const size = (body as Blob).size;
      this.upload.onprogress?.({ loaded: Math.floor(size / 2), total: size, lengthComputable: true });
      this.finish();
      if (outcome === "network") return this.onerror?.();
      this.status = outcome.status;
      this.responseText = outcome.body ?? "";
      this.onload?.();
    }, 2);
  }
  abort() {
    if (this.settled) return;
    this.aborted = true;
    this.finish();
    this.onabort?.();
  }
  private finish() {
    this.settled = true;
    FakeXHR.inFlight--;
  }
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function makeFiles(count: number, size = 1000): File[] {
  return Array.from({ length: count }, (_, i) => new File([new Uint8Array(size)], `img-${i}.jpg`, { type: "image/jpeg" }));
}

function presignBody(count: number, expiresAt = FUTURE) {
  return {
    files: Array.from({ length: count }, (_, i) => ({
      job_id: `job-${i}`,
      object_key: `uploads/job-${i}`,
      upload_url: `https://r2.test/uploads/job-${i}?X-Amz-Signature=sig`,
      method: "PUT",
      headers: { "Content-Type": "image/jpeg" },
      expires_at: expiresAt,
    })),
    complete_by: FUTURE,
  };
}

function pendingFor(ids: string[]) {
  return { jobs: ids.map((job_id) => ({ job_id, status: "pending", reason: null })) };
}

type FetchCall = { url: string; init: RequestInit; body: any };
let calls: FetchCall[];
let completeHandler: (ids: string[], n: number) => Response;
let presignHandler: (body: any) => Response;

function completeCalls() {
  return calls.filter((c) => c.url.endsWith("/api/v1/uploads/complete"));
}

beforeEach(() => {
  vi.stubEnv("VITE_IMAGEOPZ_API_BASE_URL", API);
  vi.stubEnv("VITE_IMAGEOPZ_USE_VITE_PROXY", "false");
  vi.spyOn(console, "log").mockImplementation(() => {});
  FakeXHR.instances = [];
  FakeXHR.inFlight = 0;
  FakeXHR.maxInFlight = 0;
  FakeXHR.respond = () => ({ status: 200 });
  vi.stubGlobal("XMLHttpRequest", FakeXHR);
  calls = [];
  presignHandler = (body) => jsonResponse(201, presignBody(body.files.length));
  completeHandler = (ids) => jsonResponse(200, pendingFor(ids));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      const body = init.body ? JSON.parse(init.body as string) : null;
      calls.push({ url, init, body });
      if (url.endsWith("/api/v1/uploads/presign")) return presignHandler(body);
      if (url.endsWith("/api/v1/uploads/complete")) return completeHandler(body.job_ids, completeCalls().length);
      throw new Error(`unexpected fetch ${url}`);
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const noSleep = async () => {};
const identity = { sessionId: "sid-1", accessToken: "jwt-1" };

describe("request shapes", () => {
  it("presign, PUT and complete match the contract", async () => {
    const files = makeFiles(2, 1234);
    const result = await uploadBatch(files, { identity, sleep: noSleep });

    const presign = calls[0];
    expect(presign.url).toBe(`${API}/api/v1/uploads/presign`);
    expect(presign.init.method).toBe("POST");
    expect(presign.init.credentials).toBe("include");
    expect(presign.init.headers).toEqual({
      "content-type": "application/json",
      "X-Session-Id": "sid-1",
      Authorization: "Bearer jwt-1",
    });
    expect(presign.body).toEqual({
      files: [
        { name: "img-0.jpg", size: 1234, content_type: "image/jpeg" },
        { name: "img-1.jpg", size: 1234, content_type: "image/jpeg" },
      ],
    });
    expect(presign.body).not.toHaveProperty("auth_token");

    expect(FakeXHR.instances).toHaveLength(2);
    for (const [i, xhr] of FakeXHR.instances.entries()) {
      expect(xhr.method).toBe("PUT");
      expect(xhr.url).toBe(`https://r2.test/uploads/job-${i}?X-Amz-Signature=sig`);
      expect(xhr.headers).toEqual({ "Content-Type": "image/jpeg" });
      expect(xhr.withCredentials).toBe(false);
      expect(xhr.body).toBe(files[i]);
    }

    const complete = completeCalls();
    expect(complete).toHaveLength(1);
    expect(complete[0].url).toBe(`${API}/api/v1/uploads/complete`);
    expect(complete[0].init.method).toBe("POST");
    expect(complete[0].init.headers).toEqual(presign.init.headers);
    expect(complete[0].body).toEqual({ job_ids: ["job-0", "job-1"] });

    expect(result.aborted).toBe(false);
    expect(result.acceptedJobIds).toEqual(["job-0", "job-1"]);
    expect(result.items.map((i) => i.state)).toEqual(["processing", "processing"]);
  });

  it("omits credentials when VITE_IMAGEOPZ_SEND_COOKIES is false and the bearer when there is no token", async () => {
    vi.stubEnv("VITE_IMAGEOPZ_SEND_COOKIES", "false");
    await uploadBatch(makeFiles(1), { identity: { sessionId: "sid-1", accessToken: null }, sleep: noSleep });
    for (const call of calls) {
      expect(call.init.credentials).toBe("omit");
      expect(call.init.headers).toEqual({ "content-type": "application/json", "X-Session-Id": "sid-1" });
    }
  });

  it("does not forward a Content-Length header to the PUT", async () => {
    presignHandler = (body) => {
      const res = presignBody(body.files.length);
      res.files[0].headers = { "Content-Type": "image/jpeg", "Content-Length": "1000" } as any;
      return jsonResponse(201, res);
    };
    await uploadBatch(makeFiles(1), { identity, sleep: noSleep });
    expect(FakeXHR.instances[0].headers).toEqual({ "Content-Type": "image/jpeg" });
  });

  it("surfaces presign errors as ImageOpzApiError without any PUT", async () => {
    presignHandler = () =>
      jsonResponse(413, { success: false, error: "FILE_TOO_LARGE", message: "File too large", details: null });
    await expect(uploadBatch(makeFiles(1), { identity, sleep: noSleep })).rejects.toMatchObject({
      name: "ImageOpzApiError",
      status: 413,
      payload: { error: "FILE_TOO_LARGE" },
    });
    expect(FakeXHR.instances).toHaveLength(0);
  });
});

describe("orchestrator", () => {
  it("caps concurrent PUTs at 4 by default", async () => {
    await uploadBatch(makeFiles(10), { identity, sleep: noSleep });
    expect(FakeXHR.instances).toHaveLength(10);
    expect(FakeXHR.maxInFlight).toBe(4);
  });

  it("honours a custom concurrency", async () => {
    await uploadBatch(makeFiles(5), { identity, concurrency: 2, sleep: noSleep });
    expect(FakeXHR.maxInFlight).toBe(2);
  });

  it("aggregates byte progress across files", async () => {
    const seen: UploadProgress[] = [];
    await uploadBatch(makeFiles(2, 1000), { identity, concurrency: 1, sleep: noSleep, onProgress: (p) => seen.push(p) });
    expect(seen.every((p) => p.total === 2000)).toBe(true);
    const loaded = seen.map((p) => p.loaded);
    expect(loaded).toContain(500); // first file half sent
    expect(loaded).toContain(1500); // first done, second half sent
    expect(loaded.every((v, i) => i === 0 || v >= loaded[i - 1])).toBe(true);
    expect(seen.at(-1)).toMatchObject({ loaded: 2000, percent: 100 });
  });

  it("aggregateProgress counts settled files as complete", () => {
    const items: Pick<UploadItem, "size" | "loaded" | "state">[] = [
      { size: 100, loaded: 50, state: "uploading" },
      { size: 100, loaded: 0, state: "queued" },
      { size: 200, loaded: 0, state: "failed" },
    ];
    expect(aggregateProgress(items)).toEqual({ loaded: 250, total: 400, percent: 62.5 });
    expect(aggregateProgress([])).toEqual({ loaded: 0, total: 0, percent: 0 });
  });

  it("abort stops in-flight PUTs, never starts queued ones and skips /complete", async () => {
    FakeXHR.respond = () => "hang";
    const controller = new AbortController();
    const done = uploadBatch(makeFiles(6), { identity, signal: controller.signal, sleep: noSleep });
    await vi.waitFor(() => expect(FakeXHR.instances).toHaveLength(4));
    controller.abort();
    const result = await done;

    expect(result.aborted).toBe(true);
    expect(result.acceptedJobIds).toEqual([]);
    expect(FakeXHR.instances).toHaveLength(4);
    expect(FakeXHR.instances.every((x) => x.aborted)).toBe(true);
    expect(completeCalls()).toHaveLength(0);
    expect(result.items.every((i) => i.state === "failed" && i.failure === "cancelled")).toBe(true);
  });

  it("skips /complete for files uploaded before an abort", async () => {
    const controller = new AbortController();
    FakeXHR.respond = (xhr) => (xhr.url.includes("job-0") ? { status: 200 } : "hang");
    const done = uploadBatch(makeFiles(2), { identity, signal: controller.signal, sleep: noSleep });
    await vi.waitFor(() => expect(FakeXHR.instances[0]?.status).toBe(200));
    controller.abort();
    const result = await done;
    expect(result.aborted).toBe(true);
    expect(completeCalls()).toHaveLength(0);
  });
});

describe("PUT retry policy", () => {
  it("retries 5xx and network errors with backoff, then completes", async () => {
    const attempts: Record<string, number> = {};
    FakeXHR.respond = (xhr) => {
      const n = (attempts[xhr.url] = (attempts[xhr.url] ?? 0) + 1);
      if (xhr.url.includes("job-0")) return n === 1 ? { status: 503 } : { status: 200 };
      return n === 1 ? "network" : { status: 200 };
    };
    const sleeps: number[] = [];
    const result = await uploadBatch(makeFiles(2), {
      identity,
      backoffMs: 100,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });
    expect(FakeXHR.instances).toHaveLength(4);
    expect(sleeps).toEqual([100, 100]);
    expect(completeCalls()[0].body).toEqual({ job_ids: ["job-0", "job-1"] });
    expect(result.acceptedJobIds).toEqual(["job-0", "job-1"]);
  });

  it("never retries a 403 and leaves the job out of /complete", async () => {
    FakeXHR.respond = (xhr) =>
      xhr.url.includes("job-0")
        ? { status: 403, body: "<Error><Code>SignatureDoesNotMatch</Code></Error>" }
        : { status: 200 };
    const result = await uploadBatch(makeFiles(2), { identity, sleep: noSleep });
    expect(FakeXHR.instances.filter((x) => x.url.includes("job-0"))).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ state: "failed", failure: "put_forbidden" });
    expect(completeCalls()[0].body).toEqual({ job_ids: ["job-1"] });
  });

  it("maps a 403 ExpiredRequest to url_expired without retrying", async () => {
    FakeXHR.respond = () => ({ status: 403, body: "<Error><Code>ExpiredRequest</Code></Error>" });
    const result = await uploadBatch(makeFiles(1), { identity, sleep: noSleep });
    expect(FakeXHR.instances).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ state: "failed", failure: "url_expired" });
    expect(completeCalls()).toHaveLength(0);
  });

  it("gives up after maxPutAttempts", async () => {
    FakeXHR.respond = () => ({ status: 500 });
    const result = await uploadBatch(makeFiles(1), { identity, maxPutAttempts: 3, sleep: noSleep });
    expect(FakeXHR.instances).toHaveLength(3);
    expect(result.items[0]).toMatchObject({ state: "failed", failure: "put_failed" });
    expect(completeCalls()).toHaveLength(0);
  });

  it("stops retrying once the presigned URL has expired", async () => {
    presignHandler = (body) => jsonResponse(201, presignBody(body.files.length, "2026-10-15T09:15:00"));
    FakeXHR.respond = () => ({ status: 502 });
    const result = await uploadBatch(makeFiles(1), {
      identity,
      sleep: noSleep,
      now: () => parseUtc("2026-10-15T09:16:00"),
    });
    expect(FakeXHR.instances).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ state: "failed", failure: "url_expired" });
  });
});

describe("/complete", () => {
  it("on a partial 503 retries only the jobs still uploading", async () => {
    completeHandler = (ids, n) => {
      if (n === 1) {
        return jsonResponse(503, {
          success: false,
          error: "QUEUE_UNAVAILABLE",
          message: "Queue unavailable",
          details: {
            jobs: [
              { job_id: "job-0", status: "pending", reason: null },
              { job_id: "job-1", status: "uploading", reason: null },
              { job_id: "job-2", status: "rejected", reason: "missing" },
            ],
          },
        });
      }
      return jsonResponse(200, pendingFor(ids));
    };
    const sleeps: number[] = [];
    const result = await uploadBatch(makeFiles(3), {
      identity,
      backoffMs: 50,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });
    const complete = completeCalls();
    expect(complete.map((c) => c.body.job_ids)).toEqual([["job-0", "job-1", "job-2"], ["job-1"]]);
    expect(sleeps).toEqual([50]);
    expect(result.items.map((i) => [i.state, i.reason])).toEqual([
      ["processing", null],
      ["processing", null],
      ["rejected", "missing"],
    ]);
    expect(result.acceptedJobIds).toEqual(["job-0", "job-1"]);
  });

  it("retries all ids on a 503 without a job list and on network errors", async () => {
    completeHandler = (ids, n) => {
      if (n === 1) return jsonResponse(503, { success: false, error: "UPLOADS_UNAVAILABLE", message: "x", details: null });
      if (n === 2) throw new TypeError("Failed to fetch");
      return jsonResponse(200, pendingFor(ids));
    };
    const result = await uploadBatch(makeFiles(2), { identity, sleep: noSleep });
    expect(completeCalls().map((c) => c.body.job_ids)).toEqual([
      ["job-0", "job-1"],
      ["job-0", "job-1"],
      ["job-0", "job-1"],
    ]);
    expect(result.acceptedJobIds).toEqual(["job-0", "job-1"]);
  });

  it("drops JOB_NOT_FOUND ids and retries the rest", async () => {
    completeHandler = (ids, n) =>
      n === 1
        ? jsonResponse(404, { success: false, error: "JOB_NOT_FOUND", message: "x", details: { job_ids: ["job-1"] } })
        : jsonResponse(200, pendingFor(ids));
    const result = await uploadBatch(makeFiles(2), { identity, sleep: noSleep });
    expect(completeCalls().map((c) => c.body.job_ids)).toEqual([["job-0", "job-1"], ["job-0"]]);
    expect(result.items[1]).toMatchObject({ state: "failed", failure: "job_not_found" });
    expect(result.acceptedJobIds).toEqual(["job-0"]);
  });

  it("does not retry a 4xx and marks the jobs complete_failed", async () => {
    completeHandler = () => jsonResponse(400, { success: false, error: "TOO_MANY_JOBS", message: "x", details: null });
    const result = await uploadBatch(makeFiles(2), { identity, sleep: noSleep });
    expect(completeCalls()).toHaveLength(1);
    expect(result.items.every((i) => i.state === "failed" && i.failure === "complete_failed")).toBe(true);
  });

  it("gives up after maxCompleteAttempts", async () => {
    completeHandler = () => jsonResponse(502, { success: false, error: "BAD_GATEWAY", message: "x", details: null });
    const result = await uploadBatch(makeFiles(1), { identity, maxCompleteAttempts: 3, sleep: noSleep });
    expect(completeCalls()).toHaveLength(3);
    expect(result.items[0]).toMatchObject({ state: "failed", failure: "complete_failed" });
    expect(result.acceptedJobIds).toEqual([]);
  });

  it("is not called when every PUT failed", async () => {
    FakeXHR.respond = () => ({ status: 403 });
    await uploadBatch(makeFiles(3), { identity, sleep: noSleep });
    expect(completeCalls()).toHaveLength(0);
  });

  it("reports rejected reasons from a 200", async () => {
    completeHandler = () =>
      jsonResponse(200, {
        jobs: [
          { job_id: "job-0", status: "pending", reason: null },
          { job_id: "job-1", status: "rejected", reason: "invalid_image" },
        ],
      });
    const result = await uploadBatch(makeFiles(2), { identity, sleep: noSleep });
    expect(result.items[1]).toMatchObject({ state: "rejected", reason: "invalid_image" });
    expect(result.acceptedJobIds).toEqual(["job-0"]);
  });
});

describe("limits", () => {
  it("matches the backend tiers", () => {
    expect(FREE_LIMITS).toEqual({ maxBytes: 10 * 1024 * 1024, maxFiles: 3 });
    expect(PRO_LIMITS).toEqual({ maxBytes: 50 * 1024 * 1024, maxFiles: 30 });
  });

  it("checks type, extension and tier size", () => {
    const f = (name: string, size: number, type = "image/jpeg") => ({ name, size, type });
    expect(isAcceptedImage(f("a.jpg", 1), false)).toBe(true);
    expect(isAcceptedImage(f("a.JPEG", 1), false)).toBe(true);
    expect(isAcceptedImage(f("a.png", 1), false)).toBe(false);
    expect(isAcceptedImage(f("a", 1), false)).toBe(false);
    expect(isAcceptedImage(f("a.gif", 1, "image/gif"), true)).toBe(false);
    expect(isAcceptedImage(f("a.jpg", 0), true)).toBe(false);
    expect(isAcceptedImage(f("a.jpg", 30 * 1024 * 1024), false)).toBe(false);
    expect(isAcceptedImage(f("a.jpg", 50 * 1024 * 1024), true)).toBe(true);
    expect(isAcceptedImage(f("a.jpg", 50 * 1024 * 1024 + 1), true)).toBe(false);
  });
});

describe("classifyStartError", () => {
  const apiError = (status: number, error: string, details: Record<string, unknown> | null = null) =>
    new ImageOpzApiError(error, status, { success: false, error, message: `${error} message`, details } as never);

  it("sends a free user out of credits to the upgrade prompt", () => {
    expect(classifyStartError(apiError(429, "QUOTA_EXCEEDED"), false)).toEqual({ kind: "quota_exceeded" });
  });

  it("keeps ACTIVATION_PENDING on the activation bridge with retry_after_ms", () => {
    expect(classifyStartError(apiError(429, "ACTIVATION_PENDING", { retry_after_ms: 1500 }), false)).toEqual({
      kind: "activation_pending",
      retryAfterMs: 1500,
    });
    expect(classifyStartError(apiError(429, "ACTIVATION_PENDING"), false)).toEqual({
      kind: "activation_pending",
      retryAfterMs: null,
    });
  });

  it("sends a Pro user whose credits ran out or whose Pro expired to the renew prompt", () => {
    expect(classifyStartError(apiError(429, "QUOTA_EXCEEDED"), true)).toEqual({ kind: "renew_pro" });
  });

  it("shows the server message for other errors and unknown 429s", () => {
    expect(classifyStartError(apiError(429, "RATE_LIMITED"), true)).toEqual({
      kind: "error",
      message: "RATE_LIMITED message",
    });
    expect(classifyStartError(apiError(429, "RATE_LIMITED"), false)).toEqual({
      kind: "error",
      message: "RATE_LIMITED message",
    });
    expect(classifyStartError(apiError(503, "UPLOADS_UNAVAILABLE"), false)).toEqual({
      kind: "error",
      message: "UPLOADS_UNAVAILABLE message",
    });
    expect(classifyStartError(new TypeError("Failed to fetch"), false)).toEqual({ kind: "error", message: null });
  });
});
