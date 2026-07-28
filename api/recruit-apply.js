const crypto = require('crypto');

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

async function saveFallbackApplication(req, body, payload, reason) {
  const submittedAt = new Date().toISOString();
  const fallbackId = crypto
    .createHash('sha256')
    .update([payload.phone, payload.applicant_name, payload.city, payload.campaign, submittedAt].join('|'))
    .digest('hex')
    .slice(0, 24);
  const fallbackPayload = {
    tenant_id: TENANT_ID,
    event_name: 'submit_recruit_fallback_saved',
    page_key: 'recruit',
    page_path: '/recruit',
    page_url: cleanText(body.page_url, 500),
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
      fallback_reason: cleanText(reason, 500),
      fallback_id: fallbackId,
      application: payload
    }
  };
  try {
    await supa('huaban_site_events', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(fallbackPayload)
    });
    return { saved: true, fallback_id: fallbackId, fallback_store: 'site_events' };
  } catch (eventError) {
    const contentPayload = {
      tenant_id: TENANT_ID,
      page_key: `recruitment_fallback_${fallbackId}`,
      status: 'draft',
      content: {
        kind: 'recruitment_application_fallback',
        fallback_id: fallbackId,
        primary_error: cleanText(reason, 500),
        event_error: cleanText(eventError.message || '', 500),
        application: payload,
        request: {
          visitor_id: cleanText(body.visitor_id, 120),
          session_id: cleanText(body.session_id, 120),
          user_agent: cleanText(req.headers['user-agent'], 320),
          ip_hash: crypto.createHash('sha256').update(clientIp(req)).digest('hex')
        },
        saved_at: submittedAt
      },
      version: 1,
      updated_at: submittedAt
    };
    await supa('huaban_site_content?on_conflict=tenant_id,page_key,status', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(contentPayload)
    });
    return { saved: true, fallback_id: fallbackId, fallback_store: 'site_content' };
  }
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
    const country = cleanText(body.country, 80);
    const city = cleanText(body.city, 80);
    const roleType = cleanText(body.role_type, 80) || 'early_tester';
    const contributionPlan = cleanText(body.contribution_plan, 1200) || '报名占位';

    if (!applicantName || !phone || !country || !city) {
      return res.status(400).json({ error: '请填写国家/地区、城市、姓名和手机号' });
    }

    const payload = {
      tenant_id: TENANT_ID,
      source_page: 'recruit',
      applicant_name: applicantName,
      phone,
      email: cleanText(body.email, 120),
      country,
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

    try {
      const rows = await supa('huaban_recruitment_applications', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(payload)
      });
      const row = Array.isArray(rows) ? rows[0] : rows;
      return res.status(200).json({ ok: true, id: row?.id || null, status: 'submitted' });
    } catch (primaryError) {
      const fallback = await saveFallbackApplication(req, body, payload, primaryError.message || 'primary_insert_failed');
      return res.status(200).json({ ok: true, id: fallback.fallback_id || null, status: 'fallback_saved', fallback: true, fallback_store: fallback.fallback_store || 'unknown' });
    }
  } catch (error) {
    console.error('recruit-apply error', error);
    return res.status(500).json({ error: error.message || '报名提交失败' });
  }
};
