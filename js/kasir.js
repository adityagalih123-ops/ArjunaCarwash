/**
 * kasir.js - Transaksi Kasir
 */
let products = [];
let cart = []; // { productId, name, price, hpp, qty }
let activeShift = null;

requireAuth(async () => {
  bindEvents();
  await Promise.all([loadProducts(), loadActiveShift()]);
});

function bindEvents() {
  document.getElementById("searchProduk").addEventListener("input", (e) => renderProductGrid(e.target.value));
  document.getElementById("btnClearCart").addEventListener("click", () => {
    if (cart.length && !confirm("Kosongkan keranjang?")) return;
    cart = [];
    renderCart();
  });
  document.getElementById("btnBayar").addEventListener("click", prosesTransaksi);
}

async function loadProducts() {
  try {
    const snap = await db.collection(COLLECTIONS.PRODUCTS).where("active", "==", true).orderBy("name").get();
    products = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderProductGrid();
  } catch (err) {
    console.error(err);
    showToast("Gagal memuat produk.", "error");
  }
}

async function loadActiveShift() {
  const label = document.getElementById("shiftInfoLabel");
  try {
    const snap = await db.collection(COLLECTIONS.SHIFTS).where("status", "==", "open").limit(1).get();
    if (snap.empty) {
      document.getElementById("noShiftWarning").style.display = "block";
      document.getElementById("kasirArea").style.display = "none";
      label.textContent = "Tidak ada shift aktif";
      return;
    }
    activeShift = { id: snap.docs[0].id, ...snap.docs[0].data() };
    document.getElementById("noShiftWarning").style.display = "none";
    document.getElementById("kasirArea").style.display = "grid";
    label.textContent = `Shift: ${activeShift.cashierName} · dibuka ${formatJam(toDate(activeShift.openTime))}`;
  } catch (err) {
    console.error(err);
    label.textContent = "Gagal memuat status shift.";
  }
}

function renderProductGrid(filterText = "") {
  const grid = document.getElementById("productGrid");
  const filtered = products.filter((p) => p.name.toLowerCase().includes(filterText.toLowerCase()));

  if (filtered.length === 0) {
    grid.innerHTML = `<p class="text-muted" style="grid-column:1/-1;">Produk tidak ditemukan.</p>`;
    return;
  }

  grid.innerHTML = filtered
    .map(
      (p) => `
    <button type="button" class="product-pick" onclick="addToCart('${p.id}')">
      <div class="pp-name">${escapeHtml(p.name)}</div>
      <div class="pp-price">${formatRupiah(p.sellPrice)}</div>
    </button>`
    )
    .join("");
}

function addToCart(productId) {
  const product = products.find((p) => p.id === productId);
  if (!product) return;
  const existing = cart.find((c) => c.productId === productId);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      productId: product.id,
      name: product.name,
      price: product.sellPrice,
      hpp: product.hpp,
      qty: 1
    });
  }
  renderCart();
}

function changeQty(productId, delta) {
  const item = cart.find((c) => c.productId === productId);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    cart = cart.filter((c) => c.productId !== productId);
  }
  renderCart();
}

function setQty(productId, value) {
  const item = cart.find((c) => c.productId === productId);
  if (!item) return;
  const qty = Math.max(1, Number(value) || 1);
  item.qty = qty;
  renderCart();
}

function setHargaManual(productId, value) {
  const item = cart.find((c) => c.productId === productId);
  if (!item) return;
  item.price = Math.max(0, Number(value) || 0);
  renderCart();
}

function removeFromCart(productId) {
  cart = cart.filter((c) => c.productId !== productId);
  renderCart();
}

function renderCart() {
  const list = document.getElementById("cartList");
  const empty = document.getElementById("cartEmpty");
  const btnBayar = document.getElementById("btnBayar");

  if (cart.length === 0) {
    list.innerHTML = "";
    empty.style.display = "block";
    btnBayar.disabled = true;
  } else {
    empty.style.display = "none";
    btnBayar.disabled = false;
    list.innerHTML = cart
      .map((item) => {
        const priceField = currentUser.canEditPrice
          ? `<input type="number" min="0" step="500" value="${item.price}" style="width:90px;padding:5px 6px;font-size:12px;"
              onchange="setHargaManual('${item.productId}', this.value)" />`
          : `<span class="ci-price">${formatRupiah(item.price)}</span>`;

        return `
        <div class="cart-item">
          <div style="flex:1;">
            <div class="ci-name">${escapeHtml(item.name)}</div>
            ${priceField}
          </div>
          <div class="qty-control">
            <button type="button" onclick="changeQty('${item.productId}', -1)">-</button>
            <input type="number" min="1" value="${item.qty}" onchange="setQty('${item.productId}', this.value)" />
            <button type="button" onclick="changeQty('${item.productId}', 1)">+</button>
          </div>
          <div style="width:78px; text-align:right; font-weight:700; font-size:13px;">
            ${formatRupiah(item.price * item.qty)}
          </div>
          <button type="button" class="icon-btn" onclick="removeFromCart('${item.productId}')" title="Hapus">
            <svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m-8 0 1 13a2 2 0 0 0 2 1.9h4a2 2 0 0 0 2-1.9l1-13" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>`;
      })
      .join("");
  }

  const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  document.getElementById("sumSubtotal").textContent = formatRupiah(subtotal);
  document.getElementById("sumTotal").textContent = formatRupiah(subtotal);
}

async function prosesTransaksi() {
  if (cart.length === 0) return;
  if (!activeShift) {
    showToast("Tidak ada shift aktif.", "error");
    return;
  }

  const btn = document.getElementById("btnBayar");
  setLoading(btn, true, "Menyimpan...");

  try {
    const trxNo = await generateNomorTransaksi();
    const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
    const totalHpp = cart.reduce((sum, i) => sum + i.hpp * i.qty, 0);
    const now = new Date();

    const trxData = {
      trxNo,
      shiftId: activeShift.id,
      cashierUid: currentUser.uid,
      cashierName: currentUser.name,
      items: cart.map((i) => ({
        productId: i.productId,
        name: i.name,
        qty: i.qty,
        price: i.price,
        hpp: i.hpp,
        subtotal: i.price * i.qty
      })),
      total,
      totalHpp,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    await db.collection(COLLECTIONS.TRANSACTIONS).add(trxData);

    cetakStruk({ ...trxData, createdAt: now });
    showToast(`Transaksi ${trxNo} berhasil disimpan.`, "success");
    cart = [];
    renderCart();
  } catch (err) {
    console.error(err);
    showToast("Gagal menyimpan transaksi.", "error");
  } finally {
    setLoading(btn, false);
  }
}

async function cetakStruk(trx) {
  let companyName = "Cucian Mobil POS";
  let address = "";
  try {
    const doc = await db.collection(COLLECTIONS.SETTINGS).doc(SETTINGS_DOC_ID).get();
    if (doc.exists) {
      companyName = doc.data().companyName || companyName;
      address = doc.data().address || "";
    }
  } catch (e) { /* pakai default jika gagal */ }

  document.getElementById("rCompanyName").textContent = companyName;
  document.getElementById("rAddress").textContent = address;
  document.getElementById("rTrxNo").textContent = trx.trxNo;
  document.getElementById("rTanggal").textContent = `${formatTanggal(trx.createdAt)} ${formatJam(trx.createdAt)}`;
  document.getElementById("rKasir").textContent = trx.cashierName;

  const itemsHtml = trx.items
    .map(
      (i) => `
    <tr>
      <td colspan="2">${escapeHtml(i.name)}</td>
    </tr>
    <tr>
      <td>${i.qty} x ${formatRupiah(i.price)}</td>
      <td class="text-right">${formatRupiah(i.subtotal)}</td>
    </tr>`
    )
    .join("");
  document.getElementById("rItemsTable").innerHTML = itemsHtml;
  document.getElementById("rTotal").textContent = formatRupiah(trx.total);

  document.getElementById("receiptArea").classList.add("show");
  setTimeout(() => {
    window.print();
    document.getElementById("receiptArea").classList.remove("show");
  }, 150);
}
