const TENANT_ID = process.env.TENANT_ID || '00000000-0000-0000-0000-000000000001';
const SUPA_URL = process.env.SUPABASE_URL || 'https://gxocvpmgfjvmmkkbswgo.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPA_SERVICE_ROLE_KEY || '';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function cleanText(value = '', max = 800) {
  return String(value || '').replace(/\u0000/g, '').trim().slice(0, max);
}

function normalizePhone(value = '') {
  return cleanText(value, 40).replace(/[^\d+]/g, '');
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

function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || String(req.socket?.remoteAddress || '');
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!SERVICE_KEY) return res.status(503).json({ error: '报名接口还没有配置服务密钥' });

  try {
    const body = req.body || {};
    if (cleanText(body.company_website, 200)) {
      return res.status(200).json({ ok: true, skipped: true });
    }

    const applicantName = cleanText(body.applicant_name, 80);
    const phone = normalizePhone(body.phone);
    const city = cleanText(body.city, 80);
    const roleType = cleanText(body.role_type, 80);
    const contributionPlan = cleanText(body.contribution_plan, 1200);

    if (!applicantName || !phone || !city || !roleType || !contributionPlan) {
      return res.status(400).json({ error: '请填写姓名、手机号、城市、参与方向和你能贡献什么' });
    }

    const payload = {
      tenant_id: TENANT_ID,
      source_page: 'recruit',
      applicant_name: applicantName,
      phone,
      email: cleanText(body.email, 120),
      country: cleanText(body.country, 80),
      city,
      region_key: cleanText(body.region_key, 80),
      role_type: roleType,
      industry: cleanText(body.industry, 120),
      resources: cleanText(body.resources, 1200),
      contribution_plan: contributionPlan,
      ref_code: cleanText(body.ref_code, 80),
      channel: cleanText(body.channel, 80),
      campaign: cleanText(body.campaign, 80),
      status: 'submitted',
      metadata: {
        user_agent: cleanText(req.headers['user-agent'], 260),
        ip: clientIp(req),
        page_url: cleanText(body.page_url, 260),
        timezone: cleanText(body.timezone, 80),
        submitted_at: new Date().toISOString()
      }
    };

    const rows = await supa('huaban_recruitment_applications', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(payload)
    });
    const row = Array.isArray(rows) ? rows[0] : rows;
    return res.status(200).json({ ok: true, id: row?.id || null, status: 'submitted' });
  } catch (error) {
    console.error('recruit-apply error', error);
    return res.status(500).json({ error: error.message || '报名提交失败' });
  }
};
