import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_ID_KEY, getOrCreateSessionId, logoutAndRotateSession, storeSessionId, type SessionStorage } from "./session";

const API = "https://api.test";

function memoryStorage(initial: Record<string, string> = {}): SessionStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubEnv("VITE_IMAGEOPZ_API_BASE_URL", API);
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("session id persistence", () => {
  it("creates an id once and reuses it", () => {
    const storage = memoryStorage();
    const id = getOrCreateSessionId(storage);
    expect(id).toBeTruthy();
    expect(storage.data[SESSION_ID_KEY]).toBe(id);
    expect(getOrCreateSessionId(storage)).toBe(id);
  });

  it("returns the stored id", () => {
    expect(getOrCreateSessionId(memoryStorage({ [SESSION_ID_KEY]: "kept" }))).toBe("kept");
  });

  it("still returns an id when storage throws", () => {
    const broken: SessionStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(getOrCreateSessionId(broken)).toBeTruthy();
    expect(() => storeSessionId("x", broken)).not.toThrow();
  });
});

describe("logoutAndRotateSession", () => {
  function ok(body: unknown) {
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  }

  it("sends the current id as X-Session-Id without cookies and stores the server's new id", async () => {
    vi.stubEnv("VITE_IMAGEOPZ_SEND_COOKIES", "false");
    fetchMock.mockResolvedValue(ok({ session_id: "sid-new" }));
    const storage = memoryStorage({ [SESSION_ID_KEY]: "sid-old" });

    await expect(logoutAndRotateSession("sid-old", storage)).resolves.toBe("sid-new");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API}/api/v1/session/logout`);
    expect(init.credentials).toBe("omit");
    expect(init.headers["X-Session-Id"]).toBe("sid-old");
    expect(storage.data[SESSION_ID_KEY]).toBe("sid-new");
  });

  it("with cookies off, clears the local id even when the logout request fails", async () => {
    vi.stubEnv("VITE_IMAGEOPZ_SEND_COOKIES", "false");
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const storage = memoryStorage({ [SESSION_ID_KEY]: "sid-old" });

    const next = await logoutAndRotateSession("sid-old", storage);

    expect(next).toBeTruthy();
    expect(next).not.toBe("sid-old");
    expect(storage.data[SESSION_ID_KEY]).toBe(next);
  });

  it("with cookies on, a failed logout throws and keeps the id (the cookie still names the old session)", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 500 }));
    const storage = memoryStorage({ [SESSION_ID_KEY]: "sid-old" });

    await expect(logoutAndRotateSession("sid-old", storage)).rejects.toThrow();
    expect(storage.data[SESSION_ID_KEY]).toBe("sid-old");
  });
});
