const express = require("express");
const initSqlJs = require("sql.js");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, "prepkit.db");

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "frontend")));

let db;

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

  
  db.run(`CREATE TABLE IF NOT EXISTS profile (id INTEGER PRIMARY KEY DEFAULT 1, nama TEXT DEFAULT '', email TEXT DEFAULT '', nik TEXT DEFAULT '', telepon TEXT DEFAULT '', alamat TEXT DEFAULT '', golongan_darah TEXT DEFAULT '')`);
  db.run(`CREATE TABLE IF NOT EXISTS emergency_contacts (id INTEGER PRIMARY KEY AUTOINCREMENT, nama TEXT NOT NULL, label TEXT DEFAULT 'Keluarga', telepon TEXT NOT NULL)`);
  db.run(`CREATE TABLE IF NOT EXISTS documents (id INTEGER PRIMARY KEY AUTOINCREMENT, nama TEXT NOT NULL, status TEXT DEFAULT 'belum', tanggal TEXT)`);
  db.run(`CREATE TABLE IF NOT EXISTS checklist_items (id INTEGER PRIMARY KEY AUTOINCREMENT, kategori TEXT NOT NULL, nama TEXT NOT NULL, checked INTEGER DEFAULT 0)`);
  db.run(`CREATE TABLE IF NOT EXISTS medicine_guide (id INTEGER PRIMARY KEY AUTOINCREMENT, gejala TEXT NOT NULL, obat TEXT NOT NULL)`);
  db.run(`CREATE TABLE IF NOT EXISTS survival_guides (id INTEGER PRIMARY KEY AUTOINCREMENT, judul TEXT NOT NULL, icon TEXT DEFAULT '', langkah TEXT DEFAULT '[]')`);
  db.run(`CREATE TABLE IF NOT EXISTS alerts (id INTEGER PRIMARY KEY AUTOINCREMENT, judul TEXT NOT NULL, deskripsi TEXT NOT NULL, level TEXT DEFAULT 'warning', waktu TEXT DEFAULT (datetime('now','localtime')), dibaca INTEGER DEFAULT 0)`);
  db.run(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT DEFAULT '')`);

 
  const count = get("SELECT COUNT(*) as c FROM checklist_items");
  if (!count || count.c === 0) {
    db.run(`INSERT OR IGNORE INTO profile (id,nama,email,nik,telepon,alamat,golongan_darah) VALUES (1,'Rahmi Aulia','rahmi.aulia@gmail.com','3201xxxxxxxxxxxx','+62 812 xxxx xxxx','Bogor, Jawa Barat','O+')`);
    [["Ibu (Mama)","Keluarga utama","+62 811 xxxx xxxx"],["Ayah (Papa)","Keluarga utama","+62 813 xxxx xxxx"],["Kak Reza","Saudara","+62 857 xxxx xxxx"]].forEach(c=>db.run("INSERT INTO emergency_contacts (nama,label,telepon) VALUES (?,?,?)",c));
    [["KTP / ID","tersimpan","2025-01-12"],["Passport","tersimpan","2024-03-03"],["Asuransi","tersimpan","2024-09-07"],["Dokumen Lainnya","belum",null]].forEach(d=>db.run("INSERT INTO documents (nama,status,tanggal) VALUES (?,?,?)",d));
    [["first_aid","Paracetamol",1],["first_aid","Ibuprofen",1],["first_aid","Antiseptik",1],["first_aid","Plester berbagai ukuran",1],["first_aid","Kasa steril",1],["first_aid","Perban",1],["first_aid","Burn cream",1],["first_aid","Oralit",0],["first_aid","Antihistamin",0],["first_aid","Obat anti mual",1],["food_water","Air mineral min. 2L/orang",1],["food_water","Makanan tahan lama",1],["food_water","Snack energi",1],["tools","Senter",1],["tools","Power bank",1],["tools","Pisau multifungsi",1],["tools","Korek api",1],["tools","Peluit",1],["tools","Tali",0]].forEach(i=>db.run("INSERT INTO checklist_items (kategori,nama,checked) VALUES (?,?,?)",i));
    [["Demam","Paracetamol"],["Sakit Kepala","Paracetamol / Ibuprofen"],["Luka Ringan","Antiseptik + Plester"],["Luka Berdarah","Kasa + Perban"],["Luka Bakar","Burn Cream"],["Diare","Oralit"],["Alergi","Antihistamin"],["Mual","Anti Mual"]].forEach(m=>db.run("INSERT INTO medicine_guide (gejala,obat) VALUES (?,?)",m));
    [["Pendarahan","🩸",JSON.stringify(["Tekan luka dengan kain bersih atau kasa","Tahan tekanan selama beberapa menit tanpa melepas","Angkat bagian yang luka lebih tinggi dari jantung jika memungkinkan","Balut dengan perban untuk menghentikan darah"])],["Luka Bakar","🔥",JSON.stringify(["Siram area luka dengan air dingin selama 10–20 menit","Lepaskan aksesoris di sekitar luka jika tidak menempel","Tutup dengan kasa steril atau kain bersih yang lembut","Jangan oleskan pasta gigi atau mentega pada luka"])],["Dehidrasi","💧",JSON.stringify(["Minum air sedikit demi sedikit tapi sering","Gunakan oralit jika tersedia untuk menggantikan elektrolit","Istirahat di tempat teduh dan sejuk","Hindari minuman berkafein atau beralkohol"])],["Pingsan","👤",JSON.stringify(["Baringkan orang tersebut di tempat yang aman","Angkat kaki sedikit lebih tinggi dari kepala","Longgarkan pakaian ketat di leher dan dada","Pastikan ada aliran udara yang cukup di sekitar korban"])]].forEach(g=>db.run("INSERT INTO survival_guides (judul,icon,langkah) VALUES (?,?,?)",g));
    [["Paracetamol Kadaluarsa","Paracetamol di First Aid kit akan kadaluarsa dalam 5 hari. Segera ganti.","danger","2026-04-27 08:00"],["Air Mineral Perlu Diganti","Air mineral dalam kit sudah disimpan lebih dari 6 bulan. Ganti dengan yang baru.","danger","2026-04-26 09:30"],["Dokumen Belum Lengkap","1 dokumen penting belum diunggah ke kit. Tambahkan untuk kesiapan maksimal.","warning","2026-04-24 14:00"]].forEach(a=>db.run("INSERT INTO alerts (judul,deskripsi,level,waktu) VALUES (?,?,?,?)",a));
    db.run("INSERT OR IGNORE INTO settings (key,value) VALUES ('location_sharing','true')");
    saveDB();
  }


  app.get("/api/status", (req, res) => {
    const docs = get("SELECT COUNT(*) as total, SUM(CASE WHEN status='tersimpan' THEN 1 ELSE 0 END) as done FROM documents");
    const items = get("SELECT COUNT(*) as total, SUM(checked) as done FROM checklist_items");
    const alertCount = get("SELECT COUNT(*) as c FROM alerts WHERE dibaca = 0");
    const totalItems = (docs.total||0) + (items.total||0);
    const doneItems = (docs.done||0) + (items.done||0);
    res.json({
      readiness_pct: totalItems > 0 ? Math.round((doneItems/totalItems)*100) : 0,
      documents: { total: docs.total||0, done: docs.done||0 },
      supplies: { total: items.total||0, done: items.done||0 },
      alerts_count: alertCount ? alertCount.c : 0,
    });
  });

  app.get("/api/profile", (req, res) => { res.json(get("SELECT * FROM profile WHERE id=1")||{}); });
  app.put("/api/profile", (req, res) => {
    const {nama,email,nik,telepon,alamat,golongan_darah}=req.body;
    run("UPDATE profile SET nama=?,email=?,nik=?,telepon=?,alamat=?,golongan_darah=? WHERE id=1",[nama,email,nik,telepon,alamat,golongan_darah]);
    res.json({ok:true});
  });

  app.get("/api/contacts", (req, res) => { res.json(all("SELECT * FROM emergency_contacts ORDER BY id")); });
  app.post("/api/contacts", (req, res) => {
    const {nama,label,telepon}=req.body;
    run("INSERT INTO emergency_contacts (nama,label,telepon) VALUES (?,?,?)",[nama,label||"Keluarga",telepon]);
    res.json({ok:true});
  });
  app.delete("/api/contacts/:id", (req, res) => { run("DELETE FROM emergency_contacts WHERE id=?",[Number(req.params.id)]); res.json({ok:true}); });

  app.get("/api/documents", (req, res) => { res.json(all("SELECT * FROM documents ORDER BY id")); });
  app.put("/api/documents/:id", (req, res) => {
    const {status,tanggal}=req.body;
    run("UPDATE documents SET status=?,tanggal=? WHERE id=?",[status,tanggal,Number(req.params.id)]);
    res.json({ok:true});
  });

  app.get("/api/checklist/:kategori", (req, res) => { res.json(all("SELECT * FROM checklist_items WHERE kategori=? ORDER BY id",[req.params.kategori])); });
  app.put("/api/checklist/:id/toggle", (req, res) => {
    run("UPDATE checklist_items SET checked=CASE WHEN checked=1 THEN 0 ELSE 1 END WHERE id=?",[Number(req.params.id)]);
    res.json(get("SELECT * FROM checklist_items WHERE id=?",[Number(req.params.id)]));
  });

  app.get("/api/medicine", (req, res) => { res.json(all("SELECT * FROM medicine_guide ORDER BY id")); });

  app.get("/api/guides", (req, res) => {
    const guides = all("SELECT * FROM survival_guides ORDER BY id");
    guides.forEach(g => { try { g.langkah=JSON.parse(g.langkah); } catch { g.langkah=[]; } });
    res.json(guides);
  });

  app.get("/api/alerts", (req, res) => { res.json(all("SELECT * FROM alerts ORDER BY waktu DESC")); });
  app.put("/api/alerts/:id/read", (req, res) => { run("UPDATE alerts SET dibaca=1 WHERE id=?",[Number(req.params.id)]); res.json({ok:true}); });

  app.get("/api/settings/:key", (req, res) => {
    const row = get("SELECT value FROM settings WHERE key=?",[req.params.key]);
    res.json({key:req.params.key, value:row?row.value:null});
  });
  app.put("/api/settings/:key", (req, res) => {
    run("INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)",[req.params.key,req.body.value]);
    res.json({ok:true});
  });

  app.get("*", (req, res) => { res.sendFile(path.join(__dirname,"..","frontend","index.html")); });

  app.listen(PORT, () => { console.log(`\n  Web berjalan di http://localhost:${PORT}\n`); });
}

main().catch(err => { console.error("Failed to start:", err); process.exit(1); });
