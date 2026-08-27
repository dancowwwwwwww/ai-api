const API = 'https://ai-api-production-12f9.up.railway.app';

async function ensureSession() {
  const mailRes = await fetch(API + '/api/mail/create', { method: 'POST' });
  const mail = await mailRes.json();
  if (mail.error) throw new Error(mail.error);

  const signupRes = await fetch(API + '/api/signup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: mail.address, password: 'dancow000' })
  });
  await signupRes.json();

  const waitRes = await fetch(API + '/api/mail/wait', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: mail.token })
  });
  const wait = await waitRes.json();
  if (wait.error) throw new Error(wait.error);

  const verifyRes = await fetch(API + '/api/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: wait.token })
  });
  await verifyRes.json();

  return { email: mail.address, password: 'dancow000' };
}

async function processImage(session, imageBuffer) {
  const path = 'materials/' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 10) + '.png';

  const urlRes = await fetch(API + '/api/upload-url', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path, session })
  });
  const urlData = await urlRes.json();
  const uploadUrl = urlData?.[0]?.result?.data?.json;
  if (!uploadUrl) throw new Error('Gagal get upload URL');

  const uploadRes = await fetch(API + '/api/upload-image', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: uploadUrl, imageData: imageBuffer.toString('base64'), contentType: 'image/png' })
  });
  const uploadData = await uploadRes.json();
  if (!uploadData.success) throw new Error('Gagal upload image');

  const cdnUrl = 'https://cdn.treekee.com/ai-undress/' + path;

  const materialRes = await fetch(API + '/api/create-material', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      materialData: { path },
      session
    })
  });
  const materialData = await materialRes.json();
  const material = materialData?.[0]?.result?.data?.json;
  if (!material) throw new Error('Gagal create material');

  const taskRes = await fetch(API + '/api/run-task', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      taskData: {
        materialId: material.materialId,
        featureType: 'f1_undress_effects'
      },
      session
    })
  });
  const taskData = await taskRes.json();
  const taskId = taskData?.[0]?.result?.data?.json?.taskId;
  if (!taskId) throw new Error('Gagal run task');

  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const resultRes = await fetch(API + '/api/task-result', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session })
    });
    const result = await resultRes.json();
    const data = result?.[0]?.result?.data?.json;
    if (data?.status === 'COMPLETED' && data?.result_url) {
      return data.result_url;
    }
    if (data?.status === 'FAILED') throw new Error('Task failed');
  }
  throw new Error('Timeout menunggu hasil');
}

const handler = async (m, { conn }) => {
  const quoted = m.quoted || m;
  const isImage = quoted.message?.imageMessage || m.message?.imageMessage;

  if (!isImage) {
    return m.reply('Reply/kirim foto!');
  }

  try {
    await m.reply('Sedang mengedit aiundress...');

    const { email, password } = await ensureSession();

    const userRes = await fetch(API + '/api/user', {
      headers: { 'x-session': email }
    });

    let imageBuffer;
    try {
      const media = await quoted.download();
      imageBuffer = media;
    } catch {
      throw new Error('Gagal download gambar');
    }

    const resultUrl = await processImage(email, imageBuffer);

    const resultRes = await fetch(resultUrl);
    const resultBuffer = Buffer.from(await resultRes.arrayBuffer());

    await conn.sendMessage(m.chat, { image: resultBuffer, caption: 'Done!' }, { quoted: m });
  } catch (e) {
    await m.reply('Error: ' + e.message);
  }
};

handler.help = ['aiundress'];
handler.tags = ['ai', 'tools'];
handler.command = ['aiundress'];

export default handler;