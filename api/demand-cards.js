const crypto = require('crypto');

const TENANT_ID = process.env.TENANT_ID || '00000000-0000-0000-0000-000000000001';
const SUPA_URL = process.env.SUPABASE_URL || 'https://gxocvpmgfjvmmkkbswgo.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPA_SERVICE_ROLE_KEY || '';
const PUBLIC_ORIGIN = process.env.PUBLIC_ORIGIN || 'https://www.huabanapp.com';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
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

function cleanText(value = '', max = 1000) {
  return String(value || '').replace(/\u0000/g, '').trim().slice(0, max);
}

function cleanCode(value = '') {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '').trim().toUpperCase().slice(0, 40);
}

function cleanPhone(value = '') {
  return String(value || '').replace(/[^\d+]/g, '').slice(0, 32);
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

function serviceFromText(text = '') {
  const t = text.toLowerCase();
  const rules = [
    { code: 'electrician', label: '电工', rx: /电工|电路|电闸|电线|插座|electrician|electrical/ },
    { code: 'plumber', label: '水管工', rx: /水管|漏水|下水道|马桶|plumber|plumbing/ },
    { code: 'cleaning', label: '清洁家政', rx: /清洁|保洁|家政|打扫|cleaner|cleaning/ },
    { code: 'local_ride', label: '本地接送', rx: /本地接送|出行协助|用车|ride|transport|pickup|drop.?off/ },
    { code: 'auto', label: '汽车服务', rx: /二手车|修车|汽修|汽车|车商|mechanic|car/ },
    { code: 'accounting', label: '会计税务', rx: /会计|报税|税务|accountant|tax/ },
    { code: 'legal', label: '律师法律', rx: /律师|法律|合同|lawyer|legal/ },
    { code: 'migration', label: '移民留学', rx: /移民|签证|留学|visa|migration/ },
    { code: 'real_estate', label: '房产租售', rx: /房产|租房|买房|卖房|中介|real estate|property/ }
  ];
  return rules.find(rule => rule.rx.test(t)) || { code: 'local_service', label: '本地服务' };
}

function cityFromText(text = '', inputCity = '') {
  const body = `${inputCity} ${text}`.toLowerCase();
  const cities = [
    ['Melbourne', /墨尔本|melbourne/],
    ['Sydney', /悉尼|sydney/],
    ['Brisbane', /布里斯班|brisbane/],
    ['Perth', /珀斯|perth/],
    ['Adelaide', /阿德莱德|adelaide/],
    ['Canberra', /堪培拉|canberra/],
    ['Auckland', /奥克兰|auckland/],
    ['Toronto', /多伦多|toronto/],
    ['Vancouver', /温哥华|vancouver/],
    ['Los Angeles', /洛杉矶|los angeles|la\b/],
    ['New York', /纽约|new york/]
  ];
  const found = cities.find(([, rx]) => rx.test(body));
  return found ? found[0] : cleanText(inputCity, 80);
}

function parseDemand(body = {}) {
  const rawText = cleanText(body.text || body.raw_text || '', 1400);
  const service = serviceFromText(`${rawText} ${body.service_type || ''}`);
  const city = cityFromText(rawText, body.city || '');
  const budget = cleanText(body.budget_text || '', 120) || (rawText.match(/(?:\$|aud|澳币|预算|价格|报价)[^，。,.!！?？]{0,30}/i)?.[0] || '');
  const timeText = cleanText(body.time_text || '', 160) || (rawText.match(/(?:今天|明天|周末|下周|上午|下午|晚上|[0-9]{1,2}点)[^，。,.!！?？]{0,30}/)?.[0] || '');
  const missing = [];
  if (!city) missing.push('城市或区域');
  if (!timeText) missing.push('时间');
  if (!budget) missing.push('预算或价格范围');
  const summaryParts = [
    city ? `城市：${city}` : '',
    `需求：${service.label}`,
    timeText ? `时间：${timeText}` : '',
    budget ? `预算：${budget}` : ''
  ].filter(Boolean);
  return {
    rawText,
    service_type: cleanText(body.service_type || service.label, 80),
    service_type_code: cleanText(body.service_type_code || service.code, 80),
    city,
    country: cleanText(body.country || '', 80),
    area: cleanText(body.area || '', 120),
    time_text: cleanText(timeText, 160),
    budget_text: cleanText(budget, 120),
    urgency: /急|马上|现在|asap|urgent/i.test(rawText) ? 'urgent' : 'normal',
    summary: cleanText(body.summary || summaryParts.join(' · ') || rawText, 300),
    missing_fields: missing
  };
}

async function findSupplyMatches(parsed) {
  if (!parsed.service_type_code) return [];
  const rows = await supa([
    'huaban_supply_profiles?',
    `tenant_id=eq.${encodeURIComponent(TENANT_ID)}`,
    `service_type_code=eq.${encodeURIComponent(parsed.service_type_code)}`,
    'status=in.(candidate,active,verified)',
    'select=id,name,city,country,service_type,service_type_code,status,completeness_score',
    'order=completeness_score.desc',
    'limit=12'
  ].join('&')).catch(() => []);
  const list = Array.isArray(rows) ? rows : [];
  if (!parsed.city) return list.slice(0, 6);
  const cityLower = parsed.city.toLowerCase();
  const exact = list.filter(item => String(item.city || '').toLowerCase().includes(cityLower));
  return (exact.length ? exact : list).slice(0, 6);
}

function inviteUrl(demandId, parsed, requesterCode, sourceRef) {
  const params = new URLSearchParams();
  params.set('intent', 'supply_invite');
  params.set('demand', demandId);
  if (requesterCode || sourceRef) params.set('ref', requesterCode || sourceRef);
  if (parsed.service_type_code) params.set('service', parsed.service_type_code);
  if (parsed.city) params.set('city', parsed.city);
  return `${PUBLIC_ORIGIN}/ai.html?${params.toString()}`;
}

async function createCollaborationTask(demand, parsed, requesterCode, sourceRef) {
  const url = inviteUrl(demand.id, parsed, requesterCode, sourceRef);
  const payload = {
    tenant_id: TENANT_ID,
    demand_id: demand.id,
    task_type: 'supply_lead_request',
    title: `寻找${parsed.city ? parsed.city + ' ' : ''}${parsed.service_type || '本地服务'}线索`,
    description: `当前供给库暂时没有足够匹配。可以邀请真实服务者入驻，或提交可靠线索，审核通过后记录待确认贡献。`,
    city: parsed.city,
    country: parsed.country,
    service_type: parsed.service_type,
    service_type_code: parsed.service_type_code,
    requester_code: requesterCode,
    source_ref: sourceRef,
    suggested_reward_points: 20,
    invite_url: url,
    status: 'open',
    fields: { missing_fields: parsed.missing_fields }
  };
  const rows = await supa('huaban_collaboration_tasks', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload)
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

async function createDemand(req, res) {
  const body = req.body || {};
  const parsed = parseDemand(body);
  if (!parsed.rawText) return res.status(400).json({ error: '请先说出一个真实需求' });
  const requesterCode = cleanCode(body.requester_code || body.friendCode || body.identity_code);
  const sourceRef = cleanCode(body.source_ref || body.ref || '');
  const matches = await findSupplyMatches(parsed);
  const payload = {
    tenant_id: TENANT_ID,
    requester_code: requesterCode,
    requester_phone: cleanPhone(body.requester_phone || body.phone),
    source_ref: sourceRef,
    source_channel: cleanText(body.source_channel || 'ai_chat', 80),
    source_campaign: cleanText(body.source_campaign || '', 120),
    source_url: cleanText(body.source_url || '', 420),
    need_type: 'local_service',
    ...parsed,
    status: parsed.missing_fields.length ? 'need_info' : 'human_review',
    supply_match_count: matches.length,
    fields: {
      original: body,
      matched_supply_preview: matches.map(item => ({
        id: item.id,
        name: item.name,
        city: item.city,
        status: item.status
      }))
    }
  };
  const rows = await supa('huaban_demand_cards', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload)
  });
  const demand = Array.isArray(rows) ? rows[0] : rows;
  const task = matches.length ? null : await createCollaborationTask(demand, parsed, requesterCode, sourceRef);
  return res.status(200).json({
    ok: true,
    demand,
    supply_count: matches.length,
    supply_matches: matches,
    collaboration_task: task,
    supply_invite_url: task?.invite_url || '',
    missing_fields: parsed.missing_fields
  });
}

async function submitLead(req, res) {
  const body = req.body || {};
  const taskId = cleanText(body.task_id, 80);
  const demandId = cleanText(body.demand_id, 80);
  const candidateName = cleanText(body.candidate_name, 120);
  const candidateContact = cleanText(body.candidate_contact, 160);
  if (!taskId && !demandId) return res.status(400).json({ error: '缺少协作任务或需求编号' });
  if (!candidateName && !candidateContact) return res.status(400).json({ error: '请至少提供名称或联系方式' });
  const payload = {
    tenant_id: TENANT_ID,
    task_id: taskId || null,
    demand_id: demandId || null,
    submitter_code: cleanCode(body.submitter_code || body.friendCode),
    submitter_phone: cleanPhone(body.submitter_phone || body.phone),
    candidate_name: candidateName,
    candidate_contact: candidateContact,
    candidate_city: cleanText(body.candidate_city || body.city, 80),
    candidate_service_type: cleanText(body.candidate_service_type || body.service_type, 120),
    candidate_source_url: cleanText(body.candidate_source_url || body.source_url, 420),
    note: cleanText(body.note, 800),
    pending_points: 20,
    status: 'submitted',
    fields: { source: body.source || 'ai_collaboration' }
  };
  const rows = await supa('huaban_collaboration_submissions', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload)
  });
  return res.status(200).json({ ok: true, submission: Array.isArray(rows) ? rows[0] : rows });
}

async function listDemand(req, res) {
  const token = String(req.headers['x-admin-token'] || req.query?.token || '');
  if (!verifyAdminToken(token)) return res.status(401).json({ error: '后台登录已过期' });
  const limit = Math.min(Math.max(Number(req.query?.limit || 50), 1), 100);
  const demands = await supa(`huaban_demand_cards?tenant_id=eq.${encodeURIComponent(TENANT_ID)}&select=*&order=created_at.desc&limit=${limit}`);
  const ids = (Array.isArray(demands) ? demands : []).map(item => item.id).filter(Boolean);
  let tasks = [];
  if (ids.length) {
    tasks = await supa(`huaban_collaboration_tasks?tenant_id=eq.${encodeURIComponent(TENANT_ID)}&demand_id=in.(${ids.join(',')})&select=*&order=created_at.desc`).catch(() => []);
  }
  return res.status(200).json({ ok: true, demands: Array.isArray(demands) ? demands : [], tasks: Array.isArray(tasks) ? tasks : [] });
}

async function updateDemand(req, res) {
  const token = String(req.headers['x-admin-token'] || req.body?.token || '');
  if (!verifyAdminToken(token)) return res.status(401).json({ error: '后台登录已过期' });
  const id = cleanText(req.body?.id, 80);
  const status = cleanText(req.body?.status, 40);
  const allowed = new Set(['draft','human_review','need_info','matching','matched','closed','cancelled']);
  if (!id || !allowed.has(status)) return res.status(400).json({ error: '无效需求状态' });
  const rows = await supa(`huaban_demand_cards?id=eq.${encodeURIComponent(id)}&tenant_id=eq.${encodeURIComponent(TENANT_ID)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ status })
  });
  return res.status(200).json({ ok: true, demand: Array.isArray(rows) ? rows[0] : rows });
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!SERVICE_KEY) return res.status(503).json({ error: 'Supabase 服务密钥未配置' });

  try {
    if (req.method === 'GET') return listDemand(req, res);
    if (req.method === 'PATCH') return updateDemand(req, res);
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    if (String(req.body?.action || '') === 'submit_lead') return submitLead(req, res);
    return createDemand(req, res);
  } catch (error) {
    console.error('demand-cards error', error);
    return res.status(500).json({ error: error.message || '需求卡处理失败' });
  }
};
