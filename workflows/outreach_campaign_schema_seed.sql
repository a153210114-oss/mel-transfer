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
  title, copy_short, copy_long, landing_url, compliance_notes, fields
) values
(
  '微信朋友圈/微信群人工发布',
  null,
  'Australia',
  'Melbourne',
  'user',
  'B_manual_review',
  'needs_review',
  '墨尔本用户公测招募',
  '快来领你的 AI，有趣又有用。华伴是你的生活帮手、工作助理和休闲陪伴。有事直接说，它会帮你整理需求，找到靠谱的人。',
  '华伴开始墨尔本公测啦。快来领养你的生活管家、工作助理、休闲陪伴的小 AI 吧。它现在先从墨尔本出行和华人互助开始练本领，你可以直接跟它说：我要用车、想找人帮忙、愿意提供服务、想吐槽建议。网址：https://www.huabanapp.com/',
  'https://www.huabanapp.com/?ref=wechat_melbourne_beta',
  '微信群不能自动群发，只能由管理员人工选择合适群并遵守群规。',
  '{"allowed_actions":["draft_copy","manual_post","record_clicks"],"forbidden_actions":["auto_join_group","auto_spam","private_message_blast"]}'::jsonb
),
(
  'Facebook 华人群人工发布',
  'https://www.facebook.com/search/groups',
  'Australia',
  'Melbourne',
  'mixed',
  'B_manual_review',
  'needs_review',
  '墨尔本 Facebook 华人群推广',
  '在墨尔本有事不用到处问。把需求告诉华伴 AI，它会帮你整理、搜索公开线索、核验来源，再匹配可能靠谱的人。',
  '华伴 AI 正在墨尔本公测。它不是只会聊天，而是会帮海外华人整理需求、找公开线索、连接靠谱的人。现在先支持出行用车、本地帮忙、服务者入驻和反馈建议。欢迎体验：https://www.huabanapp.com/',
  'https://www.huabanapp.com/?ref=facebook_melbourne_beta',
  '不自动加群，不自动发帖；只生成给管理员审核的发布草稿。',
  '{"allowed_actions":["draft_copy","manual_post"],"forbidden_actions":["auto_join_group","scrape_private_group","auto_spam"]}'::jsonb
),
(
  '服务者招募人工发布',
  null,
  'Global',
  null,
  'supplier',
  'B_manual_review',
  'needs_review',
  '海外华人服务者招募',
  '如果你在海外为华人提供接送机、包车、翻译、律师、会计、电工、跑腿或本地生活服务，欢迎加入华伴城市服务网络。',
  '华伴正在建立海外华人城市服务网络。如果你能提供接送机、包车、旅游、翻译、律师、会计、电工、维修、跑腿或本地帮办服务，可以申请成为服务者。华伴不抽佣，不赚差价，只帮需要的人遇见可靠的人。申请入口：https://www.huabanapp.com/',
  'https://www.huabanapp.com/?ref=supplier_recruit',
  '涉及律师、会计、电工等专业服务，必须进入资质核验和人工审核。',
  '{"allowed_actions":["draft_copy","manual_post","qualification_review"],"forbidden_actions":["promise_income","claim_official_certification_without_review"]}'::jsonb
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
  fields=excluded.fields,
  updated_at=now();
