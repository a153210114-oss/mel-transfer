const TENANT_ID = process.env.TENANT_ID || '00000000-0000-0000-0000-000000000001';
const SUPA_URL = process.env.SUPABASE_URL || 'https://gxocvpmgfjvmmkkbswgo.supabase.co';
const SUPA_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPA_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4b2N2cG1nZmp2bW1ra2Jzd2dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyNDc4NzAsImV4cCI6MjA5NTgyMzg3MH0.ExUNuOP8YyHQmItY6cdl1Euj7nOXqQq-rQT5-7aNerE';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPA_SERVICE_ROLE_KEY || '';
const POINTS = { referral_join: 20, referral_second_level_join: 6 };

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

function uniqueCodes(list = []) {
  const seen = new Set();
  return list.map(code).filter(item => {
    if (!item || seen.has(item)) return false;
    seen.add(item);
    return true;
  });
}

function inList(values = []) {
  return uniqueCodes(values).join(',');
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
    headers: { apikey: SUPA_ANON_KEY, Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) throw new Error('手机号登录状态已失效，请重新验证');
  return res.json();
}

function safeFriend(row = {}) {
  return {
    code: code(row.friend_code || row.fields?.friend?.code || ''),
    name: String(row.friend_name || row.fields?.friend?.name || '').slice(0, 80),
    phone: String(row.friend_phone || '').slice(0, 40),
    industry: String(row.friend_industry || '').slice(0, 80),
    avatar: String(row.friend_avatar || '👤').slice(0, 20),
    source: String(row.source || 'friendship_sync').slice(0, 60),
    addedAt: row.created_at || ''
  };
}

function safeOrder(row = {}) {
  return {
    id: row.id || '',
    title: row.title || row.service_title || row.need_type || '交易订单',
    status: row.status || '',
    price_text: row.price_text || row.budget || '',
    created_at: row.created_at || ''
  };
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!SERVICE_KEY) return res.status(503).json({ error: 'Supabase 服务密钥未配置' });

  try {
    const body = req.body || {};
    const accessToken = String(body.accessToken || '').trim();
    if (!accessToken) return res.status(401).json({ error: '请先完成手机号验证' });
    const authUser = await getAuthUser(accessToken);
    const phone = normalizePhone(authUser.phone || body.phone || '');
    if (!authUser.id || !phone) return res.status(401).json({ error: '手机号登录状态无效' });

    const codes = [body.friendCode, ...(Array.isArray(body.identityCodes) ? body.identityCodes : [])];
    const accounts = await supa(`huaban_accounts?tenant_id=eq.${TENANT_ID}&normalized_phone=eq.${encodeURIComponent(phone)}&order=created_at.asc&limit=20&select=friend_code,display_name,fields`).catch(error => {
      throw new Error(/schema cache|Could not find the table|PGRST205/i.test(error.message) ? '数据库身份表未创建：huaban_accounts' : error.message);
    });
    (Array.isArray(accounts) ? accounts : []).forEach(row => {
      codes.push(row.friend_code);
      codes.push(row.fields?.requested_friend_code);
      codes.push(row.fields?.canonical_friend_code);
    });

    const links = await supa(`huaban_identity_links?tenant_id=eq.${TENANT_ID}&normalized_phone=eq.${encodeURIComponent(phone)}&status=eq.active&order=created_at.asc&limit=120&select=friend_code,fields`).catch(error => {
      throw new Error(/schema cache|Could not find the table|PGRST205/i.test(error.message) ? '数据库身份表未创建：huaban_identity_links' : error.message);
    });
    (Array.isArray(links) ? links : []).forEach(row => {
      codes.push(row.friend_code);
      codes.push(row.fields?.canonical_friend_code);
    });

    const friendPhoneRows = await supa(`huaban_friendships?tenant_id=eq.${TENANT_ID}&friend_phone=eq.${encodeURIComponent(phone)}&status=eq.active&order=created_at.desc&limit=500&select=friend_code,fields`).catch(() => []);
    (Array.isArray(friendPhoneRows) ? friendPhoneRows : []).forEach(row => {
      codes.push(row.friend_code);
      codes.push(row.fields?.friend?.code);
    });

    const inviterPhoneRows = await supa(`huaban_referral_events?tenant_id=eq.${TENANT_ID}&inviter_phone=eq.${encodeURIComponent(phone)}&status=eq.confirmed&order=created_at.desc&limit=500&select=inviter_code,direct_referrer_code,fields`).catch(() => []);
    (Array.isArray(inviterPhoneRows) ? inviterPhoneRows : []).forEach(row => {
      codes.push(row.inviter_code);
      codes.push(row.direct_referrer_code);
      codes.push(row.fields?.direct_referrer_code);
    });

    const refereePhoneRows = await supa(`huaban_referral_events?tenant_id=eq.${TENANT_ID}&referee_phone=eq.${encodeURIComponent(phone)}&status=eq.confirmed&order=created_at.desc&limit=500&select=referee_code,fields`).catch(() => []);
    (Array.isArray(refereePhoneRows) ? refereePhoneRows : []).forEach(row => {
      codes.push(row.referee_code);
      codes.push(row.fields?.referee?.code);
    });

    const identityCodes = uniqueCodes(codes);

    let base = 0, direct = 0, second = 0, pending = 0;
    const contacts = await supa(`contacts?phone=eq.${encodeURIComponent(phone)}&tenant_id=eq.${TENANT_ID}&select=voucher_balance`).catch(() => []);
    base = Number(contacts?.[0]?.voucher_balance || 0) || 0;

    const ownerCodeList = inList(identityCodes);
    const seenEvents = new Set();
    const creditedDirect = new Set();
    const creditedSecond = new Set();
    const eventRows = ownerCodeList ? await supa(`huaban_point_events?tenant_id=eq.${TENANT_ID}&owner_code=in.(${ownerCodeList})&order=created_at.desc&limit=1000&select=id,event_key,points,action,status,fields,related_code`).catch(() => []) : [];
    (Array.isArray(eventRows) ? eventRows : []).forEach(row => {
      const eventId = String(row.event_key || row.id || '');
      if (eventId && seenEvents.has(eventId)) return;
      if (eventId) seenEvents.add(eventId);
      const pts = Number(row.points) || 0;
      const status = String(row.status || '').toLowerCase();
      const action = String(row.action || '');
      const refLevel = Number(row.fields?.ref_level || 0);
      const related = code(row.related_code || row.fields?.related_code || '');
      if (status === 'confirmed') {
        if (action === 'referral_second_level_join' || refLevel === 2) { second += pts; if (related) creditedSecond.add(related); }
        else if (action === 'referral_join' || refLevel === 1) { direct += pts; if (related) creditedDirect.add(related); }
        else base += pts;
      } else pending += pts;
    });

    const seenReferrals = new Set();
    const referralRows = ownerCodeList ? await supa(`huaban_referral_events?tenant_id=eq.${TENANT_ID}&inviter_code=in.(${ownerCodeList})&status=eq.confirmed&order=created_at.desc&limit=1000&select=id,referee_code,points_awarded,credit_locked`).catch(() => []) : [];
    (Array.isArray(referralRows) ? referralRows : []).forEach(row => {
      const id = String(row.id || row.referee_code || '');
      if (id && seenReferrals.has(id)) return;
      if (id) seenReferrals.add(id);
      const related = code(row.referee_code || '');
      if (related && !creditedDirect.has(related) && !row.credit_locked) {
        direct += Number(row.points_awarded) || POINTS.referral_join;
        creditedDirect.add(related);
      }
    });

    const seenSecond = new Set();
    const secondRows = ownerCodeList ? await supa(`huaban_referral_events?tenant_id=eq.${TENANT_ID}&second_level_referrer_code=in.(${ownerCodeList})&status=eq.confirmed&order=created_at.desc&limit=1000&select=id,referee_code`).catch(() => []) : [];
    (Array.isArray(secondRows) ? secondRows : []).forEach(row => {
      const id = String(row.id || row.referee_code || '');
      if (id && seenSecond.has(id)) return;
      if (id) seenSecond.add(id);
      const related = code(row.referee_code || '');
      if (related && !creditedSecond.has(related)) {
        second += POINTS.referral_second_level_join;
        creditedSecond.add(related);
      }
    });

    const pendingRemote = [];
    const friends = [];
    const seenFriends = new Set();
    const pendingRows = ownerCodeList ? await supa(`huaban_identity_links?tenant_id=eq.${TENANT_ID}&inviter_code=in.(${ownerCodeList})&link_type=eq.pending_referral_invite&status=eq.active&order=created_at.desc&limit=1000&select=normalized_phone,phone,display_name`).catch(() => []) : [];
    if (Array.isArray(pendingRows)) pendingRemote.push(...pendingRows);
    const friendRows = ownerCodeList ? await supa(`huaban_friendships?tenant_id=eq.${TENANT_ID}&owner_code=in.(${ownerCodeList})&status=eq.active&order=created_at.desc&limit=1000&select=friend_code,friend_name,friend_phone,friend_industry,friend_avatar,source,created_at,fields`).catch(() => []) : [];
    (Array.isArray(friendRows) ? friendRows : []).map(safeFriend).forEach(friend => {
      if (!friend.code || seenFriends.has(friend.code)) return;
      seenFriends.add(friend.code);
      friends.push(friend);
    });

    const orderRows = await supa(`huaban_orders?tenant_id=eq.${TENANT_ID}&buyer_contact=eq.${encodeURIComponent(phone)}&order=created_at.desc&limit=8&select=id,title,service_title,need_type,status,price_text,budget,created_at`).catch(() => []);

    return res.status(200).json({
      ok: true,
      phone,
      identityCodes,
      points: { total: base + direct + second + pending, base, direct, second, pending, pending_bind: pendingRemote.length },
      friends,
      orders: (Array.isArray(orderRows) ? orderRows : []).map(safeOrder)
    });
  } catch (error) {
    console.error('profile-summary error', error);
    return res.status(500).json({ error: error.message || '个人中心资料读取失败' });
  }
};
