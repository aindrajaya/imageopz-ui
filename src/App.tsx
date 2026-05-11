import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "motion/react";
import { Analytics } from "@vercel/analytics/react";
import { usePostHog } from '@posthog/react';
import { 
  UploadCloud, 
  Zap, 
  Image as ImageIcon, 
  CheckCircle, 
  Download, 
  Share2, 
  MessageSquare, 
  AlertCircle,
  CreditCard,
  FileArchive,
  ArrowRight,
  Menu,
  X
} from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import confetti from "canvas-confetti";
import { BrowserRouter, Routes, Route, useNavigate, useParams, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { AuthCallback } from "@/components/auth/AuthCallback";
import { MyResultsPage } from "@/components/results/MyResults";
import {
  optimizeImages,
  getJobStatus,
  createLemonSqueezyCheckout,
  getSessionMe,
  reconcileSession,
  logoutSession,
  ImageOpzApiError,
  type JobStatusResponse,
  type SessionMeResponse,
} from "@/lib/imageopzApi";
import { saveResultBatch } from "@/lib/resultsStore";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Helper to format bytes
function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

const translations = {
  en: {
    title: "ImageOpz",
    optimizationsLeft: "optimizations left",
    upgradeToPro: "Upgrade to Pro",
    lcpKiller: "LCP-Killer Tool ⚡",
    headlineMain: "Ship Lighter Images.",
    headlineSub: "Crush Your LCP Scores.",
    description: "Convert to WebP & AVIF. 80% smaller files, zero quality loss. Built for developers.",
    heroCta: "Start Optimizing Now",
    socialProof: "Before vs After",
    socialProofExample: "1.2MB → 140KB",
    dropYourImage: "Upload Image",
    supportFormat: "Support for JPEG, PNG, WEBP up to 10MB (Free) / 25MB (Pro) per file.",
    crunching: "Crunching pixels...",
    applying: "Applying advanced WebP/AVIF compression.",
    progressStages: [
      "Analyzing image...",
      "Extracting features...",
      "Applying compression...",
      "Optimizing format...",
      "Finalizing..."
    ],
    highTraffic: "High Traffic Alert",
    queuePos: "Queue",
    waitOrLeaveEmail: "You can wait, or leave your email. We'll send you the optimized file when it's done.",
    emailPlaceholder: "your@email.com",
    notifyMe: "Notify Me",
    emailSaved: "We'll email you the result!",
    optimizationComplete: "Optimization Complete",
    massiveSavings: "Massive Savings!",
    originalSize: "Original Size",
    newSize: "New Size",
    reduction: "reduction",
    estLoadTime: "Est. Load Time",
    lighthouseBoost: "Lighthouse Boost!",
    downloadImage: "Download Optimized Image",
    shareResult: "Share Result",
    copied: "Copied to clipboard!",
    shareText: "I just squashed an image by 85% using ImageOpz! ⚡",
    optimizeAnother: "Optimize another image",
    privacyWarning: "Privacy Warning: This file will be permanently deleted from our servers in 7 days.",
    howItWorks: "How it Works",
    howItWorksSub: "A brutally simple pipeline designed to solve one problem: bloated AI-generated images ruining your website's performance.",
    step1Title: "Drop & Validate",
    step1Desc: "Client-side validation ensures you only send valid images. 10MB (Free) / 25MB (Pro) limit keeps our Edge network fast and responsive without arbitrary bloat.",
    step2Title: "Edge Processing",
    step2Desc: "Next.js Edge functions validate and rate-limit, passing your image to our dedicated Vultr instance powered by highly tuned Python compression algorithms.",
    step3Title: "Deliver & Wipe",
    step3Desc: "You get a WebP/AVIF file that's 80%+ smaller. For your privacy, the raw and optimized files are purged from our hybrid R2 storage within 7 days.",
    proPlan: "Pro Plan",
    imagePreview: "Image Preview",
    readyToOptimize: "Ready to optimize?",
    startOptimization: "Start Optimization",
    imagesDetected: "images detected",
    estimatedTime: "Estimated time",
    minuteShort: "minutes",
    connecting: "Wait a moment…",
    processingHint: "💡 You can close this tab. Results will be saved to /my-results",
    outOfCredits: "Out of Free Credits.",
    supportIndie: "Keep your websites blazing fast. Upgrade to optimize more images instantly.",
    proFeature1: "100 image optimizations",
    proFeature2: "Priority Queue Access",
    proFeature3: "40-day file retention",
    proFeature4: "Support indie development ❤️",
    buyCredits: "Buy Credits",
    paymentSuccess: "Payment successful! 100 credits added.",
    confirmPaymentTitle: "Confirm Purchase",
    confirmPaymentDesc: "Are you sure you want to purchase 100 credits for $9.99?",
    confirm: "Confirm",
    cancel: "Cancel",
    feedbackTitle: "Found a bug? Have an idea?",
    feedbackSub: "Tell me directly. I read every message!",
    feedbackPlaceholder: "It broke when I...",
    sendFeedback: "Send Feedback",
    feedbackSent: "Feedback sent! Thank you.",
    footerRights: "© 2026 ImageOpz. All rights reserved.",
    footerTerms: "Terms of Service",
    footerPrivacy: "Privacy Policy",
    footerContact: "Contact"
  },
  id: {
    title: "ImageOpz",
    optimizationsLeft: "optimasi tersisa",
    upgradeToPro: "Upgrade ke Pro",
    lcpKiller: "Alat LCP-Killer ⚡",
    headlineMain: "Kirim Gambar Lebih Ringan.",
    headlineSub: "Hancurkan Skor LCP Anda.",
    description: "Konversi ke WebP & AVIF. Ukuran 80% lebih kecil, tanpa penurunan kualitas. Dibuat untuk developer.",
    heroCta: "Mulai Optimasi Sekarang",
    socialProof: "Sebelum vs Sesudah",
    socialProofExample: "1.2MB → 140KB",
    dropYourImage: "Upload Gambar",
    supportFormat: "Mendukung JPEG, PNG, WEBP (Max. 10MB Gratis / 25MB Pro)",
    crunching: "Memproses gambar...",
    applying: "Melakukan kompresi super cepat ke format Next-Gen.",
    progressStages: [
      "Menganalisis gambar...",
      "Mengekstraksi fitur...",
      "Menerapkan kompresi...",
      "Mengoptimalkan format...",
      "Menyelesaikan..."
    ],
    highTraffic: "Antrean sedang ramai",
    queuePos: "Posisi",
    waitOrLeaveEmail: "Masukkan email Anda, kami akan mengirimkan hasilnya agar Anda tidak perlu menatap layar ini.",
    emailPlaceholder: "email@anda.com",
    notifyMe: "Beritahu Saya",
    emailSaved: "Email tersimpan. Kami akan kabari Anda!",
    optimizationComplete: "Optimasi Selesai",
    massiveSavings: "Performa Maksimal!",
    originalSize: "Ukuran Awal",
    newSize: "Ukuran Baru",
    reduction: "Turun",
    estLoadTime: "Estimasi Load",
    lighthouseBoost: "Lighthouse Boost!",
    downloadImage: "Unduh Gambar",
    shareResult: "Pamerkan Hasil Ini",
    copied: "Disalin ke papan klip!",
    shareText: "Saya baru saja menghemat ukuran gambar sebesar 85% dengan ImageOpz! ⚡",
    optimizeAnother: "Optimasi gambar lain",
    privacyWarning: "Peringatan Privasi: File ini akan dihapus permanen dari server kami dalam 7 Hari.",
    howItWorks: "Cara Kerja",
    howItWorksSub: "Alur sederhana yang dirancang untuk mengatasi gambar AI berukuran raksasa yang memperlambat website Anda.",
    step1Title: "Validasi Loka",
    step1Desc: "Validasi sisi klien memastikan hanya gambar valid yang diproses. Batas 10MB (Gratis) / 25MB (Pro) menjaga jaringan Edge tetap responsif.",
    step2Title: "Pemrosesan Edge",
    step2Desc: "Fungsi Edge memvalidasi dan membatasi traffic, lalu mengirimkan gambar Anda ke engine kompresi cerdas kami.",
    step3Title: "Kirim & Hapus",
    step3Desc: "Anda mendapatkan file WebP/AVIF yang jauh lebih kecil. Demi privasi Anda, file asli dan hasil akan dihapus dalam 7 hari.",
    proPlan: "Paket Pro",
    imagePreview: "Pratinjau Gambar",
    readyToOptimize: "Siap untuk optimasi?",
    startOptimization: "Mulai Optimasi",
    imagesDetected: "gambar terdeteksi",
    estimatedTime: "Estimasi waktu",
    minuteShort: "menit",
    connecting: "Tunggu sebentar…",
    processingHint: "💡 Anda boleh menutup tab ini. Hasil akan tersimpan di /my-results",
    outOfCredits: "Kehabisan Kuota Gratis.",
    supportIndie: "Dukung alat indie kami dan dapatkan akses tak terbatas.",
    proFeature1: "100 Credits untuk Optimasi",
    proFeature2: "Prioritas Antrean",
    proFeature3: "Retensi file 40 hari",
    proFeature4: "Mendukung pengembangan alat indie ini ❤️",
    buyCredits: "Beli Kredit",
    paymentSuccess: "Pembayaran berhasil! 100 Credits ditambahkan.",
    confirmPaymentTitle: "Konfirmasi Pembelian",
    confirmPaymentDesc: "Apakah Anda yakin ingin membeli 100 kredit seharga $9.99?",
    confirm: "Konfirmasi",
    cancel: "Batal",
    feedbackTitle: "Ada bug? Punya ide fitur?",
    feedbackSub: "Beritahu saya langsung!",
    feedbackPlaceholder: "Sepertinya ada error saat...",
    sendFeedback: "Kirim Umpan Balik",
    feedbackSent: "Pesan terkirim! Terima kasih.",
    footerRights: "© 2026 ImageOpz. Hak cipta dilindungi undang-undang.",
    footerTerms: "Syarat Ketentuan",
    footerPrivacy: "Kebijakan Privasi",
    footerContact: "Kontak"
  }
};

function AppContent({ lang }: { lang: "en" | "id" }) {
  const t = translations[lang];
  const navigate = useNavigate();
  const posthog = usePostHog();
  const { accessToken, email: authEmail, signInWithMagicLink, signOut, loadingAuth } = useAuth();
  const MAGIC_LINK_COOLDOWN_MS = 120_000;

  const [appState, setAppState] = useState<"idle" | "preview" | "processing" | "result">("idle");
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [quota, setQuota] = useState<number>(3);
  const [isPro, setIsPro] = useState(false);
  const [needsRestore, setNeedsRestore] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sessionMeLoading, setSessionMeLoading] = useState(true);
  const [sessionMeLoaded, setSessionMeLoaded] = useState(false);
  const [sessionMeError, setSessionMeError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>(() => {
    try {
      const existing = localStorage.getItem("imageopz_session_id");
      if (existing) return existing;
      if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        const id = crypto.randomUUID();
        localStorage.setItem("imageopz_session_id", id);
        return id;
      }
    } catch {
      // ignore
    }
    // Very old browsers: fallback to a non-uuid unique-ish value.
    const fallback = `sid_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    try {
      localStorage.setItem("imageopz_session_id", fallback);
    } catch {
      // ignore
    }
    return fallback;
  });
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [forceRestore, setForceRestore] = useState(false);
  const [hideRestoreCta, setHideRestoreCta] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showPaymentConfirm, setShowPaymentConfirm] = useState(false);
  const [checkoutEmail, setCheckoutEmail] = useState("");
  const [isCreatingCheckout, setIsCreatingCheckout] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [signInEmail, setSignInEmail] = useState("");
  const [signInSending, setSignInSending] = useState(false);
  const [signInPurpose, setSignInPurpose] = useState<"restore">("restore");
  const [magicLinkCooldownMs, setMagicLinkCooldownMs] = useState(0);
  const [accountClaimed, setAccountClaimed] = useState(false);
  const [activationPending, setActivationPending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [jobOrder, setJobOrder] = useState<string[]>([]);
  const [jobStatuses, setJobStatuses] = useState<Record<string, JobStatusResponse>>({});
  const jobStatusesRef = useRef<Record<string, JobStatusResponse>>({});
  const [showFeedback, setShowFeedback] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pollTimerRef = useRef<number | null>(null);
  const pollStartedAtRef = useRef<number | null>(null);
  const lastProgressSigRef = useRef<string>("");
  const lastProgressChangeAtRef = useRef<number | null>(null);
  const dropzoneRef = useRef<HTMLDivElement | null>(null);
  const pendingJobIdsRef = useRef<Set<string>>(new Set<string>());
  const pollCursorRef = useRef(0);
  const pollBackoffMsRef = useRef(0);
  const activationTimerRef = useRef<number | null>(null);
  const activationStartedAtRef = useRef<number | null>(null);
  const startActivationBridgeRef = useRef<null | (() => void)>(null);
  const postCheckoutReconcileRanRef = useRef(false);
  const sessionMeInFlightRef = useRef<Promise<SessionMeResponse> | null>(null);
  const lastSessionMeAtRef = useRef(0);
  const lastSessionMeRef = useRef<SessionMeResponse | null>(null);
  const idleMeTimerRef = useRef<number | null>(null);
  const prevAccessTokenRef = useRef<string | null>(null);

  const MAX_STATUS_CHECKS_PER_TICK = 6;
  const MAX_STATUS_CONCURRENCY = 4;
  const POLL_BACKOFF_MAX_MS = 15_000;
  const POLL_BACKOFF_MIN_MS = 2_500;
  const SESSION_ME_MIN_INTERVAL_MS = 5_000;
  const SESSION_ME_IDLE_CAP_MS = 45_000;

  async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let nextIndex = 0;
    const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
      while (true) {
        const i = nextIndex++;
        if (i >= items.length) return;
        results[i] = await fn(items[i]);
      }
    });
    await Promise.all(workers);
    return results;
  }

  useEffect(() => {
    jobStatusesRef.current = jobStatuses;
  }, [jobStatuses]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [lang]);

  const applySessionMe = useCallback((me: SessionMeResponse) => {
    const authed = Boolean(me.is_authenticated);
    setIsAuthenticated(authed);
    setAccountClaimed(authed || localStorage.getItem("imageopz_account_claimed") === "true");

    if (authed && me.email) {
      localStorage.setItem("imageopz_email", me.email);
      setAccountEmail(me.email);
    }

    const requiresRestore =
      Boolean(me.is_pro) &&
      (forceRestore || Boolean(me.needs_restore) || !Boolean(me.pro_verified) || me.pro_source === "unknown");
    const proActive = Boolean(me.is_pro && me.pro_verified && !requiresRestore);
    setIsPro(proActive);
    setNeedsRestore(requiresRestore);
    const remaining = proActive ? me.pro_credits_remaining : me.credits_remaining;
    setQuota(Math.max(0, remaining));
  }, [forceRestore]);

  const refreshSessionMe = useCallback(async (params?: {
    force?: boolean;
    sessionIdOverride?: string | null;
    accessTokenOverride?: string | null;
    reason?: string;
  }) => {
    const sid = params?.sessionIdOverride ?? sessionId;
    if (!sid) throw new Error("Missing sessionId");

    const now = Date.now();
    const force = Boolean(params?.force);
    if (!force && now - lastSessionMeAtRef.current < SESSION_ME_MIN_INTERVAL_MS && lastSessionMeRef.current) {
      return lastSessionMeRef.current;
    }

    if (!force && sessionMeInFlightRef.current) return await sessionMeInFlightRef.current;

    // If we have a Supabase access token, always send it so backend can immediately verify session/email/Pro.
    // Relying on `accountClaimed` here can cause a guest fallback during the initial post-magic-link bootstrap.
    const tokenToUse =
      typeof params?.accessTokenOverride === "string"
        ? params.accessTokenOverride
        : accessToken;
    const p = (async () => {
      if (import.meta.env.DEV) {
        const g = globalThis as any;
        if (!g.__imageopzSessionMeRefreshLogged) g.__imageopzSessionMeRefreshLogged = 0;
        g.__imageopzSessionMeRefreshLogged++;
        // eslint-disable-next-line no-console
        console.log("[imageopz] /session/me refresh", {
          n: g.__imageopzSessionMeRefreshLogged,
          reason: params?.reason || "unspecified",
          force,
        });
      }
      const me = await getSessionMe({ sessionId: sid, accessToken: tokenToUse });
      lastSessionMeAtRef.current = Date.now();
      lastSessionMeRef.current = me;
      applySessionMe(me);
      setSessionMeLoaded(true);
      setSessionMeError(null);
      return me;
    })();

    sessionMeInFlightRef.current = p;
    try {
      return await p;
    } finally {
      if (sessionMeInFlightRef.current === p) sessionMeInFlightRef.current = null;
    }
  }, [sessionId, accessToken, applySessionMe]);

  // Load local non-authoritative hints on mount
  useEffect(() => {
    // Email is not authoritative in guest mode (backend may grant Pro via ip_hash fallback),
    // so only keep it as a convenience for forms, not as "current account identity".
    const savedEmail = localStorage.getItem("imageopz_email");
    if (savedEmail) setAccountEmail(savedEmail);
    setForceRestore(localStorage.getItem("imageopz_force_restore") === "true");
    setHideRestoreCta(localStorage.getItem("imageopz_hide_restore_cta") === "true");

    setAccountClaimed(localStorage.getItem("imageopz_account_claimed") === "true");
  }, []);

  useEffect(() => {
    const prev = prevAccessTokenRef.current;
    // When the Supabase session first appears (post-magic-link) or disappears (logout),
    // force a fresh backend verification cycle without flashing guest UI.
    if ((!prev && accessToken) || (prev && !accessToken)) {
      setSessionMeLoaded(false);
      setSessionMeError(null);
      setSessionMeLoading(true);
    }
    prevAccessTokenRef.current = accessToken;
  }, [accessToken]);

  useEffect(() => {
    if (!showSignIn) {
      setMagicLinkCooldownMs(0);
      return;
    }

    const tick = () => {
      const emailKey = signInEmail.trim().toLowerCase();
      const key = emailKey ? `imageopz_magic_link_last_sent_at:${emailKey}` : "imageopz_magic_link_last_sent_at";
      const raw = localStorage.getItem(key) ?? localStorage.getItem("imageopz_magic_link_last_sent_at");
      const last = raw ? Number(raw) : 0;
      if (!Number.isFinite(last) || last <= 0) {
        setMagicLinkCooldownMs(0);
        return;
      }
      const remaining = Math.max(0, MAGIC_LINK_COOLDOWN_MS - (Date.now() - last));
      setMagicLinkCooldownMs(remaining);
    };

    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [showSignIn, signInEmail]);

  // Sync session state from backend (authoritative for pro + remaining credits)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!sessionId) return;
        setSessionMeLoading(true);
        await refreshSessionMe({
          force: true,
          reason: accessToken ? "bootstrap_auth" : "bootstrap_guest",
        });
      } catch {
        // Best effort: keep local state if backend unavailable.
        if (!cancelled) setSessionMeError("Failed to verify account. Please retry.");
      } finally {
        if (!cancelled) setSessionMeLoading(false);
      }
    })();
    return () => {
      // Prevent late state updates during route changes/unmount.
      cancelled = true;
    };
  }, [sessionId, accessToken, refreshSessionMe]);

  useEffect(() => {
    if (!sessionId) return;

    const onFocus = () => {
      refreshSessionMe({ reason: "focus" }).catch(() => {});
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshSessionMe({ reason: "visibility" }).catch(() => {});
    };

    const onOnline = () => {
      refreshSessionMe({ reason: "online" }).catch(() => {});
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
    };
  }, [sessionId, refreshSessionMe]);

  useEffect(() => {
    if (!sessionId) return;

    const clear = () => {
      if (idleMeTimerRef.current !== null) {
        window.clearTimeout(idleMeTimerRef.current);
        idleMeTimerRef.current = null;
      }
    };

    const schedule = () => {
      clear();
      idleMeTimerRef.current = window.setTimeout(async () => {
        idleMeTimerRef.current = null;

        const isVisible = document.visibilityState === "visible";
        const idleUi = appState !== "processing";
        const noJobs = pendingJobIdsRef.current.size === 0;
        const notActivating = !activationPending;
        if (!isVisible || !idleUi || !noJobs || !notActivating) {
          schedule();
          return;
        }

        const since = Date.now() - (lastSessionMeAtRef.current || 0);
        if (since >= SESSION_ME_IDLE_CAP_MS) {
          try {
            await refreshSessionMe({ reason: "idle_cap" });
          } catch {
            // ignore
          }
        }
        schedule();
      }, Math.max(5_000, Math.round(SESSION_ME_IDLE_CAP_MS / 2)));
    };

    schedule();
    return () => clear();
  }, [sessionId, appState, activationPending, refreshSessionMe]);

  // `isPro` is derived from backend `/api/v1/session/me`; don't persist as a local source of truth.

  const onDrop = useCallback((acceptedFiles: File[], fileRejections: any[]) => {
    const maxMb = isPro ? 25 : 10;
    if (fileRejections.length > 0) {
      const rejection = fileRejections[0];
      if (rejection.errors[0]?.code === "file-too-large") {
        toast.error(lang === "en" ? "File is too large" : "Ukuran file terlalu besar", { 
          description: lang === "en" ? `Maximum file size is ${maxMb}MB.` : `Maksimal ukuran file adalah ${maxMb}MB.`
        });
      } else if (rejection.errors[0]?.code === "file-invalid-type") {
        toast.error(lang === "en" ? "Invalid file type" : "Tipe file tidak valid", { 
          description: lang === "en" ? "Only JPEG, PNG, and WEBP are supported." : "Hanya format JPEG, PNG, dan WEBP yang didukung."
        });
      } else if (rejection.errors[0]?.code === "too-many-files") {
        const maxAllowed = isPro ? 30 : Math.min(3, quota);
        toast.error(lang === "en" ? `Max ${maxAllowed} files allowed` : `Maksimal ${maxAllowed} file`, {
          description: lang === "en"
            ? (isPro ? "Pro version accepts up to 30 files at a time." : "Free version accepts up to 3 files at a time.")
            : (isPro ? "Versi Pro menerima maksimal 30 file." : "Versi gratis menerima maksimal 3 file.")
        });
      } else {
        toast.error(lang === "en" ? "Error uploading file" : "Gagal mengunggah file");
      }
      return;
    }

    if (acceptedFiles.length === 0) return;

    if (!isPro && quota <= 0) {
      setShowPaywall(true);
      return;
    }

    const maxAllowed = isPro ? 30 : Math.min(3, quota);

    const maxBytes = isPro ? 25 * 1024 * 1024 : 10 * 1024 * 1024;
    let validFiles = acceptedFiles.filter(f => {
      const isValidType = ["image/jpeg", "image/png", "image/webp"].includes(f.type);
      const isValidSize = f.size <= maxBytes;
      return isValidType && isValidSize;
    });

    if (validFiles.length < acceptedFiles.length) {
      toast.error(lang === "en" ? "Some files skipped" : "Beberapa file dilewati", {
        description: lang === "en"
          ? `Invalid type or exceeding ${maxMb}MB limit.`
          : `Tipe tidak valid atau melebihi batas ${maxMb}MB.`
      });
    }

    if (validFiles.length > maxAllowed) {
      toast.error(lang === "en" ? `Max ${maxAllowed} files allowed` : `Maksimal ${maxAllowed} file`, {
        description: lang === "en"
          ? (isPro ? "Pro version accepts up to 30 files at a time." : "Free version accepts up to 3 files at a time.")
          : (isPro ? "Versi Pro menerima maksimal 30 file." : "Versi gratis menerima maksimal 3 file.")
      });
      validFiles = validFiles.slice(0, maxAllowed);
    }

    if (validFiles.length === 0) return;

    setFiles(validFiles);
    const urls = validFiles.map(f => URL.createObjectURL(f));
    setPreviewUrls(urls);
    setAppState("preview");
    posthog?.capture('images_uploaded', {
      file_count: validFiles.length,
      total_size_bytes: validFiles.reduce((acc, f) => acc + f.size, 0),
      is_pro: isPro,
    });
  }, [quota, lang, isPro, posthog]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/jpeg": [], "image/png": [], "image/webp": [] } as any,
    maxSize: (isPro ? 25 : 10) * 1024 * 1024,
    maxFiles: isPro ? 30 : Math.min(3, Math.max(0, quota)),
    multiple: true
  } as any);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current !== null) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    pollStartedAtRef.current = null;
    lastProgressSigRef.current = "";
    lastProgressChangeAtRef.current = null;
  }, []);

  const stopActivationPolling = useCallback(() => {
    if (activationTimerRef.current !== null) {
      window.clearTimeout(activationTimerRef.current);
      activationTimerRef.current = null;
    }
    activationStartedAtRef.current = null;
    setActivationPending(false);
  }, []);

  useEffect(() => {
    return () => {
      stopPolling();
      stopActivationPolling();
    };
  }, [stopPolling, stopActivationPolling]);

  const startActivationBridge = useCallback(() => {
    if (activationStartedAtRef.current !== null) return;
    activationStartedAtRef.current = Date.now();
    setActivationPending(true);

    const tick = async () => {
      let delay = 1500;
      try {
        // Prefer reconcile when available (best-effort rehydrate after checkout)
        const me = await reconcileSession({ sessionId });
        const requiresRestore =
          Boolean(me.is_pro) &&
          (forceRestore || Boolean(me.needs_restore) || !Boolean(me.pro_verified) || me.pro_source === "unknown");
        const proActive = Boolean(me.is_pro && me.pro_verified && !requiresRestore);
        const remaining = proActive ? me.pro_credits_remaining : me.credits_remaining;
        setIsPro(proActive);
        setNeedsRestore(Boolean(me.is_pro && !proActive));
        setQuota(Math.max(0, remaining));
        if (proActive) {
          localStorage.removeItem("imageopz_checkout_intent");
          toast.success("Pro activated");
          stopActivationPolling();
          return;
        }

        // If backend says there's no activation pending and we're not pro, stop polling.
        // Reconcile is not meant to be spammed indefinitely.
        if (!me.activation_pending && !me.is_pro) {
          localStorage.removeItem("imageopz_checkout_intent");
          stopActivationPolling();
          return;
        }
        if (me.activation_pending && typeof me.activation_retry_after_ms === "number" && me.activation_retry_after_ms > 0) {
          delay = Math.min(10_000, Math.max(500, me.activation_retry_after_ms));
        }
      } catch {
        // ignore
        delay = 2000;
      }

      const startedAt = activationStartedAtRef.current ?? Date.now();
      if (Date.now() - startedAt > 60_000) {
        stopActivationPolling();
        return;
      }

      if (activationTimerRef.current !== null) window.clearTimeout(activationTimerRef.current);
      activationTimerRef.current = window.setTimeout(() => {
        activationTimerRef.current = null;
        tick();
      }, delay);
    };

    // Run immediately on start
    tick();
  }, [sessionId, forceRestore, stopActivationPolling]);

  useEffect(() => {
    startActivationBridgeRef.current = startActivationBridge;
  }, [sessionId, accessToken, forceRestore, startActivationBridge]);

  const startProcessing = async () => {
    setAppState("processing");
    setProgress(0);
    stopPolling();
    setJobOrder([]);
    setJobStatuses({});
    jobStatusesRef.current = {};
    pollStartedAtRef.current = Date.now();
    lastProgressSigRef.current = "";
    lastProgressChangeAtRef.current = Date.now();

    try {
      // Preflight session state so bulk requests don't immediately trip free-tier rules
      try {
        const me = await refreshSessionMe({ force: true });
        if (me.activation_pending) {
          startActivationBridge();
          setAppState("preview");
          toast.info("Activating Pro…", {
            description: "Your payment is still activating. Please retry shortly.",
          });
          return;
        }
      } catch {
        // ignore
      }
      const queued = await optimizeImages({ images: files, sessionId, accessToken: accountClaimed ? accessToken : null });
      posthog?.capture('optimization_started', {
        file_count: files.length,
        total_size_bytes: files.reduce((acc, f) => acc + f.size, 0),
        is_pro: isPro,
      });
      const order = queued.results.map(r => r.job_id);
      setJobOrder(order);
      pendingJobIdsRef.current = new Set(order);
      pollCursorRef.current = 0;
      pollBackoffMsRef.current = 0;

      const loadOnce = async () => {
        const pending = Array.from(pendingJobIdsRef.current) as string[];
        if (pending.length === 0) return;

        const start = pollCursorRef.current % pending.length;
        const picks: string[] = [];
        const maxPicks = Math.min(MAX_STATUS_CHECKS_PER_TICK, pending.length);
        for (let i = 0; i < maxPicks; i++) picks.push(pending[(start + i) % pending.length]);
        pollCursorRef.current = (start + maxPicks) % pending.length;

        let saw429 = false;
        const statuses = await mapLimit(
          picks,
          MAX_STATUS_CONCURRENCY,
          async (id): Promise<JobStatusResponse | null> => {
            try {
              return await getJobStatus(id, { sessionId });
            } catch (e) {
              if (e instanceof ImageOpzApiError && e.status === 429) saw429 = true;
              return null;
            }
          }
        );

        const fresh = statuses.filter(Boolean) as JobStatusResponse[];
        if (fresh.length > 0) {
          const nextMap = { ...jobStatusesRef.current };
          for (const s of fresh) nextMap[s.job_id] = s;
          jobStatusesRef.current = nextMap;
          setJobStatuses(nextMap);
          for (const s of fresh) {
            if (s.status === "done" || s.status === "failed") pendingJobIdsRef.current.delete(s.job_id);
          }
        }

        if (saw429) {
          const next = Math.min(
            POLL_BACKOFF_MAX_MS,
            Math.max(POLL_BACKOFF_MIN_MS, Math.round((pollBackoffMsRef.current || POLL_BACKOFF_MIN_MS) * 1.8))
          );
          const jitter = Math.round(next * (0.1 * (Math.random() - 0.5)));
          pollBackoffMsRef.current = Math.max(POLL_BACKOFF_MIN_MS, next + jitter);
        } else {
          pollBackoffMsRef.current = Math.max(0, Math.round(pollBackoffMsRef.current * 0.6));
        }

        // Detect lack of progress / stuck jobs
        const allKnown = order.map(id => jobStatusesRef.current[id]).filter(Boolean) as JobStatusResponse[];
        const sig = allKnown
          .map(s => `${s.job_id}:${s.status}:${s.progress ?? ""}:${s.r2_url ?? ""}`)
          .sort()
          .join("|");
        if (sig !== lastProgressSigRef.current) {
          lastProgressSigRef.current = sig;
          lastProgressChangeAtRef.current = Date.now();
        }

        const progressValues = allKnown.map(s => {
          if (typeof s.progress === "number") return Math.max(0, Math.min(100, s.progress));
          if (s.status === "done" || s.status === "failed") return 100;
          if (s.status === "processing") return 50;
          return 5;
        });
        const avg =
          progressValues.length === 0
            ? 0
            : progressValues.reduce((a, b) => a + b, 0) / progressValues.length;
        setProgress(avg);

        const allFinished = pendingJobIdsRef.current.size === 0;
        if (allFinished) {
          stopPolling();
          setProgress(100);
          // Refresh credits/quota from backend (authoritative for both free & pro)
          try {
            const me = await refreshSessionMe({ force: true });
            const requiresRestore =
              Boolean(me.is_pro) &&
              (Boolean(me.needs_restore) || !Boolean(me.pro_verified) || me.pro_source === "unknown");
            const proActive = Boolean(me.is_pro && me.pro_verified && !requiresRestore);
            setIsPro(proActive);
            setNeedsRestore(requiresRestore);
            const remaining = proActive ? me.pro_credits_remaining : me.credits_remaining;
            setQuota(Math.max(0, remaining));
          } catch {}
          setAppState("result");
          try {
            const done = allKnown.filter((s) => s.status === "done" && typeof s.r2_url === "string" && s.r2_url);
            if (done.length > 0) {
              const createdAt = new Date().toISOString();
              const expiryCandidates = done.map((s) => s.expiry_date).filter(Boolean).sort();
              const expiresAt =
                expiryCandidates[0] ||
                new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
              saveResultBatch({
                session_id: sessionId,
                created_at: createdAt,
                expires_at: expiresAt,
                items: done.map((s) => ({
                  job_id: s.job_id,
                  filename: s.original_filename,
                  url: s.r2_url as string,
                  created_at: s.created_at,
                  expiry_date: s.expiry_date,
                  original_size: s.original_size,
                  optimized_size: s.optimized_size ?? null,
                })),
              });
            }
          } catch {
            // best effort
          }
          const doneCount = (statuses.filter(Boolean) as JobStatusResponse[]).filter(s => s?.status === "done").length;
          const failedCount = (statuses.filter(Boolean) as JobStatusResponse[]).filter(s => s?.status === "failed").length;
          posthog?.capture('optimization_completed', {
            file_count: order.length,
            done_count: doneCount,
            failed_count: failedCount,
            is_pro: isPro,
          });
          if (statuses.some(s => s.status === "done")) fireConfetti();
          return;
        }

        // Timeout guard: if nothing changes for 2 minutes, stop and prompt user
        const now = Date.now();
        const lastChange = lastProgressChangeAtRef.current ?? now;
        if (now - lastChange > 2 * 60 * 1000) {
          stopPolling();
          setAppState("preview");
          toast.error(lang === "en" ? "Processing is taking too long" : "Proses terlalu lama", {
            description:
              lang === "en"
                ? "The backend is not progressing these jobs. Please try again or check the worker."
                : "Backend tidak memproses job ini. Silakan coba lagi atau periksa worker.",
          });
        }
      };

      await loadOnce();
      const pollNext = async () => {
        if (pollTimerRef.current === null) return;
        await loadOnce();
        if (pollTimerRef.current === null) return;

        const pendingCount = pendingJobIdsRef.current.size;
        let delay =
          pendingCount >= 25 ? 4500 :
          pendingCount >= 15 ? 3500 :
          pendingCount >= 8 ? 2500 :
          pendingCount >= 3 ? 1600 :
          1200;
        if (pollBackoffMsRef.current > 0) delay = Math.max(delay, pollBackoffMsRef.current);
        pollTimerRef.current = window.setTimeout(pollNext, delay);
      };
      pollTimerRef.current = window.setTimeout(pollNext, 700);
    } catch (err) {
      stopPolling();
      setAppState("preview");
      posthog?.capture('optimization_failed', {
        error_message: err instanceof Error ? err.message : String(err),
        error_status: err instanceof ImageOpzApiError ? err.status : null,
        is_pro: isPro,
      });
      if (err instanceof ImageOpzApiError) {
        // If backend rate-limits/quota-limits, reflect that locally so UI blocks further requests.
        if (!isPro && err.status === 429) {
          const code = err.payload?.error;
          const retryAfter =
            typeof (err.payload?.details as any)?.retry_after_ms === "number"
              ? (err.payload?.details as any).retry_after_ms
              : null;

          if (code === "ACTIVATION_PENDING") {
            startActivationBridge();
            toast.warning("Activating Pro…", {
              description: "Payment detected but not activated yet. We’ll retry automatically.",
            });
            if (retryAfter && retryAfter > 0) {
              window.setTimeout(() => startProcessing(), Math.min(60_000, retryAfter));
            }
            return;
          }

          // Default fallback: treat as free-tier limit/rate-limit and guide user.
          startActivationBridge();
          toast.warning("Not activated yet", {
            description: "Payment might still be activating. Please retry in a few seconds.",
          });
          return;
        }
        toast.error(lang === "en" ? "Request failed" : "Permintaan gagal", {
          description: err.payload?.message || err.message,
        });
      } else {
        toast.error(lang === "en" ? "Request failed" : "Permintaan gagal");
      }
    }
  };

  const fireConfetti = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#18181b", "#ffffff", "#e4e4e7"]
    });
  };

  const handleReset = () => {
    stopPolling();
    setAppState("idle");
    setFiles([]);
    previewUrls.forEach(url => URL.revokeObjectURL(url));
    setPreviewUrls([]);
    setProgress(0);
    setJobOrder([]);
    setJobStatuses({});
    jobStatusesRef.current = {};
  };

  const originalSize = files.reduce((acc, f) => acc + f.size, 0);
  const estimatedMinutes = useMemo(() => {
    // Heuristic: ~40 seconds per image (27 images ≈ 18 minutes).
    const secondsPerImage = 40;
    return Math.max(1, Math.round((files.length * secondsPerImage) / 60));
  }, [files.length]);
  const aggregated = useMemo(() => {
    const statuses = jobOrder.map(id => jobStatuses[id]).filter(Boolean);
    const totalOriginal = statuses.reduce((acc, s) => acc + (s?.original_size ?? 0), 0);
    const totalOptimized = statuses.reduce((acc, s) => acc + (s?.optimized_size ?? 0), 0);
    const anyOptimized = statuses.some(s => typeof s?.optimized_size === "number");
    const savingsPct =
      anyOptimized && totalOriginal > 0
        ? Math.max(0, Math.min(100, Math.round((1 - totalOptimized / totalOriginal) * 100)))
        : 0;
    return { statuses, totalOriginal, totalOptimized, anyOptimized, savingsPct };
  }, [jobOrder, jobStatuses]);

  const getProgressStage = () => {
    const statuses = jobOrder.map(id => jobStatuses[id]).filter(Boolean);
    const latest = statuses.find(s => s?.progress_status)?.progress_status;
    if (latest) return latest;
    if (progress < 20) return t.progressStages[0];
    if (progress < 40) return t.progressStages[1];
    if (progress < 60) return t.progressStages[2];
    if (progress < 80) return t.progressStages[3];
    return t.progressStages[4];
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: t.title,
          text: t.shareText,
          url: window.location.origin
        });
      } catch (err) {
        console.error("Share failed:", err);
      }
    } else {
      navigator.clipboard.writeText(`${t.shareText}\n${window.location.origin}`);
      toast.success(t.copied);
    }
  };

  const handleDownloadUrl = useCallback((url: string) => {
    posthog?.capture('image_downloaded', { is_pro: isPro });
    window.open(url, "_blank", "noopener,noreferrer");
  }, [posthog, isPro]);

  const handleLogout = useCallback(() => {
    // Best-effort "logout": clear local identity markers, clear session cookie, and rotate session id.
    (async () => {
      try {
        await signOut();
      } catch {
        // ignore
      }
      try {
        setIsLoggingOut(true);
        const out = await logoutSession();
        localStorage.setItem("imageopz_session_id", out.session_id);
        setSessionId(out.session_id);
      } catch (err) {
        toast.error("Logout failed");
        setIsLoggingOut(false);
        return;
      }

      localStorage.removeItem("imageopz_email");
      localStorage.removeItem("imageopz_account_claimed");
      localStorage.setItem("imageopz_force_restore", "true");
      localStorage.setItem("imageopz_hide_restore_cta", "true");
      setAccountEmail(null);
      setAccountClaimed(false);
      setIsPro(false);
      setNeedsRestore(false);
      setForceRestore(true);
      setHideRestoreCta(true);
      setQuota(3);
      setSessionMeLoaded(false);
      setSessionMeError(null);
      setSessionMeLoading(true);
      toast.success("Logged out");
      setIsLoggingOut(false);
    })();
  }, [signOut]);

  useEffect(() => {
    // Handle restore result banner via query string (set by /auth/callback)
    try {
      const params = new URLSearchParams(window.location.search);
      const restoreResult = params.get("restore");
      if (!restoreResult) return;
      if (restoreResult === "ok") {
        toast.success("Pro restored");
        // Ensure UI reflects restored Pro immediately (a prior logout sets these flags).
        try {
          localStorage.removeItem("imageopz_force_restore");
          localStorage.removeItem("imageopz_hide_restore_cta");
        } catch {}
        setForceRestore(false);
        setHideRestoreCta(false);
      }
      if (restoreResult === "not_pro") toast.error("No Pro plan found for this account");
      // Clean URL
      const url = new URL(window.location.href);
      url.searchParams.delete("restore");
      window.history.replaceState({}, "", url.toString());
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    // If user just started a checkout, poll session/me for activation (guest pro via webhook)
    if (postCheckoutReconcileRanRef.current) return;
    if (localStorage.getItem("imageopz_checkout_intent") !== "true") return;
    postCheckoutReconcileRanRef.current = true;

    (async () => {
      try {
        // After returning from LemonSqueezy, ask backend to reconcile webhook activation into this session.
        await reconcileSession({ sessionId, accessToken: accountClaimed ? accessToken : null });
      } catch {
        // best effort
      }

      try {
        const me = await refreshSessionMe({ force: true });
        const requiresRestore =
          Boolean(me.is_pro) &&
          (forceRestore || Boolean(me.needs_restore) || !Boolean(me.pro_verified) || me.pro_source === "unknown");
        const proActive = Boolean(me.is_pro && me.pro_verified && !requiresRestore);
        setIsPro(proActive);
        setNeedsRestore(Boolean(me.is_pro && !proActive));
        const remaining = proActive ? me.pro_credits_remaining : me.credits_remaining;
        setQuota(Math.max(0, remaining));

        if (me.activation_pending) startActivationBridge();
        if (proActive) localStorage.removeItem("imageopz_checkout_intent");
      } catch {
        startActivationBridge();
      }
    })();
  }, [startActivationBridge, refreshSessionMe, sessionId, accessToken, accountClaimed, forceRestore]);

  const accountVerifying = (loadingAuth || Boolean(accessToken)) && !sessionMeLoaded;
  const quotaLabel = sessionMeLoading || accountVerifying ? "—" : String(quota);

  const retryVerifyAccount = useCallback(() => {
    (async () => {
      try {
        setSessionMeError(null);
        setSessionMeLoading(true);
        await refreshSessionMe({ force: true, reason: "retry_verify" });
      } catch {
        setSessionMeError("Failed to verify account. Please retry.");
      } finally {
        setSessionMeLoading(false);
      }
    })();
  }, [refreshSessionMe]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-foreground selection:text-background">
      <Toaster position="top-center" />

      {/* Header */}
      <header className="border-b border-border bg-background sticky top-0 z-50">
        <div className="container mx-auto min-h-16 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <img src="/logo.png" alt="ImageOpz" className="h-9 sm:h-10 w-auto object-contain" />
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="sm:hidden inline-flex items-center justify-center h-10 w-10 rounded-lg border border-border bg-background hover:bg-secondary/40 transition-colors"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>

            {/* Desktop controls */}
            <div className="hidden sm:flex flex-wrap items-center gap-3 sm:gap-4">
            <span className="text-sm font-medium text-muted-foreground hidden md:inline-flex items-center gap-1.5 opacity-70">
              <Zap className="w-4 h-4 text-accent fill-accent/20" />
              {quotaLabel} {t.optimizationsLeft}
            </span>

            {/* Pro / Purchase controls */}
            {accountVerifying ? (
              <div className="flex items-center gap-2">
                <div className="px-4 py-2 text-sm font-semibold bg-secondary text-foreground rounded-full border border-border/60 animate-pulse">
                  {lang === "en" ? "Verifying account…" : "Memverifikasi akun…"}
                </div>
                {sessionMeError && (
                  <button
                    className="px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
                    onClick={retryVerifyAccount}
                    type="button"
                  >
                    {lang === "en" ? "Retry" : "Coba lagi"}
                  </button>
                )}
                <button
                  className="px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  type="button"
                >
                  {isLoggingOut ? "Logging out..." : "Logout"}
                </button>
              </div>
            ) : isPro ? (
              <div className="flex items-center gap-2">
                <div className="px-4 py-2 text-sm font-semibold bg-secondary text-foreground rounded-full border border-border/60 max-w-[220px] truncate">
                  {isAuthenticated && accountEmail ? `Pro (${accountEmail})` : "Pro"}
                </div>
                {!isAuthenticated && !loadingAuth && !accountClaimed && (
                  <button
                    className="px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => {
                      setSignInPurpose("restore");
                      setShowSignIn(true);
                    }}
                    type="button"
                  >
                    Claim Pro
                  </button>
                )}
                <button
                  className="px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  type="button"
                >
                  {isLoggingOut ? "Logging out..." : "Logout"}
                </button>
                {quota <= 0 && (
                  <button
                    className="px-5 py-2 text-sm font-semibold text-primary-foreground bg-primary rounded-full hover:bg-primary/90 transition-colors"
                    onClick={() => setShowPaywall(true)}
                    type="button"
                  >
                    Add credits
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button 
                  className="px-5 py-2 text-sm font-semibold text-primary-foreground bg-primary rounded-full hover:bg-primary/90 transition-colors"
                  onClick={() => {
                    if (!hideRestoreCta && needsRestore) {
                      setSignInPurpose("restore");
                      setShowSignIn(true);
                      return;
                    }
                    else setShowPaywall(true);
                  }}
                  type="button"
                >
                  {hideRestoreCta ? "Upgrade to Pro" : needsRestore ? "Restore Pro" : "Upgrade to Pro"}
                </button>
                {accountClaimed && (
                  <button
                    className="px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    type="button"
                  >
                    {isLoggingOut ? "Logging out..." : "Logout"}
                  </button>
                )}
              </div>
            )}
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => navigate(lang === "id" ? "/id/my-results" : "/my-results")}
                  className="text-xs font-bold px-2 py-1 rounded transition-colors text-muted-foreground hover:bg-secondary/50"
                  type="button"
                >
                  {lang === "en" ? "Results" : "Hasil"}
                </button>
                <button 
                  onClick={() => navigate('/')} 
                  className={`text-xs font-bold px-2 py-1 rounded transition-colors ${lang === 'en' ? 'bg-secondary text-primary' : 'text-muted-foreground hover:bg-secondary/50'}`}
                >EN</button>
              <button 
                onClick={() => navigate('/id')} 
                className={`text-xs font-bold px-2 py-1 rounded transition-colors ${lang === 'id' ? 'bg-secondary text-primary' : 'text-muted-foreground hover:bg-secondary/50'}`}
              >ID</button>
            </div>
          </div>

          {/* Mobile menu */}
            {mobileMenuOpen && (
              <div className="sm:hidden w-full rounded-xl border border-border bg-background shadow-sm p-3">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5 font-medium opacity-80">
                    <Zap className="w-4 h-4 text-accent fill-accent/20" />
                    {quotaLabel} {t.optimizationsLeft}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        navigate(lang === "id" ? "/id/my-results" : "/my-results");
                      }}
                      className="text-xs font-bold px-2 py-1 rounded transition-colors text-muted-foreground hover:bg-secondary/50"
                      type="button"
                    >
                      {lang === "en" ? "Results" : "Hasil"}
                    </button>
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        navigate('/');
                    }}
                    className={`text-xs font-bold px-2 py-1 rounded transition-colors ${lang === 'en' ? 'bg-secondary text-primary' : 'text-muted-foreground hover:bg-secondary/50'}`}
                  >
                    EN
                  </button>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      navigate('/id');
                    }}
                    className={`text-xs font-bold px-2 py-1 rounded transition-colors ${lang === 'id' ? 'bg-secondary text-primary' : 'text-muted-foreground hover:bg-secondary/50'}`}
                  >
                    ID
                  </button>
                </div>
              </div>

              <div className="mt-3 flex flex-col gap-2">
                {accountVerifying ? (
                  <>
                    <div className="px-4 py-2 text-sm font-semibold bg-secondary text-foreground rounded-full border border-border/60 w-full animate-pulse">
                      {lang === "en" ? "Verifying account…" : "Memverifikasi akun…"}
                    </div>
                    {sessionMeError && (
                      <button
                        className="px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors text-left"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          retryVerifyAccount();
                        }}
                        type="button"
                      >
                        {lang === "en" ? "Retry verification" : "Coba verifikasi lagi"}
                      </button>
                    )}
                    <button
                      className="px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors text-left"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        handleLogout();
                      }}
                      disabled={isLoggingOut}
                      type="button"
                    >
                      {isLoggingOut ? "Logging out..." : "Logout"}
                    </button>
                  </>
                ) : isPro ? (
                  <>
                    <div className="px-4 py-2 text-sm font-semibold bg-secondary text-foreground rounded-full border border-border/60 w-full truncate">
                      {isAuthenticated && accountEmail ? `Pro (${accountEmail})` : "Pro"}
                    </div>
                    {!isAuthenticated && !loadingAuth && !accountClaimed && (
                      <button
                        className="px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors text-left"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          setSignInPurpose("restore");
                          setShowSignIn(true);
                        }}
                        type="button"
                      >
                        Claim Pro
                      </button>
                    )}
                    <button
                      className="px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors text-left"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        handleLogout();
                      }}
                      disabled={isLoggingOut}
                      type="button"
                    >
                      {isLoggingOut ? "Logging out..." : "Logout"}
                    </button>
                    {quota <= 0 && (
                      <button
                        className="px-5 py-2 text-sm font-semibold text-primary-foreground bg-primary rounded-full hover:bg-primary/90 transition-colors"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          setShowPaywall(true);
                        }}
                        type="button"
                      >
                        Add credits
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button 
                      className="px-5 py-2 text-sm font-semibold text-primary-foreground bg-primary rounded-full hover:bg-primary/90 transition-colors"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        if (!hideRestoreCta && needsRestore) {
                          setSignInPurpose("restore");
                          setShowSignIn(true);
                          return;
                        }
                        else setShowPaywall(true);
                      }}
                      type="button"
                    >
                      {hideRestoreCta ? "Upgrade to Pro" : needsRestore ? "Restore Pro" : "Upgrade to Pro"}
                    </button>
                    {accountClaimed && (
                      <button
                        className="px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors text-left"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          handleLogout();
                        }}
                        disabled={isLoggingOut}
                        type="button"
                      >
                        {isLoggingOut ? "Logging out..." : "Logout"}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-12 md:py-24 flex flex-col items-center">
        
        {/* Main View Area */}
        <div className="w-full relative">
          <AnimatePresence mode="wait">
            
            {/* IDLE STATE */}
            {appState === "idle" && (
              <motion.div
                key="idle"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="w-full text-center space-y-12"
              >
                <div className="space-y-6 max-w-3xl mx-auto">
                  <Badge className="bg-secondary text-primary font-bold tracking-wider px-3 py-1 text-xs uppercase rounded-lg border-none hover:bg-secondary/80">
                    {t.lcpKiller}
                  </Badge>
                  <h1 className="font-serif text-5xl md:text-6xl leading-[1.1] font-medium tracking-tight">
                    {t.headlineMain} <br className="hidden md:block" /> 
                    <span className="italic text-primary">{t.headlineSub}</span>
                  </h1>
                  <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                    {t.description}
                  </p>
                  <div className="flex flex-col items-center gap-3 pt-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground/80">{t.socialProof}:</span>
                      <span className="font-mono">{t.socialProofExample}</span>
                    </div>
                    <Button
                      size="lg"
                      onClick={() => dropzoneRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
                      className="font-bold flex gap-2"
                    >
                      {t.heroCta} <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div ref={dropzoneRef} className="max-w-2xl mx-auto relative group">
                  {/* Decorative background glow */}
                  <div className="absolute inset-0 bg-zinc-200/50 dark:bg-zinc-800/50 rounded-3xl blur-2xl transition-all duration-500 group-hover:bg-zinc-300/50 dark:group-hover:bg-zinc-700/50 -z-10" />
                  
                  <Card 
                    {...getRootProps()} 
                    role="button"
                    aria-label={t.dropYourImage}
                    aria-describedby="dropzone-description"
                    className={`border-2 border-dashed bg-muted rounded-[48px] overflow-hidden cursor-pointer transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/50 focus-visible:border-primary
                      ${isDragActive ? 'border-primary bg-primary/5 scale-[1.02]' : 'border-accent/30 hover:border-accent/60'}`}
                  >
                    <CardContent className="flex flex-col items-center justify-center py-20 px-6 text-center">
                      <input {...getInputProps()} id="dropzone-file-input" aria-hidden="true" />
                      <div className="w-24 h-24 rounded-[32px] bg-background shadow-lg flex items-center justify-center mb-6 text-primary group-hover:scale-105 transition-transform" aria-hidden="true">
                        <UploadCloud className="w-10 h-10" strokeWidth={1.5} />
                      </div>
                      <h3 className="font-serif text-2xl font-medium mb-2">{t.dropYourImage}</h3>
                      <p id="dropzone-description" className="text-muted-foreground mb-6 max-w-[250px]">
                        {t.supportFormat}
                      </p>
                      <div className="flex gap-2 justify-center" aria-hidden="true">
                        <span className="px-3 py-1 bg-secondary text-primary rounded-lg text-xs font-bold tracking-wider uppercase">JPG</span>
                        <span className="px-3 py-1 bg-secondary text-primary rounded-lg text-xs font-bold tracking-wider uppercase">PNG</span>
                        <span className="px-3 py-1 bg-secondary text-primary rounded-lg text-xs font-bold tracking-wider uppercase">WEBP</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </motion.div>
            )}

            {/* PREVIEW STATE */}
            {appState === "preview" && files.length > 0 && previewUrls.length > 0 && (
              <motion.div
                key="preview"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                transition={{ duration: 0.3 }}
                className="w-full max-w-xl mx-auto space-y-8"
              >
                <div className="space-y-4 text-center">
                  <h2 className="text-3xl font-serif font-medium tracking-tight">{t.imagePreview}</h2>
                  <p className="text-muted-foreground">{t.readyToOptimize}</p>
                </div>
                
                <Card className="overflow-hidden border-border bg-card shadow-sm rounded-3xl">
                  {previewUrls.length === 1 ? (
                    <div className="relative aspect-video bg-muted/50 flex items-center justify-center p-4">
                      <img src={previewUrls[0]} alt={t.imagePreview} className="max-w-full max-h-full object-contain rounded-xl shadow-sm" />
                    </div>
                  ) : (
                    <div className="relative bg-muted/50 p-4 grid grid-cols-3 gap-3 overflow-y-auto max-h-[300px]">
                      {previewUrls.map((url, i) => (
                        <div key={i} className="aspect-square bg-background rounded-lg shadow-sm flex items-center justify-center overflow-hidden border border-border/50">
                           <img src={url} alt={`preview ${i}`} className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  )}
                  <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        {files.length === 1 ? (
                          <p className="font-medium truncate max-w-full sm:max-w-[200px]">{files[0].name}</p>
                        ) : (
                          <p className="font-medium">{files.length} {lang === 'en' ? 'images selected' : 'gambar dipilih'}</p>
                        )}
                        <p className="text-sm text-muted-foreground">{formatBytes(originalSize)}</p>
                        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                          <div>📦 {files.length} {t.imagesDetected}</div>
                          <div>⏱ {t.estimatedTime}: ~{estimatedMinutes} {t.minuteShort}</div>
                        </div>
                      </div>
                      <Button size="lg" onClick={startProcessing} className="w-full sm:w-auto font-bold flex gap-2">
                        <Zap className="w-4 h-4" /> {t.startOptimization}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                
                <div className="text-center">
                   <button onClick={handleReset} className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors">
                     {t.optimizeAnother}
                   </button>
                 </div>
              </motion.div>
            )}

            {/* PROCESSING STATE */}
            {appState === "processing" && (
              <motion.div
                key="processing"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                transition={{ duration: 0.4, type: "spring" }}
                className="w-full max-w-xl mx-auto text-center space-y-8 py-20"
              >
                <div className="relative w-24 h-24 mx-auto">
                  <div className="absolute inset-0 rounded-full border-4 border-muted" />
                  <motion.div 
                    className="absolute inset-0 rounded-full border-4 border-foreground border-t-transparent"
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-mono text-xs sm:text-sm font-medium px-2 text-center">
                      {progress > 0 ? `${Math.round(progress)}%` : t.connecting}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 h-16 flex flex-col items-center justify-start">
                  <h3 className="text-2xl font-bold tracking-tight">{t.crunching}</h3>
                  <AnimatePresence mode="popLayout">
                    <motion.p
                      key={getProgressStage()}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="text-muted-foreground"
                    >
                      {getProgressStage()}
                    </motion.p>
                  </AnimatePresence>
                </div>

                <div className="text-sm text-muted-foreground">
                  {t.processingHint}
                </div>

                {activationPending && (
                  <div className="text-sm text-muted-foreground">
                    Activating Pro… (waiting for webhook)
                  </div>
                )}

                {/* Debug-friendly per-job status */}
                {jobOrder.length > 0 && (
                  <div className="text-left max-w-xl mx-auto space-y-2 text-xs text-muted-foreground">
                    {jobOrder.map((id) => {
                      const s = jobStatuses[id];
                      if (!s) return (
                        <div key={id} className="flex justify-between">
                          <span className="font-mono truncate max-w-[70%]">{id}</span>
                          <span>loading…</span>
                        </div>
                      );
                      return (
                        <div key={id} className="flex justify-between gap-3">
                          <span className="font-mono truncate max-w-[70%]">{s.original_filename}</span>
                          <span>{s.status}{typeof s.progress === "number" ? ` (${Math.round(s.progress)}%)` : ""}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {/* RESULT STATE */}
            {appState === "result" && files.length > 0 && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full space-y-10"
              >
                <div className="text-center space-y-4">
                  <Badge className="bg-secondary/50 text-primary border-none px-3 py-1 text-sm font-medium">
                    <CheckCircle className="w-4 h-4 mr-1.5 inline -translate-y-px" /> {t.optimizationComplete}
                  </Badge>
                  <h2 className="text-4xl font-serif font-bold tracking-tight">
                    {t.massiveSavings.split('!')[0]} <span className="italic text-primary">!</span>
                  </h2>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="bg-card border-border shadow-sm rounded-3xl">
                    <CardContent className="p-6 text-center space-y-1">
                      <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold">{t.originalSize}</p>
                      <p className="text-2xl font-serif font-medium">{formatBytes(aggregated.anyOptimized ? aggregated.totalOriginal : originalSize)}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-primary text-primary-foreground border-primary relative overflow-hidden group shadow-sm rounded-3xl">
                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent group-hover:opacity-20 transition-opacity" />
                    <CardContent className="p-6 text-center space-y-1 relative z-10">
                      <p className="text-xs uppercase tracking-widest text-primary-foreground/70 font-bold">{t.newSize}</p>
                      <p className="text-4xl font-serif font-bold tracking-tight text-white/90">
                        {formatBytes(aggregated.anyOptimized ? aggregated.totalOptimized : 0)}
                      </p>
                      <p className="text-xs text-primary-foreground/50 mt-1 italic">↓ {aggregated.savingsPct}% {t.reduction}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-card border-border shadow-sm rounded-3xl">
                    <CardContent className="p-6 text-center space-y-1">
                      <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold">{t.estLoadTime}</p>
                      <p className="text-2xl font-serif font-medium">1.2s → 0.3s</p>
                      <p className="text-xs text-muted-foreground mt-1 italic">{t.lighthouseBoost}</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8 border-t border-border">
                  {aggregated.statuses.filter(s => s.status === "done" && typeof s.r2_url === "string" && s.r2_url.length > 0).length <= 1 ? (
                    <button
                      onClick={() => {
                        const url =
                          aggregated.statuses.find(s => s.status === "done" && typeof s.r2_url === "string" && s.r2_url.length > 0)?.r2_url ?? null;
                        if (url) handleDownloadUrl(url);
                      }}
                      disabled={!aggregated.statuses.some(s => s.status === "done" && typeof s.r2_url === "string" && s.r2_url.length > 0)}
                      className="rounded-full w-full sm:w-auto px-8 py-3 bg-accent text-accent-foreground font-bold hover:bg-accent/90 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" /> {t.downloadImage}
                    </button>
                  ) : (
                    <div className="w-full sm:w-auto flex flex-col gap-2">
                      {aggregated.statuses
                        .filter(s => s.status === "done" && typeof s.r2_url === "string" && s.r2_url.length > 0)
                        .map(s => (
                          <button
                            key={s.job_id}
                            onClick={() => handleDownloadUrl(s.r2_url as string)}
                            className="rounded-full w-full px-8 py-3 bg-accent text-accent-foreground font-bold hover:bg-accent/90 transition-colors flex items-center justify-center gap-2"
                          >
                            <Download className="w-4 h-4" /> {t.downloadImage} ({s.original_filename})
                          </button>
                        ))}
                    </div>
                  )}
                  <button onClick={handleShare} className="rounded-full w-full sm:w-auto px-8 py-3 bg-secondary text-secondary-foreground font-bold hover:bg-secondary/80 transition-colors flex items-center justify-center gap-2">
                    <Share2 className="w-4 h-4" /> {t.shareResult}
                  </button>
                </div>

                <div className="text-center">
                  <button onClick={handleReset} className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors">
                    {t.optimizeAnother}
                  </button>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 p-4 rounded-xl text-center text-sm font-medium max-w-lg mx-auto">
                  {(() => {
                    const expiry = aggregated.statuses
                      .map(s => s.expiry_date)
                      .filter(Boolean)
                      .sort()[0];
                    if (!expiry) return t.privacyWarning;
                    const d = new Date(expiry);
                    const formatted = isNaN(d.getTime()) ? expiry : d.toLocaleString();
                    return lang === "en"
                      ? `Privacy: files expire at ${formatted}.`
                      : `Privasi: file kedaluwarsa pada ${formatted}.`;
                  })()}
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* How it Works Section */}
        {appState === "idle" && (
           <div className="mt-20 w-full self-stretch bg-secondary/50 border-t border-border py-16 px-4">
             <div className="container mx-auto max-w-5xl space-y-16 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
               <div className="text-center space-y-4 max-w-2xl mx-auto">
                  <h2 className="text-3xl font-serif font-medium tracking-tight">{t.howItWorks}</h2>
                  <p className="text-muted-foreground">{t.howItWorksSub}</p>
               </div>

               <div className="grid gap-8 md:grid-cols-3 md:gap-10 text-left">
                  <div className="flex gap-4 min-w-0">
                    <span className="text-primary font-serif text-4xl font-light italic shrink-0">01.</span>
                    <div className="min-w-0">
                      <h4 className="font-bold mb-1">{t.step1Title}</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {t.step1Desc}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4 min-w-0">
                    <span className="text-primary font-serif text-4xl font-light italic shrink-0">02.</span>
                    <div className="min-w-0">
                      <h4 className="font-bold mb-1">{t.step2Title}</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {t.step2Desc}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4 min-w-0">
                    <span className="text-primary font-serif text-4xl font-light italic shrink-0">03.</span>
                    <div className="min-w-0">
                      <h4 className="font-bold mb-1">{t.step3Title}</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {t.step3Desc}
                      </p>
                    </div>
                  </div>
               </div>
             </div>
           </div>
        )}

      </main>

      {/* Footer */}
      <footer className="w-full bg-secondary/30 border-t border-border py-8">
        <div className="container mx-auto max-w-5xl flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2 text-center md:text-left">
            <img src="/favicon.png" alt="ImageOpz" className="h-10 w-auto object-contain" />
            <span className="ml-2 break-words">{t.footerRights}</span>
          </div>
          <div className="flex flex-wrap justify-center md:justify-end gap-x-6 gap-y-2 font-medium">
            <button
              onClick={() => setShowFeedback(true)}
              className="hover:text-primary transition-colors whitespace-nowrap"
            >
              {t.footerContact}
            </button>
            <a href="#" className="hover:text-primary transition-colors whitespace-nowrap">
              {t.footerTerms}
            </a>
            <a href="#" className="hover:text-primary transition-colors whitespace-nowrap">
              {t.footerPrivacy}
            </a>
          </div>
        </div>
      </footer>

      {/* Paywall Modal */}
      <Dialog open={showPaywall} onOpenChange={setShowPaywall}>
        <DialogContent className="p-0 overflow-hidden border-none bg-transparent shadow-2xl sm:max-w-md">
          <Card className="w-full border-none rounded-xl">
            <div className="bg-foreground px-6 py-10 text-background text-center relative overflow-hidden">
               <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
               <div className="relative z-10 space-y-4">
                  <Badge variant="outline" className="text-background border-background/20 font-medium">
                    {t.proPlan}
                  </Badge>
                  <h2 className="text-3xl font-bold tracking-tight">{t.outOfCredits}</h2>
                  <p className="text-background/80 font-medium max-w-xs mx-auto">
                    {t.supportIndie}
                  </p>
               </div>
            </div>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-primary" />
                  <span>{t.proFeature1}</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-primary" />
                  <span>{t.proFeature2}</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-primary" />
                  <span>{t.proFeature3}</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-primary" />
                  <span>{t.proFeature4}</span>
                </div>
              </div>
              
              <div className="pt-4 border-t">
                <div className="flex items-end justify-between font-bold mb-4">
                  <span className="text-lg">100 Credits</span>
                  <span className="text-3xl tracking-tighter">$9<span className="text-lg text-muted-foreground font-normal">.99</span></span>
                </div>
                <Button 
                  size="lg" 
                  className="w-full font-semibold"
                  onClick={() => setShowPaymentConfirm(true)}
                >
                  <CreditCard className="w-4 h-4 mr-2" /> {t.buyCredits}
                </Button>
                 <button
                    onClick={() => {
                      stopActivationPolling();
                      setSignInPurpose("restore");
                      setShowSignIn(true);
                    }}
                    className="mt-3 w-full text-xs font-semibold text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
                  >
                  {lang === "en" ? "Already purchased? Restore Pro" : "Sudah pernah beli? Pulihkan Pro"}
                </button>
                <p className="text-xs text-center text-muted-foreground mt-3 flex items-center justify-center gap-1">
                  Powered by LemonSqueezy <LockIcon className="w-3 h-3" />
                </p>
              </div>
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>

      {/* Sign In Modal (Supabase Magic Link) */}
      <Dialog open={showSignIn} onOpenChange={setShowSignIn}>
        <DialogContent className="sm:max-w-md border-border bg-card shadow-xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif">{signInPurpose === "restore" ? "Restore Pro" : "Sign in"}</DialogTitle>
            <DialogDescription>
              {signInPurpose === "restore"
                ? "We’ll email you a magic link. After signing in, we’ll verify whether this account has Pro."
                : "We’ll email you a magic link. No password required."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              placeholder={t.emailPlaceholder}
              value={signInEmail}
              onChange={(e) => setSignInEmail(e.target.value)}
              disabled={signInSending}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" disabled={signInSending} onClick={() => setShowSignIn(false)}>
              Cancel
            </Button>
            <Button
              disabled={signInSending || magicLinkCooldownMs > 0}
              onClick={() => {
                const email = signInEmail.trim();
                if (!email || !email.includes("@")) {
                  toast.error("Email required");
                  return;
                }

                const emailKey = email.trim().toLowerCase();
                const key = emailKey ? `imageopz_magic_link_last_sent_at:${emailKey}` : "imageopz_magic_link_last_sent_at";
                const raw = localStorage.getItem(key) ?? localStorage.getItem("imageopz_magic_link_last_sent_at");
                const last = raw ? Number(raw) : 0;
                const remaining =
                  Number.isFinite(last) && last > 0 ? Math.max(0, MAGIC_LINK_COOLDOWN_MS - (Date.now() - last)) : 0;
                if (remaining > 0) {
                  toast.info("Please wait before requesting another link", {
                    description: `Try again in ${Math.ceil(remaining / 1000)}s.`,
                  });
                  return;
                }
                (async () => {
                  try {
                    setSignInSending(true);
                    stopActivationPolling();
                    if (signInPurpose === "restore") {
                      localStorage.setItem("imageopz_restore_intent", "true");
                      localStorage.setItem("imageopz_restore_email", email);
                    } else {
                      localStorage.removeItem("imageopz_restore_intent");
                      localStorage.removeItem("imageopz_restore_email");
                    }

                    // Apply cooldown immediately (even if Supabase returns 429) to avoid spamming.
                    const emailKey = email.trim().toLowerCase();
                    const key = emailKey ? `imageopz_magic_link_last_sent_at:${emailKey}` : "imageopz_magic_link_last_sent_at";
                    localStorage.setItem(key, String(Date.now()));
                    setMagicLinkCooldownMs(MAGIC_LINK_COOLDOWN_MS);

                    await signInWithMagicLink(email);
                    toast.success("Magic link sent");
                    setShowSignIn(false);
                  } catch (err) {
                    const msg = (err as any)?.message ? String((err as any).message) : "";
                    if (msg.toLowerCase().includes("too many")) {
                      toast.error("Too many requests", { description: "Please wait 1–2 minutes and try again." });
                    } else {
                      toast.error("Failed to send magic link");
                    }
                  } finally {
                    setSignInSending(false);
                  }
                })();
              }}
            >
              {signInSending
                ? "Sending..."
                : magicLinkCooldownMs > 0
                  ? `Send magic link (${Math.ceil(magicLinkCooldownMs / 1000)}s)`
                  : "Send magic link"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Confirmation Modal */}
      <Dialog open={showPaymentConfirm} onOpenChange={setShowPaymentConfirm}>
        <DialogContent className="sm:max-w-md border-border bg-card shadow-xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif">{t.confirmPaymentTitle}</DialogTitle>
            <DialogDescription>
              {t.confirmPaymentDesc}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{lang === "en" ? "Email" : "Email"}</Label>
            <Input
              type="email"
              placeholder={t.emailPlaceholder}
              value={checkoutEmail}
              onChange={(e) => setCheckoutEmail(e.target.value)}
              disabled={isCreatingCheckout}
            />
          </div>
          {isCreatingCheckout && (
            <div className="text-sm text-muted-foreground">
              {lang === "en" ? "Creating checkout, please wait..." : "Membuat checkout, mohon tunggu..."}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              disabled={isCreatingCheckout}
              onClick={() => setShowPaymentConfirm(false)}
            >
              {t.cancel}
            </Button>
            <Button onClick={() => {
              const email = checkoutEmail.trim();
              if (!email || !email.includes("@")) {
                toast.error(lang === "en" ? "Email required" : "Email wajib diisi");
                return;
              }

              (async () => {
                try {
                  setIsCreatingCheckout(true);
                  const checkout = await createLemonSqueezyCheckout({
                    email,
                    sessionId,
                    accessToken: accountClaimed ? accessToken : null,
                  });
                  posthog?.capture('checkout_initiated', { email, provider: checkout.provider ?? 'lemonsqueezy' });
                  localStorage.setItem("imageopz_checkout_intent", "true");
                  localStorage.setItem("imageopz_email", email);
                  setAccountEmail(email);
                  if (checkout.session_id) {
                    localStorage.setItem("imageopz_session_id", checkout.session_id);
                    setSessionId(checkout.session_id);
                  }
                  // Sync backend session state before redirect (cookie/session may be updated server-side)
                  try {
                    const me = await refreshSessionMe({
                      force: true,
                      sessionIdOverride: checkout.session_id ?? sessionId,
                      accessTokenOverride: accessToken,
                    });
                    const requiresRestore =
                      Boolean(me.is_pro) && (Boolean(me.needs_restore) || !Boolean(me.pro_verified) || me.pro_source === "unknown");
                    setIsPro(Boolean(me.is_pro && me.pro_verified && !requiresRestore));
                    setNeedsRestore(requiresRestore);
                    if (!me.is_pro) setQuota(Math.max(0, me.credits_remaining));
                  } catch {}
                  localStorage.removeItem("imageopz_force_restore");
                  setForceRestore(false);
                  localStorage.removeItem("imageopz_hide_restore_cta");
                  setHideRestoreCta(false);
                  setShowPaymentConfirm(false);
                  setShowPaywall(false);
                  window.location.href = checkout.checkout_url;
                } catch (err) {
                  setIsCreatingCheckout(false);
                  if (err instanceof ImageOpzApiError) {
                    toast.error(lang === "en" ? "Checkout failed" : "Checkout gagal", {
                      description: err.payload?.message || err.message,
                    });
                  } else {
                    toast.error(lang === "en" ? "Checkout failed" : "Checkout gagal");
                  }
                }
              })();
            }}
            disabled={isCreatingCheckout}
            >
              {isCreatingCheckout ? (lang === "en" ? "Redirecting..." : "Mengalihkan...") : t.confirm}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Floating Feedback Widget */}
      <Dialog open={showFeedback} onOpenChange={setShowFeedback}>
        <DialogContent className="sm:max-w-md border-border bg-card shadow-xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif">{t.feedbackTitle}</DialogTitle>
            <DialogDescription>
              {t.feedbackSub}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <textarea 
              className="w-full min-h-[120px] p-3 text-sm bg-muted/50 rounded-xl border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none" 
              placeholder={t.feedbackPlaceholder}
            />
            <Button size="lg" className="w-full font-bold" onClick={() => {
              toast.success(t.feedbackSent);
              setShowFeedback(false);
            }}>
              {t.sendFeedback}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      <div className="fixed bottom-6 right-6 z-50">
        <button 
          className="rounded-full w-14 h-14 bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all flex items-center justify-center"
          onClick={() => setShowFeedback(true)}
        >
          <MessageSquare className="w-6 h-6" />
        </button>
      </div>

      {/* Global checkout redirect loading overlay */}
      {isCreatingCheckout && (
        <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-xl p-6 text-center space-y-4">
            <div className="relative w-16 h-16 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-muted" />
              <motion.div
                className="absolute inset-0 rounded-full border-4 border-foreground border-t-transparent"
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              />
            </div>
            <div className="space-y-1">
              <p className="font-semibold">
                {lang === "en" ? "Redirecting to LemonSqueezy…" : "Mengalihkan ke LemonSqueezy…"}
              </p>
              <p className="text-sm text-muted-foreground">
                {lang === "en" ? "Please wait a moment." : "Mohon tunggu sebentar."}
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function LockIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function GlobalRouter() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Use navigator.language to detect Indonesian users securely
    if (location.pathname === "/") {
      try {
        const userLang = navigator.language || (navigator as any).userLanguage || "";
        if (userLang.toLowerCase().startsWith('id')) {
          navigate('/id', { replace: true });
        }
      } catch (err) {
        console.error("Language detection failed:", err);
      }
    }
  }, [location.pathname, navigate]);

  return (
    <Routes>
      <Route path="/" element={<AppContent lang="en" />} />
      <Route path="/id" element={<AppContent lang="id" />} />
      <Route path="/my-results" element={<MyResultsPage lang="en" />} />
      <Route path="/id/my-results" element={<MyResultsPage lang="id" />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="*" element={<AppContent lang="en" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <GlobalRouter />
      <Analytics />
    </BrowserRouter>
  );
}
