-- LD_01 daily search task seed/template
-- Purpose: store search results that are useful but not directly fit for the current user demand.
-- These are NOT user-facing leads. They are backend daily tasks for manual registration,
-- login verification, continued public search, source-matrix enrichment, or expiry checks.

-- Example task: masked phone numbers on Meltoday details pages.
insert into public.beta_leads (
  id,
  tenant_id,
  lead_type,
  channel,
  name,
  contact,
  city,
  country,
  status,
  stage,
  need_type,
  message,
  score,
  next_action,
  fields
) values
(
  '20000000-0000-4000-8000-000000000101',
  '00000000-0000-0000-0000-000000000001',
  'supply',
  'ld_01_daily_task',
  '今日墨尔本司机详情页电话打码核验',
  'source:meltoday.com',
  'Melbourne',
  'Australia',
  'todo',
  'daily_search_task',
  'manual_registration_search_task',
  '今日墨尔本接机/代驾详情页中存在多条司机线索，但电话默认打码。该结果不直接导入司机库，进入人工日常任务：人工登录/核验、记录公开来源、确认是否可联系。',
  'B',
  'manual_register_or_login_verify',
  jsonb_build_object(
    'event','ld_01_search_result_routing',
    'routing_result','daily_task',
    'task_reason','details_page_contacts_are_masked_or_login_required',
    'source_platform','今日墨尔本 meltoday.com',
    'global_scan',true,
    'freshness_policy',jsonb_build_object(
      'demand_days',90,
      'supply_days',730,
      'demand_label','需求 90 天内发布',
      'supply_label','供给 2 年内发布'
    ),
    'qualification_policy',jsonb_build_object(
      'required',false,
      'priority_sources',jsonb_build_array('public_source_reputation','business_register_if_available'),
      'human_review_required',true
    ),
    'market_signal',jsonb_build_object(
      'source_city','Melbourne',
      'source_country','Australia',
      'category','司机供给',
      'keyword','接送机 司机',
      'scan_goal','find_matching_demand_and_supply_in_other_countries'
    ),
    'blocked_by',jsonb_build_array('masked_phone','login_required'),
    'original_query','墨尔本 中文司机 接机 代驾',
    'allowed_actions',jsonb_build_array('manual_login_verify','continue_public_search','record_source_url','expire_check'),
    'forbidden_actions',jsonb_build_array('auto_register','bypass_login','guess_masked_phone','recommend_to_user_before_review')
  )
),
(
  '20000000-0000-4000-8000-000000000102',
  '00000000-0000-0000-0000-000000000001',
  'supply',
  'ld_01_daily_task',
  'Facebook 墨尔本工作群司机供给搜索',
  'source:Facebook group search',
  'Melbourne',
  'Australia',
  'todo',
  'daily_search_task',
  'manual_registration_search_task',
  'Facebook群 Melbourne VIC 墨爾本工作資訊 可能有司机/工作供给，但需要官方或授权访问方式。不能自动加群或自动注册，进入人工日常任务。',
  'C',
  'manual_authorized_search_only',
  jsonb_build_object(
    'event','ld_01_search_result_routing',
    'routing_result','daily_task',
    'task_reason','group_access_required',
    'source_platform','Facebook group: Melbourne VIC 墨爾本工作資訊',
    'global_scan',true,
    'freshness_policy',jsonb_build_object(
      'demand_days',90,
      'supply_days',730,
      'demand_label','需求 90 天内发布',
      'supply_label','供给 2 年内发布'
    ),
    'qualification_policy',jsonb_build_object(
      'required',false,
      'priority_sources',jsonb_build_array('public_source_reputation','business_register_if_available'),
      'human_review_required',true
    ),
    'market_signal',jsonb_build_object(
      'source_city','Melbourne',
      'source_country','Australia',
      'category','司机供给',
      'keyword','接送机 司机',
      'scan_goal','find_matching_demand_and_supply_in_other_countries'
    ),
    'blocked_by',jsonb_build_array('group_access_required','login_required'),
    'original_query','Melbourne VIC 墨爾本工作資訊 司机 接机',
    'allowed_actions',jsonb_build_array('authorized_manual_search','record_public_posts_only'),
    'forbidden_actions',jsonb_build_array('auto_join_group','auto_register','scrape_private_group','recommend_to_user_before_review')
  )
)
on conflict (id) do update set
  tenant_id=excluded.tenant_id,
  lead_type=excluded.lead_type,
  channel=excluded.channel,
  name=excluded.name,
  contact=excluded.contact,
  city=excluded.city,
  country=excluded.country,
  status=excluded.status,
  stage=excluded.stage,
  need_type=excluded.need_type,
  message=excluded.message,
  score=excluded.score,
  next_action=excluded.next_action,
  fields=excluded.fields;
