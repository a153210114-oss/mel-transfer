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
  return crypto.createHash('sha256').update(`${TENANT_ID}:${normalizePhone(phone)}:${String(code || '').trim()}:${secret}`).digest('hex');
}

function safeEqual(a = '', b = '') {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

function accountUid() {
  return `HB${crypto.randomBytes(10).toString('hex').toUpperCase()}`;
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
    const code = String(body.code || '').trim();
    const friendCode = String(body.friendCode || '').replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase();
    const displayName = String(body.name || '').trim().slice(0, 40);
    const industry = String(body.industry || '').trim().slice(0, 80);
    if (!/^\+?\d{7,16}$/.test(phone)) return res.status(400).json({ error: '手机号格式不正确' });
    if (!/^\d{6}$/.test(code)) return res.status(400).json({ error: '验证码格式不正确' });

    const rows = await supa(`huaban_phone_verifications?tenant_id=eq.${TENANT_ID}&normalized_phone=eq.${encodeURIComponent(phone)}&status=eq.sent&order=created_at.desc&limit=1&select=*`);
    const verification = Array.isArray(rows) ? rows[0] : null;
    if (!verification) return res.status(400).json({ error: '请先发送验证码' });
    if (new Date(verification.expires_at).getTime() < Date.now()) return res.status(400).json({ error: '验证码已过期' });
    if (Number(verification.attempts || 0) >= 5) return res.status(429).json({ error: '尝试次数过多，请重新发送验证码' });

    const matched = safeEqual(verification.code_hash, codeHash(phone, code));
    if (!matched) {
      await supa(`huaban_phone_verifications?id=eq.${verification.id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ attempts: Number(verification.attempts || 0) + 1 })
      });
      return res.status(400).json({ error: '验证码不正确' });
    }

    await supa(`huaban_phone_verifications?id=eq.${verification.id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'verified', verified_at: new Date().toISOString(), attempts: Number(verification.attempts || 0) + 1 })
    });

    const existing = await supa(`huaban_accounts?tenant_id=eq.${TENANT_ID}&normalized_phone=eq.${encodeURIComponent(phone)}&limit=1&select=*`).catch(() => []);
    const current = Array.isArray(existing) ? existing[0] : null;
    const account = {
      tenant_id: TENANT_ID,
      account_uid: current?.account_uid || accountUid(),
      primary_phone: phone,
      normalized_phone: phone,
      display_name: displayName || current?.display_name || '',
      friend_code: friendCode || current?.friend_code || '',
      status: 'active',
      phone_verified_at: new Date().toISOString(),
      fields: {
        ...(current?.fields || {}),
        industry: industry || current?.fields?.industry || '',
        last_verify_source: body.source || 'profile_page',
        last_friend_code: friendCode || current?.friend_code || ''
      }
    };
    const saved = await supa('huaban_accounts?on_conflict=tenant_id,normalized_phone', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(account)
    });
    const row = Array.isArray(saved) ? saved[0] : account;

    if (phone) {
      await supa('huaban_identity_links', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          tenant_id: TENANT_ID,
          phone,
          normalized_phone: phone,
          friend_code: friendCode,
          display_name: displayName || '华伴用户',
          industry,
          source: 'phone_otp_verified',
          source_ref: row.account_uid || '',
          link_type: 'verified_account_phone',
          status: 'active',
          owner_code: friendCode,
          fields: { account_uid: row.account_uid, phone_verified: true, user_visible: false }
        })
      }).catch(() => null);
    }

    return res.status(200).json({
      ok: true,
      account: {
        id: row.id || '',
        account_uid: row.account_uid,
        phone_verified_at: row.phone_verified_at,
        friend_code: row.friend_code || friendCode
      }
    });
  } catch (error) {
    console.error('verify-code error', error);
    return res.status(500).json({ error: error.message || '验证码验证失败' });
  }
};
