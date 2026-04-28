let currentTab = "home";
let appData = {
  status: {},
  profile: {},
  contacts: [],
  documents: [],
  checklist: { first_aid: [], food_water: [], tools: [] },
  medicine: [],
  guides: [],
  alerts: [],
  locationSharing: true,
};


function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  const screen = document.getElementById("screen-" + tab);
  if (screen) {
    screen.classList.add("active");
    window.scrollTo(0, 0);
  }

  document.querySelectorAll(".nav-item, .nav-sos").forEach((n) => n.classList.remove("active"));
  const navBtn = document.getElementById("nav-" + tab);
  if (navBtn) navBtn.classList.add("active");


  if (tab === "home") loadHome();
  if (tab === "kit") loadKit();
  if (tab === "sos") loadSOS();
  if (tab === "guide") loadGuide();
  if (tab === "alerts") loadAlerts();
  if (tab === "profile") loadProfile();
}


async function loadHome() {
  const status = await API.get("/api/status");
  appData.status = status;

  
  const circumference = 2 * Math.PI * 26;
  const offset = circumference - (status.readiness_pct / 100) * circumference;
  document.getElementById("ring-circle").setAttribute("stroke-dashoffset", offset);
  document.getElementById("ring-pct").textContent = status.readiness_pct + "%";

  
  let label = "Belum Siap";
  if (status.readiness_pct >= 90) label = "Siap!";
  else if (status.readiness_pct >= 60) label = "Hampir Siap!";
  document.getElementById("readiness-label").textContent = label;

  const missing = (status.documents.total - status.documents.done) + (status.supplies.total - status.supplies.done);
  document.getElementById("readiness-desc").textContent = missing > 0 ? missing + " item perlu perhatian" : "Semua item lengkap!";

  
  document.getElementById("doc-status-val").textContent = status.documents.done + " / " + status.documents.total + " file";
  const docBadge = document.getElementById("doc-badge");
  if (status.documents.done >= status.documents.total) {
    docBadge.textContent = "Lengkap"; docBadge.className = "badge badge-ok";
  } else {
    docBadge.textContent = "Hampir"; docBadge.className = "badge badge-warn";
  }

  const supDone = status.supplies.done;
  const supTotal = status.supplies.total;
  document.getElementById("sup-status-val").textContent = supDone >= supTotal ? "Lengkap" : supDone + " / " + supTotal;
  const supBadge = document.getElementById("sup-badge");
  if (supDone >= supTotal) {
    supBadge.textContent = "Siap"; supBadge.className = "badge badge-ok";
  } else {
    supBadge.textContent = "Kurang"; supBadge.className = "badge badge-warn";
  }

  document.getElementById("alert-count-val").textContent = status.alerts_count + " notifikasi";
  const alertBadge = document.getElementById("alert-badge");
  if (status.alerts_count > 0) {
    alertBadge.textContent = "Perlu cek"; alertBadge.className = "badge badge-alert";
  } else {
    alertBadge.textContent = "Aman"; alertBadge.className = "badge badge-ok";
  }
}


async function loadKit() {
  const [docs, firstAid, foodWater, tools, medicine] = await Promise.all([
    API.get("/api/documents"),
    API.get("/api/checklist/first_aid"),
    API.get("/api/checklist/food_water"),
    API.get("/api/checklist/tools"),
    API.get("/api/medicine"),
  ]);
  appData.documents = docs;
  appData.checklist.first_aid = firstAid;
  appData.checklist.food_water = foodWater;
  appData.checklist.tools = tools;
  appData.medicine = medicine;

  
  const docDone = docs.filter((d) => d.status === "tersimpan").length;
  document.getElementById("acc-doc-status").textContent = docDone + " dari " + docs.length + " tersimpan";

  renderDocuments(docs);
  renderMedicine(medicine);
  renderChecklist("aid-checklist", firstAid, null);
  renderChecklist("food-checklist", foodWater, "acc-food-status");
  renderChecklist("tools-checklist", tools, "acc-tools-status");
}

function renderDocuments(docs) {
  const icons = ["🪪", "📖", "💳", "📃"];
  const container = document.getElementById("doc-list");
  container.innerHTML = docs
    .map(
      (d, i) => `
    <div class="doc-item">
      <span class="doc-icon">${icons[i] || "📄"}</span>
      <div class="doc-info">
        <div class="doc-name">${d.nama}</div>
        <div class="doc-status ${d.status === "belum" ? "missing" : ""}">
          ${d.status === "tersimpan" ? "Tersimpan · " + formatDate(d.tanggal) : "Belum diunggah"}
        </div>
      </div>
      <span class="doc-action">${d.status === "tersimpan" ? "Lihat" : "+ Tambah"}</span>
    </div>`
    )
    .join("");
}

function renderMedicine(meds) {
  document.getElementById("med-grid").innerHTML = meds
    .map(
      (m) => `
    <div class="med-card">
      <div class="med-symptom">${m.gejala}</div>
      <div class="med-treatment">${m.obat}</div>
    </div>`
    )
    .join("");
}

function renderChecklist(containerId, items, statusId) {
  const container = document.getElementById(containerId);
  if (statusId) {
    const done = items.filter((i) => i.checked).length;
    document.getElementById(statusId).textContent = done + " dari " + items.length + " tersedia";
  }
  container.innerHTML = items
    .map(
      (item) => `
    <div class="checklist-item" onclick="toggleItem(${item.id})">
      <div class="check-box ${item.checked ? "checked" : ""}">
        ${item.checked ? '<span class="check-mark">✓</span>' : ""}
      </div>
      <span class="check-label ${item.checked ? "checked" : ""}">${item.nama}</span>
    </div>`
    )
    .join("");
}

async function toggleItem(id) {
  await API.put("/api/checklist/" + id + "/toggle");
  loadKit();
  loadHome(); // refresh readiness
}


const openAccordions = {};
function toggleAcc(accId) {
  openAccordions[accId] = !openAccordions[accId];
  const body = document.getElementById("body-" + accId);
  const chev = document.getElementById("chev-" + accId);
  const header = document.querySelector(`[data-acc="${accId}"]`);
  body.classList.toggle("open", openAccordions[accId]);
  chev.classList.toggle("open", openAccordions[accId]);
  header.classList.toggle("open", openAccordions[accId]);
}


async function loadSOS() {
  const [contacts, locSetting] = await Promise.all([
    API.get("/api/contacts"),
    API.get("/api/settings/location_sharing"),
  ]);
  appData.contacts = contacts;
  appData.locationSharing = locSetting.value === "true";

  renderContacts(contacts);
  updateLocationToggle();
}

function renderContacts(contacts) {
  const container = document.getElementById("contact-list");
  container.innerHTML =
    contacts
      .map(
        (c) => `
    <div class="contact-item">
      <div class="contact-avatar">${getInitials(c.nama)}</div>
      <div class="contact-info">
        <div class="contact-name">${c.nama}</div>
        <div class="contact-role">${c.label}</div>
      </div>
      <button class="contact-call" onclick="event.stopPropagation()">📞</button>
    </div>`
      )
      .join("") +
    `<div class="contact-add" onclick="addContact()">+ Tambah Kontak</div>`;
}

function updateLocationToggle() {
  const track = document.getElementById("loc-toggle");
  const statusEl = document.getElementById("loc-status");
  if (appData.locationSharing) {
    track.classList.add("on");
    statusEl.textContent = "Aktif — kontak daruratmu dapat melihat lokasi";
  } else {
    track.classList.remove("on");
    statusEl.textContent = "Nonaktif — lokasi tidak dibagikan";
  }
}

async function toggleLocation() {
  appData.locationSharing = !appData.locationSharing;
  await API.put("/api/settings/location_sharing", { value: String(appData.locationSharing) });
  updateLocationToggle();
}

function addContact() {
  const nama = prompt("Nama kontak:");
  if (!nama) return;
  const telepon = prompt("Nomor telepon:");
  if (!telepon) return;
  const label = prompt("Label (contoh: Keluarga, Teman):", "Keluarga");
  API.post("/api/contacts", { nama, telepon, label: label || "Keluarga" }).then(() => loadSOS());
}


async function loadGuide() {
  const guides = await API.get("/api/guides");
  appData.guides = guides;

  const icons = ["🩸", "🔥", "💧", "👤"];
  const subs = ["Cara hentikan darah", "Pertolongan pertama", "Atasi kekurangan cairan", "Langkah penanganan"];
  const grid = document.getElementById("guide-grid");
  grid.innerHTML = guides
    .map(
      (g, i) => `
    <div class="guide-card" onclick="showGuide(${i})">
      <div class="guide-card-icon">${icons[i] || g.icon}</div>
      <div class="guide-card-title">${g.judul}</div>
      <div class="guide-card-sub">${subs[i] || ""}</div>
    </div>`
    )
    .join("");
}

function showGuide(idx) {
  const g = appData.guides[idx];
  if (!g) return;
  const detail = document.getElementById("guide-detail");
  document.getElementById("guide-detail-icon").textContent = g.icon;
  document.getElementById("guide-detail-title").textContent = g.judul;
  document.getElementById("guide-steps").innerHTML = g.langkah
    .map(
      (s, i) => `
    <div class="guide-step">
      <div class="step-num">${i + 1}</div>
      <div class="step-text">${s}</div>
    </div>`
    )
    .join("");
  detail.classList.add("visible");
  detail.scrollIntoView({ behavior: "smooth", block: "nearest" });
}


async function loadAlerts() {
  const alerts = await API.get("/api/alerts");
  appData.alerts = alerts;

  const container = document.getElementById("alerts-list");
  document.getElementById("alerts-count").textContent = alerts.length + " item perlu perhatianmu";

  container.innerHTML = alerts
    .map(
      (a) => `
    <div class="alert-item" onclick="markRead(${a.id})">
      <div class="alert-dot-wrap">
        <div class="alert-dot" style="background:var(--${a.level === "danger" ? "red" : "amber"})"></div>
      </div>
      <div class="alert-content">
        <div class="alert-title2">${a.judul}</div>
        <div class="alert-desc">${a.deskripsi}</div>
        <div class="alert-time">${formatDateTime(a.waktu)}</div>
      </div>
    </div>`
    )
    .join("");
}

async function markRead(id) {
  await API.put("/api/alerts/" + id + "/read");
}


async function loadProfile() {
  const [profile, contacts] = await Promise.all([
    API.get("/api/profile"),
    API.get("/api/contacts"),
  ]);
  appData.profile = profile;

  document.getElementById("profile-initials").textContent = getInitials(profile.nama);
  document.getElementById("profile-name").textContent = profile.nama;
  document.getElementById("profile-email").textContent = profile.email;
  document.getElementById("p-nama").textContent = profile.nama;
  document.getElementById("p-nik").textContent = profile.nik;
  document.getElementById("p-telepon").textContent = profile.telepon;
  document.getElementById("p-alamat").textContent = profile.alamat;
  document.getElementById("p-darah").textContent = profile.golongan_darah;

  const ecList = document.getElementById("profile-ec-list");
  ecList.innerHTML = contacts
    .map(
      (c) => `
    <div class="info-row">
      <span class="info-key">${c.nama}</span>
      <span class="info-val orange">${c.telepon}</span>
    </div>`
    )
    .join("");
}


function getInitials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(dtStr) {
  if (!dtStr) return "";
  const d = new Date(dtStr);
  const now = new Date();
  const diff = Math.floor((now - d) / 86400000);
  const time = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  if (diff === 0) return "Hari ini, " + time;
  if (diff === 1) return "Kemarin, " + time;
  return diff + " hari lalu";
}


document.addEventListener("DOMContentLoaded", () => {
  switchTab("home");
});
