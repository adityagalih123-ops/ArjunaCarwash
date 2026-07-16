/**
 * firebase-config.js
 * -----------------------------------------------------------------------
 * Konfigurasi koneksi Firebase untuk aplikasi POS Cucian Mobil.
 *
 * CARA PAKAI:
 * 1. Buka https://console.firebase.google.com -> buat/pilih project.
 * 2. Project Settings -> General -> "Your apps" -> tambah Web App.
 * 3. Copy objek firebaseConfig yang diberikan Firebase, tempel di bawah ini.
 * 4. Aktifkan layanan berikut di Firebase Console:
 *    - Authentication -> Sign-in method -> Email/Password (Enable)
 *    - Firestore Database -> Create database (mode production)
 * 5. Deploy security rules dari firestore.rules (lihat README.md).
 * -----------------------------------------------------------------------
 */

const firebaseConfig = {
  apiKey: "GANTI_DENGAN_API_KEY_ANDA",
  authDomain: "GANTI_DENGAN_PROJECT_ID.firebaseapp.com",
  projectId: "GANTI_DENGAN_PROJECT_ID",
  storageBucket: "GANTI_DENGAN_PROJECT_ID.appspot.com",
  messagingSenderId: "GANTI_DENGAN_SENDER_ID",
  appId: "GANTI_DENGAN_APP_ID"
};

// Inisialisasi Firebase (SDK versi "compat" dipakai supaya tidak perlu
// build tool / bundler -- cocok untuk static hosting seperti GitHub Pages)
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

// Cache offline ringan supaya reload halaman lebih cepat
db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
  console.warn("Firestore persistence tidak aktif:", err.code);
});

// Nama koleksi Firestore -- satu sumber kebenaran agar mudah dikembangkan
const COLLECTIONS = {
  USERS: "users",
  PRODUCTS: "products",
  TRANSACTIONS: "transactions",
  SHIFTS: "shifts",
  SETTINGS: "settings"
};

const SETTINGS_DOC_ID = "general";
