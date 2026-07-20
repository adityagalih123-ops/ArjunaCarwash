/**
 * laporan-transaksi.js
 */
let currentTrxList = [];
let shiftLabelCache = {};
let activeProductsForEdit = [];
let editingTrx = null;
let editItems = [];

requireAuth(async () => {
  const today = todayKey();
  document.getElementById("filterFrom").value = today;
  document.getElementById("filterTo").value = today;

  document.getElementById("btnFilter").addEventListener("click", loadLaporan);
  document.getElementById("btnExportCsv").addEventListener("click", exportCsv);

  document.getElementById("btnBatalEdit").addEventListener("click", closeEditModal);
  document.getElementById("editTrxModal").addEventListener("click", (e) => {
    if (e.target.id === "editTrxModal") closeEditModal();
  });
  document.getElementById("btnEditAddItem").addEventListener("click", addItemToEdit);
  document.getElementById("editDiscountType").addEventListener("change", recalcEditTotals);
  document.getElementById("editDiscountValue").addEventListener("input", recalcEditTotals);
  document.getElementById("btnSimpanEdit").addEventListener("click", saveEditTransaction);

  await Promise.all([loadLaporan(), isAdmin() ? loadProductsForEdit() : Promise.resolve()]);
});

async function loadProductsForEdit() {
  try {
    const snap = await db.collection(COLLECTIONS.PRODUCTS).where("active", "==", true).get();
    activeProductsForEdit = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => a.name.localeCompare(b.name));
    document.getElementById("editAddProductSelect").innerHTML = activeProductsForEdit
      .map((p) => `<option value="${p.id}">${escapeHtml(p.name)} (${formatRupiah(p.sellPrice)})</option>`)
      .join("");
  } catch (err) {
    console.error(err);
  }
}

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
  tbody.innerHTML = `<tr><td colspan="12" class="text-center text-muted">Memuat data...</td></tr>`;

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
    tbody.innerHTML = `<tr><td colspan="12" class="text-center text-danger">Gagal memuat data. ${err.message.includes("index") ? "Buat Firestore index sesuai instruksi di console." : ""}</td></tr>`;
  }
}

function renderSummary() {
  let omzet = 0, hpp = 0, diskon = 0;
  currentTrxList.forEach((t) => {
    omzet += t.total || 0;
    hpp += t.totalHpp || 0;
    diskon += t.discountAmount || 0;
  });
  document.getElementById("sJumlah").textContent = currentTrxList.length;
  document.getElementById("sOmzet").textContent = formatRupiah(omzet);
  document.getElementById("sHpp").textContent = formatRupiah(hpp);
  document.getElementById("sDiskon").textContent = formatRupiah(diskon);
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
      const diskonLabel = t.discountAmount > 0
        ? `${formatRupiah(t.discountAmount)}${t.discountReason ? ` (${escapeHtml(t.discountReason)})` : ""}`
        : "-";
      return `
      <tr>
        <td class="font-bold">${escapeHtml(t.trxNo)}</td>
        <td>${formatTanggal(d)}</td>
        <td>${formatJam(d)}</td>
        <td>${escapeHtml(shiftLabel)}</td>
        <td>${escapeHtml(t.cashierName)}</td>
        <td>${escapeHtml(t.paymentMethod || "-")}</td>
        <td class="text-right">${formatRupiah(t.subtotal ?? t.total)}</td>
        <td class="text-right ${t.discountAmount > 0 ? "text-danger" : "text-muted"}">${diskonLabel}</td>
        <td class="text-right">${formatRupiah(t.total)}</td>
        <td class="text-right">${formatRupiah(t.totalHpp)}</td>
        <td class="text-right text-success">${formatRupiah(laba)}</td>
        <td class="text-right">
          ${isAdmin()
            ? `<button class="btn btn-sm" onclick="openEditModal('${t.id}')">Edit</button>`
            : `<span class="text-muted" style="font-size:12px;">-</span>`}
        </td>
      </tr>`;
    })
  );
  tbody.innerHTML = rows.join("");
}

// ========================================================================
// EDIT TRANSAKSI (khusus Admin)
// ========================================================================

function openEditModal(trxId) {
  if (!isAdmin()) return;
  const trx = currentTrxList.find((t) => t.id === trxId);
  if (!trx) return;

  editingTrx = trx;
  editItems = (trx.items || []).map((i) => ({ ...i })); // salinan, tidak mengubah data asli sebelum disimpan

  document.getElementById("editTrxNoLabel").textContent = `(${trx.trxNo})`;
  document.getElementById("editInfoTanggal").textContent =
    `${formatTanggal(toDate(trx.createdAt))} ${formatJam(toDate(trx.createdAt))}`;
  document.getElementById("editInfoKasir").textContent = trx.cashierName || "-";
  document.getElementById("editInfoShift").textContent = trx.shiftId ? "Memuat..." : "Tidak ada";

  document.getElementById("editDiscountType").value = trx.discountType || "percent";
  document.getElementById("editDiscountValue").value = trx.discountAmount > 0 ? (trx.discountValue || 0) : 0;
  document.getElementById("editDiscountReason").value = trx.discountReason || "";
  document.getElementById("editPaymentMethod").value = trx.paymentMethod || "Tunai";

  document.getElementById("editShiftWarning").style.display = "none";
  if (trx.shiftId) {
    db.collection(COLLECTIONS.SHIFTS).doc(trx.shiftId).get().then((doc) => {
      if (doc.exists) {
        const s = doc.data();
        document.getElementById("editInfoShift").textContent =
          `${s.cashierName} (${s.status === "open" ? "Aktif" : "Sudah Ditutup"})`;
        if (s.status === "closed") {
          document.getElementById("editShiftWarning").style.display = "block";
        }
      }
    });
  }

  renderEditItems();
  recalcEditTotals();
  document.getElementById("editTrxModal").classList.add("show");
}

function closeEditModal() {
  document.getElementById("editTrxModal").classList.remove("show");
  editingTrx = null;
  editItems = [];
}

function renderEditItems() {
  const box = document.getElementById("editItemList");
  if (editItems.length === 0) {
    box.innerHTML = `<p class="text-muted" style="font-size:13px;">Belum ada item. Tambahkan minimal 1 item.</p>`;
    return;
  }
  box.innerHTML = editItems
    .map(
      (item, idx) => `
    <div class="cart-item">
      <div style="flex:1;">
        <div class="ci-name">${escapeHtml(item.name)}</div>
        <input type="number" min="0" step="500" value="${item.price}" style="width:100px;padding:5px 6px;font-size:12px;margin-top:4px;"
          onchange="updateEditItemPrice(${idx}, this.value)" />
      </div>
      <div class="qty-control">
        <button type="button" onclick="updateEditItemQty(${idx}, -1)">-</button>
        <input type="number" min="1" value="${item.qty}" onchange="setEditItemQty(${idx}, this.value)" />
        <button type="button" onclick="updateEditItemQty(${idx}, 1)">+</button>
      </div>
      <div style="width:88px; text-align:right; font-weight:700; font-size:13px;">
        ${formatRupiah(item.price * item.qty)}
      </div>
      <button type="button" class="icon-btn" onclick="removeEditItem(${idx})" title="Hapus">
        <svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m-8 0 1 13a2 2 0 0 0 2 1.9h4a2 2 0 0 0 2-1.9l1-13" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    </div>`
    )
    .join("");
}

function updateEditItemQty(idx, delta) {
  editItems[idx].qty += delta;
  if (editItems[idx].qty <= 0) editItems.splice(idx, 1);
  renderEditItems();
  recalcEditTotals();
}

function setEditItemQty(idx, value) {
  editItems[idx].qty = Math.max(1, Number(value) || 1);
  renderEditItems();
  recalcEditTotals();
}

function updateEditItemPrice(idx, value) {
  editItems[idx].price = Math.max(0, Number(value) || 0);
  recalcEditTotals();
}

function removeEditItem(idx) {
  editItems.splice(idx, 1);
  renderEditItems();
  recalcEditTotals();
}

function addItemToEdit() {
  const select = document.getElementById("editAddProductSelect");
  const productId = select.value;
  const product = activeProductsForEdit.find((p) => p.id === productId);
  if (!product) {
    showToast("Pilih produk terlebih dahulu.", "error");
    return;
  }
  const existing = editItems.find((i) => i.productId === productId);
  if (existing) {
    existing.qty += 1;
  } else {
    editItems.push({
      productId: product.id,
      name: product.name,
      qty: 1,
      price: product.sellPrice,
      hpp: product.hpp
    });
  }
  renderEditItems();
  recalcEditTotals();
}

function calcEditTotals() {
  const subtotal = editItems.reduce((sum, i) => sum + i.price * i.qty, 0);
  const totalHpp = editItems.reduce((sum, i) => sum + (i.hpp || 0) * i.qty, 0);
  const type = document.getElementById("editDiscountType").value;
  const rawValue = Number(document.getElementById("editDiscountValue").value) || 0;
  let discountAmount = rawValue > 0 ? (type === "percent" ? subtotal * (rawValue / 100) : rawValue) : 0;
  discountAmount = Math.max(0, Math.min(discountAmount, subtotal));
  const total = subtotal - discountAmount;
  return { subtotal, totalHpp, type, value: rawValue, discountAmount, total };
}

function recalcEditTotals() {
  const { subtotal, totalHpp, discountAmount, total } = calcEditTotals();
  document.getElementById("editSumSubtotal").textContent = formatRupiah(subtotal);
  document.getElementById("editSumDiscount").textContent = "- " + formatRupiah(discountAmount);
  document.getElementById("editSumHpp").textContent = formatRupiah(totalHpp);
  document.getElementById("editSumTotal").textContent = formatRupiah(total);
}

async function saveEditTransaction() {
  if (!editingTrx) return;
  if (editItems.length === 0) {
    showToast("Transaksi harus punya minimal 1 item.", "error");
    return;
  }

  const { subtotal, totalHpp, type, value, discountAmount, total } = calcEditTotals();
  const reason = document.getElementById("editDiscountReason").value.trim();
  if (discountAmount > 0 && !reason) {
    showToast("Alasan diskon wajib diisi jika ada diskon.", "error");
    return;
  }
  const paymentMethod = document.getElementById("editPaymentMethod").value;

  const btn = document.getElementById("btnSimpanEdit");
  setLoading(btn, true, "Menyimpan...");

  try {
    const updatedData = {
      items: editItems.map((i) => ({
        productId: i.productId || null,
        name: i.name,
        qty: i.qty,
        price: i.price,
        hpp: i.hpp || 0,
        subtotal: i.price * i.qty
      })),
      subtotal,
      discountType: discountAmount > 0 ? type : null,
      discountValue: discountAmount > 0 ? value : 0,
      discountAmount,
      discountReason: discountAmount > 0 ? reason : "",
      paymentMethod,
      total,
      totalHpp,
      lastEditedAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastEditedBy: currentUser.name,
      editCount: firebase.firestore.FieldValue.increment(1)
    };

    await db.collection(COLLECTIONS.TRANSACTIONS).doc(editingTrx.id).update(updatedData);

    // Jika transaksi ini terhubung ke shift yang SUDAH DITUTUP, hitung ulang
    // snapshot kas shift tersebut supaya tetap konsisten dengan nilai transaksi terbaru.
    let kasInfo = "";
    if (editingTrx.shiftId) {
      const shiftDoc = await db.collection(COLLECTIONS.SHIFTS).doc(editingTrx.shiftId).get();
      if (shiftDoc.exists) {
        const shift = shiftDoc.data();
        if (shift.status === "closed") {
          const kas = await hitungKasShift(editingTrx.shiftId, shift.modalAwal);
          const kasFisik = shift.kasFisik || 0;
          const selisihKas = kasFisik - kas.kasSaatIni;
          await db.collection(COLLECTIONS.SHIFTS).doc(editingTrx.shiftId).update({
            totalTransaksi: kas.totalTransaksi,
            omzet: kas.omzetSemua,
            tunaiMasuk: kas.tunaiMasuk,
            totalPengeluaran: kas.totalPengeluaran,
            kasSeharusnya: kas.kasSaatIni,
            selisihKas
          });
          kasInfo = " Kas shift terkait sudah dihitung ulang.";
        }
      }
    }

    showToast(`Transaksi ${editingTrx.trxNo} berhasil diperbarui.${kasInfo}`, "success");
    closeEditModal();
    await loadLaporan();
  } catch (err) {
    console.error(err);
    showToast("Gagal menyimpan perubahan transaksi.", "error");
  } finally {
    setLoading(btn, false);
  }
}

async function exportCsv() {
  if (currentTrxList.length === 0) {
    showToast("Tidak ada data untuk diexport.", "error");
    return;
  }
  const header = ["No Transaksi", "Tanggal", "Jam", "Shift", "Kasir", "Metode Pembayaran", "Subtotal", "Diskon", "Alasan Diskon", "Total", "HPP", "Laba Kotor"];
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
      `"${(t.paymentMethod || "").replace(/"/g, '""')}"`,
      t.subtotal ?? t.total,
      t.discountAmount || 0,
      `"${(t.discountReason || "").replace(/"/g, '""')}"`,
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
