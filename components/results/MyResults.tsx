"use client";

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { clearStoredResults, loadStoredResults, type StoredResultBatch } from "@/lib/resultsStore";

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export function MyResultsPage({ lang }: { lang: "en" | "id" }) {
  const [batches, setBatches] = useState<StoredResultBatch[]>([]);

  useEffect(() => {
    setBatches(loadStoredResults());
  }, []);

  const copy = useMemo(() => {
    return lang === "en"
      ? {
          title: "Recent Results",
          subtitle: "Results are saved locally in this browser. Links may expire.",
          empty: "No saved results yet.",
          back: "Back to app",
          clear: "Clear saved results",
          openAll: "Open all links",
        }
      : {
          title: "Hasil Terbaru",
          subtitle: "Hasil disimpan lokal di browser ini. Link bisa kedaluwarsa.",
          empty: "Belum ada hasil yang tersimpan.",
          back: "Kembali ke aplikasi",
          clear: "Hapus semua hasil",
          openAll: "Buka semua link",
        };
  }, [lang]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-serif font-semibold tracking-tight">{copy.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">{copy.subtitle}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link
              to={lang === "id" ? "/id" : "/"}
              className="px-3 py-2 text-sm font-semibold rounded-lg border border-border bg-background hover:bg-secondary/40 transition-colors"
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
                className="px-3 py-2 text-sm font-semibold rounded-lg border border-border bg-background hover:bg-secondary/40 transition-colors"
              >
                {copy.clear}
              </button>
            )}
          </div>
        </div>

        {batches.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">{copy.empty}</div>
        ) : (
          <div className="space-y-4">
            {batches.map((b) => (
              <div key={b.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">
                      {b.items.length} file{b.items.length === 1 ? "" : "s"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatWhen(b.created_at)} • expires {formatWhen(b.expires_at)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      for (const it of b.items) window.open(it.url, "_blank", "noopener,noreferrer");
                    }}
                    className="px-3 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    {copy.openAll}
                  </button>
                </div>

                <div className="divide-y divide-border/60 rounded-lg border border-border overflow-hidden">
                  {b.items.map((it) => (
                    <div key={it.job_id} className="flex items-center justify-between gap-3 p-3 bg-background">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{it.filename}</div>
                        <div className="text-xs text-muted-foreground truncate">{it.url}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => window.open(it.url, "_blank", "noopener,noreferrer")}
                        className="px-3 py-2 text-sm font-semibold rounded-lg border border-border bg-background hover:bg-secondary/40 transition-colors shrink-0"
                      >
                        Open
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

