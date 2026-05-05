import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "motion/react";
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
  ArrowRight
} from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import confetti from "canvas-confetti";
import { BrowserRouter, Routes, Route, useNavigate, useParams, useLocation } from "react-router-dom";
import {
  optimizeImages,
  getJobStatus,
  createLemonSqueezyCheckout,
  restoreProSession,
  getSessionMe,
  logoutSession,
  ImageOpzApiError,
  type JobStatusResponse,
} from "@/lib/imageopzApi";

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
    headlineMain: "Refine your visuals",
    headlineSub: "in seconds.",
    description: "Professional-grade AI image processing for creators. Simple, organic, and lightning fast.",
    dropYourImage: "Drop your image here",
    supportFormat: "Support for JPEG, PNG, WEBP up to 10MB per file.",
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
    step1Desc: "Client-side validation ensures you only send valid images. 10MB limit keeps our Edge network fast and responsive without arbitrary bloat.",
    step2Title: "Edge Processing",
    step2Desc: "Next.js Edge functions validate and rate-limit, passing your image to our dedicated Vultr instance powered by highly tuned Python compression algorithms.",
    step3Title: "Deliver & Wipe",
    step3Desc: "You get a WebP/AVIF file that's 80%+ smaller. For your privacy, the raw and optimized files are purged from our hybrid R2 storage within 7 days.",
    proPlan: "Pro Plan",
    imagePreview: "Image Preview",
    readyToOptimize: "Ready to optimize?",
    startOptimization: "Start Optimization",
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
    headlineMain: "Ubah Gambar AI Raksasa",
    headlineSub: "Menjadi WebP/AVIF Super Cepat dalam Detik.",
    description: "Solusi instan optimasi gambar untuk developer web. Kompresi otomatis tanpa membebani performa browser Anda.",
    dropYourImage: "Jatuhkan gambar AI di sini",
    supportFormat: "Mendukung JPEG, PNG, WEBP (Max. 10MB)",
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
    step1Desc: "Validasi sisi klien memastikan hanya gambar valid yang diproses. Batas 10MB menjaga jaringan Edge tetap responsif.",
    step2Title: "Pemrosesan Edge",
    step2Desc: "Fungsi Edge memvalidasi dan membatasi traffic, lalu mengirimkan gambar Anda ke engine kompresi cerdas kami.",
    step3Title: "Kirim & Hapus",
    step3Desc: "Anda mendapatkan file WebP/AVIF yang jauh lebih kecil. Demi privasi Anda, file asli dan hasil akan dihapus dalam 7 hari.",
    proPlan: "Paket Pro",
    imagePreview: "Pratinjau Gambar",
    readyToOptimize: "Siap untuk optimasi?",
    startOptimization: "Mulai Optimasi",
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

  const [appState, setAppState] = useState<"idle" | "preview" | "processing" | "result">("idle");
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [quota, setQuota] = useState<number>(3);
  const [isPro, setIsPro] = useState(false);
  const [needsRestore, setNeedsRestore] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [forceRestore, setForceRestore] = useState(false);
  const [hideRestoreCta, setHideRestoreCta] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showPaymentConfirm, setShowPaymentConfirm] = useState(false);
  const [checkoutEmail, setCheckoutEmail] = useState("");
  const [isCreatingCheckout, setIsCreatingCheckout] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showRestore, setShowRestore] = useState(false);
  const [restoreEmail, setRestoreEmail] = useState("");
  const [progress, setProgress] = useState(0);
  const [jobOrder, setJobOrder] = useState<string[]>([]);
  const [jobStatuses, setJobStatuses] = useState<Record<string, JobStatusResponse>>({});
  const [showFeedback, setShowFeedback] = useState(false);
  const pollTimerRef = useRef<number | null>(null);

  // Load quota on mount
  useEffect(() => {
    const saved = localStorage.getItem("imageopz_quota");
    if (saved !== null) {
      setQuota(parseInt(saved, 10));
    }
    const savedEmail = localStorage.getItem("imageopz_email");
    if (savedEmail) setAccountEmail(savedEmail);
    setForceRestore(localStorage.getItem("imageopz_force_restore") === "true");
    setHideRestoreCta(localStorage.getItem("imageopz_hide_restore_cta") === "true");

    const existingSessionId = localStorage.getItem("imageopz_session_id");
    if (existingSessionId) {
      setSessionId(existingSessionId);
    } else if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      const id = crypto.randomUUID();
      localStorage.setItem("imageopz_session_id", id);
      setSessionId(id);
    }
  }, []);

  // Sync session state from backend (authoritative for pro + remaining credits)
  useEffect(() => {
    (async () => {
      try {
        const me = await getSessionMe({ sessionId });
        if (me.session_id) {
          localStorage.setItem("imageopz_session_id", me.session_id);
          setSessionId(me.session_id);
        }
        const requiresRestore =
          Boolean(me.is_pro) &&
          (forceRestore || Boolean(me.needs_restore) || !Boolean(me.pro_verified) || me.pro_source === "unknown");
        const proActive = Boolean(me.is_pro && me.pro_verified && !requiresRestore);
        setIsPro(proActive);
        setNeedsRestore(requiresRestore);
        const remaining = proActive ? me.pro_credits_remaining : me.credits_remaining;
        setQuota(Math.max(0, remaining));
      } catch {
        // Best effort: keep local state if backend unavailable.
      }
    })();
  }, [sessionId, forceRestore]);

  // Save quota on change
  useEffect(() => {
    localStorage.setItem("imageopz_quota", quota.toString());
  }, [quota]);

  // `isPro` is derived from backend `/api/v1/session/me`; don't persist as a local source of truth.

  const onDrop = useCallback((acceptedFiles: File[], fileRejections: any[]) => {
    if (fileRejections.length > 0) {
      const rejection = fileRejections[0];
      if (rejection.errors[0]?.code === "file-too-large") {
        const maxMb = isPro ? 50 : 10;
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

    const maxBytes = isPro ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    let validFiles = acceptedFiles.filter(f => {
      const isValidType = ["image/jpeg", "image/png", "image/webp"].includes(f.type);
      const isValidSize = f.size <= maxBytes;
      return isValidType && isValidSize;
    });

    if (validFiles.length < acceptedFiles.length) {
      toast.error(lang === "en" ? "Some files skipped" : "Beberapa file dilewati", {
        description: lang === "en" ? "Invalid type or exceeding 10MB limit." : "Tipe tidak valid atau melebihi batas 10MB."
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
  }, [quota, lang, isPro]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/jpeg": [], "image/png": [], "image/webp": [] } as any,
    maxSize: (isPro ? 50 : 10) * 1024 * 1024,
    maxFiles: isPro ? 30 : Math.min(3, Math.max(0, quota)),
    multiple: true
  } as any);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current !== null) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  const startProcessing = async () => {
    setAppState("processing");
    setProgress(0);
    stopPolling();
    setJobOrder([]);
    setJobStatuses({});

    try {
      const queued = await optimizeImages({ images: files, sessionId });
      const order = queued.results.map(r => r.job_id);
      setJobOrder(order);

      const loadOnce = async () => {
        const statuses = await Promise.all(order.map(id => getJobStatus(id)));
        setJobStatuses(prev => {
          const next = { ...prev };
          for (const s of statuses) next[s.job_id] = s;
          return next;
        });

        const progressValues = statuses.map(s => {
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

        const allFinished = statuses.every(s => s.status === "done" || s.status === "failed");
        if (allFinished) {
          stopPolling();
          setProgress(100);
          // Refresh credits/quota from backend (authoritative for both free & pro)
          try {
            const me = await getSessionMe({ sessionId });
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
          if (statuses.some(s => s.status === "done")) fireConfetti();
        }
      };

      await loadOnce();
      pollTimerRef.current = window.setInterval(loadOnce, 3000);
    } catch (err) {
      stopPolling();
      setAppState("preview");
      if (err instanceof ImageOpzApiError) {
        // If backend rate-limits/quota-limits, reflect that locally so UI blocks further requests.
        if (!isPro && err.status === 429) {
          setQuota(0);
          setShowPaywall(true);
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
  };

  const originalSize = files.reduce((acc, f) => acc + f.size, 0);
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
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  const handleLogout = useCallback(() => {
    // Best-effort "logout": clear local identity markers, clear session cookie, and rotate session id.
    (async () => {
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
      localStorage.setItem("imageopz_force_restore", "true");
      localStorage.setItem("imageopz_hide_restore_cta", "true");
      setAccountEmail(null);
      setIsPro(false);
      setNeedsRestore(false);
      setForceRestore(true);
      setHideRestoreCta(true);
      setQuota(3);
      toast.success("Logged out");
      setIsLoggingOut(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-foreground selection:text-background">
      <Toaster position="top-center" />

      {/* Header */}
      <header className="border-b border-border bg-background sticky top-0 z-50 py-2">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-background rounded-sm"></div>
            </div>
            <span className="font-serif text-xl font-bold tracking-tight">{t.title}</span>
          </div>
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-4">
            <span className="text-sm font-medium text-muted-foreground hidden md:inline-flex items-center gap-1.5 opacity-70">
              <Zap className="w-4 h-4 text-accent fill-accent/20" />
              {isPro ? `${quota} ${t.optimizationsLeft}` : `${quota} ${t.optimizationsLeft}`}
            </span>
            {isPro ? (
              <div className="flex items-center gap-2">
                <div className="px-4 py-2 text-sm font-semibold bg-secondary text-foreground rounded-full border border-border/60 max-w-[220px] truncate">
                  {accountEmail ? `Pro (${accountEmail})` : "Pro"}
                </div>
                <button
                  className="px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  type="button"
                >
                  {isLoggingOut ? "Logging out..." : "Logout"}
                </button>
              </div>
            ) : (
              <button 
                className="px-5 py-2 text-sm font-semibold text-primary-foreground bg-primary rounded-full hover:bg-primary/90 transition-colors"
                onClick={() => {
                  if (!hideRestoreCta && needsRestore) setShowRestore(true);
                  else setShowPaywall(true);
                }}
              >
                {hideRestoreCta ? "Upgrade to Pro" : needsRestore ? "Restore Pro" : "Upgrade to Pro"}
              </button>
            )}
            <div className="flex gap-2">
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
                </div>

                <div className="max-w-2xl mx-auto relative group">
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
                    <span className="font-mono text-sm font-medium">{Math.round(progress)}%</span>
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
      <footer className="w-full bg-secondary/30 border-t border-border px-6 py-8">
        <div className="container mx-auto max-w-5xl flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
              <div className="w-3 h-3 border-2 border-background rounded-sm"></div>
            </div>
            <span className="font-serif font-bold text-primary">{t.title}</span>
            <span className="ml-2">{t.footerRights}</span>
          </div>
          <div className="flex gap-6 font-medium">
            <button onClick={() => setShowFeedback(true)} className="hover:text-primary transition-colors">{t.footerContact}</button>
            <a href="#" className="hover:text-primary transition-colors">{t.footerTerms}</a>
            <a href="#" className="hover:text-primary transition-colors">{t.footerPrivacy}</a>
          </div>
        </div>
      </footer>

      {/* Paywall Modal */}
      <Dialog open={showPaywall} onOpenChange={setShowPaywall}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-none bg-transparent shadow-2xl">
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
                  onClick={() => setShowRestore(true)}
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
                    });
                  localStorage.setItem("imageopz_email", email);
                  setAccountEmail(email);
                  if (checkout.session_id) {
                    localStorage.setItem("imageopz_session_id", checkout.session_id);
                    setSessionId(checkout.session_id);
                  }
                  // Sync backend session state before redirect (cookie/session may be updated server-side)
                  try {
                    const me = await getSessionMe({ sessionId: checkout.session_id ?? sessionId });
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

      {/* Restore Pro Modal */}
      <Dialog open={showRestore} onOpenChange={setShowRestore}>
        <DialogContent className="sm:max-w-md border-border bg-card shadow-xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif">{lang === "en" ? "Restore Pro" : "Pulihkan Pro"}</DialogTitle>
            <DialogDescription>
              {lang === "en"
                ? "If you already purchased Pro, enter your purchase email to relink this browser session."
                : "Jika Anda sudah pernah membeli Pro, masukkan email pembelian untuk menghubungkan ulang sesi browser ini."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{lang === "en" ? "Email" : "Email"}</Label>
            <Input
              type="email"
              placeholder={t.emailPlaceholder}
              value={restoreEmail}
              onChange={(e) => setRestoreEmail(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowRestore(false)}>
              {t.cancel}
            </Button>
            <Button
              onClick={() => {
                const email = restoreEmail.trim();
                if (!email || !email.includes("@")) {
                  toast.error(lang === "en" ? "Email required" : "Email wajib diisi");
                  return;
                }

                (async () => {
                  try {
                    const restored = await restoreProSession({ email, sessionId });
                    localStorage.setItem("imageopz_session_id", restored.session_id);
                    setSessionId(restored.session_id);
                    setNeedsRestore(false);
                    localStorage.removeItem("imageopz_force_restore");
                    setForceRestore(false);
                    localStorage.removeItem("imageopz_hide_restore_cta");
                    setHideRestoreCta(false);
                    localStorage.setItem("imageopz_email", email);
                    setAccountEmail(email);
                    // Refresh authoritative session state
                    try {
                      const me = await getSessionMe({ sessionId: restored.session_id });
                      const requiresRestore =
                        Boolean(me.is_pro) && (Boolean(me.needs_restore) || !Boolean(me.pro_verified) || me.pro_source === "unknown");
                      setIsPro(Boolean(me.is_pro && me.pro_verified && !requiresRestore));
                      setNeedsRestore(requiresRestore);
                      if (!me.is_pro) setQuota(Math.max(0, me.credits_remaining));
                    } catch {}
                    setShowRestore(false);
                    setShowPaywall(false);
                    toast.success(lang === "en" ? "Pro restored" : "Pro dipulihkan");
                  } catch (err) {
                    if (err instanceof ImageOpzApiError) {
                      toast.error(lang === "en" ? "Restore failed" : "Gagal memulihkan", {
                        description: err.payload?.message || err.message,
                      });
                    } else {
                      toast.error(lang === "en" ? "Restore failed" : "Gagal memulihkan");
                    }
                  }
                })();
              }}
            >
              {lang === "en" ? "Restore" : "Pulihkan"}
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
      <Route path="*" element={<AppContent lang="en" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <GlobalRouter />
    </BrowserRouter>
  );
}
