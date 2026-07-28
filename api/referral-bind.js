const crypto = require('crypto');

const TENANT_ID = process.env.TENANT_ID || '00000000-0000-0000-0000-000000000001';
const SUPA_URL = process.env.SUPABASE_URL || 'https://gxocvpmgfjvmmkkbswgo.supabase.co';
const SUPA_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPA_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4b2N2cG1nZmp2bW1ra2Jzd2dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyNDc4NzAsImV4cCI6MjA5NTgyMzg3MH0.ExUNuOP8YyHQmItY6cdl1Euj7nOXqQq-rQT5-7aNerE';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPA_SERVICE_ROLE_KEY || '';
const { handleReferralVerifiedScenario, handleServiceProfileSavedScenario, pointRule } = require('../lib/scenario-events');

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function code(value = '') {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '').trim().toUpperCase();
}

function text(value = '', max = 120) {
  return String(value || '').trim().slice(0, max);
}

function phone(value = '') {
  const raw = String(value || '').replace(/[\s().-]/g, '').trim();
  if (!raw) return '';
  if (raw.startsWith('00')) return `+${raw.slice(2).replace(/\D/g, '')}`;
  if (raw.startsWith('+')) return `+${raw.slice(1).replace(/\D/g, '')}`;
  const digits = raw.replace(/\D/g, '');
  if (/^04\d{8}$/.test(digits)) return `+61${digits.slice(1)}`;
  if (/^4\d{8}$/.test(digits)) return `+61${digits}`;
  if (/^61\d{9}$/.test(digits)) return `+${digits}`;
  return digits;
}

function normalizeE164Phone(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  let digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('00')) digits = `+${digits.slice(2)}`;
  if (digits.startsWith('+')) return digits.replace(/[^\d+]/g, '');
  const plain = digits.replace(/\D/g, '');
  if (plain.startsWith('04') && plain.length === 10) return `+61${plain.slice(1)}`;
  if (plain.startsWith('4') && plain.length === 9) return `+61${plain}`;
  if (plain.startsWith('61')) return `+${plain}`;
  return plain ? `+${plain}` : '';
}

function makeSupplierCode(seed = '') {
  const base = text(seed, 80).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (base.length >= 6) return base.slice(-6);
  return crypto.randomBytes(3).toString('hex').toUpperCase();
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
    throw new Error(body || '手机号登录状态无效，请重新验证');
  }
  return res.json();
}

async function getFirstReferrer(refereeCode = '') {
  const referee = code(refereeCode);
  if (!referee) return '';
  const rows = await supa(`huaban_referral_events?tenant_id=eq.${TENANT_ID}&referee_code=eq.${encodeURIComponent(referee)}&status=eq.confirmed&order=created_at.asc&limit=1&select=inviter_code`).catch(() => []);
  return code(Array.isArray(rows) ? rows[0]?.inviter_code : '');
}

async function getVerifiedCodesForPhone(normalizedPhone = '') {
  const phoneValue = phone(normalizedPhone);
  if (!phoneValue) return [];
  const codes = [];
  const accounts = await supa(`huaban_accounts?tenant_id=eq.${TENANT_ID}&normalized_phone=eq.${encodeURIComponent(phoneValue)}&status=eq.active&order=created_at.asc&select=friend_code,fields`).catch(() => []);
  (Array.isArray(accounts) ? accounts : []).forEach(row => {
    codes.push(row.friend_code);
    codes.push(row.fields?.canonical_friend_code);
  });
  const links = await supa(`huaban_identity_links?tenant_id=eq.${TENANT_ID}&normalized_phone=eq.${encodeURIComponent(phoneValue)}&status=eq.active&order=created_at.asc&select=friend_code,fields`).catch(() => []);
  (Array.isArray(links) ? links : []).forEach(row => {
    codes.push(row.friend_code);
    codes.push(row.fields?.canonical_friend_code);
  });
  return Array.from(new Set(codes.map(code).filter(Boolean)));
}

async function getCanonicalCodeForPhone(normalizedPhone = '') {
  const phoneValue = phone(normalizedPhone);
  if (!phoneValue) return '';
  const accounts = await supa(`huaban_accounts?tenant_id=eq.${TENANT_ID}&normalized_phone=eq.${encodeURIComponent(phoneValue)}&status=eq.active&order=created_at.asc&limit=1&select=friend_code,fields`).catch(() => []);
  const account = Array.isArray(accounts) ? accounts[0] : null;
  const accountCode = code(account?.friend_code || account?.fields?.canonical_friend_code || '');
  if (accountCode) return accountCode;
  const links = await supa(`huaban_identity_links?tenant_id=eq.${TENANT_ID}&normalized_phone=eq.${encodeURIComponent(phoneValue)}&status=eq.active&order=created_at.asc&limit=1&select=friend_code,fields`).catch(() => []);
  const link = Array.isArray(links) ? links[0] : null;
  return code(link?.friend_code || link?.fields?.canonical_friend_code || '');
}

async function upsert(table = '', row = {}, onConflict = '') {
  const suffix = onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : '';
  const rows = await supa(`${table}${suffix}`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(row)
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

async function upsertFriendships({ inviterCode, refereeCode, inviter, referee, source, cardBy }) {
  const a = code(inviterCode);
  const b = code(refereeCode);
  const baseFields = { source, card_by: cardBy || '', closed_loop: true, user_visible: true };
  const rows = [
    {
      tenant_id: TENANT_ID,
      owner_code: a,
      friend_code: b,
      friend_name: text(referee.name || `华伴好友 ${b}`, 80),
      friend_phone: phone(referee.phone || ''),
      friend_industry: text(referee.industry || '', 80),
      friend_avatar: text(referee.avatar || '👤', 20),
      source: 'server_referral_bind',
      status: 'active',
      fields: { ...baseFields, friend: { code: b, ...referee } }
    },
    {
      tenant_id: TENANT_ID,
      owner_code: b,
      friend_code: a,
      friend_name: text(inviter.name || `华伴好友 ${a}`, 80),
      friend_phone: phone(inviter.phone || ''),
      friend_industry: text(inviter.industry || '', 80),
      friend_avatar: text(inviter.avatar || '👤', 20),
      source: 'server_referral_bind',
      status: 'active',
      fields: { ...baseFields, friend: { code: a, ...inviter } }
    }
  ];
  return Promise.all(rows.map(row => upsert('huaban_friendships', row, 'tenant_id,owner_code,friend_code').catch(error => ({ error: error.message }))));
}

async function getProfileForCode(friendCode = '') {
  const cleanCode = code(friendCode);
  if (!cleanCode) return null;
  const accounts = await supa(`huaban_accounts?tenant_id=eq.${TENANT_ID}&friend_code=eq.${encodeURIComponent(cleanCode)}&status=eq.active&limit=1&select=friend_code,display_name,primary_phone,normalized_phone,fields`).catch(() => []);
  const account = Array.isArray(accounts) ? accounts[0] : null;
  const identities = await supa(`huaban_identity_links?tenant_id=eq.${TENANT_ID}&friend_code=eq.${encodeURIComponent(cleanCode)}&status=eq.active&order=created_at.desc&limit=1&select=friend_code,display_name,phone,normalized_phone,industry,avatar,fields`).catch(() => []);
  const identity = Array.isArray(identities) ? identities[0] : null;
  const accountFields = account?.fields && typeof account.fields === 'object' ? account.fields : {};
  const identityFields = identity?.fields && typeof identity.fields === 'object' ? identity.fields : {};
  return {
    code: cleanCode,
    name: text(account?.display_name || accountFields.display_name || identity?.display_name || identityFields.display_name || `华伴好友 ${cleanCode}`, 80),
    phone: phone(account?.primary_phone || account?.normalized_phone || identity?.phone || identity?.normalized_phone || ''),
    industry: text(accountFields.industry || identity?.industry || identityFields.industry || '', 80),
    avatar: text(accountFields.avatar || identity?.avatar || identityFields.avatar || '👤', 800),
    city: text(accountFields.city || identityFields.city || '', 80),
    address: text(accountFields.location_address || identityFields.location_address || identityFields.address || '', 220)
  };
}

async function createFriendRequest({ requesterCode = '', targetCode = '', requester = {}, target = {}, source = '' } = {}) {
  const from = code(requesterCode);
  const to = code(targetCode);
  if (!from || !to) throw new Error('缺少好友身份信息');
  if (from === to) throw new Error('不能添加自己为好友');
  const existing = await supa(`huaban_friendships?tenant_id=eq.${TENANT_ID}&owner_code=eq.${encodeURIComponent(to)}&friend_code=eq.${encodeURIComponent(from)}&limit=1&select=status`).catch(() => []);
  const current = Array.isArray(existing) ? existing[0] : null;
  if (current?.status === 'active') return { already_friend: true };
  const requestRow = {
    tenant_id: TENANT_ID,
    owner_code: to,
    friend_code: from,
    friend_name: text(requester.name || `华伴好友 ${from}`, 80),
    friend_phone: phone(requester.phone || ''),
    friend_industry: text(requester.industry || '', 80),
    friend_avatar: text(requester.avatar || '👤', 800),
    source: 'manual_phone_friend_request',
    status: 'pending',
    fields: {
      source: source || 'profile_phone_friend_add',
      user_visible: true,
      relation_type: 'friend_request',
      requester_code: from,
      target_code: to,
      requester,
      target,
      requested_at: new Date().toISOString()
    }
  };
  const row = await upsert('huaban_friendships', requestRow, 'tenant_id,owner_code,friend_code');
  return { row };
}

async function insertIdentityLink({ person = {}, friendCode = '', inviterCode = '', ownerCode = '', source = '', sourceRef = '' } = {}) {
  const normalized = phone(person.phone || '');
  if (!normalized) return null;
  return supa('huaban_identity_links', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      tenant_id: TENANT_ID,
      phone: text(person.phone || '', 60),
      normalized_phone: normalized,
      friend_code: code(friendCode),
      display_name: text(person.name || '华伴用户', 80),
      avatar: text(person.avatar || '', 20),
      industry: text(person.industry || '', 80),
      source,
      source_ref: sourceRef,
      link_type: 'referral_identity',
      status: 'active',
      inviter_code: code(inviterCode),
      owner_code: code(ownerCode),
      fields: { user_visible: false, identity_anchor: 'phone', created_by: 'server_referral_bind' }
    })
  }).catch(() => null);
}

async function createSupplyPreclaim({ ownerCode = '', person = {}, authUser = {} } = {}) {
  const creatorCode = code(ownerCode);
  if (!creatorCode) throw new Error('请先完成手机号验证');
  const normalizedPhone = normalizeE164Phone(person.phone || person.contact || '');
  const supplierCode = makeSupplierCode(normalizedPhone || person.name || person.industry || '');
  const name = text(person.name || '华伴用户', 80);
  const industry = text(person.industry || person.service_type || '本地服务', 80);
  const city = text(person.city || 'Melbourne', 80);
  const now = new Date().toISOString();
  let existing = null;
  if (normalizedPhone) {
    const rows = await supa(
      `huaban_supply_profiles?tenant_id=eq.${TENANT_ID}&or=(normalized_contact.eq.${encodeURIComponent(normalizedPhone)},claimed_phone.eq.${encodeURIComponent(normalizedPhone)})&limit=1&select=*`
    ).catch(() => []);
    existing = Array.isArray(rows) ? rows[0] : null;
  }
  const fields = {
    ...(existing?.fields || {}),
    source: 'user_preclaim_supply',
    source_channel: 'profile_share_card',
    pre_registered: true,
    claim_mode: 'phone_verification',
    phone_claim_required: Boolean(normalizedPhone),
    claimed: false,
    inviter_code: creatorCode,
    created_by_owner_code: creatorCode,
    created_by_auth_user_id: authUser.id || '',
    normalized_phone: normalizedPhone,
    card_status: 'ready',
    user_created_at: now
  };
  const payload = {
    tenant_id: TENANT_ID,
    supplier_code: existing?.supplier_code || supplierCode,
    name,
    contact: normalizedPhone || text(person.phone || '', 60),
    normalized_contact: normalizedPhone || text(person.phone || '', 60),
    claimed_phone: normalizedPhone || '',
    service_type: industry,
    service_type_code: text(person.service_type_code || industry, 80),
    intro: text(person.intro || person.notes || '', 500),
    source_country: text(person.country || 'Australia', 80),
    source_city: city,
    language_lane: text(person.language_lane || 'zh', 16),
    market_scope: 'Australia',
    source_mode: 'user_preclaim_supply',
    source_channel: 'profile_share_card',
    verification_status: normalizedPhone ? 'phone_pending_claim' : 'pending_review',
    status: 'candidate',
    fields
  };
  const saved = existing?.id
    ? await supa(`huaban_supply_profiles?id=eq.${existing.id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(payload)
      })
    : await supa('huaban_supply_profiles', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(payload)
      });
  const row = Array.isArray(saved) ? saved[0] : saved;
  if (normalizedPhone && row?.id) {
    await supa('huaban_identity_links', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        tenant_id: TENANT_ID,
        phone: normalizedPhone,
        normalized_phone: normalizedPhone,
        friend_code: row.supplier_code || supplierCode,
        display_name: name,
        industry,
        source: 'user_supply_preclaim',
        source_ref: row.id,
        link_type: 'supply_profile_phone_preclaim',
        status: 'pending_claim',
        inviter_code: creatorCode,
        owner_code: row.supplier_code || supplierCode,
        fields: {
          user_visible: false,
          identity_anchor: 'phone',
          claim_mode: 'phone_verification',
          pre_registered: true,
          supply_profile_id: row.id,
          created_by_owner_code: creatorCode
        }
      })
    }).catch(() => null);
  }
  return row;
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!SERVICE_KEY) return res.status(503).json({ error: 'Supabase 服务密钥未配置' });

  try {
    const body = req.body || {};
    const accessToken = String(body.accessToken || '').trim();
    if (!accessToken) return res.status(401).json({ error: '请先完成手机号验证，再绑定推荐关系和积分' });
    const authUser = await getAuthUser(accessToken);
    const authPhone = phone(authUser.phone || '');
    if (!authUser.id || !authPhone) return res.status(401).json({ error: '手机号登录状态无效，请重新验证' });
    const verifiedCodes = await getVerifiedCodesForPhone(authPhone);

    if (body.action === 'preclaim_supply') {
      const ownerCode = code(body.ownerCode || body.inviterCode || verifiedCodes[0] || '');
      if (verifiedCodes.length && !verifiedCodes.includes(ownerCode)) {
        return res.status(403).json({ error: '当前资料不属于已验证手机号' });
      }
      const lead = await createSupplyPreclaim({ ownerCode, person: body.person || {}, authUser });
      const point = await handleServiceProfileSavedScenario({
        ownerCode,
        source: 'server_referral_bind',
        supplyProfileId: lead?.id || '',
        supplierCode: lead?.supplier_code || '',
        fields: {
          source: 'preclaim_supply',
          auth_user_id: authUser.id
        }
      });
      return res.status(200).json({ ok: true, lead, points: { service_card_completed: point } });
    }

    if (body.action === 'friend_request_by_phone') {
      const requestedOwnerCode = code(body.ownerCode || body.requesterCode || '');
      const authCanonicalCode = await getCanonicalCodeForPhone(authPhone);
      const requesterCode = code(authCanonicalCode || (verifiedCodes.includes(requestedOwnerCode) ? requestedOwnerCode : verifiedCodes[0]) || requestedOwnerCode);
      if (!requesterCode || (verifiedCodes.length && !verifiedCodes.includes(requesterCode))) {
        return res.status(403).json({ error: '当前账号身份无效，请重新验证手机号' });
      }
      const targetPhone = phone(body.friendPhone || body.targetPhone || '');
      if (!targetPhone) return res.status(400).json({ error: '请填写好友手机号' });
      if (targetPhone === authPhone) return res.status(400).json({ error: '不能添加自己为好友' });
      const targetCodes = await getVerifiedCodesForPhone(targetPhone);
      const targetCanonicalCode = await getCanonicalCodeForPhone(targetPhone);
      const targetCode = code(targetCanonicalCode || targetCodes.find(item => item !== requesterCode) || '');
      if (!targetCode) {
        return res.status(404).json({
          ok: false,
          needs_invite: true,
          error: '这个手机号还没有完成华伴注册，可以先分享二维码名片邀请。'
        });
      }
      const requester = {
        ...(await getProfileForCode(requesterCode) || {}),
        ...(body.requester || {}),
        code: requesterCode,
        phone: authPhone
      };
      const target = {
        ...(await getProfileForCode(targetCode) || {}),
        code: targetCode,
        phone: targetPhone
      };
      const result = await createFriendRequest({
        requesterCode,
        targetCode,
        requester,
        target,
        source: text(body.source || 'profile_phone_friend_add', 80)
      });
      return res.status(200).json({
        ok: true,
        pending: !result.already_friend,
        already_friend: Boolean(result.already_friend),
        friend: target,
        request: result.row || null
      });
    }

    if (body.action === 'friend_request_decision') {
      const requestedOwnerCode = code(body.ownerCode || '');
      const authCanonicalCode = await getCanonicalCodeForPhone(authPhone);
      const ownerCode = code(authCanonicalCode || (verifiedCodes.includes(requestedOwnerCode) ? requestedOwnerCode : verifiedCodes[0]) || requestedOwnerCode);
      const requesterCode = code(body.requesterCode || body.friendCode || '');
      const decision = String(body.decision || '').trim().toLowerCase();
      if (!ownerCode || (verifiedCodes.length && !verifiedCodes.includes(ownerCode))) {
        return res.status(403).json({ error: '当前账号身份无效，请重新验证手机号' });
      }
      if (!requesterCode) return res.status(400).json({ error: '缺少好友申请人' });
      if (!['approve', 'reject'].includes(decision)) return res.status(400).json({ error: '请选择添加或拒绝' });
      const rows = await supa(`huaban_friendships?tenant_id=eq.${TENANT_ID}&owner_code=eq.${encodeURIComponent(ownerCode)}&friend_code=eq.${encodeURIComponent(requesterCode)}&status=eq.pending&limit=1&select=*`).catch(() => []);
      const request = Array.isArray(rows) ? rows[0] : null;
      if (!request) return res.status(404).json({ error: '好友申请不存在或已处理' });
      if (decision === 'reject') {
        const patched = await supa(`huaban_friendships?tenant_id=eq.${TENANT_ID}&owner_code=eq.${encodeURIComponent(ownerCode)}&friend_code=eq.${encodeURIComponent(requesterCode)}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({
            status: 'rejected',
            fields: {
              ...(request.fields || {}),
              rejected_at: new Date().toISOString(),
              rejected_by: ownerCode
            }
          })
        });
        return res.status(200).json({ ok: true, decision: 'reject', request: Array.isArray(patched) ? patched[0] : patched });
      }
      const owner = await getProfileForCode(ownerCode) || { code: ownerCode, phone: authPhone };
      const requester = await getProfileForCode(requesterCode) || {
        code: requesterCode,
        name: request.friend_name,
        phone: request.friend_phone,
        industry: request.friend_industry,
        avatar: request.friend_avatar
      };
      const friendships = await upsertFriendships({
        inviterCode: ownerCode,
        refereeCode: requesterCode,
        inviter: owner,
        referee: requester,
        source: 'manual_phone_friend_approved',
        cardBy: ''
      });
      return res.status(200).json({ ok: true, decision: 'approve', friendships, friend: requester });
    }

    const inviterCode = code(body.inviterCode);
    const refereeCode = code(body.refereeCode);
    if (!inviterCode || !refereeCode) return res.status(400).json({ error: '缺少推荐关系信息' });
    if (inviterCode === refereeCode) return res.status(400).json({ error: '不能自我推荐' });
    if (!verifiedCodes.includes(refereeCode)) {
      return res.status(403).json({ error: '被推荐资料不属于当前手机号验证账号，请重新进入个人中心验证' });
    }

    const inviter = body.inviter || {};
    const referee = { ...(body.referee || {}), phone: authPhone };
    const inviterPhone = phone(inviter.phone || '');
    const refereePhone = phone(referee.phone || '');
    const submittedRefereePhone = phone(body.referee?.phone || '');
    if (submittedRefereePhone && submittedRefereePhone !== authPhone) {
      return res.status(403).json({ error: '被推荐人手机号必须与验证码登录账号一致' });
    }
    if (inviterPhone && refereePhone && inviterPhone === refereePhone) {
      return res.status(400).json({ error: '同一手机号不能互相推荐' });
    }

    const existingFirst = await getFirstReferrer(refereeCode);
    const firstReferrerCode = existingFirst || inviterCode;
    const isFirstReferrer = firstReferrerCode === inviterCode;
    const secondLevelCode = isFirstReferrer ? await getFirstReferrer(inviterCode) : '';
    const secondEligible = Boolean(secondLevelCode && secondLevelCode !== inviterCode && secondLevelCode !== refereeCode);
    const directRule = await pointRule('direct_referral_verified');
    const source = text(body.source || 'profile_card_save_referral', 80);
    const cardBy = text(body.cardBy || '', 80);
    const fields = {
      event: 'friend_referral_closed_loop',
      source,
      card_by: cardBy,
      inviter,
      referee,
      first_referrer_code: firstReferrerCode,
      first_referrer_source: existingFirst ? 'database' : 'new',
      direct_referrer_code: inviterCode,
      second_level_referrer_code: secondEligible ? secondLevelCode : '',
      referral_depth: secondEligible ? 2 : 1,
      referral_credit_locked: !isFirstReferrer,
      credit_note: isFirstReferrer ? '首位推荐者已锁定。' : '被推荐者已绑定首位推荐者，本次只添加好友不重复奖励。',
      verified_auth_user_id: authUser.id,
      verified_phone: authPhone,
      user_visible: true,
      auto_friendship: true
    };

    const eventRow = await upsert('huaban_referral_events', {
      tenant_id: TENANT_ID,
      inviter_code: inviterCode,
      referee_code: refereeCode,
      inviter_name: text(inviter.name || `华伴好友 ${inviterCode}`, 80),
      referee_name: text(referee.name || `华伴好友 ${refereeCode}`, 80),
      inviter_phone: inviterPhone,
      referee_phone: refereePhone,
      inviter_avatar: text(inviter.avatar || '👤', 20),
      referee_avatar: text(referee.avatar || '👤', 20),
      source,
      status: 'confirmed',
      points_awarded: isFirstReferrer ? Number(directRule?.points || 0) : 0,
      direct_referrer_code: inviterCode,
      second_level_referrer_code: secondEligible ? secondLevelCode : '',
      referral_depth: secondEligible ? 2 : 1,
      credit_locked: !isFirstReferrer,
      fields
    }, 'tenant_id,inviter_code,referee_code');

    const friendships = await upsertFriendships({ inviterCode, refereeCode, inviter, referee, source, cardBy });
    await Promise.all([
      insertIdentityLink({ person: inviter, friendCode: inviterCode, ownerCode: inviterCode, source: 'referral_inviter', sourceRef: `${inviterCode}_${refereeCode}` }),
      insertIdentityLink({ person: referee, friendCode: refereeCode, inviterCode, ownerCode: refereeCode, source: 'referral_referee', sourceRef: `${inviterCode}_${refereeCode}` })
    ]);

    const scenarioPoints = await handleReferralVerifiedScenario({
      inviterCode,
      refereeCode,
      secondLevelCode,
      directEligible: isFirstReferrer,
      secondEligible,
      source: 'server_referral_bind',
      fields: { ...fields, referral_event_id: eventRow?.id || '' }
    });

    return res.status(200).json({
      ok: true,
      first_referrer_code: firstReferrerCode,
      credit_locked: !isFirstReferrer,
      second_level_referrer_code: secondEligible ? secondLevelCode : '',
      event: eventRow,
      friendships,
      points: { direct: scenarioPoints.direct, second: scenarioPoints.second, rules: scenarioPoints.rules }
    });
  } catch (error) {
    console.error('referral-bind error', error);
    return res.status(500).json({ error: error.message || '推荐关系绑定失败' });
  }
};
