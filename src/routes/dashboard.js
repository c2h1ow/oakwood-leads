const express = require('express');
const { pool } = require('../database');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { from, to } = req.query;
    const dateFilter = from && to
      ? `AND (created_at AT TIME ZONE 'Asia/Bangkok')::date BETWEEN $1 AND $2`
      : '';
    const dateParams = from && to ? [from, to] : [];

    const rangeQuery = from && to
      ? pool.query(`SELECT COUNT(*) as count, channel FROM leads WHERE 1=1 ${dateFilter} GROUP BY channel`, dateParams)
      : Promise.resolve({ rows: [] });

    const [
      todayRes, byChannelRes, byPackageRes, byStatusRes,
      totalRes, bookedRes, leadsRes, byHourRes, rangeRes
    ] = await Promise.all([
      pool.query(`SELECT COUNT(*) as count FROM leads WHERE created_at::date = CURRENT_DATE`),
      pool.query(`SELECT channel, COUNT(*) as count FROM leads GROUP BY channel`),
      pool.query(`SELECT COALESCE(package_interest, 'Unknown') as package, COUNT(*) as count FROM leads GROUP BY package_interest ORDER BY count DESC`),
      pool.query(`SELECT status, COUNT(*) as count FROM leads GROUP BY status`),
      pool.query(`SELECT COUNT(*) as count FROM leads`),
      pool.query(`SELECT COUNT(*) as count FROM leads WHERE status = 'booked'`),
      from && to
        ? pool.query(`SELECT * FROM leads WHERE (created_at AT TIME ZONE 'Asia/Bangkok')::date BETWEEN $1 AND $2 ORDER BY created_at DESC`, [from, to])
        : pool.query(`SELECT * FROM leads ORDER BY created_at DESC LIMIT 100`),
      pool.query(`SELECT EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Bangkok') as hour, COUNT(*) as count FROM leads GROUP BY hour ORDER BY hour`),
      rangeQuery,
    ]);

    const totalToday = parseInt(todayRes.rows[0].count);
    const byChannel = byChannelRes.rows;
    const byPackage = byPackageRes.rows;
    const byStatus = byStatusRes.rows;
    const totalLeads = parseInt(totalRes.rows[0].count);
    const bookedLeads = parseInt(bookedRes.rows[0].count);
    const conversionRate = totalLeads > 0 ? Math.round((bookedLeads / totalLeads) * 100) : 0;
    const leads = leadsRes.rows;
    const byHour = Array.from({length: 24}, (_, h) => {
      const row = byHourRes.rows.find(r => parseInt(r.hour) === h);
      return { hour: h, count: row ? parseInt(row.count) : 0 };
    });
    const rangeFrom = from || '';
    const rangeTo = to || '';
    const rangeTotal = rangeRes.rows.reduce((s, r) => s + parseInt(r.count), 0);
    const rangeByChannel = rangeRes.rows;

    res.render('dashboard', {
      totalToday, byChannel, byPackage, byStatus,
      totalLeads, bookedLeads, conversionRate, leads, byHour,
      rangeFrom, rangeTo, rangeTotal, rangeByChannel,
    });
  } catch (err) {
    console.error('[Dashboard]', err);
    res.status(500).send('Dashboard error: ' + err.message);
  }
});

// Manual lead creation
router.post('/leads', async (req, res) => {
  const { name, phone, channel, package_interest, checkin_date, nights, message, agent } = req.body;

  const validChannels = ['Facebook - Oakwood', 'Facebook - Charm', 'Facebook - Zodiac', 'Line - Oakwood', 'Line - Charm', 'Telephone', 'Walk-in'];
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
  if (!validChannels.includes(channel)) return res.status(400).json({ error: 'Invalid channel' });
  if (!agent || !agent.trim()) return res.status(400).json({ error: 'Agent is required' });

  try {
    const result = await pool.query(`
      INSERT INTO leads (name, phone, channel, sender_id, message, package_interest, checkin_date, nights, status, agent)
      VALUES ($1, $2, $3, 'manual', $4, $5, $6, $7, 'new', $8)
      RETURNING *
    `, [
      name.trim(),
      phone ? phone.trim() : null,
      channel,
      message ? message.trim() : '',
      package_interest || null,
      checkin_date || null,
      nights ? parseInt(nights) : null,
      agent.trim(),
    ]);
    res.json({ ok: true, lead: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update lead status
router.post('/leads/:id/status', async (req, res) => {
  const validStatuses = ['new', 'follow-up', 'booked', 'lost'];
  const { status } = req.body;
  const { id } = req.params;

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    await pool.query('UPDATE leads SET status = $1 WHERE id = $2', [status, id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update lead details (checkin, nights, package)
router.post('/leads/:id/details', async (req, res) => {
  const { checkin_date, nights, package_interest } = req.body;
  const { id } = req.params;

  try {
    await pool.query(
      `UPDATE leads SET checkin_date = $1, nights = $2, package_interest = $3 WHERE id = $4`,
      [checkin_date || null, nights ? parseInt(nights) : null, package_interest || null, id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Edit lead (full update)
router.put('/leads/:id', async (req, res) => {
  const { name, phone, channel, package_interest, checkin_date, nights, message, agent } = req.body;
  const { id } = req.params;
  const validChannels = ['Facebook - Oakwood', 'Facebook - Charm', 'Facebook - Zodiac', 'Line - Oakwood', 'Line - Charm', 'Telephone', 'Walk-in'];

  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
  if (!validChannels.includes(channel)) return res.status(400).json({ error: 'Invalid channel' });
  if (!agent || !agent.trim()) return res.status(400).json({ error: 'Agent is required' });

  try {
    await pool.query(`
      UPDATE leads SET name=$1, phone=$2, channel=$3, package_interest=$4,
        checkin_date=$5, nights=$6, message=$7, agent=$8
      WHERE id=$9
    `, [
      name.trim(),
      phone ? phone.trim() : null,
      channel,
      package_interest || null,
      checkin_date || null,
      nights ? parseInt(nights) : null,
      message ? message.trim() : '',
      agent.trim(),
      id,
    ]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete lead
router.delete('/leads/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM leads WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export leads as CSV
router.get('/export', async (req, res) => {
  const { from, to } = req.query;
  let rows;
  if (from && to) {
    const result = await pool.query(
      `SELECT * FROM leads WHERE (created_at AT TIME ZONE 'Asia/Bangkok')::date BETWEEN $1 AND $2 ORDER BY created_at DESC`,
      [from, to]
    );
    rows = result.rows;
  } else {
    const result = await pool.query(`SELECT * FROM leads ORDER BY created_at DESC`);
    rows = result.rows;
  }

  const fmtDate = d => {
    const dt = new Date(new Date(d).toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
    const dd = String(dt.getDate()).padStart(2,'0');
    const mm = String(dt.getMonth()+1).padStart(2,'0');
    const yyyy = dt.getFullYear();
    const hh = String(dt.getHours()).padStart(2,'0');
    const min = String(dt.getMinutes()).padStart(2,'0');
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
  };

  const escape = v => `"${String(v || '').replace(/"/g, '""')}"`;
  const headers = ['#','Received','Name','Phone','Channel','Package','Message','Check-in','Nights','Status','Agent'];
  const csvRows = rows.map(r => [
    r.id, fmtDate(r.created_at), r.name, r.phone||'', r.channel,
    r.package_interest||'', r.message||'', r.checkin_date||'', r.nights||'', r.status, r.agent||''
  ].map(escape).join(','));

  const csv = '﻿' + [headers.join(','), ...csvRows].join('\r\n');
  const filename = from && to ? `leads_${from}_to_${to}.csv` : `leads_all.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
});

// API: leads JSON
router.get('/api/leads', async (req, res) => {
  const result = await pool.query('SELECT * FROM leads ORDER BY created_at DESC');
  res.json(result.rows);
});

module.exports = router;
