const crypto = require('crypto');

const TENANT_ID = process.env.TENANT_ID || '00000000-0000-0000-0000-000000000001';
const SUPA_URL = process.env.SUPABASE_URL || 'https://gxocvpmgfjvmmkkbswgo.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPA_SERVICE_ROLE_KEY || '';
const SUPPLY_RADAR_STATE_PAGE = 'supply_radar_state';
const SYSTEM_MONITOR_STATE_PAGE = 'system_monitor_state';
const PUBLIC_ORIGIN = (process.env.PUBLIC_ORIGIN || 'https://www.huabanapp.com').replace(/\/+$/, '');

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
  return decodeHtmlEntities(String(value || '').replace(/\u0000/g, '')).trim().slice(0, max);
}

function decodeHtmlEntities(value = '') {
  const named = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' '
  };
  return String(value || '')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
      const key = String(entity || '').toLowerCase();
      if (key[0] === '#') {
        const code = key[1] === 'x' ? parseInt(key.slice(2), 16) : parseInt(key.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }
      return Object.prototype.hasOwnProperty.call(named, key) ? named[key] : match;
    })
    .replace(/\s+/g, ' ');
}

function normalizeAustraliaCity(value = '') {
  const text = cleanText(value, 80);
  const key = text.toLowerCase();
  const map = {
    '墨尔本': 'Melbourne',
    '悉尼': 'Sydney',
    '布里斯班': 'Brisbane',
    '珀斯': 'Perth',
    '阿德莱德': 'Adelaide',
    '堪培拉': 'Canberra',
    '黄金海岸': 'Gold Coast',
    '霍巴特': 'Hobart',
    '达尔文': 'Darwin',
    mel: 'Melbourne',
    syd: 'Sydney',
    bne: 'Brisbane'
  };
  return map[text] || map[key] || text;
}

function inferAustraliaCityFromText(text = '', fallback = '') {
  const body = cleanText(text, 2400).toLowerCase();
  const rules = [
    ['Melbourne', /墨尔本|melbourne|\bvic\b|victoria/],
    ['Sydney', /悉尼|雪梨|sydney|\bnsw\b|new south wales/],
    ['Brisbane', /布里斯班|brisbane|\bqld\b|queensland/],
    ['Perth', /珀斯|perth|\bwa\b|western australia/],
    ['Adelaide', /阿德莱德|adelaide|\bsa\b|south australia/],
    ['Canberra', /堪培拉|canberra|\bact\b/],
    ['Gold Coast', /黄金海岸|gold coast/],
    ['Hobart', /霍巴特|hobart|tasmania|\btas\b/],
    ['Darwin', /达尔文|darwin|northern territory|\bnt\b/]
  ];
  const found = rules.find(([, rx]) => rx.test(body));
  return found ? found[0] : normalizeAustraliaCity(fallback);
}

function hasConflictingCity(expected = '', inferred = '') {
  const a = normalizeAustraliaCity(expected);
  const b = normalizeAustraliaCity(inferred);
  return Boolean(a && b && a.toLowerCase() !== b.toLowerCase());
}

function textMentionsOtherCity(expected = '', text = '') {
  const target = normalizeAustraliaCity(expected).toLowerCase();
  if (!target) return false;
  const body = cleanText(text, 2400).toLowerCase();
  const cityRules = [
    ['melbourne', /墨尔本|melbourne|\bvic\b|victoria/],
    ['sydney', /悉尼|雪梨|sydney|\bnsw\b|new south wales/],
    ['brisbane', /布里斯班|brisbane|\bqld\b|queensland/],
    ['perth', /珀斯|perth|\bwa\b|western australia/],
    ['adelaide', /阿德莱德|adelaide|\bsa\b|south australia/],
    ['canberra', /堪培拉|canberra|\bact\b/],
    ['gold coast', /黄金海岸|gold coast/],
    ['hobart', /霍巴特|hobart|tasmania|\btas\b/],
    ['darwin', /达尔文|darwin|northern territory|\bnt\b/]
  ];
  return cityRules.some(([city, rx]) => city !== target && rx.test(body));
}

function slugParam(value = '', fallback = 'item') {
  const slug = String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
  return slug || fallback;
}

function normalizePhone(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/https?:\/\//i.test(raw) || /www\./i.test(raw) || /@/.test(raw)) return '';
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
  const base = cleanText(seed, 80).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (base.length >= 6) return base.slice(-6);
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

function randomInt(min, max) {
  const low = Math.ceil(Number(min) || 0);
  const high = Math.floor(Number(max) || low);
  return Math.floor(Math.random() * (high - low + 1)) + low;
}

function randomChoice(list = [], fallback = '') {
  const items = Array.isArray(list) ? list.filter(Boolean) : [];
  return items.length ? items[randomInt(0, items.length - 1)] : fallback;
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

function isDuplicateDbError(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('duplicate') || message.includes('23505') || message.includes('unique constraint');
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
  let rows = [];
  let warning = '';
  let eventRows = [];
  let contentFallbackRows = [];
  let eventWarning = '';
  try {
    rows = await supa(`huaban_recruitment_applications?tenant_id=eq.${TENANT_ID}&order=created_at.desc&limit=500&select=id,applicant_name,phone,email,country,city,region_key,role_type,industry,resources,contribution_plan,ref_code,channel,campaign,status,metadata,created_at`);
  } catch (error) {
    warning = cleanText(error.message || '读取报名统计失败', 500);
    rows = [];
  }
  try {
    const events = await supa(`huaban_site_events?tenant_id=eq.${TENANT_ID}&order=created_at.desc&limit=500&select=id,event_name,page_key,page_path,ref_code,channel,campaign,visitor_id,device_type,browser,metadata,created_at`);
    eventRows = buildRecruitmentLeads(Array.isArray(events) ? events : []);
  } catch (error) {
    eventWarning = cleanText(error.message || '读取招募行为线索失败', 500);
    eventRows = [];
  }
  try {
    const contentRows = await supa(`huaban_site_content?tenant_id=eq.${TENANT_ID}&page_key=like.recruitment_fallback_%25&status=eq.draft&order=updated_at.desc&limit=200&select=id,page_key,content,updated_at,created_at`);
    contentFallbackRows = (Array.isArray(contentRows) ? contentRows : []).map(row => normalizeContentFallbackRecruitmentRow(row));
  } catch (error) {
    eventWarning = [eventWarning, cleanText(error.message || '读取报名兜底资料失败', 500)].filter(Boolean).join('；');
    contentFallbackRows = [];
  }
  const list = Array.isArray(rows) ? rows : [];
  const today = todayStartIso();
  const australiaRows = list.filter(row => /australia|澳洲|澳大利亚/i.test(String(row.country || '')) || ['melbourne', 'sydney', 'brisbane', 'perth', 'adelaide', 'canberra', 'gold coast', 'hobart', 'darwin'].some(city => String(row.city || '').toLowerCase().includes(city)));
  const recruitClicks = eventRows.filter(row => /click_recruit|view_recruit_apply/i.test(String(row.event_name || ''))).length;
  const recruitAttempts = eventRows.filter(row => /submit_recruit_start/i.test(String(row.event_name || ''))).length;
  const recruitSuccess = eventRows.filter(row => /submit_recruit_success/i.test(String(row.event_name || ''))).length;
  const recruitErrors = eventRows.filter(row => /submit_recruit_error/i.test(String(row.event_name || ''))).length;
  const fallbackRows = eventRows
    .filter(row => /submit_recruit_fallback_saved/i.test(String(row.event_name || '')))
    .map(row => normalizeFallbackRecruitmentRow(row));
  const allFallbackRows = [...fallbackRows, ...contentFallbackRows]
    .filter((row, index, arr) => arr.findIndex(item => String(item.id || '') === String(row.id || '')) === index)
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  const leadVisitors = new Set(eventRows.map(row => row.visitor_id).filter(Boolean));
  const visitorRows = buildRecruitmentVisitorRows(eventRows);
  return {
    ok: true,
    warning,
    event_warning: eventWarning,
    total: list.length,
    today: list.filter(row => String(row.created_at || '') >= today).length,
    australia: australiaRows.length,
    overseas: list.filter(row => row.country || row.city).length,
    melbourne: list.filter(row => String(row.city || '').toLowerCase().includes('melbourne') || String(row.city || '').includes('墨尔本')).length,
    pending: list.filter(row => ['submitted', 'reviewing'].includes(row.status)).length,
    event_total: eventRows.length,
    event_today: eventRows.filter(row => String(row.created_at || '') >= today).length,
    event_visitors: leadVisitors.size,
    event_recruit_clicks: recruitClicks,
    event_recruit_attempts: recruitAttempts,
    event_recruit_success: recruitSuccess,
    event_recruit_errors: recruitErrors,
    fallback_total: allFallbackRows.length,
    event_high_intent_visitors: visitorRows.filter(row => row.intent_level !== '普通访问').length,
    rows: list.slice(0, 80),
    fallback_rows: allFallbackRows.slice(0, 80),
    event_rows: eventRows.slice(0, 120),
    event_visitor_rows: visitorRows.slice(0, 80)
  };
}

function normalizeContentFallbackRecruitmentRow(row = {}) {
  const content = row.content || {};
  const application = content.application || {};
  return {
    id: content.fallback_id || row.id || row.page_key || '',
    created_at: row.updated_at || row.created_at || content.saved_at || application.metadata?.submitted_at || '',
    applicant_name: application.applicant_name || '',
    phone: application.phone || '',
    email: application.email || '',
    country: application.country || '',
    city: application.city || '',
    region_key: application.region_key || '',
    role_type: application.role_type || '',
    industry: application.industry || '',
    resources: application.resources || '',
    contribution_plan: application.contribution_plan || '',
    ref_code: application.ref_code || '',
    channel: application.channel || '',
    campaign: application.campaign || '',
    status: '待补录',
    review_note: [content.primary_error, content.event_error].filter(Boolean).join(' / ')
  };
}

function normalizeFallbackRecruitmentRow(row = {}) {
  const application = row.metadata?.application || {};
  return {
    id: row.id || '',
    created_at: row.created_at || application.metadata?.submitted_at || '',
    applicant_name: application.applicant_name || '',
    phone: application.phone || '',
    email: application.email || '',
    country: application.country || '',
    city: application.city || '',
    region_key: application.region_key || '',
    role_type: application.role_type || '',
    industry: application.industry || '',
    resources: application.resources || '',
    contribution_plan: application.contribution_plan || '',
    ref_code: application.ref_code || row.ref_code || '',
    channel: application.channel || row.channel || '',
    campaign: application.campaign || row.campaign || '',
    status: '待补录',
    review_note: row.metadata?.fallback_reason || ''
  };
}

function isRecruitmentEvent(row = {}) {
  const eventName = String(row.event_name || '').toLowerCase();
  const pageKey = String(row.page_key || '').toLowerCase();
  const pagePath = String(row.page_path || '').toLowerCase();
  const campaign = String(row.campaign || '').toLowerCase();
  return pageKey === 'recruit'
    || pagePath.includes('recruit')
    || eventName.includes('recruit')
    || campaign.includes('recruit');
}

function buildRecruitmentLeads(rows = []) {
  return rows
    .filter(isRecruitmentEvent)
    .map(row => ({
      ...row,
      source_label: [row.ref_code, row.channel, row.campaign].filter(Boolean).join(' / ') || '自然进入',
      action_label: recruitmentActionLabel(row.event_name),
      visitor_label: cleanText(row.visitor_id || '', 120).slice(0, 18) || '未知访客'
    }));
}

function buildRecruitmentVisitorRows(rows = []) {
  const groups = new Map();
  for (const row of rows) {
    const key = row.visitor_id || `unknown-${row.id || row.created_at || groups.size}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.entries()].map(([visitorId, items]) => {
    const sorted = items.slice().sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
    const clicks = items.filter(row => /click_recruit|view_recruit_apply/i.test(String(row.event_name || ''))).length;
    const attempts = items.filter(row => /submit_recruit_start/i.test(String(row.event_name || ''))).length;
    const successes = items.filter(row => /submit_recruit_success|submit_recruit_fallback_saved/i.test(String(row.event_name || ''))).length;
    const errors = items.filter(row => /submit_recruit_error/i.test(String(row.event_name || ''))).length;
    const views = items.filter(row => /page_view|访问招募页/i.test(String(row.event_name || row.action_label || ''))).length || items.length - clicks - attempts - successes - errors;
    const sourceLabel = [...new Set(items.map(row => row.source_label).filter(Boolean))].join(' | ') || '自然进入';
    const devices = [...new Set(items.map(row => [row.device_type, row.browser].filter(Boolean).join(' / ')).filter(Boolean))].join(' | ');
    const intentLevel = successes > 0 ? '已提交'
      : attempts > 0 ? '提交未完成'
      : clicks > 0 || items.length >= 8 ? '高意向'
      : items.length >= 3 ? '持续关注'
      : '普通访问';
    return {
      visitor_id: visitorId,
      visitor_label: cleanText(visitorId, 120).slice(0, 18) || '未知访客',
      first_seen_at: sorted[0]?.created_at || '',
      last_seen_at: sorted[sorted.length - 1]?.created_at || '',
      event_count: items.length,
      view_count: views,
      click_count: clicks,
      attempt_count: attempts,
      success_count: successes,
      error_count: errors,
      source_label: sourceLabel,
      device_label: devices,
      intent_level: intentLevel
    };
  }).sort((a, b) => {
    const rank = { '高意向': 3, '持续关注': 2, '普通访问': 1 };
    return (rank[b.intent_level] || 0) - (rank[a.intent_level] || 0)
      || b.event_count - a.event_count
      || b.click_count - a.click_count;
  });
}

function recruitmentActionLabel(eventName = '') {
  const key = String(eventName || '').toLowerCase();
  if (key === 'page_view') return '访问招募页';
  if (key.includes('submit_recruit_fallback_saved')) return '待补录保存';
  if (key.includes('submit_recruit_success')) return '提交成功';
  if (key.includes('submit_recruit_error')) return '提交失败';
  if (key.includes('submit_recruit_start')) return '提交报名中';
  if (key.includes('view_recruit_apply')) return '查看报名页';
  if (key.includes('click_recruit')) return '点击报名入口';
  return eventName || '页面动作';
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

const INDUSTRY_PRESETS = {
  airport_pickup: { label: '接送机', pain: '客源不稳定、沟通反复、临时改时间容易乱。', desire: '让客户一句话说清楚航班、人数、行李和目的地。' },
  auto_repair: { label: '汽车维修', pain: '客户问价多、信任建立慢、问题描述不清楚。', desire: '先让华伴帮客户整理车型、故障、预算和到店时间。' },
  home_repair: { label: '水电维修', pain: '客户着急但说不清故障，师傅也怕白跑一趟。', desire: '先收集位置、照片、故障、时间，再匹配合适师傅。' },
  housekeeping: { label: '家政清洁', pain: '需求细节多，房型、面积、时间和标准容易说不清。', desire: '先把服务范围、时间、地址和价格确认清楚。' },
  accounting: { label: '会计税务', pain: '客户不知道要准备什么资料，反复沟通耗时间。', desire: '先让华伴整理身份、业务类型、收入支出和申报时间。' },
  immigration: { label: '移民留学', pain: '客户问题复杂，资料多，初次咨询难筛选。', desire: '先把身份、目标、时间线和资料缺口整理出来。' },
  real_estate: { label: '房产服务', pain: '客户需求分散，预算、区域、学区、通勤很难一次讲清。', desire: '先把买租目标、区域、预算和关键条件整理成卡片。' },
  used_car: { label: '二手车', pain: '买卖双方怕信息不透明，车况、价格和验车安排反复拉扯。', desire: '先把车型、预算、车况、地点和验车方式整理清楚。' },
  education: { label: '留学教育', pain: '家长和学生目标不同，课程、时间、预算容易混乱。', desire: '先把年级、目标、时间和服务范围整理出来。' },
  restaurant: { label: '餐饮外卖', pain: '菜单、位置、配送和团购信息分散，客户下单路径长。', desire: '让华伴把商品、价格、配送范围和下单方式说清楚。' },
  generic_service: { label: '本地服务', pain: '好服务藏在群里，客户找不到，服务者也不知道谁真正需要。', desire: '让华伴把服务和需求整理成能被匹配的数据。' }
};

const CHANNEL_PRESETS = {
  wechat_group: '微信群',
  moments: '朋友圈',
  xiaohongshu: '小红书',
  facebook_group: 'Facebook 华人群',
  forum: '本地论坛',
  website_card: '名片链接'
};

function growthLandingUrl({ refCode, campaign, painKey, industryKey, city, channel }) {
  const params = new URLSearchParams({
    ref: refCode || 'HUABAN',
    campaign,
    industry: industryKey,
    pain: painKey,
    city,
    channel
  });
  return `https://www.huabanapp.com/ai.html?${params.toString()}`;
}

function generateGrowthTask(input = {}) {
  const city = cleanText(input.city || 'Melbourne', 80);
  const country = cleanText(input.country || 'Australia', 80);
  const supplierName = cleanText(input.supplier_name || input.supplierName || '', 100);
  const industryKey = slugParam(input.industry || input.service_type || 'generic_service', 'generic_service');
  const preset = INDUSTRY_PRESETS[industryKey] || INDUSTRY_PRESETS.generic_service;
  const industryLabel = cleanText(input.industry_label || preset.label, 80);
  const serviceDescription = cleanText(input.service_description || input.serviceDescription || '', 700);
  const refCode = cleanText(input.ref_code || input.refCode || 'HUABAN', 80);
  const channel = cleanText(input.channel || 'wechat_group', 40);
  const channelLabel = CHANNEL_PRESETS[channel] || channel || '手动渠道';
  const sourceName = cleanText(input.source_name || channelLabel, 120);
  const sourceUrl = cleanText(input.source_url || input.sourceUrl || '', 500);
  const painKey = `${industryKey}_pain`;
  const campaign = cleanText(input.campaign || `${slugParam(city, 'city')}_${industryKey}_supplier_v1`, 100);
  const landingUrl = growthLandingUrl({ refCode, campaign, painKey, industryKey, city, channel });
  const serviceLine = serviceDescription || `${city} ${industryLabel}服务`;
  const adLine = `客户找不到你，你也找不到真正需要你的人。让华伴先帮你把${industryLabel}服务说清楚、传出去。`;
  const shortCopy = `${industryLabel}从业者可以先试试华伴：生成可分享名片，记录客户需求，后续让 AI 帮你整理沟通和确认交易。${landingUrl}`;
  const longCopy = [
    `你在${city}做${industryLabel}吗？`,
    preset.pain,
    preset.desire,
    '华伴不抽佣、不赚差价。先下载、使用、分享。华伴的未来，就有你。',
    landingUrl
  ].join('\n');
  const posterHeadline = `${city}${industryLabel}，先让客户找到你`;
  const videoScript = [
    '镜头一：服务者忙着接电话、回消息，客户问题零散。',
    `旁白：${preset.pain}`,
    '镜头二：华伴把服务范围、价格、时间、地点和联系方式整理成名片。',
    `旁白：${preset.desire}`,
    '镜头三：客户点击“去看看”，进入华伴了解并发起需求。',
    '旁白：下载、使用、分享。华伴的未来，就有你。'
  ].join('\n');
  return {
    tenant_id: TENANT_ID,
    source_name: sourceName,
    source_url: sourceUrl,
    country,
    city,
    audience: 'supplier',
    channel_level: 'B_manual_review',
    status: 'needs_review',
    title: `${city}${industryLabel}供给侧获客`,
    copy_short: shortCopy,
    copy_long: longCopy,
    landing_url: landingUrl,
    compliance_notes: '人工确认后再投放；不承诺收益、不自动群发、不绕过平台规则。',
    daily_target: { max_posts: 3, manual_review_required: true },
    metrics: { generated: 1, published: 0, feedback_recorded: 0 },
    fields: {
      supplier_name: supplierName,
      industry_key: industryKey,
      industry_label: industryLabel,
      service_description: serviceLine,
      pain_key: painKey,
      pain_point: preset.pain,
      desired_result: preset.desire,
      ad_line: adLine,
      channel,
      channel_label: channelLabel,
      campaign,
      ref_code: refCode,
      tracking_params: { ref: refCode, campaign, industry: industryKey, pain: painKey, city, channel },
      asset_package: {
        poster_headline: posterHeadline,
        qr_caption: '扫码去看看华伴',
        cover_copy: adLine,
        voiceover: `如果你在${city}提供${industryLabel}服务，华伴可以先帮你把服务说清楚，再让真正需要的人找到你。`,
        video_script: videoScript
      },
      approval_flow: ['通过', '修改', '暂不投', '已发布', '有反馈'],
      generated_by: 'huaban_growth_workbench_v1'
    }
  };
}

async function getOutreachReport() {
  const rows = await supa(`outreach_tasks?tenant_id=eq.${TENANT_ID}&order=created_at.desc&limit=120&select=id,title,source_name,source_url,country,city,audience,channel_level,status,copy_short,copy_long,landing_url,compliance_notes,daily_target,metrics,fields,scheduled_at,published_at,created_at,updated_at`);
  const list = Array.isArray(rows) ? rows : [];
  const today = todayStartIso();
  return {
    ok: true,
    total: list.length,
    today: list.filter(row => String(row.created_at || '') >= today).length,
    needs_review: list.filter(row => row.status === 'needs_review').length,
    published: list.filter(row => row.status === 'published').length,
    feedback: list.reduce((sum, row) => sum + Number(row.metrics?.feedback_recorded || 0), 0),
    rows: list
  };
}

function rowText(row = {}) {
  const fields = supplyFields(row);
  return [
    row.name,
    row.contact,
    row.city,
    row.source_city,
    row.country,
    row.service_type,
    row.service_type_code,
    row.category,
    row.service_area,
    row.intro,
    row.website,
    row.public_verification_url,
    row.availability,
    fields.vehicle_types,
    fields.availability,
    fields.service_area,
    fields.pickup_range,
    fields.capacity_notes
  ].map(value => String(value || '').toLowerCase()).join(' ');
}

function supplyCity(row = {}) {
  return row.source_city || row.city || '';
}

function supplyCategory(row = {}) {
  return canonicalSupplyMinor(row.service_type || row.category || row.service_type_code || '本地服务');
}

function supplyTaskText(row = {}) {
  return [
    row.city,
    row.state,
    row.language_lane,
    row.category_code,
    row.category_name,
    row.search_query,
    row.source_name,
    row.source_url,
    row.status
  ].map(value => String(value || '').toLowerCase()).join(' ');
}

function processingRowText(row = {}) {
  const entity = row.extracted_entities || {};
  return [
    row.item_type,
    row.capture_type,
    row.source_name,
    row.source_url,
    row.source_city,
    row.language_hint,
    row.status,
    row.raw_text,
    entity.name,
    entity.business_name,
    entity.contact_phone,
    entity.city,
    entity.category_name,
    entity.service_type,
    entity.intro,
    entity.source_evidence
  ].map(value => String(value || '').toLowerCase()).join(' ');
}

function firstText(...values) {
  for (const value of values) {
    const text = cleanText(value, 500);
    if (text) return text;
  }
  return '';
}

function safeUrl(value = '') {
  const text = cleanText(value, 700);
  if (!/^https?:\/\//i.test(text)) return '';
  try {
    const url = new URL(text);
    return url.href.slice(0, 500);
  } catch (error) {
    return '';
  }
}

function isPlaceholderEmail(email = '') {
  const text = String(email || '').trim().toLowerCase();
  if (!text) return true;
  return /@(example|test|invalid|domain)\./i.test(text)
    || /^(name|email|user|yourname|someone|info@example)\@/i.test(text)
    || text.includes('example.com')
    || text.includes('yourdomain')
    || text.includes('sample.');
}

function looksLikeUrl(value = '') {
  return /^https?:\/\//i.test(String(value || '').trim()) || /^www\./i.test(String(value || '').trim());
}

function normalizedDedupeKey({ name = '', phone = '', email = '', website = '', city = '', serviceType = '' } = {}) {
  const normalizedPhone = normalizePhone(phone);
  const normalizedEmail = isPlaceholderEmail(email) ? '' : String(email || '').trim().toLowerCase();
  const normalizedUrl = safeUrl(website).replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '').toLowerCase();
  const businessName = cleanText(name, 140).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, ' ').trim();
  const geo = normalizeAustraliaCity(city).toLowerCase();
  const kind = canonicalSupplyMinor(serviceType).toLowerCase();
  return sha256([normalizedPhone || normalizedEmail || normalizedUrl || businessName, geo, kind].filter(Boolean).join('|'));
}

function canonicalSupplyMinor(value = '') {
  const raw = cleanText(value, 120);
  const text = raw.toLowerCase();
  if (/接送机|机场接送|机场接机|机场送机|接机|送机|airport\s*(pickup|transfer|shuttle)|airport_pickup|airport_transfer/.test(text)) return '接送机';
  if (/汽车租赁|租车|车辆租赁|car\s*rent|car\s*rental|car_hire|vehicle\s*rental/.test(text)) return '汽车租赁';
  if (/修车|汽修|汽车维修|保养|mechanic|auto\s*repair|car\s*repair/.test(text)) return '汽车维修';
  if (/二手车|used\s*car|second\s*hand\s*car/.test(text)) return '二手车';
  if (/割草|草坪|园艺|lawn|mowing|gardening|garden/.test(text)) return '割草园艺';
  if (/水管|plumb|漏水|马桶/.test(text)) return '水管维修';
  if (/电工|electrician|electrical|插座|电路/.test(text)) return '电工';
  if (/中文学校|中文课|mandarin|chinese\s*(school|class)/.test(text)) return '中文学校';
  if (/兴趣班|after\s*school|kids?\s*(class|activity)|art\s*class|dance\s*class|music\s*class/.test(text)) return '儿童兴趣班';
  if (/海鲜|水产|龙虾|seafood|lobster/.test(text)) return '海鲜水产';
  if (/锅|厨具|cookware|kitchenware|wok|pan|pot/.test(text)) return '厨具';
  if (/瓷砖|建材|tile|tiles|building\s*material|hardware/.test(text)) return '建材';
  if (/果树|苗圃|花卉|nursery|fruit\s*tree|plants?/.test(text)) return '花卉苗木';
  if (/会计|税务|accounting|accountant|tax/.test(text)) return '会计税务';
  if (/移民|签证|留学|migration|visa|education\s*agent/.test(text)) return '移民留学';
  return raw || '未细分';
}

function canonicalSupplyCode(value = '', fallbackLabel = '') {
  const label = canonicalSupplyMinor([value, fallbackLabel].filter(Boolean).join(' '));
  if (label === '接送机') return 'airport_pickup';
  if (label === '汽车租赁') return 'car_rental';
  if (label === '汽车维修') return 'auto_repair';
  if (label === '二手车') return 'used_car';
  if (label === '割草园艺') return 'gardening';
  if (label === '水管维修') return 'plumber';
  if (label === '电工') return 'electrician';
  if (label === '中文学校') return 'chinese_school';
  if (label === '儿童兴趣班') return 'kids_activity';
  if (label === '海鲜水产') return 'seafood';
  if (label === '厨具') return 'kitchenware';
  if (label === '建材') return 'building_materials';
  if (label === '花卉苗木') return 'plants_flowers';
  if (label === '会计税务') return 'accounting';
  if (label === '移民留学') return 'migration';
  return slugParam(value || fallbackLabel || 'generic_service', 'generic_service');
}

function supplyBoardFor(minor = '', code = '') {
  const label = canonicalSupplyMinor([minor, code].filter(Boolean).join(' '));
  const normalizedCode = canonicalSupplyCode(code || '', label);
  if (['服装', '改衣', '洗衣', '美甲', '美发', '美容'].some(word => label.includes(word))) return '衣';
  if (['seafood', 'kitchenware', 'asian_grocery'].includes(normalizedCode) || /餐|食|超市|海鲜|水产|龙虾|厨具|锅|私厨|外卖/.test(label)) return '食';
  if (['building_materials', 'plants_flowers', 'gardening', 'plumber', 'electrician'].includes(normalizedCode) || /房|住|搬家|清洁|家政|维修|水管|电工|建材|瓷砖|家具|家电|花卉|苗木|果树|园艺|割草/.test(label)) return '住';
  if (['airport_pickup', 'car_rental', 'auto_repair', 'used_car'].includes(normalizedCode) || /接送机|租车|修车|二手车|包车|驾校|拖车|物流|出行|交通/.test(label)) return '行';
  if (['chinese_school', 'kids_activity'].includes(normalizedCode) || /学校|补习|兴趣班|留学|培训|课程|家教|中文/.test(label)) return '学';
  if (/医疗|诊所|中医|牙医|心理|陪诊|药房|月子/.test(label)) return '医';
  if (['accounting'].includes(normalizedCode) || /会计|税务|报税|保险|贷款|换汇|财务/.test(label)) return '财';
  if (/律师|法律|合同|公证/.test(label)) return '法';
  if (['migration'].includes(normalizedCode) || /移民|签证|证件|翻译|代办|跑腿|帮办|互助/.test(label)) return '办事';
  if (/旅游|地陪|摄影|活动|聚会|运动|娱乐|圈子|交友/.test(label)) return '娱乐';
  if (/商家|餐馆|零售|批发|代购|门店/.test(label)) return '商家';
  if (/招聘|获客|推广|短视频|网站|AI|社群/.test(label)) return '生意';
  return '本地服务';
}

function supplyFields(row = {}) {
  return row.fields && typeof row.fields === 'object' ? row.fields : {};
}

function normalizeTextList(value = '', maxItems = 12) {
  const source = Array.isArray(value) ? value.join(',') : String(value || '');
  return Array.from(new Set(source
    .split(/[,，、;/\n]+/)
    .map(item => cleanText(item, 60))
    .filter(Boolean)
  )).slice(0, maxItems);
}

function extractSupplyCapabilities(text = '', body = {}) {
  const source = cleanText([
    text,
    body.source_text,
    body.intro,
    body.service_description,
    body.notes,
    body.name,
    body.service_type
  ].filter(Boolean).join(' '), 5000);
  const lower = source.toLowerCase();
  const vehicleTypes = new Set(normalizeTextList(body.vehicle_types || body.vehicle_type || body.car_type, 10));
  [
    [/5\s*(座|seater|seat)|五座|sedan|轿车/i, '5座'],
    [/7\s*(座|seater|seat)|七座|people mover|mpv/i, '7座'],
    [/8\s*(座|seater|seat)|八座|minibus|van/i, '8座/商务车'],
    [/suv|越野|四驱|q7|kluger|highlander/i, 'SUV'],
    [/luxury|chauffeur|豪华|奔驰|宝马|奥迪/i, '豪华车'],
    [/taxi|cab|出租/i, '出租车'],
    [/shuttle|班车|接驳/i, '机场接驳车']
  ].forEach(([rx, label]) => {
    if (rx.test(source)) vehicleTypes.add(label);
  });
  const availabilityParts = new Set(normalizeTextList(body.availability || body.available_time || body.service_hours, 10));
  [
    [/24\s*\/\s*7|24\s*hours?|24小时|全天/i, '24小时'],
    [/early morning|清晨|凌晨|夜间|night/i, '夜间/清晨可接'],
    [/7\s*days?|every day|每天|全年/i, '每天'],
    [/office hours|营业时间|9\s*am|5\s*pm|工作日/i, '营业时间']
  ].forEach(([rx, label]) => {
    if (rx.test(source)) availabilityParts.add(label);
  });
  const serviceArea = cleanText(
    body.service_area
    || body.coverage_area
    || body.pickup_area
    || body.address
    || body.normalized_address
    || '',
    260
  );
  return {
    vehicle_types: Array.from(vehicleTypes).slice(0, 10),
    availability: cleanText(Array.from(availabilityParts).join('、'), 180),
    service_area: serviceArea,
    pickup_range: cleanText(body.pickup_range || body.coverage_area || serviceArea, 260),
    capacity_notes: cleanText(body.capacity_notes || body.vehicle_notes || '', 260),
    capability_text: cleanText(source, 1200)
  };
}

function isCollectionTaskDraft(row = {}) {
  const fields = supplyFields(row);
  return row.source_mode === 'public_collection_task'
    || row.verification_status === 'pending_collection'
    || fields.pending_real_supplier_extraction === true;
}

function hasSupplyContact(row = {}) {
  const fields = supplyFields(row);
  return Boolean(
    normalizePhone(row.normalized_contact || row.claimed_phone || fields.normalized_phone || fields.phone || row.contact)
    || (!isPlaceholderEmail(fields.email || row.email) && cleanText(fields.email || row.email, 160))
  );
}

function isPublicSearchSupply(row = {}) {
  return ['public_search', 'admin_review_queue'].includes(row.source_mode)
    || ['brave', 'serpapi', 'bing', 'review_queue'].includes(row.source_channel);
}

function normalizeSupplyProfileRow(row = {}) {
  const fields = supplyFields(row);
  const contactPhone = firstText(row.normalized_contact, row.claimed_phone, fields.normalized_phone, fields.phone, row.contact);
  const email = firstText(fields.email, row.email);
  const industryMinor = canonicalSupplyMinor(firstText(row.industry_minor, fields.industry_minor, row.service_type, row.service_type_code));
  return {
    ...row,
    industry_major: firstText(row.industry_major, fields.industry_major, row.category, row.service_type, '本地服务'),
    industry_minor: industryMinor,
    service_type: industryMinor,
    service_type_code: canonicalSupplyCode(row.service_type_code, industryMinor),
    contact_name: firstText(row.contact_name, fields.contact_name),
    display_address: firstText(row.normalized_address, fields.address, fields.normalized_address, row.address, row.service_area),
    display_phone: contactPhone,
    display_email: email,
    display_contact: [contactPhone, email].filter(Boolean).join(' / ') || firstText(row.contact, fields.contact),
    capability_summary: [
      normalizeTextList(fields.vehicle_types || fields.vehicle_type).join('、'),
      firstText(row.availability, fields.availability),
      firstText(row.service_area, fields.service_area, fields.pickup_range)
    ].filter(Boolean).join(' · ')
  };
}

async function getSupplyProfilesReport(query = {}) {
  const fullSelect = [
    'id,name,contact,city,country,service_type,service_type_code,category,service_area,price_text,availability,intro,qualification',
    'public_verification_url,website,verification_status,status,completeness_score,source_mode,source_channel,supplier_code,created_at,updated_at',
    'language_lane,service_languages,market_scope,source_country,source_state,source_city,source_suburb,normalized_contact,normalized_address,collection_task_id',
    'dedupe_key,first_seen_at,last_seen_at,duplicate_count,source_urls,fields'
  ].join(',');
  const baseSelect = [
    'id,name,contact,city,country,service_type,service_type_code,category,service_area,price_text,availability,intro,qualification',
    'public_verification_url,website,verification_status,status,completeness_score,source_mode,source_channel,supplier_code,created_at,updated_at,fields'
  ].join(',');
  const limit = Math.min(Math.max(Number(query.limit || 500), 50), 1000);
  const path = select => `huaban_supply_profiles?tenant_id=eq.${TENANT_ID}&order=updated_at.desc&limit=${limit}&select=${select}`;
  let rows;
  try {
    rows = await supa(path(fullSelect));
  } catch (error) {
    rows = await supa(path(baseSelect));
  }
  const all = (Array.isArray(rows) ? rows : []).filter(row => !isCollectionTaskDraft(row) && (!isPublicSearchSupply(row) || hasSupplyContact(row)));
  const q = cleanText(query.q || '', 120).toLowerCase();
  const city = normalizeAustraliaCity(query.city || '').toLowerCase();
  const lang = cleanText(query.lang || query.language_lane || '', 20).toLowerCase();
  const status = cleanText(query.status || '', 40).toLowerCase();
  const category = cleanText(query.category || '', 80).toLowerCase();
  const filtered = all.filter(row => {
    if (q && !rowText(row).includes(q)) return false;
    if (city && !String(supplyCity(row)).toLowerCase().includes(city)) return false;
    if (lang && lang !== 'all' && String(row.language_lane || 'unknown').toLowerCase() !== lang) return false;
    if (status && status !== 'all' && String(row.status || '').toLowerCase() !== status) return false;
    if (
      category
      && category !== 'all'
      && !String(supplyCategory(row)).toLowerCase().includes(category)
      && !String(canonicalSupplyCode(row.service_type_code, row.service_type || row.category)).toLowerCase().includes(category)
    ) return false;
    return true;
  });
  const citySet = new Set(filtered.map(supplyCity).filter(Boolean));
  const categorySet = new Set(filtered.map(supplyCategory).filter(Boolean));
  return {
    ok: true,
    total: filtered.length,
    all_loaded: all.length,
    with_contact: filtered.filter(hasSupplyContact).length,
    zh: filtered.filter(row => row.language_lane === 'zh').length,
    en: filtered.filter(row => row.language_lane === 'en').length,
    pending: filtered.filter(row => ['candidate', 'pending_review'].includes(row.status) || row.verification_status === 'pending_review').length,
    cities: citySet.size,
    categories: categorySet.size,
    rows: filtered.slice(0, 300).map(normalizeSupplyProfileRow)
  };
}

async function getSupplyCollectionTasksReport(query = {}) {
  const limit = Math.min(Math.max(Number(query.limit || 500), 50), 1000);
  const rows = await supa(`huaban_supply_collection_tasks?tenant_id=eq.${TENANT_ID}&order=created_at.desc&limit=${limit}&select=id,run_id,task_date,country,state,city,language_lane,category_code,category_name,search_query,source_name,source_url,status,priority,capture_count,extracted_count,stored_count,error_message,fields,created_at,updated_at`);
  const all = Array.isArray(rows) ? rows : [];
  const q = cleanText(query.q || '', 120).toLowerCase();
  const city = normalizeAustraliaCity(query.city || '').toLowerCase();
  const lang = cleanText(query.lang || query.language_lane || '', 20).toLowerCase();
  const status = cleanText(query.status || '', 40).toLowerCase();
  const filtered = all.filter(row => {
    if (q && !supplyTaskText(row).includes(q)) return false;
    if (city && !String(row.city || '').toLowerCase().includes(city)) return false;
    if (lang && lang !== 'all' && String(row.language_lane || '').toLowerCase() !== lang) return false;
    if (status && status !== 'all' && String(row.status || '').toLowerCase() !== status) return false;
    return true;
  });
  const citySet = new Set(filtered.map(row => row.city).filter(Boolean));
  const categorySet = new Set(filtered.map(row => row.category_name || row.category_code).filter(Boolean));
  return {
    ok: true,
    total: filtered.length,
    all_loaded: all.length,
    queued: filtered.filter(row => row.status === 'queued').length,
    captured: filtered.filter(row => row.status === 'captured').length,
    processed: filtered.filter(row => row.status === 'processed').length,
    stored: filtered.filter(row => row.status === 'stored').length,
    failed: filtered.filter(row => row.status === 'failed').length,
    zh: filtered.filter(row => row.language_lane === 'zh').length,
    en: filtered.filter(row => row.language_lane === 'en').length,
    cities: citySet.size,
    categories: categorySet.size,
    rows: filtered.slice(0, 300)
  };
}

async function getSupplyProcessingReport(query = {}) {
  const limit = Math.min(Math.max(Number(query.limit || 300), 30), 600);
  const rawPromise = supa(`raw_captures?tenant_id=eq.${TENANT_ID}&order=created_at.desc&limit=${limit}&select=id,capture_type,source_name,source_platform,source_url,source_country,source_state,source_city,language_hint,acquisition_method,status,raw_text,media_urls,processing_attempts,last_error,fields,created_at,updated_at`).catch(() => []);
  const reviewPromise = supa(`review_queue?tenant_id=eq.${TENANT_ID}&order=created_at.desc&limit=${limit}&select=id,queue_type,priority,status,reason_codes,review_note,raw_capture_id,extracted_entity_id,fields,created_at,updated_at,extracted_entities(name,business_name,contact_phone,wechat,email,website,address,country,state,city,suburb,language_lane,category_name,service_type,service_type_code,service_area,intro,confidence,completeness_score,review_status,source_evidence)`).catch(async () => {
    return supa(`review_queue?tenant_id=eq.${TENANT_ID}&order=created_at.desc&limit=${limit}&select=id,queue_type,priority,status,reason_codes,review_note,raw_capture_id,extracted_entity_id,fields,created_at,updated_at`).catch(() => []);
  });
  const [rawRows, reviewRows] = await Promise.all([rawPromise, reviewPromise]);
  const raw = (Array.isArray(rawRows) ? rawRows : []).map(row => ({ ...row, item_type: 'raw_capture' }));
  const review = (Array.isArray(reviewRows) ? reviewRows : []).map(row => ({ ...row, item_type: 'review_queue' }));
  const all = [...review, ...raw].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  const q = cleanText(query.q || '', 120).toLowerCase();
  const city = cleanText(query.city || '', 80).toLowerCase();
  const lang = cleanText(query.lang || query.language_lane || '', 20).toLowerCase();
  const status = cleanText(query.status || '', 40).toLowerCase();
  const filtered = all.filter(row => {
    const entity = row.extracted_entities || {};
    const rowCity = row.source_city || entity.city || '';
    const rowLang = row.language_hint || entity.language_lane || '';
    if (q && !processingRowText(row).includes(q)) return false;
    if (city && !String(rowCity).toLowerCase().includes(city)) return false;
    if (lang && lang !== 'all' && String(rowLang || 'unknown').toLowerCase() !== lang) return false;
    if (status && status !== 'all' && String(row.status || '').toLowerCase() !== status) return false;
    return true;
  });
  return {
    ok: true,
    total: filtered.length,
    raw_total: raw.length,
    review_total: review.length,
    open_review: review.filter(row => ['open', 'in_review'].includes(row.status)).length,
    queued_raw: raw.filter(row => ['queued', 'failed'].includes(row.status)).length,
    extracted_raw: raw.filter(row => ['extracted', 'reviewing'].includes(row.status)).length,
    stored_raw: raw.filter(row => row.status === 'stored').length,
    zh: filtered.filter(row => (row.language_hint || row.extracted_entities?.language_lane) === 'zh').length,
    en: filtered.filter(row => (row.language_hint || row.extracted_entities?.language_lane) === 'en').length,
    rows: filtered.slice(0, 300)
  };
}

const FEATURE_PLUGIN_LIBRARY = [
  { key: 'ai_assistant', name: '华伴 AI 主助手', status: 'online', progress: 100, scope: '用户端', current_state: '/ai 已接入启动页、规则问答和基础服务入口。', next_step: '继续收敛公开文案，避免暴露内部策略。' },
  { key: 'ai_workflow_engine', name: 'AI 工作流内核', status: 'building', progress: 42, scope: '智能体', current_state: '用户端已开始接入需求整理、供给搜索和直接联系流程。', next_step: '把供给搜索、联系方式识别、积分账本继续注册为 AI 可调用工具。' },
  { key: 'phone_identity', name: '手机号验证与身份归集', status: 'online', progress: 100, scope: '账号', current_state: '手机号注册、身份同步和推荐绑定走后台接口。', next_step: '补充异常登录与设备归集报表。' },
  { key: 'profile_card_share', name: '名片与分享入口', status: 'online', progress: 92, scope: '推广飞轮', current_state: '名片分享和进入华伴按钮已作为主推广入口。', next_step: '统一固定推广语和来源追踪字段。' },
  { key: 'points_ledger', name: '积分后台账本', status: 'online', progress: 88, scope: '积分', current_state: '注册、保存资料、分享等积分反馈以后台流水为准。', next_step: '继续补齐候补、回流、分配批次审计视图。' },
  { key: 'supply_profiles', name: '供给资料后台', status: 'online', progress: 86, scope: '供给', current_state: '真实供应商明细、采集任务、待处理资料已分开展示。', next_step: '持续提升公开搜索提取质量。' },
  { key: 'manual_supply_collect', name: '手动小批量采集', status: 'online', progress: 82, scope: '供给', current_state: '管理员手动触发 Brave Search，清洗后写入供给明细。', next_step: '增加更多字段置信度和人工复核入口。' },
  { key: 'growth_workbench', name: '推广工作台', status: 'online', progress: 78, scope: '运营', current_state: '推广任务、素材和链接追踪可在后台查看。', next_step: '接入共创者、共建者分批招募看板。' },
  { key: 'distribution_rules_console', name: '分配规则控制台', status: 'building', progress: 72, scope: '积分分配', current_state: '内部规则 SQL 已落表，后台开始接入分配规则、回流原因、候补队列。', next_step: '增加分配批次模拟和审批留痕。' },
  { key: 'waitlist_reflow', name: '候补与回流插件', status: 'building', progress: 64, scope: '积分池', current_state: '固定积分池、候补记账、回流原因已有数据结构。', next_step: '实现回流后按候补顺序转有效的后台任务。' },
  { key: 'claimable_supply_card', name: '待认领名片', status: 'building', progress: 58, scope: '供给', current_state: '后台可先录入朋友资料，手机号验证后认领仍需完善前端流程。', next_step: '完成认领提示、资料确认和重复手机号合并。' },
  { key: 'emergency_help', name: '紧急互助', status: 'building', progress: 42, scope: '本地服务', current_state: '需求记录已有紧急标记和人工确认状态。', next_step: '补充附近服务者提醒和人工值守规则。' },
  { key: 'in_app_calling', name: '服务者呼叫', status: 'planned', progress: 12, scope: '本地服务', current_state: '当前先用蓝色电话链接直拨服务者。', next_step: '用户和服务者普及后，升级为华伴内置呼叫和联系记录。' },
  { key: 'friend_voice_call', name: '好友语音通话', status: 'planned', progress: 10, scope: '社区', current_state: '已明确为好友之间的语音聊天，不属于华伴 AI 对话，也不属于服务者直拨。', next_step: '设计好友关系、呼叫邀请、响铃接听、挂断、通话记录和隐私设置。' },
  { key: 'appointment_calendar', name: '日程提醒', status: 'planned', progress: 20, scope: '本地服务', current_state: '尚未上线。', next_step: '先做轻量提醒和联系记录，不代预约、不介入交易。' },
  { key: 'local_circles', name: '圈子群聊', status: 'building', progress: 32, scope: '社区', current_state: '定义为共同兴趣或共同目的的群聊，前台已恢复入口说明。', next_step: '补城市、主题、成员、加入规则和消息表。' },
  { key: 'friend_match', name: '1V1 交友匹配', status: 'planned', progress: 14, scope: '社区', current_state: '定义为个人资料、找朋友条件和双方同意后的交流。', next_step: '补个人交友资料、匹配条件、同意机制和屏蔽举报。' },
  { key: 'image_tool', name: '图片识别与整理', status: 'building', progress: 28, scope: 'AI 工具', current_state: '前台已恢复拍照/选图入口，当前先做聊天展示和资料整理提示。', next_step: '接入图片识别、截图提取、找同款和供给资料入库。' },
  { key: 'business_center', name: '店铺与商务中心', status: 'planned', progress: 16, scope: '商家', current_state: '由名片能力逐步升级。', next_step: '围绕供应商资料、案例、服务包扩展。' },
  { key: 'version_2_matching', name: '2.0 智能匹配增强', status: 'planned', progress: 14, scope: '华伴 2.0', current_state: '需求、供给、名片和联系记录作为前置数据。', next_step: '设计跨城市、多语言、多 AI 协同匹配。' },
  { key: 'creator_recruitment', name: '共创者 / 共建者招募看板', status: 'planned', progress: 12, scope: '推广', current_state: '首批与第二批积分释放策略已明确，尚未做运营看板。', next_step: '定义批次、名额、资格、记录和审核流程。' },
  { key: 'settlement_batches', name: '智能分配结算', status: 'planned', progress: 10, scope: '分配', current_state: '已有内部规则表，尚未做真实资金分配执行器。', next_step: '先做模拟、审计、人工确认，再考虑自动执行。' }
];

const USAGE_ACTION_POINT_REWARD_RULES = [
  { action_key: 'phone_signup_verified', category: '使用', action_name: '完成手机号注册', points: 30, audit_mode: 'system_verified', daily_limit: 1, monthly_limit: 1, status: 'active', description: '真实完成手机号验证后记录。' },
  { action_key: 'profile_completed', category: '使用', action_name: '完善个人资料', points: 20, audit_mode: 'system_verified', daily_limit: 1, monthly_limit: 1, status: 'active', description: '保存姓名、行业等基础资料后记录。' },
  { action_key: 'profile_card_created', category: '使用', action_name: '创建个人名片', points: 30, audit_mode: 'system_verified', daily_limit: 1, monthly_limit: 1, status: 'active', description: '生成可分享名片后记录。' },
  { action_key: 'service_card_completed', category: '资料', action_name: '完善服务名片', points: 80, audit_mode: 'review_required', daily_limit: 1, monthly_limit: 5, status: 'active', description: '资料完整、清楚可用后记录。' },
  { action_key: 'card_first_shared', category: '推荐', action_name: '首次分享名片', points: 10, audit_mode: 'system_verified', daily_limit: 1, monthly_limit: 20, status: 'active', description: '分享自己的华伴名片后记录一次。' },
  { action_key: 'direct_referral_verified', category: '推荐', action_name: '一级推荐用户真实加入', points: 20, audit_mode: 'system_verified', daily_limit: 20, monthly_limit: 300, status: 'active', description: '对方通过分享链接进入，并完成手机号验证后记录。' },
  { action_key: 'second_level_referral_verified', category: '推荐', action_name: '二级推荐用户真实加入', points: 6, audit_mode: 'system_verified', daily_limit: 50, monthly_limit: 800, status: 'active', description: '推荐链路中的二级真实用户完成手机号验证后记录。' },
  { action_key: 'local_need_structured', category: '联系', action_name: '整理本地服务需求', points: 10, audit_mode: 'system_verified', daily_limit: 10, monthly_limit: 120, status: 'active', description: 'AI 把真实需求整理并保存后记录。' },
  { action_key: 'service_completion_confirmed', category: '后置预留', action_name: '双方确认完成一次真实服务', points: 50, audit_mode: 'review_required', daily_limit: 3, monthly_limit: 30, status: 'planned', description: '后续用于可信服务记录；当前阶段不进入推广飞轮积分自动入账。' }
];

const USAGE_ACTION_INTERNAL_NOTES = {
  phone_signup_verified: '注册奖励只记一次。',
  profile_completed: '资料被清空或虚假资料可撤销。',
  profile_card_created: '同一用户只奖励一次。',
  service_card_completed: '重复资料不重复入账。',
  card_first_shared: '仅分享动作低分记录，核心奖励看真实加入。',
  direct_referral_verified: '首位有效分享者锁定。',
  second_level_referral_verified: '按推荐链上级记录。',
  local_need_structured: '重复或空泛需求不重复记录。',
  service_completion_confirmed: '后置预留。当前阶段聚焦用户聚集、名片二维码、分享和推荐关系绑定，不自动发放交易完成积分。'
};

const PROMOTION_SCENARIO_CONTRACT_OVERRIDES = {
  phone_verified: {
    trigger_condition: '用户完成真实手机号验证码验证，并完成账号同步。',
    related_code_rule: 'account_uid；没有 account_uid 时使用 normalized_phone。',
    idempotency_rule: 'tenant_id + owner_code + reward_action_key + related_code，只记一次。'
  },
  profile_saved: {
    trigger_condition: '用户保存姓名、行业、手机号等可形成身份资料的信息。',
    related_code_rule: 'account_uid；没有 account_uid 时使用 normalized_phone。',
    idempotency_rule: 'tenant_id + owner_code + reward_action_key + related_code，按规则表日/月限制。'
  },
  card_saved: {
    trigger_condition: '用户保存资料后，系统生成二维码名片入口。',
    related_code_rule: 'account_uid；没有 account_uid 时使用 normalized_phone。',
    idempotency_rule: 'tenant_id + owner_code + reward_action_key + related_code，只记一次。'
  },
  card_shared: {
    trigger_condition: '用户实际调用系统分享，或复制二维码名片链接。',
    related_code_rule: 'account_uid；没有 account_uid 时使用分享链接。',
    idempotency_rule: 'tenant_id + owner_code + reward_action_key + related_code，按规则表限制。'
  },
  direct_referral_joined: {
    trigger_condition: '被分享人通过分享链路进入，并完成手机号验证及推荐关系绑定。',
    related_code_rule: 'referee_code。',
    idempotency_rule: 'tenant_id + inviter_code + reward_action_key + referee_code；首位推荐者锁定。'
  },
  second_level_referral_joined: {
    trigger_condition: '被分享人完成手机号验证，且其一级分享者存在上级推荐人。',
    related_code_rule: 'referee_code。',
    idempotency_rule: 'tenant_id + second_level_referrer_code + reward_action_key + referee_code。'
  },
  service_profile_saved: {
    trigger_condition: '用户或管理员保存服务者资料，生成可被搜索和认领的供给资料。',
    related_code_rule: 'supply_profile_id；没有时使用 supplier_code。',
    idempotency_rule: 'tenant_id + owner_code + reward_action_key + related_code，重复资料不重复入账。'
  },
  local_need_saved: {
    trigger_condition: '用户表达真实本地需求，AI 完成结构化并保存需求记录。',
    related_code_rule: 'demand_id；没有时使用原始需求文本摘要。',
    idempotency_rule: 'tenant_id + owner_code + reward_action_key + related_code，按规则表日/月限制。'
  },
  service_completion_confirmed: {
    trigger_condition: '双方都是华伴用户，并在同一个临时会话中分别确认服务已完成。',
    related_code_rule: 'conversation_id + role。',
    idempotency_rule: 'tenant_id + owner_code + reward_action_key + conversation_id + role；同一会话同一方只记一次。',
    point_status_rule: 'review_required；先进入 pending_review，后台按防刷、投诉、频率和异常关系复核。'
  }
};

function getPluginLibraryReport() {
  const rows = FEATURE_PLUGIN_LIBRARY.map(row => ({ ...row }));
  return {
    ok: true,
    summary: {
      total: rows.length,
      planned: rows.filter(row => row.status === 'planned').length,
      building: rows.filter(row => row.status === 'building').length,
      online: rows.filter(row => row.status === 'online').length
    },
    rows
  };
}

function normalizeDistributionPointRow(row = {}, sourceTable = '') {
  const fields = row.fields || {};
  return {
    id: row.id,
    source_table: sourceTable,
    owner_code: cleanText(row.owner_code || row.user_code || row.ref_code || fields.owner_code || '', 80),
    action: cleanText(row.action || row.event_type || row.reason || fields.action || '', 120),
    points: Number(row.points ?? row.total_points ?? row.amount ?? fields.points ?? 0) || 0,
    status: cleanText(row.status || '', 40),
    pool_status: cleanText(row.pool_status || '', 40),
    waitlist_rank: row.waitlist_rank ?? fields.waitlist_rank ?? '',
    reflow_reason: cleanText(row.reflow_reason || fields.reflow_reason || '', 120),
    reflowed_at: row.reflowed_at || '',
    lifetime_distribution_usd: Number(row.lifetime_distribution_usd || 0) || 0,
    created_at: row.created_at || row.updated_at || ''
  };
}

async function getContributionDistributionRulesReport() {
  const errors = [];
  const safeRead = async (label, path, options = {}) => {
    try {
      const rows = await supa(path);
      return Array.isArray(rows) ? rows : [];
    } catch (error) {
      if (!options.optional) errors.push(`${label}暂不可读`);
      return [];
    }
  };
  const [policies, reflowReasons, waitlistRules, actionRewardRules, pointEvents, contributionPoints] = await Promise.all([
    safeRead('分配规则', `huaban_contribution_distribution_policies?tenant_id=eq.${TENANT_ID}&limit=50&select=*`),
    safeRead('回流原因', `huaban_point_reflow_reason_rules?tenant_id=eq.${TENANT_ID}&limit=80&select=*`),
    safeRead('候补规则', `huaban_point_waitlist_rules?tenant_id=eq.${TENANT_ID}&limit=80&select=*`),
    safeRead('行为积分规则', `huaban_usage_action_point_reward_rules?tenant_id=eq.${TENANT_ID}&limit=200&select=*`, { optional: true }),
    safeRead('积分流水', `huaban_point_events?tenant_id=eq.${TENANT_ID}&order=created_at.desc&limit=800&select=*`),
    safeRead('贡献积分', `huaban_contribution_points?tenant_id=eq.${TENANT_ID}&order=created_at.desc&limit=800&select=*`)
  ]);
  const normalizedPoints = [
    ...pointEvents.map(row => normalizeDistributionPointRow(row, 'huaban_point_events')),
    ...contributionPoints.map(row => normalizeDistributionPointRow(row, 'huaban_contribution_points'))
  ];
  const waitlistRows = normalizedPoints
    .filter(row => row.pool_status === 'waitlisted')
    .sort((a, b) => Number(a.waitlist_rank || 999999) - Number(b.waitlist_rank || 999999) || String(a.created_at || '').localeCompare(String(b.created_at || '')))
    .slice(0, 120);
  return {
    ok: true,
    policies: policies.sort((a, b) => String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || ''))),
    reflow_reasons: reflowReasons.sort((a, b) => Number(a.priority_order || 999) - Number(b.priority_order || 999)),
    waitlist_rules: waitlistRules.sort((a, b) => Number(a.priority_order || 999) - Number(b.priority_order || 999)),
    action_reward_rules: (actionRewardRules.length ? actionRewardRules : USAGE_ACTION_POINT_REWARD_RULES)
      .sort((a, b) => String(a.category || '').localeCompare(String(b.category || '')) || Number(b.points || 0) - Number(a.points || 0)),
    waitlist_rows: waitlistRows,
    summary: {
      policies: policies.length,
      reflow_reasons: reflowReasons.length,
      waitlist_rules: waitlistRules.length,
      action_reward_rules: actionRewardRules.length || USAGE_ACTION_POINT_REWARD_RULES.length,
      waitlisted: normalizedPoints.filter(row => row.pool_status === 'waitlisted').length,
      effective: normalizedPoints.filter(row => ['effective', 'active', 'released'].includes(row.pool_status)).length,
      reflowed: normalizedPoints.filter(row => row.pool_status === 'reflowed' || row.reflowed_at).length,
      capped: normalizedPoints.filter(row => row.reflow_reason === 'lifetime_distribution_cap').length
    },
    errors
  };
}

const PROMOTION_FLYWHEEL_CHAINS = [
  {
    scenario_key: 'phone_verified',
    scenario_name: '手机号验证注册',
    reward_action_key: 'phone_signup_verified',
    api: ['verify-code', 'auth-phone-sync'],
    tables: ['huaban_accounts', 'huaban_identity_links', 'huaban_point_events'],
    expected_status: 'confirmed',
    owner_rule: '完成验证的当前用户 friend_code'
  },
  {
    scenario_key: 'profile_saved',
    scenario_name: '保存个人资料',
    reward_action_key: 'profile_completed',
    api: ['auth-phone-sync'],
    tables: ['huaban_accounts', 'huaban_identity_links', 'huaban_point_events'],
    expected_status: 'confirmed',
    owner_rule: '当前资料所属 friend_code'
  },
  {
    scenario_key: 'card_saved',
    scenario_name: '保存并生成名片',
    reward_action_key: 'profile_card_created',
    api: ['auth-phone-sync'],
    tables: ['huaban_accounts', 'huaban_point_events'],
    expected_status: 'confirmed',
    owner_rule: '当前名片所属 friend_code'
  },
  {
    scenario_key: 'card_shared',
    scenario_name: '首次分享名片',
    reward_action_key: 'card_first_shared',
    api: ['auth-phone-sync'],
    tables: ['huaban_point_events'],
    expected_status: 'confirmed',
    owner_rule: '分享者 friend_code'
  },
  {
    scenario_key: 'direct_referral_joined',
    scenario_name: '一级推荐真实加入',
    reward_action_key: 'direct_referral_verified',
    api: ['referral-bind'],
    tables: ['huaban_referral_events', 'huaban_friendships', 'huaban_point_events'],
    expected_status: 'confirmed',
    owner_rule: '首位有效分享者 inviter_code'
  },
  {
    scenario_key: 'second_level_referral_joined',
    scenario_name: '二级推荐真实加入',
    reward_action_key: 'second_level_referral_verified',
    api: ['referral-bind'],
    tables: ['huaban_referral_events', 'huaban_point_events'],
    expected_status: 'confirmed',
    owner_rule: '一级分享者的上级 second_level_referrer_code'
  },
  {
    scenario_key: 'service_profile_saved',
    scenario_name: '保存服务名片',
    reward_action_key: 'service_card_completed',
    api: ['referral-bind', 'site-content'],
    tables: ['huaban_supply_profiles', 'huaban_point_events'],
    expected_status: 'pending_review',
    owner_rule: '保存该服务资料的 owner_code'
  }
];

function tableProbeSelect(table = '') {
  const selects = {
    huaban_accounts: 'id,tenant_id,normalized_phone,friend_code,phone_verified_at',
    huaban_identity_links: 'id,tenant_id,normalized_phone,friend_code,owner_code,link_type,status',
    huaban_referral_events: 'id,tenant_id,inviter_code,referee_code,status',
    huaban_friendships: 'id,tenant_id,owner_code,friend_code,status',
    huaban_point_events: 'id,tenant_id,owner_code,action,points,status,event_key',
    huaban_usage_action_point_reward_rules: 'id,tenant_id,action_key,points,audit_mode,status',
    huaban_promotion_scenario_rules: 'id,tenant_id,scenario_key,reward_action_key,status',
    huaban_supply_profiles: 'id,tenant_id,name,service_type,city,contact,website,fields',
    huaban_site_events: 'id,tenant_id,event_name,page_key,page_path,visitor_id,created_at',
    huaban_friend_messages: 'id,tenant_id,sender_code,recipient_code,message_type,delivery_status,created_at',
    huaban_temp_conversation_messages: 'id,tenant_id,conversation_id,sender_role,message_type,delivery_status,created_at',
    huaban_contact_notifications: 'id,tenant_id,recipient_code,status,created_at',
    huaban_social_circle_posts: 'id,tenant_id,city,post_type,moderation_status,status,created_at'
  };
  return selects[table] || 'id';
}

async function probeTable(table = '') {
  try {
    await supa(`${table}?tenant_id=eq.${TENANT_ID}&limit=1&select=${encodeURIComponent(tableProbeSelect(table))}`);
    return { table, ok: true };
  } catch (error) {
    return { table, ok: false, error: cleanText(error.message || '不可读', 360) };
  }
}

async function getPromotionFlywheelHealthReport() {
  const requiredTables = Array.from(new Set([
    'huaban_usage_action_point_reward_rules',
    'huaban_promotion_scenario_rules',
    ...PROMOTION_FLYWHEEL_CHAINS.flatMap(item => item.tables)
  ]));
  const tableResults = await Promise.all(requiredTables.map(probeTable));
  const tableMap = new Map(tableResults.map(item => [item.table, item]));
  const [rules, scenarioRows, recentPoints] = await Promise.all([
    supa(`huaban_usage_action_point_reward_rules?tenant_id=eq.${TENANT_ID}&status=eq.active&limit=200&select=action_key,points,audit_mode,daily_limit,monthly_limit,status`).catch(error => ({ error })),
    supa(`huaban_promotion_scenario_rules?tenant_id=eq.${TENANT_ID}&status=eq.active&limit=200&select=scenario_key,reward_action_key,ledger_owner_rule,idempotency_rule,status`).catch(error => ({ error })),
    supa(`huaban_point_events?tenant_id=eq.${TENANT_ID}&order=created_at.desc&limit=80&select=id,owner_code,action,points,status,event_key,related_code,fields,created_at`).catch(error => ({ error }))
  ]);
  const ruleRows = Array.isArray(rules) ? rules : [];
  const scenarioContracts = Array.isArray(scenarioRows) ? scenarioRows : [];
  const pointRows = Array.isArray(recentPoints) ? recentPoints : [];
  const ruleKeys = new Set(ruleRows.map(row => row.action_key));
  const contractKeys = new Set(scenarioContracts.map(row => row.scenario_key));
  const chains = PROMOTION_FLYWHEEL_CHAINS.map(chain => {
    const missingTables = chain.tables.filter(table => !tableMap.get(table)?.ok);
    const hasRule = ruleKeys.has(chain.reward_action_key);
    const hasContract = contractKeys.has(chain.scenario_key);
    const recentEventCount = pointRows.filter(row => row.action === chain.reward_action_key || row.fields?.scenario_key === chain.scenario_key).length;
    const ok = missingTables.length === 0 && hasRule && hasContract;
    return {
      ...chain,
      ok,
      missing_tables: missingTables,
      has_reward_rule: hasRule,
      has_scenario_contract: hasContract,
      recent_event_count: recentEventCount,
      problem: ok ? '' : [
        missingTables.length ? `缺表/字段：${missingTables.join(', ')}` : '',
        hasRule ? '' : `缺积分规则：${chain.reward_action_key}`,
        hasContract ? '' : `缺场景契约：${chain.scenario_key}`
      ].filter(Boolean).join('；')
    };
  });
  const brokenChains = chains.filter(item => !item.ok);
  return {
    ok: brokenChains.length === 0,
    checked_at: new Date().toISOString(),
    summary: {
      chains: chains.length,
      ready: chains.filter(item => item.ok).length,
      broken: brokenChains.length,
      required_tables: requiredTables.length,
      readable_tables: tableResults.filter(item => item.ok).length,
      reward_rules: ruleRows.length,
      scenario_contracts: scenarioContracts.length,
      recent_point_events: pointRows.length
    },
    chains,
    tables: tableResults,
    recent_point_events: pointRows.slice(0, 20),
    errors: [
      !Array.isArray(rules) ? `行为积分规则读取失败：${cleanText(rules?.error?.message || '', 260)}` : '',
      !Array.isArray(scenarioRows) ? `场景契约读取失败：${cleanText(scenarioRows?.error?.message || '', 260)}` : '',
      !Array.isArray(recentPoints) ? `积分流水读取失败：${cleanText(recentPoints?.error?.message || '', 260)}` : ''
    ].filter(Boolean)
  };
}

function promotionRewardRepairRows(actionKeys = []) {
  const allow = new Set((Array.isArray(actionKeys) ? actionKeys : []).filter(Boolean));
  return USAGE_ACTION_POINT_REWARD_RULES
    .filter(rule => !allow.size || allow.has(rule.action_key))
    .map(rule => ({
      tenant_id: TENANT_ID,
      action_key: rule.action_key,
      category: rule.category,
      action_name: rule.action_name,
      points: Number(rule.points) || 0,
      audit_mode: rule.audit_mode || 'system_verified',
      daily_limit: rule.daily_limit ?? null,
      monthly_limit: rule.monthly_limit ?? null,
      status: rule.status || 'active',
      description: rule.description || '',
      internal_note: USAGE_ACTION_INTERNAL_NOTES[rule.action_key] || '',
      metadata: {
        scenario_key: PROMOTION_FLYWHEEL_CHAINS.find(chain => chain.reward_action_key === rule.action_key)?.scenario_key || rule.action_key
      }
    }));
}

function promotionScenarioRepairRows(scenarioKeys = []) {
  const allow = new Set((Array.isArray(scenarioKeys) ? scenarioKeys : []).filter(Boolean));
  return PROMOTION_FLYWHEEL_CHAINS
    .filter(chain => !allow.size || allow.has(chain.scenario_key))
    .map(chain => {
      const override = PROMOTION_SCENARIO_CONTRACT_OVERRIDES[chain.scenario_key] || {};
      return {
        tenant_id: TENANT_ID,
        scenario_key: chain.scenario_key,
        scenario_name: chain.scenario_name,
        trigger_condition: override.trigger_condition || `系统识别并完成：${chain.scenario_name}。`,
        reward_action_key: chain.reward_action_key,
        ledger_owner_rule: `入账给${chain.owner_rule}。`,
        related_code_rule: override.related_code_rule || '由场景动作生成 related_code。',
        idempotency_rule: override.idempotency_rule || 'tenant_id + owner_code + reward_action_key + related_code。',
        point_status_rule: override.point_status_rule || '由行为积分规则 audit_mode 决定。',
        public_visibility: 'internal_only',
        status: 'active',
        metadata: {
          api: chain.api || [],
          tables: chain.tables || [],
          expected_status: chain.expected_status || 'confirmed'
        }
      };
    });
}

async function upsertPromotionRepairRows(table, onConflict, rows = []) {
  const payload = (Array.isArray(rows) ? rows : []).filter(Boolean);
  if (!payload.length) return [];
  return supa(`${table}?on_conflict=${onConflict}`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(payload)
  });
}

async function repairPromotionFlywheelIssue() {
  const before = await getPromotionFlywheelHealthReport();
  if (before.ok) {
    return {
      ok: true,
      mode: 'already_healthy',
      message: '推广飞轮链路已恢复正常，无需修复。',
      before,
      after: before
    };
  }

  const brokenChains = (before.chains || []).filter(chain => !chain.ok);
  const missingTables = Array.from(new Set(brokenChains.flatMap(chain => chain.missing_tables || [])));
  if (missingTables.length) {
    return {
      ok: false,
      mode: 'manual_schema_required',
      message: `缺少数据表或字段：${missingTables.join('、')}。这类修复需要人工运行 SQL，系统不会自动改生产库结构。`,
      before
    };
  }

  const missingActions = Array.from(new Set(
    brokenChains.filter(chain => !chain.has_reward_rule).map(chain => chain.reward_action_key)
  ));
  const missingScenarios = Array.from(new Set(
    brokenChains.filter(chain => !chain.has_scenario_contract).map(chain => chain.scenario_key)
  ));
  const rewardRows = promotionRewardRepairRows(missingActions);
  const scenarioRows = promotionScenarioRepairRows(missingScenarios);

  if (!rewardRows.length && !scenarioRows.length) {
    return {
      ok: false,
      mode: 'manual_review_required',
      message: '没有发现可自动补齐的规则行，请查看巡检详情。',
      before
    };
  }

  if (rewardRows.length) {
    await upsertPromotionRepairRows('huaban_usage_action_point_reward_rules', 'tenant_id,action_key', rewardRows);
  }
  if (scenarioRows.length) {
    await upsertPromotionRepairRows('huaban_promotion_scenario_rules', 'tenant_id,scenario_key', scenarioRows);
  }

  const after = await getPromotionFlywheelHealthReport();
  return {
    ok: Boolean(after.ok),
    mode: after.ok ? 'auto_repaired' : 'repair_attempted',
    message: after.ok
      ? `已自动补齐 ${rewardRows.length} 条积分规则、${scenarioRows.length} 条场景契约，并复查通过。`
      : `已尝试补齐 ${rewardRows.length} 条积分规则、${scenarioRows.length} 条场景契约，但仍有 ${after.summary?.broken || 0} 条异常。`,
    repaired: {
      reward_rules: rewardRows.map(row => row.action_key),
      scenario_rules: scenarioRows.map(row => row.scenario_key)
    },
    before,
    after
  };
}

async function attemptSystemMonitorRepair(issue = {}) {
  if (issue.type === 'flywheel') return repairPromotionFlywheelIssue(issue);
  if (issue.type === 'table') {
    return {
      ok: false,
      mode: 'manual_schema_required',
      message: `数据表 ${issue.target || issue.label || ''} 不可读。涉及建表、补字段或权限，必须人工运行 SQL。`
    };
  }
  return {
    ok: false,
    mode: 'not_supported',
    message: '这类问题当前只做自动重试和持续监测，不执行数据修复。'
  };
}

function summarizeMonitorIssues(issueItems = []) {
  const rows = Array.isArray(issueItems) ? issueItems : [];
  return {
    active: rows.filter(item => ['auto_repairing', 'needs_approval', 'approved'].includes(item.status)).length,
    auto_repairing: rows.filter(item => item.status === 'auto_repairing').length,
    needs_approval: rows.filter(item => item.status === 'needs_approval').length,
    approved: rows.filter(item => item.status === 'approved').length,
    rejected: rows.filter(item => item.status === 'rejected').length,
    fixed: rows.filter(item => item.status === 'fixed').length
  };
}

function operationalRateStatus(numerator = 0, denominator = 0) {
  const total = Number(denominator) || 0;
  const ok = Number(numerator) || 0;
  if (!total) return 'no_sample';
  const rate = ok / total;
  if (rate >= 0.95) return 'healthy';
  if (rate >= 0.9) return 'watch';
  if (rate >= 0.8) return 'needs_repair';
  return 'critical';
}

function operationalMetric(label, numerator = 0, denominator = 0, notes = '') {
  const total = Number(denominator) || 0;
  const ok = Number(numerator) || 0;
  return {
    label,
    numerator: ok,
    denominator: total,
    rate: total ? Number((ok / total).toFixed(4)) : null,
    status: operationalRateStatus(ok, total),
    notes: cleanText(notes, 220)
  };
}

async function getOperationalAccuracyReport() {
  const requiredTables = [
    'huaban_site_events',
    'huaban_point_events',
    'huaban_usage_action_point_reward_rules',
    'huaban_promotion_scenario_rules',
    'huaban_referral_events',
    'huaban_friendships',
    'huaban_friend_messages',
    'huaban_temp_conversation_messages',
    'huaban_supply_profiles'
  ];
  const tableResults = await Promise.all(requiredTables.map(probeTable));
  const tableMap = new Map(tableResults.map(item => [item.table, item]));
  const [events, points, rewardRules, scenarioRules, referrals, friendships, friendMessages, tempMessages, supplyProfiles] = await Promise.all([
    tableMap.get('huaban_site_events')?.ok
      ? supa(`huaban_site_events?tenant_id=eq.${TENANT_ID}&order=created_at.desc&limit=300&select=id,event_name,page_key,page_path,created_at`).catch(error => ({ error }))
      : Promise.resolve([]),
    tableMap.get('huaban_point_events')?.ok
      ? supa(`huaban_point_events?tenant_id=eq.${TENANT_ID}&order=created_at.desc&limit=160&select=id,owner_code,action,points,status,fields,created_at`).catch(error => ({ error }))
      : Promise.resolve([]),
    tableMap.get('huaban_usage_action_point_reward_rules')?.ok
      ? supa(`huaban_usage_action_point_reward_rules?tenant_id=eq.${TENANT_ID}&status=eq.active&limit=200&select=action_key,points,status`).catch(error => ({ error }))
      : Promise.resolve([]),
    tableMap.get('huaban_promotion_scenario_rules')?.ok
      ? supa(`huaban_promotion_scenario_rules?tenant_id=eq.${TENANT_ID}&status=eq.active&limit=200&select=scenario_key,reward_action_key,status`).catch(error => ({ error }))
      : Promise.resolve([]),
    tableMap.get('huaban_referral_events')?.ok
      ? supa(`huaban_referral_events?tenant_id=eq.${TENANT_ID}&order=created_at.desc&limit=160&select=id,inviter_code,referee_code,status,created_at`).catch(error => ({ error }))
      : Promise.resolve([]),
    tableMap.get('huaban_friendships')?.ok
      ? supa(`huaban_friendships?tenant_id=eq.${TENANT_ID}&order=created_at.desc&limit=160&select=id,owner_code,friend_code,status,created_at`).catch(error => ({ error }))
      : Promise.resolve([]),
    tableMap.get('huaban_friend_messages')?.ok
      ? supa(`huaban_friend_messages?tenant_id=eq.${TENANT_ID}&order=created_at.desc&limit=160&select=id,sender_code,recipient_code,message_type,delivery_status,created_at`).catch(error => ({ error }))
      : Promise.resolve([]),
    tableMap.get('huaban_temp_conversation_messages')?.ok
      ? supa(`huaban_temp_conversation_messages?tenant_id=eq.${TENANT_ID}&order=created_at.desc&limit=160&select=id,conversation_id,sender_role,message_type,delivery_status,created_at`).catch(error => ({ error }))
      : Promise.resolve([]),
    tableMap.get('huaban_supply_profiles')?.ok
      ? supa(`huaban_supply_profiles?tenant_id=eq.${TENANT_ID}&order=created_at.desc&limit=160&select=id,name,service_type,city,contact,website,fields,created_at`).catch(error => ({ error }))
      : Promise.resolve([])
  ]);
  const eventRows = Array.isArray(events) ? events : [];
  const pointRows = Array.isArray(points) ? points : [];
  const rewardRuleRows = Array.isArray(rewardRules) ? rewardRules : [];
  const scenarioRuleRows = Array.isArray(scenarioRules) ? scenarioRules : [];
  const referralRows = Array.isArray(referrals) ? referrals : [];
  const friendshipRows = Array.isArray(friendships) ? friendships : [];
  const friendMessageRows = Array.isArray(friendMessages) ? friendMessages : [];
  const tempMessageRows = Array.isArray(tempMessages) ? tempMessages : [];
  const supplyRows = Array.isArray(supplyProfiles) ? supplyProfiles : [];
  const actionEvents = eventRows.filter(row => {
    const text = `${row.event_name || ''} ${row.page_key || ''} ${row.page_path || ''}`.toLowerCase();
    return /ai|friend|profile|nearby|recruit|share|voice|message|scan/.test(text);
  });
  const successfulActionEvents = actionEvents.filter(row => {
    const eventName = String(row.event_name || '').toLowerCase();
    return /success|saved|sent|open|click|submit|verified|share|message/.test(eventName);
  });
  const rewardActions = new Set(actionRulesForMonitor());
  const trackedPointRows = pointRows.filter(row => rewardActions.has(row.action));
  const validPointRows = trackedPointRows.filter(row => ['confirmed', 'pending_review'].includes(row.status));
  const rewardRuleByAction = new Map(rewardRuleRows.map(row => [row.action_key, row]));
  const scenarioRuleByKeyAndAction = new Set(scenarioRuleRows.map(row => `${row.scenario_key || ''}::${row.reward_action_key || ''}`));
  const ruleMatchedPointRows = trackedPointRows.filter(row => {
    const rule = rewardRuleByAction.get(row.action);
    const fields = row.fields && typeof row.fields === 'object' ? row.fields : {};
    const scenarioKey = String(fields.scenario_key || '').trim();
    if (!rule) return false;
    if (!scenarioKey) return false;
    if (!scenarioRuleByKeyAndAction.has(`${scenarioKey}::${row.action}`)) return false;
    if (!['confirmed', 'pending_review'].includes(row.status)) return false;
    return Number(row.points) === Number(rule.points || 0);
  });
  const validReferralRows = referralRows.filter(row => row.inviter_code && row.referee_code);
  const validFriendRows = friendshipRows.filter(row => row.owner_code && row.friend_code && row.status !== 'rejected');
  const deliveredFriendMessages = friendMessageRows.filter(row => ['delivered', 'read'].includes(row.delivery_status));
  const deliveredTempMessages = tempMessageRows.filter(row => ['delivered', 'read'].includes(row.delivery_status));
  const usableSupplyRows = supplyRows.filter(row => {
    const fields = row.fields && typeof row.fields === 'object' ? row.fields : {};
    return row.city && row.service_type && (row.contact || row.website || fields.phone || fields.contact_phone || fields.email);
  });
  const metrics = [
    operationalMetric('用户动作到系统动作可观察率', successfulActionEvents.length, actionEvents.length, '检查用户动作是否留下可追踪结果。'),
    operationalMetric('奖励动作入账有效率', validPointRows.length, trackedPointRows.length, 'confirmed 和 pending_review 都算可追踪入账。'),
    operationalMetric('用户动作和积分发放规则吻合率', ruleMatchedPointRows.length, trackedPointRows.length, '积分流水必须有启用规则、场景契约，并且分值和规则一致。'),
    operationalMetric('推荐双方编码完整率', validReferralRows.length, referralRows.length, '推荐关系必须能锁定 inviter/referee。'),
    operationalMetric('好友关系编码完整率', validFriendRows.length, friendshipRows.length, '好友关系必须能稳定显示和分组。'),
    operationalMetric('好友消息送达率', deliveredFriendMessages.length, friendMessageRows.length, '文字和语音留言应尽快送达对方会话。'),
    operationalMetric('临时会话消息送达率', deliveredTempMessages.length, tempMessageRows.length, '供需双方临时会话必须可送达。'),
    operationalMetric('供给资料可匹配率', usableSupplyRows.length, supplyRows.length, '供给资料至少要有城市、服务和联系方式。')
  ];
  const missingTables = tableResults.filter(item => !item.ok);
  const criticalMetrics = metrics.filter(item => ['needs_repair', 'critical'].includes(item.status));
  return {
    ok: missingTables.length === 0 && criticalMetrics.length === 0,
    checked_at: new Date().toISOString(),
    summary: {
      metrics: metrics.length,
      healthy: metrics.filter(item => item.status === 'healthy').length,
      watch: metrics.filter(item => item.status === 'watch').length,
      needs_repair: metrics.filter(item => item.status === 'needs_repair').length,
      critical: metrics.filter(item => item.status === 'critical').length,
      no_sample: metrics.filter(item => item.status === 'no_sample').length,
      readable_tables: tableResults.filter(item => item.ok).length,
      tables: tableResults.length
    },
    metrics,
    tables: tableResults,
    errors: [
      ...missingTables.map(item => `${item.table} 不可读：${item.error || ''}`),
      !Array.isArray(events) ? `动作日志读取失败：${cleanText(events?.error?.message || '', 220)}` : '',
      !Array.isArray(points) ? `积分账本读取失败：${cleanText(points?.error?.message || '', 220)}` : '',
      !Array.isArray(rewardRules) ? `积分规则读取失败：${cleanText(rewardRules?.error?.message || '', 220)}` : '',
      !Array.isArray(scenarioRules) ? `场景契约读取失败：${cleanText(scenarioRules?.error?.message || '', 220)}` : '',
      !Array.isArray(friendMessages) ? `好友消息读取失败：${cleanText(friendMessages?.error?.message || '', 220)}` : '',
      !Array.isArray(tempMessages) ? `临时会话读取失败：${cleanText(tempMessages?.error?.message || '', 220)}` : '',
      !Array.isArray(supplyProfiles) ? `供给资料读取失败：${cleanText(supplyProfiles?.error?.message || '', 220)}` : ''
    ].filter(Boolean)
  };
}

function actionRulesForMonitor() {
  return [
    'phone_signup_verified',
    'profile_completed',
    'profile_card_created',
    'card_first_shared',
    'direct_referral_verified',
    'second_level_referral_verified',
    'service_card_completed',
    'local_need_structured'
  ];
}

async function getIdentityReferralReport() {
  const safeRead = async (label, path) => {
    try {
      const rows = await supa(path);
      return { label, ok: true, rows: Array.isArray(rows) ? rows : [] };
    } catch (error) {
      return { label, ok: false, rows: [], error: cleanText(error.message || '读取失败', 360) };
    }
  };
  const [accountsRead, linksRead, referralsRead, friendshipsRead, pointsRead] = await Promise.all([
    safeRead('账号', `huaban_accounts?tenant_id=eq.${TENANT_ID}&order=created_at.desc&limit=500&select=id,account_uid,friend_code,display_name,primary_phone,normalized_phone,phone_verified_at,status,fields,created_at,updated_at`),
    safeRead('身份归集', `huaban_identity_links?tenant_id=eq.${TENANT_ID}&order=created_at.desc&limit=800&select=id,friend_code,owner_code,display_name,phone,normalized_phone,link_type,status,inviter_code,source,fields,created_at`),
    safeRead('推荐关系', `huaban_referral_events?tenant_id=eq.${TENANT_ID}&order=created_at.desc&limit=800&select=id,inviter_code,referee_code,inviter_name,referee_name,inviter_phone,referee_phone,status,referral_depth,fields,created_at`),
    safeRead('好友绑定', `huaban_friendships?tenant_id=eq.${TENANT_ID}&order=created_at.desc&limit=800&select=id,owner_code,friend_code,friend_name,friend_phone,friend_industry,status,source,fields,created_at`),
    safeRead('推荐积分', `huaban_point_events?tenant_id=eq.${TENANT_ID}&action=in.(direct_referral_verified,second_level_referral_verified,card_first_shared)&order=created_at.desc&limit=300&select=id,owner_code,action,points,status,related_code,fields,created_at`)
  ]);
  const accounts = accountsRead.rows;
  const links = linksRead.rows;
  const referrals = referralsRead.rows;
  const friendships = friendshipsRead.rows;
  const pointEvents = pointsRead.rows;
  const verifiedPhones = new Set(accounts.map(row => row.normalized_phone || row.primary_phone).filter(Boolean));
  const friendCodes = new Set([
    ...accounts.map(row => row.friend_code),
    ...links.map(row => row.friend_code),
    ...referrals.flatMap(row => [row.inviter_code, row.referee_code]),
    ...friendships.flatMap(row => [row.owner_code, row.friend_code])
  ].filter(Boolean));
  const identityRows = accounts.slice(0, 80).map(row => ({
    friend_code: row.friend_code || '',
    display_name: row.display_name || row.fields?.display_name || '华伴用户',
    phone: row.normalized_phone || row.primary_phone || '',
    status: row.status || 'active',
    verified_at: row.phone_verified_at || '',
    identity_links: links.filter(link => link.normalized_phone && link.normalized_phone === (row.normalized_phone || row.primary_phone)).length,
    created_at: row.created_at || ''
  }));
  const referralRows = referrals.slice(0, 120).map(row => ({
    inviter: [row.inviter_name, row.inviter_code].filter(Boolean).join(' / ') || row.inviter_code || '',
    referee: [row.referee_name, row.referee_code].filter(Boolean).join(' / ') || row.referee_code || '',
    depth: Number(row.referral_depth || row.fields?.referral_depth || 1),
    status: row.status || 'confirmed',
    inviter_phone: row.inviter_phone || '',
    referee_phone: row.referee_phone || '',
    created_at: row.created_at || ''
  }));
  const errors = [accountsRead, linksRead, referralsRead, friendshipsRead, pointsRead]
    .filter(item => !item.ok)
    .map(item => `${item.label}：${item.error}`);
  return {
    ok: errors.length === 0,
    checked_at: new Date().toISOString(),
    summary: {
      accounts: accounts.length,
      verified_phones: verifiedPhones.size,
      identity_links: links.length,
      friend_codes: friendCodes.size,
      referral_events: referrals.length,
      direct_referrals: referrals.filter(row => Number(row.referral_depth || row.fields?.referral_depth || 1) === 1).length,
      second_level_referrals: referrals.filter(row => Number(row.referral_depth || row.fields?.referral_depth || 1) === 2).length,
      friendships: friendships.length,
      referral_point_events: pointEvents.length,
      referral_points: pointEvents.reduce((sum, row) => sum + Number(row.points || 0), 0)
    },
    identity_rows: identityRows,
    referral_rows: referralRows,
    link_rows: links.slice(0, 120),
    friendship_rows: friendships.slice(0, 120),
    point_rows: pointEvents.slice(0, 80),
    errors
  };
}

function pointActionLabel(action = '') {
  const map = {
    phone_signup_verified: '手机号注册',
    profile_completed: '完善个人资料',
    profile_card_created: '创建二维码名片',
    service_card_completed: '完善服务资料',
    card_first_shared: '首次分享二维码名片',
    direct_referral_verified: '一级推荐真实加入',
    second_level_referral_verified: '二级推荐真实加入',
    referral_join: '一级推荐真实加入',
    referral_second_level_join: '二级推荐真实加入',
    local_need_structured: '整理本地服务需求',
    service_completion_confirmed: '双方确认完成真实服务'
  };
  return map[action] || action || '未标记动作';
}

async function getPointLedgerReport() {
  const safeRead = async (label, path) => {
    try {
      const rows = await supa(path);
      return { label, ok: true, rows: Array.isArray(rows) ? rows : [] };
    } catch (error) {
      return { label, ok: false, rows: [], error: cleanText(error.message || '读取失败', 360) };
    }
  };
  const eventsRead = await safeRead(
    '积分流水',
    `huaban_point_events?tenant_id=eq.${TENANT_ID}&order=created_at.desc&limit=1000&select=id,owner_code,action,points,status,event_key,related_code,fields,created_at`
  );
  const events = eventsRead.rows.map(row => {
    const action = row.action || row.fields?.action || '';
    return {
      id: row.id || '',
      owner_code: row.owner_code || row.fields?.owner_code || '',
      action,
      action_label: pointActionLabel(action),
      points: Number(row.points || 0),
      status: row.status || 'confirmed',
      event_key: row.event_key || '',
      related_code: row.related_code || row.fields?.related_code || row.fields?.referee_code || row.fields?.conversation_id || '',
      created_at: row.created_at || '',
      fields: row.fields || {}
    };
  });
  const actionMap = new Map();
  const ownerMap = new Map();
  for (const event of events) {
    const actionKey = `${event.action || 'unknown'}|${event.status || 'unknown'}`;
    const actionItem = actionMap.get(actionKey) || {
      action: event.action || 'unknown',
      action_label: event.action_label,
      status: event.status || 'unknown',
      event_count: 0,
      total_points: 0
    };
    actionItem.event_count += 1;
    actionItem.total_points += event.points;
    actionMap.set(actionKey, actionItem);

    const ownerKey = event.owner_code || '未绑定';
    const ownerItem = ownerMap.get(ownerKey) || {
      owner_code: ownerKey,
      event_count: 0,
      total_points: 0,
      actions: [],
      last_at: ''
    };
    ownerItem.event_count += 1;
    ownerItem.total_points += event.points;
    if (event.action && !ownerItem.actions.includes(event.action)) ownerItem.actions.push(event.action);
    if (!ownerItem.last_at || String(event.created_at || '') > String(ownerItem.last_at || '')) ownerItem.last_at = event.created_at;
    ownerMap.set(ownerKey, ownerItem);
  }
  const confirmed = events.filter(row => row.status === 'confirmed');
  const pending = events.filter(row => ['pending_review', 'pending'].includes(row.status));
  return {
    ok: eventsRead.ok,
    generated_at: new Date().toISOString(),
    summary: {
      event_count: events.length,
      owner_count: new Set(events.map(row => row.owner_code).filter(Boolean)).size,
      total_points: events.reduce((sum, row) => sum + row.points, 0),
      confirmed_points: confirmed.reduce((sum, row) => sum + row.points, 0),
      pending_points: pending.reduce((sum, row) => sum + row.points, 0),
      pending_events: pending.length
    },
    action_summary: Array.from(actionMap.values())
      .sort((a, b) => String(a.action).localeCompare(String(b.action)) || String(a.status).localeCompare(String(b.status))),
    owner_summary: Array.from(ownerMap.values())
      .sort((a, b) => Number(b.total_points || 0) - Number(a.total_points || 0) || String(b.last_at || '').localeCompare(String(a.last_at || '')))
      .slice(0, 120),
    recent_events: events.slice(0, 120),
    errors: eventsRead.ok ? [] : [eventsRead.error || '积分流水暂不可读']
  };
}

async function createOutreachTask(body = {}) {
  const payload = generateGrowthTask(body);
  const rows = await supa('outreach_tasks', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload)
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

async function updateOutreachTask(body = {}) {
  const id = cleanText(body.id, 80);
  if (!/^[0-9a-f-]{32,40}$/i.test(id)) throw new Error('推广任务 ID 无效');
  const allowed = new Set(['draft', 'needs_review', 'scheduled', 'published', 'rejected', 'blocked']);
  const status = cleanText(body.status, 40);
  if (status && !allowed.has(status)) throw new Error('推广状态无效');
  const currentRows = await supa(`outreach_tasks?id=eq.${encodeURIComponent(id)}&tenant_id=eq.${TENANT_ID}&limit=1&select=id,status,metrics,fields`);
  const current = Array.isArray(currentRows) ? currentRows[0] : null;
  if (!current) throw new Error('找不到推广任务');
  const feedback = cleanText(body.feedback, 1000);
  const metrics = { ...(current.metrics || {}) };
  const fields = { ...(current.fields || {}) };
  if (status === 'published') metrics.published = Number(metrics.published || 0) + 1;
  if (feedback) {
    metrics.feedback_recorded = Number(metrics.feedback_recorded || 0) + 1;
    fields.feedback_log = Array.isArray(fields.feedback_log) ? fields.feedback_log : [];
    fields.feedback_log.unshift({
      at: new Date().toISOString(),
      text: feedback,
      channel: cleanText(body.channel || fields.channel || '', 80),
      outcome: cleanText(body.outcome || '', 80)
    });
    fields.feedback_log = fields.feedback_log.slice(0, 20);
  }
  const payload = {
    ...(status ? { status } : {}),
    metrics,
    fields,
    updated_at: new Date().toISOString(),
    ...(status === 'published' ? { published_at: new Date().toISOString() } : {})
  };
  const rows = await supa(`outreach_tasks?id=eq.${encodeURIComponent(id)}&tenant_id=eq.${TENANT_ID}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload)
  });
  if (feedback) {
    try {
      await supa('huaban_growth_feedback', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          tenant_id: TENANT_ID,
          task_id: id,
          feedback_text: feedback,
          channel: cleanText(body.channel || fields.channel || '', 80),
          outcome: cleanText(body.outcome || '', 80),
          metadata: { status: status || current.status }
        })
      });
    } catch (error) {
      console.warn('growth feedback log skipped', error.message);
    }
  }
  return Array.isArray(rows) ? rows[0] : rows;
}

async function createSupplyLead(body = {}) {
  const bodyWebsite = safeUrl(body.website || body.source_url || body.public_verification_url || '');
  const rawContact = cleanText(body.contact || body.phone || '', 180);
  const rawPhone = looksLikeUrl(rawContact) ? '' : cleanText(body.phone || body.contact || '', 160);
  const rawEmail = cleanText(body.email || '', 160);
  const email = isPlaceholderEmail(rawEmail) ? '' : rawEmail;
  const normalizedPhone = normalizePhone(rawPhone);
  const publicSearchMode = ['public_search', 'admin_review_queue'].includes(cleanText(body.source_mode || '', 80));
  if (publicSearchMode && !normalizedPhone && !email) {
    throw new Error('公开搜索结果缺少电话或邮箱，不能保存入供给明细。');
  }
  const supplierCode = makeSupplierCode(normalizedPhone || body.name || body.supplier_name || body.industry || 'HB');
  const dedupeKey = normalizedDedupeKey({
    name: body.name || body.supplier_name || '',
    phone: normalizedPhone,
    email,
    website: bodyWebsite,
    city: body.city || body.source_city || '',
    serviceType: body.service_type || body.industry || ''
  });
  let existing = null;
  if (dedupeKey) {
    const existingRows = await supa(`huaban_supply_profiles?tenant_id=eq.${TENANT_ID}&dedupe_key=eq.${encodeURIComponent(dedupeKey)}&order=updated_at.desc&limit=1&select=id,fields,duplicate_count,source_urls`).catch(() => []);
    existing = Array.isArray(existingRows) ? existingRows[0] : null;
  }
  if (normalizedPhone) {
    const existingRows = await supa(`huaban_supply_profiles?tenant_id=eq.${TENANT_ID}&or=(normalized_contact.eq.${encodeURIComponent(normalizedPhone)},claimed_phone.eq.${encodeURIComponent(normalizedPhone)})&order=updated_at.desc&limit=1&select=id,fields`).catch(() => []);
    existing = existing || (Array.isArray(existingRows) ? existingRows[0] : null);
  }
  const sourceUrl = bodyWebsite;
  if (!existing && sourceUrl) {
    const sourceRows = await supa(`huaban_supply_profiles?tenant_id=eq.${TENANT_ID}&or=(website.eq.${encodeURIComponent(sourceUrl)},public_verification_url.eq.${encodeURIComponent(sourceUrl)})&order=updated_at.desc&limit=1&select=id,fields`).catch(() => []);
    existing = Array.isArray(sourceRows) ? sourceRows[0] : null;
  }
  const address = cleanText(body.address || body.normalized_address || '', 260);
  const industryMajor = cleanText(body.industry_major || body.category || body.service_type || body.industry || '本地服务', 120);
  const industryMinor = canonicalSupplyMinor(body.industry_minor || body.service_type || body.service_type_code || body.industry || industryMajor);
  const serviceTypeCode = canonicalSupplyCode(body.service_type_code || body.industry, industryMinor || industryMajor);
  const serviceBoard = cleanText(body.service_board || supplyBoardFor(industryMinor || industryMajor, serviceTypeCode), 40);
  const contactName = cleanText(body.contact_name || '', 120);
  const contact = normalizedPhone || email || cleanText(looksLikeUrl(rawContact) ? '' : rawContact, 160);
  const capabilities = extractSupplyCapabilities(body.source_text || body.intro || body.service_description || '', {
    ...body,
    address
  });
  const payload = {
    tenant_id: TENANT_ID,
    supplier_code: cleanText(body.supplier_code || supplierCode, 80),
    source_mode: cleanText(body.source_mode || 'admin_manual_supply', 80),
    source_channel: cleanText(body.source_channel || body.channel || 'admin_manual', 80),
    name: cleanText(body.name || body.supplier_name || '', 120),
    contact,
    city: cleanText(body.city || 'Melbourne', 80),
    country: cleanText(body.country || 'Australia', 80),
    service_type: industryMinor || industryMajor,
    service_type_code: serviceTypeCode,
    category: industryMajor,
    service_area: capabilities.service_area || address || cleanText(body.city || '', 80),
    intro: cleanText(body.intro || body.service_description || '', 1000),
    website: sourceUrl,
    public_verification_url: safeUrl(body.public_verification_url || body.public_registry_url || sourceUrl),
    verification_status: normalizedPhone ? 'phone_pending_claim' : 'pending_review',
    status: 'candidate',
    completeness_score: Math.min(100, 20 + (body.name ? 20 : 0) + (normalizedPhone || email || sourceUrl ? 25 : 0) + (body.industry || body.service_type ? 20 : 0) + (body.intro ? 15 : 0) + (address ? 10 : 0)),
    fields: {
      ...(existing?.fields || {}),
      source: body.source || 'admin_manual_supply',
      ref_code: cleanText(body.ref_code || '', 80),
      notes: cleanText(body.notes || '', 500),
      service_board: serviceBoard,
      industry_major: industryMajor,
      industry_minor: industryMinor,
      contact_name: contactName,
      phone: rawPhone,
      email,
      address,
      vehicle_types: capabilities.vehicle_types,
      availability: capabilities.availability,
      service_area: capabilities.service_area || address || cleanText(body.city || '', 80),
      pickup_range: capabilities.pickup_range,
      capacity_notes: capabilities.capacity_notes,
      capability_text: capabilities.capability_text,
      business_registration_number: cleanText(body.business_registration_number || body.abn || body.acn || '', 40),
      public_registry_url: safeUrl(body.public_registry_url || ''),
      pre_registered: true,
      claim_mode: 'phone_verification',
      phone_claim_required: Boolean(normalizedPhone),
      claimed: false,
      normalized_phone: normalizedPhone,
      card_status: 'ready',
      collection_task_id: cleanText(body.collection_task_id || '', 80),
      source_text: cleanText(body.source_text || '', 1000),
      source_url: sourceUrl,
      source_provider: cleanText(body.source_channel || body.provider || '', 80),
      google_place_id: cleanText(body.google_place_id || body.place_id || '', 160),
      search_query: cleanText(body.search_query || '', 260),
      template_queries: Array.isArray(body.template_queries) ? body.template_queries.map(item => cleanText(item, 260)).filter(Boolean).slice(0, 6) : [],
      search_quality_score: Number(body.search_quality_score || 0),
      storage_reason: cleanText(body.storage_reason || '公开搜索结果具备可用联系方式、城市匹配和可追溯来源，进入华伴供给库。', 400),
      dedupe_key: dedupeKey,
      admin_created_at: new Date().toISOString()
    }
  };
  const richPayload = {
    ...payload,
    normalized_contact: normalizedPhone,
    claimed_phone: normalizedPhone,
    language_lane: cleanText(body.language_lane || 'zh', 20),
    market_scope: 'local_supply',
    source_country: payload.country,
    source_state: cleanText(body.source_state || body.state || '', 40),
    source_city: cleanText(body.source_city || payload.city, 80),
    source_suburb: cleanText(body.source_suburb || body.suburb || '', 80),
    normalized_address: address,
    availability: capabilities.availability,
    collection_task_id: cleanText(body.collection_task_id || '', 80) || null,
    dedupe_key: dedupeKey,
    first_seen_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    duplicate_count: existing?.id ? Number(existing.duplicate_count || 0) + 1 : 0,
    source_urls: Array.from(new Set([...(Array.isArray(existing?.source_urls) ? existing.source_urls : []), sourceUrl].filter(Boolean))).slice(0, 12)
  };
  if (!payload.name && !payload.contact) throw new Error('至少需要姓名或联系方式');
  const path = existing?.id
    ? `huaban_supply_profiles?id=eq.${encodeURIComponent(existing.id)}&tenant_id=eq.${TENANT_ID}`
    : 'huaban_supply_profiles';
  const method = existing?.id ? 'PATCH' : 'POST';
  let rows;
  const findExistingAfterDuplicate = async () => {
    const filters = [];
    if (dedupeKey) filters.push(`dedupe_key.eq.${encodeURIComponent(dedupeKey)}`);
    if (sourceUrl) {
      filters.push(`website.eq.${encodeURIComponent(sourceUrl)}`);
      filters.push(`public_verification_url.eq.${encodeURIComponent(sourceUrl)}`);
    }
    if (normalizedPhone) {
      filters.push(`normalized_contact.eq.${encodeURIComponent(normalizedPhone)}`);
      filters.push(`claimed_phone.eq.${encodeURIComponent(normalizedPhone)}`);
    }
    if (!filters.length) return null;
    const duplicateRows = await supa(`huaban_supply_profiles?tenant_id=eq.${TENANT_ID}&or=(${filters.join(',')})&order=updated_at.desc&limit=1&select=*`).catch(() => []);
    return Array.isArray(duplicateRows) ? duplicateRows[0] : null;
  };
  try {
    rows = await supa(path, {
      method,
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(richPayload)
    });
  } catch (error) {
    if (isDuplicateDbError(error)) {
      const duplicate = await findExistingAfterDuplicate();
      if (duplicate) {
        duplicate.was_existing = true;
        return duplicate;
      }
      throw new Error('供给资料已存在，本次已按重复跳过。');
    }
    try {
      rows = await supa(path, {
        method,
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(payload)
      });
    } catch (fallbackError) {
      if (isDuplicateDbError(fallbackError)) {
        const duplicate = await findExistingAfterDuplicate();
        if (duplicate) {
          duplicate.was_existing = true;
          return duplicate;
        }
        throw new Error('供给资料已存在，本次已按重复跳过。');
      }
      throw fallbackError;
    }
  }
  const lead = Array.isArray(rows) ? rows[0] : rows;
  if (lead && typeof lead === 'object') lead.was_existing = Boolean(existing?.id);
  if (normalizedPhone && lead?.id) {
    await supa('huaban_identity_links', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        tenant_id: TENANT_ID,
        phone: payload.contact,
        normalized_phone: normalizedPhone,
        friend_code: payload.supplier_code,
        display_name: payload.name || '待认领服务者',
        industry: payload.service_type,
        city: payload.city,
        country: payload.country,
        source: 'admin_supply_preclaim',
        source_ref: lead.id,
        link_type: 'supply_profile_phone_preclaim',
        status: 'active',
        owner_code: payload.supplier_code,
        supply_profile_id: lead.id,
        fields: { claim_mode: 'phone_verification', pre_registered: true, ref_code: payload.fields.ref_code }
      })
    }).catch(() => null);
  }
  return lead;
}

function sha256(value = '') {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function extractEmails(text = '') {
  return Array.from(new Set(String(text || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []))
    .map(item => item.toLowerCase())
    .filter(email => !isPlaceholderEmail(email))
    .slice(0, 3);
}

function extractPhones(text = '') {
  const value = String(text || '')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/www\.\S+/gi, ' ')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, ' ');
  const matches = value.match(/(?:\+?61[\s.-]?)?(?:0?4[\d\s.-]{8,12}|[2378][\d\s.-]{7,11})/g) || [];
  return Array.from(new Set(matches.map(item => normalizePhone(item)).filter(phone => phone && phone.length >= 9))).slice(0, 4);
}

function extractAddress(text = '') {
  const value = String(text || '').replace(/\s+/g, ' ');
  const match = value.match(/\b\d{1,5}\s+[A-Za-z0-9' -]{2,60}\s+(?:St|Street|Rd|Road|Ave|Avenue|Dr|Drive|Ct|Court|Pde|Parade|Cres|Crescent|Blvd|Boulevard|Hwy|Highway|Lane|Ln|Way)\b[^,.;\n]*/i);
  return cleanText(match?.[0] || '', 220);
}

function extractAustralianBusinessNumber(text = '') {
  const value = String(text || '').replace(/\s+/g, ' ');
  const abn = value.match(/\bABN[:\s-]*((?:\d\s*){11})\b/i)?.[1] || '';
  if (abn) return abn.replace(/\D/g, '');
  const acn = value.match(/\bACN[:\s-]*((?:\d\s*){9})\b/i)?.[1] || '';
  return acn ? acn.replace(/\D/g, '') : '';
}

function urlHost(value = '') {
  const href = safeUrl(value);
  if (!href) return '';
  try {
    return new URL(href).hostname.replace(/^www\./i, '').toLowerCase();
  } catch (error) {
    return '';
  }
}

function isGenericSearchResultTitle(title = '') {
  const text = cleanText(title, 180).toLowerCase();
  if (!text) return true;
  return /^(best|top|near me|find|compare|book|hire)\b/i.test(text)
    || /\b(best|top)\s+\d+\b/i.test(text)
    || /\b(search results|directory|yellow pages|true local|oneflare|hipages|airtasker|facebook|instagram|linkedin)\b/i.test(text)
    || /^(home|contact|about|services|phone|email|website)$/i.test(text);
}

function isWeakBusinessName(name = '', fallback = '') {
  const text = cleanText(name, 140);
  if (!text || text === '未命名服务者') return true;
  const fallbackText = cleanText(fallback, 140).toLowerCase();
  const low = text.toLowerCase();
  return low === fallbackText || isGenericSearchResultTitle(text);
}

function cleanBusinessName(title = '', fallback = '') {
  const text = cleanText(title || fallback, 160)
    .replace(/\s*[-|–—]\s*(Facebook|Instagram|Yellow Pages|Google|Yelp|True Local|Oneflare|Airtasker).*$/i, '')
    .replace(/\s*[-|–—]\s*(Official Site|Official Website|Contact Us|Home).*$/i, '')
    .replace(/^\s*(best|top)\s+\d+\s+/i, '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/www\.\S+/gi, '')
    .replace(/\b\+?61[\d\s().-]{7,}\b/g, '')
    .replace(/\b0\d[\d\s().-]{7,}\b/g, '')
    .replace(/\b(Home|Contact|About|Services|Phone|Email|Website)\b\s*$/i, '')
    .trim();
  return cleanText(text || fallback || '未命名服务者', 120);
}

function resultText(result = {}) {
  return [result.title, result.snippet, result.url].map(value => cleanText(value, 1200)).filter(Boolean).join('\n');
}

function normalizeSearchResult(result = {}) {
  const title = cleanText(result.title || '', 220);
  const snippet = cleanText(result.snippet || result.description || '', 1400);
  const url = safeUrl(result.url || result.link || '');
  return {
    ...result,
    title,
    snippet,
    url
  };
}

const SUPPLY_SEARCH_TEMPLATES = [
  {
    code: 'airport_pickup',
    label: '接送机',
    keywords: ['接送机', '机场接送', '接机', '送机', 'airport pickup', 'airport transfer', 'airport shuttle', 'chauffeur'],
    zh: ['{city} 华人 接送机 电话', '{city} 机场接送 微信 电话', '{city} 华人司机 接机 送机', '{city} 包车 机场接送 联系方式'],
    en: ['{city} Chinese airport transfer phone', '{city} airport pickup Chinese driver contact', '{city} chauffeur airport transfer phone', '{city} airport shuttle Chinese contact']
  },
  {
    code: 'car_rental',
    label: '汽车租赁',
    keywords: ['租车', '汽车租赁', 'car rental', 'car hire', 'vehicle rental'],
    zh: ['{city} 华人 租车 电话', '{city} 汽车租赁 华人 联系方式', '{city} 中文 car rental phone'],
    en: ['{city} car rental Chinese contact', '{city} vehicle rental phone', '{city} car hire Chinese service']
  },
  {
    code: 'auto_repair',
    label: '汽车维修',
    keywords: ['修车', '汽车维修', '汽修', '保养', 'mechanic', 'auto repair', 'car repair'],
    zh: ['{city} 华人 修车 电话', '{city} 中文 汽车维修 联系方式', '{city} 华人 mechanic phone', '{city} 汽修 钣金 喷漆 电话'],
    en: ['{city} Chinese mechanic phone', '{city} auto repair Chinese contact', '{city} car repair phone Chinese']
  },
  {
    code: 'used_car',
    label: '二手车',
    keywords: ['二手车', '车商', 'used car', 'second hand car'],
    zh: ['{city} 华人 二手车 电话', '{city} 二手车商 华人 联系方式', '{city} 买二手车 中文 电话'],
    en: ['{city} Chinese used car dealer phone', '{city} second hand car Chinese contact']
  },
  {
    code: 'gardening',
    label: '割草园艺',
    keywords: ['割草', '草坪', '园艺', 'lawn mowing', 'gardening'],
    zh: ['{city} 华人 割草 电话', '{city} 草坪 园艺 华人 联系方式', '{city} lawn mowing Chinese phone'],
    en: ['{city} Chinese lawn mowing phone', '{city} gardening service Chinese contact', '{city} lawn care phone']
  },
  {
    code: 'plumber',
    label: '水管维修',
    keywords: ['水管', '水电', '漏水', 'plumber', 'plumbing'],
    zh: ['{city} 华人 水管工 电话', '{city} 中文 水管维修 联系方式', '{city} 漏水 马桶 水管 电话'],
    en: ['{city} Chinese plumber phone', '{city} plumbing Chinese contact']
  },
  {
    code: 'electrician',
    label: '电工',
    keywords: ['电工', '电路', '插座', 'electrician', 'electrical'],
    zh: ['{city} 华人 电工 电话', '{city} 中文 电工 联系方式', '{city} 电路 插座 维修 电话'],
    en: ['{city} Chinese electrician phone', '{city} electrical service Chinese contact']
  },
  {
    code: 'chinese_school',
    label: '中文学校',
    keywords: ['中文学校', '中文课', '华文学校', 'mandarin school', 'chinese school'],
    zh: ['{city} 中文学校 电话', '{city} 华人 中文课 联系方式', '{city} 周末中文学校 phone'],
    en: ['{city} Chinese school contact', '{city} Mandarin class phone', '{city} weekend Chinese school']
  },
  {
    code: 'kids_activity',
    label: '儿童兴趣班',
    keywords: ['兴趣班', '儿童班', 'after school', 'kids activity', 'art class', 'music class', 'dance class'],
    zh: ['{city} 华人 儿童兴趣班 电话', '{city} 小孩 画画 舞蹈 音乐 联系方式', '{city} after school 华人 phone'],
    en: ['{city} kids activity Chinese contact', '{city} after school class phone', '{city} art music dance class children contact']
  },
  {
    code: 'seafood',
    label: '海鲜水产',
    keywords: ['海鲜', '水产', '龙虾', 'seafood', 'lobster'],
    zh: ['{city} 华人 海鲜 电话', '{city} 龙虾 水产 联系方式', '{city} seafood lobster Chinese phone'],
    en: ['{city} seafood lobster phone', '{city} Chinese seafood supplier contact', '{city} fish market lobster contact']
  },
  {
    code: 'kitchenware',
    label: '厨具',
    keywords: ['锅', '厨具', 'cookware', 'kitchenware', 'wok', 'pan', 'pot'],
    zh: ['{city} 华人 厨具 电话', '{city} 买锅 厨房用品 联系方式', '{city} wok cookware store phone'],
    en: ['{city} kitchenware cookware phone', '{city} wok pan pot store contact']
  },
  {
    code: 'building_materials',
    label: '建材',
    keywords: ['瓷砖', '建材', 'tiles', 'hardware', 'building materials'],
    zh: ['{city} 华人 建材 电话', '{city} 瓷砖 地砖 联系方式', '{city} tile building materials phone'],
    en: ['{city} tiles building materials phone', '{city} hardware building supplies contact']
  },
  {
    code: 'plants_flowers',
    label: '花卉苗木',
    keywords: ['果树', '苗圃', '花卉', 'nursery', 'fruit tree', 'plants'],
    zh: ['{city} 果树 苗圃 电话', '{city} 华人 花卉 园艺店 联系方式', '{city} fruit tree nursery phone'],
    en: ['{city} fruit tree nursery phone', '{city} garden centre plants contact']
  },
  {
    code: 'accounting',
    label: '会计税务',
    keywords: ['会计', '税务', '报税', 'accountant', 'tax'],
    zh: ['{city} 华人 会计 电话', '{city} 中文 报税 税务 联系方式', '{city} accountant Chinese phone'],
    en: ['{city} Chinese accountant phone', '{city} tax accountant Chinese contact']
  },
  {
    code: 'migration',
    label: '移民留学',
    keywords: ['移民', '签证', '留学', 'migration', 'visa', 'education agent'],
    zh: ['{city} 华人 移民 留学 电话', '{city} 签证 中介 联系方式', '{city} education migration agent Chinese phone'],
    en: ['{city} Chinese migration agent phone', '{city} visa education agent Chinese contact']
  }
];

function supplySearchTemplateFor(task = {}) {
  const code = canonicalSupplyCode(task.category_code || task.service_type_code || task.search_query || '', task.category_name || task.search_query || '');
  const text = [task.category_name, task.category_code, task.search_query].join(' ').toLowerCase();
  return SUPPLY_SEARCH_TEMPLATES.find(item => item.code === code)
    || SUPPLY_SEARCH_TEMPLATES.find(item => item.keywords.some(keyword => text.includes(String(keyword).toLowerCase())))
    || null;
}

function renderSupplySearchTemplate(template = '', task = {}) {
  const city = normalizeAustraliaCity(task.city || '') || 'Australia';
  const category = cleanText(task.category_name || task.search_query || '本地服务', 120);
  return cleanText(String(template || '')
    .replace(/\{city\}/g, city)
    .replace(/\{category\}/g, category), 260);
}

function buildSupplySearchQueries(task = {}, maxQueries = 3) {
  const base = cleanText(task.search_query || '', 260);
  const lane = cleanText(task.language_lane || 'all', 20).toLowerCase();
  const template = supplySearchTemplateFor(task);
  const candidates = [];
  if (base) candidates.push(base);
  if (template) {
    const templateList = lane === 'zh' ? template.zh
      : lane === 'en' ? template.en
        : [...template.zh.slice(0, 2), ...template.en.slice(0, 2)];
    templateList.forEach(item => candidates.push(renderSupplySearchTemplate(item, { ...task, category_name: template.label || task.category_name })));
  }
  if (!candidates.length) {
    const city = normalizeAustraliaCity(task.city || '') || 'Australia';
    const keyword = cleanText(task.category_name || task.category_code || 'local service', 120);
    candidates.push(`${city} 华人 ${keyword} 电话`);
    candidates.push(`${city} ${keyword} service phone contact`);
  }
  return Array.from(new Set(candidates.filter(Boolean))).slice(0, maxQueries);
}

function buildAdHocSupplyTasks({ keyword = '', city = '', language = 'all', limit = 4 } = {}) {
  const cityName = normalizeAustraliaCity(city || '') || 'Melbourne';
  const minor = canonicalSupplyMinor(keyword || '本地服务');
  const code = canonicalSupplyCode(keyword || '', minor);
  const lanes = language && language !== 'all' ? [language] : ['zh', 'en'];
  const tasks = [];
  lanes.forEach(lane => {
    const baseTask = {
      id: null,
      task_date: new Date().toISOString().slice(0, 10),
      country: 'Australia',
      state: '',
      city: cityName,
      language_lane: lane,
      category_code: code,
      category_name: minor || keyword || '本地服务',
      search_query: lane === 'zh'
        ? `${cityName} 华人 ${minor || keyword || '本地服务'} 电话`
        : `${cityName} ${minor || keyword || 'local service'} phone contact`,
      source_name: 'manual_supply_search_radar',
      source_url: '',
      priority: 1,
      fields: { ad_hoc: true, supply_search_radar: true }
    };
    const queries = buildSupplySearchQueries(baseTask, 3);
    queries.forEach((query, index) => {
      tasks.push({
        ...baseTask,
        search_query: query,
        priority: index + 1,
        fields: {
          ...baseTask.fields,
          template_queries: queries,
          template_query_rank: index + 1
        }
      });
    });
  });
  const seen = new Set();
  return tasks.filter(task => {
    const key = `${task.language_lane}:${task.search_query}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, Math.max(1, limit));
}

function isUnusableSupplyDomain(host = '') {
  return /\b(google|bing|brave|facebook|instagram|linkedin|youtube|tiktok|reddit|pinterest|wikipedia|tripadvisor|gumtree|yellowpages|truelocal|oneflare|hipages|airtasker)\./i.test(host);
}

function scoreSupplyCandidate(candidate = {}, result = {}, task = {}) {
  const host = urlHost(result.url);
  const sourceProvider = cleanText(result.provider || candidate.provider || '', 80);
  const fromGooglePlaces = sourceProvider === 'google_places';
  let score = 0;
  if (!isWeakBusinessName(candidate.businessName, task.category_name)) score += 20;
  if (candidate.phones?.[0]) score += 30;
  if (candidate.emails?.[0]) score += 16;
  if (candidate.address) score += 14;
  if (candidate.registrationNumber) score += 8;
  if (result.url && host && (!isUnusableSupplyDomain(host) || fromGooglePlaces)) score += 12;
  if (fromGooglePlaces) score += 16;
  if (candidate.inferredCity && !candidate.cityMismatch) score += 10;
  if (candidate.cityMismatch) score -= 45;
  if (isGenericSearchResultTitle(result.title)) score -= 20;
  if (isUnusableSupplyDomain(host) && !fromGooglePlaces) score -= 18;
  return Math.max(0, Math.min(100, score));
}

function buildSupplyCandidateFromSearchResult(task = {}, result = {}, provider = 'public_search') {
  const text = resultText(result);
  const phones = extractPhones(text);
  const emails = extractEmails(text);
  const address = extractAddress(text);
  const registrationNumber = extractAustralianBusinessNumber(text);
  const businessName = cleanBusinessName(result.title, task.category_name);
  const host = urlHost(result.url);
  const cityEvidence = `${result.title || ''} ${result.snippet || ''} ${result.url || ''} ${address}`;
  const inferredCity = inferAustraliaCityFromText(cityEvidence, task.city);
  const cityMismatch = hasConflictingCity(task.city, inferredCity) || textMentionsOtherCity(task.city, cityEvidence);
  const hasDirectContact = Boolean(phones[0] || emails[0]);
  const sourceProvider = cleanText(result.provider || provider || '', 80);
  const fromGooglePlaces = sourceProvider === 'google_places';
  const hasUsableWebsite = Boolean(result.url && host && (!isUnusableSupplyDomain(host) || fromGooglePlaces));
  const weakName = isWeakBusinessName(businessName, task.category_name);
  const qualityScore = scoreSupplyCandidate({
    phones,
    emails,
    address,
    registrationNumber,
    businessName,
    inferredCity,
    cityMismatch,
    provider: sourceProvider
  }, result, task);
  const confidence = Math.min(0.96, Math.max(0.1, qualityScore / 100));
  return {
    text,
    phones,
    emails,
    address,
    registrationNumber,
    businessName,
    inferredCity,
    cityMismatch,
    qualityScore,
    confidence,
    provider,
    shouldStoreProfile: Boolean(!weakName && hasDirectContact && !cityMismatch && hasUsableWebsite && qualityScore >= 58),
    skip_reason: cityMismatch
      ? `城市不一致：任务${normalizeAustraliaCity(task.city) || '未知'}，结果${inferredCity || '未知'}`
      : weakName
      ? '搜索结果标题不像具体商家/服务者'
      : !hasDirectContact
        ? '缺少电话或邮箱'
        : !hasUsableWebsite
          ? '来源不是可用商家网站、联系页面或商家名录'
          : qualityScore < 58
            ? `质量分不足：${qualityScore}`
        : ''
  };
}

async function googlePlacesSearch(query, languageLane, count) {
  const key = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';
  if (!key) return null;
  const fieldMask = [
    'places.id',
    'places.displayName',
    'places.formattedAddress',
    'places.nationalPhoneNumber',
    'places.internationalPhoneNumber',
    'places.websiteUri',
    'places.googleMapsUri',
    'places.businessStatus',
    'places.types'
  ].join(',');
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': fieldMask
    },
    body: JSON.stringify({
      textQuery: query,
      pageSize: Math.min(Math.max(Number(count || 4), 1), 8),
      languageCode: languageLane === 'zh' ? 'zh-CN' : 'en',
      regionCode: 'AU',
      includePureServiceAreaBusinesses: true
    })
  });
  if (!res.ok) throw new Error(`Google Places ${res.status}`);
  const json = await res.json();
  return (json.places || []).map(place => {
    const name = cleanText(place.displayName?.text || '', 220);
    const phone = cleanText(place.internationalPhoneNumber || place.nationalPhoneNumber || '', 80);
    const address = cleanText(place.formattedAddress || '', 260);
    const website = safeUrl(place.websiteUri || '');
    const mapsUrl = safeUrl(place.googleMapsUri || '');
    const status = cleanText(place.businessStatus || '', 80);
    const types = Array.isArray(place.types) ? place.types.join(' ') : '';
    return normalizeSearchResult({
      title: name,
      snippet: [address, phone, website, status, types].filter(Boolean).join(' · '),
      url: website || mapsUrl,
      provider: 'google_places',
      place_id: cleanText(place.id || '', 160)
    });
  });
}

async function braveSearch(query, languageLane, count) {
  const key = process.env.BRAVE_SEARCH_API_KEY || process.env.BRAVE_API_KEY || '';
  if (!key) return null;
  const params = new URLSearchParams({
    q: query,
    count: String(count),
    country: 'AU',
    search_lang: languageLane === 'zh' ? 'zh-hans' : 'en'
  });
  const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params.toString()}`, {
    headers: { Accept: 'application/json', 'X-Subscription-Token': key }
  });
  if (!res.ok) throw new Error(`Brave Search ${res.status}`);
  const json = await res.json();
  return (json.web?.results || []).map(item => normalizeSearchResult({
    title: item.title,
    snippet: item.description,
    url: item.url,
    provider: 'brave'
  }));
}

async function serpApiSearch(query, languageLane, count) {
  const key = process.env.SERPAPI_KEY || process.env.SERP_API_KEY || '';
  if (!key) return null;
  const params = new URLSearchParams({
    engine: 'google',
    q: query,
    api_key: key,
    num: String(count),
    gl: 'au',
    hl: languageLane === 'zh' ? 'zh-cn' : 'en'
  });
  const res = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
  if (!res.ok) throw new Error(`SerpAPI ${res.status}`);
  const json = await res.json();
  return (json.organic_results || []).map(item => normalizeSearchResult({
    title: item.title,
    snippet: item.snippet,
    url: item.link,
    provider: 'serpapi'
  }));
}

async function bingSearch(query, languageLane, count) {
  const key = process.env.BING_SEARCH_API_KEY || process.env.AZURE_BING_SEARCH_KEY || '';
  if (!key) return null;
  const params = new URLSearchParams({
    q: query,
    count: String(count),
    mkt: languageLane === 'zh' ? 'zh-CN' : 'en-AU'
  });
  const res = await fetch(`https://api.bing.microsoft.com/v7.0/search?${params.toString()}`, {
    headers: { 'Ocp-Apim-Subscription-Key': key }
  });
  if (!res.ok) throw new Error(`Bing Search ${res.status}`);
  const json = await res.json();
  return (json.webPages?.value || []).map(item => normalizeSearchResult({
    title: item.name,
    snippet: item.snippet,
    url: item.url,
    provider: 'bing'
  }));
}

async function searchPublicSupply(task, perTask) {
  const queries = buildSupplySearchQueries(task, 3);
  if (!queries.length) return { provider: 'none', results: [] };
  const languageLane = task.language_lane || 'en';
  const providers = [googlePlacesSearch, braveSearch, serpApiSearch, bingSearch];
  const errors = [];
  const collected = [];
  const seen = new Set();
  let providerName = 'none';
  for (const query of queries) {
    for (const provider of providers) {
      let rows = null;
      try {
        rows = await provider(query, languageLane, perTask);
      } catch (error) {
        errors.push(`${provider.name}: ${error.message}`);
        continue;
      }
      if (!Array.isArray(rows)) continue;
      if (!rows.length) continue;
      providerName = rows[0]?.provider || provider.name.replace('Search', '').toLowerCase();
      rows.forEach(row => {
        const key = cleanText(row.url || `${row.title}:${row.snippet}`, 700).toLowerCase();
        if (!key || seen.has(key)) return;
        seen.add(key);
        collected.push({
          ...row,
          search_query: query,
          template_queries: queries
        });
      });
      break;
    }
    if (collected.length >= perTask) break;
  }
  if (!collected.length && errors.length) throw new Error(errors.join('；'));
  return { provider: providerName, results: collected.slice(0, perTask), queries };
}

async function insertRawCapture(task, result, provider, rank) {
  const rawText = resultText(result);
  const contentHash = sha256(`${result.url || ''}\n${rawText}`);
  const payload = {
    tenant_id: TENANT_ID,
    capture_type: 'public_search_result',
    source_name: cleanText(task.source_name || provider || 'public_search', 120),
    source_platform: provider,
    source_url: cleanText(result.url || '', 500),
    source_country: cleanText(task.country || 'Australia', 80),
    source_state: cleanText(task.state || '', 40),
    source_city: cleanText(task.city || '', 80),
    language_hint: cleanText(task.language_lane || 'unknown', 20),
    acquisition_method: 'public_search',
    raw_text: cleanText(rawText, 4000),
    content_hash: contentHash,
    public_data_policy: 'public_metadata_only',
    status: 'extracted',
    fields: {
      collection_task_id: task.id,
      result_rank: rank,
      search_query: result.search_query || task.search_query,
      template_queries: result.template_queries || [],
      category_code: task.category_code,
      category_name: task.category_name
    }
  };
  try {
    const rows = await supa('raw_captures', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(payload)
    });
    return { row: Array.isArray(rows) ? rows[0] : rows, duplicate: false };
  } catch (error) {
    if (String(error.message || '').includes('duplicate') || String(error.message || '').includes('23505')) {
      return { row: null, duplicate: true };
    }
    throw error;
  }
}

async function insertExtractedEntity(task, rawCapture, result, provider) {
  const candidate = buildSupplyCandidateFromSearchResult(task, result, provider);
  const capabilities = extractSupplyCapabilities(candidate.text, {
    service_type: task.category_name,
    address: candidate.address,
    city: task.city
  });
  const payload = {
    tenant_id: TENANT_ID,
    raw_capture_id: rawCapture?.id || null,
    entity_type: 'supply_candidate',
    name: candidate.businessName,
    business_name: candidate.businessName,
    contact_phone: candidate.phones[0] || '',
    email: candidate.emails[0] || '',
    website: cleanText(result.url || '', 500),
    address: candidate.address,
    country: cleanText(task.country || 'Australia', 80),
    state: cleanText(task.state || '', 40),
    city: cleanText(candidate.inferredCity || task.city || '', 80),
    language_lane: cleanText(task.language_lane || 'unknown', 20),
    category_code: cleanText(task.category_code || '', 80),
    category_name: cleanText(task.category_name || '', 120),
    service_type: cleanText(task.category_name || task.category_code || '本地服务', 120),
    service_type_code: cleanText(task.category_code || '', 80),
    service_area: candidate.address || cleanText(candidate.inferredCity || task.city || '', 120),
    intro: cleanText(result.snippet || '', 1000),
    source_evidence: cleanText(candidate.text, 1600),
    confidence: candidate.confidence,
    completeness_score: Math.round(candidate.confidence * 100),
    review_status: candidate.shouldStoreProfile && candidate.confidence >= 0.62 ? 'auto_candidate' : 'pending_review',
    suggested_target: 'supply_profiles',
    standard_payload: {
      phone: candidate.phones[0] || '',
      email: candidate.emails[0] || '',
      address: candidate.address,
      business_registration_number: candidate.registrationNumber,
      vehicle_types: capabilities.vehicle_types,
      availability: capabilities.availability,
      service_area: capabilities.service_area || candidate.address || cleanText(candidate.inferredCity || task.city || '', 120),
      pickup_range: capabilities.pickup_range,
      capacity_notes: capabilities.capacity_notes,
      source_url: result.url,
      provider,
      search_query: result.search_query || task.search_query,
      template_queries: result.template_queries || [],
      search_quality_score: candidate.qualityScore,
      should_store_profile: candidate.shouldStoreProfile,
      skip_reason: candidate.skip_reason
    },
    fields: {
      collection_task_id: task.id,
      all_phones: candidate.phones,
      all_emails: candidate.emails,
      business_registration_number: candidate.registrationNumber,
      vehicle_types: capabilities.vehicle_types,
      availability: capabilities.availability,
      service_area: capabilities.service_area || candidate.address || cleanText(candidate.inferredCity || task.city || '', 120),
      pickup_range: capabilities.pickup_range,
      capacity_notes: capabilities.capacity_notes,
      inferred_city: candidate.inferredCity,
      city_mismatch: candidate.cityMismatch,
      search_query: result.search_query || task.search_query,
      template_queries: result.template_queries || [],
      search_quality_score: candidate.qualityScore,
      skip_reason: candidate.skip_reason
    }
  };
  try {
    const rows = await supa('extracted_entities', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(payload)
    });
    return Array.isArray(rows) ? rows[0] : rows;
  } catch (error) {
    if (isDuplicateDbError(error)) return { duplicate: true };
    throw error;
  }
}

async function createSupplyLeadFromSearchResult(task, result, provider) {
  const candidate = buildSupplyCandidateFromSearchResult(task, result, provider);
  if (!candidate.shouldStoreProfile) {
    return { skipped_profile: true, skip_reason: candidate.skip_reason };
  }
  return createSupplyLead({
    source_mode: 'public_search',
    source_channel: provider,
    source_url: result.url,
    public_verification_url: result.url,
    collection_task_id: task.id,
    name: candidate.businessName,
    contact_name: '',
    phone: candidate.phones[0] || '',
    email: candidate.emails[0] || '',
    contact: candidate.phones[0] || candidate.emails[0] || '',
    address: candidate.address,
    business_registration_number: candidate.registrationNumber,
    industry_major: task.category_name,
    industry_minor: task.category_name,
    industry: task.category_code,
    service_type: task.category_name,
    service_type_code: task.category_code,
    city: candidate.inferredCity || task.city,
    country: task.country || 'Australia',
    source_state: task.state,
    source_city: candidate.inferredCity || task.city,
    language_lane: task.language_lane,
    intro: result.snippet,
    source_text: candidate.text,
    google_place_id: result.place_id || result.placeId || '',
    search_query: result.search_query || task.search_query,
    template_queries: result.template_queries || [],
    search_quality_score: candidate.qualityScore,
    notes: candidate.cityMismatch ? candidate.skip_reason : '',
    website: result.url
  });
}

async function updateCollectionTask(task, patch) {
  if (!task?.id) return;
  await supa(`huaban_supply_collection_tasks?id=eq.${encodeURIComponent(task.id)}&tenant_id=eq.${TENANT_ID}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() })
  }).catch(error => console.warn('collection task update skipped', error.message));
}

async function runSupplyCollection(body = {}) {
  const limit = Math.min(Math.max(Number(body.limit || 8), 1), 30);
  const perTask = Math.min(Math.max(Number(body.per_task || 4), 1), 8);
  const keyword = cleanText(body.keyword || body.q || '', 120);
  const cityFilter = normalizeAustraliaCity(body.city || '');
  const languageFilter = cleanText(body.language_lane || body.lang || 'all', 20).toLowerCase();
  const providedTasks = Array.isArray(body.tasks) ? body.tasks.slice(0, limit) : [];
  const canSearch = Boolean(process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY || process.env.BRAVE_SEARCH_API_KEY || process.env.BRAVE_API_KEY || process.env.SERPAPI_KEY || process.env.SERP_API_KEY || process.env.BING_SEARCH_API_KEY || process.env.AZURE_BING_SEARCH_KEY);
  let generated = null;
  if (!providedTasks.length && body.skip_task_generation !== true) {
    await supa('rpc/huaban_create_daily_supply_collection_tasks', {
      method: 'POST',
      body: JSON.stringify({ p_tenant_id: TENANT_ID })
    }).then(result => { generated = result; }).catch(error => {
      generated = { skipped: true, error: error.message };
    });
  } else {
    generated = { skipped: true, reason: providedTasks.length ? '使用雷达任务池，不额外生成任务。' : '本次跳过任务生成。' };
  }

  if (!canSearch) {
    return {
      ok: true,
      generated,
      processed_tasks: 0,
      stored_profiles: 0,
      message: '还没有配置公开搜索 API Key，已保留采集任务，但不能抓取内容。可配置 GOOGLE_PLACES_API_KEY / BRAVE_SEARCH_API_KEY / SERPAPI_KEY / BING_SEARCH_API_KEY 后采集。'
    };
  }

  let list = providedTasks;
  if (!list.length) {
    const taskParams = new URLSearchParams({
      tenant_id: `eq.${TENANT_ID}`,
      status: 'in.(queued,failed,skipped,processed,captured)',
      order: 'priority.asc,updated_at.asc,created_at.asc',
      limit: String(Math.max(limit * 3, limit)),
      select: 'id,task_date,country,state,city,language_lane,category_code,category_name,search_query,source_name,source_url,priority,fields'
    });
    if (cityFilter) taskParams.set('city', `ilike.*${cityFilter}*`);
    if (languageFilter && languageFilter !== 'all') taskParams.set('language_lane', `eq.${languageFilter}`);
    const tasks = await supa(`huaban_supply_collection_tasks?${taskParams.toString()}`);
    list = Array.isArray(tasks) ? tasks : [];
    if (keyword) {
      const needle = keyword.toLowerCase();
      list = list.filter(task => [
        task.search_query,
        task.category_name,
        task.category_code,
        task.city,
        task.language_lane
      ].join(' ').toLowerCase().includes(needle));
    }
  }
  const adHocTasks = (!providedTasks.length && (keyword || cityFilter))
    ? buildAdHocSupplyTasks({ keyword: keyword || '本地服务', city: cityFilter || 'Melbourne', language: languageFilter, limit: Math.min(limit, 8) })
    : [];
  const seenTasks = new Set();
  list = [...adHocTasks, ...list].filter(task => {
    const key = `${task.language_lane || ''}:${task.city || ''}:${task.search_query || ''}`.toLowerCase();
    if (seenTasks.has(key)) return false;
    seenTasks.add(key);
    return true;
  }).slice(0, limit);
  let captured = 0;
  let extracted = 0;
  let stored = 0;
  let duplicates = 0;
  let skippedProfiles = 0;
  const errors = [];
  const warnings = [];

  for (const task of list) {
    await updateCollectionTask(task, { status: 'collecting' });
    try {
      const { provider, results } = await searchPublicSupply(task, perTask);
      let taskCaptured = 0;
      let taskExtracted = 0;
      let taskStored = 0;
      let taskDuplicates = 0;
      let taskSkippedProfiles = 0;
      const taskWarnings = [];
      for (let index = 0; index < results.length; index += 1) {
        const result = results[index];
        if (!result.url && !result.title) continue;
        captured += 1;
        taskCaptured += 1;
        const lead = await createSupplyLeadFromSearchResult(task, result, provider);
        if (lead?.skipped_profile) {
          taskSkippedProfiles += 1;
          skippedProfiles += 1;
        } else if (lead?.was_existing) {
          duplicates += 1;
          taskDuplicates += 1;
        } else {
          stored += 1;
          taskStored += 1;
        }

        try {
          const raw = await insertRawCapture(task, result, provider, index + 1);
          if (raw.duplicate) {
            duplicates += 1;
            taskDuplicates += 1;
          }
          await insertExtractedEntity(task, raw.row, result, provider);
          extracted += 1;
          taskExtracted += 1;
        } catch (error) {
          const note = cleanText(error.message, 220);
          taskWarnings.push(note);
          warnings.push({ task_id: task.id, message: note });
        }
      }
      await updateCollectionTask(task, {
        status: taskStored ? 'stored' : taskExtracted ? 'processed' : taskCaptured ? 'captured' : 'skipped',
        capture_count: taskCaptured,
        extracted_count: taskExtracted,
        stored_count: taskStored,
        error_message: taskWarnings.length
          ? `搜索完成；识别日志待补：${taskWarnings.slice(0, 2).join('；')}`
          : taskDuplicates && !taskStored ? '公开搜索结果已存在，已按重复跳过。'
            : taskSkippedProfiles && !taskStored ? '搜索结果已进入待处理；缺少明确商家资料，未直接入库。' : ''
      });
    } catch (error) {
      errors.push({ task_id: task.id, message: error.message });
      await updateCollectionTask(task, {
        status: 'failed',
        error_message: cleanText(error.message, 500)
      });
    }
  }

  return {
    ok: true,
    mode: 'manual_collection',
    generated,
    processed_tasks: list.length,
    captured,
    extracted,
    stored_profiles: stored,
    duplicates,
    skipped_profiles: skippedProfiles,
    errors,
    warnings,
    message: `本次搜索 ${list.length} 个任务，抓到 ${captured} 条结果，入库明细 ${stored} 条，待人工确认 ${skippedProfiles} 条，识别日志 ${extracted} 条，重复 ${duplicates} 条${errors.length ? `，错误 ${errors.length} 个：${errors.slice(0, 2).map(item => item.message).join('；')}` : ''}${warnings.length && !errors.length ? `，有 ${warnings.length} 条识别日志待补` : ''}。`
  };
}

const SUPPLY_RADAR_CITIES = [
  'Melbourne',
  'Sydney',
  'Brisbane',
  'Perth',
  'Adelaide',
  'Canberra',
  'Gold Coast',
  'Hobart',
  'Darwin'
];

const SUPPLY_RADAR_KEYWORDS = [
  '接送机',
  '汽车租赁',
  '汽车维修',
  '二手车',
  '亚超',
  '海鲜水产',
  '餐馆',
  '私厨',
  '水管维修',
  '电工',
  '割草园艺',
  '建材',
  '厨具',
  '中文学校',
  '儿童兴趣班',
  '会计税务',
  '移民留学',
  '文件翻译',
  '公证',
  '政府网站协助'
];

function supplyRadarConfig(input = {}) {
  const cooldownMinutes = Math.max(30, Number(input.cooldown_minutes || process.env.SUPPLY_RADAR_MIN_COOLDOWN_MINUTES || 240));
  const chance = Math.min(1, Math.max(0.02, Number(input.run_chance || process.env.SUPPLY_RADAR_RUN_CHANCE || 0.35)));
  const cronEnabled = Boolean(input.cron && process.env.SUPPLY_RADAR_ENABLED !== '0');
  return {
    enabled: input.force || input.manual || cronEnabled || process.env.SUPPLY_RADAR_ENABLED === '1',
    cooldownMinutes,
    chance,
    maxTasks: Math.min(Math.max(Number(input.limit || process.env.SUPPLY_RADAR_MAX_TASKS || randomInt(2, 5)), 1), 8),
    perTask: Math.min(Math.max(Number(input.per_task || process.env.SUPPLY_RADAR_PER_TASK || 2), 1), 4)
  };
}

async function getSupplyRadarState() {
  const row = await getLatest(SUPPLY_RADAR_STATE_PAGE, 'published').catch(() => null);
  return row?.content && typeof row.content === 'object' ? row.content : {};
}

async function saveSupplyRadarState(next = {}) {
  const payload = {
    ...next,
    updated_at: new Date().toISOString()
  };
  return upsertContent(SUPPLY_RADAR_STATE_PAGE, 'published', payload).catch(() => null);
}

async function getSupplyRadarReport() {
  const state = await getSupplyRadarState();
  const config = supplyRadarConfig({});
  return {
    ok: true,
    enabled: Boolean(config.enabled),
    cooldown_minutes: config.cooldownMinutes,
    run_chance: config.chance,
    last_decision_at: state.last_decision_at || '',
    last_run_at: state.last_run_at || '',
    last_skipped_reason: state.last_skipped_reason || '',
    last_city: state.last_city || '',
    last_keyword: state.last_keyword || '',
    last_language: state.last_language || '',
    last_task_source: state.last_task_source || '',
    last_task_count: Number(state.last_task_count || 0),
    last_result: state.last_result || null,
    run_count: Number(state.run_count || 0),
    skip_count: Number(state.skip_count || 0)
  };
}

async function getSystemMonitorState() {
  const row = await getLatest(SYSTEM_MONITOR_STATE_PAGE, 'published').catch(() => null);
  return row?.content && typeof row.content === 'object' ? row.content : {};
}

async function saveSystemMonitorState(next = {}) {
  const previous = await getSystemMonitorState();
  const log = next.log || null;
  const logs = [
    ...(log ? [log] : []),
    ...(Array.isArray(previous.logs) ? previous.logs : [])
  ].slice(0, 120);
  const payload = {
    ...previous,
    ...next,
    logs,
    updated_at: new Date().toISOString()
  };
  return upsertContent(SYSTEM_MONITOR_STATE_PAGE, 'published', payload).catch(() => null);
}

async function probePublicRoute(path = '/', label = '') {
  const started = Date.now();
  const route = path.startsWith('/') ? path : `/${path}`;
  try {
    const response = await fetch(`${PUBLIC_ORIGIN}${route}`, {
      method: 'GET',
      headers: { 'User-Agent': 'huaban-system-monitor/1.0' }
    });
    const latency_ms = Date.now() - started;
    return {
      type: 'route',
      label: label || route,
      target: route,
      ok: response.status >= 200 && response.status < 400,
      status: response.status,
      latency_ms
    };
  } catch (error) {
    return {
      type: 'route',
      label: label || route,
      target: route,
      ok: false,
      status: 'error',
      latency_ms: Date.now() - started,
      error: cleanText(error.message || '访问失败', 260)
    };
  }
}

function monitorCheck(label, ok, detail = '', extra = {}) {
  return {
    label,
    ok: Boolean(ok),
    detail: cleanText(detail || (ok ? '正常' : '异常'), 360),
    ...extra
  };
}

function monitorIssueId(issue = {}) {
  return sha256([
    TENANT_ID,
    issue.type || '',
    issue.target || issue.label || '',
    issue.label || ''
  ].join(':')).slice(0, 16);
}

function classifyMonitorIssue(check = {}) {
  const type = check.type || 'check';
  const needsApproval = ['table', 'flywheel'].includes(type);
  const action = needsApproval
    ? '需要人工核准后修复'
    : '系统自动重试和持续监测';
  return {
    id: monitorIssueId(check),
    label: check.label || check.target || '未知问题',
    type,
    target: check.target || '',
    detail: cleanText(check.detail || check.error || '异常', 360),
    status: needsApproval ? 'needs_approval' : 'auto_repairing',
    action,
    approval_required: needsApproval,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

function mergeMonitorIssues(previousIssues = [], freshIssues = [], nowIso = new Date().toISOString()) {
  const previousMap = new Map((Array.isArray(previousIssues) ? previousIssues : []).map(item => [item.id, item]));
  const freshIds = new Set(freshIssues.map(item => item.id));
  const merged = freshIssues.map(issue => {
    const previous = previousMap.get(issue.id) || {};
    const preservedStatus = ['approved', 'rejected'].includes(previous.status) ? previous.status : issue.status;
    return {
      ...issue,
      ...previous,
      ...issue,
      status: preservedStatus,
      created_at: previous.created_at || issue.created_at || nowIso,
      updated_at: nowIso
    };
  });
  (Array.isArray(previousIssues) ? previousIssues : []).forEach(issue => {
    if (!issue?.id || freshIds.has(issue.id)) return;
    merged.push({
      ...issue,
      status: issue.status === 'rejected' ? 'rejected' : 'fixed',
      resolved_at: issue.resolved_at || nowIso,
      updated_at: nowIso
    });
  });
  return merged.slice(0, 160);
}

async function runSystemMonitor(input = {}) {
  const startedAt = new Date();
  const previousState = await getSystemMonitorState();
  const source = cleanText(input.source || (input.cron ? 'vercel_cron' : input.manual ? 'admin_manual' : 'system'), 80);
  const routes = await Promise.all([
    probePublicRoute('/', '官网首页'),
    probePublicRoute('/ai.html', 'AI 对话'),
    probePublicRoute('/profile.html', '个人中心'),
    probePublicRoute('/recruit.html', '招募页'),
    probePublicRoute('/app-download.html', '下载入口'),
    probePublicRoute('/admin', '后台入口')
  ]);
  const coreTables = [
    'huaban_accounts',
    'huaban_identity_links',
    'huaban_referral_events',
    'huaban_friendships',
    'huaban_point_events',
    'huaban_usage_action_point_reward_rules',
    'huaban_promotion_scenario_rules',
    'huaban_supply_profiles',
    'huaban_temp_conversations'
  ];
  const tableChecks = await Promise.all(coreTables.map(probeTable));
  const flywheel = await getPromotionFlywheelHealthReport().catch(error => ({
    ok: false,
    summary: {},
    chains: [],
    errors: [cleanText(error.message || '飞轮检查失败', 360)]
  }));
  const radar = input.radar_result || await getSupplyRadarReport().catch(error => ({
    ok: false,
    error: cleanText(error.message || '雷达状态读取失败', 360)
  }));
  const operationalAccuracy = await getOperationalAccuracyReport().catch(error => ({
    ok: false,
    summary: {},
    metrics: [],
    errors: [cleanText(error.message || '运营准确率读取失败', 360)]
  }));

  const checks = [
    ...routes.map(item => monitorCheck(item.label, item.ok, item.ok ? `${item.status} / ${item.latency_ms}ms` : `${item.status} ${item.error || ''}`, item)),
    ...tableChecks.map(item => monitorCheck(`数据表：${item.table}`, item.ok, item.ok ? '可读' : item.error, { type: 'table', target: item.table })),
    monitorCheck('推广飞轮链路', Boolean(flywheel.ok), flywheel.ok
      ? `就绪 ${flywheel.summary?.ready || 0}/${flywheel.summary?.chains || 0}`
      : `异常 ${flywheel.summary?.broken || 0} 条：${(flywheel.errors || []).join('；')}`, { type: 'flywheel' }),
    monitorCheck('供给雷达', radar.ok !== false, radar.decision ? `${radar.decision}${radar.reason ? `：${radar.reason}` : ''}` : (radar.error || '状态可读'), { type: 'radar' }),
    monitorCheck('运营准确率', Boolean(operationalAccuracy.ok), operationalAccuracy.ok
      ? `正常 ${operationalAccuracy.summary?.healthy || 0} 项，观察 ${operationalAccuracy.summary?.watch || 0} 项，无样本 ${operationalAccuracy.summary?.no_sample || 0} 项`
      : `异常 ${operationalAccuracy.summary?.needs_repair || 0} 项，高危 ${operationalAccuracy.summary?.critical || 0} 项：${(operationalAccuracy.errors || []).slice(0, 2).join('；')}`, { type: 'accuracy' })
  ];
  const failed = checks.filter(item => !item.ok);
  const nowIso = new Date().toISOString();
  const issue_items = mergeMonitorIssues(
    previousState.issue_items || [],
    failed.map(classifyMonitorIssue),
    nowIso
  );
  const issueSummary = summarizeMonitorIssues(issue_items);
  const status = failed.length ? 'warning' : 'healthy';
  const finishedAt = new Date();
  const log = {
    time: finishedAt.toISOString(),
    source,
    status,
    ok: failed.length === 0,
    failed_count: failed.length,
    check_count: checks.length,
    message: failed.length
      ? `发现 ${failed.length} 项异常：${failed.slice(0, 3).map(item => item.label).join('、')}`
      : `巡检通过：${checks.length} 项正常`
  };
  const state = {
    ok: failed.length === 0,
    status,
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    duration_ms: finishedAt.getTime() - startedAt.getTime(),
    source,
    summary: {
      checks: checks.length,
      passed: checks.length - failed.length,
      failed: failed.length,
      routes: routes.length,
      readable_tables: tableChecks.filter(item => item.ok).length,
      tables: tableChecks.length,
      flywheel_ready: Boolean(flywheel.ok),
      radar_enabled: radar.enabled !== false,
      operational_accuracy_ok: Boolean(operationalAccuracy.ok),
      operational_accuracy_metrics: operationalAccuracy.summary?.metrics || 0,
      issue_items: issue_items.length,
      auto_repairing: issueSummary.auto_repairing,
      needs_approval: issueSummary.needs_approval,
      fixed: issueSummary.fixed
    },
    checks,
    issue_items,
    issue_summary: issueSummary,
    flywheel: {
      ok: Boolean(flywheel.ok),
      summary: flywheel.summary || {},
      broken_chains: (flywheel.chains || []).filter(item => !item.ok).map(item => ({
        scenario_key: item.scenario_key,
        scenario_name: item.scenario_name,
        problem: item.problem
      }))
    },
    radar,
    operational_accuracy: operationalAccuracy,
    log
  };
  await saveSystemMonitorState(state);
  return { ok: true, monitor: true, state };
}

async function updateSystemMonitorIssue(body = {}) {
  const id = cleanText(body.issue_id || body.id, 80);
  const decision = cleanText(body.decision || body.status || '', 40);
  if (!id) throw new Error('缺少巡检问题 ID');
  if (!['approved', 'rejected'].includes(decision)) throw new Error('核准状态无效');
  const state = await getSystemMonitorState();
  const nowIso = new Date().toISOString();
  const currentIssue = (Array.isArray(state.issue_items) ? state.issue_items : []).find(item => item.id === id);
  if (!currentIssue) throw new Error('找不到这条巡检问题');
  const repairResult = decision === 'approved'
    ? await attemptSystemMonitorRepair(currentIssue).catch(error => ({
        ok: false,
        mode: 'repair_error',
        message: cleanText(error.message || '自动修复失败', 360)
      }))
    : null;
  const issueItems = (Array.isArray(state.issue_items) ? state.issue_items : []).map(item => {
    if (item.id !== id) return item;
    const fixed = decision === 'approved' && repairResult?.ok;
    return {
      ...item,
      status: fixed ? 'fixed' : decision,
      action: decision === 'approved'
        ? (fixed ? '已自动修复并复查通过' : `已核准待人工处理：${cleanText(repairResult?.message || '自动修复未完成', 240)}`)
        : '已拒绝自动修复',
      decision_at: nowIso,
      decision_by: 'admin',
      decision_note: cleanText(body.note || '', 260),
      repair_mode: repairResult?.mode || '',
      repair_message: repairResult?.message || '',
      repair_result: repairResult ? {
        ok: Boolean(repairResult.ok),
        mode: repairResult.mode || '',
        message: cleanText(repairResult.message || '', 360),
        repaired: repairResult.repaired || null
      } : null,
      resolved_at: fixed ? nowIso : item.resolved_at,
      updated_at: nowIso
    };
  });
  const issueSummary = summarizeMonitorIssues(issueItems);
  const repaired = decision === 'approved' && repairResult?.ok;
  const log = {
    time: nowIso,
    source: 'admin_decision',
    status: repaired ? 'fixed' : decision,
    ok: repaired || decision === 'rejected',
    failed_count: Number(state.summary?.failed || 0),
    check_count: Number(state.summary?.checks || 0),
    message: decision === 'approved'
      ? `${repaired ? '已修复' : '已核准待人工处理'}：${currentIssue.label || id}${repairResult?.message ? `；${repairResult.message}` : ''}`
      : `已拒绝：${currentIssue.label || id}`
  };
  const next = {
    ...state,
    issue_items: issueItems,
    issue_summary: issueSummary,
    summary: {
      ...(state.summary || {}),
      issue_items: issueItems.length,
      auto_repairing: issueSummary.auto_repairing,
      needs_approval: issueSummary.needs_approval,
      fixed: issueSummary.fixed
    },
    log
  };
  await saveSystemMonitorState(next);
  return { ok: true, state: next, repair_result: repairResult };
}

async function getSystemMonitorReport() {
  const state = await getSystemMonitorState();
  return {
    ok: true,
    has_state: Boolean(state.finished_at),
    state
  };
}

async function pickSupplyRadarTasks(input = {}, config = {}) {
  const keyword = cleanText(input.keyword || input.q || '', 120).toLowerCase();
  const city = normalizeAustraliaCity(input.city || '').toLowerCase();
  const language = cleanText(input.language_lane || input.lang || '', 20).toLowerCase();
  const params = new URLSearchParams({
    tenant_id: `eq.${TENANT_ID}`,
    status: 'in.(queued,failed,skipped)',
    order: 'priority.asc,updated_at.asc,created_at.asc',
    limit: '80',
    select: 'id,task_date,country,state,city,language_lane,category_code,category_name,search_query,source_name,source_url,priority,fields'
  });
  if (city) params.set('city', `ilike.*${city}*`);
  if (language && language !== 'all') params.set('language_lane', `eq.${language}`);
  const rows = await supa(`huaban_supply_collection_tasks?${params.toString()}`).catch(() => []);
  const pool = (Array.isArray(rows) ? rows : []).filter(task => {
    if (!keyword) return true;
    return [
      task.search_query,
      task.category_name,
      task.category_code,
      task.city,
      task.language_lane
    ].join(' ').toLowerCase().includes(keyword);
  });
  return pool
    .map(task => ({ task, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .slice(0, Math.max(1, Number(config.maxTasks || 2)))
    .map(item => ({
      ...item.task,
      source_name: item.task.source_name || 'supply_radar_task_pool',
      fields: {
        ...(item.task.fields || {}),
        radar_task_pool: true
      }
    }));
}

async function runSupplyRadarTick(input = {}) {
  const config = supplyRadarConfig(input);
  const force = Boolean(input.force || input.manual);
  const state = await getSupplyRadarState();
  const now = Date.now();
  const lastRunAt = Date.parse(state.last_run_at || '') || 0;
  const minutesSinceRun = lastRunAt ? (now - lastRunAt) / 60000 : Infinity;
  const decisionAt = new Date(now).toISOString();

  if (!config.enabled && !force) {
    const next = {
      ...state,
      last_decision_at: decisionAt,
      last_skipped_reason: '雷达未启用。设置 SUPPLY_RADAR_ENABLED=1 后，外部随机 tick 才会工作。',
      skip_count: Number(state.skip_count || 0) + 1
    };
    await saveSupplyRadarState(next);
    return { ok: true, radar: true, decision: 'skipped', reason: next.last_skipped_reason };
  }

  if (!force && minutesSinceRun < config.cooldownMinutes) {
    const next = {
      ...state,
      last_decision_at: decisionAt,
      last_skipped_reason: `冷却中：距离上次运行约 ${Math.floor(minutesSinceRun)} 分钟，至少需要 ${config.cooldownMinutes} 分钟。`,
      skip_count: Number(state.skip_count || 0) + 1
    };
    await saveSupplyRadarState(next);
    return { ok: true, radar: true, decision: 'skipped', reason: next.last_skipped_reason };
  }

  const roll = Math.random();
  if (!force && roll > config.chance) {
    const next = {
      ...state,
      last_decision_at: decisionAt,
      last_skipped_reason: `随机未命中：${roll.toFixed(2)} > ${config.chance.toFixed(2)}。`,
      skip_count: Number(state.skip_count || 0) + 1
    };
    await saveSupplyRadarState(next);
    return { ok: true, radar: true, decision: 'skipped', reason: next.last_skipped_reason };
  }

  const radarTasks = await pickSupplyRadarTasks(input, config);
  const firstTask = radarTasks[0] || null;
  const city = normalizeAustraliaCity(input.city || firstTask?.city || randomChoice(SUPPLY_RADAR_CITIES, 'Melbourne'));
  const keyword = cleanText(input.keyword || input.q || firstTask?.category_name || firstTask?.search_query || randomChoice(SUPPLY_RADAR_KEYWORDS, '接送机'), 120);
  const language = cleanText(input.language_lane || input.lang || firstTask?.language_lane || randomChoice(['zh', 'en', 'all'], 'all'), 20);
  const result = await runSupplyCollection({
    tasks: radarTasks,
    skip_task_generation: Boolean(radarTasks.length),
    keyword,
    city,
    language_lane: language,
    limit: config.maxTasks,
    per_task: config.perTask
  });
  const next = {
    ...state,
    last_decision_at: decisionAt,
    last_run_at: decisionAt,
    last_skipped_reason: '',
    last_city: city,
    last_keyword: keyword,
    last_language: language,
    last_task_source: radarTasks.length ? 'collection_task_pool' : 'random_seed',
    last_task_count: radarTasks.length,
    last_result: {
      processed_tasks: result.processed_tasks || 0,
      captured: result.captured || 0,
      stored_profiles: result.stored_profiles || 0,
      skipped_profiles: result.skipped_profiles || 0,
      duplicates: result.duplicates || 0,
      errors: Array.isArray(result.errors) ? result.errors.length : 0
    },
    run_count: Number(state.run_count || 0) + 1
  };
  await saveSupplyRadarState(next);
  return {
    ...result,
    radar: true,
    decision: 'ran',
    city,
    keyword,
    language_lane: language,
    task_source: radarTasks.length ? 'collection_task_pool' : 'random_seed',
    radar_task_count: radarTasks.length,
    random_mode: !force,
    message: `雷达${force ? '试扫' : '自动'}：${radarTasks.length ? `任务池 ${radarTasks.length} 条` : `${city} / ${keyword} / ${language}`}。${result.message || ''}`
  };
}

function supplyTaskProfilePayload(task = {}) {
  const categoryName = cleanText(task.category_name || task.category_code || '本地服务', 120);
  const categoryCode = slugParam(task.category_code || categoryName || 'generic_service', 'generic_service');
  const city = normalizeAustraliaCity(task.city || '');
  const state = cleanText(task.state || '', 40);
  const country = cleanText(task.country || 'Australia', 80);
  const searchQuery = cleanText(task.search_query || '', 260);
  const sourceName = cleanText(task.source_name || '公开信息采集任务', 120);
  const sourceUrl = cleanText(task.source_url || '', 500);
  const languageLane = cleanText(task.language_lane || 'unknown', 20);
  const address = [city, state, country].filter(Boolean).join(', ');
  const displayName = cleanText(`待采集：${city || 'Australia'} ${categoryName}`, 120);
  const now = new Date().toISOString();
  const fields = {
    ...(task.fields || {}),
    industry_major: categoryName,
    industry_minor: categoryName,
    contact_name: '待识别联系人',
    phone: '',
    email: '',
    address,
    collection_task_id: task.id,
    collection_run_id: task.run_id,
    collection_task_date: task.task_date,
    search_query: searchQuery,
    source_name: sourceName,
    source_url: sourceUrl,
    language_lane: languageLane,
    pending_real_supplier_extraction: true,
    materialized_at: now
  };
  const payload = {
    tenant_id: TENANT_ID,
    name: displayName,
    contact: '',
    city,
    country,
    category: categoryName,
    service_type: categoryName,
    service_type_code: categoryCode,
    service_area: address,
    intro: searchQuery ? `公开搜索关键词：${searchQuery}` : '公开信息采集任务，等待识别具体商家资料。',
    qualification: '',
    website: sourceUrl,
    public_verification_url: sourceUrl,
    verification_status: 'pending_collection',
    status: 'candidate',
    completeness_score: 12,
    source_mode: 'public_collection_task',
    source_channel: sourceName,
    supplier_code: makeSupplierCode(`TASK-${task.id || searchQuery}`),
    fields,
    updated_at: now
  };
  const richPayload = {
    ...payload,
    language_lane: languageLane,
    service_languages: languageLane && languageLane !== 'unknown' ? [languageLane] : [],
    market_scope: 'public_supply_collection',
    source_country: country,
    source_state: state,
    source_city: city,
    source_suburb: '',
    normalized_contact: '',
    normalized_address: address,
    collection_task_id: task.id,
    dedupe_key: sha256(`supply-task:${TENANT_ID}:${task.id || searchQuery}`),
    first_seen_at: now,
    last_seen_at: now,
    duplicate_count: 0,
    source_urls: sourceUrl ? [sourceUrl] : []
  };
  return { payload, richPayload };
}

async function materializeSupplyTasks(body = {}) {
  const limit = Math.min(Math.max(Number(body.limit || 800), 1), 1000);
  const keyword = cleanText(body.keyword || body.q || '', 120);
  const cityFilter = normalizeAustraliaCity(body.city || '');
  const languageFilter = cleanText(body.language_lane || body.lang || 'all', 20).toLowerCase();
  const statusFilter = cleanText(body.status || 'all', 40).toLowerCase();
  const params = new URLSearchParams({
    tenant_id: `eq.${TENANT_ID}`,
    order: 'created_at.desc',
    limit: String(limit),
    select: 'id,run_id,task_date,country,state,city,language_lane,category_code,category_name,search_query,source_name,source_url,status,priority,fields,created_at,updated_at'
  });
  if (cityFilter) params.set('city', `ilike.*${cityFilter}*`);
  if (languageFilter && languageFilter !== 'all') params.set('language_lane', `eq.${languageFilter}`);
  if (statusFilter && statusFilter !== 'all') params.set('status', `eq.${statusFilter}`);

  const rows = await supa(`huaban_supply_collection_tasks?${params.toString()}`);
  const all = Array.isArray(rows) ? rows : [];
  const needle = keyword.toLowerCase();
  const tasks = needle ? all.filter(task => supplyTaskText(task).includes(needle)) : all;
  let created = 0;
  let updated = 0;
  const errors = [];

  for (const task of tasks) {
    if (!task.id) continue;
    try {
      const existingRows = await supa(`huaban_supply_profiles?tenant_id=eq.${TENANT_ID}&collection_task_id=eq.${encodeURIComponent(task.id)}&limit=1&select=id`);
      const existing = Array.isArray(existingRows) ? existingRows[0] : null;
      const { payload, richPayload } = supplyTaskProfilePayload(task);
      let saved;
      if (existing?.id) {
        try {
          saved = await supa(`huaban_supply_profiles?id=eq.${encodeURIComponent(existing.id)}&tenant_id=eq.${TENANT_ID}`, {
            method: 'PATCH',
            headers: { Prefer: 'return=representation' },
            body: JSON.stringify(richPayload)
          });
        } catch (error) {
          saved = await supa(`huaban_supply_profiles?id=eq.${encodeURIComponent(existing.id)}&tenant_id=eq.${TENANT_ID}`, {
            method: 'PATCH',
            headers: { Prefer: 'return=representation' },
            body: JSON.stringify(payload)
          });
        }
        if (saved) updated += 1;
      } else {
        try {
          saved = await supa('huaban_supply_profiles', {
            method: 'POST',
            headers: { Prefer: 'return=representation' },
            body: JSON.stringify(richPayload)
          });
        } catch (error) {
          saved = await supa('huaban_supply_profiles', {
            method: 'POST',
            headers: { Prefer: 'return=representation' },
            body: JSON.stringify(payload)
          });
        }
        if (saved) created += 1;
      }
    } catch (error) {
      errors.push({ task_id: task.id, message: cleanText(error.message, 400) });
    }
  }

  return {
    ok: true,
    mode: 'materialize_supply_tasks',
    materialized: tasks.length,
    created,
    updated,
    errors,
    message: `已把 ${tasks.length} 条采集任务写入供给明细底稿：新增 ${created} 条，更新 ${updated} 条${errors.length ? `，失败 ${errors.length} 条` : ''}。`
  };
}

async function updateSupplyProfile(body = {}) {
  const id = cleanText(body.id, 80);
  if (!/^[0-9a-f-]{32,40}$/i.test(id)) throw new Error('供给资料 ID 无效');
  const currentRows = await supa(`huaban_supply_profiles?id=eq.${encodeURIComponent(id)}&tenant_id=eq.${TENANT_ID}&limit=1&select=id,fields`);
  const current = Array.isArray(currentRows) ? currentRows[0] : null;
  if (!current) throw new Error('找不到供给资料');
  const normalizedPhone = normalizePhone(body.phone || body.contact || '');
  const capabilities = extractSupplyCapabilities(body.source_text || body.intro || body.notes || '', body);
  const fields = {
    ...(current.fields || {}),
    industry_major: cleanText(body.industry_major || '', 120),
    industry_minor: canonicalSupplyMinor(body.industry_minor || body.service_type || body.service_type_code || body.industry_major || ''),
    contact_name: cleanText(body.contact_name || '', 120),
    phone: cleanText(body.phone || body.contact || '', 160),
    email: cleanText(body.email || '', 160),
    address: cleanText(body.address || '', 260),
    vehicle_types: capabilities.vehicle_types,
    availability: capabilities.availability,
    service_area: capabilities.service_area || cleanText(body.service_area || body.address || body.city || '', 260),
    pickup_range: capabilities.pickup_range,
    capacity_notes: capabilities.capacity_notes,
    capability_text: capabilities.capability_text,
    business_registration_number: cleanText(body.business_registration_number || body.abn || body.acn || '', 40),
    public_registry_url: safeUrl(body.public_registry_url || ''),
    notes: cleanText(body.notes || body.intro || '', 800),
    normalized_phone: normalizedPhone,
    edited_at: new Date().toISOString()
  };
  const payload = {
    name: cleanText(body.name || body.contact_name || '', 120),
    contact: cleanText(looksLikeUrl(body.contact) ? '' : (body.contact || body.phone || body.email || ''), 180),
    city: cleanText(body.city || '', 80),
    country: cleanText(body.country || 'Australia', 80),
    category: fields.industry_major || '本地服务',
    service_type: fields.industry_minor || fields.industry_major || '本地服务',
    service_type_code: canonicalSupplyCode(body.service_type_code, fields.industry_minor || fields.industry_major || 'generic_service'),
    service_area: fields.service_area,
    intro: cleanText(body.intro || '', 1000),
    website: cleanText(body.website || '', 500),
    public_verification_url: safeUrl(body.public_verification_url || body.public_registry_url || body.website || ''),
    status: cleanText(body.status || 'candidate', 40),
    verification_status: cleanText(body.verification_status || 'pending_review', 60),
    completeness_score: Math.min(100, 20 + (body.name ? 20 : 0) + (normalizedPhone || body.email || body.website ? 25 : 0) + (fields.industry_major || fields.industry_minor ? 20 : 0) + (body.intro ? 15 : 0) + (body.address ? 10 : 0)),
    fields,
    updated_at: new Date().toISOString()
  };
  const richPayload = {
    ...payload,
    normalized_contact: normalizedPhone,
    claimed_phone: normalizedPhone,
    availability: fields.availability,
    language_lane: cleanText(body.language_lane || 'zh', 20),
    source_country: payload.country,
    source_state: cleanText(body.state || body.source_state || '', 40),
    source_city: payload.city,
    source_suburb: cleanText(body.suburb || body.source_suburb || '', 80),
    normalized_address: fields.address
  };
  let rows;
  try {
    rows = await supa(`huaban_supply_profiles?id=eq.${encodeURIComponent(id)}&tenant_id=eq.${TENANT_ID}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(richPayload)
    });
  } catch (error) {
    rows = await supa(`huaban_supply_profiles?id=eq.${encodeURIComponent(id)}&tenant_id=eq.${TENANT_ID}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(payload)
    });
  }
  return Array.isArray(rows) ? normalizeSupplyProfileRow(rows[0]) : normalizeSupplyProfileRow(rows);
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

function inferUserFeedbackType(text = '') {
  const body = cleanText(text, 1200);
  if (/新需求|希望|建议|想要|可以加|增加|新增|设计|以后能不能|能不能加|优化/.test(body)) return 'feature_request';
  if (/AI|回复|回答|理解错|答非所问|乱找|不懂|没听懂|不智能|太机械/.test(body)) return 'ai_reply_issue';
  if (/不能|没反应|报错|失败|打不开|卡住|bug|问题|没有触发|不可用|收不到|延迟|重复/.test(body)) return 'bug';
  return 'other';
}

function feedbackTaskType(type = '') {
  if (type === 'feature_request') return 'design';
  if (type === 'ai_reply_issue') return 'prompt';
  if (type === 'bug') return 'repair';
  return 'triage';
}

function normalizeFeedbackStatus(status = '') {
  const value = cleanText(status, 40) || 'new';
  return ['new', 'triaged', 'designing', 'building', 'repairing', 'fixed', 'rejected', 'duplicate'].includes(value) ? value : 'new';
}

function normalizeFeedbackPriority(priority = '') {
  const value = cleanText(priority, 30) || 'normal';
  return ['low', 'normal', 'high', 'critical'].includes(value) ? value : 'normal';
}

function buildFeedbackSummary(rows = []) {
  const summary = {
    total: rows.length,
    new_count: 0,
    triaged_count: 0,
    active_count: 0,
    fixed_count: 0,
    bug_count: 0,
    ai_reply_issue_count: 0,
    feature_request_count: 0,
    last_feedback_at: rows[0]?.created_at || null
  };
  rows.forEach(row => {
    if (row.status === 'new') summary.new_count += 1;
    if (['triaged', 'designing'].includes(row.status)) summary.triaged_count += 1;
    if (['repairing', 'building'].includes(row.status)) summary.active_count += 1;
    if (row.status === 'fixed') summary.fixed_count += 1;
    if (row.feedback_type === 'bug') summary.bug_count += 1;
    if (row.feedback_type === 'ai_reply_issue') summary.ai_reply_issue_count += 1;
    if (row.feedback_type === 'feature_request') summary.feature_request_count += 1;
  });
  return summary;
}

async function getOpsFeedbackReport() {
  try {
    const rows = await supa(`huaban_user_feedback_items?tenant_id=eq.${encodeURIComponent(TENANT_ID)}&order=created_at.desc&limit=300&select=id,tenant_id,user_code,user_phone,user_name,source,feedback_type,title,description,original_message,ai_reply,page_path,related_route,device_info,category,priority,status,proposed_solution,owner_note,created_at,updated_at`);
    const tasks = await supa(`huaban_feedback_repair_tasks?tenant_id=eq.${encodeURIComponent(TENANT_ID)}&order=created_at.desc&limit=300&select=id,feedback_id,task_type,title,description,status,priority,requires_approval,approval_status,created_at,updated_at`).catch(() => []);
    return {
      ok: true,
      summary: buildFeedbackSummary(Array.isArray(rows) ? rows : []),
      rows: Array.isArray(rows) ? rows : [],
      tasks: Array.isArray(tasks) ? tasks : []
    };
  } catch (error) {
    const message = String(error?.message || '');
    if (message.includes('huaban_user_feedback_items') || message.includes('PGRST205') || message.includes('Could not find')) {
      return {
        ok: true,
        warning: '用户反馈表尚未创建。请先运行 workflows/user_feedback_ops_schema.sql。',
        summary: buildFeedbackSummary([]),
        rows: [],
        tasks: []
      };
    }
    throw error;
  }
}

async function createUserFeedback(input = {}) {
  const original = cleanText(input.original_message || input.description || input.title || '', 2200);
  const aiReply = cleanText(input.ai_reply || '', 2200);
  const feedbackType = cleanText(input.feedback_type, 60) || inferUserFeedbackType(`${original}\n${aiReply}`);
  const title = cleanText(input.title || original, 80) || '用户反馈';
  const payload = {
    tenant_id: TENANT_ID,
    user_code: cleanText(input.user_code, 80) || null,
    user_phone: cleanText(input.user_phone, 60) || null,
    user_name: cleanText(input.user_name, 80) || null,
    source: cleanText(input.source, 60) || 'ai_chat',
    feedback_type: feedbackType,
    title,
    description: cleanText(input.description || original, 2200) || null,
    original_message: original || null,
    ai_reply: aiReply || null,
    page_path: cleanText(input.page_path, 240) || null,
    related_route: cleanText(input.related_route, 160) || null,
    device_info: input.device_info && typeof input.device_info === 'object' ? input.device_info : {},
    category: cleanText(input.category, 80) || null,
    priority: normalizeFeedbackPriority(input.priority),
    status: normalizeFeedbackStatus(input.status)
  };
  const inserted = await supa('huaban_user_feedback_items?select=*', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload)
  });
  const feedback = Array.isArray(inserted) ? inserted[0] : inserted;
  if (feedback?.id) {
    const type = feedbackTaskType(feedback.feedback_type);
    await supa('huaban_feedback_repair_tasks?select=*', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        tenant_id: TENANT_ID,
        feedback_id: feedback.id,
        task_type: type,
        title: `${type === 'design' ? '设计' : type === 'prompt' ? '训练' : type === 'repair' ? '修复' : '归类'}：${feedback.title || title}`,
        description: feedback.description || feedback.original_message || '',
        status: type === 'design' ? 'designing' : 'new',
        priority: feedback.priority || 'normal',
        requires_approval: type === 'design',
        approval_status: type === 'design' ? 'pending' : 'not_required'
      })
    }).catch(error => console.warn('create feedback task failed', error.message));
  }
  return feedback;
}

async function updateOpsFeedback(input = {}) {
  const id = cleanText(input.id, 80);
  if (!id) throw new Error('缺少反馈 ID');
  const payload = {};
  if (input.status !== undefined) payload.status = normalizeFeedbackStatus(input.status);
  if (input.priority !== undefined) payload.priority = normalizeFeedbackPriority(input.priority);
  if (input.owner_note !== undefined) payload.owner_note = cleanText(input.owner_note, 1200);
  if (input.proposed_solution !== undefined) payload.proposed_solution = cleanText(input.proposed_solution, 1600);
  if (!Object.keys(payload).length) throw new Error('没有可更新内容');
  const rows = await supa(`huaban_user_feedback_items?id=eq.${encodeURIComponent(id)}&tenant_id=eq.${encodeURIComponent(TENANT_ID)}&select=*`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload)
  });
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (payload.status) {
    const taskStatus = payload.status === 'fixed' ? 'fixed'
      : payload.status === 'rejected' ? 'rejected'
        : payload.status === 'duplicate' ? 'duplicate'
          : ['repairing', 'building', 'designing', 'triaged'].includes(payload.status) ? payload.status
            : null;
    if (taskStatus) {
      await supa(`huaban_feedback_repair_tasks?feedback_id=eq.${encodeURIComponent(id)}&tenant_id=eq.${encodeURIComponent(TENANT_ID)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status: taskStatus })
      }).catch(error => console.warn('update feedback task failed', error.message));
    }
  }
  return row;
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
    if (report === 'outreach_tasks') return res.status(200).json(await getOutreachReport());
    if (report === 'supply_profiles') return res.status(200).json(await getSupplyProfilesReport(req.query || {}));
    if (report === 'supply_collection_tasks') return res.status(200).json(await getSupplyCollectionTasksReport(req.query || {}));
    if (report === 'supply_processing') return res.status(200).json(await getSupplyProcessingReport(req.query || {}));
    if (report === 'supply_radar') return res.status(200).json(await getSupplyRadarReport());
    if (report === 'plugin_library') return res.status(200).json(getPluginLibraryReport());
    if (report === 'contribution_distribution_rules') return res.status(200).json(await getContributionDistributionRulesReport());
    if (report === 'promotion_flywheel_health') return res.status(200).json(await getPromotionFlywheelHealthReport());
    if (report === 'system_monitor') return res.status(200).json(await getSystemMonitorReport());
    if (report === 'identity_referrals') return res.status(200).json(await getIdentityReferralReport());
    if (report === 'point_ledger') return res.status(200).json(await getPointLedgerReport());
    if (report === 'ops_feedback') return res.status(200).json(await getOpsFeedbackReport());
    const draft = await getLatest(pageKey, 'draft');
    const published = await getLatest(pageKey, 'published');
    return res.status(200).json({ ok: true, draft, published });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const action = String(req.body?.action || '').toLowerCase();
  if (action === 'create_outreach_task') {
    const task = await createOutreachTask(req.body || {});
    return res.status(200).json({ ok: true, task });
  }
  if (action === 'update_outreach_task') {
    const task = await updateOutreachTask(req.body || {});
    return res.status(200).json({ ok: true, task });
  }
  if (action === 'create_supply_lead') {
    const lead = await createSupplyLead(req.body || {});
    return res.status(200).json({ ok: true, lead });
  }
  if (action === 'update_supply_profile') {
    const lead = await updateSupplyProfile(req.body || {});
    return res.status(200).json({ ok: true, lead });
  }
  if (action === 'run_supply_collection') {
    const result = await runSupplyCollection(req.body || {});
    return res.status(200).json(result);
  }
  if (action === 'run_supply_radar_tick') {
    const result = await runSupplyRadarTick({ ...(req.body || {}), manual: true, force: true });
    return res.status(200).json(result);
  }
  if (action === 'run_system_monitor') {
    const result = await runSystemMonitor({ ...(req.body || {}), manual: true, source: 'admin_manual' });
    return res.status(200).json(result);
  }
  if (action === 'system_monitor_decision') {
    const result = await updateSystemMonitorIssue(req.body || {});
    return res.status(200).json(result);
  }
  if (action === 'create_ops_feedback') {
    const feedback = await createUserFeedback({ ...(req.body || {}), source: req.body?.source || 'admin' });
    return res.status(200).json({ ok: true, feedback });
  }
  if (action === 'update_ops_feedback') {
    const feedback = await updateOpsFeedback(req.body || {});
    return res.status(200).json({ ok: true, feedback });
  }
  if (action === 'materialize_supply_tasks') {
    return res.status(400).json({
      ok: false,
      error: '采集任务不能直接写入供给明细。请使用“手动采集一次”从公开搜索结果提取真实供应商。'
    });
  }
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
    const userAgent = String(req.headers['user-agent'] || '');
    const isVercelCron = req.method === 'GET' && /vercel-cron\/1\.0/i.test(userAgent);
    if (isVercelCron) {
      const cronSecret = process.env.CRON_SECRET || '';
      const auth = String(req.headers.authorization || '');
      if (cronSecret && !safeEqual(auth, `Bearer ${cronSecret}`)) return res.status(401).json({ error: 'Cron secret invalid' });
      const radar = await runSupplyRadarTick({ cron: true }).catch(error => ({
        ok: false,
        radar: true,
        decision: 'failed',
        error: cleanText(error.message || '雷达运行失败', 360)
      }));
      const monitor = await runSystemMonitor({ cron: true, source: 'vercel_cron', radar_result: radar }).catch(error => ({
        ok: false,
        monitor: true,
        error: cleanText(error.message || '系统巡检失败', 360)
      }));
      return res.status(200).json({ ok: radar.ok !== false && monitor.ok !== false, radar, monitor });
    }
    if (req.method === 'GET' && req.query?.radar === '1') {
      const secret = process.env.SUPPLY_RADAR_SECRET || '';
      const provided = String(req.query?.secret || req.headers['x-supply-radar-secret'] || '');
      if (!secret || !safeEqual(provided, secret)) return res.status(401).json({ error: '雷达密钥无效' });
      return res.status(200).json(await runSupplyRadarTick(req.query || {}));
    }
    if (req.query?.admin === '1' || req.body?.admin) {
      return handleAdmin(req, res, pageKey);
    }
    if (req.method === 'POST' && String(req.body?.action || '') === 'submit_user_feedback') {
      const feedback = await createUserFeedback({ ...(req.body || {}), source: req.body?.source || 'ai_chat' });
      return res.status(200).json({ ok: true, feedback });
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
