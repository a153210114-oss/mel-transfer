-- Huaban public site analytics schema
-- Run in Supabase SQL Editor. Safe to re-run.
-- Purpose:
-- 1. Store public homepage/recruitment page views and lightweight click events.
-- 2. Let admin dashboard read website traffic, source parameters and signup funnel.
-- 3. Keep raw visitor data private behind service-role APIs.

create table if not exists public.huaban_site_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default '00000000-0000-0000-0000-000000000001',
  event_name text not null default 'page_view',
  page_key text not null default '',
  page_path text not null default '',
  page_url text not null default '',
  ref_code text not null default '',
  channel text not null default '',
  campaign text not null default '',
  visitor_id text not null default '',
  session_id text not null default '',
  device_type text not null default '',
  browser text not null default '',
  user_agent text not null default '',
  ip_hash text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists huaban_site_events_tenant_created_idx
  on public.huaban_site_events (tenant_id, created_at desc);

create index if not exists huaban_site_events_page_idx
  on public.huaban_site_events (tenant_id, page_key, created_at desc);

create index if not exists huaban_site_events_source_idx
  on public.huaban_site_events (tenant_id, ref_code, channel, campaign);

create index if not exists huaban_site_events_visitor_idx
  on public.huaban_site_events (tenant_id, visitor_id, created_at desc);

alter table public.huaban_site_events enable row level security;

drop policy if exists "service role manages site events" on public.huaban_site_events;
create policy "service role manages site events"
  on public.huaban_site_events
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

comment on table public.huaban_site_events is
  '华伴官网浏览与行为日志：公开页面只通过服务端写入，后台通过服务端读取统计。';
