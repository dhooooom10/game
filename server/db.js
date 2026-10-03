/* قاعدة البيانات (SQLite المدمجة في Node — بلا اعتماديات خارجية). */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, name TEXT NOT NULL, code TEXT UNIQUE NOT NULL,
  created INTEGER NOT NULL, last_seen INTEGER NOT NULL, banned INTEGER NOT NULL DEFAULT 0, skin TEXT DEFAULT 'sky'
);
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY, player_id TEXT NOT NULL, kind TEXT NOT NULL, ref TEXT, seed TEXT NOT NULL, cfg TEXT NOT NULL,
  started INTEGER NOT NULL, submitted INTEGER, score INTEGER, popped INTEGER, accuracy REAL, ticks INTEGER,
  valid INTEGER, week TEXT, timeline TEXT
);
CREATE INDEX IF NOT EXISTS runs_kind_ref ON runs(kind, ref, valid, score);
CREATE INDEX IF NOT EXISTS runs_week ON runs(kind, week, valid, score);
CREATE INDEX IF NOT EXISTS runs_player ON runs(player_id, kind, ref);
CREATE TABLE IF NOT EXISTS tournaments (
  id TEXT PRIMARY KEY, name_ar TEXT NOT NULL, name_en TEXT, desc_ar TEXT, desc_en TEXT, occasion TEXT NOT NULL DEFAULT 'custom',
  color TEXT, icon TEXT, starts INTEGER NOT NULL, ends INTEGER NOT NULL, rules TEXT NOT NULL, prize TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1, finalized INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS seasons (
  id TEXT PRIMARY KEY, name_ar TEXT NOT NULL, name_en TEXT, color TEXT, starts INTEGER NOT NULL, ends INTEGER
);
CREATE TABLE IF NOT EXISTS season_ratings (
  season_id TEXT NOT NULL, player_id TEXT NOT NULL, rating INTEGER NOT NULL DEFAULT 1000, games INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (season_id, player_id)
);
CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY, text_ar TEXT NOT NULL, text_en TEXT, active INTEGER NOT NULL DEFAULT 1, starts INTEGER, ends INTEGER, created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS friends (a TEXT NOT NULL, b TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY (a, b));
CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY, creator TEXT NOT NULL, seed TEXT NOT NULL, cfg TEXT NOT NULL, score INTEGER NOT NULL, created INTEGER NOT NULL, expires INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL, seed TEXT NOT NULL, cfg TEXT NOT NULL, created INTEGER NOT NULL, start_at INTEGER NOT NULL, ended INTEGER, result TEXT
);
CREATE TABLE IF NOT EXISTS rewards (
  player_id TEXT NOT NULL, tournament_id TEXT NOT NULL, rank INTEGER NOT NULL, label_ar TEXT, label_en TEXT, icon TEXT, created INTEGER NOT NULL,
  PRIMARY KEY (player_id, tournament_id)
);
`;

export function openDb(path = ':memory:') {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  const cache = new Map();
  const q = (sql) => { let s = cache.get(sql); if (!s) { s = db.prepare(sql); cache.set(sql, s); } return s; };
  return {
    raw: db,
    get: (sql, ...p) => q(sql).get(...p),
    all: (sql, ...p) => q(sql).all(...p),
    run: (sql, ...p) => q(sql).run(...p),
    tx(fn) { db.exec('BEGIN'); try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } },
    close: () => db.close(),
  };
}
