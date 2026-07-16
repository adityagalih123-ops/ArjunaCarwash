/**
 * laporan-transaksi.js
 */
let currentTrxList = [];
let shiftLabelCache = {};

requireAuth(async () => {
  const today = todayKey();
  document.getElementById("filterFrom").value = today;
  document.getElementById("filterTo").value = today;

  document.getElementById("btnFilter").addEventListener("click", loadLaporan);
  document.getElementById("btnExportCsv").addEventListener("click", exportCsv);

  await loadLaporan();
});

async function getShiftLabel(shiftId) {
  if (!shiftId) return "-";
  if (shiftLabelCache[shiftId]) return shiftLabelCache[shiftId];
  try {
    const doc = await db.collection(COLLECTIONS.SHIFTS).doc(shiftId).get();
    if (doc.exists) {
      const d = doc.data();
      const label = `${formatJam(toDate(d.openTime))} (${d.cashierName})`;
      shiftLabelCache[shiftId] = label;
      return label;
    }
  } catch (e) { /* abaikan */ }
  return "-";
}

async function loadLaporan() {
  const fromStr = document.getElementById("filterFrom").value;
  const toStr = document.getElementById("filterTo").value;
  if (!fromStr || !toStr) {
    showToast("Pilih rentang tanggal terlebih dahulu.", "error");
    return;
  }

  const start = firebase.firestore.Timestamp.fromDate(startOfDay(new Date(fromStr)));
  const end = firebase.firestore.Timestamp.fromDate(endOfDay(new Date(toStr)));

  const tbody = document.getElementById("trxTableBody");
  tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted">Memuat data...</td></tr>`;

  try {
    const snap = await db
      .collection(COLLECTIONS.TRANSACTIONS)
      .where("createdAt", ">=", start)
      .where("createdAt", "<=", end)
      .orderBy("createdAt", "desc")
      .get();

    currentTrxList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderSummary();
    await renderTable();
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger">Gagal memuat data. ${err.message.includes("index") ? "Buat Firestore index sesuai instruksi di console." : ""}</td></tr>`;
  }
}

function renderSummary() {
  let omzet = 0, hpp = 0;
  currentTrxList.forEach((t) => {
    omzet += t.total || 0;
    hpp += t.totalHpp || 0;
  });
  document.getElementById("sJumlah").textContent = currentTrxList.length;
  document.getElementById("sOmzet").textContent = formatRupiah(omzet);
  document.getElementById("sHpp").textContent = formatRupiah(hpp);
  document.getElementById("sLaba").textContent = formatRupiah(omzet - hpp);
}

async function renderTable() {
  const tbody = document.getElementById("trxTableBody");
  const empty = document.getElementById("trxEmpty");

  if (currentTrxList.length === 0) {
    tbody.innerHTML = "";
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  const rows = await Promise.all(
    currentTrxList.map(async (t) => {
      const d = toDate(t.createdAt) || new Date();
      const laba = (t.total || 0) - (t.totalHpp || 0);
      const shiftLabel = await getShiftLabel(t.shiftId);
      return `
      <tr>
        <td class="font-bold">${escapeHtml(t.trxNo)}</td>
        <td>${formatTanggal(d)}</td>
        <td>${formatJam(d)}</td>
        <td>${escapeHtml(shiftLabel)}</td>
        <td>${escapeHtml(t.cashierName)}</td>
        <td class="text-right">${formatRupiah(t.total)}</td>
        <td class="text-right">${formatRupiah(t.totalHpp)}</td>
        <td class="text-right text-success">${formatRupiah(laba)}</td>
      </tr>`;
    })
  );
  tbody.innerHTML = rows.join("");
}

async function exportCsv() {
  if (currentTrxList.length === 0) {
    showToast("Tidak ada data untuk diexport.", "error");
    return;
  }
  const header = ["No Transaksi", "Tanggal", "Jam", "Shift", "Kasir", "Total", "HPP", "Laba Kotor"];
  const lines = [header.join(",")];

  for (const t of currentTrxList) {
    const d = toDate(t.createdAt) || new Date();
    const laba = (t.total || 0) - (t.totalHpp || 0);
    const shiftLabel = await getShiftLabel(t.shiftId);
    const row = [
      t.trxNo,
      formatTanggal(d),
      formatJam(d),
      `"${shiftLabel.replace(/"/g, '""')}"`,
      `"${(t.cashierName || "").replace(/"/g, '""')}"`,
      t.total || 0,
      t.totalHpp || 0,
      laba
    ];
    lines.push(row.join(","));
  }

  downloadCsv(lines.join("\n"), `laporan-transaksi-${todayKey()}.csv`);
}

function downloadCsv(content, filename) {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
