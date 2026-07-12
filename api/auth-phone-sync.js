const TENANT_ID = process.env.TENANT_ID || '00000000-0000-0000-0000-000000000001';
const SUPA_URL = process.env.SUPABASE_URL || 'https://gxocvpmgfjvmmkkbswgo.supabase.co';
const SUPA_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPA_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4b2N2cG1nZmp2bW1ra2Jzd2dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyNDc4NzAsImV4cCI6MjA5NTgyMzg3MH0.ExUNuOP8YyHQmItY6cdl1Euj7nOXqQq-rQT5-7aNerE';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPA_SERVICE_ROLE_KEY || '';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function normalizePhone(phone = '') {
  return String(phone || '').replace(/[\s().-]/g, '').trim();
}

function code(value = '') {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '').trim().toUpperCase();
}

function text(value = '', max = 120) {
  return String(value || '').trim().slice(0, max);
}

function firstCode(rows = [], preferredTypes = []) {
  const list = Array.isArray(rows) ? rows : [];
  for (const type of preferredTypes) {
    const found = list.find(row => code(row.link_type) === code(type) && code(row.friend_code));
    if (found) return code(found.friend_code);
  }
  const any = list.find(row => code(row.friend_code));
  return code(any?.friend_code || '');
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
    const body = await res.text().catch(() => '');
    throw new Error(body || `Supabase ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json().catch(() => null);
}

async function getAuthUser(accessToken = '') {
  const res = await fetch(`${SUPA_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPA_ANON_KEY,
      Authorization: `Bearer ${accessToken}`
    }
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(body || '手机号登录状态无效');
  }
  return res.json();
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!SERVICE_KEY) return res.status(503).json({ error: 'Supabase 服务密钥未配置' });

  try {
    const body = req.body || {};
    const accessToken = String(body.accessToken || '').trim();
    if (!accessToken) return res.status(401).json({ error: '缺少登录令牌' });
    const authUser = await getAuthUser(accessToken);
    const authPhone = normalizePhone(authUser.phone || body.phone || '');
    if (!authUser.id || !authPhone) return res.status(401).json({ error: '手机号登录状态无效' });

    const phone = normalizePhone(body.phone || authPhone);
    if (phone !== authPhone) return res.status(403).json({ error: '手机号与验证码登录账号不一致' });

    const requestedFriendCode = code(body.friendCode);
    const existingAccounts = await supa(`huaban_accounts?tenant_id=eq.${TENANT_ID}&normalized_phone=eq.${encodeURIComponent(phone)}&order=created_at.asc&limit=1&select=id,account_uid,friend_code,phone_verified_at,created_at`).catch(() => []);
    const existingAccount = Array.isArray(existingAccounts) ? existingAccounts[0] : null;
    const identityRows = await supa(`huaban_identity_links?tenant_id=eq.${TENANT_ID}&normalized_phone=eq.${encodeURIComponent(phone)}&status=eq.active&order=created_at.asc&limit=50&select=friend_code,link_type,created_at`).catch(() => []);
    const canonicalFromLinks = firstCode(identityRows, ['verified_account_phone', 'huaban_user_profile', 'referral_identity']);
    const friendCode = canonicalFromLinks || code(existingAccount?.friend_code) || requestedFriendCode;
    const displayName = text(body.name || authUser.user_metadata?.name || '华伴用户', 40);
    const industry = text(body.industry || '', 80);
    const avatar = text(body.avatar || '👤', 20) || '👤';
    const verifiedAt = authUser.phone_confirmed_at || authUser.confirmed_at || new Date().toISOString();
    const account = {
      tenant_id: TENANT_ID,
      account_uid: existingAccount?.account_uid || authUser.id,
      primary_phone: phone,
      normalized_phone: phone,
      display_name: displayName,
      friend_code: friendCode,
      status: 'active',
      phone_verified_at: verifiedAt,
      fields: {
        industry,
        auth_user_id: authUser.id,
        requested_friend_code: requestedFriendCode,
        canonical_friend_code: friendCode,
        avatar,
        provider: 'supabase_phone_auth',
        last_verify_source: body.source || 'profile_page'
      }
    };
    const saved = await supa('huaban_accounts?on_conflict=tenant_id,normalized_phone', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(account)
    });
    const row = Array.isArray(saved) ? saved[0] : account;

    await supa('huaban_identity_links', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        tenant_id: TENANT_ID,
        phone,
        normalized_phone: phone,
        friend_code: friendCode,
        display_name: displayName,
        avatar,
        industry,
        source: 'supabase_phone_auth',
        source_ref: authUser.id,
        link_type: 'verified_account_phone',
        status: 'active',
        owner_code: friendCode,
        fields: { account_uid: row.account_uid || authUser.id, phone_verified: true, user_visible: false }
      })
    }).catch(() => null);

    if (requestedFriendCode && requestedFriendCode !== friendCode) {
      await supa('huaban_identity_links', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          tenant_id: TENANT_ID,
          phone,
          normalized_phone: phone,
          friend_code: requestedFriendCode,
          display_name: displayName,
          avatar,
          industry,
          source: 'supabase_phone_auth_alias',
          source_ref: authUser.id,
          link_type: 'device_alias_phone',
          status: 'active',
          owner_code: requestedFriendCode,
          fields: {
            account_uid: row.account_uid || authUser.id,
            phone_verified: true,
            user_visible: false,
            canonical_friend_code: friendCode,
            alias_reason: 'same_phone_cross_browser'
          }
        })
      }).catch(() => null);
    }

    await Promise.all([
      supa(`huaban_friendships?tenant_id=eq.${TENANT_ID}&friend_code=eq.${encodeURIComponent(friendCode)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          friend_name: displayName,
          friend_phone: phone,
          friend_industry: industry,
          friend_avatar: avatar
        })
      }).catch(() => null),
      supa(`huaban_referral_events?tenant_id=eq.${TENANT_ID}&inviter_code=eq.${encodeURIComponent(friendCode)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          inviter_name: displayName,
          inviter_phone: phone,
          inviter_avatar: avatar
        })
      }).catch(() => null),
      supa(`huaban_referral_events?tenant_id=eq.${TENANT_ID}&referee_code=eq.${encodeURIComponent(friendCode)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          referee_name: displayName,
          referee_phone: phone,
          referee_avatar: avatar
        })
      }).catch(() => null)
    ]);

    return res.status(200).json({
      ok: true,
      account: {
        id: row.id || '',
        account_uid: row.account_uid || authUser.id,
        phone_verified_at: row.phone_verified_at || verifiedAt,
        friend_code: friendCode,
        requested_friend_code: requestedFriendCode,
        canonical_changed: Boolean(requestedFriendCode && requestedFriendCode !== friendCode)
      }
    });
  } catch (error) {
    console.error('auth-phone-sync error', error);
    return res.status(500).json({ error: error.message || '手机号账号同步失败' });
  }
};
