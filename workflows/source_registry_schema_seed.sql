-- Huaban global Chinese source registry
-- Purpose: store public Chinese-language information entry points, search engines,
-- public directories, and government/industry qualification registries.

create table if not exists public.source_registry (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text,
  country text,
  city text,
  language text not null default 'zh',
  source_type text not null check (
    source_type in (
      'chinese_website',
      'forum',
      'social_platform',
      'search_engine',
      'government_registry',
      'industry_directory',
      'business_directory',
      'manual_channel'
    )
  ),
  signal_type text not null default 'both' check (
    signal_type in ('demand', 'supply', 'qualification', 'channel', 'both')
  ),
  access_level text not null default 'public' check (
    access_level in ('public', 'login_required', 'manual_authorized_only', 'blocked')
  ),
  crawl_policy text not null default 'public_metadata_only' check (
    crawl_policy in (
      'public_metadata_only',
      'manual_review_only',
      'search_result_only',
      'official_registry_lookup',
      'do_not_crawl'
    )
  ),
  priority int not null default 3,
  status text not null default 'active' check (
    status in ('active', 'review', 'paused', 'blocked')
  ),
  freshness_policy jsonb not null default '{"demand_days":90,"supply_days":730}'::jsonb,
  qualification_policy jsonb not null default '{}'::jsonb,
  search_templates jsonb not null default '[]'::jsonb,
  compliance_notes text,
  last_checked_at timestamptz,
  fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists source_registry_country_idx on public.source_registry (country);
create index if not exists source_registry_city_idx on public.source_registry (city);
create index if not exists source_registry_type_idx on public.source_registry (source_type);
create index if not exists source_registry_signal_idx on public.source_registry (signal_type);
create index if not exists source_registry_status_idx on public.source_registry (status);
create index if not exists source_registry_priority_idx on public.source_registry (priority);
create unique index if not exists source_registry_name_url_unique on public.source_registry (name, url);

insert into public.source_registry (
  name, url, country, city, source_type, signal_type, access_level, crawl_policy,
  priority, status, qualification_policy, search_templates, compliance_notes, fields
) values
(
  'Google Search',
  'https://www.google.com/search',
  'Global',
  null,
  'search_engine',
  'both',
  'public',
  'search_result_only',
  1,
  'active',
  '{"required":false}'::jsonb,
  '["{city} 华人 {keyword} {freshness}", "{city} Chinese {keyword} {freshness}", "{country} {city} {keyword} 推荐"]'::jsonb,
  '只使用公开搜索结果摘要和可访问页面；不绕过登录、验证码或平台限制。',
  '{"owner":"LD_01","role":"general_search"}'::jsonb
),
(
  'Bing Search',
  'https://www.bing.com/search',
  'Global',
  null,
  'search_engine',
  'both',
  'public',
  'search_result_only',
  2,
  'active',
  '{"required":false}'::jsonb,
  '["{city} 华人 {keyword} 90天内", "{city} Chinese {keyword} 2 years"]'::jsonb,
  '作为 Google 的补充入口，只保存公开来源和搜索词。',
  '{"owner":"LD_01","role":"general_search"}'::jsonb
),
(
  '今日墨尔本',
  'https://www.meltoday.com',
  'Australia',
  'Melbourne',
  'chinese_website',
  'both',
  'public',
  'public_metadata_only',
  1,
  'active',
  '{"required":false}'::jsonb,
  '["墨尔本 华人 {keyword}", "墨尔本 {keyword} 招聘 服务", "今日墨尔本 {keyword}"]'::jsonb,
  '详情页电话可能打码；不能自动注册或绕过登录，打码信息进入人工任务。',
  '{"owner":"LD_01","known_categories":["driver_supply","local_service","jobs"]}'::jsonb
),
(
  '亿忆澳洲',
  'https://www.yeeyi.com',
  'Australia',
  null,
  'chinese_website',
  'both',
  'public',
  'public_metadata_only',
  2,
  'review',
  '{"required":false}'::jsonb,
  '["亿忆 {city} {keyword}", "yeeyi {city} Chinese {keyword}"]'::jsonb,
  '先记录公开板块和公开帖子；登录、私信、隐藏联系方式必须人工处理。',
  '{"owner":"LD_01","known_categories":["jobs","services","classifieds"]}'::jsonb
),
(
  '来澳网',
  'https://www.go2au.net',
  'Australia',
  null,
  'chinese_website',
  'both',
  'public',
  'public_metadata_only',
  2,
  'review',
  '{"required":false}'::jsonb,
  '["来澳网 {city} {keyword}", "go2au {city} {keyword}"]'::jsonb,
  '适合登记为澳洲中文服务与招聘渠道源。',
  '{"owner":"LD_01","known_categories":["jobs","yellow_pages"]}'::jsonb
),
(
  'Facebook 华人群搜索',
  'https://www.facebook.com/search/groups',
  'Global',
  null,
  'social_platform',
  'both',
  'manual_authorized_only',
  'manual_review_only',
  3,
  'review',
  '{"required":false}'::jsonb,
  '["{city} Chinese community {keyword}", "{city} 华人 工作 服务"]'::jsonb,
  '不自动加群、不抓私密群内容；只记录公开群名、公开说明和人工授权可看的公开帖子。',
  '{"owner":"LD_01","requires_human":true}'::jsonb
),
(
  'Google Maps',
  'https://www.google.com/maps',
  'Global',
  null,
  'business_directory',
  'supply',
  'public',
  'public_metadata_only',
  2,
  'active',
  '{"required":false}'::jsonb,
  '["{city} {keyword} Chinese", "{city} 华人 {keyword}"]'::jsonb,
  '可作为商家供给候选入口；评分和评论不是资质证明。',
  '{"owner":"LD_01","role":"business_discovery"}'::jsonb
),
(
  'Australia ABN Lookup',
  'https://abr.business.gov.au',
  'Australia',
  null,
  'government_registry',
  'qualification',
  'public',
  'official_registry_lookup',
  1,
  'active',
  '{"required":true,"priority_sources":["official_business_register"],"regulated_categories":["business_registration"],"human_review_required":true}'::jsonb,
  '["{business_name} ABN", "{business_name} Australia business register"]'::jsonb,
  '澳洲官方 ABN 查询入口，用于营业主体核验；不能替代服务质量判断。',
  '{"owner":"qualification","official":true}'::jsonb
),
(
  'Victoria BLA Licence Search',
  'https://www.consumer.vic.gov.au/licensing-and-registration',
  'Australia',
  'Victoria',
  'government_registry',
  'qualification',
  'public',
  'official_registry_lookup',
  1,
  'active',
  '{"required":true,"priority_sources":["government_public_registry"],"regulated_categories":["real_estate_agent_registry","licensed_trade_registry"],"human_review_required":true}'::jsonb,
  '["Victoria licence search {keyword}", "{business_name} Victoria licence"]'::jsonb,
  '维州政府相关许可查询入口，适合房产中介、部分持牌服务核验。',
  '{"owner":"qualification","official":true}'::jsonb
),
(
  'Victorian Legal Services Board Register',
  'https://lsbc.vic.gov.au',
  'Australia',
  'Victoria',
  'government_registry',
  'qualification',
  'public',
  'official_registry_lookup',
  1,
  'active',
  '{"required":true,"priority_sources":["government_public_registry"],"regulated_categories":["legal_practitioner_registry"],"human_review_required":true}'::jsonb,
  '["Victoria lawyer register {name}", "{name} legal practitioner Victoria"]'::jsonb,
  '维州律师执业信息核验入口；结果需人工复核。',
  '{"owner":"qualification","official":true}'::jsonb
),
(
  'Illinois Attorney Registration and Disciplinary Commission',
  'https://www.iardc.org',
  'United States',
  'Illinois',
  'government_registry',
  'qualification',
  'public',
  'official_registry_lookup',
  1,
  'active',
  '{"required":true,"priority_sources":["government_public_registry"],"regulated_categories":["legal_practitioner_registry"],"human_review_required":true}'::jsonb,
  '["Illinois lawyer lookup {name}", "Chicago attorney registration {name}"]'::jsonb,
  '芝加哥/伊利诺伊律师公开核验入口之一；需人工确认姓名和执业状态。',
  '{"owner":"qualification","official":true,"example_city":"Chicago"}'::jsonb
),
(
  'Illinois Department of Financial and Professional Regulation',
  'https://idfpr.illinois.gov',
  'United States',
  'Illinois',
  'government_registry',
  'qualification',
  'public',
  'official_registry_lookup',
  1,
  'active',
  '{"required":true,"priority_sources":["government_public_registry"],"regulated_categories":["accountant_or_tax_agent_registry","licensed_trade_registry"],"human_review_required":true}'::jsonb,
  '["Illinois CPA license lookup {name}", "Illinois professional license lookup {business_name}"]'::jsonb,
  '伊利诺伊专业执照公开核验入口；适合作为芝加哥会计等专业服务核验来源。',
  '{"owner":"qualification","official":true,"example_city":"Chicago"}'::jsonb
)
on conflict (name, url) do update set
  country=excluded.country,
  city=excluded.city,
  language=excluded.language,
  source_type=excluded.source_type,
  signal_type=excluded.signal_type,
  access_level=excluded.access_level,
  crawl_policy=excluded.crawl_policy,
  priority=excluded.priority,
  status=excluded.status,
  freshness_policy=excluded.freshness_policy,
  qualification_policy=excluded.qualification_policy,
  search_templates=excluded.search_templates,
  compliance_notes=excluded.compliance_notes,
  fields=excluded.fields,
  updated_at=now();
