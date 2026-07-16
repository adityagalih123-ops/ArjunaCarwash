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
  apiKey: "AIzaSyCrozf7FJFzgKKfvUQRmX81uvXcTuDVlko",
  authDomain: "arjunacarwash-72c34.firebaseapp.com",
  projectId: "arjunacarwash-72c34",
  storageBucket: "arjunacarwash-72c34.firebasestorage.app",
  messagingSenderId: "752144664145",
  appId: "1:752144664145:web:40614daf52982736a31a70"
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
