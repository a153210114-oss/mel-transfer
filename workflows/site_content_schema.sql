create table if not exists public.huaban_site_content (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default '00000000-0000-0000-0000-000000000001',
  page_key text not null,
  status text not null default 'draft',
  content jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint huaban_site_content_status_check check (status in ('draft', 'published'))
);

create unique index if not exists huaban_site_content_unique_status
  on public.huaban_site_content (tenant_id, page_key, status);

alter table public.huaban_site_content enable row level security;

drop policy if exists "service role manages site content" on public.huaban_site_content;
create policy "service role manages site content"
  on public.huaban_site_content
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

comment on table public.huaban_site_content is
  '华伴官网内容表：后台保存草稿和发布版本，官网只读取 published。';
