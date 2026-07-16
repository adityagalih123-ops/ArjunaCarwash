/**
 * pengeluaran.js - Modul Belanja / Pengeluaran
 */
let currentExpenseList = [];

requireAuth(async () => {
  const today = todayKey();
  document.getElementById("filterFrom").value = today;
  document.getElementById("filterTo").value = today;

  bindEvents();
  await loadExpenses();
});

function bindEvents() {
  document.getElementById("btnTambah").addEventListener("click", () => openModal());
  document.getElementById("btnBatal").addEventListener("click", closeModal);
  document.getElementById("expenseModal").addEventListener("click", (e) => {
    if (e.target.id === "expenseModal") closeModal();
  });
  document.getElementById("expenseForm").addEventListener("submit", saveExpense);
  document.getElementById("btnFilter").addEventListener("click", loadExpenses);
  document.getElementById("btnExportCsv").addEventListener("click", exportCsv);

  document.getElementById("satuanBeli").addEventListener("change", (e) => {
    document.getElementById("satuanLainnyaGroup").style.display =
      e.target.value === "lainnya" ? "block" : "none";
  });

  document.getElementById("qtyBeli").addEventListener("input", updateHargaTotalPreview);
  document.getElementById("hargaSatuanBeli").addEventListener("input", updateHargaTotalPreview);
}

function updateHargaTotalPreview() {
  const qty = Number(document.getElementById("qtyBeli").value) || 0;
  const harga = Number(document.getElementById("hargaSatuanBeli").value) || 0;
  document.getElementById("hargaTotalPreview").value = formatRupiah(qty * harga);
}

async function loadExpenses() {
  const fromStr = document.getElementById("filterFrom").value;
  const toStr = document.getElementById("filterTo").value;
  if (!fromStr || !toStr) {
    showToast("Pilih rentang tanggal terlebih dahulu.", "error");
    return;
  }

  const start = firebase.firestore.Timestamp.fromDate(startOfDay(new Date(fromStr)));
  const end = firebase.firestore.Timestamp.fromDate(endOfDay(new Date(toStr)));

  const tbody = document.getElementById("expenseTableBody");
  tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted">Memuat data...</td></tr>`;

  try {
    const snap = await db
      .collection(COLLECTIONS.EXPENSES)
      .where("date", ">=", start)
      .where("date", "<=", end)
      .get();

    currentExpenseList = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => toDate(b.date) - toDate(a.date));

    renderSummary();
    renderTable();
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger">Gagal memuat data.</td></tr>`;
  }
}

function renderSummary() {
  const total = currentExpenseList.reduce((sum, e) => sum + (e.totalPrice || 0), 0);
  document.getElementById("sJumlah").textContent = currentExpenseList.length;
  document.getElementById("sTotal").textContent = formatRupiah(total);
}

function renderTable() {
  const tbody = document.getElementById("expenseTableBody");
  const empty = document.getElementById("emptyState");

  if (currentExpenseList.length === 0) {
    tbody.innerHTML = "";
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  tbody.innerHTML = currentExpenseList
    .map((e) => {
      const canManage = isAdmin() || e.createdByUid === currentUser.uid;
      return `
      <tr>
        <td>${formatTanggal(toDate(e.date))}</td>
        <td class="font-bold">${escapeHtml(e.itemName)}</td>
        <td class="text-right">${e.qty}</td>
        <td>${escapeHtml(e.unit)}</td>
        <td class="text-right">${formatRupiah(e.unitPrice)}</td>
        <td class="text-right font-bold">${formatRupiah(e.totalPrice)}</td>
        <td>${escapeHtml(e.createdByName || "-")}</td>
        <td class="text-right">
          ${canManage ? `
          <button class="btn btn-sm" onclick="editExpense('${e.id}')">Edit</button>
          <button class="btn btn-sm btn-danger" onclick="hapusExpense('${e.id}')">Hapus</button>
          ` : `<span class="text-muted" style="font-size:12px;">-</span>`}
        </td>
      </tr>`;
    })
    .join("");
}

function openModal(expense = null) {
  document.getElementById("modalTitle").textContent = expense ? "Edit Pengeluaran" : "Catat Pengeluaran";
  document.getElementById("expenseId").value = expense?.id || "";
  document.getElementById("tanggalBeli").value = expense ? todayKey(toDate(expense.date)) : todayKey();
  document.getElementById("namaItemBeli").value = expense?.itemName || "";
  document.getElementById("qtyBeli").value = expense?.qty ?? "";
  document.getElementById("hargaSatuanBeli").value = expense?.unitPrice ?? "";
  document.getElementById("catatanBeli").value = expense?.notes || "";

  const knownUnits = ["pcs", "liter", "kg", "pack", "box", "botol", "galon", "unit"];
  const satuanSelect = document.getElementById("satuanBeli");
  const satuanLainnyaGroup = document.getElementById("satuanLainnyaGroup");
  if (expense && expense.unit && !knownUnits.includes(expense.unit)) {
    satuanSelect.value = "lainnya";
    satuanLainnyaGroup.style.display = "block";
    document.getElementById("satuanLainnya").value = expense.unit;
  } else {
    satuanSelect.value = expense?.unit || "pcs";
    satuanLainnyaGroup.style.display = "none";
    document.getElementById("satuanLainnya").value = "";
  }

  updateHargaTotalPreview();
  document.getElementById("expenseModal").classList.add("show");
}

function closeModal() {
  document.getElementById("expenseModal").classList.remove("show");
  document.getElementById("expenseForm").reset();
  document.getElementById("satuanLainnyaGroup").style.display = "none";
}

function editExpense(id) {
  const expense = currentExpenseList.find((e) => e.id === id);
  if (expense) openModal(expense);
}

async function hapusExpense(id) {
  const expense = currentExpenseList.find((e) => e.id === id);
  if (!confirm(`Hapus catatan pembelian "${expense?.itemName}"? Tindakan ini tidak bisa dibatalkan.`)) return;
  try {
    await db.collection(COLLECTIONS.EXPENSES).doc(id).delete();
    showToast("Catatan pengeluaran berhasil dihapus.", "success");
    await loadExpenses();
  } catch (err) {
    console.error(err);
    showToast("Gagal menghapus catatan.", "error");
  }
}

async function saveExpense(e) {
  e.preventDefault();
  const btn = document.getElementById("btnSimpanExpense");
  const id = document.getElementById("expenseId").value;

  const satuanSelectValue = document.getElementById("satuanBeli").value;
  const unit = satuanSelectValue === "lainnya"
    ? document.getElementById("satuanLainnya").value.trim()
    : satuanSelectValue;

  const tanggalStr = document.getElementById("tanggalBeli").value;
  const qty = Number(document.getElementById("qtyBeli").value);
  const unitPrice = Number(document.getElementById("hargaSatuanBeli").value);

  if (!document.getElementById("namaItemBeli").value.trim()) {
    showToast("Nama item wajib diisi.", "error");
    return;
  }
  if (!unit) {
    showToast("Satuan wajib diisi.", "error");
    return;
  }
  if (!tanggalStr) {
    showToast("Tanggal pembelian wajib diisi.", "error");
    return;
  }

  const payload = {
    date: firebase.firestore.Timestamp.fromDate(startOfDay(new Date(tanggalStr))),
    itemName: document.getElementById("namaItemBeli").value.trim(),
    qty,
    unit,
    unitPrice,
    totalPrice: qty * unitPrice,
    notes: document.getElementById("catatanBeli").value.trim(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  setLoading(btn, true, "Menyimpan...");
  try {
    if (id) {
      await db.collection(COLLECTIONS.EXPENSES).doc(id).update(payload);
      showToast("Pengeluaran berhasil diperbarui.", "success");
    } else {
      payload.createdByUid = currentUser.uid;
      payload.createdByName = currentUser.name;
      payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection(COLLECTIONS.EXPENSES).add(payload);
      showToast("Pengeluaran berhasil dicatat.", "success");
    }
    closeModal();
    await loadExpenses();
  } catch (err) {
    console.error(err);
    showToast("Gagal menyimpan pengeluaran.", "error");
  } finally {
    setLoading(btn, false);
  }
}

function exportCsv() {
  if (currentExpenseList.length === 0) {
    showToast("Tidak ada data untuk diexport.", "error");
    return;
  }
  const header = ["Tanggal", "Nama Item", "Qty", "Satuan", "Harga Satuan", "Harga Total", "Dicatat Oleh", "Catatan"];
  const lines = [header.join(",")];

  currentExpenseList.forEach((e) => {
    const row = [
      formatTanggal(toDate(e.date)),
      `"${(e.itemName || "").replace(/"/g, '""')}"`,
      e.qty,
      `"${(e.unit || "").replace(/"/g, '""')}"`,
      e.unitPrice,
      e.totalPrice,
      `"${(e.createdByName || "").replace(/"/g, '""')}"`,
      `"${(e.notes || "").replace(/"/g, '""')}"`
    ];
    lines.push(row.join(","));
  });

  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `laporan-pengeluaran-${todayKey()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
