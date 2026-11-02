const express = require("express");
const cookieSession = require("cookie-session");
const rateLimit = require("express-rate-limit");
const Database = require("better-sqlite3");
const crypto = require("crypto");
const path = require("path");

const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SESSION_SECRET = process.env.SESSION_SECRET;

if (!ADMIN_PASSWORD || !SESSION_SECRET || SESSION_SECRET.length < 32) {
  console.error("Set ADMIN_PASSWORD and SESSION_SECRET (at least 32 characters) before starting.");
  process.exit(1);
}

const db = new Database(process.env.DB_FILE || "lucky-vpn.sqlite");
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS cards (
  id INTEGER PRIMARY KEY,
  prize_key TEXT NOT NULL DEFAULT 'empty',
  prize_title TEXT NOT NULL DEFAULT 'Boş kart',
  picked INTEGER NOT NULL DEFAULT 0,
  picked_at TEXT
);
CREATE TABLE IF NOT EXISTS entry_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  used_at TEXT
);
CREATE TABLE IF NOT EXISTS play_sessions (
  id TEXT PRIMARY KEY,
  entry_code_id INTEGER NOT NULL REFERENCES entry_codes(id),
  used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
`);

const total = db.prepare("SELECT COUNT(*) AS n FROM cards").get().n;
if (total === 0) {
  const prizes = [
    ["six_months", "6 aý mugt VPN"],
    ["three_months", "3 aý mugt VPN"],
    ["one_month", "1 aý mugt VPN"],
    ["family_five", "1 hepde 5 adamlyk maşgala"],
    ["family_three", "1 hepde 3 adamlyk maşgala"],
    ["single_week", "1 hepde 1 adamlyk"]
  ];
  const all = [...prizes, ...Array.from({length: 244}, () => ["empty", "Boş kart"])]
    .sort(() => Math.random() - 0.5);
  const insert = db.prepare("INSERT INTO cards (id, prize_key, prize_title) VALUES (?, ?, ?)");
  const seed = db.transaction(() => all.forEach((p, i) => insert.run(i + 1, p[0], p[1])));
  seed();
}

app.use(express.json({limit: "20kb"}));
app.use(cookieSession({
  name: "lucky_session",
  keys: [SESSION_SECRET],
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: 7 * 24 * 60 * 60 * 1000
}));

["index.html", "admin.html", "app.js", "admin.js", "style.css"].forEach((f) => {
  app.get("/" + f, (req, res) => res.sendFile(path.join(__dirname, f)));
});

const loginLimiter = rateLimit({windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false});
const codeLimiter = rateLimit({windowMs: 60 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false});
const adminLimiter = rateLimit({windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false});

function requireAdmin(req, res, next) {
  if (!req.session || req.session.admin !== true) return res.status(401).json({error: "Admin giriş talap edilýär."});
  next();
}
function cleanCode(v) {
  return String(v || "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
}

app.get("/api/status", (req, res) => {
  const stats = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM cards) AS total,
      (SELECT COUNT(*) FROM cards WHERE picked = 1) AS picked,
      (SELECT COUNT(*) FROM cards WHERE picked = 0) AS remaining
  `).get();
  res.json(stats);
});

app.post("/api/redeem", codeLimiter, (req, res) => {
  const code = cleanCode(req.body.code);
  if (code.length < 8 || code.length > 40) return res.status(400).json({error: "Giriş kody nädogry."});
  const row = db.prepare("SELECT * FROM entry_codes WHERE code = ?").get(code);
  if (!row || row.used_at) return res.status(400).json({error: "Bu giriş kody nädogry ýa-da öň ulanylan."});
  const playId = crypto.randomBytes(24).toString("hex");
  const now = new Date().toISOString();
  const redeem = db.transaction(() => {
    const result = db.prepare("UPDATE entry_codes SET used_at = ? WHERE id = ? AND used_at IS NULL").run(now, row.id);
    if (result.changes !== 1) return false;
    db.prepare("INSERT INTO play_sessions (id, entry_code_id, created_at) VALUES (?, ?, ?)")
      .run(playId, row.id, now);
    return true;
  });
  if (!redeem()) return res.status(400).json({error: "Bu giriş kody eýýäm ulanylan."});
  req.session.playId = playId;
  res.json({ok: true});
});

app.get("/api/play", (req, res) => {
  if (!req.session || !req.session.playId) return res.status(401).json({error: "Ilki giriş koduňy giriz."});
  const play = db.prepare("SELECT used FROM play_sessions WHERE id = ?").get(req.session.playId);
  if (!play) return res.status(401).json({error: "Giriş sessiýasy tapylmady."});
  const remaining = db.prepare("SELECT COUNT(*) AS n FROM cards WHERE picked = 0").get().n;
  res.json({used: !!play.used, remaining});
});

app.get("/api/cards", (req, res) => {
  if (!req.session || !req.session.playId) return res.status(401).json({error: "Ilki giriş koduňy giriz."});
  const play = db.prepare("SELECT used FROM play_sessions WHERE id = ?").get(req.session.playId);
  if (!play || play.used) return res.status(403).json({error: "Bu giriş mümkinçiligi ulanyldy."});
  const cards = db.prepare("SELECT id FROM cards WHERE picked = 0 ORDER BY id").all();
  res.json({cards: cards.map(x => x.id)});
});

app.post("/api/pick", (req, res) => {
  if (!req.session || !req.session.playId) return res.status(401).json({error: "Ilki giriş koduňy giriz."});
  const cardId = Number(req.body.cardId);
  if (!Number.isInteger(cardId) || cardId < 1 || cardId > 250) return res.status(400).json({error: "Kart saýlawy nädogry."});
  const playId = req.session.playId;
  const pick = db.transaction(() => {
    const session = db.prepare("SELECT used FROM play_sessions WHERE id = ?").get(playId);
    if (!session || session.used) return {error: "Bu giriş mümkinçiligi eýýäm ulanyldy."};
    const card = db.prepare("SELECT * FROM cards WHERE id = ? AND picked = 0").get(cardId);
    if (!card) return {error: "Bu kart eýýäm saýlandy. Başga kart saýla."};
    db.prepare("UPDATE cards SET picked = 1, picked_at = ? WHERE id = ?").run(new Date().toISOString(), cardId);
    db.prepare("UPDATE play_sessions SET used = 1 WHERE id = ?").run(playId);
    return {ok: true, prize: card.prize_title, won: card.prize_key !== "empty", cardId};
  });
  const result = pick();
  if (result.ok) req.session = null;
  if (result.error) return res.status(409).json({error: result.error});
  res.json(result);
});

// Admin
app.post("/api/admin/login", loginLimiter, (req, res) => {
  const supplied = String(req.body.password || "");
  if (supplied.length !== ADMIN_PASSWORD.length ||
      !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(ADMIN_PASSWORD))) {
    return res.status(401).json({error: "Parol nädogry."});
  }
  req.session = {admin: true};
  res.json({ok: true});
});
app.post("/api/admin/logout", requireAdmin, (req, res) => { req.session = null; res.json({ok: true}); });

app.get("/api/admin/stats", adminLimiter, requireAdmin, (req, res) => {
  const stats = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM cards) AS totalCards,
      (SELECT COUNT(*) FROM cards WHERE picked = 1) AS pickedCards,
      (SELECT COUNT(*) FROM cards WHERE picked = 0) AS remainingCards,
      (SELECT COUNT(*) FROM entry_codes) AS totalCodes,
      (SELECT COUNT(*) FROM entry_codes WHERE used_at IS NOT NULL) AS usedCodes,
      (SELECT COUNT(*) FROM entry_codes WHERE used_at IS NULL) AS unusedCodes
  `).get();
  const wins = db.prepare("SELECT id, prize_title, picked_at FROM cards WHERE picked = 1 AND prize_key != 'empty' ORDER BY picked_at DESC").all();
  res.json({stats, wins});
});
app.post("/api/admin/codes", adminLimiter, requireAdmin, (req, res) => {
  const count = Math.max(1, Math.min(100, Number(req.body.count) || 1));
  const made = [];
  const insert = db.prepare("INSERT INTO entry_codes (code, created_at) VALUES (?, ?)");
  const create = db.transaction(() => {
    for (let i = 0; i < count; i++) {
      const code = "LUCKY-" + crypto.randomBytes(5).toString("hex").toUpperCase();
      insert.run(code, new Date().toISOString());
      made.push(code);
    }
  });
  create();
  res.json({codes: made});
});

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.listen(PORT, () => console.log(`Lucky VPN Cards running on port ${PORT}`));
