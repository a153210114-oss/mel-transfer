-- Huaban unified order pool
-- Run in Supabase SQL editor before using the unified order dashboard.

create table if not exists public.huaban_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'huaban',
  order_no text not null unique,
  order_type text not null default 'service',
  source_channel text not null default 'agent_work_order',
  title text not null default '',
  description text not null default '',
  buyer_name text default '',
  buyer_contact text default '',
  supplier_id text default '',
  supplier_name text default '',
  supplier_contact text default '',
  city text default '',
  country text default '',
  address text default '',
  scheduled_at text default '',
  amount_text text default '',
  currency text default '',
  status text not null default 'pending_supplier',
  user_confirmed_at timestamptz,
  supplier_confirmed_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  agreement_version text default 'transaction_terms_v1_20260709',
  work_order jsonb not null default '{}'::jsonb,
  transaction_agreement jsonb not null default '{}'::jsonb,
  matching_preference jsonb not null default '{}'::jsonb,
  performance_proof jsonb not null default '{}'::jsonb,
  referral_chain jsonb not null default '{}'::jsonb,
  fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists huaban_orders_tenant_created_idx
  on public.huaban_orders (tenant_id, created_at desc);

create index if not exists huaban_orders_status_idx
  on public.huaban_orders (status);

create index if not exists huaban_orders_type_idx
  on public.huaban_orders (order_type);

create index if not exists huaban_orders_city_idx
  on public.huaban_orders (city);

create or replace function public.set_huaban_orders_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_huaban_orders_updated_at on public.huaban_orders;
create trigger trg_huaban_orders_updated_at
before update on public.huaban_orders
for each row execute function public.set_huaban_orders_updated_at();

comment on table public.huaban_orders is
'Unified order pool for Huaban retail, local service, delivery, travel and future transaction flows.';

