/**
 * shift.js - Manajemen Shift
 */
let activeShiftData = null;

requireAuth(async (user) => {
  document.getElementById("namaKasirShift").value = user.name;
  bindEvents();
  await Promise.all([loadShiftState(), loadRiwayat()]);
});

function bindEvents() {
  document.getElementById("btnBatalBuka").addEventListener("click", () => toggleModal("bukaShiftModal", false));
  document.getElementById("bukaShiftModal").addEventListener("click", (e) => {
    if (e.target.id === "bukaShiftModal") toggleModal("bukaShiftModal", false);
  });
  document.getElementById("bukaShiftForm").addEventListener("submit", bukaShift);

  document.getElementById("btnBatalTutup").addEventListener("click", () => toggleModal("tutupShiftModal", false));
  document.getElementById("tutupShiftModal").addEventListener("click", (e) => {
    if (e.target.id === "tutupShiftModal") toggleModal("tutupShiftModal", false);
  });
  document.getElementById("tutupShiftForm").addEventListener("submit", tutupShift);
}

function toggleModal(id, show) {
  document.getElementById(id).classList.toggle("show", show);
}

async function loadShiftState() {
  const card = document.getElementById("shiftCard");
  try {
    const snap = await db.collection(COLLECTIONS.SHIFTS).where("status", "==", "open").limit(1).get();

    if (snap.empty) {
      activeShiftData = null;
      card.innerHTML = `
        <div class="flex-between" style="flex-wrap:wrap; gap:12px;">
          <div>
            <div class="font-bold">Tidak ada shift aktif</div>
            <div class="text-muted" style="font-size:13px;">Buka shift baru untuk mulai menerima transaksi.</div>
          </div>
          <button class="btn btn-primary" onclick="bukaModalShift()">Buka Shift</button>
        </div>`;
      return;
    }

    activeShiftData = { id: snap.docs[0].id, ...snap.docs[0].data() };
    card.innerHTML = `
      <div class="flex-between" style="flex-wrap:wrap; gap:12px;">
        <div>
          <div class="flex gap-8" style="align-items:center;">
            <span class="font-bold">${escapeHtml(activeShiftData.cashierName)}</span>
            <span class="shift-status open"><span class="dot"></span> Aktif</span>
          </div>
          <div class="text-muted mt-8" style="font-size:13px;">
            Dibuka: ${formatTanggal(toDate(activeShiftData.openTime))} ${formatJam(toDate(activeShiftData.openTime))}
            &middot; Modal Awal: ${formatRupiah(activeShiftData.modalAwal)}
          </div>
        </div>
        <button class="btn btn-danger" onclick="bukaModalTutup()">Tutup Shift</button>
      </div>`;
  } catch (err) {
    console.error(err);
    card.innerHTML = `<p class="text-danger">Gagal memuat status shift.</p>`;
  }
}

function bukaModalShift() {
  document.getElementById("jamBukaPreview").value = `${formatTanggal(new Date())} ${formatJam(new Date())}`;
  toggleModal("bukaShiftModal", true);
}

async function bukaShift(e) {
  e.preventDefault();
  const btn = document.getElementById("btnSimpanBuka");
  setLoading(btn, true, "Membuka...");

  try {
    // Validasi ulang: pastikan tidak ada shift terbuka (mencegah race condition)
    const snap = await db.collection(COLLECTIONS.SHIFTS).where("status", "==", "open").limit(1).get();
    if (!snap.empty) {
      showToast("Masih ada shift yang belum ditutup. Tutup shift tersebut terlebih dahulu.", "error");
      toggleModal("bukaShiftModal", false);
      await loadShiftState();
      return;
    }

    const data = {
      cashierUid: currentUser.uid,
      cashierName: document.getElementById("namaKasirShift").value.trim() || currentUser.name,
      openTime: firebase.firestore.FieldValue.serverTimestamp(),
      modalAwal: Number(document.getElementById("modalAwal").value) || 0,
      status: "open",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    await db.collection(COLLECTIONS.SHIFTS).add(data);
    showToast("Shift berhasil dibuka.", "success");
    toggleModal("bukaShiftModal", false);
    document.getElementById("bukaShiftForm").reset();
    await Promise.all([loadShiftState(), loadRiwayat()]);
  } catch (err) {
    console.error(err);
    showToast("Gagal membuka shift.", "error");
  } finally {
    setLoading(btn, false);
  }
}

async function bukaModalTutup() {
  if (!activeShiftData) return;
  const box = document.getElementById("ringkasanTutup");
  box.innerHTML = `<p class="text-muted">Menghitung ringkasan transaksi shift...</p>`;
  toggleModal("tutupShiftModal", true);

  try {
    const snap = await db
      .collection(COLLECTIONS.TRANSACTIONS)
      .where("shiftId", "==", activeShiftData.id)
      .get();

    let omzet = 0;
    snap.forEach((doc) => (omzet += doc.data().total || 0));

    activeShiftData._closingPreview = { totalTransaksi: snap.size, omzet };

    box.innerHTML = `
      <div class="card" style="background:var(--primary-soft); border:none;">
        <div class="cart-summary-row"><span>Modal Awal</span><span>${formatRupiah(activeShiftData.modalAwal)}</span></div>
        <div class="cart-summary-row"><span>Total Transaksi</span><span>${snap.size}</span></div>
        <div class="cart-summary-row"><span>Omzet Shift Ini</span><span>${formatRupiah(omzet)}</span></div>
        <div class="cart-summary-row total"><span>Kas Seharusnya</span><span>${formatRupiah(activeShiftData.modalAwal + omzet)}</span></div>
      </div>`;
  } catch (err) {
    console.error(err);
    box.innerHTML = `<p class="text-danger">Gagal menghitung ringkasan.</p>`;
  }
}

async function tutupShift(e) {
  e.preventDefault();
  if (!activeShiftData || !activeShiftData._closingPreview) return;

  const btn = document.getElementById("btnSimpanTutup");
  setLoading(btn, true, "Menutup...");

  try {
    const { totalTransaksi, omzet } = activeShiftData._closingPreview;
    const kasFisik = Number(document.getElementById("kasFisik").value) || 0;
    const kasSeharusnya = activeShiftData.modalAwal + omzet;
    const selisihKas = kasFisik - kasSeharusnya;

    await db.collection(COLLECTIONS.SHIFTS).doc(activeShiftData.id).update({
      status: "closed",
      closeTime: firebase.firestore.FieldValue.serverTimestamp(),
      totalTransaksi,
      omzet,
      kasFisik,
      selisihKas
    });

    showToast("Shift berhasil ditutup.", "success");
    toggleModal("tutupShiftModal", false);
    document.getElementById("tutupShiftForm").reset();
    await Promise.all([loadShiftState(), loadRiwayat()]);
  } catch (err) {
    console.error(err);
    showToast("Gagal menutup shift.", "error");
  } finally {
    setLoading(btn, false);
  }
}

async function loadRiwayat() {
  const tbody = document.getElementById("riwayatShiftBody");
  try {
    const snap = await db.collection(COLLECTIONS.SHIFTS).orderBy("openTime", "desc").limit(20).get();
    if (snap.empty) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">Belum ada riwayat shift.</td></tr>`;
      return;
    }
    tbody.innerHTML = snap.docs
      .map((doc) => {
        const s = doc.data();
        const selisihClass = s.selisihKas > 0 ? "text-success" : s.selisihKas < 0 ? "text-danger" : "";
        return `
        <tr>
          <td>${escapeHtml(s.cashierName)}</td>
          <td>${s.openTime ? formatJam(toDate(s.openTime)) + " " + formatTanggal(toDate(s.openTime)) : "-"}</td>
          <td>${s.closeTime ? formatJam(toDate(s.closeTime)) + " " + formatTanggal(toDate(s.closeTime)) : "-"}</td>
          <td class="text-right">${formatRupiah(s.modalAwal)}</td>
          <td class="text-right">${s.omzet !== undefined ? formatRupiah(s.omzet) : "-"}</td>
          <td class="text-right ${selisihClass}">${s.selisihKas !== undefined ? formatRupiah(s.selisihKas) : "-"}</td>
          <td class="text-center"><span class="shift-status ${s.status === "open" ? "open" : "closed"}">${s.status === "open" ? "Aktif" : "Tutup"}</span></td>
        </tr>`;
      })
      .join("");
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Gagal memuat riwayat.</td></tr>`;
  }
}
