const { Database } = require('node-sqlite3-wasm');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'leads.db');
const LOCK_PATH = DB_PATH + '.lock';

// node-sqlite3-wasm uses a .lock directory; remove stale one on startup
try { fs.rmdirSync(LOCK_PATH); } catch (_) {}

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    initSchema();
  }
  return db;
}

function initSchema() {
  // Create table on first run
  db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      channel TEXT NOT NULL CHECK(channel IN ('LINE', 'Facebook', 'Walk-in', 'Phone')),
      phone TEXT DEFAULT NULL,
      sender_id TEXT,
      message TEXT NOT NULL,
      package_interest TEXT DEFAULT NULL,
      checkin_date TEXT DEFAULT NULL,
      nights INTEGER DEFAULT NULL,
      status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new', 'follow-up', 'booked', 'lost')),
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // Migration v2: widen channel CHECK to include Walk-in / Phone, add phone column.
  // SQLite can't ALTER a CHECK constraint, so we recreate the table if needed.
  const tableSql = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='leads'`).get([]).sql;
  const needsRebuild = !tableSql.includes('Walk-in');

  if (needsRebuild) {
    db.exec(`ALTER TABLE leads RENAME TO leads_old`);
    db.exec(`
      CREATE TABLE leads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        channel TEXT NOT NULL CHECK(channel IN ('LINE', 'Facebook', 'Walk-in', 'Phone')),
        phone TEXT DEFAULT NULL,
        sender_id TEXT,
        message TEXT NOT NULL,
        package_interest TEXT DEFAULT NULL,
        checkin_date TEXT DEFAULT NULL,
        nights INTEGER DEFAULT NULL,
        status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new', 'follow-up', 'booked', 'lost')),
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      )
    `);
    db.exec(`
      INSERT INTO leads (id,name,channel,sender_id,message,package_interest,checkin_date,nights,status,created_at)
        SELECT id,name,channel,sender_id,message,package_interest,checkin_date,nights,status,created_at FROM leads_old
    `);
    db.exec(`DROP TABLE leads_old`);
    console.log('[DB] Migrated to v2 (Walk-in/Phone channels + phone column)');
  }

  // Migration v3: add agent column
  const cols = db.prepare(`PRAGMA table_info(leads)`).all([]).map(r => r.name);
  if (!cols.includes('agent')) {
    db.exec(`ALTER TABLE leads ADD COLUMN agent TEXT DEFAULT NULL`);
    console.log('[DB] Migrated to v3 (agent column)');
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
    CREATE INDEX IF NOT EXISTS idx_leads_channel ON leads(channel);
    CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
  `);
}

module.exports = { getDb };
