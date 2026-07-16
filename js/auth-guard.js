/**
 * auth-guard.js
 * Wajib di-include di SEMUA halaman selain index.html (login).
 * - Memastikan user sudah login (redirect ke index.html jika belum).
 * - Memuat profil user dari koleksi `users` (role, nama, hak akses harga).
 * - Auto logout setelah 3 jam tidak ada aktivitas (mouse/keyboard/touch).
 */

const SESSION_TIMEOUT_MS = 3 * 60 * 60 * 1000; // 3 jam
const LAST_ACTIVITY_KEY = "pos_last_activity";

let currentUser = null; // { uid, email, name, role, canEditPrice, active }

function markActivity() {
  localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
}

function startInactivityWatcher() {
  markActivity();
  ["mousemove", "keydown", "click", "touchstart", "scroll"].forEach((evt) => {
    document.addEventListener(evt, markActivity, { passive: true });
  });

  setInterval(() => {
    const last = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || Date.now());
    if (Date.now() - last > SESSION_TIMEOUT_MS) {
      logoutUser("Sesi berakhir karena tidak ada aktivitas selama 3 jam.");
    }
  }, 60 * 1000); // cek tiap 1 menit
}

function logoutUser(message) {
  localStorage.removeItem(LAST_ACTIVITY_KEY);
  auth.signOut().finally(() => {
    const target = message
      ? `index.html?msg=${encodeURIComponent(message)}`
      : "index.html";
    window.location.href = target;
  });
}

/**
 * Panggil di setiap halaman terproteksi:
 *   requireAuth((user) => { ...init halaman... });
 */
function requireAuth(onReady) {
  auth.onAuthStateChanged(async (fbUser) => {
    if (!fbUser) {
      window.location.href = "index.html";
      return;
    }

    try {
      const doc = await db.collection(COLLECTIONS.USERS).doc(fbUser.uid).get();
      if (!doc.exists) {
        // User terdaftar di Auth tapi belum punya profil -> buat default
        await db.collection(COLLECTIONS.USERS).doc(fbUser.uid).set({
          name: fbUser.email.split("@")[0],
          email: fbUser.email,
          role: "kasir",
          canEditPrice: false,
          active: true,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
      const data = (await db.collection(COLLECTIONS.USERS).doc(fbUser.uid).get()).data();

      if (data.active === false) {
        showToast("Akun Anda tidak aktif. Hubungi admin.", "error");
        logoutUser();
        return;
      }

      currentUser = {
        uid: fbUser.uid,
        email: fbUser.email,
        name: data.name || fbUser.email,
        role: data.role || "kasir",
        canEditPrice: !!data.canEditPrice || data.role === "admin",
        active: data.active !== false
      };

      startInactivityWatcher();
      renderShell();
      onReady(currentUser);
    } catch (err) {
      console.error(err);
      showToast("Gagal memuat profil pengguna.", "error");
    }
  });
}

function isAdmin() {
  return currentUser && currentUser.role === "admin";
}
