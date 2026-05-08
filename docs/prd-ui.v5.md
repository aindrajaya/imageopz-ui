<!--
PRD UI v5 (single source of truth for frontend behavior)
This document consolidates: prd-ui.v2 (v1.4 UI), plan-dengan-tambahan-supabase-magic-link,
prd-tambahan-auth-with-supabase, and the latest backend behavior (session-first guest matching,
reconcile endpoint, and restore-only/claim flow).
-->

# PRD Frontend (UI/UX): ImageOpz v5

## 0) Ringkasan Produk
**ImageOpz** adalah layanan SaaS optimasi gambar untuk developer web & kreator konten yang fokus pada:
- Kompresi & konversi JPEG/PNG/WEBP → **WebP/AVIF** (target pengurangan ukuran hingga ~80% dengan kualitas tetap bagus).
- UX cepat (SPA Vite + backend FastAPI), ditargetkan untuk membantu skor Lighthouse/performa.
- Privasi: file dipurge otomatis (Free: 7 hari, Pro: 40 hari).

## 1) Prinsip Desain (Policy)
### 1.1 Guest-first
- User Free dapat memakai produk tanpa login.
- Limit Free:
  - Total credit Free = **3**.
  - Max upload per batch = **3 file**.

### 1.2 Pro = entitlements yang authoritative dari backend
Frontend **tidak** mengira-ngira status Pro. Semua gating fitur/credit harus berasal dari backend:
- `GET /api/v1/session/me` = source of truth untuk `is_pro`, `pro_verified`, `needs_restore`, credits.

### 1.3 Auth = “Claim Pro / Cross-device”
Auth Supabase Magic Link dipakai untuk **claim** entitlement Pro ke account (agar lintas device).
- User bisa menjadi **Pro (guest)** dulu (session-based) setelah bayar (via webhook).
- Untuk lintas device/email identity, user melakukan **Claim Pro** via Supabase Magic Link + `POST /api/v1/session/restore`.

Catatan: Backend terbaru melakukan **guest matching session-first** dan tidak grant Pro by `ip_hash`.

## 2) Tech Stack Frontend
- React + Vite (SPA).
- Tailwind UI + motion animations.
- `@supabase/supabase-js` untuk Magic Link.
- Fetch client terpusat: `lib/imageopzApi.ts`.

## 3) Kontrak API (OpenAPI – yang dipakai UI)
Frontend wajib konsisten terhadap header dan endpoint berikut:
- Header:
  - `X-Session-Id: <stable uuid>` **selalu dikirim** di semua call inti.
  - `Authorization: Bearer <supabase_access_token>` **hanya** dikirim saat user benar-benar melakukan claim/restore atau sudah account-claimed (lihat bagian 6).
- Endpoints:
  - `GET /api/v1/session/me`
  - `POST /api/v1/optimize` (multipart)
  - `GET /api/v1/status/{job_id}`
  - `POST /api/v1/checkout/lemonsqueezy`
  - `POST /api/v1/webhooks/lemonsqueezy` (backend-only)
  - `POST /api/v1/session/reconcile`
  - `POST /api/v1/session/restore`
  - `POST /api/v1/session/logout`

## 4) Session Identity (Wajib Stabil)
### 4.1 `session_id` (browser-stable)
Frontend membuat `session_id` sekali (UUID) dan menyimpan di `localStorage`:
- Key: `imageopz_session_id`
- Aturan:
  - **Jangan regenerate** per reload/tab.
  - Attach ke semua request via header `X-Session-Id`.
  - Jika backend mengembalikan `session_id` di response checkout/logout, frontend mengadopsi nilai itu dan menyimpan ulang (untuk konsistensi cookie/session server-side).

### 4.2 Cookies
Backend dapat set cookie `imageopz_sid`. UI tetap mengirim header `X-Session-Id` untuk konsistensi (cookie tidak boleh jadi satu-satunya identity).

## 5) Alur Utama UI (Screens)
### 5.1 Landing / Upload
- Dropzone:
  - Accept: JPEG/PNG/WEBP.
  - Limit size: Free 10MB, Pro 50MB.
  - Limit jumlah file:
    - Free: max 3 per batch (dan tidak boleh melebihi sisa credit).
    - Pro: max 30 per batch.
- Preview grid sebelum submit.

### 5.2 Processing
Saat user klik “Start Optimization”:
1) Preflight `GET /api/v1/session/me` untuk membaca state server terbaru.
2) `POST /api/v1/optimize` (multipart) mengembalikan daftar `job_id`.
3) Poll `GET /api/v1/status/{job_id}` dengan backoff (mis. 0.5s → 1s → 2s) sampai status `done/failed`.
4) Setelah semua selesai: refresh `GET /api/v1/session/me` untuk update credits.

Error handling:
- Jika backend mengembalikan `429` dengan error activation pending (lihat 7.2), UI **tidak** menganggap credits habis; UI melakukan retry sesuai `retry_after_ms`.
- Jika `credits_remaining`/`pro_credits_remaining` jadi 0, UI menampilkan Paywall/CTA Add Credits.

### 5.3 Result
- Tampilkan perbandingan size total, % savings, download link, share.
- Confetti bila ada hasil `done`.
- Privacy note (hapus otomatis).

## 6) State UI & Gating (Source of Truth)
### 6.1 Derivasi status dari `session/me`
Frontend menyimpan state:
- `isAuthenticated`: dari `me.is_authenticated`
- `isProActive`:
  - `me.is_pro && me.pro_verified && !me.needs_restore`
- Remaining credits:
  - jika Pro active → `me.pro_credits_remaining`
  - else → `me.credits_remaining`

### 6.2 “Account claimed” flag (frontend)
Untuk mencegah guest mode rusak oleh token Supabase yang tersimpan, UI memakai flag:
- `imageopz_account_claimed=true` hanya diset saat restore/claim sukses (proOk).
- UI **baru** mengirim `Authorization` ke backend jika `account_claimed=true` (atau sedang menjalankan flow restore).

## 7) Monetisasi: Checkout → Pro session → (opsional) Claim Pro

### 7.1 Checkout (Server-side)
Trigger Paywall:
- Free credits habis (0) atau user mencoba upload di atas batas.

Flow:
1) User klik “Upgrade to Pro / Buy Credits”.
2) UI input email → `POST /api/v1/checkout/lemonsqueezy` (JSON `{ email }` + `X-Session-Id`).
3) Backend mengembalikan `checkout_url` (dan opsional `session_id`).
4) UI menampilkan state “Redirecting…” lalu redirect ke `checkout_url`.

### 7.2 Setelah kembali dari LemonSqueezy: Activation Bridge
Karena webhook bisa async, UI menjalankan “activation bridge”:
1) `POST /api/v1/session/reconcile` (header `X-Session-Id`).
2) `GET /api/v1/session/me`.
3) Jika `activation_pending=true`:
   - UI tampilkan “Activating Pro…”
   - Retry reconcile sesuai `activation_retry_after_ms` (max timeout 60 detik).
4) Jika Pro sudah aktif (`is_pro && pro_verified`): UI update credits dan hapus `imageopz_checkout_intent`.

### 7.3 Claim Pro (Supabase Magic Link)
Tujuan: mengikat entitlement Pro ke account agar lintas device.

UI menampilkan CTA **Claim Pro** hanya jika:
- `isProActive=true` **dan** `me.is_authenticated=false`

Flow Claim:
1) User klik “Claim Pro” → modal email → frontend memanggil Supabase Magic Link:
   - `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo, shouldCreateUser: true } })`
2) Redirect ke route SPA `/auth/callback`.
3) `/auth/callback`:
   - memastikan session Supabase terbentuk dari URL
   - ambil `access_token`
   - panggil `POST /api/v1/session/restore` dengan:
     - `Authorization: Bearer <access_token>`
     - `X-Session-Id: <stable session id>`
     - body `{ email }`
   - lanjut `GET /api/v1/session/me` dengan header yang sama untuk refresh UI.
4) Jika `proOk` (Pro verified):
   - set `imageopz_account_claimed=true`
   - UI menampilkan pill `Pro (email)` + tombol Logout.
5) Jika tidak ditemukan pro plan:
   - `supabase.auth.signOut()`
   - tampilkan toast “No Pro plan found”.

### 7.4 Cooldown Magic Link (anti rate-limit)
Semua tombol “Send magic link” wajib punya cooldown minimal **120 detik**:
- Disimpan per-email di localStorage:
  - `imageopz_magic_link_last_sent_at:<email>`
- Cooldown dipasang **sebelum** request Supabase dikirim (agar user tidak spam walau gagal/429).

## 8) Logout
Logout harus mengembalikan UI ke guest/free state:
1) `POST /api/v1/session/logout` (server-side clear cookie + rotate session).
2) `supabase.auth.signOut()` (jika ada session).
3) Clear local flags:
   - `imageopz_account_claimed`
   - `imageopz_email` (optional)
   - reset UI state (credits kembali free default 3 setelah sync `session/me`)
4) UI kembali menampilkan tombol “Upgrade to Pro”.

## 9) Header UI Rules (Current)
Header menampilkan:
- Left: logo.
- Middle: “optimizations left” (credits remaining dari backend).
- Right:
  - Jika Pro active:
    - pill `Pro` (guest) atau `Pro (email)` (authenticated)
    - tombol `Logout`
    - tombol `Add credits` bila credits Pro = 0
    - tombol `Claim Pro` hanya jika guest pro (not authenticated)
  - Jika tidak Pro:
    - tombol `Upgrade to Pro` (atau `Restore Pro` jika `needs_restore=true` dan CTA tidak disembunyikan)
    - tombol `Logout` tetap terlihat jika `account_claimed=true` (untuk kasus sync terlambat)

## 10) Non-Functional Requirements
- FCP cepat, SPA ringan.
- Polling status tidak spam: backoff & stop saat done/failed.
- Jangan memanggil `session/reconcile` tanpa alasan (stop jika `activation_pending=false` dan bukan Pro).
- Jangan mengirim `Authorization` untuk guest request (kecuali saat claim/restore atau accountClaimed=true).

## 11) Acceptance Checklist (Manual)
1) Guest:
   - Bisa optimize ≤ 3 credits.
   - Upload > 3 file diblok.
2) Checkout:
   - Setelah bayar, kembali ke app → `reconcile` → Pro aktif session-based (credits 100).
3) Claim:
   - Guest pro klik Claim → magic link → callback → restore → Pro (email) + Logout muncul.
4) Device baru/incognito:
   - Tanpa session id lama → tidak otomatis Pro.
   - User bisa claim via magic link + restore untuk mengambil Pro (account-owned).
5) Rate limit:
   - Tombol magic link cooldown 120 detik dan tidak spam Supabase.
