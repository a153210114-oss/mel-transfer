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

function normalizeContent(input = {}) {
  const cards = Array.isArray(input.cards) ? input.cards.slice(0, 6) : [];
  return {
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
    footer: cleanText(input.footer, 260)
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
    const text = await res.text().catch(() => '');
    throw new Error(text || `Supabase ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json().catch(() => null);
}

async function getLatest(pageKey, status) {
  const rows = await supa(`huaban_site_content?tenant_id=eq.${TENANT_ID}&page_key=eq.${encodeURIComponent(pageKey)}&status=eq.${status}&order=version.desc&limit=1&select=id,page_key,status,content,version,published_at,updated_at`);
  return Array.isArray(rows) ? rows[0] : null;
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

async function handleAdmin(req, res, pageKey) {
  const token = req.method === 'GET'
    ? String(req.headers['x-admin-token'] || req.query?.token || '')
    : String(req.body?.token || '');
  if (!verifyAdminToken(token)) return res.status(401).json({ error: '后台登录已过期' });

  if (req.method === 'GET') {
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
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    const row = await getLatest(pageKey, 'published');
    if (!row) return res.status(404).json({ error: '还没有发布官网内容' });
    return res.status(200).json({ ok: true, ...row });
  } catch (error) {
    console.error('site-content error', error);
    return res.status(500).json({ error: error.message || '官网内容读取失败' });
  }
};
