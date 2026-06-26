// Quick smoke-test: injects sample leads via webhook
const http = require('http');
const crypto = require('crypto');

function post(path, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(JSON.stringify(body), 'utf8');
    const req = http.request({
      hostname: 'localhost', port: 3000, method: 'POST', path,
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length, ...extraHeaders },
    }, res => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => resolve({ status: res.statusCode, body: buf }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(path) {
  return new Promise((resolve, reject) => {
    http.get({ hostname: 'localhost', port: 3000, path }, res => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => resolve({ status: res.statusCode, body: buf }));
    }).on('error', reject);
  });
}

async function run() {
  // 1. Dashboard
  const dash = await get('/');
  console.log(`Dashboard GET → ${dash.status}`);

  // 2. Facebook lead
  const fbPayload = {
    object: 'page',
    entry: [{ messaging: [{ sender: { id: 'FB001' }, message: { text: 'long stay 7 คืน ราคาเท่าไหร่คะ' }, timestamp: 1700000000000 }] }],
  };
  const fb = await post('/facebook/webhook', fbPayload);
  console.log(`Facebook webhook → ${fb.status}: ${fb.body}`);

  await new Promise(r => setTimeout(r, 300));

  // 3. LINE lead (properly signed)
  const linePayload = {
    events: [{
      type: 'message',
      message: { type: 'text', text: 'สนใจห้องพัก 2880 executive corner ครับ' },
      source: { userId: 'Utest001' },
      timestamp: 1700000000000,
    }],
  };
  const lineBody = Buffer.from(JSON.stringify(linePayload), 'utf8');
  const sig = crypto.createHmac('SHA256', 'your_line_channel_secret').update(lineBody).digest('base64');
  const line = await post('/line/webhook', linePayload, { 'x-line-signature': sig });
  console.log(`LINE webhook    → ${line.status}: ${line.body}`);

  await new Promise(r => setTimeout(r, 300));

  // 4. Another Facebook (Stay 24hr)
  const fb2Payload = {
    object: 'page',
    entry: [{ messaging: [{ sender: { id: 'FB002' }, message: { text: 'มีห้อง 1990 บาท 24 ชม ไหมคะ' }, timestamp: 1700000001000 }] }],
  };
  const fb2 = await post('/facebook/webhook', fb2Payload);
  console.log(`Facebook #2     → ${fb2.status}`);

  await new Promise(r => setTimeout(r, 300));

  // 5. Check leads via API
  const api = await get('/api/leads');
  const leads = JSON.parse(api.body);
  console.log(`\nLeads in DB: ${leads.length}`);
  leads.forEach(l => console.log(`  [${l.channel}] ${l.name} | ${l.package_interest || '—'} | ${l.message.substring(0, 40)}`));
}

run().catch(console.error);
