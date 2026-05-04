Untuk menjawab pertanyaan pertama Anda: **Ya, penanganan *user* berbayar sudah dibahas secara arsitektur, namun mari kita perjelas bagaimana alur konkretnya berjalan di sisi Frontend dan Backend.**

Berdasarkan konsep *lite stack* yang kita susun sebelumnya, berikut adalah cara sistem menangani pengguna yang sudah membayar:
1. **Titik Pemicu (Trigger):** Pengguna menghabiskan 3 kredit gratis di *Local Storage*. Frontend memunculkan *Popup Paywall* yang memblokir proses unggah dan menawarkan paket "Pro".
2. **Transaksi:** Saat pengguna mengeklik "Beli", *overlay* LemonSqueezy muncul. Proses pembayaran terjadi di atas halaman tanpa perlu memuat ulang (*redirect*).
3. **Validasi (Webhook & Backend):** Setelah pembayaran sukses, LemonSqueezy mengirimkan *webhook* ke backend (FastAPI di Vultr). Backend akan mencatat alamat IP/ID Sesi tersebut ke SQLite, mengubah status `is_paid = true`, dan memperpanjang `expiry_date` file menjadi 40 hari.
4. **Respon Frontend:** Komponen LemonSqueezy di antarmuka menerima *callback* sukses. Frontend kemudian memperbarui *Local Storage* (atau menanamkan *cookie* aman) yang menandakan pengguna ini adalah "Pro". UI seketika berubah: batas unggah massal (*bulk upload*) yang tadinya 3 gambar kini terbuka menjadi 30 gambar.

---

Berikut adalah pembaruan **PRD Frontend (UI)** yang telah diintegrasikan dengan draf *landing page* yang Anda berikan. Fitur-fiturnya kini jauh lebih kaya secara visual namun tetap menjaga kecepatan eksekusi MVP.

# PRD Frontend (UI/UX): ImageOpz MVP v1.4

## 1. Arsitektur & Teknologi Frontend
Lapisan antarmuka dibangun dengan fokus pada eksekusi klien yang sangat cepat dan interaktif, menargetkan *First Contentful Paint* (FCP) di bawah 1.0 detik.

*   **Framework:** **Next.js** (App Router).
*   **Hosting:** **Vercel** (`imageopz.aindrajaya.my.id`).
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
*   **Animasi Proses:** Saat gambar diunggah ke Vultr, tampilkan *progress bar* yang bergerak mulus.
*   **Antrean:** Jika antrean server padat, munculkan form input email transparan agar pengguna bisa meninggalkan halaman dan menerima hasil via email.

### Layar 3: *Result & The "Wow Effect"*
*   **Statistik Penghematan:** Tampilkan penghematan rasio byte dengan teks tebal (contoh: *Menghemat ruang hingga 80%*).
*   **Selebrasi Sukses:** Tampilkan animasi **Confetti** saat proses optimasi massal berhasil diselesaikan untuk memberikan kepuasan psikologis (*reward* visual).
*   **Peringatan Privasi:** Pesan jelas bahwa file akan terhapus otomatis dari server dalam 7 hari.

## 3. Manajemen Kuota, Monetisasi, & Interaksi

### 3.1. Dinding Pembayaran (Paywall & LemonSqueezy)
*   **Pelacakan Sesi:** Setiap pengunjung tanpa akun diberikan 3 kredit gratis yang disimpan di *Local Storage*.
*   **Popup Paywall:** Muncul otomatis saat kredit habis. Menawarkan paket **Pro** (Beli Putus atau Langganan) yang membuka batas ukuran menjadi 50MB dan *bulk upload* hingga 30 gambar.
*   **Integrasi:** Menggunakan LemonSqueezy *overlay* agar pengguna tidak berpindah halaman saat bertransaksi.

### 3.2. Formulir Umpan Balik & Viralitas
*   **Feedback Form:** Sesuai taktik *indie maker* untuk menyerap respons pasar secepat mungkin[cite: 1], terdapat *popup* sederhana di pojok layar bagi pengguna untuk melaporkan masalah atau memberi masukan.
*   **Dynamic OG Image:** Fitur pembagian ke media sosial dengan gambar pratinjau yang secara dinamis menampilkan skor kompresi (misal: "Saya menghemat 5MB dengan ImageOpz!").

---

## 4. Kebutuhan Non-Fungsional Utama
*   **Performa FCP:** Waktu muat awal halaman harus **<1.0s** untuk menjaga skor Lighthouse dan memikat *web developer*.
*   **Kompatibilitas:** Mendukung Chrome, Firefox, Safari, dan Edge versi modern yang mendukung fitur manipulasi *Blob* HTML5.

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