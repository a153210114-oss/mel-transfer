const crypto = require('crypto');

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

function safeEqual(a = '', b = '') {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function makeToken(secret) {
  const payload = JSON.stringify({
    sub: 'huaban-admin',
    iat: Date.now(),
    exp: Date.now() + 12 * 60 * 60 * 1000
  });
  const encoded = base64url(payload);
  return `${encoded}.${sign(encoded, secret)}`;
}

function verifyToken(token = '', secret) {
  const [encoded, signature] = String(token).split('.');
  if (!encoded || !signature) return false;
  if (!safeEqual(signature, sign(encoded, secret))) return false;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    return payload.sub === 'huaban-admin' && Number(payload.exp) > Date.now();
  } catch(e) {
    return false;
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const adminPassword = process.env.ADMIN_PASSWORD || '';
  const secret = process.env.ADMIN_SESSION_SECRET || adminPassword;
  if (!adminPassword || !secret) {
    return res.status(503).json({ error: '后台登录还没有配置管理员密码' });
  }

  try {
    const body = req.body || {};
    if (body.action === 'verify') {
      return verifyToken(body.token || '', secret)
        ? res.status(200).json({ ok: true })
        : res.status(401).json({ error: '登录已过期' });
    }
    if (body.action !== 'login') {
      return res.status(400).json({ error: 'Invalid action' });
    }
    if (!safeEqual(body.password || '', adminPassword)) {
      return res.status(401).json({ error: '密码不正确' });
    }
    return res.status(200).json({ ok: true, token: makeToken(secret) });
  } catch(e) {
    return res.status(500).json({ error: '登录服务暂时不可用' });
  }
};
