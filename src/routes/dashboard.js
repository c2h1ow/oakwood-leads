const express = require('express');
const { getDb } = require('../database');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const db = getDb();

    const totalToday = db.prepare(
      `SELECT COUNT(*) as count FROM leads WHERE date(created_at) = date('now', 'localtime')`
    ).get([]).count;

    const byChannel = db.prepare(
      `SELECT channel, COUNT(*) as count FROM leads GROUP BY channel`
    ).all([]);

    const byPackage = db.prepare(
      `SELECT COALESCE(package_interest, 'Unknown') as package, COUNT(*) as count
       FROM leads GROUP BY package_interest ORDER BY count DESC`
    ).all([]);

    const byStatus = db.prepare(
      `SELECT status, COUNT(*) as count FROM leads GROUP BY status`
    ).all([]);

    const totalLeads  = db.prepare(`SELECT COUNT(*) as count FROM leads`).get([]).count;
    const bookedLeads = db.prepare(`SELECT COUNT(*) as count FROM leads WHERE status = 'booked'`).get([]).count;
    const conversionRate = totalLeads > 0 ? Math.round((bookedLeads / totalLeads) * 100) : 0;

    const leads = db.prepare(`SELECT * FROM leads ORDER BY created_at DESC LIMIT 100`).all([]);

    res.render('dashboard', {
      totalToday, byChannel, byPackage, byStatus,
      totalLeads, bookedLeads, conversionRate, leads,
    });
  } catch (err) {
    console.error('[Dashboard]', err);
    res.status(500).send('Dashboard error: ' + err.message);
  }
});

// Manual lead creation
router.post('/leads', (req, res) => {
  const { name, phone, channel, package_interest, checkin_date, nights, message } = req.body;

  const validChannels = ['LINE', 'Facebook', 'Walk-in', 'Phone'];
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
  if (!validChannels.includes(channel)) return res.status(400).json({ error: 'Invalid channel' });

  try {
    const db = getDb();
    const result = db.prepare(`
      INSERT INTO leads (name, phone, channel, sender_id, message, package_interest, checkin_date, nights, status)
      VALUES (?, ?, ?, 'manual', ?, ?, ?, ?, 'new')
    `).run([
      name.trim(),
      phone ? phone.trim() : null,
      channel,
      message ? message.trim() : '',
      package_interest || null,
      checkin_date || null,
      nights ? parseInt(nights) : null,
    ]);
    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get([result.lastInsertRowid]);
    res.json({ ok: true, lead });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update lead status
router.post('/leads/:id/status', (req, res) => {
  const validStatuses = ['new', 'follow-up', 'booked', 'lost'];
  const { status } = req.body;
  const { id } = req.params;

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const db = getDb();
    db.prepare('UPDATE leads SET status = ? WHERE id = ?').run([status, id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update lead details (checkin, nights, package)
router.post('/leads/:id/details', (req, res) => {
  const { checkin_date, nights, package_interest } = req.body;
  const { id } = req.params;

  try {
    const db = getDb();
    db.prepare(`UPDATE leads SET checkin_date = ?, nights = ?, package_interest = ? WHERE id = ?`)
      .run([checkin_date || null, nights ? parseInt(nights) : null, package_interest || null, id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: leads JSON
router.get('/api/leads', (req, res) => {
  const db = getDb();
  const leads = db.prepare('SELECT * FROM leads ORDER BY created_at DESC').all([]);
  res.json(leads);
});

module.exports = router;
