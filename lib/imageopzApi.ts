import { readConfig } from "./config";

export type JobStatusEnum = "uploading" | "pending" | "processing" | "done" | "failed" | "rejected";

export interface ErrorResponse {
  success?: boolean;
  error: string;
  message: string;
  details?: Record<string, unknown> | null;
}

export interface JobStatusResponse {
  job_id: string;
  status: JobStatusEnum;
  original_filename: string;
  original_size: number;
  optimized_size?: number | null;
  compression_ratio?: number | null;
  r2_url?: string | null;
  progress?: number | null;
  progress_status?: string | null;
  error_message?: string | null;
  rejection_reason?: string | null;
  created_at: string;
  expiry_date: string;
}

export interface LemonSqueezyCreateCheckoutRequest {
  email: string;
  session_id?: string | null;
  store_id?: string | null;
  variant_id?: string | null;
  redirect_url?: string | null;
  test_mode?: boolean | null;
}

export interface LemonSqueezyCreateCheckoutResponse {
  success?: boolean;
  checkout_id: string;
  checkout_url: string;
  ip_hash: string;
  session_id?: string | null;
  provider?: string;
}

export interface SessionRestoreRequest {
  email: string;
}

export interface SessionRestoreResponse {
  success?: boolean;
  session_id: string;
  pro_expiry_date: string;
}

export interface SessionMeResponse {
  success?: boolean;
  session_id: string;
  ip_hash: string;
  is_authenticated: boolean;
  supabase_user_id?: string | null;
  email?: string | null;
  is_pro: boolean;
  pro_expiry_date?: string | null;
  pro_verified: boolean;
  pro_source: "account" | "session" | "webhook_session" | "restore" | "unknown" | "none";
  needs_restore: boolean;
  // Newer backend versions may return activation hints for guest checkout bridging.
  activation_pending?: boolean;
  activation_retry_after_ms?: number | null;
  credits_used: number;
  free_tier_max_credits: number;
  credits_remaining: number;
  pro_tier_max_credits: number;
  pro_credits_used: number;
  pro_credits_remaining: number;
}

export function getApiBaseUrl() {
  const { apiBaseUrl, useViteProxy } = readConfig();
  const isDev = Boolean(import.meta.env.DEV);
  if (isDev) {
    const g = globalThis as any;
    if (!g.__imageopzApiBaseLogged) {
      g.__imageopzApiBaseLogged = true;
      console.log("[imageopz] API BASE:", useViteProxy ? "(dev proxy: /api -> backend)" : apiBaseUrl);
    }
  }
  if (isDev && useViteProxy) return "";
  return apiBaseUrl;
}

// The single credentials policy: "omit" when VITE_IMAGEOPZ_SEND_COOKIES is "false", otherwise "include".
export function apiCredentials(): RequestCredentials {
  return readConfig().sendCookies ? "include" : "omit";
}

// Every request to the ImageOpz API goes through here, so none can bypass the credentials policy.
export function apiFetch(path: string, init: Omit<RequestInit, "credentials">): Promise<Response> {
  return fetch(`${getApiBaseUrl()}${path}`, { ...init, credentials: apiCredentials() });
}

export async function readJson<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error(`Expected JSON response, got ${contentType || "unknown"}`);
  }
  return (await response.json()) as T;
}

export async function tryReadError(response: Response): Promise<ErrorResponse | null> {
  try {
    const data = await readJson<unknown>(response);
    if (
      data &&
      typeof data === "object" &&
      "error" in data &&
      "message" in data &&
      typeof (data as any).error === "string" &&
      typeof (data as any).message === "string"
    ) {
      return data as ErrorResponse;
    }
    return null;
  } catch {
    return null;
  }
}

export function buildAuthHeaders(params?: { sessionId?: string | null; accessToken?: string | null; json?: boolean }) {
  const headers: Record<string, string> = {};
  if (params?.json) headers["content-type"] = "application/json";
  if (params?.sessionId) headers["X-Session-Id"] = params.sessionId;
  if (params?.accessToken) headers["Authorization"] = `Bearer ${params.accessToken}`;
  return headers;
}

export class ImageOpzApiError extends Error {
  status: number;
  payload: ErrorResponse | null;

  constructor(message: string, status: number, payload: ErrorResponse | null) {
    super(message);
    this.name = "ImageOpzApiError";
    this.status = status;
    this.payload = payload;
  }
}

export async function getJobStatus(jobId: string, params?: { sessionId?: string | null }): Promise<JobStatusResponse> {
  const response = await apiFetch(`/api/v1/status/${encodeURIComponent(jobId)}`, {
    method: "GET",
    headers: buildAuthHeaders({ sessionId: params?.sessionId }),
  });

  if (!response.ok) {
    const payload = await tryReadError(response);
    throw new ImageOpzApiError(
      payload?.message || `Status request failed (${response.status})`,
      response.status,
      payload
    );
  }

  return await readJson<JobStatusResponse>(response);
}

// Optional endpoint on newer backends: pulls latest checkout/webhook activation into the current session.
export async function reconcileSession(params?: {
  sessionId?: string | null;
  accessToken?: string | null;
}): Promise<SessionMeResponse> {
  const response = await apiFetch("/api/v1/session/reconcile", {
    method: "POST",
    headers: buildAuthHeaders({ sessionId: params?.sessionId, accessToken: params?.accessToken }),
  });
  if (!response.ok) {
    const payload = await tryReadError(response);
    throw new ImageOpzApiError(
      payload?.message || `Reconcile request failed (${response.status})`,
      response.status,
      payload
    );
  }
  // Spec: 200 returns SessionMeResponse
  return await readJson<SessionMeResponse>(response);
}

export async function createLemonSqueezyCheckout(params: {
  email: string;
  sessionId?: string | null;
  accessToken?: string | null;
}): Promise<LemonSqueezyCreateCheckoutResponse> {
  const body: LemonSqueezyCreateCheckoutRequest = {
    email: params.email,
    session_id: params.sessionId ?? null,
  };

  const response = await apiFetch("/api/v1/checkout/lemonsqueezy", {
    method: "POST",
    headers: buildAuthHeaders({ sessionId: params.sessionId, accessToken: params.accessToken, json: true }),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const payload = await tryReadError(response);
    throw new ImageOpzApiError(
      payload?.message || `Checkout request failed (${response.status})`,
      response.status,
      payload
    );
  }

  // Spec: 201 w/ LemonSqueezyCreateCheckoutResponse
  return await readJson<LemonSqueezyCreateCheckoutResponse>(response);
}

export async function restoreProSession(params: {
  email: string;
  sessionId?: string | null;
  accessToken?: string | null;
}): Promise<SessionRestoreResponse> {
  const body: SessionRestoreRequest = { email: params.email };

  const response = await apiFetch("/api/v1/session/restore", {
    method: "POST",
    headers: buildAuthHeaders({ sessionId: params.sessionId, accessToken: params.accessToken, json: true }),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const payload = await tryReadError(response);
    throw new ImageOpzApiError(
      payload?.message || `Restore request failed (${response.status})`,
      response.status,
      payload
    );
  }

  return await readJson<SessionRestoreResponse>(response);
}

export async function getSessionMe(params?: {
  sessionId?: string | null;
  accessToken?: string | null;
}): Promise<SessionMeResponse> {
  const response = await apiFetch("/api/v1/session/me", {
    method: "GET",
    headers: buildAuthHeaders({ sessionId: params?.sessionId, accessToken: params?.accessToken }),
  });

  if (!response.ok) {
    const payload = await tryReadError(response);
    throw new ImageOpzApiError(
      payload?.message || `Session me request failed (${response.status})`,
      response.status,
      payload
    );
  }

  return await readJson<SessionMeResponse>(response);
}

export interface SessionLogoutResponse {
  success?: boolean;
  session_id: string;
}

export async function logoutSession(params?: { sessionId?: string | null }): Promise<SessionLogoutResponse> {
  const response = await apiFetch("/api/v1/session/logout", {
    method: "POST",
    headers: buildAuthHeaders({ sessionId: params?.sessionId }),
  });

  if (!response.ok) {
    const payload = await tryReadError(response);
    throw new ImageOpzApiError(
      payload?.message || `Logout request failed (${response.status})`,
      response.status,
      payload
    );
  }

  return await readJson<SessionLogoutResponse>(response);
}
