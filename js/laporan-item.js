/**
 * laporan-item.js
 */
let itemAggList = [];

requireAuth(async () => {
  const today = todayKey();
  document.getElementById("filterFrom").value = today;
  document.getElementById("filterTo").value = today;

  document.getElementById("btnFilter").addEventListener("click", loadLaporan);
  document.getElementById("sortBy").addEventListener("change", () => {
    sortAndRender();
  });
  document.getElementById("btnExportCsv").addEventListener("click", exportCsv);

  await loadLaporan();
});

async function loadLaporan() {
  const fromStr = document.getElementById("filterFrom").value;
  const toStr = document.getElementById("filterTo").value;
  if (!fromStr || !toStr) {
    showToast("Pilih rentang tanggal terlebih dahulu.", "error");
    return;
  }

  const start = firebase.firestore.Timestamp.fromDate(startOfDay(new Date(fromStr)));
  const end = firebase.firestore.Timestamp.fromDate(endOfDay(new Date(toStr)));

  const tbody = document.getElementById("itemTableBody");
  tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Memuat data...</td></tr>`;

  try {
    const snap = await db
      .collection(COLLECTIONS.TRANSACTIONS)
      .where("createdAt", ">=", start)
      .where("createdAt", "<=", end)
      .get();

    const map = {};
    snap.forEach((doc) => {
      const trx = doc.data();
      (trx.items || []).forEach((it) => {
        const key = it.productId || it.name;
        if (!map[key]) {
          map[key] = { name: it.name, qty: 0, omzet: 0, hpp: 0 };
        }
        map[key].qty += it.qty || 0;
        map[key].omzet += it.subtotal || it.price * it.qty || 0;
        map[key].hpp += (it.hpp || 0) * (it.qty || 0);
      });
    });

    itemAggList = Object.values(map);
    sortAndRender();
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Gagal memuat data.</td></tr>`;
  }
}

function sortAndRender() {
  const sortBy = document.getElementById("sortBy").value;
  const sorted = [...itemAggList].sort((a, b) =>
    sortBy === "omzet" ? b.omzet - a.omzet : b.qty - a.qty
  );
  renderTable(sorted);
}

function renderTable(list) {
  const tbody = document.getElementById("itemTableBody");
  const empty = document.getElementById("itemEmpty");

  if (list.length === 0) {
    tbody.innerHTML = "";
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  tbody.innerHTML = list
    .map((it) => {
      const laba = it.omzet - it.hpp;
      return `
      <tr>
        <td class="font-bold">${escapeHtml(it.name)}</td>
        <td class="text-right">${it.qty}</td>
        <td class="text-right">${formatRupiah(it.omzet)}</td>
        <td class="text-right">${formatRupiah(it.hpp)}</td>
        <td class="text-right text-success">${formatRupiah(laba)}</td>
      </tr>`;
    })
    .join("");
}

function exportCsv() {
  if (itemAggList.length === 0) {
    showToast("Tidak ada data untuk diexport.", "error");
    return;
  }
  const sortBy = document.getElementById("sortBy").value;
  const sorted = [...itemAggList].sort((a, b) =>
    sortBy === "omzet" ? b.omzet - a.omzet : b.qty - a.qty
  );

  const header = ["Nama Item", "Qty Terjual", "Omzet", "Total HPP", "Laba Kotor"];
  const lines = [header.join(",")];
  sorted.forEach((it) => {
    const laba = it.omzet - it.hpp;
    lines.push([`"${it.name.replace(/"/g, '""')}"`, it.qty, it.omzet, it.hpp, laba].join(","));
  });

  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `laporan-item-${todayKey()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
