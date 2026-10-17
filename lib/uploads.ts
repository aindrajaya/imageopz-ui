// Direct-to-R2 uploads: presign -> PUT each file to its presigned URL -> complete.
// Contract: imageopz-server docs/engineering/contracts/uploads-api.md. No React in this module.
import {
  ImageOpzApiError,
  apiFetch,
  buildAuthHeaders,
  readJson,
  tryReadError,
  type JobStatusEnum,
} from "./imageopzApi";

export type RejectionReason =
  | "expired"
  | "missing"
  | "size_mismatch"
  | "type_mismatch"
  | "invalid_image"
  | "too_many_pixels"
  | "presign_failed";

export interface UploadIdentity {
  sessionId?: string | null;
  accessToken?: string | null;
}

export interface PresignFile {
  name: string;
  size: number;
  content_type: string;
}

export interface PresignedUpload {
  job_id: string;
  object_key: string;
  upload_url: string;
  method: string;
  headers: Record<string, string>;
  expires_at: string;
}

export interface PresignResponse {
  files: PresignedUpload[];
  complete_by: string;
}

export interface CompletedJob {
  job_id: string;
  status: JobStatusEnum;
  reason?: string | null;
}

export interface CompleteResponse {
  jobs: CompletedJob[];
}

async function postJson<T>(path: string, body: unknown, identity: UploadIdentity, label: string): Promise<T> {
  const response = await apiFetch(path, {
    method: "POST",
    headers: buildAuthHeaders({ sessionId: identity.sessionId, accessToken: identity.accessToken, json: true }),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = await tryReadError(response);
    throw new ImageOpzApiError(payload?.message || `${label} request failed (${response.status})`, response.status, payload);
  }
  return await readJson<T>(response);
}

// Spec: 201 PresignResponse; errors 400/413/422/429/503 as ImageOpzApiError.
export async function presignUploads(
  files: ReadonlyArray<{ name: string; size: number; type: string }>,
  identity: UploadIdentity
): Promise<PresignResponse> {
  const body: { files: PresignFile[] } = {
    files: files.map((f) => ({ name: f.name, size: f.size, content_type: f.type.toLowerCase() })),
  };
  return await postJson<PresignResponse>("/api/v1/uploads/presign", body, identity, "Presign");
}

// Spec: 200 CompleteResponse in request order; errors 404/400/503 (503 carries details.jobs).
export async function completeUploads(jobIds: string[], identity: UploadIdentity): Promise<CompleteResponse> {
  return await postJson<CompleteResponse>("/api/v1/uploads/complete", { job_ids: jobIds }, identity, "Complete");
}

export class PutError extends Error {
  status: number;
  kind: "network" | "http" | "aborted";
  code: string | null;

  constructor(kind: "network" | "http" | "aborted", status: number, code: string | null = null) {
    super(kind === "http" ? `Upload failed (${status}${code ? ` ${code}` : ""})` : `Upload ${kind}`);
    this.name = "PutError";
    this.kind = kind;
    this.status = status;
    this.code = code;
  }

  // 403 (SignatureDoesNotMatch, ExpiredRequest) and other 4xx never succeed on the same URL.
  get retryable() {
    return this.kind === "network" || this.status >= 500;
  }
}

function parseR2ErrorCode(body: string): string | null {
  const match = /<Code>([^<]+)<\/Code>/.exec(body || "");
  return match ? match[1] : null;
}

// PUT the file to its presigned URL with exactly the returned method and headers. No credentials;
// the browser sets Content-Length from the body.
export function putToR2(
  file: Blob,
  target: Pick<PresignedUpload, "upload_url" | "method" | "headers">,
  opts: { onProgress?: (loaded: number, total: number) => void; signal?: AbortSignal } = {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    const { signal, onProgress } = opts;
    if (signal?.aborted) {
      reject(new PutError("aborted", 0));
      return;
    }
    const xhr = new XMLHttpRequest();
    const onAbort = () => xhr.abort();
    const cleanup = () => signal?.removeEventListener("abort", onAbort);

    xhr.open(target.method || "PUT", target.upload_url);
    xhr.withCredentials = false;
    for (const [name, value] of Object.entries(target.headers ?? {})) {
      if (name.toLowerCase() === "content-length") continue;
      xhr.setRequestHeader(name, value);
    }
    xhr.upload.onprogress = (e) => onProgress?.(e.loaded, e.lengthComputable ? e.total : file.size);
    xhr.onload = () => {
      cleanup();
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(file.size, file.size);
        resolve();
      } else {
        let body = "";
        try {
          body = xhr.responseText;
        } catch {
          // ignore
        }
        reject(new PutError("http", xhr.status, parseR2ErrorCode(body)));
      }
    };
    xhr.onerror = () => {
      cleanup();
      reject(new PutError("network", 0));
    };
    xhr.ontimeout = xhr.onerror;
    xhr.onabort = () => {
      cleanup();
      reject(new PutError("aborted", 0));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    xhr.send(file);
  });
}

export type UploadItemState = "queued" | "uploading" | "uploaded" | "processing" | "done" | "rejected" | "failed";

// Why a file failed on the client side (state "failed"); null for a backend processing failure.
export type UploadFailure =
  | "cancelled"
  | "put_forbidden"
  | "put_failed"
  | "url_expired"
  | "complete_failed"
  | "job_not_found";

export interface UploadItem {
  index: number;
  name: string;
  size: number;
  loaded: number;
  state: UploadItemState;
  jobId: string | null;
  reason: string | null;
  failure: UploadFailure | null;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

export interface UploadBatchOptions {
  identity: UploadIdentity;
  concurrency?: number;
  signal?: AbortSignal;
  maxPutAttempts?: number;
  maxCompleteAttempts?: number;
  backoffMs?: number;
  onItem?: (item: UploadItem) => void;
  onProgress?: (progress: UploadProgress) => void;
  now?: () => number;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

export interface UploadBatchResult {
  items: UploadItem[];
  aborted: boolean;
  // Jobs /complete accepted (anything but rejected): poll /status for these.
  acceptedJobIds: string[];
}

export const DEFAULT_UPLOAD_CONCURRENCY = 4;

// Bytes sent so far; files that settled without uploading count as done so the bar can finish.
export function aggregateProgress(items: ReadonlyArray<Pick<UploadItem, "size" | "loaded" | "state">>): UploadProgress {
  let loaded = 0;
  let total = 0;
  for (const item of items) {
    total += item.size;
    loaded += item.state === "queued" || item.state === "uploading" ? Math.min(item.loaded, item.size) : item.size;
  }
  return { loaded, total, percent: total > 0 ? (loaded / total) * 100 : 0 };
}

// Backend timestamps are UTC without an offset.
export function parseUtc(value: string): number {
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(value);
  return Date.parse(hasZone ? value : `${value}Z`);
}

function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new PutError("aborted", 0));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(new PutError("aborted", 0));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function runPool(count: number, limit: number, fn: (index: number) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, count)) }, async () => {
    while (next < count) await fn(next++);
  });
  await Promise.all(workers);
}

export async function uploadBatch(files: File[], options: UploadBatchOptions): Promise<UploadBatchResult> {
  const {
    identity,
    signal,
    concurrency = DEFAULT_UPLOAD_CONCURRENCY,
    maxPutAttempts = 3,
    maxCompleteAttempts = 4,
    backoffMs = 1000,
    now = Date.now,
    sleep = defaultSleep,
  } = options;
  const backoff = (attempt: number) => Math.min(8000, backoffMs * 2 ** (attempt - 1));

  const items: UploadItem[] = files.map((f, index) => ({
    index,
    name: f.name,
    size: f.size,
    loaded: 0,
    state: "queued",
    jobId: null,
    reason: null,
    failure: null,
  }));
  const update = (item: UploadItem, patch: Partial<UploadItem>) => {
    Object.assign(item, patch);
    options.onItem?.({ ...item });
    options.onProgress?.(aggregateProgress(items));
  };

  const presign = await presignUploads(files, identity);
  if (!Array.isArray(presign.files) || presign.files.length !== files.length) {
    throw new Error(`Presign returned ${presign.files?.length ?? 0} uploads for ${files.length} files`);
  }
  presign.files.forEach((target, i) => update(items[i], { jobId: target.job_id }));

  await runPool(files.length, concurrency, async (i) => {
    const item = items[i];
    const target = presign.files[i];
    const expiresAt = parseUtc(target.expires_at);
    for (let attempt = 1; ; attempt++) {
      if (signal?.aborted) return update(item, { state: "failed", failure: "cancelled" });
      update(item, { state: "uploading", loaded: 0 });
      try {
        await putToR2(files[i], target, {
          signal,
          onProgress: (loaded) => update(item, { loaded: Math.min(loaded, item.size) }),
        });
        return update(item, { state: "uploaded", loaded: item.size });
      } catch (e) {
        const err = e instanceof PutError ? e : new PutError("network", 0);
        if (err.kind === "aborted") return update(item, { state: "failed", failure: "cancelled" });
        if (err.code === "ExpiredRequest") return update(item, { state: "failed", failure: "url_expired" });
        if (!err.retryable) return update(item, { state: "failed", failure: err.status === 403 ? "put_forbidden" : "put_failed" });
        if (attempt >= maxPutAttempts) return update(item, { state: "failed", failure: "put_failed" });
        try {
          await sleep(backoff(attempt), signal);
        } catch {
          return update(item, { state: "failed", failure: "cancelled" });
        }
        if (now() >= expiresAt) return update(item, { state: "failed", failure: "url_expired" });
      }
    }
  });

  // Cancel means nothing in this batch is processed; the sweeper releases the reserved credits.
  if (signal?.aborted) {
    for (const item of items) if (item.state !== "failed") update(item, { state: "failed", failure: "cancelled" });
    return { items, aborted: true, acceptedJobIds: [] };
  }

  const byJob = new Map(items.map((item) => [item.jobId as string, item]));
  const accepted = new Set<string>();
  const apply = (jobs: CompletedJob[]) => {
    for (const job of jobs) {
      const item = byJob.get(job.job_id);
      if (!item || job.status === "uploading") continue;
      if (job.status === "rejected") {
        update(item, { state: "rejected", reason: job.reason ?? null });
        continue;
      }
      accepted.add(job.job_id);
      if (job.status === "pending" || job.status === "processing") update(item, { state: "processing" });
      else update(item, { state: job.status });
    }
  };

  let remaining = items.filter((item) => item.state === "uploaded").map((item) => item.jobId as string);
  for (let attempt = 1; remaining.length > 0; attempt++) {
    let retry: string[] = [];
    try {
      const res = await completeUploads(remaining, identity);
      apply(res.jobs ?? []);
      const answered = new Set((res.jobs ?? []).map((j) => j.job_id));
      for (const id of remaining) {
        const item = byJob.get(id)!;
        if (!answered.has(id) || item.state === "uploaded") update(item, { state: "failed", failure: "complete_failed" });
      }
      remaining = [];
      break;
    } catch (e) {
      const details = e instanceof ImageOpzApiError ? (e.payload?.details as Record<string, unknown> | null | undefined) : null;
      if (!(e instanceof ImageOpzApiError)) {
        retry = remaining;
      } else if (e.status === 404 && Array.isArray(details?.job_ids)) {
        const unknown = new Set(details.job_ids as string[]);
        for (const id of unknown) {
          const item = byJob.get(id);
          if (item) update(item, { state: "failed", failure: "job_not_found" });
        }
        retry = remaining.filter((id) => !unknown.has(id));
      } else if (e.status === 503 && Array.isArray(details?.jobs)) {
        const jobs = details.jobs as CompletedJob[];
        apply(jobs);
        // Jobs still shown `uploading` were not queued; only those are retried.
        retry = jobs.filter((j) => j.status === "uploading" && remaining.includes(j.job_id)).map((j) => j.job_id);
      } else if (e.status >= 500) {
        retry = remaining;
      }
    }
    const dropped = remaining.filter((id) => !retry.includes(id) && byJob.get(id)!.state === "uploaded");
    for (const id of dropped) update(byJob.get(id)!, { state: "failed", failure: "complete_failed" });
    remaining = retry;
    if (remaining.length === 0) break;
    if (attempt >= maxCompleteAttempts) {
      for (const id of remaining) update(byJob.get(id)!, { state: "failed", failure: "complete_failed" });
      break;
    }
    await sleep(backoff(attempt));
  }

  return { items, aborted: false, acceptedJobIds: items.filter((i) => i.jobId && accepted.has(i.jobId)).map((i) => i.jobId as string) };
}

const REJECTION_TEXT: Record<"en" | "id", Record<RejectionReason, string>> = {
  en: {
    expired: "Upload took too long to confirm. Please try again.",
    missing: "The file never reached storage. Please try again.",
    size_mismatch: "File size changed during upload or is over your plan's limit.",
    type_mismatch: "File type did not match what was uploaded.",
    invalid_image: "Not a valid JPEG, PNG or WEBP image.",
    too_many_pixels: "Image dimensions are too large.",
    presign_failed: "Upload could not be prepared. Please try again.",
  },
  id: {
    expired: "Konfirmasi unggahan terlalu lama. Silakan coba lagi.",
    missing: "File tidak sampai ke penyimpanan. Silakan coba lagi.",
    size_mismatch: "Ukuran file berubah saat diunggah atau melebihi batas paket.",
    type_mismatch: "Tipe file tidak sesuai dengan yang diunggah.",
    invalid_image: "Bukan gambar JPEG, PNG atau WEBP yang valid.",
    too_many_pixels: "Dimensi gambar terlalu besar.",
    presign_failed: "Unggahan tidak dapat disiapkan. Silakan coba lagi.",
  },
};

const FAILURE_TEXT: Record<"en" | "id", Record<UploadFailure, string>> = {
  en: {
    cancelled: "Cancelled",
    put_forbidden: "Upload refused by storage. Please try again.",
    put_failed: "Upload failed (network). Please try again.",
    url_expired: "Upload link expired. Please try again.",
    complete_failed: "Could not confirm the upload. Please try again.",
    job_not_found: "Upload session changed (signed in or out?). Please try again.",
  },
  id: {
    cancelled: "Dibatalkan",
    put_forbidden: "Unggahan ditolak penyimpanan. Silakan coba lagi.",
    put_failed: "Unggahan gagal (jaringan). Silakan coba lagi.",
    url_expired: "Tautan unggahan kedaluwarsa. Silakan coba lagi.",
    complete_failed: "Unggahan tidak dapat dikonfirmasi. Silakan coba lagi.",
    job_not_found: "Sesi unggahan berubah (masuk atau keluar?). Silakan coba lagi.",
  },
};

export function describeRejection(reason: string | null | undefined, lang: "en" | "id"): string {
  const text = REJECTION_TEXT[lang][reason as RejectionReason];
  return text ?? (lang === "en" ? "Upload was rejected." : "Unggahan ditolak.");
}

export function describeFailure(failure: UploadFailure, lang: "en" | "id"): string {
  return FAILURE_TEXT[lang][failure];
}

export type StartErrorAction =
  | { kind: "quota_exceeded" }
  | { kind: "renew_pro" }
  | { kind: "activation_pending"; retryAfterMs: number | null }
  | { kind: "error"; message: string | null };

// What the UI does when starting a batch fails. Codes from the presign contract (429 QUOTA_EXCEEDED /
// ACTIVATION_PENDING); a free user out of credits gets the upgrade prompt, a Pro user out of credits or past the Pro
// expiry the renew prompt, other errors the message.
export function classifyStartError(err: unknown, isPro: boolean): StartErrorAction {
  if (!(err instanceof ImageOpzApiError)) return { kind: "error", message: null };
  const code = err.payload?.error;
  if (isPro && err.status === 429 && code === "QUOTA_EXCEEDED") return { kind: "renew_pro" };
  if (!isPro && err.status === 429) {
    if (code === "QUOTA_EXCEEDED") return { kind: "quota_exceeded" };
    if (code === "ACTIVATION_PENDING") {
      const retry = err.payload?.details?.retry_after_ms;
      return { kind: "activation_pending", retryAfterMs: typeof retry === "number" ? retry : null };
    }
  }
  return { kind: "error", message: err.payload?.message || err.message || null };
}
