/**
 * produk.js - CRUD Master Produk
 */
let allProducts = [];

requireAuth(async () => {
  if (!isAdmin()) {
    document.getElementById("btnTambah").style.display = "none";
  }
  bindEvents();
  await loadProducts();
});

function bindEvents() {
  document.getElementById("btnTambah").addEventListener("click", () => openModal());
  document.getElementById("btnBatal").addEventListener("click", closeModal);
  document.getElementById("produkModal").addEventListener("click", (e) => {
    if (e.target.id === "produkModal") closeModal();
  });
  document.getElementById("produkForm").addEventListener("submit", saveProduk);
  document.getElementById("searchInput").addEventListener("input", (e) => {
    renderTable(e.target.value);
  });
}

async function loadProducts() {
  try {
    const snap = await db.collection(COLLECTIONS.PRODUCTS).orderBy("name").get();
    allProducts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderTable();
  } catch (err) {
    console.error(err);
    showToast("Gagal memuat produk.", "error");
  }
}

function renderTable(filterText = "") {
  const tbody = document.getElementById("produkTableBody");
  const empty = document.getElementById("emptyState");
  const filtered = allProducts.filter((p) =>
    p.name.toLowerCase().includes(filterText.toLowerCase())
  );

  if (filtered.length === 0) {
    tbody.innerHTML = "";
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  tbody.innerHTML = filtered
    .map(
      (p) => `
    <tr>
      <td class="font-bold">${escapeHtml(p.name)}</td>
      <td class="text-right">${formatRupiah(p.sellPrice)}</td>
      <td class="text-right">${formatRupiah(p.hpp)}</td>
      <td class="text-center">
        <span class="badge" style="background:${p.active ? "var(--success-light)" : "var(--gray-100)"};color:${p.active ? "var(--success)" : "var(--gray-500)"}">
          ${p.active ? "Aktif" : "Tidak Aktif"}
        </span>
      </td>
      <td class="text-right">
        ${isAdmin() ? `
        <button class="btn btn-sm" onclick="editProduk('${p.id}')">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="hapusProduk('${p.id}')">Hapus</button>
        ` : `<span class="text-muted" style="font-size:12px;">Khusus admin</span>`}
      </td>
    </tr>`
    )
    .join("");
}

function openModal(product = null) {
  document.getElementById("modalTitle").textContent = product ? "Edit Produk" : "Tambah Produk";
  document.getElementById("produkId").value = product?.id || "";
  document.getElementById("namaItem").value = product?.name || "";
  document.getElementById("hargaJual").value = product?.sellPrice ?? "";
  document.getElementById("hpp").value = product?.hpp ?? "";
  document.getElementById("statusAktif").value = product ? String(!!product.active) : "true";
  document.getElementById("produkModal").classList.add("show");
}

function closeModal() {
  document.getElementById("produkModal").classList.remove("show");
  document.getElementById("produkForm").reset();
}

function editProduk(id) {
  const product = allProducts.find((p) => p.id === id);
  if (product) openModal(product);
}

async function hapusProduk(id) {
  const product = allProducts.find((p) => p.id === id);
  if (!confirm(`Hapus produk "${product?.name}"? Tindakan ini tidak bisa dibatalkan.`)) return;
  try {
    await db.collection(COLLECTIONS.PRODUCTS).doc(id).delete();
    showToast("Produk berhasil dihapus.", "success");
    await loadProducts();
  } catch (err) {
    console.error(err);
    showToast("Gagal menghapus produk.", "error");
  }
}

async function saveProduk(e) {
  e.preventDefault();
  const btn = document.getElementById("btnSimpanProduk");
  const id = document.getElementById("produkId").value;
  const payload = {
    name: document.getElementById("namaItem").value.trim(),
    sellPrice: Number(document.getElementById("hargaJual").value),
    hpp: Number(document.getElementById("hpp").value),
    active: document.getElementById("statusAktif").value === "true",
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  if (!payload.name) {
    showToast("Nama item wajib diisi.", "error");
    return;
  }

  setLoading(btn, true, "Menyimpan...");
  try {
    if (id) {
      await db.collection(COLLECTIONS.PRODUCTS).doc(id).update(payload);
      showToast("Produk berhasil diperbarui.", "success");
    } else {
      payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection(COLLECTIONS.PRODUCTS).add(payload);
      showToast("Produk berhasil ditambahkan.", "success");
    }
    closeModal();
    await loadProducts();
  } catch (err) {
    console.error(err);
    showToast("Gagal menyimpan produk.", "error");
  } finally {
    setLoading(btn, false);
  }
}
