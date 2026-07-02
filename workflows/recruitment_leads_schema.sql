-- 华伴招募线索表
-- 用于 HB_01_supply_recruit_agent 和 HB_02_user_recruit_agent

create table if not exists public.recruitment_leads (
  id uuid primary key default gen_random_uuid(),
  lead_type text not null check (lead_type in ('supply', 'user')),
  channel text,
  name text,
  contact text,
  city text,
  country text,
  message text,
  score text,
  stage text,
  need_type text,
  next_action text,
  ai_reply text,
  fields jsonb default '{}'::jsonb,
  status text not null default 'new',
  assigned_to text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recruitment_leads_type_idx on public.recruitment_leads (lead_type);
create index if not exists recruitment_leads_status_idx on public.recruitment_leads (status);
create index if not exists recruitment_leads_city_idx on public.recruitment_leads (city);
create index if not exists recruitment_leads_created_idx on public.recruitment_leads (created_at desc);

