export type JobStatusEnum = "pending" | "processing" | "done" | "failed";

export interface OptimizationResultResponse {
  job_id: string;
  filename: string;
  status?: JobStatusEnum;
}

export interface BulkOptimizeResponse {
  success?: boolean;
  results: OptimizationResultResponse[];
  message: string;
}

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

function getApiBaseUrl() {
  const isDev = Boolean(import.meta.env.DEV);
  const useProxyInDev = (import.meta.env.VITE_IMAGEOPZ_USE_VITE_PROXY as unknown as string | undefined) === "true";
  // Use direct property access so Vite can statically replace it at build time.
  const base = import.meta.env.VITE_IMAGEOPZ_API_BASE_URL as unknown as string | undefined;
  if (isDev) {
    const g = globalThis as any;
    if (!g.__imageopzApiBaseLogged) {
      g.__imageopzApiBaseLogged = true;
      console.log(
        "[imageopz] API BASE:",
        useProxyInDev ? "(dev proxy: /api -> backend)" : (typeof base === "string" ? base : String(base))
      );
    }
  }
  if (isDev && useProxyInDev) return "";
  if (typeof base === "string" && base.trim().length > 0) {
    return base.replace(/\/+$/, "");
  }
  return "";
}

async function readJson<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error(`Expected JSON response, got ${contentType || "unknown"}`);
  }
  return (await response.json()) as T;
}

async function tryReadError(response: Response): Promise<ErrorResponse | null> {
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

function shouldSendCookies() {
  const raw = import.meta.env.VITE_IMAGEOPZ_SEND_COOKIES as unknown as string | undefined;
  if (!raw) return true;
  return raw === "true";
}

function buildAuthHeaders(params?: { sessionId?: string | null; accessToken?: string | null; json?: boolean }) {
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

export async function optimizeImages(params: {
  images: File[];
  sessionId?: string | null;
  accessToken?: string | null;
}): Promise<BulkOptimizeResponse> {
  const apiBaseUrl = getApiBaseUrl();
  if (import.meta.env.DEV && (!apiBaseUrl || apiBaseUrl.trim().length === 0)) {
    console.warn("[imageopz] API base URL is empty; requests will go to same-origin.");
  }
  const form = new FormData();
  for (const image of params.images) form.append("images", image);
  // Backend supports session id via header/cookie; keep a form-field fallback for older clients.
  if (params.sessionId) form.append("session_id", params.sessionId);

  const response = await fetch(`${apiBaseUrl}/api/v1/optimize`, {
    method: "POST",
    headers: buildAuthHeaders({ sessionId: params.sessionId, accessToken: params.accessToken }),
    credentials: shouldSendCookies() ? "include" : "omit",
    body: form,
  });

  if (!response.ok) {
    const payload = await tryReadError(response);
    throw new ImageOpzApiError(
      payload?.message || `Optimize request failed (${response.status})`,
      response.status,
      payload
    );
  }

  // Spec: 202 w/ BulkOptimizeResponse
  return await readJson<BulkOptimizeResponse>(response);
}

export async function getJobStatus(jobId: string, params?: { sessionId?: string | null }): Promise<JobStatusResponse> {
  const apiBaseUrl = getApiBaseUrl();
  const response = await fetch(
    `${apiBaseUrl}/api/v1/status/${encodeURIComponent(jobId)}`,
    {
      method: "GET",
      credentials: shouldSendCookies() ? "include" : "omit",
      headers: buildAuthHeaders({ sessionId: params?.sessionId }),
    }
  );

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
  const apiBaseUrl = getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/v1/session/reconcile`, {
    method: "POST",
    headers: buildAuthHeaders({ sessionId: params?.sessionId, accessToken: params?.accessToken }),
    credentials: shouldSendCookies() ? "include" : "omit",
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
  const apiBaseUrl = getApiBaseUrl();
  const body: LemonSqueezyCreateCheckoutRequest = {
    email: params.email,
    session_id: params.sessionId ?? null,
  };

  const response = await fetch(`${apiBaseUrl}/api/v1/checkout/lemonsqueezy`, {
    method: "POST",
    headers: buildAuthHeaders({ sessionId: params.sessionId, accessToken: params.accessToken, json: true }),
    credentials: shouldSendCookies() ? "include" : "omit",
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
  const apiBaseUrl = getApiBaseUrl();
  const body: SessionRestoreRequest = { email: params.email };

  const response = await fetch(`${apiBaseUrl}/api/v1/session/restore`, {
    method: "POST",
    headers: buildAuthHeaders({ sessionId: params.sessionId, accessToken: params.accessToken, json: true }),
    credentials: shouldSendCookies() ? "include" : "omit",
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
  const apiBaseUrl = getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/v1/session/me`, {
    method: "GET",
    headers: buildAuthHeaders({ sessionId: params?.sessionId, accessToken: params?.accessToken }),
    credentials: shouldSendCookies() ? "include" : "omit",
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

export async function logoutSession(): Promise<SessionLogoutResponse> {
  const apiBaseUrl = getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/v1/session/logout`, {
    method: "POST",
    credentials: "include",
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
