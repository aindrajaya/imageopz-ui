1. setelah user mencoba login alrady purchased, terus menerima email konfirmasi dari supabase, lalu user tersebut lupa kalau belum membeli, lalu dia beli, dan error checkout

INFO:     127.0.0.1:63202 - "OPTIONS /api/v1/session/me HTTP/1.1" 400 Bad Request
INFO:     127.0.0.1:44860 - "OPTIONS /api/v1/checkout/lemonsqueezy HTTP/1.1" 400 Bad Request
INFO:     127.0.0.1:44860 - "OPTIONS /api/v1/checkout/lemonsqueezy HTTP/1.1" 400 Bad Request

2. Harusnya ada tulisan di image preview bahwa akunnya belum aktif sepenuhnya, dan dibutuhkan untuk Claim Pro (untuk konfirmasi email)

3. Ada issue too many request di server supabase, coba cari tahu kenapa

4. Setelah konfirmasi email, login dengan supabase, tapi UI Masih ada button claim pro (itu akan sangat membingungkan) dan tanda Pro apa perlu ditambah email ya? atau tidak perlu

5. setelah login dan konfirmasi email, masuk jadi pro, tapi malah error ketika optimisations dan di backend malah ada error seperti ini
INFO:     127.0.0.1:13307 - "OPTIONS /api/v1/session/me HTTP/1.1" 200 OK
INFO:     127.0.0.1:13307 - "OPTIONS /api/v1/session/me HTTP/1.1" 400 Bad Request
INFO:     127.0.0.1:55825 - "GET /api/v1/session/me HTTP/1.1" 200 OK
INFO:     127.0.0.1:55825 - "GET /api/v1/session/me HTTP/1.1" 200 OK
INFO:     127.0.0.1:47232 - "OPTIONS /api/v1/session/me HTTP/1.1" 400 Bad Request
INFO:     127.0.0.1:47232 - "OPTIONS /api/v1/optimize HTTP/1.1" 400 Bad Request
tapi setelah refresh berhasil

