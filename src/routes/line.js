const express = require('express');
const crypto = require('crypto');
const { pool } = require('../database');
const { detectPackage } = require('../packageDetector');
const { sendNewLeadNotification } = require('../mailer');

const router = express.Router();

function makeVerifySignature(secretEnvKey) {
  return function (req, res, next) {
    const secret = process.env[secretEnvKey];
    if (!secret) return next();

    const signature = req.headers['x-line-signature'];
    if (!signature) return res.status(401).json({ error: 'Missing signature' });

    const body = JSON.stringify(req.body);
    const hash = crypto.createHmac('SHA256', secret).update(body).digest('base64');
    if (hash !== signature) return res.status(401).json({ error: 'Invalid signature' });

    next();
  };
}

async function handleLineEvents(events, channelName, accessTokenEnvKey) {
  for (const event of events) {
    try {
      if (event.type !== 'message' || event.message?.type !== 'text') continue;

      const senderId = event.source?.userId || 'unknown';
      const messageText = event.message.text || '';

      // Skip if lead from this sender already exists on this channel
      const existing = await pool.query(
        `SELECT id FROM leads WHERE sender_id = $1 AND channel = $2 LIMIT 1`,
        [senderId, channelName]
      );
      if (existing.rows.length > 0) {
        console.log(`[LINE] Skipping duplicate lead from ${senderId} (${channelName})`);
        continue;
      }

      let displayName = 'LINE User';
      const accessToken = process.env[accessTokenEnvKey];
      if (accessToken && senderId !== 'unknown') {
        try {
          const axios = require('axios');
          const profileRes = await axios.get(
            `https://api.line.me/v2/bot/profile/${senderId}`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          displayName = profileRes.data.displayName || displayName;
        } catch (e) {
          console.warn(`[LINE] Could not fetch profile (${channelName}):`, e.message);
        }
      }

      const packageInterest = detectPackage(messageText);
      const result = await pool.query(`
        INSERT INTO leads (name, channel, sender_id, message, package_interest)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [displayName, channelName, senderId, messageText, packageInterest]);

      const lead = result.rows[0];
      console.log(`[LINE] New lead #${lead.id} from ${displayName} via ${channelName}`);
      sendNewLeadNotification(lead);
    } catch (err) {
      console.error(`[LINE] Event processing error (${channelName}):`, err.message);
    }
  }
}

// Oakwood Tiwanon LINE OA
router.post('/webhook', makeVerifySignature('LINE_CHANNEL_SECRET'), async (req, res) => {
  res.status(200).json({ status: 'ok' });
  await handleLineEvents(req.body.events || [], 'Line - Oakwood', 'LINE_CHANNEL_ACCESS_TOKEN');
});

// Charm Cuisine LINE OA
router.post('/webhook-charm', makeVerifySignature('LINE_CHARM_CHANNEL_SECRET'), async (req, res) => {
  res.status(200).json({ status: 'ok' });
  await handleLineEvents(req.body.events || [], 'Line - Charm', 'LINE_CHARM_CHANNEL_ACCESS_TOKEN');
});

module.exports = router;
