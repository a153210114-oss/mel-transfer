const TENANT_ID = process.env.TENANT_ID || '00000000-0000-0000-0000-000000000001';
const SUPA_URL = process.env.SUPABASE_URL || 'https://gxocvpmgfjvmmkkbswgo.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPA_SERVICE_ROLE_KEY || '';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
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
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!SERVICE_KEY) return res.status(503).json({ error: 'Supabase 服务密钥未配置' });

  try {
    const pageKey = String(req.query?.page || 'official_home').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || 'official_home';
    const rows = await supa(`huaban_site_content?tenant_id=eq.${TENANT_ID}&page_key=eq.${encodeURIComponent(pageKey)}&status=eq.published&order=version.desc&limit=1&select=page_key,status,content,version,published_at,updated_at`);
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return res.status(404).json({ error: '还没有发布官网内容' });
    return res.status(200).json({ ok: true, ...row });
  } catch (error) {
    console.error('site-content error', error);
    return res.status(500).json({ error: error.message || '官网内容读取失败' });
  }
};
