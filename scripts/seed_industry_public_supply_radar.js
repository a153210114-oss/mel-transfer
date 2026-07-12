const fs = require('fs');
const crypto = require('crypto');

const html = ['index.html', 'ai.html', 'api/local-search.js']
  .map((file) => fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '')
  .join('\n');
const taxonomy = JSON.parse(fs.readFileSync('assets/data/industry-taxonomy.json', 'utf8'));

const SUPA_URL = html.match(/(?:const\s+SUPA_URL|const\s+DEFAULT_SUPA_URL)\s*=\s*'([^']+)'/)?.[1];
const SUPA_KEY = html.match(/(?:const\s+SUPA_KEY|const\s+DEFAULT_SUPA_KEY)\s*=\s*'([^']+)'/)?.[1];
const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const BATCH = 'industry_public_search_20260712';

if (!SUPA_URL || !SUPA_KEY) {
  throw new Error('Missing Supabase config in index.html');
}

function stableUuid(seed) {
  const hex = crypto.createHash('md5').update(seed).digest('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    ((parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16) + hex.slice(17, 20),
    hex.slice(20, 32)
  ].join('-');
}

function slug(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 56);
}

const sourceByCategory = {
  property_construction: [
    ['Airtasker AU', 'https://www.airtasker.com/au/'],
    ['hipages', 'https://hipages.com.au/'],
    ['ABN Lookup', 'https://abr.business.gov.au/']
  ],
  life_services: [
    ['Airtasker AU', 'https://www.airtasker.com/au/'],
    ['hipages', 'https://hipages.com.au/'],
    ['ServiceTasker', 'https://servicetasker.com.au/']
  ],
  food_retail: [
    ['China Bar official website', 'https://www.chinabar.com.au/'],
    ['Flower Drum official website', 'https://flowerdrum.melbourne/'],
    ['Google Maps', 'https://www.google.com/maps']
  ],
  professional_services: [
    ['Tax Practitioners Board Public Register', 'https://www.tpb.gov.au/public-register'],
    ['ABN Lookup', 'https://abr.business.gov.au/'],
    ['Victorian Legal Services Board', 'https://lsbc.vic.gov.au/']
  ],
  tech_content: [
    ['Airtasker AU', 'https://www.airtasker.com/au/'],
    ['Google Search', 'https://www.google.com/search'],
    ['ABN Lookup', 'https://abr.business.gov.au/']
  ],
  auto: [
    ['Airtasker AU', 'https://www.airtasker.com/au/'],
    ['Google Maps', 'https://www.google.com/maps'],
    ['ABN Lookup', 'https://abr.business.gov.au/']
  ],
  travel_hospitality: [
    ['Visit Melbourne', 'https://www.visitmelbourne.com/'],
    ['City of Melbourne What\'s On', 'https://whatson.melbourne.vic.gov.au/'],
    ['Tourism Australia', 'https://www.australia.com/en/places/melbourne-and-surrounds/guide-to-melbourne.html']
  ],
  telecom_hr_logistics: [
    ['Airtasker AU', 'https://www.airtasker.com/au/'],
    ['Google Search', 'https://www.google.com/search'],
    ['ABN Lookup', 'https://abr.business.gov.au/']
  ]
};

function searchTemplates(category, industry) {
  const examples = (industry.examples || []).slice(0, 4);
  const keyword = examples[0] || industry.name;
  return [
    `Melbourne Chinese ${keyword}`,
    `墨尔本 华人 ${industry.name}`,
    `Melbourne ${keyword} 华人 电话`,
    `site:google.com/maps Melbourne Chinese ${keyword}`,
    `${category.name} ${industry.name} Melbourne public directory`
  ];
}

const flatIndustries = taxonomy.categories.flatMap((category) =>
  category.industries.map((industry) => ({ category, industry }))
);

const betaLeads = flatIndustries.map(({ category, industry }) => {
  const sources = sourceByCategory[category.code] || [['Google Search', 'https://www.google.com/search']];
  const templates = searchTemplates(category, industry);
  const id = stableUuid(`${BATCH}:lead:${category.code}:${industry.name}`);
  return {
    id,
    tenant_id: TENANT_ID,
    lead_type: 'supply',
    channel: BATCH,
    name: `${category.name} / ${industry.name} 公开供给雷达`,
    contact: `source:${sources[0][1]}`,
    city: 'Melbourne',
    country: 'Australia',
    status: 'new',
    stage: 'industry_public_supply_review',
    need_type: category.code,
    message: [
      `行业：${category.name} / ${industry.name}`,
      `公开搜索入口：${sources.map(([name]) => name).join('、')}`,
      `搜索词：${templates.slice(0, 3).join('；')}`,
      `用途：供给侧发现、人工核验、需求匹配候选。`
    ].join('\n'),
    next_action: 'manual_review_public_sources_then_promote_to_verified_supply',
    fields: {
      event: BATCH,
      industry_taxonomy_version: taxonomy.version,
      category_code: category.code,
      category_name: category.name,
      industry_name: industry.name,
      examples: industry.examples || [],
      category_keywords: category.keywords || [],
      source_candidates: sources.map(([name, url]) => ({ name, url })),
      search_templates: templates,
      source_mode: 'active_public_industry_search',
      public_data_only: true,
      admin_review_required: true,
      verification_status: 'pending_public_review',
      compliance_note: '只记录公开可访问页面、公开目录和官方核验入口；不绕过登录、验证码、私密群、打码联系方式或平台限制。'
    }
  };
});

const supplyProfiles = betaLeads.map((lead) => {
  const fields = lead.fields || {};
  const mainSource = fields.source_candidates?.[0] || {};
  return {
    id: stableUuid(`${BATCH}:profile:${fields.category_code}:${fields.industry_name}`),
    tenant_id: TENANT_ID,
    supplier_code: '',
    source_mode: 'active_public_industry_search',
    source_channel: BATCH,
    name: `${fields.category_name} / ${fields.industry_name} 公开供给入口`,
    contact: `source:${mainSource.url || 'public_web_search'}`,
    city: lead.city,
    country: lead.country,
    service_type: fields.industry_name,
    service_type_code: `${fields.category_code}_${slug(fields.industry_name)}`,
    category: fields.category_name,
    service_area: 'Melbourne',
    price_text: '',
    availability: '',
    intro: `按行业分类建立的公开供给搜索入口，用于发现、核验和匹配 ${fields.industry_name} 相关供给。`,
    qualification: '待人工核验',
    public_verification_url: mainSource.url || '',
    website: mainSource.url || '',
    erp_or_ecommerce_api: '',
    verification_status: 'pending_public_review',
    status: 'source_candidate',
    completeness_score: 40,
    fields: {
      ...fields,
      linked_beta_lead_id: lead.id,
      user_visible: false,
      can_match_future_demand: true,
      seller_subscriber_candidate: false,
      source_type: 'public_industry_radar',
      matching_note: '这是行业级公开供给入口，正式推给用户前需要人工复核具体商家/服务者。'
    }
  };
});

async function post(path, rows, prefer = 'resolution=merge-duplicates,return=representation') {
  const res = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    method: 'POST',
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json',
      Prefer: prefer
    },
    body: JSON.stringify(rows)
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path}: ${res.status} ${text}`);
  return JSON.parse(text || '[]');
}

async function get(path) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`
    }
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path}: ${res.status} ${text}`);
  return JSON.parse(text || '[]');
}

function summarize(rows, key) {
  return rows.reduce((acc, row) => {
    const value = key.split('.').reduce((obj, part) => obj && obj[part], row) || '未分类';
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

async function run() {
  const insertedLeads = await post('beta_leads?on_conflict=id', betaLeads);
  let insertedProfiles = [];
  let supplyProfilesError = '';
  try {
    insertedProfiles = await post('huaban_supply_profiles?on_conflict=id', supplyProfiles);
  } catch (error) {
    supplyProfilesError = error.message;
  }
  let savedProfiles = [];
  let savedProfilesError = '';
  try {
    savedProfiles = await get(`huaban_supply_profiles?source_channel=eq.${BATCH}&select=id,category,service_type,fields`);
  } catch (error) {
    savedProfilesError = error.message;
  }
  const savedLeads = await get(`beta_leads?channel=eq.${BATCH}&select=id,fields`);

  console.log(JSON.stringify({
    batch: BATCH,
    taxonomy_categories: taxonomy.categories.length,
    taxonomy_industries: flatIndustries.length,
    beta_leads_inserted_or_updated: insertedLeads.length,
    supply_profiles_inserted_or_updated: insertedProfiles.length,
    supply_profiles_error: supplyProfilesError,
    beta_leads_saved: savedLeads.length,
    supply_profiles_saved: savedProfiles.length,
    saved_profiles_error: savedProfilesError,
    saved_profiles_by_category: summarize(savedProfiles, 'category'),
    saved_leads_by_category: summarize(savedLeads, 'fields.category_name')
  }, null, 2));
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
