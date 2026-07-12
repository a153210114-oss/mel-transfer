const fs = require('fs');

const html = ['index.html', 'ai.html', 'api/local-search.js']
  .map((file) => fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '')
  .join('\n');
const SUPA_URL = html.match(/(?:const\s+SUPA_URL|const\s+DEFAULT_SUPA_URL)\s*=\s*'([^']+)'/)?.[1];
const SUPA_KEY = html.match(/(?:const\s+SUPA_KEY|const\s+DEFAULT_SUPA_KEY)\s*=\s*'([^']+)'/)?.[1];

if (!SUPA_URL || !SUPA_KEY) {
  throw new Error('Missing Supabase config in index.html');
}

const tenantId = '00000000-0000-0000-0000-000000000001';

const registrySources = [
  {
    name: 'Airtasker Australia',
    url: 'https://www.airtasker.com/au/',
    country: 'Australia',
    city: null,
    language: 'en',
    source_type: 'business_directory',
    signal_type: 'both',
    access_level: 'public',
    crawl_policy: 'public_metadata_only',
    priority: 2,
    status: 'active',
    search_templates: ['Airtasker {city} {keyword}', 'site:airtasker.com/au {city} {keyword}'],
    compliance_notes: '只使用公开任务、公开分类和公开商家页；不自动注册、不自动报价、不私信。',
    fields: {
      owner: 'LD_01',
      known_categories: ['removals', 'cleaning', 'delivery', 'gardening', 'handyman', 'accounting']
    }
  },
  {
    name: 'hipages Australia',
    url: 'https://hipages.com.au/',
    country: 'Australia',
    city: null,
    language: 'en',
    source_type: 'business_directory',
    signal_type: 'supply',
    access_level: 'public',
    crawl_policy: 'public_metadata_only',
    priority: 2,
    status: 'active',
    search_templates: ['hipages {city} {keyword}', 'site:hipages.com.au {city} {keyword}'],
    compliance_notes: '适合查找电工、水管、清洁、园丁等 tradie；资质和保险需人工复核。',
    fields: {
      owner: 'LD_01',
      known_categories: ['plumber', 'electrician', 'cleaner', 'gardener', 'handyman']
    }
  },
  {
    name: 'ServiceTasker Australia',
    url: 'https://servicetasker.com.au/',
    country: 'Australia',
    city: null,
    language: 'en',
    source_type: 'business_directory',
    signal_type: 'both',
    access_level: 'public',
    crawl_policy: 'public_metadata_only',
    priority: 2,
    status: 'review',
    search_templates: ['ServiceTasker {city} {keyword}', 'site:servicetasker.com.au {city} {keyword}'],
    compliance_notes: '用于查找本地服务商和报价入口；不自动下单，先进入华伴确认卡。',
    fields: {
      owner: 'LD_01',
      known_categories: ['plumber', 'removalist', 'electrician', 'cleaning', 'gardener']
    }
  },
  {
    name: 'Tax Practitioners Board Public Register',
    url: 'https://www.tpb.gov.au/public-register',
    country: 'Australia',
    city: null,
    language: 'en',
    source_type: 'government_registry',
    signal_type: 'qualification',
    access_level: 'public',
    crawl_policy: 'official_registry_lookup',
    priority: 1,
    status: 'active',
    search_templates: ['{name} tax agent TPB', '{business_name} tax practitioner register'],
    compliance_notes: '澳洲税务代理/税务从业者公开核验入口；匹配姓名和注册状态需人工复核。',
    fields: {
      owner: 'qualification',
      official: true,
      regulated_categories: ['tax_agent', 'bas_agent']
    }
  },
  {
    name: 'CPA Australia Find a CPA',
    url: 'https://www.cpaaustralia.com.au/',
    country: 'Australia',
    city: null,
    language: 'en',
    source_type: 'industry_directory',
    signal_type: 'qualification',
    access_level: 'public',
    crawl_policy: 'official_registry_lookup',
    priority: 2,
    status: 'review',
    search_templates: ['CPA Australia find a CPA {city}', '{name} CPA Australia'],
    compliance_notes: '会计师行业资质参考入口；不能替代税务代理注册核验。',
    fields: {
      owner: 'qualification',
      regulated_categories: ['accountant']
    }
  },
  {
    name: 'Victorian Legal Services Board Register',
    url: 'https://lsbc.vic.gov.au/',
    country: 'Australia',
    city: 'Victoria',
    language: 'en',
    source_type: 'government_registry',
    signal_type: 'qualification',
    access_level: 'public',
    crawl_policy: 'official_registry_lookup',
    priority: 1,
    status: 'active',
    search_templates: ['{name} legal practitioner Victoria', '{business_name} lawyer register Victoria'],
    compliance_notes: '维州律师公开核验入口；法律建议必须由持牌专业人士提供。',
    fields: {
      owner: 'qualification',
      official: true,
      regulated_categories: ['legal_practitioner']
    }
  },
  {
    name: 'ABN Lookup',
    url: 'https://abr.business.gov.au/',
    country: 'Australia',
    city: null,
    language: 'en',
    source_type: 'government_registry',
    signal_type: 'qualification',
    access_level: 'public',
    crawl_policy: 'official_registry_lookup',
    priority: 1,
    status: 'active',
    search_templates: ['{business_name} ABN', '{business_name} Australian Business Register'],
    compliance_notes: '澳洲营业主体核验入口；只证明主体登记，不证明服务质量。',
    fields: {
      owner: 'qualification',
      official: true,
      regulated_categories: ['business_registration']
    }
  }
];

const leads = [
  {
    id: '10000000-0000-4000-8000-000000000401',
    lead_type: 'supply',
    channel: 'local_service_platform_intel',
    name: 'Airtasker 本地生活服务渠道',
    contact: 'source:https://www.airtasker.com/au/',
    city: 'Melbourne',
    country: 'Australia',
    status: 'new',
    stage: 'public_supply_review',
    need_type: 'local_service_platform_source',
    message: '本地生活服务供给渠道：Airtasker 可覆盖搬家、清洁、配送、园艺、维修、会计税务等任务。适合华伴在用户确认后辅助比价和形成任务卡。',
    next_action: 'use_as_public_search_and_quote_channel',
    fields: {
      event: 'service_supply_seed_20260705',
      priority_score: 'A',
      source_platform: 'Airtasker Australia',
      source_url: 'https://www.airtasker.com/au/',
      service_types: ['搬家', '清洁', '配送', '园艺', '维修', '会计税务'],
      verification_status: 'public_platform_source',
      compliance_note: '不自动注册、不自动报价、不私信；用户确认后可作为公开比价和任务发布参考。'
    }
  },
  {
    id: '10000000-0000-4000-8000-000000000402',
    lead_type: 'supply',
    channel: 'local_service_platform_intel',
    name: 'hipages Tradie 服务渠道',
    contact: 'source:https://hipages.com.au/',
    city: 'Melbourne',
    country: 'Australia',
    status: 'new',
    stage: 'public_supply_review',
    need_type: 'tradie_service_platform_source',
    message: '本地 tradie 供给渠道：hipages 适合查找电工、水管、清洁、园丁、维修等服务商。',
    next_action: 'use_as_public_tradie_search_channel',
    fields: {
      event: 'service_supply_seed_20260705',
      priority_score: 'A',
      source_platform: 'hipages Australia',
      source_url: 'https://hipages.com.au/',
      service_types: ['电工', '水管', '清洁', '园丁', '维修'],
      verification_status: 'public_platform_source',
      compliance_note: '涉及持牌工种必须二次核验执照、保险和 ABN。'
    }
  },
  {
    id: '10000000-0000-4000-8000-000000000403',
    lead_type: 'supply',
    channel: 'local_service_platform_intel',
    name: 'ServiceTasker 本地服务渠道',
    contact: 'source:https://servicetasker.com.au/',
    city: 'Melbourne',
    country: 'Australia',
    status: 'new',
    stage: 'public_supply_review',
    need_type: 'local_service_platform_source',
    message: '本地服务供给渠道：ServiceTasker 公开分类包含水管、搬家、电工、清洁、园丁等，适合作为生活服务补充入口。',
    next_action: 'use_as_public_search_and_quote_channel',
    fields: {
      event: 'service_supply_seed_20260705',
      priority_score: 'B',
      source_platform: 'ServiceTasker Australia',
      source_url: 'https://servicetasker.com.au/',
      service_types: ['水管', '搬家', '电工', '清洁', '园丁'],
      verification_status: 'public_platform_source',
      compliance_note: '作为渠道源；具体服务者仍需人工审核和资质核验。'
    }
  },
  {
    id: '10000000-0000-4000-8000-000000000404',
    lead_type: 'supply',
    channel: 'qualification_source_intel',
    name: 'Tax Practitioners Board 税务代理核验',
    contact: 'source:https://www.tpb.gov.au/public-register',
    city: 'Melbourne',
    country: 'Australia',
    status: 'new',
    stage: 'qualification_source',
    need_type: 'qualification_tax_agent_register',
    message: '会计/税务专业服务核验入口：Tax Practitioners Board Public Register，用于核验税务代理或 BAS 代理公开注册状态。',
    next_action: 'use_for_accountant_tax_agent_qualification_check',
    fields: {
      event: 'service_supply_seed_20260705',
      priority_score: 'A',
      source_platform: 'Tax Practitioners Board',
      source_url: 'https://www.tpb.gov.au/public-register',
      service_types: ['税务代理核验', 'BAS代理核验', '会计资质参考'],
      verification_status: 'official_registry_source',
      compliance_note: '只作为官方核验入口；专业建议必须由合规专业人士提供。'
    }
  },
  {
    id: '10000000-0000-4000-8000-000000000405',
    lead_type: 'supply',
    channel: 'qualification_source_intel',
    name: 'Victorian Legal Services Board 律师核验',
    contact: 'source:https://lsbc.vic.gov.au/',
    city: 'Melbourne',
    country: 'Australia',
    status: 'new',
    stage: 'qualification_source',
    need_type: 'qualification_lawyer_register',
    message: '律师专业服务核验入口：Victorian Legal Services Board Register，用于核验维州律师执业信息。',
    next_action: 'use_for_lawyer_qualification_check',
    fields: {
      event: 'service_supply_seed_20260705',
      priority_score: 'A',
      source_platform: 'Victorian Legal Services Board',
      source_url: 'https://lsbc.vic.gov.au/',
      service_types: ['律师核验', '法律服务资质'],
      verification_status: 'official_registry_source',
      compliance_note: '只作为官方核验入口；法律建议必须由持牌专业人士提供。'
    }
  },
  {
    id: '10000000-0000-4000-8000-000000000406',
    lead_type: 'supply',
    channel: 'qualification_source_intel',
    name: 'ABN Lookup 商家主体核验',
    contact: 'source:https://abr.business.gov.au/',
    city: 'Melbourne',
    country: 'Australia',
    status: 'new',
    stage: 'qualification_source',
    need_type: 'qualification_business_register',
    message: '商家/服务者主体核验入口：ABN Lookup，用于核验澳洲营业主体公开登记。',
    next_action: 'use_for_supplier_business_identity_check',
    fields: {
      event: 'service_supply_seed_20260705',
      priority_score: 'A',
      source_platform: 'ABN Lookup',
      source_url: 'https://abr.business.gov.au/',
      service_types: ['商家核验', 'ABN核验', '主体登记核验'],
      verification_status: 'official_registry_source',
      compliance_note: '只证明主体登记，不代表服务质量或合作状态。'
    }
  }
];

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
  if (!res.ok) {
    throw new Error(`${res.status} ${text}`);
  }
  return JSON.parse(text || '[]');
}

async function run() {
  let registryRows = [];
  try {
    registryRows = await post(
      'source_registry?on_conflict=name,url',
      registrySources
    );
  } catch (error) {
    if (String(error.message).includes('42501')) {
      registryRows = [];
    } else if (!String(error.message).includes('42P10')) {
      throw error;
    } else {
      registryRows = await post('source_registry', registrySources, 'return=representation');
    }
  }

  const leadRows = await post(
    'beta_leads?on_conflict=id',
    leads.map((lead) => ({ ...lead, tenant_id: tenantId }))
  );

  console.log(JSON.stringify({
    registry_inserted_or_updated: registryRows.length,
    lead_inserted_or_updated: leadRows.length,
    registry_names: registryRows.map((row) => row.name),
    lead_names: leadRows.map((row) => row.name)
  }, null, 2));
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
