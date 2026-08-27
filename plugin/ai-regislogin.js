const API = 'https://ai-api-production-12f9.up.railway.app';

const handler = async (m, { conn, text }) => {
  const pass = (text || '').trim() || 'dancow000';
  try {
    await m.reply('\`[1/5] Membuat email...\`');

    const mailRes = await fetch(API + '/api/mail/create', { method: 'POST' });
    const mail = await mailRes.json();
    if (mail.error) throw new Error(mail.error);

    await m.reply('\`[2/5] Email: ' + mail.address + '\n[3/5] Signup...\`');

    const signupRes = await fetch(API + '/api/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: mail.address, password: pass })
    });
    const signup = await signupRes.json();
    if (signup.error) throw new Error(signup.error);

    await m.reply('\`[4/5] Menunggu verifikasi...\`');

    const waitRes = await fetch(API + '/api/mail/wait', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: mail.token })
    });
    const wait = await waitRes.json();
    if (wait.error) throw new Error(wait.error);

    await m.reply('\`[5/5] Verifikasi akun...\`');

    const verifyRes = await fetch(API + '/api/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: wait.token })
    });
    const verify = await verifyRes.json();
    if (verify.error) throw new Error(verify.error);

    const userRes = await fetch(API + '/api/user');
    const userData = await userRes.json();
    const u = userData?.[0]?.result?.data?.json;

    const info = '\`=== REGIS + LOGIN BERHASIL ===\n\n' +
      'Email    : ' + mail.address + '\n' +
      'Password : ' + pass + '\n' +
      'User ID  : ' + (u?.id || '-') + '\n' +
      'Credits  : ' + (u?.credits ?? '-') + '\n' +
      'Status   : ' + (u?.subscriptionStatus || '-') + '\`';

    await m.reply(info);
  } catch (e) {
    await m.reply('\`ERROR: ' + e.message + '\`');
  }
};

handler.help = ['airegis *( password )*'];
handler.tags = ['tools', 'ai'];
handler.command = ['airegis', 'aireg'];

export default handler;