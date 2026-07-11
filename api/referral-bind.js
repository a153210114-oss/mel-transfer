const TENANT_ID = process.env.TENANT_ID || '00000000-0000-0000-0000-000000000001';
const SUPA_URL = process.env.SUPABASE_URL || 'https://gxocvpmgfjvmmkkbswgo.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPA_SERVICE_ROLE_KEY || '';

const POINTS = {
  referral_join: 20,
  referral_second_level_join: 6
};

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
  return String(value || '').replace(/[\s().-]/g, '').trim();
}

function eventKey({ ownerCode = '', action = '', relatedCode = '' } = {}) {
  const owner = code(ownerCode);
  const related = code(relatedCode);
  if (!owner || !action || !related) return '';
  return `huaban:${TENANT_ID}:${owner}:${action}:${related}`;
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

async function getFirstReferrer(refereeCode = '') {
  const referee = code(refereeCode);
  if (!referee) return '';
  const rows = await supa(`huaban_referral_events?tenant_id=eq.${TENANT_ID}&referee_code=eq.${encodeURIComponent(referee)}&status=eq.confirmed&order=created_at.asc&limit=1&select=inviter_code`).catch(() => []);
  return code(Array.isArray(rows) ? rows[0]?.inviter_code : '');
}

async function pointExists(key = '') {
  if (!key) return false;
  const rows = await supa(`huaban_point_events?tenant_id=eq.${TENANT_ID}&event_key=eq.${encodeURIComponent(key)}&limit=1&select=id`).catch(() => []);
  return Array.isArray(rows) && rows.length > 0;
}

async function insertPoint({ ownerCode = '', action = '', points = 0, relatedCode = '', reason = '', fields = {} } = {}) {
  const owner = code(ownerCode);
  const related = code(relatedCode);
  const key = eventKey({ ownerCode: owner, action, relatedCode: related });
  if (!owner || !related || owner === related || !key) return { skipped: true };
  if (await pointExists(key)) return { duplicate: true, event_key: key };
  const payload = {
    tenant_id: TENANT_ID,
    owner_code: owner,
    action,
    points,
    related_code: related,
    reason,
    status: 'confirmed',
    event_key: key,
    fields: {
      source: 'server_referral_bind',
      user_visible: true,
      related_code: related,
      event_key: key,
      ...fields
    }
  };
  try {
    const rows = await supa('huaban_point_events', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(payload)
    });
    return Array.isArray(rows) ? rows[0] : rows;
  } catch (error) {
    return { duplicate: /duplicate|unique/i.test(error.message), error: error.message, event_key: key };
  }
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

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!SERVICE_KEY) return res.status(503).json({ error: 'Supabase 服务密钥未配置' });

  try {
    const body = req.body || {};
    const inviterCode = code(body.inviterCode);
    const refereeCode = code(body.refereeCode);
    if (!inviterCode || !refereeCode) return res.status(400).json({ error: '缺少邀请人或被邀请人身份码' });
    if (inviterCode === refereeCode) return res.status(400).json({ error: '不能自我推荐' });

    const inviter = body.inviter || {};
    const referee = body.referee || {};
    const inviterPhone = phone(inviter.phone || '');
    const refereePhone = phone(referee.phone || '');
    if (inviterPhone && refereePhone && inviterPhone === refereePhone) {
      return res.status(400).json({ error: '同一手机号不能互相推荐' });
    }

    const existingFirst = await getFirstReferrer(refereeCode);
    const firstReferrerCode = existingFirst || inviterCode;
    const isFirstReferrer = firstReferrerCode === inviterCode;
    const secondLevelCode = isFirstReferrer ? await getFirstReferrer(inviterCode) : '';
    const secondEligible = Boolean(secondLevelCode && secondLevelCode !== inviterCode && secondLevelCode !== refereeCode);
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
      points_awarded: isFirstReferrer ? POINTS.referral_join : 0,
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

    const directPoint = isFirstReferrer
      ? await insertPoint({
          ownerCode: inviterCode,
          action: 'referral_join',
          points: POINTS.referral_join,
          relatedCode: refereeCode,
          reason: '好友通过分享进入并保存身份资料',
          fields: { ...fields, ref_level: 1, referral_event_id: eventRow?.id || '' }
        })
      : null;
    const secondPoint = secondEligible
      ? await insertPoint({
          ownerCode: secondLevelCode,
          action: 'referral_second_level_join',
          points: POINTS.referral_second_level_join,
          relatedCode: refereeCode,
          reason: '二级好友真实加入华伴',
          fields: { ...fields, ref_level: 2, referral_event_id: eventRow?.id || '' }
        })
      : null;

    return res.status(200).json({
      ok: true,
      first_referrer_code: firstReferrerCode,
      credit_locked: !isFirstReferrer,
      second_level_referrer_code: secondEligible ? secondLevelCode : '',
      event: eventRow,
      friendships,
      points: { direct: directPoint, second: secondPoint }
    });
  } catch (error) {
    console.error('referral-bind error', error);
    return res.status(500).json({ error: error.message || '推荐关系绑定失败' });
  }
};
