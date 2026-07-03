-- 华伴公测线索表
-- 用于集中同步：AI 领养、心愿墙、反馈吐槽、服务者意向

create table if not exists public.beta_leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid default '00000000-0000-0000-0000-000000000001',
  lead_type text not null default 'user',
  channel text,
  name text,
  contact text,
  city text,
  country text,
  need_type text,
  message text,
  next_action text,
  status text not null default 'new',
  stage text default 'public_beta',
  fields jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists beta_leads_tenant_idx on public.beta_leads (tenant_id);
create index if not exists beta_leads_type_idx on public.beta_leads (lead_type);
create index if not exists beta_leads_channel_idx on public.beta_leads (channel);
create index if not exists beta_leads_status_idx on public.beta_leads (status);
create index if not exists beta_leads_city_idx on public.beta_leads (city);
create index if not exists beta_leads_created_idx on public.beta_leads (created_at desc);

alter table public.beta_leads enable row level security;

drop policy if exists "anon_insert_beta_leads" on public.beta_leads;
create policy "anon_insert_beta_leads"
on public.beta_leads
for insert
to anon
with check (true);

drop policy if exists "anon_read_beta_leads" on public.beta_leads;
create policy "anon_read_beta_leads"
on public.beta_leads
for select
to anon
using (true);

drop policy if exists "anon_update_beta_leads" on public.beta_leads;
create policy "anon_update_beta_leads"
on public.beta_leads
for update
to anon
using (true)
with check (true);
