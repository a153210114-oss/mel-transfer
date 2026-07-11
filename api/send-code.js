const crypto = require('crypto');

const TENANT_ID = process.env.TENANT_ID || '00000000-0000-0000-0000-000000000001';
const SUPA_URL = process.env.SUPABASE_URL || 'https://gxocvpmgfjvmmkkbswgo.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPA_SERVICE_ROLE_KEY || '';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function normalizePhone(phone = '') {
  return String(phone || '').replace(/[\s().-]/g, '').trim();
}

function codeHash(phone = '', code = '') {
  const secret = process.env.OTP_SECRET || process.env.ADMIN_SESSION_SECRET || SERVICE_KEY;
  return crypto.createHash('sha256').update(`${TENANT_ID}:${normalizePhone(phone)}:${code}:${secret}`).digest('hex');
}

function ipHash(req) {
  const raw = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
  return crypto.createHash('sha256').update(String(raw).split(',')[0].trim()).digest('hex');
}

async function supa(path, options = {}) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Supabase ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json().catch(() => null);
}

async function sendSms(phone, message) {
  const provider = String(process.env.SMS_PROVIDER || '').toLowerCase();
  if (provider === 'twilio') {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;
    if (!sid || !token || !from) throw new Error('Twilio 短信环境变量未配置完整');
    const body = new URLSearchParams({ To: phone, From: from, Body: message });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body
    });
    if (!res.ok) throw new Error(await res.text());
    return { provider, result: await res.json().catch(() => ({})) };
  }
  if (provider === 'webhook') {
    const url = process.env.SMS_WEBHOOK_URL;
    if (!url) throw new Error('SMS_WEBHOOK_URL 未配置');
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.SMS_WEBHOOK_SECRET ? { Authorization: `Bearer ${process.env.SMS_WEBHOOK_SECRET}` } : {})
      },
      body: JSON.stringify({ phone, message, tenant_id: TENANT_ID, source: 'huaban_phone_otp' })
    });
    if (!res.ok) throw new Error(await res.text());
    return { provider, result: await res.json().catch(() => ({})) };
  }
  if (provider === 'console' && process.env.NODE_ENV !== 'production') {
    console.log(`[Huaban OTP] ${phone}: ${message}`);
    return { provider, result: { dev: true } };
  }
  throw new Error('短信服务未配置');
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!SERVICE_KEY) return res.status(503).json({ error: 'Supabase 服务密钥未配置' });
  if (!process.env.OTP_SECRET && !process.env.ADMIN_SESSION_SECRET) {
    return res.status(503).json({ error: '验证码加密密钥未配置' });
  }

  try {
    const body = req.body || {};
    const phone = normalizePhone(body.phone);
    if (!/^\+?\d{7,16}$/.test(phone)) return res.status(400).json({ error: '手机号格式不正确' });
    const recent = await supa(`huaban_phone_verifications?tenant_id=eq.${TENANT_ID}&normalized_phone=eq.${encodeURIComponent(phone)}&order=created_at.desc&limit=10&select=created_at,status`);
    const recentCount = (Array.isArray(recent) ? recent : []).filter(row => Date.now() - new Date(row.created_at).getTime() < 10 * 60 * 1000).length;
    if (recentCount >= 3) return res.status(429).json({ error: '验证码发送过于频繁，请稍后再试' });

    const code = String(crypto.randomInt(100000, 1000000));
    const message = `【华伴】验证码 ${code}，10分钟内有效。请勿转发给他人。`;
    const sms = await sendSms(phone, message);
    await supa('huaban_phone_verifications', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        tenant_id: TENANT_ID,
        phone,
        normalized_phone: phone,
        code_hash: codeHash(phone, code),
        purpose: String(body.purpose || 'register_login').slice(0, 40),
        status: 'sent',
        provider: sms.provider,
        friend_code: String(body.friendCode || '').replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase(),
        ip_hash: ipHash(req),
        user_agent: String(req.headers['user-agent'] || '').slice(0, 240),
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        fields: {
          display_name: String(body.name || '').slice(0, 40),
          industry: String(body.industry || '').slice(0, 80),
          source: body.source || 'profile_page'
        }
      })
    });
    return res.status(200).json({ ok: true, expiresIn: 600 });
  } catch (error) {
    console.error('send-code error', error);
    return res.status(500).json({ error: error.message || '验证码发送失败' });
  }
};
