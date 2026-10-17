// Download links are presigned R2 GETs that expire 15 minutes after the /status call that signed them (server T-008c2),
// so a link is never stored or reused: every click asks /status for a fresh one. No React in this module.
import { ImageOpzApiError, type JobStatusResponse } from "./imageopzApi";

export type DownloadLink = { kind: "ok"; url: string } | { kind: "unavailable" } | { kind: "error" };

// unavailable: no URL from /status (expired, cleaned up, not this session's job) or 404; error: worth retrying.
export async function freshDownloadUrl(
  jobId: string,
  fetchStatus: (id: string) => Promise<JobStatusResponse>
): Promise<DownloadLink> {
  try {
    const s = await fetchStatus(jobId);
    const url = s?.status === "done" && typeof s.r2_url === "string" ? s.r2_url.trim() : "";
    return url ? { kind: "ok", url } : { kind: "unavailable" };
  } catch (e) {
    if (e instanceof ImageOpzApiError && e.status === 404) return { kind: "unavailable" };
    return { kind: "error" };
  }
}

export type DownloadTab = { opener: unknown; location: { href: string }; close: () => void };
export type TabOpener = { open: (url?: string, target?: string, features?: string) => DownloadTab | null };
export type DownloadOutcome = { opened: number; unavailable: number; failed: number };

// Tabs are opened synchronously, inside the click, because popup blockers refuse window.open after an await;
// each one is then pointed at its fresh URL or closed.
export async function openFreshDownloads(
  jobIds: readonly string[],
  fetchStatus: (id: string) => Promise<JobStatusResponse>,
  opener: TabOpener = window as unknown as TabOpener
): Promise<DownloadOutcome> {
  const tabs = jobIds.map(() => {
    const tab = opener.open("", "_blank");
    if (tab) tab.opener = null;
    return tab;
  });
  const links = await Promise.all(jobIds.map((id) => freshDownloadUrl(id, fetchStatus)));
  const outcome: DownloadOutcome = { opened: 0, unavailable: 0, failed: 0 };
  links.forEach((link, i) => {
    const tab = tabs[i];
    if (link.kind === "ok") {
      if (tab) tab.location.href = link.url;
      else opener.open(link.url, "_blank", "noopener,noreferrer");
      outcome.opened++;
      return;
    }
    tab?.close();
    if (link.kind === "unavailable") outcome.unavailable++;
    else outcome.failed++;
  });
  return outcome;
}

const PROBLEM_TEXT = {
  en: {
    unavailable:
      "This download is no longer available. Links expire, files are removed after their expiry date, and files from another browser session cannot be downloaded here.",
    failed: "Could not get a download link right now. Please try again.",
  },
  id: {
    unavailable:
      "Unduhan ini sudah tidak tersedia. Link kedaluwarsa, file dihapus setelah tanggal kedaluwarsa, dan file dari sesi browser lain tidak bisa diunduh di sini.",
    failed: "Link unduhan belum bisa diambil. Silakan coba lagi.",
  },
};

export function describeDownloadProblems(outcome: DownloadOutcome, lang: "en" | "id"): string | null {
  const parts = [
    outcome.unavailable > 0 ? PROBLEM_TEXT[lang].unavailable : null,
    outcome.failed > 0 ? PROBLEM_TEXT[lang].failed : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}
