Untuk menjawab pertanyaan pertama Anda: **Ya, penanganan *user* berbayar sudah dibahas secara arsitektur, namun mari kita perjelas bagaimana alur konkretnya berjalan di sisi Frontend dan Backend.**

Berdasarkan konsep *lite stack* yang kita susun sebelumnya, berikut adalah cara sistem menangani pengguna yang sudah membayar:
1. **Titik Pemicu (Trigger):** Pengguna menghabiskan 3 kredit gratis di *Local Storage*. Frontend memunculkan *Popup Paywall* yang memblokir proses unggah dan menawarkan paket "Pro".
2. **Transaksi (Server-side Checkout):** Saat pengguna mengeklik "Upgrade", frontend meminta backend membuat checkout LemonSqueezy lewat `POST /api/v1/checkout/lemonsqueezy` (body JSON `{"email":"..."}` + header `X-Session-Id`). Backend mengembalikan `checkout_url`, lalu frontend melakukan redirect.
3. **Validasi (Webhook & Backend):** Setelah pembayaran sukses, LemonSqueezy mengirimkan webhook ke backend `POST /api/v1/webhooks/lemonsqueezy`. Backend memetakan pembayaran ke row `users_quota` dan mengaktifkan Pro untuk `session_id` terkait.
4. **Status Pro & Kredit (Authoritative dari Backend):** Frontend tidak “mengira-ngira” status Pro. Frontend selalu membaca status sesi dari `GET /api/v1/session/me` (server-side source of truth), termasuk `is_pro`, `pro_verified`, `needs_restore`, dan kredit yang tersisa.
5. **Restore & Logout:** Jika user berpindah device/browser atau storage terhapus, frontend menyediakan *Restore Pro* (`POST /api/v1/session/restore`). Frontend juga menyediakan *Logout* (`POST /api/v1/session/logout`) untuk reset sesi secara server-side (clear cookie + rotate session id).

---

Berikut adalah pembaruan **PRD Frontend (UI)** yang telah diintegrasikan dengan draf *landing page* yang Anda berikan. Fitur-fiturnya kini jauh lebih kaya secara visual namun tetap menjaga kecepatan eksekusi MVP.

# PRD Frontend (UI/UX): ImageOpz MVP v1.4

## 1. Arsitektur & Teknologi Frontend
Lapisan antarmuka dibangun dengan fokus pada eksekusi klien yang sangat cepat dan interaktif, menargetkan *First Contentful Paint* (FCP) di bawah 1.0 detik.

*   **Framework:** **React + Vite**.
*   **Hosting:** Static hosting / CDN (atau Vercel/Netlify) yang mampu melayani SPA cepat.
*   **Sistem Multi-Bahasa (Bilingual):** Dukungan *i18n* untuk Bahasa Inggris (EN) dan Indonesia (ID). Deteksi otomatis berdasarkan referensi IP atau pengaturan bahasa *browser*.
*   **Styling & Animasi:** **Tailwind CSS** (UI) dan *library* animasi ringan (untuk *Confetti* dan transisi *Progress Bar*).
*   **API Browser:** Mengandalkan **Blob** dan **File HTML5 API** untuk penanganan gambar di sisi klien sebelum dikirim ke server.

## 2. Alur Pengguna (User Flow) & Antarmuka Utama

### Layar 1: Landing Page & *Smart File Upload*
*   **Area Unggah Cerdas (Drag and Drop):**
    *   Validasi instan di sisi klien: Hanya menerima ekstensi JPEG, PNG, dan WEBP.
    *   Validasi ukuran: Maksimal 10MB per gambar. Jika melampaui, muncul peringatan langsung.
*   **Pratinjau Gambar (Live Preview):**
    *   Sebelum menekan tombol "Mulai Optimasi", pengguna dapat melihat *thumbnail* dari gambar yang ditarik.
    *   Jika mode massal, tampilkan dalam bentuk kolase *grid*.
*   **Limitasi Kuota Cerdas:**
    *   **User Gratis:** Diblokir jika memasukkan lebih dari 3 gambar sekaligus ke area *dropzone*.
    *   **User Pro:** Diizinkan memasukkan hingga 30 gambar sekaligus.

### Layar 2: *Processing State* & Simulasi
*   **Animasi Proses:** Setelah `POST /api/v1/optimize` (multipart), frontend melakukan polling `GET /api/v1/status/{job_id}` sampai status `done/failed`, sambil menampilkan progress (`progress`/`progress_status`) bila tersedia.
*   **Error Handling:** Jika backend mengembalikan `429 Too Many Requests` pada optimize (free-tier exhausted/rate limit), frontend meng-set “credits remaining” menjadi `0` agar UI memblokir request berikutnya dan menampilkan paywall.

### Layar 3: *Result & The "Wow Effect"*
*   **Statistik Penghematan:** Tampilkan penghematan rasio byte dengan teks tebal (contoh: *Menghemat ruang hingga 80%*).
*   **Selebrasi Sukses:** Tampilkan animasi **Confetti** saat proses optimasi massal berhasil diselesaikan untuk memberikan kepuasan psikologis (*reward* visual).
*   **Peringatan Privasi:** Pesan jelas bahwa file akan terhapus otomatis dari server dalam 7 hari.

## 3. Manajemen Kuota, Monetisasi, & Interaksi

### 3.1. Dinding Pembayaran (Paywall & LemonSqueezy)
*   **Pelacakan Sesi:** Frontend membuat `session_id` stabil (UUIDv4) dan mengirimkannya via header `X-Session-Id` pada semua request penting. Backend juga dapat menyetel cookie sesi (double safety).
*   **Popup Paywall:** Muncul saat kredit habis (`credits_remaining == 0` untuk free, atau `pro_credits_remaining == 0` untuk pro) dan mengarahkan user ke flow checkout.
*   **Integrasi Checkout:** Frontend memanggil `POST /api/v1/checkout/lemonsqueezy` (server-side checkout) lalu redirect ke `checkout_url`. Untuk menghindari *blank interaction*, UI menampilkan overlay loading “Redirecting…” setelah modal tertutup sampai redirect terjadi.

### 3.2. Status Sesi & Kredit (Wajib dari Backend)
Frontend harus selalu melakukan sinkronisasi dari `GET /api/v1/session/me` karena endpoint ini adalah sumber kebenaran untuk:
*   `is_pro`, `pro_verified`, `pro_source`, `needs_restore` (untuk gating UI Pro).
*   `is_authenticated`, `supabase_user_id`, `email` (untuk auth magic link dan identitas user).
*   Kredit free tier: `credits_remaining`, `free_tier_max_credits`, `credits_used`.
*   Kredit pro tier: `pro_credits_remaining`, `pro_tier_max_credits`, `pro_credits_used`.

Implikasi UX:
*   Header menampilkan tombol **Upgrade to Pro** saat user belum Pro.
*   Jika backend mendeteksi Pro tapi `needs_restore=true` (atau `pro_source=unknown`), frontend menampilkan CTA **Restore Pro** (email) agar Pro “terverifikasi” untuk browser ini.
*   Jika Pro verified, header menampilkan pill `Pro (email)` dan tombol `Logout`. Jumlah sisa kredit ditampilkan terpisah (mis. label kecil di header), bukan menempel pada tombol Pro.

### 3.3. Restore Pro & Logout
*   **Restore Pro:** Frontend menyediakan modal “Restore Pro” yang memanggil `POST /api/v1/session/restore` dengan body `{"email":"..."}` + header `X-Session-Id`. Jika sukses, frontend refresh `GET /api/v1/session/me` agar UI Pro aktif.
*   **Logout:** Frontend memanggil `POST /api/v1/session/logout` untuk clear cookie server-side dan rotate `session_id`. Setelah logout, UI kembali ke state free dan menampilkan tombol “Upgrade to Pro”.

### 3.4. Auth (Supabase Magic Link)
*   **Sign in:** Frontend menyediakan tombol `Sign in` di header (modal email). Flow: `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo }})`.
*   **Callback Route:** Setelah user klik magic link, SPA route `/auth/callback` menampilkan “Signing you in…”, lalu memanggil `GET /api/v1/session/me` dengan header `Authorization: Bearer <supabase_access_token>` + `X-Session-Id`, lalu redirect ke `/`.
*   **Authorization Header:** Untuk endpoint yang mendukung, frontend menyertakan header `Authorization` jika user sedang login (minimal: `/session/me`, `/optimize`, `/checkout/lemonsqueezy`, `/session/restore`).

### 3.2. Formulir Umpan Balik & Viralitas
*   **Feedback Form:** Sesuai taktik *indie maker* untuk menyerap respons pasar secepat mungkin[cite: 1], terdapat *popup* sederhana di pojok layar bagi pengguna untuk melaporkan masalah atau memberi masukan.
*   **Dynamic OG Image:** Fitur pembagian ke media sosial dengan gambar pratinjau yang secara dinamis menampilkan skor kompresi (misal: "Saya menghemat 5MB dengan ImageOpz!").

---

## 4. Kebutuhan Non-Fungsional Utama
*   **Performa FCP:** Waktu muat awal halaman harus **<1.0s** untuk menjaga skor Lighthouse dan memikat *web developer*.
*   **Kompatibilitas:** Mendukung Chrome, Firefox, Safari, dan Edge versi modern yang mendukung fitur manipulasi *Blob* HTML5.
*   **Konfigurasi API Base URL:** Frontend membaca `VITE_IMAGEOPZ_API_BASE_URL` untuk menentukan base URL backend (contoh local: `http://127.0.0.1:8000`). Pastikan backend mengaktifkan CORS (khususnya `allow_credentials=true` dan allow header `X-Session-Id`) jika frontend dan backend beda origin.
*   **Observabilitas Flow:** Saat testing local, pastikan terlihat urutan request: `GET /api/v1/session/me` → `POST /api/v1/optimize` → polling `GET /api/v1/status/{job_id}` → `GET /api/v1/session/me` (refresh credits). Untuk checkout: `POST /api/v1/checkout/lemonsqueezy` → redirect ke `checkout_url`.

---

## 5. Peta Jalan Masa Depan (Future Enhancements)
Fitur-fitur di bawah ini **tidak dimasukkan ke dalam MVP rilis pertama** agar fokus peluncuran tetap terjaga, namun telah didokumentasikan untuk iterasi berikutnya (v2.0+):

1.  **Slider Perbandingan (Before/After):** Antarmuka interaktif yang bisa digeser untuk membandingkan ketajaman gambar asli vs hasil kompresi secara visual.
2.  **Kustomisasi Kompresi & Format Output:** *Dropdown/Slider* untuk memilih *Lossless* vs *Lossy*, serta pemilihan format manual (Auto, WEBP, AVIF, JPEG, PNG).
3.  **Image Resizer & Cropper:** Alat bawaan untuk memangkas rasio (1:1, 16:9) atau menentukan batas dimensi piksel (misal: maks lebar 1920px).
4.  **Integrasi Cloud Storage:** Impor/Ekspor langsung ke Google Drive atau Dropbox.
5.  **Penambahan Watermark Kustom:** Fitur eksklusif Pro untuk melampirkan teks/logo tembus pandang secara massal (perlindungan Hak Cipta).
6.  **History & Dashboard Pengguna:** Integrasi Firebase Authentication (Google Login) untuk mengelola riwayat file dan mengikat kuota ke *database* awan, bukan sekadar *Local Storage*.
7.  **Developer API:** Endpoint cURL/NPM untuk pelanggan tingkat lanjut (*Enterprise/Pro*).
