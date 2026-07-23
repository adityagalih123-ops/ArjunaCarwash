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
├── pengeluaran.html            # Belanja / Pengeluaran (CRUD)
├── laporan-transaksi.html      # Laporan transaksi harian
├── laporan-item.html           # Laporan item terjual
├── laporan-keuangan.html       # Laporan keuangan (omset, biaya, laba, margin owner)
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
│   ├── pengeluaran.js
│   ├── laporan-transaksi.js
│   ├── laporan-item.js
│   └── laporan-keuangan.js
└── assets/
    ├── logo.png                 # Logo perusahaan (ganti sesuai brand Anda)
    └── qris-template.svg         # Placeholder QRIS — WAJIB diganti dengan QRIS asli merchant
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
  "laborCost": 8000,        // Biaya Gaji (field baru)
  "operationalCost": 4000,  // Biaya Operasional (field baru)
  "hpp": 12000,             // TURUNAN OTOMATIS = laborCost + operationalCost.
                            // Field lama ini TETAP disimpan (tidak dihapus) demi
                            // kompatibilitas dengan data/kode lama, tapi TIDAK lagi
                            // ditampilkan/diisi manual di form Master Produk.
  "active": true,
  "createdAt": Timestamp,
  "updatedAt": Timestamp
}
```
> **Catatan migrasi:** produk yang dibuat SEBELUM revisi ini hanya punya field
> `hpp` (tanpa `laborCost`/`operationalCost`). Produk lama akan otomatis
> dianggap `laborCost: 0` dan `operationalCost: 0` sampai Anda membuka & simpan
> ulang produk tersebut lewat form Master Produk untuk mengisi nilai barunya.

### Koleksi `transactions/{trxId}`
```jsonc
{
  "trxNo": "TRX-20260715-0001",
  "shiftId": "abc123",
  "cashierUid": "uid-user",
  "cashierName": "Budi Santoso",
  "items": [
    {
      "productId": "p1",
      "name": "Cuci Mobil Reguler",
      "qty": 2,
      "price": 35000,
      "laborCost": 8000,        // Biaya Gaji per unit (field baru)
      "operationalCost": 4000,  // Biaya Operasional per unit (field baru)
      "hpp": 12000,             // turunan otomatis, tetap disimpan demi kompatibilitas
      "subtotal": 70000
    }
  ],
  "subtotal": 70000,
  "discountType": "percent" | "nominal" | null,
  "discountValue": 10,
  "discountAmount": 7000,
  "discountReason": "Promo pelanggan setia",
  "paymentMethod": "Tunai" | "Debit/Kredit" | "QRIS" | "Transfer Bank" | "Lainnya",
  "total": 63000,
  "totalHpp": 24000,            // turunan otomatis, tetap disimpan demi kompatibilitas
  "totalLaborCost": 16000,      // field baru — dipakai untuk hitung Laba Bersih
  "totalOperationalCost": 8000, // field baru — dipakai untuk hitung Laba Bersih
  "lastEditedAt": Timestamp,    // hanya ada jika transaksi pernah diedit admin
  "lastEditedBy": "Nama Admin", // hanya ada jika transaksi pernah diedit admin
  "editCount": 1,               // hanya ada jika transaksi pernah diedit admin
  "createdAt": Timestamp
}
```

**Laba Bersih** = Omset − Biaya Gaji − Biaya Operasional − Diskon. Karena field
`total` sudah bersih dari diskon (`total = subtotal - discountAmount`), rumus di
kode memakai `total - totalLaborCost - totalOperationalCost` supaya diskon tidak
terkurangi dua kali — hasilnya identik dengan rumus di atas.

> **Catatan migrasi:** transaksi yang dibuat SEBELUM revisi ini tidak punya
> field `totalLaborCost`/`totalOperationalCost`, sehingga akan dihitung 0 pada
> laporan (Laba Bersih transaksi lama = Omset penuh). Ini adalah batasan wajar
> dari perubahan skema tanpa migrasi data historis.

### Koleksi `expenses/{expenseId}` — Belanja/Pengeluaran
```jsonc
{
  "date": Timestamp,           // tanggal pembelian (bisa mundur, diisi manual)
  "itemName": "Sabun Shampoo Mobil",
  "category": "Operasional" | "Gaji",  // field baru — dipakai untuk Laporan Keuangan
  "qty": 5,
  "unit": "liter",              // pcs | liter | kg | pack | box | botol | galon | unit | (bebas via "Lainnya")
  "unitPrice": 45000,
  "totalPrice": 225000,         // qty x unitPrice (dihitung otomatis)
  "notes": "Beli di toko ABC",
  "shiftId": "abc123",          // shift aktif saat pengeluaran dicatat (null jika tidak ada shift aktif)
  "createdByUid": "uid-user",
  "createdByName": "Budi Santoso",
  "createdAt": Timestamp,
  "updatedAt": Timestamp
}
```
> **Catatan migrasi:** pengeluaran yang dicatat SEBELUM revisi ini tidak punya
> field `category`. Di Laporan Keuangan, catatan tanpa kategori otomatis
> dianggap "Operasional" (ada peringatan di halaman jika ini terjadi pada
> periode yang dipilih) — buka & simpan ulang catatan lama tersebut lewat
> menu Belanja/Pengeluaran untuk melengkapi kategorinya.

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
  "omzet": 550000,           // omzet semua metode pembayaran
  "tunaiMasuk": 320000,      // hanya transaksi metode "Tunai" (yang masuk laci kas fisik)
  "totalPengeluaran": 45000, // total belanja/pengeluaran tercatat pada shift ini
  "kasSeharusnya": 475000,   // modalAwal + tunaiMasuk - totalPengeluaran
  "kasFisik": 470000,        // hasil hitung fisik kasir saat tutup shift
  "selisihKas": -5000        // kasFisik - kasSeharusnya
}
```

**Alur kas real-time:** Modal Awal (saat buka shift) → bertambah dari tiap transaksi
kasir bermetode **Tunai** → berkurang dari tiap pengeluaran yang dicatat selagi shift
itu aktif (field `shiftId` pada `expenses` menempel otomatis ke shift yang sedang
berjalan). Angka **Kas Saat Ini** ini tampil real-time di Dashboard & halaman Shift,
dan menjadi acuan "Kas Seharusnya" saat proses Tutup Shift.

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
| Menu yang terlihat di sidebar  | Semua menu | Hanya **Kasir, Shift, Belanja/Pengeluaran** |
| Login & transaksi kasir        | ✅    | ✅    |
| Buka/Tutup shift               | ✅    | ✅    |
| Edit harga saat transaksi      | ✅    | Hanya jika `canEditPrice: true` |
| Akses halaman Dashboard        | ✅    | ❌ (redirect otomatis ke Kasir) |
| Akses halaman Master Produk    | ✅    | ❌ (redirect otomatis ke Kasir) |
| Akses halaman Laporan Transaksi/Item | ✅ | ❌ (redirect otomatis ke Kasir) |
| Akses halaman Laporan Keuangan | ✅ | ❌ (redirect otomatis ke Kasir) |
| Edit transaksi yang sudah tersimpan | ✅ | ❌ |
| Catat pengeluaran/belanja      | ✅    | ✅    |
| Edit/Hapus catatan pengeluaran | ✅ (semua) | Hanya catatan miliknya sendiri |

Role dan `canEditPrice` diatur lewat field pada dokumen
`users/{uid}` di Firestore Console. Pembatasan akses halaman di atas
ditegakkan di sisi client (redirect) — pastikan Firestore Rules (`firestore.rules`)
tetap menjadi lapisan keamanan utama, bukan hanya UI.

---

## 9. Laporan Keuangan — Penjelasan Rumus

Halaman ini (khusus admin) meringkas kesehatan finansial usaha secara
bertahap, dari omset kotor sampai keuntungan riil pemilik:

1. **Total Omset** = Omset Tunai + Omset Non-Tunai (nilai transaksi sebelum
   dipotong diskon, dari koleksi `transactions`, field `subtotal`).
2. **Total Diskon** = jumlah `discountAmount` seluruh transaksi pada periode.
3. **Total Omset Bersih** = Total Omset − Total Diskon.
4. **Total Biaya Operasional** = jumlah `totalOperationalCost` seluruh
   transaksi (nilai ini berasal dari field "Biaya Operasional" di Master
   Produk, dikalikan qty terjual).
5. **Total Biaya Gaji** = jumlah `totalLaborCost` seluruh transaksi (dari
   field "Biaya Gaji" di Master Produk).
6. **Total Laba Bersih** = Total Omset Bersih − Biaya Operasional − Biaya Gaji.
7. **Margin Operasional** = Total Biaya Operasional (dianggarkan lewat harga
   jual) − Pengeluaran Operasional aktual (dari menu Belanja/Pengeluaran,
   kategori "Operasional"). Bisa positif (hemat) atau negatif (boros).
8. **Margin Gaji** = Total Biaya Gaji (dianggarkan) − Pengeluaran Gaji aktual
   (kategori "Gaji").
9. **Margin Owner** = Total Laba Bersih + Margin Operasional + Margin Gaji —
   ini angka keuntungan paling nyata bagi pemilik usaha.

Filter tanggal tersedia di bagian atas halaman, dan laporan bisa diunduh
sebagai PDF lewat tombol **Download PDF** (memakai dialog cetak bawaan
browser — pilih tujuan cetak **"Save as PDF" / "Simpan sebagai PDF"**).

---

## 10. Catatan Pengembangan Lanjutan

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
- **PENTING — Gambar QRIS:** `assets/qris-template.svg` hanyalah contoh/placeholder
  (bukan kode QRIS asli, tidak bisa dipakai untuk transaksi sungguhan). Ganti
  file ini dengan gambar QRIS resmi dari bank/penyedia layanan pembayaran Anda
  (simpan dengan nama file yang sama, `qris-template.svg`) supaya pelanggan
  bisa scan dan membayar dengan benar.

---

## 11. Lisensi

Source code ini bebas digunakan dan dimodifikasi untuk kebutuhan bisnis Anda.
