# POS Cucian Mobil

Aplikasi Point of Sale (POS) berbasis web untuk bisnis cucian mobil.
Dibangun dengan **HTML5 + CSS3 + JavaScript (Vanilla ES6)**, **Firebase
Authentication**, dan **Cloud Firestore**. Tidak memakai framework/bundler
apa pun sehingga bisa langsung di-deploy ke Firebase Hosting maupun
GitHub Pages tanpa proses build.

---

## 1. Tech Stack

| Layer          | Teknologi                                   |
|----------------|----------------------------------------------|
| Frontend       | HTML5, CSS3 (custom, mobile-first), JavaScript ES6 |
| Auth           | Firebase Authentication (Email/Password)     |
| Database       | Cloud Firestore                              |
| Hosting        | Firebase Hosting **atau** GitHub Pages       |

Tidak ada dependency npm/build step — semua library dimuat lewat CDN
(`firebase-app-compat.js`, dst) agar ringan dan cepat dimuat.

---

## 2. Struktur Folder

```
pos-cucian-mobil/
├── index.html                 # Halaman login
├── dashboard.html              # Dashboard ringkasan
├── kasir.html                  # Halaman transaksi kasir
├── produk.html                 # Master produk (CRUD)
├── shift.html                  # Manajemen shift
├── laporan-transaksi.html      # Laporan transaksi harian
├── laporan-item.html           # Laporan item terjual
├── firebase.json                # Konfigurasi Firebase Hosting
├── firestore.rules              # Security rules Firestore
├── firestore.indexes.json       # Index Firestore
├── css/
│   └── style.css                # Semua styling (biru + putih, responsive)
├── js/
│   ├── firebase-config.js       # Kredensial project Firebase (ISI SENDIRI)
│   ├── utils.js                 # Fungsi bantu (format rupiah, tanggal, toast, dll)
│   ├── auth-guard.js            # Proteksi halaman + auto logout 3 jam
│   ├── sidebar.js               # Navigasi sidebar/topbar bersama
│   ├── dashboard.js
│   ├── kasir.js
│   ├── produk.js
│   ├── shift.js
│   ├── laporan-transaksi.js
│   └── laporan-item.js
└── assets/
    └── logo.png                 # Logo perusahaan (ganti sesuai brand Anda)
```

Modular: setiap halaman punya file JS sendiri, sedangkan logika yang
dipakai bersama (auth, format, sidebar) dipisah ke file tersendiri agar
mudah dikembangkan.

---

## 3. Struktur Firestore

### Koleksi `users/{uid}`
```jsonc
{
  "name": "Budi Santoso",
  "email": "budi@cucianmobil.com",
  "role": "admin" | "kasir",
  "canEditPrice": true,      // hak akses edit harga saat transaksi
  "active": true,
  "createdAt": Timestamp
}
```

### Koleksi `products/{productId}`
```jsonc
{
  "name": "Cuci Mobil Reguler",
  "sellPrice": 35000,
  "hpp": 12000,
  "active": true,
  "createdAt": Timestamp,
  "updatedAt": Timestamp
}
```

### Koleksi `transactions/{trxId}`
```jsonc
{
  "trxNo": "TRX-20260715-0001",
  "shiftId": "abc123",
  "cashierUid": "uid-user",
  "cashierName": "Budi Santoso",
  "items": [
    { "productId": "p1", "name": "Cuci Mobil Reguler", "qty": 2, "price": 35000, "hpp": 12000, "subtotal": 70000 }
  ],
  "total": 70000,
  "totalHpp": 24000,
  "createdAt": Timestamp
}
```

### Koleksi `shifts/{shiftId}`
```jsonc
{
  "cashierUid": "uid-user",
  "cashierName": "Budi Santoso",
  "openTime": Timestamp,
  "closeTime": Timestamp,
  "modalAwal": 200000,
  "status": "open" | "closed",
  "totalTransaksi": 15,
  "omzet": 550000,
  "kasFisik": 745000,
  "selisihKas": -5000
}
```

### Koleksi `settings/{docId}`
```jsonc
// dokumen: settings/general
{
  "companyName": "Kinclong Car Wash",
  "address": "Jl. Merdeka No. 10, Jakarta"
}

// dokumen otomatis untuk counter nomor transaksi harian: settings/counter-YYYY-MM-DD
{ "value": 12, "date": "2026-07-15" }
```

---

## 4. Persiapan Firebase

1. Buka [Firebase Console](https://console.firebase.google.com) → **Add project**.
2. **Build → Authentication → Sign-in method** → aktifkan **Email/Password**.
3. **Build → Firestore Database** → **Create database** (pilih mode production,
   lokasi terdekat misalnya `asia-southeast2`).
4. **Project settings → General → Your apps** → klik ikon Web (`</>`) →
   daftarkan app → salin objek `firebaseConfig` yang muncul.
5. Tempelkan objek tersebut ke `js/firebase-config.js`, menggantikan
   nilai placeholder `GANTI_DENGAN_...`.

### Membuat user pertama (admin)

Karena aplikasi ini tidak menyediakan halaman "Daftar" (sengaja, agar
kasir tidak bisa mendaftar sendiri), buat user pertama secara manual:

1. Firebase Console → **Authentication → Users → Add user** → isi email
   & password.
2. Firebase Console → **Firestore Database → Start collection** →
   nama koleksi `users` → **Document ID** = UID user yang baru dibuat
   (copy dari tab Authentication) → isi field:
   ```
   name: "Nama Anda"
   email: "email@anda.com"
   role: "admin"
   canEditPrice: true
   active: true
   ```
3. Login ke aplikasi menggunakan email/password tadi.

User berikutnya bisa dibuat dengan cara yang sama (gunakan `role: "kasir"`
untuk staf kasir biasa). Aplikasi juga otomatis membuat dokumen profil
default (`role: kasir`) jika user login dan dokumennya belum ada.

### Deploy Security Rules

```bash
firebase deploy --only firestore:rules
```

Rules yang disediakan (`firestore.rules`) memastikan:
- Semua koleksi hanya bisa diakses user yang sudah login.
- Hanya `role: admin` yang boleh menambah/mengubah/menghapus produk.
- Transaksi tidak bisa diubah/dihapus oleh kasir (integritas data keuangan).

---

## 5. Menjalankan Secara Lokal

Karena tidak ada build step, cukup jalankan static server, misalnya:

```bash
npx serve .
# atau
python3 -m http.server 8080
```

Lalu buka `http://localhost:8080` (pastikan domain lokal Anda sudah
ditambahkan di Firebase Console → Authentication → Settings →
**Authorized domains** jika diperlukan; `localhost` biasanya sudah
diizinkan secara default).

---

## 6. Deploy ke Firebase Hosting

```bash
npm install -g firebase-tools     # jika belum ada
firebase login
firebase init hosting             # pilih project yang sudah dibuat,
                                   # gunakan firebase.json yang sudah tersedia
firebase deploy
```

Setelah selesai, Firebase akan memberikan URL seperti
`https://nama-project.web.app`.

> **Catatan:** file `firebase.json` pada repo ini sudah dikonfigurasi
> dengan `"public": "."` sehingga Anda bisa langsung menjalankan
> `firebase deploy` tanpa mengubah struktur folder.

---

## 7. Deploy ke GitHub Pages

1. Push seluruh folder `pos-cucian-mobil` ke repository GitHub.
2. Di GitHub: **Settings → Pages** → Source: pilih branch (misal `main`)
   dan folder `/ (root)`.
3. Tunggu beberapa menit, situs akan tersedia di
   `https://username.github.io/nama-repo/`.
4. **Penting:** tambahkan domain GitHub Pages tersebut ke
   Firebase Console → **Authentication → Settings → Authorized domains**,
   agar proses login tidak diblokir (`auth/unauthorized-domain`).

---

## 8. Hak Akses & Peran (Role)

| Fitur                         | Admin | Kasir |
|--------------------------------|:-----:|:-----:|
| Login & transaksi kasir        | ✅    | ✅    |
| Buka/Tutup shift               | ✅    | ✅    |
| Edit harga saat transaksi      | ✅    | Hanya jika `canEditPrice: true` |
| Tambah/Edit/Hapus master produk| ✅    | ❌ (read-only) |
| Lihat laporan                  | ✅    | ✅    |

Role dan `canEditPrice` diatur lewat field pada dokumen
`users/{uid}` di Firestore Console.

---

## 9. Catatan Pengembangan Lanjutan

- Nomor transaksi dibuat otomatis via counter harian di
  `settings/counter-YYYY-MM-DD` menggunakan Firestore transaction agar
  tidak terjadi duplikasi saat beberapa kasir menyimpan transaksi
  bersamaan.
- Auto logout 3 jam bekerja dengan mencatat waktu aktivitas terakhir
  (`localStorage`) dan memeriksa setiap 1 menit di `auth-guard.js`.
- Grafik omzet 7 hari dibuat native dengan SVG (tanpa library chart
  eksternal) supaya aplikasi tetap ringan dan cepat dimuat.
- Struk dicetak memakai `window.print()` dengan CSS `@media print`
  yang menyembunyikan seluruh halaman kecuali elemen struk (lebar 300px,
  cocok untuk printer thermal 58/80mm — sesuaikan lebar di `.receipt`
  pada `style.css` bila perlu).
- Untuk menambah field/laporan baru, cukup tambahkan file JS baru dan
  ikuti pola yang sama (`requireAuth(...)` di awal file).

---

## 10. Lisensi

Source code ini bebas digunakan dan dimodifikasi untuk kebutuhan bisnis Anda.
