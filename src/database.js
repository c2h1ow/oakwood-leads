const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leads (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      channel TEXT NOT NULL,
      phone TEXT DEFAULT NULL,
      sender_id TEXT,
      message TEXT NOT NULL DEFAULT '',
      package_interest TEXT DEFAULT NULL,
      checkin_date TEXT DEFAULT NULL,
      nights INTEGER DEFAULT NULL,
      status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new', 'follow-up', 'booked', 'lost')),
      agent TEXT DEFAULT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_leads_channel ON leads(channel)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status)`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS packages (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    INSERT INTO packages (name) VALUES
      ('Room'),('Long Stay'),('Sunday Brunch'),('บุฟเฟต์ตลาดน้ำ'),('บุฟเฟต์อาหารเช้า'),
      ('Medical Stay'),('Meeting Room'),('บุฟเฟต์ข้าวต้ม'),('Friday Sky Cozy'),('Run for Breakfast')
    ON CONFLICT (name) DO NOTHING
  `);
  console.log('[DB] PostgreSQL schema ready');
}

initSchema().catch(err => console.error('[DB] Schema init error:', err));

module.exports = { pool };
