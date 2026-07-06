-- Huaban outreach campaign task queue
-- Purpose: generate compliant promotion tasks from source_registry.

create table if not exists public.outreach_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid default '00000000-0000-0000-0000-000000000001',
  source_id uuid,
  source_name text not null,
  source_url text,
  country text,
  city text,
  audience text not null check (audience in ('user', 'supplier', 'driver', 'professional', 'mixed')),
  channel_level text not null check (channel_level in ('A_auto_authorized', 'B_manual_review', 'C_observe_only')),
  status text not null default 'draft' check (status in ('draft', 'needs_review', 'scheduled', 'published', 'rejected', 'blocked')),
  title text not null,
  copy_short text not null,
  copy_long text,
  landing_url text not null default 'https://www.huabanapp.com/',
  qr_asset text default '/assets/brand/huaban-qr-logo.png',
  compliance_notes text,
  daily_target jsonb not null default '{}'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  fields jsonb not null default '{}'::jsonb,
  scheduled_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists outreach_tasks_status_idx on public.outreach_tasks (status);
create index if not exists outreach_tasks_city_idx on public.outreach_tasks (city);
create index if not exists outreach_tasks_audience_idx on public.outreach_tasks (audience);
create index if not exists outreach_tasks_created_idx on public.outreach_tasks (created_at desc);
create unique index if not exists outreach_tasks_title_source_unique on public.outreach_tasks (title, source_name);

insert into public.outreach_tasks (
  source_name, source_url, country, city, audience, channel_level, status,
  title, copy_short, copy_long, landing_url, compliance_notes, daily_target, metrics, fields
) values
(
  '小红书/留学生群/校园社群人工发布',
  null,
  'Global',
  null,
  'user',
  'B_manual_review',
  'needs_review',
  '年轻海外华人/留学生推广',
  '不想被红点、广告和推荐流拖着走？华伴 AI+，你主动，它才出现。一个安静、有用、听你指挥的 AI 工具。',
  '不想被红点、广告和推荐流拖着走？
本来只想办点事，却一头扎进信息碎片里？

华伴 AI+，一家人都能用的 AI 工具。
你主动，它才出现；你说想做什么，它帮你整理、提醒、找人、推进。

适合留学生、年轻海外华人、独居生活、学习规划和 AI 创意应用。

入口：https://www.huabanapp.com/?ref=student_free
试用感觉好，请推荐给好友；感觉不好，请告诉华伴。',
  'https://www.huabanapp.com/?ref=student_free',
  '小红书、校园群和微信群不能自动群发，只能人工选择合适入口并遵守群规。',
  '{"review_tasks":8,"copy_variants":3,"manual_posts":3,"reply_messages":8,"feedback_records":2}'::jsonb,
  '{"reviewed":0,"copy_done":0,"posted":0,"replied":0,"feedback_recorded":0}'::jsonb,
  '{"segment":"student_free","channels":["xiaohongshu","student_groups","wechat"],"allowed_actions":["draft_copy","manual_post","record_clicks"],"forbidden_actions":["auto_join_group","auto_spam","private_message_blast"]}'::jsonb
),
(
  '华人妈妈群/家长群/朋友圈人工发布',
  null,
  'Global',
  null,
  'user',
  'B_manual_review',
  'needs_review',
  '家庭用户推广',
  '全家用 AI，就用华伴 AI+。爸爸妈妈宝宝都能用，一个有脑、有手、有温度的家庭 AI 工具。',
  '全家用 AI，就用华伴 AI+。

爸爸、妈妈、宝宝，都可以先跟华伴聊一句。
它会慢慢懂你是谁、需要什么：家庭管家、生意伙伴、快乐成长、创意总监，都能自然切换。

没有一排排红点，不催促，不替你决定。需要时出现，不需要时安静待着。

入口：https://www.huabanapp.com/?ref=family_ai
欢迎全家一起试试。',
  'https://www.huabanapp.com/?ref=family_ai',
  '家庭群、家长群和朋友圈只能人工发布，不制造焦虑，不夸大功能。',
  '{"review_tasks":8,"copy_variants":3,"manual_posts":3,"reply_messages":8,"feedback_records":2}'::jsonb,
  '{"reviewed":0,"copy_done":0,"posted":0,"replied":0,"feedback_recorded":0}'::jsonb,
  '{"segment":"family_ai","channels":["wechat_mom_groups","parent_groups","moments"],"allowed_actions":["draft_copy","manual_post","record_clicks"],"forbidden_actions":["fear_marketing","auto_spam","private_message_blast"]}'::jsonb
),
(
  '司机/维修/餐饮/服务者社群人工发布',
  null,
  'Global',
  null,
  'supplier',
  'B_manual_review',
  'needs_review',
  '小生意/手艺人推广',
  '你的手艺，不该只被熟人知道。告诉华伴你会什么，有人需要时，让你被看见。被需要，也可以变成收入。',
  '你的手艺，不该只被熟人知道。

会开车、会修东西、会做饭、会教孩子、会报税、会翻译、会做设计、会跑腿？
这些在海外不是小事，可能正是别人苦苦寻觅的答案。

告诉华伴你会什么、在哪、什么时候方便。有人真正需要时，华伴会帮你被看见。
不刷屏，不乱发广告。被需要，也可以变成收入。

入口：https://www.huabanapp.com/?ref=supplier_income',
  'https://www.huabanapp.com/?ref=supplier_income',
  '不承诺收入；专业服务必须进入资质核验和人工审核。',
  '{"review_tasks":10,"copy_variants":3,"manual_posts":4,"reply_messages":10,"feedback_records":3}'::jsonb,
  '{"reviewed":0,"copy_done":0,"posted":0,"replied":0,"feedback_recorded":0}'::jsonb,
  '{"segment":"supplier_income","channels":["driver_groups","repair_groups","restaurant_groups","service_groups"],"allowed_actions":["draft_copy","manual_post","qualification_review"],"forbidden_actions":["promise_income","claim_official_certification_without_review","auto_spam"]}'::jsonb
)
on conflict (title, source_name) do update set
  source_url=excluded.source_url,
  country=excluded.country,
  city=excluded.city,
  audience=excluded.audience,
  channel_level=excluded.channel_level,
  status=excluded.status,
  copy_short=excluded.copy_short,
  copy_long=excluded.copy_long,
  landing_url=excluded.landing_url,
  qr_asset=excluded.qr_asset,
  compliance_notes=excluded.compliance_notes,
  daily_target=excluded.daily_target,
  metrics=excluded.metrics,
  fields=excluded.fields,
  updated_at=now();
