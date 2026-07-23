/**
 * dashboard.js
 */
requireAuth(async () => {
  if (!isAdmin()) {
    showToast("Halaman ini khusus admin.", "error");
    window.location.href = "kasir.html";
    return;
  }

  document.getElementById("todayLabel").textContent =
    "Ringkasan " + formatTanggal(new Date());

  await Promise.all([loadTodayStats(), loadTodayExpenses(), loadWeekChart(), loadActiveShift()]);
});

async function loadTodayStats() {
  const start = firebase.firestore.Timestamp.fromDate(startOfDay(new Date()));
  const end = firebase.firestore.Timestamp.fromDate(endOfDay(new Date()));

  try {
    const snap = await db
      .collection(COLLECTIONS.TRANSACTIONS)
      .where("createdAt", ">=", start)
      .where("createdAt", "<=", end)
      .get();

    let omzet = 0;
    let totalKendaraan = 0;
    let totalLaborCost = 0;
    let totalOperationalCost = 0;

    snap.forEach((doc) => {
      const trx = doc.data();
      omzet += trx.total || 0;
      // totalLaborCost/totalOperationalCost baru ada di transaksi sejak fitur
      // biaya ini ditambahkan; transaksi lama (belum punya field ini) dihitung 0.
      totalLaborCost += trx.totalLaborCost || 0;
      totalOperationalCost += trx.totalOperationalCost || 0;
      (trx.items || []).forEach((it) => {
        totalKendaraan += it.qty || 0;
      });
    });

    // Laba Bersih = Omset - Biaya Gaji - Biaya Operasional - Diskon.
    // Karena "total" transaksi sudah bersih dari diskon (total = subtotal - diskon),
    // maka Omset di sini pakai "total" supaya diskon tidak dikurangi dua kali.
    const labaBersih = omzet - totalLaborCost - totalOperationalCost;

    document.getElementById("statOmzet").textContent = formatRupiah(omzet);
    document.getElementById("statLaba").textContent = formatRupiah(labaBersih);
    document.getElementById("statKendaraan").textContent = totalKendaraan;
  } catch (err) {
    console.error(err);
    showToast("Gagal memuat statistik hari ini.", "error");
  }
}

async function loadTodayExpenses() {
  const start = firebase.firestore.Timestamp.fromDate(startOfDay(new Date()));
  const end = firebase.firestore.Timestamp.fromDate(endOfDay(new Date()));

  try {
    const snap = await db
      .collection(COLLECTIONS.EXPENSES)
      .where("date", ">=", start)
      .where("date", "<=", end)
      .get();

    let totalPengeluaran = 0;
    snap.forEach((doc) => (totalPengeluaran += doc.data().totalPrice || 0));
    document.getElementById("statPengeluaran").textContent = formatRupiah(totalPengeluaran);
  } catch (err) {
    console.error(err);
    document.getElementById("statPengeluaran").textContent = "Rp 0";
  }
}

async function loadWeekChart() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({ key: todayKey(d), label: d.toLocaleDateString("id-ID", { weekday: "short" }), total: 0 });
  }

  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const start = firebase.firestore.Timestamp.fromDate(startOfDay(sevenDaysAgo));
    const snap = await db
      .collection(COLLECTIONS.TRANSACTIONS)
      .where("createdAt", ">=", start)
      .get();

    snap.forEach((doc) => {
      const trx = doc.data();
      const d = toDate(trx.createdAt);
      if (!d) return;
      const key = todayKey(d);
      const found = days.find((x) => x.key === key);
      if (found) found.total += trx.total || 0;
    });
  } catch (err) {
    console.error(err);
  }

  renderRevenueChart(days);
}

function renderRevenueChart(days) {
  const svg = document.getElementById("revenueChart");
  const w = 700, h = 220, padL = 50, padB = 30, padT = 16, padR = 16;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;
  const maxVal = Math.max(...days.map((d) => d.total), 1);
  const barGap = 14;
  const barW = (chartW - barGap * (days.length - 1)) / days.length;

  let bars = "";
  let labels = "";
  let gridLines = "";

  // grid horizontal (4 garis)
  for (let i = 0; i <= 4; i++) {
    const y = padT + (chartH / 4) * i;
    const val = Math.round(maxVal - (maxVal / 4) * i);
    gridLines += `<line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" stroke="#e1e6ef" stroke-width="1"/>`;
    gridLines += `<text x="${padL - 8}" y="${y + 4}" font-size="9.5" fill="#9aa5b5" text-anchor="end">${formatShortNumber(val)}</text>`;
  }

  days.forEach((d, i) => {
    const barH = (d.total / maxVal) * chartH;
    const x = padL + i * (barW + barGap);
    const y = padT + chartH - barH;
    bars += `<rect x="${x}" y="${y}" width="${barW}" height="${Math.max(barH, 1)}" rx="5" fill="#1565d8">
      <title>${d.label}: ${formatRupiah(d.total)}</title>
    </rect>`;
    labels += `<text x="${x + barW / 2}" y="${h - 8}" font-size="10.5" fill="#6b7684" text-anchor="middle">${d.label}</text>`;
  });

  svg.innerHTML = gridLines + bars + labels;
}

function formatShortNumber(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "jt";
  if (n >= 1000) return (n / 1000).toFixed(0) + "rb";
  return String(n);
}

async function loadActiveShift() {
  const box = document.getElementById("activeShiftBox");
  try {
    const snap = await db
      .collection(COLLECTIONS.SHIFTS)
      .where("status", "==", "open")
      .limit(1)
      .get();

    if (snap.empty) {
      box.innerHTML = `<p class="text-muted">Tidak ada shift yang sedang aktif. Buka shift di menu <a href="shift.html" style="color:var(--primary);font-weight:700;">Shift</a>.</p>`;
      return;
    }

    const shiftId = snap.docs[0].id;
    const shift = snap.docs[0].data();
    box.innerHTML = `
      <div class="flex-between" style="flex-wrap:wrap; gap:10px;">
        <div>
          <div class="font-bold">${escapeHtml(shift.cashierName)}</div>
          <div class="text-muted" style="font-size:12.5px;">Buka: ${formatJam(toDate(shift.openTime))} &middot; Modal: ${formatRupiah(shift.modalAwal)}</div>
        </div>
        <span class="shift-status open"><span class="dot"></span> Sedang Berjalan</span>
      </div>
      <div id="dashKasBox" class="mt-16"><p class="text-muted" style="font-size:12.5px;">Menghitung kas berjalan...</p></div>
    `;

    const kas = await hitungKasShift(shiftId, shift.modalAwal);
    const omzetNonTunai = kas.omzetSemua - kas.tunaiMasuk;
    document.getElementById("dashKasBox").innerHTML = `
      <div class="card" style="background:var(--primary-soft); border:none; padding:12px;">
        <div class="cart-summary-row" style="font-size:13px;"><span>Omzet Tunai</span><span>${formatRupiah(kas.tunaiMasuk)}</span></div>
        <div class="cart-summary-row" style="font-size:13px;"><span>Omzet Non-Tunai</span><span>${formatRupiah(omzetNonTunai)}</span></div>
        <div class="cart-summary-row" style="font-size:13px; border-top:1px dashed var(--gray-200); padding-top:8px;"><span>Total Omzet Berjalan</span><span>${formatRupiah(kas.omzetSemua)}</span></div>
        <div class="cart-summary-row" style="font-size:13px;"><span>Pengeluaran Shift Ini</span><span class="text-danger">- ${formatRupiah(kas.totalPengeluaran)}</span></div>
        <div class="cart-summary-row total"><span>Kas Saat Ini</span><span>${formatRupiah(kas.kasSaatIni)}</span></div>
        <div class="text-muted mt-8" style="font-size:11px;">Kas Saat Ini = Modal Awal + Omzet Tunai − Pengeluaran</div>
      </div>
    `;
  } catch (err) {
    console.error(err);
    box.innerHTML = `<p class="text-danger">Gagal memuat data shift.</p>`;
  }
}
