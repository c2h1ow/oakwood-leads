const express = require('express');
const { getDb } = require('../database');
const { detectPackage } = require('../packageDetector');
const { sendNewLeadNotification } = require('../mailer');

const router = express.Router();

// Facebook webhook verification (GET)
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.FB_VERIFY_TOKEN) {
    console.log('[Facebook] Webhook verified');
    return res.status(200).send(challenge);
  }
  res.status(403).json({ error: 'Forbidden' });
});

// Facebook webhook events (POST)
router.post('/webhook', async (req, res) => {
  res.status(200).json({ status: 'ok' });

  const body = req.body;
  if (body.object !== 'page') return;

  for (const entry of body.entry || []) {
    for (const event of entry.messaging || []) {
      try {
        if (!event.message?.text) continue;

        const senderId = event.sender?.id || 'unknown';
        const messageText = event.message.text || '';
        const timestamp = event.timestamp
          ? new Date(event.timestamp).toISOString().replace('T', ' ').substring(0, 19)
          : new Date().toISOString().replace('T', ' ').substring(0, 19);

        let displayName = 'Facebook User';
        if (process.env.FB_PAGE_ACCESS_TOKEN && senderId !== 'unknown') {
          try {
            const axios = require('axios');
            const profileRes = await axios.get(
              `https://graph.facebook.com/${senderId}`,
              { params: { fields: 'name', access_token: process.env.FB_PAGE_ACCESS_TOKEN } }
            );
            displayName = profileRes.data.name || displayName;
          } catch (e) {
            console.warn('[Facebook] Could not fetch profile:', e.message);
          }
        }

        const packageInterest = detectPackage(messageText);
        const db = getDb();
        const result = db.prepare(`
          INSERT INTO leads (name, channel, sender_id, message, package_interest, created_at)
          VALUES (?, 'Facebook', ?, ?, ?, ?)
        `).run([displayName, senderId, messageText, packageInterest, timestamp]);

        const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get([result.lastInsertRowid]);
        console.log(`[Facebook] New lead #${lead.id} from ${displayName}`);
        sendNewLeadNotification(lead);
      } catch (err) {
        console.error('[Facebook] Event processing error:', err.message);
      }
    }
  }
});

module.exports = router;
