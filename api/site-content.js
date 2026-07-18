const crypto = require('crypto');

const TENANT_ID = process.env.TENANT_ID || '00000000-0000-0000-0000-000000000001';
const SUPA_URL = process.env.SUPABASE_URL || 'https://gxocvpmgfjvmmkkbswgo.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPA_SERVICE_ROLE_KEY || '';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Token');
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

function verifyAdminToken(token = '') {
  const adminPassword = process.env.ADMIN_PASSWORD || '';
  const secret = process.env.ADMIN_SESSION_SECRET || adminPassword;
  if (!adminPassword || !secret) return false;
  const [encoded, signature] = String(token).split('.');
  if (!encoded || !signature || !safeEqual(signature, sign(encoded, secret))) return false;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    return payload.sub === 'huaban-admin' && Number(payload.exp) > Date.now();
  } catch (error) {
    return false;
  }
}

function cleanText(value = '', max = 1200) {
  return String(value || '').replace(/\u0000/g, '').trim().slice(0, max);
}

function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || String(req.socket?.remoteAddress || '');
}

function todayStartIso() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function normalizeLegacyCopy(content = {}) {
  if (!content || typeof content !== 'object') return content;
  const next = { ...content };
  if (typeof next.finePrint === 'string') {
    next.finePrint = next.finePrint.replace('不支持私下转让。', '没有转让功能。');
  }
  return next;
}

function normalizeContent(input = {}) {
  const cards = Array.isArray(input.cards) ? input.cards.slice(0, 6) : [];
  const sections = Array.isArray(input.sections) ? input.sections.slice(0, 24) : [];
  return normalizeLegacyCopy({
    heroTitle: cleanText(input.heroTitle, 80),
    heroVersion: cleanText(input.heroVersion, 80),
    heroSubtitle: cleanText(input.heroSubtitle, 180),
    heroHook: cleanText(input.heroHook, 220),
    primaryCta: cleanText(input.primaryCta, 40),
    secondaryCta: cleanText(input.secondaryCta, 40),
    rulesCta: cleanText(input.rulesCta, 40),
    finePrint: cleanText(input.finePrint, 260),
    aboutTitle: cleanText(input.aboutTitle, 80),
    aboutBody: cleanText(input.aboutBody, 900),
    aboutExtra: cleanText(input.aboutExtra, 700),
    cards: cards.map(card => ({
      title: cleanText(card?.title, 80),
      body: cleanText(card?.body, 420)
    })),
    startTitle: cleanText(input.startTitle, 80),
    startBody: cleanText(input.startBody, 700),
    startPrimaryCta: cleanText(input.startPrimaryCta, 40),
    startSecondaryCta: cleanText(input.startSecondaryCta, 40),
    footer: cleanText(input.footer, 260),
    pageTitle: cleanText(input.pageTitle, 120),
    pageSubtitle: cleanText(input.pageSubtitle, 260),
    pageIntro: cleanText(input.pageIntro, 900),
    updatedLabel: cleanText(input.updatedLabel, 80),
    ctaText: cleanText(input.ctaText, 60),
    ctaHref: cleanText(input.ctaHref, 160),
    sections: sections.map(section => ({
      title: cleanText(section?.title, 120),
      body: cleanText(section?.body, 2000)
    })).filter(section => section.title || section.body)
  });
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

async function getLatest(pageKey, status) {
  const rows = await supa(`huaban_site_content?tenant_id=eq.${TENANT_ID}&page_key=eq.${encodeURIComponent(pageKey)}&status=eq.${status}&order=version.desc&limit=1&select=id,page_key,status,content,version,published_at,updated_at`);
  const row = Array.isArray(rows) ? rows[0] : null;
  if (row?.content) row.content = normalizeLegacyCopy(row.content);
  return row;
}

async function upsertContent(pageKey, status, content) {
  const current = await getLatest(pageKey, status);
  const nextVersion = Math.max(Number(current?.version || 0) + 1, 1);
  const payload = {
    tenant_id: TENANT_ID,
    page_key: pageKey,
    status,
    content,
    version: nextVersion,
    updated_at: new Date().toISOString(),
    ...(status === 'published' ? { published_at: new Date().toISOString() } : {})
  };
  const rows = await supa('huaban_site_content?on_conflict=tenant_id,page_key,status', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(payload)
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

async function getRecruitmentReport() {
  const rows = await supa(`huaban_recruitment_applications?tenant_id=eq.${TENANT_ID}&order=created_at.desc&limit=500&select=id,applicant_name,phone,email,country,city,region_key,role_type,industry,ref_code,channel,campaign,status,created_at`);
  const list = Array.isArray(rows) ? rows : [];
  const today = todayStartIso();
  return {
    ok: true,
    total: list.length,
    today: list.filter(row => String(row.created_at || '') >= today).length,
    melbourne: list.filter(row => String(row.city || '').toLowerCase().includes('melbourne') || String(row.city || '').includes('墨尔本')).length,
    pending: list.filter(row => ['submitted', 'reviewing'].includes(row.status)).length,
    rows: list.slice(0, 80)
  };
}

async function getSiteLogReport() {
  const rows = await supa(`huaban_site_events?tenant_id=eq.${TENANT_ID}&order=created_at.desc&limit=500&select=id,event_name,page_key,page_path,ref_code,channel,campaign,visitor_id,device_type,browser,created_at`);
  const list = Array.isArray(rows) ? rows : [];
  const today = todayStartIso();
  const visitors = new Set(list.map(row => row.visitor_id).filter(Boolean));
  return {
    ok: true,
    total: list.length,
    today: list.filter(row => String(row.created_at || '') >= today).length,
    recruit: list.filter(row => String(row.page_path || '').includes('recruit') || row.page_key === 'recruit').length,
    visitors: visitors.size,
    rows: list.slice(0, 100)
  };
}

async function trackSiteEvent(req, res) {
  const body = req.body || {};
  const url = cleanText(body.page_url, 500);
  const pagePath = cleanText(body.page_path, 180) || '/';
  const payload = {
    tenant_id: TENANT_ID,
    event_name: cleanText(body.event_name || 'page_view', 60),
    page_key: cleanText(body.page_key, 80),
    page_path: pagePath,
    page_url: url,
    ref_code: cleanText(body.ref_code, 80),
    channel: cleanText(body.channel, 80),
    campaign: cleanText(body.campaign, 80),
    visitor_id: cleanText(body.visitor_id, 120),
    session_id: cleanText(body.session_id, 120),
    device_type: cleanText(body.device_type, 40),
    browser: cleanText(body.browser, 80),
    user_agent: cleanText(req.headers['user-agent'], 320),
    ip_hash: crypto.createHash('sha256').update(clientIp(req)).digest('hex'),
    metadata: {
      title: cleanText(body.title, 160),
      timezone: cleanText(body.timezone, 80),
      screen: cleanText(body.screen, 80)
    }
  };
  await supa('huaban_site_events', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(payload)
  });
  return res.status(200).json({ ok: true });
}

async function handleAdmin(req, res, pageKey) {
  const token = req.method === 'GET'
    ? String(req.headers['x-admin-token'] || req.query?.token || '')
    : String(req.body?.token || '');
  if (!verifyAdminToken(token)) return res.status(401).json({ error: '后台登录已过期' });

  if (req.method === 'GET') {
    const report = String(req.query?.report || '').toLowerCase();
    if (report === 'recruit_stats') return res.status(200).json(await getRecruitmentReport());
    if (report === 'site_logs') return res.status(200).json(await getSiteLogReport());
    const draft = await getLatest(pageKey, 'draft');
    const published = await getLatest(pageKey, 'published');
    return res.status(200).json({ ok: true, draft, published });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const action = String(req.body?.action || '').toLowerCase();
  const content = normalizeContent(req.body?.content || {});
  if (action === 'save') {
    const draft = await upsertContent(pageKey, 'draft', content);
    return res.status(200).json({ ok: true, status: 'draft', draft });
  }
  if (action === 'publish') {
    const draft = await upsertContent(pageKey, 'draft', content);
    const published = await upsertContent(pageKey, 'published', content);
    return res.status(200).json({ ok: true, status: 'published', draft, published });
  }
  return res.status(400).json({ error: 'Invalid action' });
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!SERVICE_KEY) return res.status(503).json({ error: 'Supabase 服务密钥未配置' });

  try {
    const pageKey = String((req.method === 'GET' ? req.query?.page : req.body?.page) || 'official_home').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || 'official_home';
    if (req.query?.admin === '1' || req.body?.admin) {
      return handleAdmin(req, res, pageKey);
    }
    if (req.method === 'POST' && String(req.body?.action || '') === 'track_event') {
      return trackSiteEvent(req, res);
    }
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    const row = await getLatest(pageKey, 'published');
    if (!row) return res.status(404).json({ error: '还没有发布官网内容' });
    return res.status(200).json({ ok: true, ...row });
  } catch (error) {
    console.error('site-content error', error);
    return res.status(500).json({ error: error.message || '官网内容读取失败' });
  }
};
