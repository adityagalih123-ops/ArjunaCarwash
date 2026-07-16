/**
 * sidebar.js
 * Merender sidebar navigasi + topbar mobile ke dalam <div id="shell"></div>.
 * Halaman aktif ditandai lewat atribut body[data-page].
 */

const MENU_ITEMS = [
  { page: "dashboard", href: "dashboard.html", label: "Dashboard", icon: "grid" },
  { page: "kasir", href: "kasir.html", label: "Kasir", icon: "cart" },
  { page: "shift", href: "shift.html", label: "Shift", icon: "clock" },
  { page: "produk", href: "produk.html", label: "Master Produk", icon: "box" },
  { page: "pengeluaran", href: "pengeluaran.html", label: "Belanja/Pengeluaran", icon: "wallet" },
  { page: "laporan-transaksi", href: "laporan-transaksi.html", label: "Laporan Transaksi", icon: "list" },
  { page: "laporan-item", href: "laporan-item.html", label: "Laporan Item Terjual", icon: "chart" }
];

const ICONS = {
  grid: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  cart: '<svg viewBox="0 0 24 24"><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3h2.4l2.1 11.3a2 2 0 0 0 2 1.7h8.2a2 2 0 0 0 2-1.6L21 8H6.2" fill="none" stroke-width="1.8"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="none" stroke-width="1.8"/><path d="M12 7.5V12l3 2" fill="none" stroke-width="1.8" stroke-linecap="round"/></svg>',
  box: '<svg viewBox="0 0 24 24"><path d="M3.5 7.5 12 3l8.5 4.5V17L12 21.5 3.5 17Z" fill="none" stroke-width="1.8" stroke-linejoin="round"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9.5" fill="none" stroke-width="1.8"/></svg>',
  list: '<svg viewBox="0 0 24 24"><path d="M8 6h12M8 12h12M8 18h12" stroke-width="1.8" stroke-linecap="round"/><circle cx="4" cy="6" r="1.3"/><circle cx="4" cy="12" r="1.3"/><circle cx="4" cy="18" r="1.3"/></svg>',
  chart: '<svg viewBox="0 0 24 24"><path d="M4 20V10M11 20V4M18 20v-7" stroke-width="2" stroke-linecap="round"/></svg>',
  wallet: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="2.2" fill="none" stroke-width="1.8"/><path d="M3 9.5h18" stroke-width="1.8"/><circle cx="16.5" cy="14" r="1.3"/></svg>',
  logout: '<svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" fill="none" stroke-width="1.8" stroke-linecap="round"/><path d="M16 17l5-5-5-5M21 12H9" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  menu: '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16" stroke-width="2" stroke-linecap="round"/></svg>'
};

function renderShell() {
  const mount = document.getElementById("shell");
  if (!mount) return;
  const activePage = document.body.dataset.page || "";

  const navHtml = MENU_ITEMS.map((item) => `
    <a class="nav-link ${item.page === activePage ? "active" : ""}" href="${item.href}">
      <span class="nav-icon">${ICONS[item.icon]}</span>
      <span>${item.label}</span>
    </a>
  `).join("");

  mount.innerHTML = `
    <header class="topbar">
      <button id="btnToggleSidebar" class="icon-btn" aria-label="Menu">${ICONS.menu}</button>
      <div class="topbar-brand">
        <img src="assets/logo.png" alt="Logo" class="topbar-logo" />
        <span>Cucian Mobil POS</span>
      </div>
      <div class="topbar-user">
        <span class="user-name">${escapeHtml(currentUser?.name || "")}</span>
        <span class="badge badge-role">${currentUser?.role === "admin" ? "Admin" : "Kasir"}</span>
      </div>
    </header>

    <aside class="sidebar" id="sidebar">
      <div class="sidebar-brand">
        <img src="assets/logo.png" alt="Logo" />
        <div>
          <strong>Cucian Mobil</strong>
          <small>Point of Sale</small>
        </div>
      </div>
      <nav class="sidebar-nav">${navHtml}</nav>
      <button id="btnLogout" class="nav-link nav-logout">
        <span class="nav-icon">${ICONS.logout}</span>
        <span>Keluar</span>
      </button>
    </aside>
    <div class="sidebar-overlay" id="sidebarOverlay"></div>
  `;

  document.getElementById("btnToggleSidebar").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("open");
    document.getElementById("sidebarOverlay").classList.toggle("show");
  });
  document.getElementById("sidebarOverlay").addEventListener("click", () => {
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("sidebarOverlay").classList.remove("show");
  });
  document.getElementById("btnLogout").addEventListener("click", () => {
    if (confirm("Yakin ingin keluar?")) logoutUser();
  });
}
