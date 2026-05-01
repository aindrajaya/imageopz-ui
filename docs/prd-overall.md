Berikut adalah dokumen **Product Requirements Document (PRD)** lengkap untuk **ImageOpz**, yang menggabungkan evolusi fitur dan teknis dari versi 1.0 hingga versi final 1.3 (GTM Edition) berdasarkan prinsip *Indie Maker*[cite: 1].

---

# Product Requirements Document (PRD): ImageOpz MVP

## 1. Ringkasan Produk & Visi
**ImageOpz** adalah solusi SaaS pragmatis yang dirancang untuk mengoptimalkan gambar beresolusi tinggi hasil generator AI (seperti DALL-E atau Gemini) menjadi aset ramah web (WebP/AVIF)[cite: 1].

*   **Visi:** Membantu pengembang web mencapai skor *Lighthouse* maksimal dengan proses optimasi otomatis yang instan[cite: 1].
*   **Target Ceruk (Micro-Niche):** Pengembang web yang fokus pada performa serta kreator seni AI[cite: 1].
*   **Masalah Utama:** Gambar AI sering kali berukuran raksasa (>5MB), memperlambat waktu muat website, dan merusak SEO[cite: 1].

---

## 2. Arsitektur Sistem & Infrastruktur (v1.1 & v1.2)
Sistem menggunakan pendekatan *Lite Stack* untuk efisiensi biaya dan kecepatan peluncuran[cite: 1].

*   **Frontend & Keamanan Edge (Vercel):**
    *   Aplikasi dibangun dengan **Next.js**[cite: 1].
    *   Mengaktifkan perlindungan bot dan *Rate Limiting* di level Vercel untuk memitigasi serangan sebelum menyentuh server backend[cite: 1].
    *   Menggunakan **Vercel OG (@vercel/og)** untuk menghasilkan gambar pratinjau dinamis saat tautan dibagikan[cite: 1].
*   **Backend & Processing Engine (Vultr Seattle):**
    *   **Server:** 1 vCPU, 1 GB RAM, 25 GB SSD (Lokasi: Seattle untuk meminimalkan *latency* trafik US)[cite: 1].
    *   **Framework:** **Python FastAPI** sebagai *wrapper* untuk *tool* CLI Python[cite: 1].
    *   **Antrean (Queue):** **BullMQ & Redis** dengan konfigurasi `concurrency: 1` untuk menjaga stabilitas RAM 1 GB[cite: 1].
    *   **Database:** **SQLite** dengan *WAL (Write-Ahead Logging) Mode* agar proses *polling* status tidak terhambat oleh proses penulisan tugas[cite: 1].
*   **Penyimpanan Hybrid (Cloudflare R2):**
    *   Menggunakan **Cloudflare R2 (10 GB Free Tier)** untuk menyimpan hasil akhir optimasi[cite: 1].
    *   File di SSD lokal Vultr segera dihapus setelah berhasil diunggah ke R2 guna menjaga kapasitas penyimpanan 25 GB[cite: 1].

---

## 3. Fitur Utama & Evolusi Teknis

### 3.1. Alur Pemrosesan Gambar (v1.0 - v1.3)
1.  **Validasi Input:** Pengguna mengunggah file (Max 10 MB)[cite: 1].
2.  **Keamanan Berlapisan:** Skrip Python menggunakan verifikasi *signature* (magic numbers) untuk mencegah *malware* yang menyamar sebagai gambar dan menolak file dengan piksel > 100MP (proteksi *Decompression Bomb*)[cite: 1].
3.  **Identifikasi Unik:** Setiap unggahan diberikan **UUID v4** dan **Timestamp** sebagai nama folder unik di Cloudflare R2 untuk mencegah tabrakan data (collision)[cite: 1].
4.  **Proses Antrean:** Pengguna mendapatkan `job_id` untuk pemantauan *real-time*[cite: 1]. Jika antrean panjang (>5), UI menampilkan form email: *"Antrean padat, hasil akan dikirim ke email Anda"*[cite: 1].
5.  **Wow Effect UI:** Setelah selesai, sistem menampilkan statistik: *"Aset ini sebelumnya memperlambat web Anda 1,2 detik; sekarang dioptimalkan menjadi < 500 ms"*[cite: 1].

### 3.2. Penanganan Kegagalan (v1.3)
*   **Email Fallback:** Jika proses optimasi gagal (file rusak atau tidak didukung), sistem secara otomatis mengirimkan email permintaan maaf via **Sender** agar pengguna tidak menunggu tanpa kepastian[cite: 1].

### 3.3. Retensi Data & Otomatisasi (Robot Clean-up)
*   **Free Tier:** File disimpan selama **7 hari**[cite: 1].
*   **Paid Tier:** Masa simpan diperpanjang otomatis menjadi **40 hari** setelah pembayaran terverifikasi[cite: 1].
*   **Cron Job:** Robot backend berjalan harian untuk menghapus data di SQLite dan objek di R2 yang telah melewati masa berlaku[cite: 1].

---

## 4. Strategi Validasi & Monetisasi
Mengikuti prinsip Levelsio bahwa "monetisasi adalah alat validasi paling kuat"[cite: 1]:

*   **Model Bisnis:** Kombinasi kuota gratis (3 gambar/hari) dan sistem "Buy Credits" atau "Subscription" melalui **LemonSqueezy**[cite: 1].
*   **Taktik Validasi:** Menggunakan tombol "Upgrade" yang mengarah langsung ke sistem pembayaran USD untuk menguji niat bayar (*intent to pay*) pengguna global sejak hari pertama[cite: 1].

---

## 5. Strategi Go-To-Market (GTM)
Rencana peluncuran dilakukan secara bertahap untuk mendapatkan umpan balik organik[cite: 1]:

1.  **Soft Launch:** Berbagi progres di LinkedIn dan Twitter dengan narasi *Build in Public*[cite: 1].
2.  **Hacker News:** Meluncurkan dengan judul *"Show HN: I made a tool to optimize large AI images for web performance"*[cite: 1].
3.  **Reddit:** Berbagi secara autentik di *subreddit* `r/midjourney` dan `r/web_design` sebagai solusi atas masalah gambar yang lambat[cite: 1].
4.  **Product Hunt:** Peluncuran resmi pada jam 00:00:01 PST dengan media visual yang menarik (GIF/Video pendek)[cite: 1].

---

## 6. Metrik Keberhasilan (KPI)
*   **Tingkat Konversi:** > 5% pengunjung unik mengeklik tombol pembayaran[cite: 1].
*   **Stabilitas Sistem:** Nol *downtime* pada 1vCPU Vultr saat lonjakan trafik Reddit berkat BullMQ dan Vercel Edge[cite: 1].
*   **Viralitas Organik:** Jumlah klik dari *Dynamic OG Image* yang dibagikan pengguna di media sosial[cite: 1].

---
*Dokumen ini bersifat adaptif; batasan teknis saat ini akan dijadikan dasar untuk iterasi setelah validasi pasar awal terpenuhi[cite: 1].*