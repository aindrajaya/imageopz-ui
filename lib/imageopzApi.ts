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

function getApiBaseUrl() {
  const isDev = Boolean(import.meta.env.DEV);
  // Use direct property access so Vite can statically replace it at build time.
  const base = import.meta.env.VITE_IMAGEOPZ_API_BASE_URL as unknown as string | undefined;
  if (isDev) {
    const g = globalThis as any;
    if (!g.__imageopzApiBaseLogged) {
      g.__imageopzApiBaseLogged = true;
      console.log("[imageopz] API BASE:", typeof base === "string" ? base : String(base));
    }
  }
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
}): Promise<BulkOptimizeResponse> {
  const apiBaseUrl = getApiBaseUrl();
  if (import.meta.env.DEV && (!apiBaseUrl || apiBaseUrl.trim().length === 0)) {
    console.warn("[imageopz] API base URL is empty; requests will go to same-origin.");
  }
  const form = new FormData();
  for (const image of params.images) form.append("images", image);
  if (params.sessionId) form.append("session_id_form", params.sessionId);

  const response = await fetch(`${apiBaseUrl}/api/v1/optimize`, {
    method: "POST",
    headers: {
      ...(params.sessionId ? { "X-Session-Id": params.sessionId } : {}),
    },
    credentials: "include",
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

export async function getJobStatus(jobId: string): Promise<JobStatusResponse> {
  const apiBaseUrl = getApiBaseUrl();
  const response = await fetch(
    `${apiBaseUrl}/api/v1/status/${encodeURIComponent(jobId)}`,
    { method: "GET", credentials: "include" }
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

export async function createLemonSqueezyCheckout(params: {
  email: string;
  sessionId?: string | null;
}): Promise<LemonSqueezyCreateCheckoutResponse> {
  const apiBaseUrl = getApiBaseUrl();
  console.log("API BASE:", apiBaseUrl)
  const body: LemonSqueezyCreateCheckoutRequest = {
    email: params.email,
    session_id: params.sessionId ?? null,
  };

  const response = await fetch(`${apiBaseUrl}/api/v1/checkout/lemonsqueezy`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(params.sessionId ? { "X-Session-Id": params.sessionId } : {}),
    },
    credentials: "include",
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
}): Promise<SessionRestoreResponse> {
  const apiBaseUrl = getApiBaseUrl();
  const body: SessionRestoreRequest = { email: params.email };

  const response = await fetch(`${apiBaseUrl}/api/v1/session/restore`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(params.sessionId ? { "X-Session-Id": params.sessionId } : {}),
    },
    credentials: "include",
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
