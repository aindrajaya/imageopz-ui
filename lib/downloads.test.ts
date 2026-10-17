import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ImageOpzApiError, type JobStatusResponse } from "./imageopzApi";
import { describeDownloadProblems, freshDownloadUrl, openFreshDownloads, type TabOpener } from "./downloads";

function status(job_id: string, s: JobStatusResponse["status"], r2_url: string | null): JobStatusResponse {
  return {
    job_id,
    status: s,
    original_filename: `${job_id}.jpg`,
    original_size: 100,
    r2_url,
    created_at: "2026-10-17T00:00:00",
    expiry_date: "2026-10-24T00:00:00",
  };
}

type FakeTab = { opener: unknown; location: { href: string }; closed: boolean; close: () => void };

function fakeOpener() {
  const tabs: FakeTab[] = [];
  const direct: string[] = [];
  const opener: TabOpener = {
    open: vi.fn((url?: string) => {
      if (url) {
        direct.push(url);
        return null;
      }
      const tab: FakeTab = { opener: {}, location: { href: "about:blank" }, closed: false, close: () => (tab.closed = true) };
      tabs.push(tab);
      return tab;
    }),
  };
  return { opener, tabs, direct };
}

describe("freshDownloadUrl", () => {
  it("asks /status for the job and returns the URL it signs now", async () => {
    const fetchStatus = vi.fn(async (id: string) => status(id, "done", `https://r2.test/${id}.avif?X-Amz-Signature=new`));
    await expect(freshDownloadUrl("a", fetchStatus)).resolves.toEqual({
      kind: "ok",
      url: "https://r2.test/a.avif?X-Amz-Signature=new",
    });
    expect(fetchStatus).toHaveBeenCalledWith("a");
  });

  it("reports unavailable when /status returns no URL (expired, cleaned up, not the owner)", async () => {
    await expect(freshDownloadUrl("a", async (id) => status(id, "done", null))).resolves.toEqual({ kind: "unavailable" });
    await expect(freshDownloadUrl("a", async (id) => status(id, "done", "  "))).resolves.toEqual({ kind: "unavailable" });
    await expect(freshDownloadUrl("a", async (id) => status(id, "failed", "https://r2.test/x"))).resolves.toEqual({
      kind: "unavailable",
    });
  });

  it("treats 404 as unavailable and other failures as retryable errors", async () => {
    const notFound = async () => {
      throw new ImageOpzApiError("Job a not found", 404, null);
    };
    const offline = async () => {
      throw new TypeError("Failed to fetch");
    };
    await expect(freshDownloadUrl("a", notFound)).resolves.toEqual({ kind: "unavailable" });
    await expect(freshDownloadUrl("a", offline)).resolves.toEqual({ kind: "error" });
  });
});

describe("openFreshDownloads", () => {
  it("opens the tabs inside the click, before /status answers, then points them at fresh URLs", async () => {
    const { opener, tabs } = fakeOpener();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const fetchStatus = vi.fn(async (id: string) => {
      await gate;
      return status(id, "done", `https://r2.test/${id}?fresh`);
    });

    const pending = openFreshDownloads(["a", "b"], fetchStatus, opener);
    expect(tabs).toHaveLength(2);
    expect(tabs.every((t) => t.opener === null)).toBe(true);
    release();

    await expect(pending).resolves.toEqual({ opened: 2, unavailable: 0, failed: 0 });
    expect(tabs.map((t) => t.location.href)).toEqual(["https://r2.test/a?fresh", "https://r2.test/b?fresh"]);
    expect(fetchStatus.mock.calls.map((c) => c[0])).toEqual(["a", "b"]);
  });

  it("closes the tab of a job without a link and counts it", async () => {
    const { opener, tabs } = fakeOpener();
    const fetchStatus = async (id: string) => {
      if (id === "gone") throw new ImageOpzApiError("not found", 404, null);
      if (id === "down") throw new TypeError("Failed to fetch");
      return status(id, "done", `https://r2.test/${id}`);
    };
    await expect(openFreshDownloads(["ok", "gone", "down"], fetchStatus, opener)).resolves.toEqual({
      opened: 1,
      unavailable: 1,
      failed: 1,
    });
    expect(tabs.map((t) => t.closed)).toEqual([false, true, true]);
  });

  it("falls back to opening the URL directly when the blank tab was blocked", async () => {
    const direct: string[] = [];
    const opener: TabOpener = {
      open: (url?: string) => {
        if (url) direct.push(url);
        return null;
      },
    };
    await expect(openFreshDownloads(["a"], async (id) => status(id, "done", "https://r2.test/a"), opener)).resolves.toEqual({
      opened: 1,
      unavailable: 0,
      failed: 0,
    });
    expect(direct).toEqual(["https://r2.test/a"]);
  });
});

describe("describeDownloadProblems", () => {
  it("is null when every download opened", () => {
    expect(describeDownloadProblems({ opened: 2, unavailable: 0, failed: 0 }, "en")).toBeNull();
  });

  it("explains expired links and temporary failures in both languages", () => {
    expect(describeDownloadProblems({ opened: 0, unavailable: 1, failed: 0 }, "en")).toMatch(/no longer available/);
    expect(describeDownloadProblems({ opened: 0, unavailable: 0, failed: 1 }, "en")).toMatch(/try again/);
    expect(describeDownloadProblems({ opened: 0, unavailable: 1, failed: 0 }, "id")).toMatch(/tidak tersedia/);
    expect(describeDownloadProblems({ opened: 0, unavailable: 0, failed: 1 }, "id")).toMatch(/coba lagi/);
  });
});

describe("no stored download URL is opened", () => {
  const root = path.resolve(__dirname, "..");
  const files = (dir: string): string[] =>
    readdirSync(path.join(root, dir)).flatMap((name) => {
      const rel = path.join(dir, name);
      if (statSync(path.join(root, rel)).isDirectory()) return files(rel);
      return /\.tsx?$/.test(name) && !name.endsWith(".test.ts") ? [rel] : [];
    });

  it("UI code opens downloads only through lib/downloads.ts", () => {
    const offenders = [...files("src"), ...files("components"), ...files("context")].filter((f) =>
      /window\.open\(|\.r2_url\b/.test(readFileSync(path.join(root, f), "utf8"))
    );
    expect(offenders).toEqual([]);
  });
});
