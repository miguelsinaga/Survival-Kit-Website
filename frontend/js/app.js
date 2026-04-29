let appData = { status: {}, profile: {}, contacts: [], alerts: [], guides: [] };
let sosTimer = null;
let sosCountdown = 3;
let sosActive = false;
let kitTab = "checklist"; 
let suppliesSubTab = "first_aid";

// Authentication functions
async function checkSession() {
  const sessionId = API.getSessionId();
  if (!sessionId) {
    console.log("No session ID, redirecting to auth");
    switchTab("auth");
    switchAuthTab("login");
    return false;
  }
  
  try {
    const user = await API.get("/api/me");
    if (!user || user.error) {
      console.log("Invalid user response", user);
      API.setSessionId(null);
      switchTab("auth");
      switchAuthTab("login");
      return false;
    }
    
    console.log("User logged in:", user);
    switchTab("home");
    return true;
  } catch (err) {
    console.error("checkSession error:", err);
    API.setSessionId(null);
    switchTab("auth");
    switchAuthTab("login");
    return false;
  }
}

function switchAuthTab(tab) {
  document.getElementById("auth-login").style.display = tab === "login" ? "block" : "none";
  document.getElementById("auth-signup").style.display = tab === "signup" ? "block" : "none";
  
  // Clear error messages
  document.getElementById("login-error").innerHTML = "";
  document.getElementById("signup-error").innerHTML = "";
  
  // Clear input fields
  document.getElementById("login-email").value = "";
  document.getElementById("login-password").value = "";
  document.getElementById("signup-name").value = "";
  document.getElementById("signup-email").value = "";
  document.getElementById("signup-password").value = "";
}

async function handleSignIn() {
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const errorEl = document.getElementById("login-error");
  
  if (!email || !password) {
    errorEl.textContent = "Email dan password harus diisi";
    errorEl.style.display = "block";
    return;
  }
  
  try {
    const result = await API.post("/api/signin", { email, password });
    if (result.error) {
      errorEl.textContent = result.error;
      errorEl.style.display = "block";
      return;
    }
    
    API.setSessionId(result.sessionId);
    switchTab("home");
  } catch (err) {
    errorEl.textContent = "Terjadi kesalahan. Silakan coba lagi.";
    errorEl.style.display = "block";
  }
}

async function handleSignUp() {
  const nama = document.getElementById("signup-name").value.trim();
  const email = document.getElementById("signup-email").value.trim();
  const password = document.getElementById("signup-password").value;
  const errorEl = document.getElementById("signup-error");
  
  if (!nama || !email || !password) {
    errorEl.textContent = "Semua field harus diisi";
    errorEl.style.display = "block";
    return;
  }
  
  if (password.length < 6) {
    errorEl.textContent = "Password minimal 6 karakter";
    errorEl.style.display = "block";
    return;
  }
  
  try {
    const result = await API.post("/api/signup", { email, password, nama });
    if (result.error) {
      errorEl.textContent = result.error;
      errorEl.style.display = "block";
      return;
    }
    
    API.setSessionId(result.sessionId);
    switchTab("home");
  } catch (err) {
    errorEl.textContent = "Terjadi kesalahan. Silakan coba lagi.";
    errorEl.style.display = "block";
  }
}

async function handleLogOut() {
  const sessionId = API.getSessionId();
  if (sessionId) {
    await API.post("/api/signout", {});
  }
  
  API.setSessionId(null);
  switchTab("auth");
  switchAuthTab("login");
}

// Initialize app on page load
document.addEventListener("DOMContentLoaded", () => {
  checkSession();
});

function switchTab(tab) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  const screen = document.getElementById("screen-" + tab);
  if (screen) screen.classList.add("active");
  const navBtn = document.getElementById("nav-" + tab);
  if (navBtn) navBtn.classList.add("active");
  window.scrollTo(0, 0);

  // Don't load data for auth screens
  if (tab === "auth") return;
  
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
  const container = document.getElementById("acc-body-docs");
  const statusEl  = document.getElementById("acc-docs-status");
  const done = docs.filter(d => d.status === "tersimpan").length;
  statusEl.textContent = done + " dari " + docs.length + " tersimpan";

  container.innerHTML = docs.map(d => {
    const isDone = d.status === "tersimpan";
    const photo = localStorage.getItem("doc-photo-" + d.id);
    const iconHtml = photo
      ? `<div class="doc-thumb"><img src="${photo}" alt="${d.nama}"></div>`
      : `<div class="doc-icon-wrap">${svgFileText()}</div>`;
    const actionHtml = isDone
      ? `<span class="check-done">${svgCheckCircle2()}</span>`
      : `<button class="doc-camera-btn" onclick="openDocUpload(${d.id})">${svgCamera()} Foto</button>`;
    return `
      <div class="doc-row">
        <div class="doc-row-left">${iconHtml}<span>${d.nama}</span></div>
        ${actionHtml}
      </div>`;
  }).join("");
}

async function handleDocUpload(input, docId) {
  console.log("handleDocUpload called for docId:", docId);
  if (!input.files || !input.files[0]) {
    console.log("handleDocUpload: No file selected, exiting.");
    return;
  }
  const file = input.files[0];
  console.log("handleDocUpload: File selected:", file.name);
  const reader = new FileReader();
  reader.onload = async (e) => {
    console.log("handleDocUpload: FileReader onload event.");
    localStorage.setItem("doc-photo-" + docId, e.target.result);
    const today = new Date().toISOString().slice(0, 10);
    await API.put("/api/documents/" + docId, { status: "tersimpan", tanggal: today });
    console.log("handleDocUpload: API call finished. Reloading data.");
    const onProfile = document.getElementById("screen-profile").classList.contains("active");
    if (onProfile) loadProfile(); else loadSupplies();
  };
  reader.onerror = (e) => {
    console.error("handleDocUpload: FileReader error:", e);
  };
  reader.readAsDataURL(file);
  input.value = "";
}

function openDocUpload(docId) {
  console.log("openDocUpload called for docId:", docId);
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.capture = 'environment';
  input.onchange = function(e) {
    console.log("input.onchange event fired.");
    if (this.files && this.files[0]) {
      handleDocUpload(this, docId);
    } else {
      console.log("input.onchange: No files found on input.");
    }
  };
  console.log("Programmatically clicking input element.");
  input.click();
}

async function deleteDocPhoto(docId) {
  localStorage.removeItem("doc-photo-" + docId);
  await API.put("/api/documents/" + docId, { status: "belum", tanggal: null });
  loadProfile();
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
    const container = document.getElementById("sos-contacts-list");
    if (!container) return;
    if (!contacts || contacts.length === 0) {
      container.innerHTML = `<div style="padding:12px;font-size:13px;color:var(--gray-400);text-align:center;">Belum ada kontak darurat</div>`;
      return;
    }
    container.innerHTML = contacts.map((c, i) => `
      <div style="display:flex;align-items:center;gap:12px;padding:10px 0;${i > 0 ? "border-top:1px solid var(--gray-100);" : ""}">
        <div style="width:24px;height:24px;border-radius:50%;background:var(--blue-100);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--blue-600);flex-shrink:0;">${i + 1}</div>
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:600;color:var(--gray-800);">${c.nama}</div>
          <div style="font-size:11px;color:var(--gray-500);">${c.label} · ${c.telepon}</div>
        </div>
        <a href="tel:${c.telepon}" style="padding:6px 12px;background:var(--green-600);color:white;border-radius:8px;font-size:12px;font-weight:600;text-decoration:none;">Call</a>
      </div>
    `).join("");
  });
  updateSOSUI();
}

function toggleLocationSharing() {
  const statusEl = document.getElementById("sos-loc-status");
  const detailEl = document.getElementById("sos-location-detail");
  if (!navigator.geolocation) {
    statusEl.textContent = "GPS tidak didukung perangkat ini";
    return;
  }
  statusEl.textContent = "Mendapatkan lokasi...";
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude.toFixed(6);
      const lng = pos.coords.longitude.toFixed(6);
      const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`;
      statusEl.textContent = `${lat}, ${lng}`;
      detailEl.style.display = "block";
      detailEl.innerHTML = `
        <div style="font-size:12px;color:var(--gray-500);margin-bottom:8px;">Akurasi: ±${Math.round(pos.coords.accuracy)}m</div>
        <div style="display:flex;gap:8px;">
          <a href="${mapsUrl}" target="_blank" style="flex:1;padding:8px;background:var(--blue-600);color:white;border-radius:8px;font-size:13px;font-weight:600;text-align:center;text-decoration:none;">Buka Maps</a>
          <button onclick="navigator.clipboard.writeText('${mapsUrl}').then(()=>alert('Link lokasi tersalin!'))" style="flex:1;padding:8px;background:var(--gray-100);color:var(--gray-700);border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">Salin Link</button>
        </div>`;
    },
    (err) => {
      statusEl.textContent = "Gagal: " + (err.code === 1 ? "Izin ditolak" : "Tidak dapat mendapatkan lokasi");
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
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
  const [profile, contacts, docs] = await Promise.all([
    API.get("/api/profile"),
    API.get("/api/contacts"),
    API.get("/api/documents"),
  ]);
  appData.profile = profile;
  appData.contacts = contacts;

  document.getElementById("profile-initials").textContent = getInitials(profile.nama);
  document.getElementById("profile-name").textContent = profile.nama || "-";
  document.getElementById("profile-email-hero").textContent = profile.email || "-";
  document.getElementById("p-phone").textContent = profile.telepon || "-";
  document.getElementById("p-email").textContent = profile.email || "-";
  document.getElementById("p-address").textContent = profile.alamat || "-";

  renderProfileDocuments(docs);
  await loadEmergencyContacts();
}

function renderProfileDocuments(docs) {
  const container = document.getElementById("profile-docs-list");
  if (!docs || docs.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:12px;color:var(--gray-400);font-size:13px;">Tidak ada dokumen</div>`;
    return;
  }
  container.innerHTML = docs.map(d => {
    const photo = localStorage.getItem("doc-photo-" + d.id);
    const isDone = d.status === "tersimpan";
    const iconHtml = photo
      ? `<div class="doc-thumb" onclick="viewDocPhoto('${d.nama}',${d.id})" style="cursor:pointer;">${`<img src="${photo}" alt="${d.nama}">`}</div>`
      : `<div class="doc-icon-wrap">${svgFileText()}</div>`;
    return `
      <div class="doc-row">
        <div class="doc-row-left">
          ${iconHtml}
          <div>
            <div style="font-size:13px;font-weight:500;color:var(--gray-700);">${d.nama}</div>
            <div style="font-size:11px;color:${isDone ? "var(--green-600)" : "var(--gray-400)"};">
              ${isDone ? "Tersimpan" + (d.tanggal ? " · " + d.tanggal : "") : "Belum difoto"}
            </div>
          </div>
        </div>
        <div style="display:flex;gap:6px;">
          ${isDone
            ? `<button class="doc-camera-btn" style="background:var(--gray-200);color:var(--gray-600);" title="Ganti foto" onclick="openDocUpload(${d.id})">${svgCamera()}</button>
               <button class="doc-camera-btn" style="background:var(--red-100);color:var(--red-600);" onclick="deleteDocPhoto(${d.id})" title="Hapus foto">✕</button>`
            : `<button class="doc-camera-btn" onclick="openDocUpload(${d.id})">${svgCamera()} Foto</button>`}
        </div>
      </div>`;
  }).join("");
}

function viewDocPhoto(nama, docId) {
  const photo = localStorage.getItem("doc-photo-" + docId);
  if (!photo) return;
  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.9);z-index:2000;display:flex;flex-direction:column;align-items:center;justify-content:center;";
  overlay.innerHTML = `
    <div style="color:white;font-size:16px;font-weight:600;margin-bottom:16px;">${nama}</div>
    <img src="${photo}" style="max-width:90%;max-height:75vh;border-radius:8px;object-fit:contain;">
    <button onclick="this.parentElement.remove()" style="margin-top:20px;padding:10px 28px;background:white;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">Tutup</button>`;
  document.body.appendChild(overlay);
}

function openEditProfileModal() {
  const profile = appData.profile || {};
  document.getElementById("edit-nama").value = profile.nama || "";
  document.getElementById("edit-email").value = profile.email || "";
  document.getElementById("edit-telepon").value = profile.telepon || "";
  document.getElementById("edit-alamat").value = profile.alamat || "";
  document.getElementById("edit-nik").value = profile.nik || "";
  document.getElementById("edit-golongan_darah").value = profile.golongan_darah || "";
  document.getElementById("edit-profile-error").style.display = "none";
  document.getElementById("edit-profile-modal").style.display = "flex";
}

function closeEditProfileModal() {
  document.getElementById("edit-profile-modal").style.display = "none";
}

async function saveProfileChanges() {
  const nama = document.getElementById("edit-nama").value.trim();
  const email = document.getElementById("edit-email").value.trim();
  const telepon = document.getElementById("edit-telepon").value.trim();
  const alamat = document.getElementById("edit-alamat").value.trim();
  const nik = document.getElementById("edit-nik").value.trim();
  const golongan_darah = document.getElementById("edit-golongan_darah").value;
  const errorEl = document.getElementById("edit-profile-error");

  if (!nama || !email) {
    errorEl.textContent = "Name and email are required";
    errorEl.style.display = "block";
    return;
  }

  try {
    const result = await API.put("/api/profile", {
      nama,
      email,
      telepon,
      alamat,
      nik,
      golongan_darah
    });

    if (result.error) {
      errorEl.textContent = result.error;
      errorEl.style.display = "block";
      return;
    }

    // Update appData
    appData.profile = { nama, email, telepon, alamat, nik, golongan_darah };
    
    // Refresh profile display
    await loadProfile();
    
    // Close modal
    closeEditProfileModal();
  } catch (err) {
    errorEl.textContent = "Failed to save profile. Please try again.";
    errorEl.style.display = "block";
  }
}

// Emergency Contact Functions
let editingContactId = null;

function openAddContactModal() {
  editingContactId = null;
  document.getElementById("contact-modal-title").textContent = "Add Emergency Contact";
  document.getElementById("contact-nama").value = "";
  document.getElementById("contact-label").value = "Keluarga";
  document.getElementById("contact-telepon").value = "";
  document.getElementById("contact-error").innerHTML = "";
  document.getElementById("contact-modal").style.display = "flex";
}

function openEditContactModal(id, nama, label, telepon) {
  editingContactId = id;
  document.getElementById("contact-modal-title").textContent = "Edit Emergency Contact";
  document.getElementById("contact-nama").value = nama;
  document.getElementById("contact-label").value = label;
  document.getElementById("contact-telepon").value = telepon;
  document.getElementById("contact-error").innerHTML = "";
  document.getElementById("contact-modal").style.display = "flex";
}

function closeContactModal() {
  document.getElementById("contact-modal").style.display = "none";
  editingContactId = null;
}

async function saveContactChanges() {
  const nama = document.getElementById("contact-nama").value.trim();
  const label = document.getElementById("contact-label").value;
  const telepon = document.getElementById("contact-telepon").value.trim();
  const errorEl = document.getElementById("contact-error");

  if (!nama || !telepon) {
    errorEl.textContent = "Name and phone are required";
    errorEl.style.display = "block";
    return;
  }

  try {
    if (editingContactId) {
      // Update existing contact
      const result = await API.put(`/api/contacts/${editingContactId}`, {
        nama,
        label,
        telepon
      });
      if (result.error) {
        errorEl.textContent = result.error;
        errorEl.style.display = "block";
        return;
      }
    } else {
      // Add new contact
      const result = await API.post("/api/contacts", {
        nama,
        label,
        telepon
      });
      if (result.error) {
        errorEl.textContent = result.error;
        errorEl.style.display = "block";
        return;
      }
    }

    // Reload contacts
    await loadEmergencyContacts();
    closeContactModal();
  } catch (err) {
    errorEl.textContent = "Failed to save contact. Please try again.";
    errorEl.style.display = "block";
  }
}

async function deleteContact(id) {
  if (!confirm("Delete this contact?")) return;
  
  try {
    await API.delete(`/api/contacts/${id}`);
    await loadEmergencyContacts();
  } catch (err) {
    alert("Failed to delete contact");
  }
}

async function loadEmergencyContacts() {
  try {
    const contacts = await API.get("/api/contacts");
    const container = document.getElementById("profile-ec-list");
    
    if (!contacts || contacts.length === 0) {
      container.innerHTML = '<p style="color:var(--gray-500);font-size:14px;">No emergency contacts yet</p>';
      return;
    }
    
    container.innerHTML = contacts.map(c => `
      <div class="info-row2" style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <div style="flex:1;">
          <p style="margin:0;font-weight:600;color:var(--gray-900);">${c.nama}</p>
          <p style="margin:0;font-size:13px;color:var(--gray-500);">${c.label} • ${c.telepon}</p>
        </div>
        <div style="display:flex;gap:8px;">
          <button onclick="openEditContactModal(${c.id}, '${c.nama.replace(/'/g, "\\'")}', '${c.label.replace(/'/g, "\\'")}', '${c.telepon.replace(/'/g, "\\'")}')" style="background:none;border:none;color:var(--blue-600);cursor:pointer;font-size:13px;padding:4px 8px;">Edit</button>
          <button onclick="deleteContact(${c.id})" style="background:none;border:none;color:var(--red-600);cursor:pointer;font-size:13px;padding:4px 8px;">Delete</button>
        </div>
      </div>
    `).join("");
  } catch (err) {
    console.error("Failed to load emergency contacts:", err);
  }
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
function svgCamera() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`;
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
