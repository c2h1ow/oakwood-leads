const express = require('express');
const crypto = require('crypto');
const { getDb } = require('../database');
const { detectPackage } = require('../packageDetector');
const { sendNewLeadNotification } = require('../mailer');

const router = express.Router();

// LINE signature verification middleware
function verifyLineSignature(req, res, next) {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) return next(); // skip in dev if not configured

  const signature = req.headers['x-line-signature'];
  if (!signature) return res.status(401).json({ error: 'Missing signature' });

  const body = JSON.stringify(req.body);
  const hash = crypto.createHmac('SHA256', secret).update(body).digest('base64');
  if (hash !== signature) return res.status(401).json({ error: 'Invalid signature' });

  next();
}

router.post('/webhook', verifyLineSignature, async (req, res) => {
  // Acknowledge immediately — LINE requires fast 200
  res.status(200).json({ status: 'ok' });

  const events = req.body.events || [];
  for (const event of events) {
    try {
      if (event.type !== 'message' || event.message?.type !== 'text') continue;

      const senderId = event.source?.userId || 'unknown';
      const messageText = event.message.text || '';
      const timestamp = event.timestamp
        ? new Date(event.timestamp).toISOString().replace('T', ' ').substring(0, 19)
        : new Date().toISOString().replace('T', ' ').substring(0, 19);

      let displayName = 'LINE User';
      if (process.env.LINE_CHANNEL_ACCESS_TOKEN && senderId !== 'unknown') {
        try {
          const axios = require('axios');
          const profileRes = await axios.get(
            `https://api.line.me/v2/bot/profile/${senderId}`,
            { headers: { Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` } }
          );
          displayName = profileRes.data.displayName || displayName;
        } catch (e) {
          console.warn('[LINE] Could not fetch profile:', e.message);
        }
      }

      const packageInterest = detectPackage(messageText);
      const db = getDb();
      const result = db.prepare(`
        INSERT INTO leads (name, channel, sender_id, message, package_interest, created_at)
        VALUES (?, 'LINE', ?, ?, ?, ?)
      `).run([displayName, senderId, messageText, packageInterest, timestamp]);

      const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get([result.lastInsertRowid]);
      console.log(`[LINE] New lead #${lead.id} from ${displayName}`);
      sendNewLeadNotification(lead);
    } catch (err) {
      console.error('[LINE] Event processing error:', err.message);
    }
  }
});

module.exports = router;
