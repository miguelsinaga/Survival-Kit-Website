let appData = { status: {}, profile: {}, contacts: [], alerts: [], guides: [] };
let sosTimer = null;
let sosCountdown = 3;
let sosActive = false;
let kitTab = "checklist"; 
let suppliesSubTab = "first_aid";

function switchTab(tab) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  const screen = document.getElementById("screen-" + tab);
  if (screen) screen.classList.add("active");
  const navBtn = document.getElementById("nav-" + tab);
  if (navBtn) navBtn.classList.add("active");
  window.scrollTo(0, 0);

  if (tab === "home")    loadHome();
  if (tab === "kit")     loadKit();
  if (tab === "sos")     loadSOS();
  if (tab === "guide")   loadGuide();
  if (tab === "alerts")  loadAlerts();
  if (tab === "profile") loadProfile();
}
async function loadHome() {
  const [status, profile] = await Promise.all([
    API.get("/api/status"),
    API.get("/api/profile"),
  ]);
  appData.status = status;
  appData.profile = profile;

  document.getElementById("home-greeting").textContent = "Hello, " + (profile.nama || "Alex");
  document.getElementById("home-pct-text").textContent = status.readiness_pct + "%";

  const fill = document.getElementById("home-progress");
  if (fill) fill.style.width = status.readiness_pct + "%";


  const banner = document.getElementById("home-banner");
  if (status.readiness_pct === 100) {
    banner.style.display = "flex";
  } else {
    banner.style.display = "none";
  }


  const docDone = status.documents.done;
  const docTotal = status.documents.total;
  document.getElementById("home-doc-status").textContent = docDone >= docTotal ? "Up to date" : docDone + " / " + docTotal + " tersimpan";

  const supDone = status.supplies.done;
  const supTotal = status.supplies.total;
  document.getElementById("home-sup-status").textContent = supDone >= supTotal ? "Up to date" : supDone + " / " + supTotal + " ada";

  const ac = status.alerts_count;
  document.getElementById("home-alert-status").textContent = ac > 0 ? ac + " active alert" + (ac > 1 ? "s" : "") : "No active alerts";
}

async function loadKit() {
  renderKitTabs();
}

function renderKitTabs() {
  document.getElementById("tab-checklist").classList.toggle("active", kitTab === "checklist");
  document.getElementById("tab-supplies").classList.toggle("active", kitTab === "supplies");
  document.getElementById("kit-checklist-content").style.display = kitTab === "checklist" ? "block" : "none";
  document.getElementById("kit-supplies-content").style.display = kitTab === "supplies" ? "block" : "none";

  if (kitTab === "checklist") loadChecklist();
  if (kitTab === "supplies")  loadSupplies();
}

function switchKitTab(tab) {
  kitTab = tab;
  renderKitTabs();
}

async function loadChecklist() {
  const [docs, firstAid, foodWater, tools] = await Promise.all([
    API.get("/api/documents"),
    API.get("/api/checklist/first_aid"),
    API.get("/api/checklist/food_water"),
    API.get("/api/checklist/tools"),
  ]);

  const sections = [
    { name: "Documents",     done: docs.filter(d => d.status === "tersimpan").length === docs.length },
    { name: "First Aid",     done: firstAid.every(i => i.checked) },
    { name: "Food & Water",  done: foodWater.every(i => i.checked) },
    { name: "Tools & Others",done: tools.every(i => i.checked) },
  ];

  const container = document.getElementById("checklist-rows");
  container.innerHTML = sections.map(s => `
    <div class="check-row">
      <div class="check-circle ${s.done ? "done" : "pending"}">
        ${s.done ? svgCheckCircle() : ""}
      </div>
      <div class="check-info">
        <h4>${s.name}</h4>
        <p>${s.done ? "Complete" : "Incomplete"}</p>
      </div>
    </div>
  `).join("");
}

async function loadSupplies() {
  const [docs, firstAid, foodWater, tools, medicine] = await Promise.all([
    API.get("/api/documents"),
    API.get("/api/checklist/first_aid"),
    API.get("/api/checklist/food_water"),
    API.get("/api/checklist/tools"),
    API.get("/api/medicine"),
  ]);

  renderDocuments(docs);
  renderFirstAid(firstAid, medicine);
  renderFoodWater(foodWater);
  renderTools(tools);
}

function renderDocuments(docs) {
  const docIcons = [svgFileText(), svgFileText(), svgFileText(), svgFileText(), svgFileText()];
  const container = document.getElementById("acc-body-docs");
  const statusEl  = document.getElementById("acc-docs-status");
  const done = docs.filter(d => d.status === "tersimpan").length;
  statusEl.textContent = done + " dari " + docs.length + " tersimpan";

  container.innerHTML = docs.map(d => `
    <div class="doc-row">
      <div class="doc-row-left">
        <div class="doc-icon-wrap">${svgFileText()}</div>
        <span>${d.nama}</span>
      </div>
      ${d.status === "tersimpan" ? `<span class="check-done">${svgCheckCircle2()}</span>` : `<span style="font-size:12px;color:var(--gray-400)">—</span>`}
    </div>
  `).join("") + `<div style="padding-top:12px;"><button class="btn-primary" onclick="alert('Cloud backup coming soon!')">Backup to Cloud</button></div>`;
}

function renderFirstAid(items, medicine) {
  const container = document.getElementById("acc-body-firstaid");
  const statusEl  = document.getElementById("acc-firstaid-status");
  const done = items.filter(i => i.checked).length;
  statusEl.textContent = done + " dari " + items.length + " item";

  const medHtml = `
    <p class="med-divider">Panduan Obat</p>
    <div class="med-grid">
      ${medicine.map(m => `<div class="med-card"><p class="symptom">${m.gejala}</p><p class="treatment">${m.obat}</p></div>`).join("")}
    </div>
    <p class="med-divider">Checklist Item</p>
  `;

  const checkHtml = items.map(item => `
    <div class="check-row" onclick="toggleItem(${item.id})" style="cursor:pointer;">
      <div class="check-circle ${item.checked ? "done" : "pending"}">
        ${item.checked ? svgCheckCircle() : ""}
      </div>
      <div class="check-info">
        <h4>${item.nama}</h4>
      </div>
    </div>
  `).join("");

  container.innerHTML = medHtml + checkHtml;
}

function renderFoodWater(items) {
  const container = document.getElementById("acc-body-food");
  const statusEl  = document.getElementById("acc-food-status");
  const done = items.filter(i => i.checked).length;
  statusEl.textContent = done + " dari " + items.length + " tersedia";

  container.innerHTML = items.map(item => `
    <div class="check-row" onclick="toggleItem(${item.id})" style="cursor:pointer;">
      <div class="check-circle ${item.checked ? "done" : "pending"}">
        ${item.checked ? svgCheckCircle() : ""}
      </div>
      <div class="check-info"><h4>${item.nama}</h4></div>
    </div>
  `).join("");
}

function renderTools(items) {
  const container = document.getElementById("acc-body-tools");
  const statusEl  = document.getElementById("acc-tools-status");
  const done = items.filter(i => i.checked).length;
  statusEl.textContent = done + " dari " + items.length + " tersedia";

  container.innerHTML = items.map(item => `
    <div class="check-row" onclick="toggleItem(${item.id})" style="cursor:pointer;">
      <div class="check-circle ${item.checked ? "done" : "pending"}">
        ${item.checked ? svgCheckCircle() : ""}
      </div>
      <div class="check-info"><h4>${item.nama}</h4></div>
    </div>
  `).join("");
}

async function toggleItem(id) {
  await API.put("/api/checklist/" + id + "/toggle");
  loadSupplies();
  loadChecklist();
}


const kitAccOpen = {};
function toggleKitAcc(id) {
  kitAccOpen[id] = !kitAccOpen[id];
  const header = document.querySelector(`[data-kit-acc="${id}"]`);
  const body   = document.getElementById("acc-body-" + id);
  const chev   = document.getElementById("acc-chev-" + id);
  if (header) header.classList.toggle("open", kitAccOpen[id]);
  if (body)   body.classList.toggle("open", kitAccOpen[id]);
  if (chev)   chev.classList.toggle("open", kitAccOpen[id]);
}


async function runReadinessCheck() {
  const btn = document.getElementById("readiness-btn");
  btn.textContent = "Checking...";
  btn.disabled = true;
  await loadChecklist();
  await loadHome();
  btn.textContent = "Run Readiness Check";
  btn.disabled = false;
}

function loadSOS() {
  API.get("/api/contacts").then(contacts => {
    document.getElementById("sos-contact-count").textContent = contacts.length + " contacts";
  });
  API.get("/api/settings/location_sharing").then(s => {
    document.getElementById("sos-loc-status").textContent = s.value === "true" ? "On" : "Off";
  });
  updateSOSUI();
}

function handleSOSPress() {
  if (sosActive) return;
  sosActive = true;
  sosCountdown = 3;
  updateSOSUI();

  sosTimer = setInterval(() => {
    sosCountdown--;
    updateSOSUI();
    if (sosCountdown <= 0) {
      clearInterval(sosTimer);
      sosActive = false;
      sosCountdown = 3;
      updateSOSUI();
      alert("🚨 Alert dikirim! Bantuan dalam perjalanan.");
    }
  }, 1000);
}

function cancelSOS() {
  clearInterval(sosTimer);
  sosActive = false;
  sosCountdown = 3;
  updateSOSUI();
}

function updateSOSUI() {
  const btn = document.getElementById("sos-btn");
  const hint = document.getElementById("sos-hint");

  if (btn) btn.classList.toggle("active", sosActive);

  if (hint) {
    if (sosActive) {
      hint.innerHTML = `
        <p>Help will be called in</p>
        <div class="sos-countdown">${sosCountdown}</div>
        <button class="sos-cancel" onclick="cancelSOS()">Cancel</button>
      `;
    } else {
      hint.innerHTML = `
        <p>Hold for 3 seconds</p>
        <p>to send an alert</p>
      `;
    }
  }
}

function goToContacts() {
  switchTab("profile");
}

const guideAccOpen = {};
async function loadGuide() {
  const guides = await API.get("/api/guides");
  appData.guides = guides;

  const colors = [
    { bg: "bg-red-100",    svg: "color:var(--red-600)"    },
    { bg: "bg-orange-100", svg: "color:#ea580c" },
    { bg: "bg-blue-100",   svg: "color:var(--blue-600)"   },
    { bg: "bg-purple-100", svg: "color:#9333ea" },
  ];
  const extraGuides = [
    { judul: "Choking (Tersedak)", icon: "⚠", color: 4, langkah: ["Minta korban batuk dengan keras jika masih bisa","Berikan 5 tepukan punggung: condongkan tubuh ke depan, tepuk punggung dengan pangkal telapak","Jika masih tersedak, lakukan Heimlich maneuver: kepalkan tangan di atas pusar","Tekan ke dalam dan ke atas secara berulang","Ulangi hingga objek keluar atau korban pingsan"] },
    { judul: "Fracture (Patah Tulang)", icon: "⚠", color: 5, langkah: ["JANGAN gerakkan bagian yang patah","Stabilkan area dengan bidai (kardus, majalah, dll)","Ikat bidai dengan kain/perban, tidak terlalu kencang","Kompres dingin untuk mengurangi bengkak","Segera cari bantuan medis"] },
  ];

  const allGuides = [...guides, ...extraGuides];
  const iconSvgs = [svgDroplet("var(--red-600)"), svgFlame(), svgDroplet("var(--blue-600)"), svgHeart(), svgAlert("var(--yellow-600)"), svgAlert("var(--gray-500)")];
  const bgColors = ["#fee2e2","#ffedd5","#dbeafe","#f3e8ff","#fef9c3","#f3f4f6"];

  const container = document.getElementById("guide-list");
  container.innerHTML = allGuides.map((g, i) => `
    <div class="guide-acc">
      <button class="guide-acc-header" data-guide-acc="${i}" onclick="toggleGuideAcc(${i})">
        <div class="guide-icon-wrap" style="background:${bgColors[i] || "#f3f4f6"}">
          ${iconSvgs[i] || svgAlert()}
        </div>
        <span class="guide-acc-title">${g.judul}</span>
        <svg class="guide-acc-chevron" id="guide-chev-${i}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div class="guide-acc-body" id="guide-body-${i}">
        <div class="guide-steps">
          <h4>Langkah-langkah:</h4>
          <ol style="list-style:none;padding:0;display:flex;flex-direction:column;gap:6px;">
            ${g.langkah.map((step, si) => {
              const isWarning = step.startsWith("JANGAN");
              const isSub = step.startsWith("  →");
              if (isSub) return `<li class="guide-step"><span class="sub">→ ${step.slice(4)}</span></li>`;
              if (isWarning) return `<li class="guide-step"><span class="num">⚠</span><span class="warn-tag">${step}</span></li>`;
              return `<li class="guide-step"><span class="num">${si + 1}.</span><span>${step}</span></li>`;
            }).join("")}
          </ol>
        </div>
      </div>
    </div>
  `).join("");
}

function toggleGuideAcc(id) {
  guideAccOpen[id] = !guideAccOpen[id];
  const header = document.querySelector(`[data-guide-acc="${id}"]`);
  const body   = document.getElementById("guide-body-" + id);
  const chev   = document.getElementById("guide-chev-" + id);
  if (header) header.classList.toggle("open", guideAccOpen[id]);
  if (body)   body.classList.toggle("open", guideAccOpen[id]);
  if (chev)   chev.classList.toggle("open", guideAccOpen[id]);
}

let alertsData = [];
async function loadAlerts() {
  alertsData = await API.get("/api/alerts");
  renderAlerts();
}

function renderAlerts() {
  const active = alertsData.filter(a => !a._dismissed);
  const container = document.getElementById("alerts-list");
  const header = document.getElementById("alerts-subtitle");
  if (header) header.textContent = active.length + " active notification" + (active.length !== 1 ? "s" : "");

  if (active.length === 0) {
    container.innerHTML = `
      <div class="all-clear">
        ${svgCheckCircle2("var(--green-600)", 48)}
        <h3>All Clear!</h3>
        <p>No active alerts at the moment</p>
      </div>
    `;
    return;
  }

  container.innerHTML = active.map(a => `
    <div class="alert-card ${a.level}">
      <div class="alert-icon-wrap">${alertIcon(a.level)}</div>
      <div class="alert-body">
        <div class="alert-top">
          <span class="alert-title">${a.judul}</span>
          <button class="alert-dismiss" onclick="dismissAlert(${a.id})">${svgX()}</button>
        </div>
        <p class="alert-msg">${a.deskripsi}</p>
        <p class="alert-time">${formatDateTime(a.waktu)}</p>
      </div>
    </div>
  `).join("");
}

function dismissAlert(id) {
  const alert = alertsData.find(a => a.id === id);
  if (alert) {
    alert._dismissed = true;
    API.put("/api/alerts/" + id + "/read");
    renderAlerts();
  }
}

async function loadProfile() {
  const [profile, contacts] = await Promise.all([
    API.get("/api/profile"),
    API.get("/api/contacts"),
  ]);
  appData.profile = profile;
  appData.contacts = contacts;

  document.getElementById("profile-initials").textContent = getInitials(profile.nama);
  document.getElementById("profile-name").textContent = profile.nama || "-";
  document.getElementById("profile-email-hero").textContent = profile.email || "-";
  document.getElementById("p-phone").textContent = profile.telepon || "-";
  document.getElementById("p-email").textContent = profile.email || "-";
  document.getElementById("p-address").textContent = profile.alamat || "-";

  const ecList = document.getElementById("profile-ec-list");
  ecList.innerHTML = contacts.map(c => `
    <div class="profile-ec-row">
      <div>
        <h4>${c.nama}</h4>
        <p>${c.label}</p>
      </div>
      <span style="font-size:13px;color:var(--gray-600);">${c.telepon}</span>
    </div>
  `).join("");
}

function svgCheckCircle(color = "#fff") {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
}
function svgCheckCircle2(color = "var(--green-600)", size = 18) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
}
function svgFileText() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`;
}
function svgChevRight() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;
}
function svgDroplet(color = "var(--red-600)") {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>`;
}
function svgFlame() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="#ea580c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`;
}
function svgHeart() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="#9333ea" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
}
function svgAlert(color = "var(--yellow-600)") {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
}
function svgBell(color = "var(--yellow-600)") {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`;
}
function svgInfo(color = "var(--blue-600)") {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
}
function svgX() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
}
function svgMapPin() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`;
}
function svgUsers() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
}
function svgPhone() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;
}
function svgMail() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`;
}
function svgPin() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`;
}
function svgUser() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
}
function svgSettings() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
}
function svgLogout() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`;
}
function svgEdit() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
}

function alertIcon(type) {
  if (type === "warning") return svgBell("var(--yellow-600)");
  if (type === "info")    return svgInfo("var(--blue-600)");
  if (type === "danger")  return svgAlert("var(--red-600)");
  if (type === "success") return svgCheckCircle2("var(--green-600)");
  return svgBell();
}

function getInitials(name) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase();
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
