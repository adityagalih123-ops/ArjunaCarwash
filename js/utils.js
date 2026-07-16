/**
 * utils.js
 * Fungsi bantu bersama: format angka/tanggal, toast notifikasi,
 * generator nomor transaksi, dan helper Firestore Timestamp.
 */

// ---------- Format ----------
function formatRupiah(angka) {
  const n = Number(angka) || 0;
  return "Rp " + n.toLocaleString("id-ID", { maximumFractionDigits: 0 });
}

function formatTanggal(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function formatJam(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function todayKey(date = new Date()) {
  // YYYY-MM-DD berdasarkan waktu lokal (dipakai untuk filter harian)
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

// ---------- Nomor transaksi ----------
// Format: TRX-YYYYMMDD-XXXX (counter harian disimpan di settings/counters)
async function generateNomorTransaksi() {
  const key = todayKey();
  const counterRef = db.collection(COLLECTIONS.SETTINGS).doc("counter-" + key);

  const nomor = await db.runTransaction(async (t) => {
    const doc = await t.get(counterRef);
    let next = 1;
    if (doc.exists) {
      next = (doc.data().value || 0) + 1;
    }
    t.set(counterRef, { value: next, date: key }, { merge: true });
    return next;
  });

  const urut = String(nomor).padStart(4, "0");
  const tgl = key.replace(/-/g, "");
  return `TRX-${tgl}-${urut}`;
}

// ---------- Toast Notifikasi ----------
function showToast(message, type = "info") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ---------- Loading spinner sederhana ----------
function setLoading(el, isLoading, textLoading = "Memuat...") {
  if (!el) return;
  if (isLoading) {
    el.dataset.originalText = el.textContent;
    el.disabled = true;
    el.textContent = textLoading;
  } else {
    el.disabled = false;
    if (el.dataset.originalText) el.textContent = el.dataset.originalText;
  }
}

// ---------- Konversi Firestore Timestamp -> Date ----------
function toDate(ts) {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  return new Date(ts);
}

// ---------- Escape HTML sederhana (mencegah XSS pada render list) ----------
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

// ---------- Ambil query string ----------
function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}
