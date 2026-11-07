// Bruce Loose score server.
// Zero dependencies: Node's built-in http + node:sqlite (Node 22.13+).
//
//   GET  /api/health              -> { ok: true }
//   GET  /api/scores?limit=10     -> top scores
//   POST /api/scores              -> save a score, returns { id, rank }
//
// Set STATIC_DIR (the public/ folder) to also serve the game files, handy for running without Docker.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

// PORT is set inside Docker; GAME_PORT comes from .env when running with `npm run dev`.
const PORT = Number(process.env.PORT || process.env.GAME_PORT) || 3000;
const DB_PATH = process.env.DB_PATH || path.join(import.meta.dirname, 'data', 'scores.db');
const STATIC_DIR = process.env.STATIC_DIR ? path.resolve(process.env.STATIC_DIR) : null;

// ---------- database ----------
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS scores (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    score       INTEGER NOT NULL,
    coins       INTEGER NOT NULL,
    total_coins INTEGER NOT NULL,
    character   TEXT    NOT NULL,
    result      TEXT    NOT NULL,          -- 'won' or 'died'
    time_ms     INTEGER NOT NULL,          -- how long the run lasted
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_scores_rank ON scores (score DESC, time_ms ASC);
`);
// added later: what the run was played on (phone / tablet / desktop). Older rows stay NULL.
if (!db.prepare(`SELECT 1 FROM pragma_table_info('scores') WHERE name = 'device'`).get()) {
  db.exec(`ALTER TABLE scores ADD COLUMN device TEXT`);
}
const insertScore = db.prepare(`
  INSERT INTO scores (name, score, coins, total_coins, character, result, time_ms, device)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
const topScores = db.prepare(`
  SELECT id, name, score, coins, total_coins AS totalCoins, character, result,
         time_ms AS timeMs, device, created_at AS createdAt
  FROM scores ORDER BY score DESC, time_ms ASC, id ASC LIMIT ?`);
const rankOf = db.prepare(`
  SELECT COUNT(*) AS ahead FROM scores
  WHERE score > ? OR (score = ? AND time_ms < ?) OR (score = ? AND time_ms = ? AND id < ?)`);

// ---------- validation ----------
const CHARACTERS = new Set(['bruce', 'gremlin']);
const RESULTS = new Set(['won', 'died']);
const DEVICES = new Set(['phone', 'tablet', 'desktop']);
const isInt = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;

function validate(body) {
  if (!body || typeof body !== 'object') return 'Expected a JSON object.';
  const name = typeof body.name === 'string'
    ? body.name.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim() : '';
  if (name.length < 1 || name.length > 16) return 'Name must be 1-16 characters.';
  if (!isInt(body.score, 0, 1_000_000)) return 'Score must be a whole number from 0 to 1,000,000.';
  if (!isInt(body.totalCoins, 0, 10_000)) return 'totalCoins is out of range.';
  if (!isInt(body.coins, 0, body.totalCoins)) return 'coins must be between 0 and totalCoins.';
  if (!CHARACTERS.has(body.character)) return 'character must be "bruce" or "gremlin".';
  if (!RESULTS.has(body.result)) return 'result must be "won" or "died".';
  if (body.device !== undefined && !DEVICES.has(body.device)) return 'device must be "phone", "tablet" or "desktop".';
  if (!isInt(body.timeMs, 0, 24 * 3600 * 1000)) return 'timeMs is out of range.';
  return { name, score: body.score, coins: body.coins, totalCoins: body.totalCoins,
           character: body.character, result: body.result, timeMs: body.timeMs, device: body.device || null };
}

// ---------- tiny per-IP rate limit for saves ----------
const SAVES_PER_MINUTE = Math.max(1, Number(process.env.SAVES_PER_MINUTE) || 6);
const recent = new Map();   // ip -> [timestamps]
function allowSave(ip) {
  const now = Date.now();
  const list = (recent.get(ip) || []).filter(t => now - t < 60_000);
  if (list.length >= SAVES_PER_MINUTE) { recent.set(ip, list); return false; }
  list.push(now); recent.set(ip, list);
  return true;
}
setInterval(() => {   // forget idle IPs
  const now = Date.now();
  for (const [ip, list] of recent) if (list.every(t => now - t >= 60_000)) recent.delete(ip);
}, 60_000).unref();

// ---------- http helpers ----------
function send(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}
function readJson(req, limit = 2048) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(Object.assign(new Error('Request body too large.'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null')); }
      catch { reject(Object.assign(new Error('Body is not valid JSON.'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}
const clientIp = (req) => req.headers['x-real-ip'] || req.socket.remoteAddress || 'unknown';

// ---------- static files (optional) ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
                '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
function serveStatic(req, res, pathname) {
  let rel;
  try { rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, ''); }
  catch { return send(res, 400, { error: 'Bad path.' }); }
  const file = path.resolve(STATIC_DIR, rel);
  // anything inside public/, nothing outside it, no hidden files
  const inside = file.startsWith(STATIC_DIR + path.sep);
  if (!inside || rel.split('/').some(part => part.startsWith('.'))) return send(res, 404, { error: 'Not found.' });
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, { error: 'Not found.' });
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

// ---------- routes ----------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/api/health' && req.method === 'GET') return send(res, 200, { ok: true });

    if (url.pathname === '/api/scores' && req.method === 'GET') {
      const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit'), 10) || 10));
      return send(res, 200, { scores: topScores.all(limit) });
    }

    if (url.pathname === '/api/scores' && req.method === 'POST') {
      const v = validate(await readJson(req));
      if (typeof v === 'string') return send(res, 400, { error: v });
      if (!allowSave(clientIp(req))) return send(res, 429, { error: 'Too many saves. Try again in a minute.' });
      const { lastInsertRowid } = insertScore.run(v.name, v.score, v.coins, v.totalCoins, v.character, v.result, v.timeMs, v.device);
      const id = Number(lastInsertRowid);
      const { ahead } = rankOf.get(v.score, v.score, v.timeMs, v.score, v.timeMs, id);
      return send(res, 201, { id, rank: ahead + 1 });
    }

    if (url.pathname.startsWith('/api/')) return send(res, 404, { error: 'Not found.' });
    if (STATIC_DIR && req.method === 'GET') return serveStatic(req, res, url.pathname);
    send(res, 404, { error: 'Not found.' });
  } catch (err) {
    if (!res.headersSent) send(res, err.status || 500, { error: err.status ? err.message : 'Server error.' });
    if (!err.status) console.error(err);
  }
});

server.listen(PORT, () => {
  console.log(`Bruce Loose score server on :${PORT} (db: ${DB_PATH}${STATIC_DIR ? `, serving ${STATIC_DIR}` : ''})`);
});

function shutdown() { server.close(() => { db.close(); process.exit(0); }); }
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
