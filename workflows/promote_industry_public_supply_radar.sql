-- Promote industry public-search radar leads into the formal Huaban supply pool.
-- Run this in Supabase SQL Editor after workflows/supply_profiles_schema.sql.
--
-- Source:
--   beta_leads.channel = 'industry_public_search_20260712'
-- Target:
--   huaban_supply_profiles
--
-- This keeps public-search data server-side and does not require opening anon
-- insert permissions on the formal supply pool.

create unique index if not exists huaban_supply_profiles_source_service_unique_idx
  on public.huaban_supply_profiles (
    tenant_id,
    source_channel,
    service_type_code,
    name
  );

insert into public.huaban_supply_profiles (
  tenant_id,
  source_mode,
  source_channel,
  name,
  contact,
  city,
  country,
  service_type,
  service_type_code,
  category,
  service_area,
  intro,
  qualification,
  public_verification_url,
  website,
  verification_status,
  status,
  completeness_score,
  fields
)
select
  coalesce(lead.tenant_id, '00000000-0000-0000-0000-000000000001') as tenant_id,
  'active_public_industry_search' as source_mode,
  lead.channel as source_channel,
  concat(lead.fields->>'category_name', ' / ', lead.fields->>'industry_name', ' 公开供给入口') as name,
  coalesce(lead.contact, '') as contact,
  coalesce(lead.city, 'Melbourne') as city,
  coalesce(lead.country, 'Australia') as country,
  coalesce(lead.fields->>'industry_name', lead.need_type, '供给') as service_type,
  concat(
    coalesce(lead.fields->>'category_code', lead.need_type, 'supply'),
    '_',
    substr(md5(coalesce(lead.fields->>'industry_name', lead.name, lead.id::text)), 1, 12)
  ) as service_type_code,
  coalesce(lead.fields->>'category_name', lead.need_type, '供给') as category,
  coalesce(lead.city, 'Melbourne') as service_area,
  concat(
    '按行业分类建立的公开供给搜索入口，用于发现、核验和匹配 ',
    coalesce(lead.fields->>'industry_name', lead.name),
    ' 相关供给。'
  ) as intro,
  '待人工核验' as qualification,
  coalesce(lead.fields #>> '{source_candidates,0,url}', '') as public_verification_url,
  coalesce(lead.fields #>> '{source_candidates,0,url}', '') as website,
  'pending_public_review' as verification_status,
  'source_candidate' as status,
  40 as completeness_score,
  jsonb_strip_nulls(
    coalesce(lead.fields, '{}'::jsonb)
    || jsonb_build_object(
      'linked_beta_lead_id', lead.id,
      'user_visible', false,
      'can_match_future_demand', true,
      'seller_subscriber_candidate', false,
      'source_type', 'public_industry_radar',
      'matching_note', '这是行业级公开供给入口，正式推给用户前需要人工复核具体商家/服务者。'
    )
  ) as fields
from public.beta_leads lead
where lead.channel = 'industry_public_search_20260712'
  and lead.lead_type = 'supply'
on conflict (tenant_id, source_channel, service_type_code, name)
do update set
  contact = excluded.contact,
  city = excluded.city,
  country = excluded.country,
  service_type = excluded.service_type,
  category = excluded.category,
  service_area = excluded.service_area,
  intro = excluded.intro,
  public_verification_url = excluded.public_verification_url,
  website = excluded.website,
  verification_status = excluded.verification_status,
  status = excluded.status,
  completeness_score = greatest(public.huaban_supply_profiles.completeness_score, excluded.completeness_score),
  fields = public.huaban_supply_profiles.fields || excluded.fields,
  updated_at = now();

select
  source_channel,
  category,
  count(*) as rows
from public.huaban_supply_profiles
where source_channel = 'industry_public_search_20260712'
group by source_channel, category
order by category;
