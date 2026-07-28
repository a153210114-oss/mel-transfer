const TENANT_ID = process.env.TENANT_ID || '00000000-0000-0000-0000-000000000001';
const SUPA_URL = process.env.SUPABASE_URL || 'https://gxocvpmgfjvmmkkbswgo.supabase.co';
const SUPA_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPA_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4b2N2cG1nZmp2bW1ra2Jzd2dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyNDc4NzAsImV4cCI6MjA5NTgyMzg3MH0.ExUNuOP8YyHQmItY6cdl1Euj7nOXqQq-rQT5-7aNerE';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPA_SERVICE_ROLE_KEY || '';
const { handleCardSavedScenario, handleCardSharedScenario, handlePhoneVerifiedScenario, handleProfileSavedScenario } = require('../lib/scenario-events');

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function normalizePhone(phone = '') {
  let raw = String(phone || '').replace(/[\s().-]/g, '').trim();
  if (!raw) return '';
  if (raw.startsWith('00')) raw = `+${raw.slice(2)}`;
  if (raw.startsWith('+')) return `+${raw.slice(1).replace(/\D/g, '')}`;
  const digits = raw.replace(/\D/g, '');
  if (/^04\d{8}$/.test(digits)) return `+61${digits.slice(1)}`;
  if (/^4\d{8}$/.test(digits)) return `+61${digits}`;
  if (/^61\d{9}$/.test(digits)) return `+${digits}`;
  return digits;
}

function code(value = '') {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '').trim().toUpperCase();
}

function text(value = '', max = 120) {
  return String(value || '').trim().slice(0, max);
}

function isGenericDisplayName(value = '') {
  const clean = text(value, 80);
  return !clean || /^华伴用户$/i.test(clean) || /^华伴好友\s+[A-Z0-9_-]+$/i.test(clean);
}

function meaningfulText(value = '', max = 120) {
  const clean = text(value, max);
  return clean && !isGenericDisplayName(clean) ? clean : '';
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

function uniqueCodes(list = []) {
  const seen = new Set();
  return list.map(code).filter(item => {
    if (!item || seen.has(item)) return false;
    seen.add(item);
    return true;
  });
}

async function claimSupplyProfilesByPhone(phone = '', friendCode = '', authUserId = '') {
  const normalizedPhone = normalizePhone(phone);
  const ownerCode = code(friendCode);
  if (!normalizedPhone || !ownerCode) return 0;
  const patch = {
    claimed_phone: normalizedPhone,
    claimed_by_code: ownerCode,
    claimed_at: new Date().toISOString(),
    verification_status: 'phone_verified_claimed',
    status: 'active',
    fields: {
      claimed: true,
      claim_mode: 'phone_verification',
      claimed_by_code: ownerCode,
      auth_user_id: authUserId,
      claimed_at: new Date().toISOString()
    }
  };
  const paths = [
    `huaban_supply_profiles?tenant_id=eq.${TENANT_ID}&normalized_contact=eq.${encodeURIComponent(normalizedPhone)}`,
    `huaban_supply_profiles?tenant_id=eq.${TENANT_ID}&claimed_phone=eq.${encodeURIComponent(normalizedPhone)}`,
    `huaban_supply_profiles?tenant_id=eq.${TENANT_ID}&contact=eq.${encodeURIComponent(normalizedPhone)}`
  ];
  let claimed = 0;
  for (const path of paths) {
    const rows = await supa(path, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(patch)
    }).catch(() => []);
    if (Array.isArray(rows)) claimed += rows.length;
  }
  return claimed;
}

async function markPreviousPhoneReplaced(previousPhone = '', nextPhone = '', friendCode = '', authUserId = '') {
  const oldPhone = normalizePhone(previousPhone);
  const newPhone = normalizePhone(nextPhone);
  const ownerCode = code(friendCode);
  if (!oldPhone || !newPhone || oldPhone === newPhone || !ownerCode) return { accounts: 0, links: 0 };
  const now = new Date().toISOString();
  const replacementFields = {
      phone_replaced: true,
      replaced_by_phone: newPhone,
      replaced_by_code: ownerCode,
      replaced_by_auth_user_id: authUserId || '',
      replaced_at: now
  };
  const accountMatches = await supa(`huaban_accounts?tenant_id=eq.${TENANT_ID}&normalized_phone=eq.${encodeURIComponent(oldPhone)}&friend_code=eq.${encodeURIComponent(ownerCode)}&select=id,fields`).catch(() => []);
  const accountRows = [];
  for (const row of Array.isArray(accountMatches) ? accountMatches : []) {
    const patched = await supa(`huaban_accounts?id=eq.${encodeURIComponent(row.id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        status: 'phone_replaced',
        fields: { ...(row.fields || {}), ...replacementFields }
      })
    }).catch(() => []);
    if (Array.isArray(patched)) accountRows.push(...patched);
  }
  const linkMatches = await supa(`huaban_identity_links?tenant_id=eq.${TENANT_ID}&normalized_phone=eq.${encodeURIComponent(oldPhone)}&owner_code=eq.${encodeURIComponent(ownerCode)}&status=eq.active&select=id,fields`).catch(() => []);
  const linkRows = [];
  for (const row of Array.isArray(linkMatches) ? linkMatches : []) {
    const patched = await supa(`huaban_identity_links?id=eq.${encodeURIComponent(row.id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        status: 'phone_replaced',
        fields: { ...(row.fields || {}), ...replacementFields }
      })
    }).catch(() => []);
    if (Array.isArray(patched)) linkRows.push(...patched);
  }
  return {
    accounts: Array.isArray(accountRows) ? accountRows.length : 0,
    links: Array.isArray(linkRows) ? linkRows.length : 0
  };
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
    const requestedCodes = uniqueCodes([requestedFriendCode, ...(Array.isArray(body.identityCodes) ? body.identityCodes : [])]);
    const existingAccounts = await supa(`huaban_accounts?tenant_id=eq.${TENANT_ID}&normalized_phone=eq.${encodeURIComponent(phone)}&order=created_at.asc&limit=1&select=id,account_uid,friend_code,display_name,phone_verified_at,created_at,status,fields`).catch(() => []);
    const rawExistingAccount = Array.isArray(existingAccounts) ? existingAccounts[0] : null;
    const existingAccount = String(rawExistingAccount?.status || '').toLowerCase() === 'phone_replaced' ? null : rawExistingAccount;
    const identityRows = await supa(`huaban_identity_links?tenant_id=eq.${TENANT_ID}&normalized_phone=eq.${encodeURIComponent(phone)}&status=eq.active&order=created_at.asc&limit=50&select=friend_code,link_type,created_at`).catch(() => []);
    const canonicalFromLinks = firstCode(identityRows, ['verified_account_phone', 'huaban_user_profile', 'referral_identity']);
    const friendCode = canonicalFromLinks || code(existingAccount?.friend_code) || requestedFriendCode;
    const incomingName = meaningfulText(body.name || authUser.user_metadata?.name || '', 40);
    const existingName = meaningfulText(existingAccount?.display_name || existingAccount?.fields?.display_name || '', 40);
    const displayName = incomingName || existingName || '华伴用户';
    const hasMeaningfulDisplayName = !isGenericDisplayName(displayName);
    const industry = text(body.industry || existingAccount?.fields?.industry || '', 80);
    const incomingAvatar = text(body.avatar || '', 800);
    const existingAvatar = text(existingAccount?.fields?.avatar || '', 800);
    const avatar = incomingAvatar && incomingAvatar !== '👤' ? incomingAvatar : (existingAvatar || incomingAvatar || '👤');
    const city = text(body.city || existingAccount?.fields?.city || '', 80);
    const locationAddress = text(body.location_address || existingAccount?.fields?.location_address || '', 220);
    const locationLat = Number(body.location_lat || existingAccount?.fields?.location_lat || 0) || null;
    const locationLng = Number(body.location_lng || existingAccount?.fields?.location_lng || 0) || null;
    const nearbyVisible = body.nearby_visible === true && Boolean(locationLat && locationLng);
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
        city,
        location_address: locationAddress,
        location_lat: locationLat,
        location_lng: locationLng,
        location_accuracy: Number(body.location_accuracy || existingAccount?.fields?.location_accuracy || 0) || null,
        nearby_visible: nearbyVisible,
        nearby_updated_at: city || locationLat || locationLng ? new Date().toISOString() : existingAccount?.fields?.nearby_updated_at || '',
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

    const aliasCodes = requestedCodes.filter(item => item && item !== friendCode);
    await Promise.all(aliasCodes.map(aliasCode => supa('huaban_identity_links', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          tenant_id: TENANT_ID,
          phone,
          normalized_phone: phone,
          friend_code: aliasCode,
          display_name: displayName,
          avatar,
          industry,
          source: 'supabase_phone_auth_alias',
          source_ref: `${authUser.id}_${aliasCode}`,
          link_type: 'device_alias_phone',
          status: 'active',
          owner_code: aliasCode,
          fields: {
            account_uid: row.account_uid || authUser.id,
            phone_verified: true,
            user_visible: false,
            canonical_friend_code: friendCode,
            alias_reason: 'same_phone_cross_browser'
          }
        })
      }).catch(() => null)));

    const patchCodes = uniqueCodes([friendCode, ...aliasCodes]);
    await Promise.all([
      ...patchCodes.map(item => supa(`huaban_friendships?tenant_id=eq.${TENANT_ID}&friend_code=eq.${encodeURIComponent(item)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          ...(hasMeaningfulDisplayName ? { friend_name: displayName } : {}),
          friend_phone: phone,
          friend_industry: industry,
          friend_avatar: avatar
        })
      }).catch(() => null)),
      ...patchCodes.map(item => supa(`huaban_referral_events?tenant_id=eq.${TENANT_ID}&inviter_code=eq.${encodeURIComponent(item)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          ...(hasMeaningfulDisplayName ? { inviter_name: displayName } : {}),
          inviter_phone: phone,
          inviter_avatar: avatar
        })
      }).catch(() => null)),
      ...patchCodes.map(item => supa(`huaban_referral_events?tenant_id=eq.${TENANT_ID}&referee_code=eq.${encodeURIComponent(item)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          ...(hasMeaningfulDisplayName ? { referee_name: displayName } : {}),
          referee_phone: phone,
          referee_avatar: avatar
        })
      }).catch(() => null))
    ]);
    const replacedPhone = await markPreviousPhoneReplaced(body.previousPhone || '', phone, friendCode, authUser.id).catch(() => ({ accounts: 0, links: 0 }));
    const claimedSupplyCount = await claimSupplyProfilesByPhone(phone, friendCode, authUser.id).catch(() => 0);
    const pointResults = {};
    const explicitProfileSave = body.source === 'profile_save' || body.explicitProfileSave === true;
    let pointError = '';
    try {
      pointResults.signup = await handlePhoneVerifiedScenario({
        ownerCode: friendCode,
        source: 'auth_phone_sync',
        accountUid: row.account_uid || authUser.id,
        phone,
        fields: { auth_user_id: authUser.id }
      });
      if (explicitProfileSave) {
        pointResults.profile = await handleProfileSavedScenario({
          ownerCode: friendCode,
          source: 'profile_save',
          accountUid: row.account_uid || authUser.id,
          phone,
          name: displayName,
          industry,
          fields: { auth_user_id: authUser.id }
        });
        if (body.cardSaved || body.cardShared) {
          pointResults.card = await handleCardSavedScenario({
            ownerCode: friendCode,
            source: 'profile_save',
            accountUid: row.account_uid || authUser.id,
            phone,
            fields: { auth_user_id: authUser.id }
          });
        }
        if (body.cardShared) {
          pointResults.card_shared = await handleCardSharedScenario({
            ownerCode: friendCode,
            source: 'profile_share',
            accountUid: row.account_uid || authUser.id,
            fields: { auth_user_id: authUser.id, share_mode: body.shareMode || 'profile_card' }
          });
        }
      }
    } catch (error) {
      pointError = error.message || '积分账本写入失败';
      console.error('auth-phone-sync point event error', error);
    }

    return res.status(200).json({
      ok: true,
      account: {
        id: row.id || '',
        account_uid: row.account_uid || authUser.id,
        phone_verified_at: row.phone_verified_at || verifiedAt,
        friend_code: friendCode,
        requested_friend_code: requestedFriendCode,
        canonical_changed: Boolean(requestedFriendCode && requestedFriendCode !== friendCode),
        alias_codes: aliasCodes,
        replaced_phone: replacedPhone,
        claimed_supply_count: claimedSupplyCount
      },
      points: { ...pointResults, error: pointError }
    });
  } catch (error) {
    console.error('auth-phone-sync error', error);
    return res.status(500).json({ error: error.message || '手机号账号同步失败' });
  }
};
