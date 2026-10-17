// Job ids only: download URLs are presigned and expire, so they are fetched from /status on each click (lib/downloads.ts).
export type StoredResultItem = {
  job_id: string;
  filename: string;
  created_at?: string;
  expiry_date?: string;
  original_size?: number;
  optimized_size?: number | null;
};

export type StoredResultBatch = {
  id: string;
  session_id: string;
  created_at: string;
  expires_at: string;
  items: StoredResultItem[];
};

const STORAGE_KEY = "imageopz_results_v1";
const MAX_BATCHES = 12;

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// Strips the `url` field that older versions stored with each item.
function withoutUrls(items: StoredResultItem[]): { items: StoredResultItem[]; changed: boolean } {
  let changed = false;
  const clean = items.map((item) => {
    if (!("url" in item)) return item;
    changed = true;
    const { url: _url, ...rest } = item as StoredResultItem & { url?: unknown };
    return rest;
  });
  return { items: clean, changed };
}

export function loadStoredResults(now = Date.now()): StoredResultBatch[] {
  const batches = safeParse<StoredResultBatch[]>(localStorage.getItem(STORAGE_KEY)) ?? [];
  let changed = false;
  const kept = batches
    .filter((b) => {
      const t = Date.parse(b.expires_at);
      if (!Number.isFinite(t)) return true;
      return t > now;
    })
    .map((b) => {
      const clean = withoutUrls(b.items ?? []);
      changed ||= clean.changed;
      return clean.changed ? { ...b, items: clean.items } : b;
    });
  if (changed || kept.length !== batches.length) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(kept));
    } catch {
      // ignore
    }
  }
  return kept;
}

export function saveResultBatch(batch: Omit<StoredResultBatch, "id">) {
  const id = `${batch.session_id}:${batch.created_at}`;
  const entry: StoredResultBatch = { ...batch, id, items: withoutUrls(batch.items).items };
  const current = loadStoredResults();

  // Best-effort dedupe: if a batch with same session_id and same first job_id exists, skip.
  const firstJob = entry.items[0]?.job_id;
  const already =
    Boolean(firstJob) &&
    current.some((b) => b.session_id === entry.session_id && b.items[0]?.job_id === firstJob);
  if (already) return;

  const next = [entry, ...current].slice(0, MAX_BATCHES);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota / disabled storage
  }
}

export function clearStoredResults() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

