Arsitektur frontend untuk **ImageOpz** menggunakan **Vite + React** dan **Supabase Magic Link** dirancang untuk meminimalkan beban komputasi pada server Vultr Anda dan memaksimalkan kecepatan akses pengguna[cite: 2, 3]. Dengan menyerahkan beban autentikasi ke Supabase, Anda dapat fokus pada fitur utama yaitu optimasi gambar hasil AI[cite: 1, 2].

Berikut adalah detail arsitektur lengkapnya:

---

## 1. Komponen Arsitektur Utama
Pemisahan tanggung jawab dilakukan untuk menjaga aplikasi tetap ringan dan *scalable*[cite: 2, 3].

*   **Supabase SDK (`@supabase/supabase-js`):** Bertugas menangani aliran autentikasi *Magic Link*, manajemen sesi otomatis di *browser*, dan penyediaan *JSON Web Token* (JWT)[cite: 3].
*   **Auth Context Provider:** Sebuah pembungkus global dalam React yang mendistribusikan status login (`user`), token sesi (`session`), dan status `isPro` ke seluruh komponen aplikasi[cite: 3].
*   **Axios/Fetch Interceptor:** Modul komunikasi yang secara otomatis menyisipkan JWT dari Supabase ke dalam *header* `Authorization` setiap kali melakukan unggahan ke backend FastAPI[cite: 2, 3].
*   **Local Storage Sync:** Digunakan untuk menyimpan sementara data non-sensitif dan memastikan pengalaman pengguna tetap konsisten sebelum sinkronisasi backend selesai[cite: 3].

---

## 2. Alur Autentikasi Magic Link (Go-To-Market Flow)
Alur ini dipilih karena memberikan friksi terendah bagi pengguna (tanpa perlu mengingat kata sandi)[cite: 1, 3].

1.  **Layar Masuk:** Pengguna hanya perlu memasukkan email pada form sederhana[cite: 3].
2.  **Pemicu Supabase:** Memanggil fungsi `supabase.auth.signInWithOtp({ email })`. Supabase akan mengirimkan email berisi tautan unik ke pengguna[cite: 1, 3].
3.  **Redireksi Sesi:** Setelah pengguna mengeklik tautan, Supabase mengarahkan kembali ke `imageopz.aindrajaya.my.id`. SDK secara otomatis menangkap token di URL dan menyimpannya sebagai sesi aktif[cite: 3].
4.  **Callback SPA:** Magic link diarahkan ke route SPA `/auth/callback`. Halaman ini menampilkan status “Signing you in…”, lalu memanggil `GET /api/v1/session/me` ke backend dengan header `Authorization: Bearer <supabase_access_token>` dan `X-Session-Id` untuk sinkronisasi state sesi.
5.  **Verifikasi Pro & Kredit:** Backend memverifikasi identitas dan mengembalikan status Pro serta sisa kredit (free/pro tier) dari database. Frontend menggunakan nilai ini sebagai *source of truth* untuk gating UI.

---

## 3. Struktur Folder & Modul (Best Practice)
Untuk memudahkan *vibe coding* dengan asisten AI, gunakan struktur modular berikut:

```text
src/
├── components/
│   ├── auth/
│   │   ├── MagicLinkSignIn.tsx   // Form input email (Modal/Paywall)
│   │   └── AuthCallback.tsx      // Route /auth/callback
│   ├── upload/
│   │   ├── Dropzone.tsx          // Area drag-and-drop (v1.4)
│   │   └── ProgressTracker.tsx   // Polling status job_id (v1.3)
│   └── ui/
│       └── PaywallModal.tsx      // Integrasi LemonSqueezy (v1.4)
├── context/
│   └── AuthContext.tsx           // Source of truth status user & session
├── lib/
│   ├── supabaseClient.ts         // Inisialisasi Supabase SDK
│   └── api.ts                    // Fetch/Axios helper untuk menyisipkan Bearer Token
└── App.tsx                       // Routing & Auth Gating
```

---

## 4. Strategi Pengamanan & Optimasi
Mengingat keterbatasan RAM 1GB di server, perlindungan dilakukan sejak di sisi frontend[cite: 2]:

*   **Validasi Sisi Klien:** Sebelum dikirim ke backend, file diperiksa tipenya (hanya JPEG/PNG/WEBP) dan ukurannya (maksimal 10MB untuk gratis, 50MB untuk Pro) menggunakan API File HTML5[cite: 3].
*   **JWT Pasif:** Frontend tidak perlu meminta token baru setiap saat; SDK Supabase menangani pembaruan token secara latar belakang[cite: 3].
*   **Polling Responsif:** Status optimasi dipantau melalui *polling* setiap 3 detik. Jika server Seattle sedang sibuk (antrean BullMQ panjang), frontend akan menawarkan opsi pengiriman hasil via email[cite: 2, 3].

---

## 5. Integrasi Monetisasi (LemonSqueezy)
Frontend bertindak sebagai pemicu transaksi yang transparan[cite: 3]:

*   **Trigger:** Saat kredit gratis (3 kali) di *Local Storage* atau database habis, antarmuka akan mengunci area unggah[cite: 3].
*   **Overlay Checkout:** Menggunakan `LemonSqueezy.Setup()` untuk memunculkan modal pembayaran. Setelah sukses, frontend memicu *refresh* status sesi untuk mengaktifkan fitur *bulk upload* hingga 30 gambar[cite: 3].

### Mengapa pendekatan ini efektif untuk Anda?
Dengan arsitektur ini, **ImageOpz** mendapatkan sistem keamanan tingkat tinggi dari Supabase tanpa Anda harus mengelola infrastruktur database pengguna yang berat di VPS Vultr[cite: 1, 2]. Hal ini menjamin ketersediaan sumber daya server yang maksimal untuk melakukan tugas inti: menjalankan Python CLI untuk optimasi gambar[cite: 2].

Apakah Anda ingin saya memberikan draf kode untuk `AuthContext.tsx` yang mengintegrasikan status Pro dari backend dan sesi dari Supabase secara bersamaan?[cite: 3]
