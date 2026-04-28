const express = require("express");
const initSqlJs = require("sql.js");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, "prepkit.db");

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "frontend")));

let db;

// Helper functions for password hashing
function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function verifyPassword(password, hash) {
  return hashPassword(password) === hash;
}

function saveDB() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function get(sql, params = []) {
  return all(sql, params)[0] || null;
}

function run(sql, params = []) {
  db.run(sql, params);
  saveDB();
}

async function main() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    db = new SQL.Database();
  }

  // tables
  db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, nama TEXT DEFAULT '')`);
  db.run(`CREATE TABLE IF NOT EXISTS profile (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, nama TEXT DEFAULT '', email TEXT DEFAULT '', nik TEXT DEFAULT '', telepon TEXT DEFAULT '', alamat TEXT DEFAULT '', golongan_darah TEXT DEFAULT '', FOREIGN KEY(user_id) REFERENCES users(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS emergency_contacts (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, nama TEXT NOT NULL, label TEXT DEFAULT 'Keluarga', telepon TEXT NOT NULL, FOREIGN KEY(user_id) REFERENCES users(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS documents (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, nama TEXT NOT NULL, status TEXT DEFAULT 'belum', tanggal TEXT, FOREIGN KEY(user_id) REFERENCES users(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS checklist_items (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, kategori TEXT NOT NULL, nama TEXT NOT NULL, checked INTEGER DEFAULT 0, FOREIGN KEY(user_id) REFERENCES users(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS medicine_guide (id INTEGER PRIMARY KEY AUTOINCREMENT, gejala TEXT NOT NULL, obat TEXT NOT NULL)`);
  db.run(`CREATE TABLE IF NOT EXISTS survival_guides (id INTEGER PRIMARY KEY AUTOINCREMENT, judul TEXT NOT NULL, icon TEXT DEFAULT '', langkah TEXT DEFAULT '[]')`);
  db.run(`CREATE TABLE IF NOT EXISTS alerts (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, judul TEXT NOT NULL, deskripsi TEXT NOT NULL, level TEXT DEFAULT 'warning', waktu TEXT DEFAULT (datetime('now','localtime')), dibaca INTEGER DEFAULT 0, FOREIGN KEY(user_id) REFERENCES users(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, key TEXT NOT NULL, value TEXT DEFAULT '', UNIQUE(user_id, key), FOREIGN KEY(user_id) REFERENCES users(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, created_at TEXT DEFAULT (datetime('now','localtime')), FOREIGN KEY(user_id) REFERENCES users(id))`);

  const count = get("SELECT COUNT(*) as c FROM checklist_items");
  if (!count || count.c === 0) {
    // Create sample user
    const sampleUserEmail = 'rahmi.aulia@gmail.com';
    const sampleUserPassword = hashPassword('password123');
    const existingUser = get("SELECT id FROM users WHERE email=?",[sampleUserEmail]);
    
    let userId;
    if (!existingUser) {
      run("INSERT INTO users (email,password,nama) VALUES (?,?,?)",[sampleUserEmail,sampleUserPassword,'Rahmi Aulia']);
      userId = get("SELECT id FROM users WHERE email=?",[sampleUserEmail]).id;
    } else {
      userId = existingUser.id;
    }

    // Insert profile for sample user
    run("INSERT OR IGNORE INTO profile (user_id,nama,email,nik,telepon,alamat,golongan_darah) VALUES (?,?,?,?,?,?,?)",[userId,'Rahmi Aulia',sampleUserEmail,'3201xxxxxxxxxxxx','+62 812 xxxx xxxx','Bogor, Jawa Barat','O+']);
    
    [["Ibu (Mama)","Keluarga utama","+62 811 xxxx xxxx"],["Ayah (Papa)","Keluarga utama","+62 813 xxxx xxxx"],["Kak Reza","Saudara","+62 857 xxxx xxxx"]].forEach(c=>run("INSERT INTO emergency_contacts (user_id,nama,label,telepon) VALUES (?,?,?,?)",[userId,...c]));
    [["KTP / ID","tersimpan","2025-01-12"],["Passport","tersimpan","2024-03-03"],["Asuransi","tersimpan","2024-09-07"],["Dokumen Lainnya","belum",null]].forEach(d=>run("INSERT INTO documents (user_id,nama,status,tanggal) VALUES (?,?,?,?)",[userId,...d]));
    [["first_aid","Paracetamol",1],["first_aid","Ibuprofen",1],["first_aid","Antiseptik",1],["first_aid","Plester berbagai ukuran",1],["first_aid","Kasa steril",1],["first_aid","Perban",1],["first_aid","Burn cream",1],["first_aid","Oralit",0],["first_aid","Antihistamin",0],["first_aid","Obat anti mual",1],["food_water","Air mineral min. 2L/orang",1],["food_water","Makanan tahan lama",1],["food_water","Snack energi",1],["tools","Senter",1],["tools","Power bank",1],["tools","Pisau multifungsi",1],["tools","Korek api",1],["tools","Peluit",1],["tools","Tali",0]].forEach(i=>run("INSERT INTO checklist_items (user_id,kategori,nama,checked) VALUES (?,?,?,?)",[userId,...i]));
    [["Demam","Paracetamol"],["Sakit Kepala","Paracetamol / Ibuprofen"],["Luka Ringan","Antiseptik + Plester"],["Luka Berdarah","Kasa + Perban"],["Luka Bakar","Burn Cream"],["Diare","Oralit"],["Alergi","Antihistamin"],["Mual","Anti Mual"]].forEach(m=>run("INSERT INTO medicine_guide (gejala,obat) VALUES (?,?)",m));
    [["Pendarahan","🩸",JSON.stringify(["Tekan luka dengan kain bersih atau kasa","Tahan tekanan selama beberapa menit tanpa melepas","Angkat bagian yang luka lebih tinggi dari jantung jika memungkinkan","Balut dengan perban untuk menghentikan darah"])],["Luka Bakar","🔥",JSON.stringify(["Siram area luka dengan air dingin selama 10–20 menit","Lepaskan aksesoris di sekitar luka jika tidak menempel","Tutup dengan kasa steril atau kain bersih yang lembut","Jangan oleskan pasta gigi atau mentega pada luka"])],["Dehidrasi","💧",JSON.stringify(["Minum air sedikit demi sedikit tapi sering","Gunakan oralit jika tersedia untuk menggantikan elektrolit","Istirahat di tempat teduh dan sejuk","Hindari minuman berkafein atau beralkohol"])],["Pingsan","👤",JSON.stringify(["Baringkan orang tersebut di tempat yang aman","Angkat kaki sedikit lebih tinggi dari kepala","Longgarkan pakaian ketat di leher dan dada","Pastikan ada aliran udara yang cukup di sekitar korban"])]].forEach(g=>run("INSERT INTO survival_guides (judul,icon,langkah) VALUES (?,?,?)",g));
    [["Paracetamol Kadaluarsa","Paracetamol di First Aid kit akan kadaluarsa dalam 5 hari. Segera ganti.","danger","2026-04-27 08:00"],["Air Mineral Perlu Diganti","Air mineral dalam kit sudah disimpan lebih dari 6 bulan. Ganti dengan yang baru.","danger","2026-04-26 09:30"],["Dokumen Belum Lengkap","1 dokumen penting belum diunggah ke kit. Tambahkan untuk kesiapan maksimal.","warning","2026-04-24 14:00"]].forEach(a=>run("INSERT INTO alerts (user_id,judul,deskripsi,level,waktu) VALUES (?,?,?,?,?)",[userId,...a]));
    run("INSERT OR IGNORE INTO settings (user_id,key,value) VALUES (?,?,?)",[userId,'location_sharing','true']);
    saveDB();
  }




  // Middleware to get current user from session/localStorage (client-side will handle session ID)
  function getCurrentUser(req) {
    const sessionId = req.cookies?.sessionId || req.headers['x-session-id'];
    if (!sessionId) return null;
    const session = get("SELECT user_id FROM sessions WHERE id=?",[sessionId]);
    return session ? { id: session.user_id } : null;
  }


  // AUTH ENDPOINTS
  app.post("/api/signup", (req, res) => {
    const { email, password, nama } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email dan password diperlukan" });
    
    const existingUser = get("SELECT id FROM users WHERE email=?",[email]);
    if (existingUser) return res.status(409).json({ error: "Email sudah terdaftar" });
    
    const hashedPassword = hashPassword(password);
    run("INSERT INTO users (email,password,nama) VALUES (?,?,?)",[email,hashedPassword,nama||'']);
    const newUser = get("SELECT id,email,nama FROM users WHERE email=?",[email]);
    
    // Create profile for new user
    run("INSERT INTO profile (user_id,nama,email) VALUES (?,?,?)",[newUser.id,nama||'',email]);
    
    // Create complete kit for new user (all items checked = 1, all documents = tersimpan)
    [["first_aid","Paracetamol",1],["first_aid","Ibuprofen",1],["first_aid","Antiseptik",1],["first_aid","Plester berbagai ukuran",1],["first_aid","Kasa steril",1],["first_aid","Perban",1],["first_aid","Burn cream",1],["first_aid","Oralit",1],["first_aid","Antihistamin",1],["first_aid","Obat anti mual",1],["food_water","Air mineral min. 2L/orang",1],["food_water","Makanan tahan lama",1],["food_water","Snack energi",1],["tools","Senter",1],["tools","Power bank",1],["tools","Pisau multifungsi",1],["tools","Korek api",1],["tools","Peluit",1],["tools","Tali",1]].forEach(i=>run("INSERT INTO checklist_items (user_id,kategori,nama,checked) VALUES (?,?,?,?)",[newUser.id,...i]));
    [["KTP / ID","tersimpan","2026-04-29"],["Passport","tersimpan","2026-04-29"],["Asuransi","tersimpan","2026-04-29"],["Dokumen Lainnya","tersimpan","2026-04-29"]].forEach(d=>run("INSERT INTO documents (user_id,nama,status,tanggal) VALUES (?,?,?,?)",[newUser.id,...d]));
    run("INSERT INTO settings (user_id,key,value) VALUES (?,?,?)",[newUser.id,'location_sharing','false']);
    
    // Create session
    const sessionId = crypto.randomBytes(16).toString("hex");
    run("INSERT INTO sessions (id,user_id) VALUES (?,?)",[sessionId,newUser.id]);
    
    res.json({ success: true, sessionId, user: newUser });
  });

  app.post("/api/signin", (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email dan password diperlukan" });
    
    const user = get("SELECT * FROM users WHERE email=?",[email]);
    if (!user || !verifyPassword(password, user.password)) {
      return res.status(401).json({ error: "Email atau password salah" });
    }
    
    // Create session
    const sessionId = crypto.randomBytes(16).toString("hex");
    run("INSERT INTO sessions (id,user_id) VALUES (?,?)",[sessionId,user.id]);
    
    res.json({ success: true, sessionId, user: { id: user.id, email: user.email, nama: user.nama } });
  });

  app.post("/api/signout", (req, res) => {
    const sessionId = req.headers['x-session-id'];
    if (sessionId) run("DELETE FROM sessions WHERE id=?",[sessionId]);
    res.json({ success: true });
  });

  app.get("/api/me", (req, res) => {
    const sessionId = req.headers['x-session-id'];
    if (!sessionId) return res.json(null);
    const session = get("SELECT user_id FROM sessions WHERE id=?",[sessionId]);
    if (!session) return res.json(null);
    const user = get("SELECT id,email,nama FROM users WHERE id=?",[session.user_id]);
    res.json(user || null);
  });

  // Modified API endpoints to work with logged-in user
  app.get("/api/status", (req, res) => {
    const sessionId = req.headers['x-session-id'];
    if (!sessionId) return res.status(401).json({ error: "Not authenticated" });
    const session = get("SELECT user_id FROM sessions WHERE id=?",[sessionId]);
    if (!session) return res.status(401).json({ error: "Invalid session" });
    
    const userId = session.user_id;
    const docs = get("SELECT COUNT(*) as total, SUM(CASE WHEN status='tersimpan' THEN 1 ELSE 0 END) as done FROM documents WHERE user_id=?",[userId]);
    const items = get("SELECT COUNT(*) as total, SUM(checked) as done FROM checklist_items WHERE user_id=?",[userId]);
    const alertCount = get("SELECT COUNT(*) as c FROM alerts WHERE user_id=? AND dibaca=0",[userId]);
    const totalItems = (docs.total||0) + (items.total||0);
    const doneItems = (docs.done||0) + (items.done||0);
    res.json({
      readiness_pct: totalItems > 0 ? Math.round((doneItems/totalItems)*100) : 0,
      documents: { total: docs.total||0, done: docs.done||0 },
      supplies: { total: items.total||0, done: items.done||0 },
      alerts_count: alertCount ? alertCount.c : 0,
    });
  });

  app.get("/api/profile", (req, res) => {
    const sessionId = req.headers['x-session-id'];
    if (!sessionId) return res.status(401).json({ error: "Not authenticated" });
    const session = get("SELECT user_id FROM sessions WHERE id=?",[sessionId]);
    if (!session) return res.status(401).json({ error: "Invalid session" });
    res.json(get("SELECT * FROM profile WHERE user_id=?",[session.user_id])||{});
  });

  app.put("/api/profile", (req, res) => {
    const sessionId = req.headers['x-session-id'];
    if (!sessionId) return res.status(401).json({ error: "Not authenticated" });
    const session = get("SELECT user_id FROM sessions WHERE id=?",[sessionId]);
    if (!session) return res.status(401).json({ error: "Invalid session" });
    
    const {nama,email,nik,telepon,alamat,golongan_darah}=req.body;
    run("UPDATE profile SET nama=?,email=?,nik=?,telepon=?,alamat=?,golongan_darah=? WHERE user_id=?",[nama,email,nik,telepon,alamat,golongan_darah,session.user_id]);
    res.json({ok:true});
  });

  app.get("/api/contacts", (req, res) => {
    const sessionId = req.headers['x-session-id'];
    if (!sessionId) return res.status(401).json({ error: "Not authenticated" });
    const session = get("SELECT user_id FROM sessions WHERE id=?",[sessionId]);
    if (!session) return res.status(401).json({ error: "Invalid session" });
    res.json(all("SELECT * FROM emergency_contacts WHERE user_id=? ORDER BY id",[session.user_id]));
  });

  app.post("/api/contacts", (req, res) => {
    const sessionId = req.headers['x-session-id'];
    if (!sessionId) return res.status(401).json({ error: "Not authenticated" });
    const session = get("SELECT user_id FROM sessions WHERE id=?",[sessionId]);
    if (!session) return res.status(401).json({ error: "Invalid session" });
    
    const {nama,label,telepon}=req.body;
    run("INSERT INTO emergency_contacts (user_id,nama,label,telepon) VALUES (?,?,?,?)",[session.user_id,nama,label||"Keluarga",telepon]);
    res.json({ok:true});
  });

  app.put("/api/contacts/:id", (req, res) => {
    const sessionId = req.headers['x-session-id'];
    if (!sessionId) return res.status(401).json({ error: "Not authenticated" });
    const session = get("SELECT user_id FROM sessions WHERE id=?",[sessionId]);
    if (!session) return res.status(401).json({ error: "Invalid session" });
    
    const {nama,label,telepon}=req.body;
    run("UPDATE emergency_contacts SET nama=?,label=?,telepon=? WHERE id=? AND user_id=?",[nama,label,telepon,Number(req.params.id),session.user_id]);
    res.json({ok:true});
  });

  app.delete("/api/contacts/:id", (req, res) => {
    const sessionId = req.headers['x-session-id'];
    if (!sessionId) return res.status(401).json({ error: "Not authenticated" });
    const session = get("SELECT user_id FROM sessions WHERE id=?",[sessionId]);
    if (!session) return res.status(401).json({ error: "Invalid session" });
    
    run("DELETE FROM emergency_contacts WHERE id=? AND user_id=?",[Number(req.params.id),session.user_id]);
    res.json({ok:true});
  });

  app.get("/api/documents", (req, res) => {
    const sessionId = req.headers['x-session-id'];
    if (!sessionId) return res.status(401).json({ error: "Not authenticated" });
    const session = get("SELECT user_id FROM sessions WHERE id=?",[sessionId]);
    if (!session) return res.status(401).json({ error: "Invalid session" });
    res.json(all("SELECT * FROM documents WHERE user_id=? ORDER BY id",[session.user_id]));
  });

  app.put("/api/documents/:id", (req, res) => {
    const sessionId = req.headers['x-session-id'];
    if (!sessionId) return res.status(401).json({ error: "Not authenticated" });
    const session = get("SELECT user_id FROM sessions WHERE id=?",[sessionId]);
    if (!session) return res.status(401).json({ error: "Invalid session" });
    
    const {status,tanggal}=req.body;
    run("UPDATE documents SET status=?,tanggal=? WHERE id=? AND user_id=?",[status,tanggal,Number(req.params.id),session.user_id]);
    res.json({ok:true});
  });

  app.get("/api/checklist/:kategori", (req, res) => {
    const sessionId = req.headers['x-session-id'];
    if (!sessionId) return res.status(401).json({ error: "Not authenticated" });
    const session = get("SELECT user_id FROM sessions WHERE id=?",[sessionId]);
    if (!session) return res.status(401).json({ error: "Invalid session" });
    res.json(all("SELECT * FROM checklist_items WHERE kategori=? AND user_id=? ORDER BY id",[req.params.kategori,session.user_id]));
  });

  app.put("/api/checklist/:id/toggle", (req, res) => {
    const sessionId = req.headers['x-session-id'];
    if (!sessionId) return res.status(401).json({ error: "Not authenticated" });
    const session = get("SELECT user_id FROM sessions WHERE id=?",[sessionId]);
    if (!session) return res.status(401).json({ error: "Invalid session" });
    
    run("UPDATE checklist_items SET checked=CASE WHEN checked=1 THEN 0 ELSE 1 END WHERE id=? AND user_id=?",[Number(req.params.id),session.user_id]);
    res.json(get("SELECT * FROM checklist_items WHERE id=?",[Number(req.params.id)]));
  });

  app.get("/api/alerts", (req, res) => {
    const sessionId = req.headers['x-session-id'];
    if (!sessionId) return res.status(401).json({ error: "Not authenticated" });
    const session = get("SELECT user_id FROM sessions WHERE id=?",[sessionId]);
    if (!session) return res.status(401).json({ error: "Invalid session" });
    res.json(all("SELECT * FROM alerts WHERE user_id=? ORDER BY waktu DESC",[session.user_id]));
  });

  app.put("/api/alerts/:id/read", (req, res) => {
    const sessionId = req.headers['x-session-id'];
    if (!sessionId) return res.status(401).json({ error: "Not authenticated" });
    const session = get("SELECT user_id FROM sessions WHERE id=?",[sessionId]);
    if (!session) return res.status(401).json({ error: "Invalid session" });
    
    run("UPDATE alerts SET dibaca=1 WHERE id=? AND user_id=?",[Number(req.params.id),session.user_id]);
    res.json({ok:true});
  });

  app.get("/api/settings/:key", (req, res) => {
    const sessionId = req.headers['x-session-id'];
    if (!sessionId) return res.status(401).json({ error: "Not authenticated" });
    const session = get("SELECT user_id FROM sessions WHERE id=?",[sessionId]);
    if (!session) return res.status(401).json({ error: "Invalid session" });
    
    const row = get("SELECT value FROM settings WHERE user_id=? AND key=?",[session.user_id,req.params.key]);
    res.json({key:req.params.key, value:row?row.value:null});
  });

  app.put("/api/settings/:key", (req, res) => {
    const sessionId = req.headers['x-session-id'];
    if (!sessionId) return res.status(401).json({ error: "Not authenticated" });
    const session = get("SELECT user_id FROM sessions WHERE id=?",[sessionId]);
    if (!session) return res.status(401).json({ error: "Invalid session" });
    
    run("INSERT OR REPLACE INTO settings (user_id,key,value) VALUES (?,?,?)",[session.user_id,req.params.key,req.body.value]);
    res.json({ok:true});
  });

  // Public endpoints (no auth required)
  app.get("/api/medicine", (req, res) => { res.json(all("SELECT * FROM medicine_guide ORDER BY id")); });

  app.get("/api/guides", (req, res) => {
    const guides = all("SELECT * FROM survival_guides ORDER BY id");
    guides.forEach(g => { try { g.langkah=JSON.parse(g.langkah); } catch { g.langkah=[]; } });
    res.json(guides);
  });

  app.get("*", (req, res) => { res.sendFile(path.join(__dirname,"..","frontend","index.html")); });

  app.listen(PORT, () => { console.log(`\n  🎒 PrepKit berjalan di http://localhost:${PORT}\n`); });
}

main().catch(err => { console.error("Failed to start:", err); process.exit(1); });
