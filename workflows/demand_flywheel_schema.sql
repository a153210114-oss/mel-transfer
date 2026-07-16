-- Huaban demand flywheel
-- Purpose:
-- Turn user needs into demand cards, collaboration tasks, and supply leads.
-- If HuaBan cannot satisfy a need yet, the missing supply becomes a trackable
-- collaboration task. Users can invite a supplier or submit a lead; points are
-- pending until backend review confirms the contribution.

create table if not exists public.huaban_demand_cards (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default '00000000-0000-0000-0000-000000000001',
  requester_code text default '',
  requester_phone text default '',
  source_ref text default '',
  source_channel text default '',
  source_campaign text default '',
  source_url text default '',
  need_type text not null default 'local_service',
  service_type text default '',
  service_type_code text default '',
  city text default '',
  country text default '',
  area text default '',
  time_text text default '',
  budget_text text default '',
  urgency text not null default 'normal',
  raw_text text not null default '',
  summary text default '',
  missing_fields text[] not null default '{}'::text[],
  status text not null default 'human_review',
  supply_match_count integer not null default 0,
  fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint huaban_demand_cards_status_check
    check (status in ('draft','human_review','need_info','matching','matched','closed','cancelled'))
);

create table if not exists public.huaban_collaboration_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default '00000000-0000-0000-0000-000000000001',
  demand_id uuid references public.huaban_demand_cards(id) on delete cascade,
  task_type text not null default 'supply_lead_request',
  title text not null default '',
  description text default '',
  city text default '',
  country text default '',
  service_type text default '',
  service_type_code text default '',
  requester_code text default '',
  source_ref text default '',
  suggested_reward_points integer not null default 20,
  invite_url text default '',
  status text not null default 'open',
  fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint huaban_collaboration_tasks_status_check
    check (status in ('open','reviewing','accepted','closed','cancelled'))
);

create table if not exists public.huaban_collaboration_submissions (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default '00000000-0000-0000-0000-000000000001',
  task_id uuid references public.huaban_collaboration_tasks(id) on delete set null,
  demand_id uuid references public.huaban_demand_cards(id) on delete set null,
  submitter_code text default '',
  submitter_phone text default '',
  candidate_name text default '',
  candidate_contact text default '',
  candidate_city text default '',
  candidate_service_type text default '',
  candidate_source_url text default '',
  note text default '',
  pending_points integer not null default 0,
  confirmed_points integer not null default 0,
  status text not null default 'submitted',
  fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint huaban_collaboration_submissions_status_check
    check (status in ('submitted','reviewing','accepted','rejected','duplicate'))
);

create index if not exists huaban_demand_cards_lookup_idx
  on public.huaban_demand_cards (tenant_id, service_type_code, city, status, created_at desc);

create index if not exists huaban_demand_cards_requester_idx
  on public.huaban_demand_cards (tenant_id, requester_code, created_at desc);

create index if not exists huaban_collaboration_tasks_demand_idx
  on public.huaban_collaboration_tasks (tenant_id, demand_id, status, created_at desc);

create index if not exists huaban_collaboration_submissions_task_idx
  on public.huaban_collaboration_submissions (tenant_id, task_id, status, created_at desc);

create or replace function public.set_huaban_demand_flywheel_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_huaban_demand_cards_updated_at on public.huaban_demand_cards;
create trigger trg_huaban_demand_cards_updated_at
before update on public.huaban_demand_cards
for each row execute function public.set_huaban_demand_flywheel_updated_at();

drop trigger if exists trg_huaban_collaboration_tasks_updated_at on public.huaban_collaboration_tasks;
create trigger trg_huaban_collaboration_tasks_updated_at
before update on public.huaban_collaboration_tasks
for each row execute function public.set_huaban_demand_flywheel_updated_at();

drop trigger if exists trg_huaban_collaboration_submissions_updated_at on public.huaban_collaboration_submissions;
create trigger trg_huaban_collaboration_submissions_updated_at
before update on public.huaban_collaboration_submissions
for each row execute function public.set_huaban_demand_flywheel_updated_at();

alter table public.huaban_demand_cards enable row level security;
alter table public.huaban_collaboration_tasks enable row level security;
alter table public.huaban_collaboration_submissions enable row level security;

drop policy if exists "service role manages demand cards" on public.huaban_demand_cards;
create policy "service role manages demand cards"
  on public.huaban_demand_cards
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "service role manages collaboration tasks" on public.huaban_collaboration_tasks;
create policy "service role manages collaboration tasks"
  on public.huaban_collaboration_tasks
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "service role manages collaboration submissions" on public.huaban_collaboration_submissions;
create policy "service role manages collaboration submissions"
  on public.huaban_collaboration_submissions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

comment on table public.huaban_demand_cards is
'Demand cards generated from HuaBan chat. The first-stage loop is need capture, human review, matching, and collaboration when supply is missing.';

comment on table public.huaban_collaboration_tasks is
'Open collaboration tasks created when HuaBan cannot satisfy a demand from the current supply pool. Users may invite suppliers or submit leads.';

comment on table public.huaban_collaboration_submissions is
'User-submitted supply leads for collaboration tasks. Points remain pending until backend review confirms usefulness and uniqueness.';
