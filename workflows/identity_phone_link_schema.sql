-- Huaban phone identity link schema
-- Purpose:
-- 1. Use phone numbers as the stable bridge across contacts, QR referrals, image cards,
--    public supply leads, and later Huaban users.
-- 2. Preserve contribution/referral evidence without exposing backend mechanics to users.
-- 3. Allow supply leads to be claimed when the same phone later becomes a Huaban user.

create table if not exists public.huaban_identity_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default '00000000-0000-0000-0000-000000000001',
  phone text not null,
  normalized_phone text not null,
  friend_code text default '',
  display_name text default '',
  avatar text default '',
  industry text default '',
  city text default '',
  country text default '',
  source text not null default 'unknown',
  source_ref text default '',
  link_type text not null default 'phone_identity',
  status text not null default 'active',
  inviter_code text default '',
  owner_code text default '',
  supply_profile_id uuid,
  fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists huaban_identity_links_unique_source_idx
  on public.huaban_identity_links (tenant_id, normalized_phone, source, (coalesce(source_ref, '')));

create index if not exists huaban_identity_links_phone_idx
  on public.huaban_identity_links (tenant_id, normalized_phone, created_at desc);

create index if not exists huaban_identity_links_friend_code_idx
  on public.huaban_identity_links (tenant_id, friend_code)
  where friend_code <> '';

create index if not exists huaban_identity_links_inviter_idx
  on public.huaban_identity_links (tenant_id, inviter_code, created_at desc)
  where inviter_code <> '';

alter table if exists public.huaban_supply_profiles
  add column if not exists claimed_by_code text default '',
  add column if not exists claimed_phone text default '',
  add column if not exists claimed_at timestamptz;

create index if not exists huaban_supply_profiles_claimed_phone_idx
  on public.huaban_supply_profiles (tenant_id, claimed_phone)
  where claimed_phone <> '';

create or replace function public.set_huaban_identity_links_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_huaban_identity_links_updated_at on public.huaban_identity_links;
create trigger trg_huaban_identity_links_updated_at
before update on public.huaban_identity_links
for each row execute function public.set_huaban_identity_links_updated_at();

comment on table public.huaban_identity_links is
'Phone-based identity bridge for Huaban referrals, contact invitations, public supply leads, image business cards, and later user adoption.';

comment on column public.huaban_identity_links.normalized_phone is
'Normalized phone number used as the stable identity anchor across invite, contact, supply and user profile flows.';

comment on column public.huaban_supply_profiles.claimed_by_code is
'Huaban friend/user code that later claimed or matched this public/passive supply profile by phone, website or qualification.';
