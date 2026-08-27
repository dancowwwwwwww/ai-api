import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const SITE = 'https://ai-undress.ai';
const MAIL = 'https://api.mail.tm';
const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36';

function rand(n, c = 'abcdefghijklmnopqrstuvwxyz0123456789') {
  let r = '';
  for (let i = 0; i < n; i++) r += c[Math.floor(Math.random() * c.length)];
  return r;
}

async function jp(r) {
  const t = await r.text();
  try { return JSON.parse(t); } catch { throw new Error('Invalid JSON'); }
}

app.get('/', (_, res) => res.json({ status: 'ok' }));

app.post('/api/signup', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email & password required' });
    const body = {
      '0': {
        json: { email, password, callbackUrl: SITE + '/auth/verify', turnstileToken: null, utmSource: null, utmMedium: null, utmCampaign: null, utmContent: null, clickId: null },
        meta: { values: { turnstileToken: ['undefined'], utmSource: ['undefined'], utmMedium: ['undefined'], utmCampaign: ['undefined'], utmContent: ['undefined'], clickId: ['undefined'] } }
      }
    };
    const r = await fetch(SITE + '/api/trpc/auth.signup?batch=1', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': UA, origin: SITE, referer: SITE + '/id/auth/signup', 'x-trpc-source': 'client', cookie: 'NEXT_LOCALE=id' },
      body: JSON.stringify(body)
    });
    res.json(await jp(r));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/verify', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'token required' });
    const body = { '0': { json: { token }, meta: { values: { token: ['undefined'] } } } };
    const r = await fetch(SITE + '/api/trpc/auth.verifyToken?batch=1', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': UA, origin: SITE, 'x-trpc-source': 'client', cookie: 'NEXT_LOCALE=id' },
      body: JSON.stringify(body)
    });
    res.json(await jp(r));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/user', async (_, res) => {
  try {
    const input = encodeURIComponent(JSON.stringify({ '0': { json: null, meta: { values: ['undefined'] } } }));
    const r = await fetch(SITE + '/api/trpc/auth.user?batch=1&input=' + input, {
      headers: { 'user-agent': UA, 'x-trpc-source': 'client', cookie: 'NEXT_LOCALE=id' }
    });
    res.json(await jp(r));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/mail/create', async (_, res) => {
  try {
    const dr = await fetch(MAIL + '/domains');
    const dd = await jp(dr);
    const dom = dd['hydra:member']?.find(d => d.isActive && !d.isPrivate);
    if (!dom) throw new Error('No domain');
    const addr = rand(8) + '@' + dom.domain;
    const pass = rand(12);
    const ar = await fetch(MAIL + '/accounts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ address: addr, password: pass })
    });
    const ad = await jp(ar);
    if (!ad.id) throw new Error('Failed create');
    const tr = await fetch(MAIL + '/token', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ address: addr, password: pass })
    });
    const td = await jp(tr);
    res.json({ address: addr, password: pass, token: td.token });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/mail/wait', async (req, res) => {
  try {
    const { token, attempts = 12, interval = 5000 } = req.body;
    if (!token) return res.status(400).json({ error: 'token required' });
    let lastId = null;
    for (let i = 0; i < attempts; i++) {
      await new Promise(r => setTimeout(r, interval));
      const mr = await fetch(MAIL + '/messages', { headers: { authorization: 'Bearer ' + token } });
      const md = await jp(mr);
      const msgs = md['hydra:member'] || [];
      if (!msgs.length) continue;
      const latest = msgs[0];
      if (latest.id === lastId) continue;
      lastId = latest.id;
      const dr = await fetch(MAIL + '/messages/' + latest.id, { headers: { authorization: 'Bearer ' + token } });
      const det = await jp(dr);
      const body = det.text || det.intro || '';
      const full = (det.subject || '') + ' ' + body;
      const m1 = full.match(/verify\?token=([^&"'\s]+)/i);
      const m2 = full.match(/token[=:]([a-z0-9]{20,})/i);
      const vToken = m1 ? m1[1] : m2 ? m2[1] : null;
      if (vToken) return res.json({ token: vToken, subject: det.subject });
    }
    res.status(408).json({ error: 'Timeout' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('API running on port ' + PORT));