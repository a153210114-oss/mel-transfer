-- Huaban friend referral closed-loop schema
-- Purpose:
-- 1. Store QR/share referral events.
-- 2. Store bidirectional lightweight friendships.
-- 3. Store contribution/point events for referral rewards.

create table if not exists public.huaban_referral_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default '00000000-0000-0000-0000-000000000001',
  inviter_code text not null,
  referee_code text not null,
  inviter_name text default '',
  referee_name text default '',
  inviter_phone text default '',
  referee_phone text default '',
  source text not null default 'qr_open',
  status text not null default 'confirmed',
  points_awarded integer not null default 20,
  fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists huaban_referral_events_unique_pair_idx
  on public.huaban_referral_events (tenant_id, inviter_code, referee_code);

create index if not exists huaban_referral_events_inviter_idx
  on public.huaban_referral_events (tenant_id, inviter_code, created_at desc);

create index if not exists huaban_referral_events_referee_idx
  on public.huaban_referral_events (tenant_id, referee_code, created_at desc);

create table if not exists public.huaban_friendships (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default '00000000-0000-0000-0000-000000000001',
  owner_code text not null,
  friend_code text not null,
  friend_name text default '',
  friend_phone text default '',
  friend_industry text default '',
  friend_avatar text default '',
  source text not null default 'qr_referral',
  status text not null default 'active',
  fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.huaban_friendships
  add column if not exists friend_avatar text default '';

alter table if exists public.huaban_referral_events
  add column if not exists inviter_avatar text default '',
  add column if not exists referee_avatar text default '',
  add column if not exists direct_referrer_code text default '',
  add column if not exists second_level_referrer_code text default '',
  add column if not exists referral_depth integer not null default 1,
  add column if not exists credit_locked boolean not null default false;

create index if not exists huaban_referral_events_second_level_idx
  on public.huaban_referral_events (tenant_id, second_level_referrer_code, created_at desc)
  where second_level_referrer_code <> '';

create unique index if not exists huaban_friendships_owner_friend_idx
  on public.huaban_friendships (tenant_id, owner_code, friend_code);

create index if not exists huaban_friendships_owner_idx
  on public.huaban_friendships (tenant_id, owner_code, created_at desc);

create table if not exists public.huaban_point_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default '00000000-0000-0000-0000-000000000001',
  owner_code text not null,
  action text not null default 'referral_join',
  points integer not null default 0,
  related_code text default '',
  reason text default '',
  status text not null default 'pending_review',
  event_key text,
  base_points integer not null default 0,
  release_coefficient numeric(8,4) not null default 1,
  level_multiplier numeric(8,4) not null default 1,
  risk_level text not null default 'normal',
  abnormal_reason text default '',
  reviewed_at timestamptz,
  fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table if exists public.huaban_point_events
  add column if not exists event_key text,
  add column if not exists base_points integer not null default 0,
  add column if not exists release_coefficient numeric(8,4) not null default 1,
  add column if not exists level_multiplier numeric(8,4) not null default 1,
  add column if not exists risk_level text not null default 'normal',
  add column if not exists abnormal_reason text default '',
  add column if not exists reviewed_at timestamptz,
  add column if not exists ref_level integer not null default 1,
  add column if not exists direct_referrer_code text default '',
  add column if not exists second_level_referrer_code text default '';

create index if not exists huaban_point_events_owner_idx
  on public.huaban_point_events (tenant_id, owner_code, created_at desc);

create unique index if not exists huaban_point_events_unique_event_key_idx
  on public.huaban_point_events (tenant_id, event_key)
  where event_key is not null and event_key <> '';

create index if not exists huaban_point_events_review_idx
  on public.huaban_point_events (tenant_id, status, risk_level, created_at desc);

create index if not exists huaban_point_events_ref_level_idx
  on public.huaban_point_events (tenant_id, owner_code, ref_level, created_at desc);

create or replace function public.set_huaban_friendships_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_huaban_friendships_updated_at on public.huaban_friendships;
create trigger trg_huaban_friendships_updated_at
before update on public.huaban_friendships
for each row execute function public.set_huaban_friendships_updated_at();

comment on table public.huaban_referral_events is
'QR/share referral events. When user B opens user A invite link, A becomes inviter and B becomes referee.';

comment on table public.huaban_friendships is
'Lightweight bidirectional Huaban friend graph for family/local circle connections.';

comment on table public.huaban_point_events is
'Contribution and point event ledger, including referral rewards. event_key prevents duplicate rewards; status controls review and redemption eligibility.';
