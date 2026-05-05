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

function getApiBaseUrl() {
  const base = (import.meta as any)?.env?.VITE_IMAGEOPZ_API_BASE_URL;
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
  authToken?: string | null;
}): Promise<BulkOptimizeResponse> {
  const apiBaseUrl = getApiBaseUrl();
  const form = new FormData();
  for (const image of params.images) form.append("images", image);
  if (params.authToken) form.append("auth_token", params.authToken);

  const response = await fetch(`${apiBaseUrl}/api/v1/optimize`, {
    method: "POST",
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
    { method: "GET" }
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

