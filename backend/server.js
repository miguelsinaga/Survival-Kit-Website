const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
  max: 1,
  idleTimeoutMillis: 10000,
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "frontend")));

function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function verifyPassword(password, hash) {
  return hashPassword(password) === hash;
}

async function all(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows;
}

async function get(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows[0] || null;
}

async function run(sql, params = []) {
  await pool.query(sql, params);
}

async function initDB() {
  await run(`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    nama TEXT DEFAULT ''
  )`);

  await run(`CREATE TABLE IF NOT EXISTS profile (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
    nama TEXT DEFAULT '',
    email TEXT DEFAULT '',
    nik TEXT DEFAULT '',
    telepon TEXT DEFAULT '',
    alamat TEXT DEFAULT '',
    golongan_darah TEXT DEFAULT ''
  )`);

  await run(`CREATE TABLE IF NOT EXISTS emergency_contacts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    nama TEXT NOT NULL,
    label TEXT DEFAULT 'Keluarga',
    telepon TEXT NOT NULL
  )`);

  await run(`CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    nama TEXT NOT NULL,
    status TEXT DEFAULT 'belum',
    tanggal TEXT
  )`);

  await run(`CREATE TABLE IF NOT EXISTS checklist_items (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    kategori TEXT NOT NULL,
    nama TEXT NOT NULL,
    checked INTEGER DEFAULT 0
  )`);

  await run(`CREATE TABLE IF NOT EXISTS medicine_guide (
    id SERIAL PRIMARY KEY,
    gejala TEXT NOT NULL,
    obat TEXT NOT NULL
  )`);

  await run(`CREATE TABLE IF NOT EXISTS survival_guides (
    id SERIAL PRIMARY KEY,
    judul TEXT NOT NULL,
    icon TEXT DEFAULT '',
    langkah TEXT DEFAULT '[]'
  )`);

  await run(`CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    judul TEXT NOT NULL,
    deskripsi TEXT NOT NULL,
    level TEXT DEFAULT 'warning',
    waktu TEXT DEFAULT '',
    dibaca INTEGER DEFAULT 0
  )`);

  await run(`CREATE TABLE IF NOT EXISTS settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    key TEXT NOT NULL,
    value TEXT DEFAULT '',
    UNIQUE(user_id, key)
  )`);

  await run(`CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  // Seed only when database is empty
  const count = await get("SELECT COUNT(*) as c FROM checklist_items");
  if (!count || parseInt(count.c) === 0) {
    const sampleUserEmail = "rahmi.aulia@gmail.com";
    const sampleUserPassword = hashPassword("password123");

    await run(
      "INSERT INTO users (email,password,nama) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
      [sampleUserEmail, sampleUserPassword, "Rahmi Aulia"]
    );
    const sampleUser = await get("SELECT id FROM users WHERE email=$1", [sampleUserEmail]);
    const userId = sampleUser.id;

    await run(
      "INSERT INTO profile (user_id,nama,email,nik,telepon,alamat,golongan_darah) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (user_id) DO NOTHING",
      [userId, "Rahmi Aulia", sampleUserEmail, "3201xxxxxxxxxxxx", "+62 812 xxxx xxxx", "Bogor, Jawa Barat", "O+"]
    );

    for (const c of [
      ["Ibu (Mama)", "Keluarga utama", "+62 811 xxxx xxxx"],
      ["Ayah (Papa)", "Keluarga utama", "+62 813 xxxx xxxx"],
      ["Kak Reza", "Saudara", "+62 857 xxxx xxxx"],
    ]) {
      await run("INSERT INTO emergency_contacts (user_id,nama,label,telepon) VALUES ($1,$2,$3,$4)", [userId, ...c]);
    }

    for (const d of [
      ["KTP / ID", "tersimpan", "2025-01-12"],
      ["Passport", "tersimpan", "2024-03-03"],
      ["Asuransi", "tersimpan", "2024-09-07"],
      ["Dokumen Lainnya", "belum", null],
    ]) {
      await run("INSERT INTO documents (user_id,nama,status,tanggal) VALUES ($1,$2,$3,$4)", [userId, ...d]);
    }

    for (const i of [
      ["first_aid", "Paracetamol", 1], ["first_aid", "Ibuprofen", 1], ["first_aid", "Antiseptik", 1],
      ["first_aid", "Plester berbagai ukuran", 1], ["first_aid", "Kasa steril", 1], ["first_aid", "Perban", 1],
      ["first_aid", "Burn cream", 1], ["first_aid", "Oralit", 0], ["first_aid", "Antihistamin", 0],
      ["first_aid", "Obat anti mual", 1], ["food_water", "Air mineral min. 2L/orang", 1],
      ["food_water", "Makanan tahan lama", 1], ["food_water", "Snack energi", 1],
      ["tools", "Senter", 1], ["tools", "Power bank", 1], ["tools", "Pisau multifungsi", 1],
      ["tools", "Korek api", 1], ["tools", "Peluit", 1], ["tools", "Tali", 0],
    ]) {
      await run("INSERT INTO checklist_items (user_id,kategori,nama,checked) VALUES ($1,$2,$3,$4)", [userId, ...i]);
    }

    for (const m of [
      ["Demam", "Paracetamol"], ["Sakit Kepala", "Paracetamol / Ibuprofen"],
      ["Luka Ringan", "Antiseptik + Plester"], ["Luka Berdarah", "Kasa + Perban"],
      ["Luka Bakar", "Burn Cream"], ["Diare", "Oralit"], ["Alergi", "Antihistamin"], ["Mual", "Anti Mual"],
    ]) {
      await run("INSERT INTO medicine_guide (gejala,obat) VALUES ($1,$2)", m);
    }

    for (const g of [
      ["Pendarahan", "🩸", JSON.stringify(["Tekan luka dengan kain bersih atau kasa", "Tahan tekanan selama beberapa menit tanpa melepas", "Angkat bagian yang luka lebih tinggi dari jantung jika memungkinkan", "Balut dengan perban untuk menghentikan darah"])],
      ["Luka Bakar", "🔥", JSON.stringify(["Siram area luka dengan air dingin selama 10–20 menit", "Lepaskan aksesoris di sekitar luka jika tidak menempel", "Tutup dengan kasa steril atau kain bersih yang lembut", "Jangan oleskan pasta gigi atau mentega pada luka"])],
      ["Dehidrasi", "💧", JSON.stringify(["Minum air sedikit demi sedikit tapi sering", "Gunakan oralit jika tersedia untuk menggantikan elektrolit", "Istirahat di tempat teduh dan sejuk", "Hindari minuman berkafein atau beralkohol"])],
      ["Pingsan", "👤", JSON.stringify(["Baringkan orang tersebut di tempat yang aman", "Angkat kaki sedikit lebih tinggi dari kepala", "Longgarkan pakaian ketat di leher dan dada", "Pastikan ada aliran udara yang cukup di sekitar korban"])],
    ]) {
      await run("INSERT INTO survival_guides (judul,icon,langkah) VALUES ($1,$2,$3)", g);
    }

    for (const a of [
      ["Paracetamol Kadaluarsa", "Paracetamol di First Aid kit akan kadaluarsa dalam 5 hari. Segera ganti.", "danger", "2026-04-27 08:00"],
      ["Air Mineral Perlu Diganti", "Air mineral dalam kit sudah disimpan lebih dari 6 bulan. Ganti dengan yang baru.", "danger", "2026-04-26 09:30"],
      ["Dokumen Belum Lengkap", "1 dokumen penting belum diunggah ke kit. Tambahkan untuk kesiapan maksimal.", "warning", "2026-04-24 14:00"],
    ]) {
      await run("INSERT INTO alerts (user_id,judul,deskripsi,level,waktu) VALUES ($1,$2,$3,$4,$5)", [userId, ...a]);
    }

    await run(
      "INSERT INTO settings (user_id,key,value) VALUES ($1,$2,$3) ON CONFLICT (user_id,key) DO NOTHING",
      [userId, "location_sharing", "true"]
    );
  }
}

// Lazy initialization — runs once, reused on subsequent requests
let initPromise = null;
function ensureInit() {
  if (!initPromise) initPromise = initDB();
  return initPromise;
}

// Wait for DB before handling any request
app.use(async (req, res, next) => {
  try {
    await ensureInit();
    next();
  } catch (err) {
    console.error("DB init error:", err);
    res.status(500).json({ error: "Database initialization failed" });
  }
});

// AUTH ENDPOINTS
app.post("/api/signup", async (req, res) => {
  try {
    const { email, password, nama } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email dan password diperlukan" });

    const existingUser = await get("SELECT id FROM users WHERE email=$1", [email]);
    if (existingUser) return res.status(409).json({ error: "Email sudah terdaftar" });

    const hashedPassword = hashPassword(password);
    await run("INSERT INTO users (email,password,nama) VALUES ($1,$2,$3)", [email, hashedPassword, nama || ""]);
    const newUser = await get("SELECT id,email,nama FROM users WHERE email=$1", [email]);

    await run(
      "INSERT INTO profile (user_id,nama,email) VALUES ($1,$2,$3) ON CONFLICT (user_id) DO NOTHING",
      [newUser.id, nama || "", email]
    );

    for (const i of [
      ["first_aid", "Paracetamol", 1], ["first_aid", "Ibuprofen", 1], ["first_aid", "Antiseptik", 1],
      ["first_aid", "Plester berbagai ukuran", 1], ["first_aid", "Kasa steril", 1], ["first_aid", "Perban", 1],
      ["first_aid", "Burn cream", 1], ["first_aid", "Oralit", 1], ["first_aid", "Antihistamin", 1],
      ["first_aid", "Obat anti mual", 1], ["food_water", "Air mineral min. 2L/orang", 1],
      ["food_water", "Makanan tahan lama", 1], ["food_water", "Snack energi", 1],
      ["tools", "Senter", 1], ["tools", "Power bank", 1], ["tools", "Pisau multifungsi", 1],
      ["tools", "Korek api", 1], ["tools", "Peluit", 1], ["tools", "Tali", 1],
    ]) {
      await run("INSERT INTO checklist_items (user_id,kategori,nama,checked) VALUES ($1,$2,$3,$4)", [newUser.id, ...i]);
    }

    for (const d of [
      ["KTP / ID", "belum", null], ["Passport", "belum", null],
      ["Asuransi", "belum", null], ["Dokumen Lainnya", "belum", null],
    ]) {
      await run("INSERT INTO documents (user_id,nama,status,tanggal) VALUES ($1,$2,$3,$4)", [newUser.id, ...d]);
    }

    await run(
      "INSERT INTO settings (user_id,key,value) VALUES ($1,$2,$3) ON CONFLICT (user_id,key) DO NOTHING",
      [newUser.id, "location_sharing", "false"]
    );

    const sessionId = crypto.randomBytes(16).toString("hex");
    await run("INSERT INTO sessions (id,user_id) VALUES ($1,$2)", [sessionId, newUser.id]);

    res.json({ success: true, sessionId, user: newUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/signin", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email dan password diperlukan" });

    const user = await get("SELECT * FROM users WHERE email=$1", [email]);
    if (!user || !verifyPassword(password, user.password)) {
      return res.status(401).json({ error: "Email atau password salah" });
    }

    const sessionId = crypto.randomBytes(16).toString("hex");
    await run("INSERT INTO sessions (id,user_id) VALUES ($1,$2)", [sessionId, user.id]);

    res.json({ success: true, sessionId, user: { id: user.id, email: user.email, nama: user.nama } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/signout", async (req, res) => {
  const sessionId = req.headers["x-session-id"];
  if (sessionId) await run("DELETE FROM sessions WHERE id=$1", [sessionId]);
  res.json({ success: true });
});

app.get("/api/me", async (req, res) => {
  const sessionId = req.headers["x-session-id"];
  if (!sessionId) return res.json(null);
  const session = await get("SELECT user_id FROM sessions WHERE id=$1", [sessionId]);
  if (!session) return res.json(null);
  const user = await get("SELECT id,email,nama FROM users WHERE id=$1", [session.user_id]);
  res.json(user || null);
});

app.get("/api/status", async (req, res) => {
  const sessionId = req.headers["x-session-id"];
  if (!sessionId) return res.status(401).json({ error: "Not authenticated" });
  const session = await get("SELECT user_id FROM sessions WHERE id=$1", [sessionId]);
  if (!session) return res.status(401).json({ error: "Invalid session" });

  const userId = session.user_id;
  const docs = await get(
    "SELECT COUNT(*) as total, SUM(CASE WHEN status='tersimpan' THEN 1 ELSE 0 END) as done FROM documents WHERE user_id=$1",
    [userId]
  );
  const items = await get(
    "SELECT COUNT(*) as total, SUM(checked) as done FROM checklist_items WHERE user_id=$1",
    [userId]
  );
  const alertCount = await get(
    "SELECT COUNT(*) as c FROM alerts WHERE user_id=$1 AND dibaca=0",
    [userId]
  );
  const totalItems = (parseInt(docs.total) || 0) + (parseInt(items.total) || 0);
  const doneItems = (parseInt(docs.done) || 0) + (parseInt(items.done) || 0);
  res.json({
    readiness_pct: totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0,
    documents: { total: parseInt(docs.total) || 0, done: parseInt(docs.done) || 0 },
    supplies: { total: parseInt(items.total) || 0, done: parseInt(items.done) || 0 },
    alerts_count: alertCount ? parseInt(alertCount.c) : 0,
  });
});

app.get("/api/profile", async (req, res) => {
  const sessionId = req.headers["x-session-id"];
  if (!sessionId) return res.status(401).json({ error: "Not authenticated" });
  const session = await get("SELECT user_id FROM sessions WHERE id=$1", [sessionId]);
  if (!session) return res.status(401).json({ error: "Invalid session" });
  res.json((await get("SELECT * FROM profile WHERE user_id=$1", [session.user_id])) || {});
});

app.put("/api/profile", async (req, res) => {
  const sessionId = req.headers["x-session-id"];
  if (!sessionId) return res.status(401).json({ error: "Not authenticated" });
  const session = await get("SELECT user_id FROM sessions WHERE id=$1", [sessionId]);
  if (!session) return res.status(401).json({ error: "Invalid session" });

  const { nama, email, nik, telepon, alamat, golongan_darah } = req.body;
  await run(
    "UPDATE profile SET nama=$1,email=$2,nik=$3,telepon=$4,alamat=$5,golongan_darah=$6 WHERE user_id=$7",
    [nama, email, nik, telepon, alamat, golongan_darah, session.user_id]
  );
  res.json({ ok: true });
});

app.get("/api/contacts", async (req, res) => {
  const sessionId = req.headers["x-session-id"];
  if (!sessionId) return res.status(401).json({ error: "Not authenticated" });
  const session = await get("SELECT user_id FROM sessions WHERE id=$1", [sessionId]);
  if (!session) return res.status(401).json({ error: "Invalid session" });
  res.json(await all("SELECT * FROM emergency_contacts WHERE user_id=$1 ORDER BY id", [session.user_id]));
});

app.post("/api/contacts", async (req, res) => {
  const sessionId = req.headers["x-session-id"];
  if (!sessionId) return res.status(401).json({ error: "Not authenticated" });
  const session = await get("SELECT user_id FROM sessions WHERE id=$1", [sessionId]);
  if (!session) return res.status(401).json({ error: "Invalid session" });

  const { nama, label, telepon } = req.body;
  await run(
    "INSERT INTO emergency_contacts (user_id,nama,label,telepon) VALUES ($1,$2,$3,$4)",
    [session.user_id, nama, label || "Keluarga", telepon]
  );
  res.json({ ok: true });
});

app.put("/api/contacts/:id", async (req, res) => {
  const sessionId = req.headers["x-session-id"];
  if (!sessionId) return res.status(401).json({ error: "Not authenticated" });
  const session = await get("SELECT user_id FROM sessions WHERE id=$1", [sessionId]);
  if (!session) return res.status(401).json({ error: "Invalid session" });

  const { nama, label, telepon } = req.body;
  await run(
    "UPDATE emergency_contacts SET nama=$1,label=$2,telepon=$3 WHERE id=$4 AND user_id=$5",
    [nama, label, telepon, Number(req.params.id), session.user_id]
  );
  res.json({ ok: true });
});

app.delete("/api/contacts/:id", async (req, res) => {
  const sessionId = req.headers["x-session-id"];
  if (!sessionId) return res.status(401).json({ error: "Not authenticated" });
  const session = await get("SELECT user_id FROM sessions WHERE id=$1", [sessionId]);
  if (!session) return res.status(401).json({ error: "Invalid session" });

  await run("DELETE FROM emergency_contacts WHERE id=$1 AND user_id=$2", [Number(req.params.id), session.user_id]);
  res.json({ ok: true });
});

app.get("/api/documents", async (req, res) => {
  const sessionId = req.headers["x-session-id"];
  if (!sessionId) return res.status(401).json({ error: "Not authenticated" });
  const session = await get("SELECT user_id FROM sessions WHERE id=$1", [sessionId]);
  if (!session) return res.status(401).json({ error: "Invalid session" });
  res.json(await all("SELECT * FROM documents WHERE user_id=$1 ORDER BY id", [session.user_id]));
});

app.put("/api/documents/:id", async (req, res) => {
  const sessionId = req.headers["x-session-id"];
  if (!sessionId) return res.status(401).json({ error: "Not authenticated" });
  const session = await get("SELECT user_id FROM sessions WHERE id=$1", [sessionId]);
  if (!session) return res.status(401).json({ error: "Invalid session" });

  const { status, tanggal } = req.body;
  await run(
    "UPDATE documents SET status=$1,tanggal=$2 WHERE id=$3 AND user_id=$4",
    [status, tanggal, Number(req.params.id), session.user_id]
  );
  res.json({ ok: true });
});

app.get("/api/checklist/:kategori", async (req, res) => {
  const sessionId = req.headers["x-session-id"];
  if (!sessionId) return res.status(401).json({ error: "Not authenticated" });
  const session = await get("SELECT user_id FROM sessions WHERE id=$1", [sessionId]);
  if (!session) return res.status(401).json({ error: "Invalid session" });
  res.json(
    await all("SELECT * FROM checklist_items WHERE kategori=$1 AND user_id=$2 ORDER BY id", [
      req.params.kategori,
      session.user_id,
    ])
  );
});

app.put("/api/checklist/:id/toggle", async (req, res) => {
  const sessionId = req.headers["x-session-id"];
  if (!sessionId) return res.status(401).json({ error: "Not authenticated" });
  const session = await get("SELECT user_id FROM sessions WHERE id=$1", [sessionId]);
  if (!session) return res.status(401).json({ error: "Invalid session" });

  await run(
    "UPDATE checklist_items SET checked=CASE WHEN checked=1 THEN 0 ELSE 1 END WHERE id=$1 AND user_id=$2",
    [Number(req.params.id), session.user_id]
  );
  res.json(await get("SELECT * FROM checklist_items WHERE id=$1", [Number(req.params.id)]));
});

app.get("/api/alerts", async (req, res) => {
  const sessionId = req.headers["x-session-id"];
  if (!sessionId) return res.status(401).json({ error: "Not authenticated" });
  const session = await get("SELECT user_id FROM sessions WHERE id=$1", [sessionId]);
  if (!session) return res.status(401).json({ error: "Invalid session" });
  res.json(await all("SELECT * FROM alerts WHERE user_id=$1 ORDER BY waktu DESC", [session.user_id]));
});

app.put("/api/alerts/:id/read", async (req, res) => {
  const sessionId = req.headers["x-session-id"];
  if (!sessionId) return res.status(401).json({ error: "Not authenticated" });
  const session = await get("SELECT user_id FROM sessions WHERE id=$1", [sessionId]);
  if (!session) return res.status(401).json({ error: "Invalid session" });

  await run("UPDATE alerts SET dibaca=1 WHERE id=$1 AND user_id=$2", [Number(req.params.id), session.user_id]);
  res.json({ ok: true });
});

app.get("/api/settings/:key", async (req, res) => {
  const sessionId = req.headers["x-session-id"];
  if (!sessionId) return res.status(401).json({ error: "Not authenticated" });
  const session = await get("SELECT user_id FROM sessions WHERE id=$1", [sessionId]);
  if (!session) return res.status(401).json({ error: "Invalid session" });

  const row = await get("SELECT value FROM settings WHERE user_id=$1 AND key=$2", [session.user_id, req.params.key]);
  res.json({ key: req.params.key, value: row ? row.value : null });
});

app.put("/api/settings/:key", async (req, res) => {
  const sessionId = req.headers["x-session-id"];
  if (!sessionId) return res.status(401).json({ error: "Not authenticated" });
  const session = await get("SELECT user_id FROM sessions WHERE id=$1", [sessionId]);
  if (!session) return res.status(401).json({ error: "Invalid session" });

  await run(
    "INSERT INTO settings (user_id,key,value) VALUES ($1,$2,$3) ON CONFLICT (user_id,key) DO UPDATE SET value=EXCLUDED.value",
    [session.user_id, req.params.key, req.body.value]
  );
  res.json({ ok: true });
});

app.get("/api/medicine", async (req, res) => {
  res.json(await all("SELECT * FROM medicine_guide ORDER BY id"));
});

app.get("/api/guides", async (req, res) => {
  const guides = await all("SELECT * FROM survival_guides ORDER BY id");
  guides.forEach((g) => {
    try { g.langkah = JSON.parse(g.langkah); } catch { g.langkah = []; }
  });
  res.json(guides);
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "index.html"));
});

// Export untuk Vercel (serverless)
module.exports = app;

// Jalankan server hanya kalau dieksekusi langsung (local dev)
if (require.main === module) {
  ensureInit().then(() => {
    app.listen(PORT, () => console.log(`\n  🎒 PrepKit berjalan di http://localhost:${PORT}\n`));
  }).catch((err) => {
    console.error("Failed to start:", err);
    process.exit(1);
  });
}
