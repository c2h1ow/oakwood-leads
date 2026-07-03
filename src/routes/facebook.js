const express = require('express');
const { pool } = require('../database');
const { detectPackage } = require('../packageDetector');
const { sendNewLeadNotification } = require('../mailer');

const router = express.Router();

// Map Facebook Page ID to channel name and access token env key
const PAGE_CONFIG = {
  '101784308841171': { channel: 'Facebook - Oakwood', tokenEnv: 'FB_PAGE_ACCESS_TOKEN_OAKWOOD' },
  '105356442595865': { channel: 'Facebook - Charm',   tokenEnv: 'FB_PAGE_ACCESS_TOKEN_CHARM' },
  '103055966004414': { channel: 'Facebook - Zodiac',  tokenEnv: 'FB_PAGE_ACCESS_TOKEN_ZODIAC' },
};

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
    const pageId = String(entry.id);
    const config = PAGE_CONFIG[pageId];
    const channelName = config ? config.channel : 'Facebook - Oakwood';
    const accessToken = config ? process.env[config.tokenEnv] : process.env.FB_PAGE_ACCESS_TOKEN_OAKWOOD;

    for (const event of entry.messaging || []) {
      try {
        if (!event.message?.text) continue;

        const senderId = event.sender?.id || 'unknown';
        const messageText = event.message.text || '';

        // Skip duplicate
        const existing = await pool.query(
          `SELECT id FROM leads WHERE sender_id = $1 AND channel = $2 LIMIT 1`,
          [senderId, channelName]
        );
        if (existing.rows.length > 0) continue;

        let displayName = 'Facebook User';
        if (accessToken && senderId !== 'unknown') {
          try {
            const axios = require('axios');
            const profileRes = await axios.get(
              `https://graph.facebook.com/${senderId}`,
              { params: { fields: 'name', access_token: accessToken } }
            );
            displayName = profileRes.data.name || displayName;
          } catch (e) {
            console.warn(`[Facebook] Could not fetch profile (${channelName}):`, e.message);
          }
        }

        const packageInterest = detectPackage(messageText);
        const result = await pool.query(`
          INSERT INTO leads (name, channel, sender_id, message, package_interest)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING *
        `, [displayName, channelName, senderId, messageText, packageInterest]);

        const lead = result.rows[0];
        console.log(`[Facebook] New lead #${lead.id} from ${displayName} via ${channelName}`);
        sendNewLeadNotification(lead);
      } catch (err) {
        console.error(`[Facebook] Event processing error (${channelName}):`, err.message);
      }
    }
  }
});

module.exports = router;
