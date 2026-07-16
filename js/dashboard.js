/**
 * dashboard.js
 */
requireAuth(async () => {
  document.getElementById("todayLabel").textContent =
    "Ringkasan " + formatTanggal(new Date());

  await Promise.all([loadTodayStats(), loadWeekChart(), loadActiveShift()]);
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
    const produkCount = {};

    snap.forEach((doc) => {
      const trx = doc.data();
      omzet += trx.total || 0;
      (trx.items || []).forEach((it) => {
        totalKendaraan += it.qty || 0;
        produkCount[it.name] = (produkCount[it.name] || 0) + it.qty;
      });
    });

    document.getElementById("statOmzet").textContent = formatRupiah(omzet);
    document.getElementById("statTrx").textContent = snap.size;
    document.getElementById("statKendaraan").textContent = totalKendaraan;

    let terlaris = "-";
    let max = 0;
    Object.entries(produkCount).forEach(([name, qty]) => {
      if (qty > max) { max = qty; terlaris = name; }
    });
    document.getElementById("statTerlaris").textContent =
      terlaris === "-" ? "-" : `${terlaris} (${max}x)`;
  } catch (err) {
    console.error(err);
    showToast("Gagal memuat statistik hari ini.", "error");
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

    const shift = snap.docs[0].data();
    box.innerHTML = `
      <div class="flex-between" style="flex-wrap:wrap; gap:10px;">
        <div>
          <div class="font-bold">${escapeHtml(shift.cashierName)}</div>
          <div class="text-muted" style="font-size:12.5px;">Buka: ${formatJam(toDate(shift.openTime))} &middot; Modal: ${formatRupiah(shift.modalAwal)}</div>
        </div>
        <span class="shift-status open"><span class="dot"></span> Sedang Berjalan</span>
      </div>
    `;
  } catch (err) {
    console.error(err);
    box.innerHTML = `<p class="text-danger">Gagal memuat data shift.</p>`;
  }
}
