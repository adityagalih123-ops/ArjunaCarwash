/**
 * laporan-keuangan.js
 * Laporan Keuangan: Omset -> Diskon -> Omset Bersih -> Biaya -> Laba Bersih
 * -> dibandingkan dengan pengeluaran aktual -> Margin Owner.
 */

requireAuth(async () => {
  if (!isAdmin()) {
    showToast("Halaman ini khusus admin.", "error");
    window.location.href = "kasir.html";
    return;
  }

  const today = todayKey();
  document.getElementById("filterFrom").value = today;
  document.getElementById("filterTo").value = today;

  document.getElementById("btnFilter").addEventListener("click", loadLaporan);
  document.getElementById("btnDownloadPdf").addEventListener("click", downloadPdf);

  await loadLaporan();
});

async function loadLaporan() {
  const fromStr = document.getElementById("filterFrom").value;
  const toStr = document.getElementById("filterTo").value;
  if (!fromStr || !toStr) {
    showToast("Pilih rentang tanggal terlebih dahulu.", "error");
    return;
  }

  document.getElementById("loadingState").style.display = "block";
  document.getElementById("finContent").style.display = "none";

  const startDate = new Date(fromStr);
  const endDate = new Date(toStr);
  const start = firebase.firestore.Timestamp.fromDate(startOfDay(startDate));
  const end = firebase.firestore.Timestamp.fromDate(endOfDay(endDate));

  try {
    const [trxSnap, expSnap] = await Promise.all([
      db.collection(COLLECTIONS.TRANSACTIONS).where("createdAt", ">=", start).where("createdAt", "<=", end).get(),
      db.collection(COLLECTIONS.EXPENSES).where("date", ">=", start).where("date", "<=", end).get()
    ]);

    // ---------- Dari transaksi ----------
    let omsetTunai = 0;
    let omsetNonTunai = 0;
    let totalDiskon = 0;
    let totalBiayaOperasional = 0;
    let totalBiayaGaji = 0;

    trxSnap.forEach((doc) => {
      const t = doc.data();
      const subtotal = t.subtotal ?? t.total ?? 0; // nominal sebelum diskon
      if ((t.paymentMethod || "Tunai") === "Tunai") {
        omsetTunai += subtotal;
      } else {
        omsetNonTunai += subtotal;
      }
      totalDiskon += t.discountAmount || 0;
      totalBiayaOperasional += t.totalOperationalCost || 0;
      totalBiayaGaji += t.totalLaborCost || 0;
    });

    const totalOmset = omsetTunai + omsetNonTunai;
    const omsetBersih = totalOmset - totalDiskon;
    const labaBersih = omsetBersih - totalBiayaOperasional - totalBiayaGaji;

    // ---------- Dari pengeluaran aktual ----------
    let pengeluaranOperasional = 0;
    let pengeluaranGaji = 0;
    let adaTanpaKategori = false;

    expSnap.forEach((doc) => {
      const e = doc.data();
      const kategori = e.category || "Operasional"; // fallback data lama sebelum field kategori ada
      if (!e.category) adaTanpaKategori = true;
      if (kategori === "Gaji") {
        pengeluaranGaji += e.totalPrice || 0;
      } else {
        pengeluaranOperasional += e.totalPrice || 0;
      }
    });

    const marginOps = totalBiayaOperasional - pengeluaranOperasional;
    const marginGaji = totalBiayaGaji - pengeluaranGaji;
    const marginOwner = labaBersih + marginOps + marginGaji;

    renderLaporan({
      omsetTunai, omsetNonTunai, totalOmset, totalDiskon, omsetBersih,
      totalBiayaOperasional, totalBiayaGaji, labaBersih,
      pengeluaranOperasional, pengeluaranGaji, marginOps, marginGaji, marginOwner,
      adaTanpaKategori
    });

    document.getElementById("printPeriod").textContent =
      fromStr === toStr
        ? `Periode: ${formatTanggal(startDate)}`
        : `Periode: ${formatTanggal(startDate)} — ${formatTanggal(endDate)}`;
  } catch (err) {
    console.error(err);
    showToast("Gagal memuat laporan keuangan.", "error");
  } finally {
    document.getElementById("loadingState").style.display = "none";
    document.getElementById("finContent").style.display = "flex";
  }
}

function renderLaporan(d) {
  document.getElementById("fOmset").textContent = formatRupiah(d.totalOmset);
  document.getElementById("fOmsetTunai").textContent = formatRupiah(d.omsetTunai);
  document.getElementById("fOmsetNonTunai").textContent = formatRupiah(d.omsetNonTunai);

  document.getElementById("fDiskon").textContent = "- " + formatRupiah(d.totalDiskon);
  document.getElementById("fOmsetBersih").textContent = formatRupiah(d.omsetBersih);

  document.getElementById("fBiayaOperasional").textContent = "- " + formatRupiah(d.totalBiayaOperasional);
  document.getElementById("fBiayaGaji").textContent = "- " + formatRupiah(d.totalBiayaGaji);

  document.getElementById("fLabaBersih").textContent = formatRupiah(d.labaBersih);

  // Margin Operasional
  const marginOpsEl = document.getElementById("fMarginOps");
  marginOpsEl.textContent = (d.marginOps >= 0 ? "+ " : "- ") + formatRupiah(Math.abs(d.marginOps));
  marginOpsEl.className = "fin-value " + (d.marginOps >= 0 ? "plus-color" : "minus-color");
  document.getElementById("cardMarginOps").className = "fin-card " + (d.marginOps >= 0 ? "plus" : "minus");
  document.getElementById("fMOpsBudget").textContent = formatRupiah(d.totalBiayaOperasional);
  document.getElementById("fMOpsActual").textContent = formatRupiah(d.pengeluaranOperasional);

  // Margin Gaji
  const marginGajiEl = document.getElementById("fMarginGaji");
  marginGajiEl.textContent = (d.marginGaji >= 0 ? "+ " : "- ") + formatRupiah(Math.abs(d.marginGaji));
  marginGajiEl.className = "fin-value " + (d.marginGaji >= 0 ? "plus-color" : "minus-color");
  document.getElementById("cardMarginGaji").className = "fin-card " + (d.marginGaji >= 0 ? "plus" : "minus");
  document.getElementById("fMGajiBudget").textContent = formatRupiah(d.totalBiayaGaji);
  document.getElementById("fMGajiActual").textContent = formatRupiah(d.pengeluaranGaji);

  // Margin Owner
  document.getElementById("fMarginOwner").textContent = formatRupiah(d.marginOwner);

  const warning = document.getElementById("uncategorizedWarning");
  warning.textContent = d.adaTanpaKategori
    ? "⚠️ Ada catatan pengeluaran lama pada periode ini yang belum dikategorikan (Operasional/Gaji) — sementara dihitung sebagai Operasional. Buka menu Belanja/Pengeluaran untuk melengkapinya agar Margin lebih akurat."
    : "";
}

function downloadPdf() {
  document.getElementById("printHeader").style.display = "block";
  window.print();
  setTimeout(() => {
    document.getElementById("printHeader").style.display = "none";
  }, 500);
}
