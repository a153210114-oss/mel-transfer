// api/local-search.js - Huaban local service search + matching brain

const DEFAULT_SUPA_URL = 'https://gxocvpmgfjvmmkkbswgo.supabase.co';
const DEFAULT_SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4b2N2cG1nZmp2bW1ra2Jzd2dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyNDc4NzAsImV4cCI6MjA5NTgyMzg3MH0.ExUNuOP8YyHQmItY6cdl1Euj7nOXqQq-rQT5-7aNerE';
const SUPA_URL = process.env.SUPABASE_URL || DEFAULT_SUPA_URL;
const SUPA_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || DEFAULT_SUPA_KEY;
const TENANT_ID = '00000000-0000-0000-0000-000000000001';

async function supa(path) {
  if (!SUPA_URL || !SUPA_KEY) return [];
  const res = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`
    }
  });
  if (!res.ok) return [];
  return res.json();
}

function cleanText(value = '') {
  return String(value || '').trim();
}

function serviceKind(text = '') {
  if (/电工|跳闸|断电|电路|electrician|electrical/i.test(text)) return 'electrician';
  if (/水管|漏水|plumber|plumbing/i.test(text)) return 'plumber';
  if (/清洁|clean/i.test(text)) return 'cleaner';
  if (/园丁|花园|garden/i.test(text)) return 'gardener';
  if (/搬家|搬运|removal/i.test(text)) return 'removalist';
  if (/跑腿|配送|delivery|courier/i.test(text)) return 'delivery';
  return 'local_service';
}

function serviceLabel(kind) {
  return {
    electrician: '电工',
    plumber: '水管',
    cleaner: '清洁',
    gardener: '园丁',
    removalist: '搬运',
    delivery: '跑腿配送'
  }[kind] || '本地服务';
}

function extractPublicPhone(text = '') {
  const source = String(text || '');
  const candidates = source.match(/(?:\+?61|0)\s?\d[\d\s().-]{7,}\d/g) || [];
  for (const raw of candidates) {
    const compact = raw.replace(/[^\d+]/g, '');
    const digits = compact.replace(/\D/g, '');
    if (/^(19|20)\d{6}$/.test(digits)) continue;
    if (compact.startsWith('+61')) {
      if (/^\+61(?:4\d{8}|[2378]\d{8})$/.test(compact)) return compact;
      continue;
    }
    if (/^04\d{8}$/.test(digits) || /^0[2378]\d{8}$/.test(digits)) return digits;
  }
  return '';
}

function hasServiceMatch(raw = '', kind = 'local_service') {
  const map = {
    electrician: /电工|跳闸|断电|电路|electrician|electrical/i,
    plumber: /水管|漏水|plumber|plumbing/i,
    cleaner: /清洁|clean/i,
    gardener: /园丁|花园|garden/i,
    removalist: /搬家|搬运|removal/i,
    delivery: /跑腿|配送|delivery|courier/i
  };
  return (map[kind] || /服务|service|tradie|维修|repair|handyman/i).test(raw);
}

function sourceLabel(row = {}) {
  const channel = cleanText(row.channel);
  const status = cleanText(row.status);
  const fields = row.fields || {};
  if (channel === 'huaban_friend' || channel === 'contact' || fields.source_type === 'huaban_user') return '华伴用户';
  if (fields.verification_status === 'verified_contact_from_public_listing' || status === 'approved' || status === 'verified') return '已核验线索';
  if (channel.includes('search') || channel.includes('public') || fields.source_type === 'public_web' || fields.source_url) return '公开搜索结果';
  if (channel.includes('platform') || fields.source_platform) return '公开入口';
  return '已收录线索';
}

function buildSearchQueries({ text = '', city = 'Melbourne', place = '', kind = 'local_service' }) {
  const label = serviceLabel(kind);
  const area = place || city;
  const englishKind = {
    electrician: 'electrician',
    plumber: 'plumber',
    cleaner: 'cleaner',
    gardener: 'gardener',
    removalist: 'removalist',
    delivery: 'courier'
  }[kind] || 'local service';
  return [
    `${area} ${englishKind}`,
    `${city} ${englishKind} Chinese`,
    `${area} 华人 ${label}`,
    `${city} ${label} 电话`,
    `site:hipages.com.au ${area} ${englishKind}`,
    `site:airtasker.com/au ${area} ${englishKind}`
  ];
}

function scoreLead(row = {}, ctx = {}) {
  const fields = row.fields || {};
  if (
    row.lead_type === 'system' ||
    row.channel === 'agent_learning' ||
    fields.user_visible === false ||
    fields.event === 'agent_learning' ||
    /华伴主动学习|主动学习|AI训练|训练样本/i.test(String(row.name || ''))
  ) {
    return { score: 0, reasons: [], phone: '' };
  }
  const raw = [row.name, row.contact, row.channel, row.need_type, row.message, row.city, row.country, JSON.stringify(fields)].filter(Boolean).join(' ');
  let score = 0;
  const reasons = [];
  const phone = extractPublicPhone(raw);
  if (phone) { score += 25; reasons.push('有公开电话'); }
  if (hasServiceMatch(raw, ctx.kind)) { score += 30; reasons.push(`服务匹配${serviceLabel(ctx.kind)}`); }
  if (ctx.city && raw.toLowerCase().includes(String(ctx.city).toLowerCase())) { score += 15; reasons.push(`城市匹配${ctx.city}`); }
  if (ctx.place && raw.toLowerCase().includes(String(ctx.place).toLowerCase())) { score += 15; reasons.push(`位置接近${ctx.place}`); }
  if (/official_registry|qualification|verified|approved|public_register/i.test(raw)) { score += 10; reasons.push('可做资质核验'); }
  if (/chinese|中文|华人|普通话|粤语/i.test(raw)) { score += 8; reasons.push('中文友好'); }
  if (fields.priority_score === 'A') { score += 8; reasons.push('入口优先级高'); }
  return { score, reasons, phone };
}

function normalizeLead(row = {}, ctx = {}) {
  const scored = scoreLead(row, ctx);
  const fields = row.fields || {};
  return {
    id: row.id || '',
    name: row.name || fields.business_name || fields.provider_name || fields.source_platform || '本地服务线索',
    phone: scored.phone,
    city: row.city || ctx.city || '',
    country: row.country || ctx.country || '',
    source: fields.source_name || fields.source_platform || fields.source || row.channel || '已收录线索',
    sourceUrl: fields.source_url || fields.url || '',
    sourceLabel: sourceLabel(row),
    status: row.status || '待核验',
    score: scored.score,
    reasons: scored.reasons,
    message: row.message || ''
  };
}

function isUsableCandidate(item = {}) {
  if (!item || item.score <= 0) return false;
  if (/华伴主动学习|主动学习|AI训练|训练样本/i.test(String(item.name || ''))) return false;
  if (/agent_learning|learn_/i.test(`${item.source || ''} ${item.message || ''}`)) return false;
  return Boolean(item.phone || item.sourceUrl);
}

async function fetchStoredRows() {
  const q = `tenant_id=eq.${TENANT_ID}&order=created_at.desc&limit=180&select=id,name,contact,channel,lead_type,need_type,city,country,status,message,fields,created_at`;
  const [beta, users, sources] = await Promise.all([
    supa(`beta_leads?${q}`),
    supa(`user_leads?order=created_at.desc&limit=120&select=id,name,contact,channel,lead_type,need_type,city,country,status,message,fields,created_at`),
    supa('source_registry?status=in.(active,review)&order=priority.asc,name.asc&limit=80&select=id,name,url,country,city,source_type,signal_type,priority,status,search_templates,fields')
  ]);
  const sourceAsRows = (Array.isArray(sources) ? sources : []).map((row) => ({
    id: row.id,
    name: row.name,
    contact: `source:${row.url}`,
    channel: 'source_registry',
    lead_type: 'supply',
    need_type: `${row.source_type || ''}_${row.signal_type || ''}`,
    city: row.city,
    country: row.country,
    status: row.status,
    message: `${row.name} ${row.source_type || ''} ${row.signal_type || ''}`,
    fields: { ...(row.fields || {}), source_url: row.url, source_platform: row.name, search_templates: row.search_templates, priority_score: row.priority <= 1 ? 'A' : 'B' }
  }));
  return [...(Array.isArray(beta) ? beta : []), ...(Array.isArray(users) ? users : []), ...sourceAsRows];
}

async function optionalWebSearch(ctx = {}) {
  // Search providers can be connected later without changing the front-end contract.
  // Supported future envs: SERPAPI_KEY, GOOGLE_CSE_ID + GOOGLE_API_KEY, BING_SEARCH_KEY.
  return [];
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const body = req.body || {};
    const text = cleanText(body.text || body.query);
    const city = cleanText(body.city) || 'Melbourne';
    const country = cleanText(body.country) || 'Australia';
    const place = cleanText(body.place);
    const kind = serviceKind(`${body.category || ''} ${text}`);
    const ctx = { text, city, country, place, kind };
    const searchQueries = buildSearchQueries(ctx);
    const rows = await fetchStoredRows();
    const candidates = rows
      .map((row) => normalizeLead(row, ctx))
      .filter(isUsableCandidate)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
    const webResults = await optionalWebSearch(ctx);
    res.status(200).json({
      ok: true,
      query: text,
      city,
      country,
      place,
      serviceKind: kind,
      serviceLabel: serviceLabel(kind),
      searchQueries,
      candidates,
      webResults,
      hasContact: candidates.some((item) => item.phone),
      nextAction: candidates.some((item) => item.phone)
        ? 'show_candidates_and_sms'
        : 'show_search_sources_and_continue_verification'
    });
  } catch (error) {
    console.error('local-search error:', error);
    res.status(500).json({ error: 'local search temporarily unavailable' });
  }
};
