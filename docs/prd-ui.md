Berikut adalah **PRD Frontend (UI)** untuk **ImageOpz MVP v1.3**. Lapisan ini dirancang khusus untuk memberikan pengalaman pengguna (UX) yang sangat mulus, visualisasi data yang memukau (Wow Effect), dan taktik viralitas organik sesuai dengan prinsip buku *Make*[cite: 1].

Dokumen ini sangat ideal untuk Anda masukkan ke dalam AI *coding assistant* (seperti Cursor atau GitHub Copilot) saat melakukan *vibe coding*.

---

# PRD Frontend (UI/UX): ImageOpz MVP v1.3

## 1. Arsitektur & Teknologi Frontend
Lapisan antarmuka dibangun seringan dan secepat mungkin, berfokus pada fungsi utama tanpa fitur sampingan yang tidak perlu (Aturan 20/80)[cite: 1].

*   **Framework:** **Next.js** (App Router direkomendasikan untuk performa server-side rendering).
*   **Hosting & Edge:** **Vercel** (`imageopz.aindrajaya.my.id`).
*   **Styling:** **Tailwind CSS** (untuk penyusunan UI yang cepat dan responsif).
*   **Monetisasi:** **LemonSqueezy.js** (untuk memunculkan *overlay checkout* tanpa meninggalkan halaman).
*   **Social Graph:** **@vercel/og** (untuk *Dynamic Open Graph Image*).

---

## 2. Alur Pengguna (User Flow) & Layar Utama (Screens)

Antarmuka berfokus pada pola *Single Page Application* (SPA) yang sangat minimalis.

### Layar 1: Landing Page & *Upload Zone* (The Hook)
*   **Proposisi Nilai (Hero Section):** Teks besar dan jelas: *"LCP-Killer: Ubah Gambar AI Raksasa Menjadi WebP/AVIF Super Cepat dalam Detikan"* (Fokus pada metrik Core Web Vitals)[cite: 1].
*   **Area Unggah (Dropzone):**
    *   Mendukung *Drag-and-Drop* atau klik untuk memilih file.
    *   Validasi sisi klien (Client-side): Hanya menerima gambar, batas maksimal 10 MB. Jika lebih, tampilkan *error toast* instan.
*   **Indikator Sisa Kuota:** Menampilkan sisa penggunaan gratis (misal: "2/3 Free Optimizations Left Today"). Data kuota gratis disimpan di *Local Storage* dan divalidasi oleh Vercel Edge (berdasarkan IP).

### Layar 2: *Processing State* & *The Waiting Room*
Saat gambar sedang dikirim ke backend VPS Vultr:
*   **Progress Bar Dinamis:** Animasi *loading* sembari melakukan *polling* ke `GET /api/v1/status/{job_id}` setiap 3 detik.
*   **Penanganan Antrean Panjang (UX Hack):**
    *   Jika respons API menunjukkan `queue_position > 5`: Animasi *loading* mengecil, lalu muncul form transparan: *"Wah, antrean sedang ramai (Posisi Anda: X). Masukkan email Anda, kami akan mengirimkan hasilnya agar Anda tidak perlu menatap layar ini."*
    *   Jika email dimasukkan, simpan email tersebut ke database (akan di- *follow up* oleh backend via Sender)[cite: 1].

### Layar 3: *Result & The "Wow Effect"*
Ketika status API mengembalikan `done`:
*   **Visualisasi Komparasi:** Tampilkan gambar sebelum dan sesudah secara berdampingan (atau *slider* perbandingan).
*   **The "Wow" Metrics:** Tampilkan angka penghematan ukuran file secara mencolok.
    *   *Contoh:* **"Ukuran File Turun 85% (5.2 MB → 450 KB)"**.
    *   *Dampak Performa:* **"Estimasi Load Time Berkurang: 1.2s → 0.3s (Lighthouse Score Boost!)"**[cite: 1].
*   **Tombol Unduh Utama:** Mengarah ke URL unduhan dari Cloudflare R2.
*   **Peringatan Retensi (Warning Banner):** Teks kuning di bawah tombol unduh: *"Peringatan Privasi: File ini akan dihapus permanen dari server kami dalam 7 Hari."*[cite: 1].

---

## 3. Fitur Validasi Monetisasi & Viralitas

### 3.1. Dinding Pembayaran (Paywall & LemonSqueezy)
*   **Triggers:** Muncul ketika pengguna mencoba mengunggah gambar ke-4 di hari yang sama, atau mengklik tombol "Upgrade to Pro / Buy Credits" di menu navigasi[cite: 1].
*   **Tampilan Paywall:** Menawarkan paket "100 Credits" seharga $X. Menekankan manfaat fitur Pro: *"Retensi file 40 hari, Prioritas Antrean, dan Mendukung pengembangan alat indie ini."*[cite: 1].
*   **Pembayaran Instan:** Saat tombol harga diklik, *overlay* LemonSqueezy muncul. Pengguna membayar langsung tanpa berpindah *tab*.
*   **Post-Payment:** Vercel menerima status dari komponen klien LemonSqueezy, menambahkan kredit ke *Local Storage* pengguna, dan me- *refresh* halaman.

### 3.2. Viralitas Organik (Share to Twitter/LinkedIn)
Fitur ini bertujuan untuk mengaktifkan pemasaran dari mulut ke mulut secara gratis[cite: 1].
*   **Share Button:** Tombol "Pamerkan Hasil Ini" di bawah hasil kompresi.
*   **Dynamic OG Image (`/api/og`):** Route Next.js ini akan menghasilkan gambar statis (*on-the-fly*) yang mencantumkan skor spesifik pengguna tersebut.
    *   *Desain OG Image:* Latar belakang gradien + Teks tebal: *"Saya baru saja menghemat ukuran gambar sebesar 85% dengan ImageOpz!"*
    *   Saat pengguna membagikan URL hasil mereka ke Twitter, gambar pamer skor inilah yang akan muncul[cite: 1].

### 3.3. Kotak Umpan Balik (Feedback Box)
Sesuai rekomendasi wajib dari Pieter Levels, pasang *widget* sederhana di pojok kanan bawah layar[cite: 1].
*   **Pesan Default:** *"Ada bug? Punya ide fitur? Beritahu saya langsung!"*
*   Ini krusial di hari pertama peluncuran (Reddit/HN) agar pengguna yang menemukan error tidak menuliskannya sebagai komplain publik di forum, melainkan mengirimkannya langsung kepada Anda[cite: 1].

---

## 4. Keamanan Edge & Optimasi Next.js (Vercel)

*   **Vercel WAF (Web Application Firewall):** Konfigurasi pada *dashboard* Vercel untuk memblokir IP yang dikenal sebagai sumber bot jahat.
*   **Edge Rate Limiting (Middleware.ts):**
    *   Buat aturan di `middleware.ts` Next.js: Batasi endpoint `POST /api/upload` maksimal 5 *request* per menit per IP address.
    *   Jika melampaui, Next.js Edge langsung mengembalikan status `429 Too Many Requests` *sebelum* *request* tersebut menyentuh server Vultr Anda. Ini adalah pertahanan utama dari "Hug of Death" Reddit.

---

### Siap untuk Vibe Coding!
Dengan PRD Backend dan PRD Frontend yang kini terpisah dengan jelas, Anda bisa langsung menyalin dokumen ini satu per satu dan memasukkannya ke dalam *prompt* Cursor atau Claude Code Anda. Pendekatan modular ini akan mencegah AI halusinasi atau kebingungan mencampuradukkan logika server Vultr dan logika antarmuka Vercel. Selamat membangun!