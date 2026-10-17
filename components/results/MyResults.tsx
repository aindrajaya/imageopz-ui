"use client";

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { clearStoredResults, loadStoredResults, type StoredResultBatch } from "@/lib/resultsStore";
import { describeDownloadProblems, openFreshDownloads } from "@/lib/downloads";
import { getJobStatus } from "@/lib/imageopzApi";
import { getOrCreateSessionId } from "@/lib/session";

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export function MyResultsPage({ lang }: { lang: "en" | "id" }) {
  const [batches, setBatches] = useState<StoredResultBatch[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setBatches(loadStoredResults());
  }, []);

  const copy = useMemo(() => {
    return lang === "en"
      ? {
          title: "Recent Results",
          subtitle: "Results are saved locally in this browser. Files are available until they expire.",
          signupTitle: "Love the result?",
          signupBody: "Sign up to save your history and get 100 credits.",
          signupCta: "Sign up",
          empty: "No saved results yet.",
          back: "Back to app",
          clear: "Clear saved results",
          openAll: "Download all",
          open: "Download",
        }
      : {
          title: "Hasil Terbaru",
          subtitle: "Hasil disimpan lokal di browser ini. File tersedia sampai kedaluwarsa.",
          signupTitle: "Suka hasilnya?",
          signupBody: "Daftar untuk menyimpan riwayat Anda dan dapatkan 100 kredit.",
          signupCta: "Daftar",
          empty: "Belum ada hasil yang tersimpan.",
          back: "Kembali ke aplikasi",
          clear: "Hapus semua hasil",
          openAll: "Unduh semua",
          open: "Unduh",
        };
  }, [lang]);

  // Each click asks /status for a fresh presigned link; history keeps job ids only (lib/downloads.ts).
  const download = async (jobIds: string[]) => {
    setNotice(null);
    const sessionId = getOrCreateSessionId();
    const outcome = await openFreshDownloads(jobIds, (id) => getJobStatus(id, { sessionId }));
    setNotice(describeDownloadProblems(outcome, lang));
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10 space-y-5 sm:space-y-6">
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg sm:text-xl font-serif font-semibold tracking-tight">{copy.signupTitle}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">{copy.signupBody}</p>
          </div>
          <Link
            to={lang === "id" ? "/id?signup=1" : "/?signup=1"}
            className="inline-flex w-full sm:w-auto items-center justify-center px-5 py-2.5 text-sm font-semibold rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {copy.signupCta}
          </Link>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <h1 className="text-2xl sm:text-3xl font-serif font-semibold tracking-tight">{copy.title}</h1>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-xl">{copy.subtitle}</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:shrink-0">
            <Link
              to={lang === "id" ? "/id" : "/"}
              className="inline-flex w-full items-center justify-center px-4 py-2.5 text-sm font-semibold rounded-lg border border-border bg-background hover:bg-secondary/40 transition-colors"
            >
              {copy.back}
            </Link>
            {batches.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  clearStoredResults();
                  setBatches([]);
                }}
                className="inline-flex w-full items-center justify-center px-4 py-2.5 text-sm font-semibold rounded-lg border border-border bg-background hover:bg-secondary/40 transition-colors"
              >
                {copy.clear}
              </button>
            )}
          </div>
        </div>

        {notice && (
          <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            {notice}
          </div>
        )}

        {batches.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-5 sm:p-6 text-sm text-muted-foreground text-center sm:text-left">
            {copy.empty}
          </div>
        ) : (
          <div className="space-y-4">
            {batches.map((b) => (
              <div key={b.id} className="rounded-xl border border-border bg-card p-4 sm:p-5 space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="text-sm font-semibold truncate">
                      {b.items.length} file{b.items.length === 1 ? "" : "s"}
                    </div>
                    <div className="text-xs text-muted-foreground leading-relaxed">
                      {formatWhen(b.created_at)} • expires {formatWhen(b.expires_at)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void download(b.items.map((it) => it.job_id))}
                    className="inline-flex w-full items-center justify-center px-4 py-2.5 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors sm:w-auto"
                  >
                    {copy.openAll}
                  </button>
                </div>

                <div className="divide-y divide-border/60 rounded-lg border border-border overflow-hidden">
                  {b.items.map((it) => (
                    <div key={it.job_id} className="flex flex-col gap-3 p-3 bg-background sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <div className="text-sm font-medium break-words">{it.filename}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void download([it.job_id])}
                        className="inline-flex w-full items-center justify-center px-4 py-2.5 text-sm font-semibold rounded-lg border border-border bg-background hover:bg-secondary/40 transition-colors shrink-0 sm:w-auto"
                      >
                        {copy.open}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

