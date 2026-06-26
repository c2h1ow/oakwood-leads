const nodemailer = require('nodemailer');

let transporter;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }
  return transporter;
}

async function sendNewLeadNotification(lead) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD || !process.env.TEAM_EMAIL) {
    console.log('[Mailer] Email config missing — skipping notification');
    return;
  }

  const packageLine = lead.package_interest
    ? `<tr><td style="padding:4px 8px;color:#666">Package</td><td style="padding:4px 8px;font-weight:600;color:#1B2A4A">${lead.package_interest}</td></tr>`
    : '';

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;border:1px solid #e0d9cc;border-radius:8px;overflow:hidden">
      <div style="background:#1B2A4A;padding:20px 24px">
        <h2 style="margin:0;color:#C9A84C;font-size:18px">Oakwood Suites Tiwanon</h2>
        <p style="margin:4px 0 0;color:#fff;font-size:13px">New Lead Notification</p>
      </div>
      <div style="padding:20px 24px;background:#fff">
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:4px 8px;color:#666">Name</td><td style="padding:4px 8px;font-weight:600;color:#1B2A4A">${escHtml(lead.name)}</td></tr>
          <tr style="background:#f8f5f0"><td style="padding:4px 8px;color:#666">Channel</td><td style="padding:4px 8px">${lead.channel}</td></tr>
          ${packageLine}
          <tr style="background:#f8f5f0"><td style="padding:4px 8px;color:#666;vertical-align:top">Message</td><td style="padding:4px 8px">${escHtml(lead.message)}</td></tr>
          <tr><td style="padding:4px 8px;color:#666">Time</td><td style="padding:4px 8px">${lead.created_at}</td></tr>
        </table>
      </div>
      <div style="padding:12px 24px;background:#f8f5f0;font-size:12px;color:#999;text-align:center">
        Oakwood Leads Dashboard · Auto-generated notification
      </div>
    </div>
  `;

  try {
    await getTransporter().sendMail({
      from: `"Oakwood Leads" <${process.env.GMAIL_USER}>`,
      to: process.env.TEAM_EMAIL,
      subject: `[New Lead] ${lead.channel} — ${lead.name}${lead.package_interest ? ' · ' + lead.package_interest : ''}`,
      html,
    });
    console.log(`[Mailer] Notification sent for lead #${lead.id}`);
  } catch (err) {
    console.error('[Mailer] Failed to send notification:', err.message);
  }
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { sendNewLeadNotification };
