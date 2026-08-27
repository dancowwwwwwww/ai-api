import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const SITE = 'https://ai-undress.ai';
const MAIL = 'https://api.mail.tm';
const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36';

function rand(n, c = 'abcdefghijklmnopqrstuvwxyz0123456789') {
  let r = '';
  for (let i = 0; i < n; i++) r += c[Math.floor(Math.random() * c.length)];
  return r;
}

async function jp(r) { const t = await r.text(); try { return JSON.parse(t); } catch { return t; } }

function extractSession(headers) {
  const raw = headers.getSetCookie?.() || [];
  for (const c of raw) {
    const m = c.match(/auth_session=([^;]+)/);
    if (m) return m[1];
  }
  const single = headers.get?.('set-cookie');
  if (single) {
    const m = single.match(/auth_session=([^;]+)/);
    if (m) return m[1];
  }
  return null;
}

async function trpcPost(endpoint, body, session) {
  const cookie = 'NEXT_LOCALE=id' + (session ? '; auth_session=' + session : '');
  const r = await fetch(SITE + '/api/trpc/' + endpoint + '?batch=1', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': UA, origin: SITE, referer: SITE + '/id/editor?type=sex-pose', 'x-trpc-source': 'client', cookie },
    body: JSON.stringify(body)
  });
  const data = await jp(r);
  const s = extractSession(r.headers);
  return { data, session: s };
}

async function trpcGet(endpoint, input, session) {
  const cookie = 'NEXT_LOCALE=id' + (session ? '; auth_session=' + session : '');
  const qs = input ? '?batch=1&input=' + encodeURIComponent(JSON.stringify(input)) : '?batch=1';
  const r = await fetch(SITE + '/api/trpc/' + endpoint + qs, {
    headers: { 'user-agent': UA, 'x-trpc-source': 'client', cookie }
  });
  const data = await jp(r);
  const s = extractSession(r.headers);
  return { data, session: s };
}

app.get('/', (_, res) => res.json({ status: 'ok' }));

app.post('/api/signup', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email & password required' });
    const body = { '0': { json: { email, password, callbackUrl: SITE + '/auth/verify', turnstileToken: null, utmSource: null, utmMedium: null, utmCampaign: null, utmContent: null, clickId: null }, meta: { values: { turnstileToken: ['undefined'], utmSource: ['undefined'], utmMedium: ['undefined'], utmCampaign: ['undefined'], utmContent: ['undefined'], clickId: ['undefined'] } } } };
    const r = await fetch(SITE + '/api/trpc/auth.signup?batch=1', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': UA, origin: SITE, referer: SITE + '/id/auth/signup', 'x-trpc-source': 'client', cookie: 'NEXT_LOCALE=id' },
      body: JSON.stringify(body)
    });
    res.json(await jp(r));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/verify-and-login', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'token required' });

    const r = await fetch(SITE + '/api/trpc/auth.verifyToken?batch=1', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': UA, origin: SITE, 'x-trpc-source': 'client', cookie: 'NEXT_LOCALE=id' },
      body: JSON.stringify({ '0': { json: { token } } })
    });
    const data = await jp(r);

    let session = null;
    try {
      const arr = Array.isArray(data) ? data : [data];
      for (const item of arr) {
        const id = item?.result?.data?.json?.id;
        if (id && typeof id === 'string' && id.length > 10) {
          session = id;
          break;
        }
      }
    } catch {}

    if (!session) session = extractSession(r.headers);

    if (session) {
      const { data: userData } = await trpcGet('auth.user', { '0': { json: null, meta: { values: ['undefined'] } } }, session);
      return res.json({ session, user: userData });
    }

    return res.json({ session: null, verifyData: data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/mail/create', async (_, res) => {
  try {
    const dr = await fetch(MAIL + '/domains');
    const dd = await jp(dr);
    const dom = dd['hydra:member']?.find(d => d.isActive && !d.isPrivate);
    if (!dom) throw new Error('No domain');
    const addr = rand(8) + '@' + dom.domain;
    const pass = 'dancow000';
    const ar = await fetch(MAIL + '/accounts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: addr, password: pass }) });
    const ad = await jp(ar);
    if (!ad.id) throw new Error('Failed create');
    const tr = await fetch(MAIL + '/token', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: addr, password: pass }) });
    const td = await jp(tr);
    res.json({ address: addr, password: pass, token: td.token });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/mail/wait', async (req, res) => {
  try {
    const { token, attempts = 20, interval = 3000 } = req.body;
    if (!token) return res.status(400).json({ error: 'token required' });
    for (let i = 0; i < attempts; i++) {
      await new Promise(r => setTimeout(r, interval));
      const mr = await fetch(MAIL + '/messages', { headers: { authorization: 'Bearer ' + token } });
      const md = await jp(mr);
      const msgs = md['hydra:member'] || [];
      if (!msgs.length) continue;
      const latest = msgs[msgs.length - 1];
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

app.post('/api/upload-url', async (req, res) => {
  try {
    const { path, session } = req.body;
    if (!path || !session) return res.status(400).json({ error: 'path & session required' });
    const { data, session: s } = await trpcPost('uploads.signedUploadUrl', { '0': { json: { path } } }, session);
    res.json({ data, session: s });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/upload-image', async (req, res) => {
  try {
    const { url, imageData, contentType } = req.body;
    if (!url || !imageData) return res.status(400).json({ error: 'url & imageData required' });
    const buffer = Buffer.from(imageData, 'base64');
    const r = await fetch(url, { method: 'PUT', headers: { 'Content-Type': contentType || 'image/png', 'Origin': SITE, 'Referer': SITE + '/' }, body: buffer });
    res.json({ success: r.ok, status: r.status });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/create-material', async (req, res) => {
  try {
    const { url, format, session } = req.body;
    if (!url || !format) return res.status(400).json({ error: 'url & format required' });
    const { data, session: s } = await trpcPost('material.createMaterial', { '0': { json: { url, format } } }, session);
    res.json({ data, session: s });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/run-task', async (req, res) => {
  try {
    const { taskData, session } = req.body;
    const { data, session: s } = await trpcPost('workflow.runTask', { '0': { json: taskData } }, session);
    res.json({ data, session: s });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/task-result', async (req, res) => {
  try {
    const { session } = req.body;
    const { data, session: s } = await trpcPost('workflow.getOrderTaskResult', { '0': { json: {} } }, session);
    res.json({ data, session: s });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('API running on port ' + PORT));