import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createLemonSqueezyCheckout,
  getJobStatus,
  getSessionMe,
  logoutSession,
  reconcileSession,
  restoreProSession,
} from "./imageopzApi";
import { completeUploads, presignUploads } from "./uploads";

const API = "https://api.test";
const SID = "sid-123";

type Call = { url: string; init: RequestInit };
let calls: Call[] = [];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

beforeEach(() => {
  calls = [];
  vi.stubEnv("VITE_IMAGEOPZ_API_BASE_URL", API);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      if (url.endsWith("/uploads/presign")) return jsonResponse({ files: [], complete_by: "" }, 201);
      if (url.endsWith("/uploads/complete")) return jsonResponse({ jobs: [] });
      return jsonResponse({ session_id: "sid-new", checkout_id: "c", checkout_url: "u", ip_hash: "h" });
    })
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

// Every API call the UI makes, invoked with the same session id.
const API_CALLS: Array<[string, () => Promise<unknown>]> = [
  ["status", () => getJobStatus("job-1", { sessionId: SID })],
  ["session/me", () => getSessionMe({ sessionId: SID })],
  ["session/reconcile", () => reconcileSession({ sessionId: SID })],
  ["session/restore", () => restoreProSession({ email: "a@b.c", sessionId: SID })],
  ["session/logout", () => logoutSession({ sessionId: SID })],
  ["checkout", () => createLemonSqueezyCheckout({ email: "a@b.c", sessionId: SID })],
  ["uploads/presign", () => presignUploads([{ name: "a.png", size: 1, type: "image/png" }], { sessionId: SID })],
  ["uploads/complete", () => completeUploads(["job-1"], { sessionId: SID })],
];

describe("credentials policy", () => {
  it("logoutSession omits cookies when VITE_IMAGEOPZ_SEND_COOKIES=false", async () => {
    vi.stubEnv("VITE_IMAGEOPZ_SEND_COOKIES", "false");
    await logoutSession({ sessionId: SID });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`${API}/api/v1/session/logout`);
    expect(calls[0].init.credentials).toBe("omit");
  });

  it.each(API_CALLS)("%s omits cookies and sends X-Session-Id in header-only mode", async (_name, call) => {
    vi.stubEnv("VITE_IMAGEOPZ_SEND_COOKIES", "false");
    await call();
    expect(calls).toHaveLength(1);
    expect(calls[0].url.startsWith(`${API}/api/v1/`)).toBe(true);
    expect(calls[0].init.credentials).toBe("omit");
    expect((calls[0].init.headers as Record<string, string>)["X-Session-Id"]).toBe(SID);
  });

  it.each(API_CALLS)("%s includes cookies when the flag is unset or not \"false\"", async (_name, call) => {
    await call();
    vi.stubEnv("VITE_IMAGEOPZ_SEND_COOKIES", "true");
    await call();
    vi.stubEnv("VITE_IMAGEOPZ_SEND_COOKIES", "yes");
    await call();
    expect(calls.map((c) => c.init.credentials)).toEqual(["include", "include", "include"]);
  });
});

// Source guard: only apiFetch in lib/imageopzApi.ts may call fetch or set `credentials`, so no API call can bypass the policy.
describe("no API call sets credentials directly", () => {
  const ROOT = path.resolve(__dirname, "..");
  const DIRS = ["lib", "src", "components", "context"];

  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) return sourceFiles(full);
      return /\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name) ? [full] : [];
    });
  }

  function filesMatching(pattern: RegExp) {
    return DIRS.flatMap((d) => sourceFiles(path.join(ROOT, d)))
      .filter((f) => pattern.test(readFileSync(f, "utf8")))
      .map((f) => path.relative(ROOT, f));
  }

  it("only lib/imageopzApi.ts sets credentials or calls fetch", () => {
    expect(filesMatching(/credentials\s*:/)).toEqual(["lib/imageopzApi.ts"]);
    expect(filesMatching(/\bfetch\s*\(/)).toEqual(["lib/imageopzApi.ts"]);
    const api = readFileSync(path.join(ROOT, "lib/imageopzApi.ts"), "utf8");
    expect(api.match(/credentials\s*:/g)).toHaveLength(1);
    expect(api.match(/\bfetch\s*\(/g)).toHaveLength(1);
  });

  it("XMLHttpRequest is used only for the credential-less R2 PUT", () => {
    expect(filesMatching(/XMLHttpRequest\s*\(/)).toEqual(["lib/uploads.ts"]);
    expect(readFileSync(path.join(ROOT, "lib/uploads.ts"), "utf8")).toContain("xhr.withCredentials = false");
  });
});
