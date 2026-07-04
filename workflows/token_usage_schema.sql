-- Token usage monitoring for Huaban AI
-- Run once in Supabase SQL editor.

create table if not exists public.token_usage (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default '00000000-0000-0000-0000-000000000001',
  created_at timestamptz not null default now(),
  provider text not null default '',
  model text not null default '',
  endpoint text not null default '',
  feature text not null default '',
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  total_tokens integer not null default 0,
  text_chars integer not null default 0,
  request_id text not null default '',
  visitor_id text not null default '',
  session_id text not null default '',
  city text not null default '',
  country text not null default '',
  fields jsonb not null default '{}'::jsonb
);

create index if not exists token_usage_created_at_idx on public.token_usage (created_at desc);
create index if not exists token_usage_feature_idx on public.token_usage (feature);
create index if not exists token_usage_provider_idx on public.token_usage (provider);
create index if not exists token_usage_visitor_idx on public.token_usage (visitor_id);

grant select, insert on public.token_usage to anon;

alter table public.token_usage enable row level security;

drop policy if exists "token_usage_public_insert" on public.token_usage;
create policy "token_usage_public_insert"
on public.token_usage
for insert
to anon
with check (true);

drop policy if exists "token_usage_public_read" on public.token_usage;
create policy "token_usage_public_read"
on public.token_usage
for select
to anon
using (true);
