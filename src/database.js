const { Database } = require('node-sqlite3-wasm');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'leads.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      channel TEXT NOT NULL CHECK(channel IN ('LINE', 'Facebook')),
      sender_id TEXT,
      message TEXT NOT NULL,
      package_interest TEXT DEFAULT NULL,
      checkin_date TEXT DEFAULT NULL,
      nights INTEGER DEFAULT NULL,
      status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new', 'follow-up', 'booked', 'lost')),
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
    CREATE INDEX IF NOT EXISTS idx_leads_channel ON leads(channel);
    CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
  `);
}

module.exports = { getDb };
