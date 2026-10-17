// Anonymous session identity. The UI owns the id: it is persisted in localStorage and sent as X-Session-Id on every
// API call, because in header-only mode (cross-site run.app API) the browser never sends the session cookie.
import { readConfig } from "./config";
import { logoutSession } from "./imageopzApi";

export const SESSION_ID_KEY = "imageopz_session_id";

export type SessionStorage = Pick<Storage, "getItem" | "setItem">;

function browserStorage(): SessionStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function newSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // Very old browsers: fallback to a non-uuid unique-ish value.
  return `sid_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function storeSessionId(id: string, storage: SessionStorage | null = browserStorage()) {
  try {
    storage?.setItem(SESSION_ID_KEY, id);
  } catch {
    // ignore: the id still lives in memory for this tab
  }
}

export function getOrCreateSessionId(storage: SessionStorage | null = browserStorage()): string {
  try {
    const existing = storage?.getItem(SESSION_ID_KEY);
    if (existing) return existing;
  } catch {
    // ignore
  }
  const id = newSessionId();
  storeSessionId(id, storage);
  return id;
}

// Logs the current session out and persists the next id. The server answers with a fresh session id.
// Header-only mode: the session is only the id we send, so a failed request still logs out locally.
// Cookie mode: a failure rethrows and keeps the id, since the cookie would still name the old session.
export async function logoutAndRotateSession(
  sessionId: string | null,
  storage: SessionStorage | null = browserStorage()
): Promise<string> {
  let next: string;
  try {
    next = (await logoutSession({ sessionId })).session_id || newSessionId();
  } catch (err) {
    if (readConfig().sendCookies) throw err;
    next = newSessionId();
  }
  storeSessionId(next, storage);
  return next;
}
