-- Huaban operations team management
-- Purpose: recruit operation team members, assign tasks, run online meetings, and track completion.

create table if not exists public.ops_team_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid default '00000000-0000-0000-0000-000000000001',
  name text not null,
  role text not null check (role in ('outreach_support','city_operator','supplier_reviewer','content_operator','admin')),
  city text,
  country text,
  contact text,
  status text not null default 'candidate' check (status in ('candidate','trial','active','paused','rejected')),
  weekly_hours int default 0,
  skills jsonb not null default '[]'::jsonb,
  notes text,
  fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ops_roles (
  id uuid primary key default gen_random_uuid(),
  role text not null unique,
  title text not null,
  description text,
  daily_target jsonb not null default '{}'::jsonb,
  score_weights jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ops_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid default '00000000-0000-0000-0000-000000000001',
  title text not null,
  task_type text not null check (task_type in ('outreach','reply','source_update','supplier_review','content','training','meeting_followup')),
  city text,
  assignee_id uuid,
  assignee_name text,
  priority int not null default 3,
  status text not null default 'open' check (status in ('open','assigned','in_progress','submitted','reviewed','rework','done')),
  target jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  completion_rate numeric default 0,
  due_at timestamptz,
  source_ref text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ops_meetings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid default '00000000-0000-0000-0000-000000000001',
  title text not null,
  meeting_type text not null check (meeting_type in ('daily_standup','daily_review','weekly_city','interview','training')),
  city text,
  platform text not null default 'Tencent Meeting',
  meeting_url text,
  status text not null default 'scheduled' check (status in ('scheduled','done','cancelled')),
  agenda jsonb not null default '[]'::jsonb,
  attendees jsonb not null default '[]'::jsonb,
  minutes text,
  decisions jsonb not null default '[]'::jsonb,
  action_items jsonb not null default '[]'::jsonb,
  scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ops_team_members_role_idx on public.ops_team_members (role);
create index if not exists ops_team_members_status_idx on public.ops_team_members (status);
create index if not exists ops_tasks_status_idx on public.ops_tasks (status);
create index if not exists ops_tasks_type_idx on public.ops_tasks (task_type);
create index if not exists ops_meetings_type_idx on public.ops_meetings (meeting_type);
create index if not exists ops_meetings_scheduled_idx on public.ops_meetings (scheduled_at);

insert into public.ops_roles (role, title, description, daily_target, score_weights) values
(
  'outreach_support',
  '人工客服推广',
  '领取推广任务、微调文案、人工发布、回复咨询、记录反馈。',
  '{"review_tasks":10,"copy_done":5,"manual_posts":3,"reply_messages":10,"feedback_records":3,"source_updates":1}'::jsonb,
  '{"task_review":0.15,"publish":0.25,"reply":0.20,"feedback":0.15,"meeting_report":0.15,"compliance":0.10}'::jsonb
),
(
  'city_operator',
  '城市运营',
  '管理城市入口库、服务者线索、推广节奏和城市复盘。',
  '{"source_updates":2,"lead_reviews":10,"city_notes":1,"partner_contacts":3}'::jsonb,
  '{"source_update":0.25,"lead_review":0.25,"city_review":0.20,"partner":0.20,"compliance":0.10}'::jsonb
),
(
  'supplier_reviewer',
  '服务者审核',
  '审核服务者申请、资质链接、公开核验和人工复核状态。',
  '{"supplier_reviews":10,"qualification_checks":8,"rework_notes":2}'::jsonb,
  '{"supplier_review":0.35,"qualification":0.35,"notes":0.15,"compliance":0.15}'::jsonb
),
(
  'content_operator',
  '内容运营',
  '把真实需求转成小红书、公众号、视频号、朋友圈文案。',
  '{"short_copy":5,"long_content":1,"script_notes":1,"feedback_records":2}'::jsonb,
  '{"copy":0.35,"content":0.25,"script":0.20,"feedback":0.10,"compliance":0.10}'::jsonb
)
on conflict (role) do update set
  title=excluded.title,
  description=excluded.description,
  daily_target=excluded.daily_target,
  score_weights=excluded.score_weights,
  updated_at=now();

insert into public.ops_tasks (title, task_type, city, priority, status, target, source_ref, notes) values
(
  '墨尔本公测用户推广日常',
  'outreach',
  'Melbourne',
  1,
  'open',
  '{"review_tasks":10,"copy_done":5,"manual_posts":3,"reply_messages":10,"feedback_records":3}'::jsonb,
  'LD_04_human_outreach_daily_sop',
  '人工客服每天领取，完成后提交发布截图、咨询数量和反馈记录。'
),
(
  '墨尔本服务者招募日常',
  'supplier_review',
  'Melbourne',
  2,
  'open',
  '{"supplier_reviews":10,"qualification_checks":8}'::jsonb,
  'AI_RECRUIT_SUPPLY_AGENT',
  '服务者申请需资质核验，律师/会计/电工等进入政府公开核验路径。'
),
(
  '每日运营晨会',
  'meeting_followup',
  'Melbourne',
  1,
  'open',
  '{"duration_minutes":15,"required_minutes":true,"action_items":3}'::jsonb,
  'OPS_01',
  '参考钉钉/腾讯会议：会前看数据，会后留纪要和责任人。'
)
on conflict do nothing;

insert into public.ops_meetings (title, meeting_type, city, platform, meeting_url, agenda, attendees, scheduled_at) values
(
  '墨尔本运营每日晨会',
  'daily_standup',
  'Melbourne',
  'Tencent Meeting',
  '',
  '["昨日完成率","今日推广入口","今日服务者审核","风险和阻塞"]'::jsonb,
  '[]'::jsonb,
  now() + interval '1 day'
),
(
  '墨尔本运营每日复盘',
  'daily_review',
  'Melbourne',
  'Tencent Meeting',
  '',
  '["已发布入口","新增咨询","有效话术","产品反馈","明日计划"]'::jsonb,
  '[]'::jsonb,
  now() + interval '1 day' + interval '8 hours'
)
on conflict do nothing;
