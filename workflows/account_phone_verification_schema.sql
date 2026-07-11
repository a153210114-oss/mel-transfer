-- Huaban account and phone verification schema
-- Purpose:
-- 1. Use verified phone numbers as the first stable account anchor.
-- 2. Keep friend_code as a device/referral code, not the final unique account.
-- 3. Support passwordless registration/login with SMS OTP first, then device/biometric login later.

create table if not exists public.huaban_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default '00000000-0000-0000-0000-000000000001',
  account_uid text not null,
  primary_phone text not null,
  normalized_phone text not null,
  display_name text default '',
  friend_code text default '',
  status text not null default 'active',
  phone_verified_at timestamptz,
  fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists huaban_accounts_uid_idx
  on public.huaban_accounts (tenant_id, account_uid);

create unique index if not exists huaban_accounts_phone_idx
  on public.huaban_accounts (tenant_id, normalized_phone);

create index if not exists huaban_accounts_friend_code_idx
  on public.huaban_accounts (tenant_id, friend_code)
  where friend_code <> '';

create table if not exists public.huaban_phone_verifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default '00000000-0000-0000-0000-000000000001',
  phone text not null,
  normalized_phone text not null,
  code_hash text not null,
  purpose text not null default 'register_login',
  status text not null default 'sent',
  attempts integer not null default 0,
  provider text default '',
  friend_code text default '',
  ip_hash text default '',
  user_agent text default '',
  fields jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists huaban_phone_verifications_phone_idx
  on public.huaban_phone_verifications (tenant_id, normalized_phone, created_at desc);

create index if not exists huaban_phone_verifications_status_idx
  on public.huaban_phone_verifications (tenant_id, status, created_at desc);

create or replace function public.set_huaban_accounts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_huaban_accounts_updated_at on public.huaban_accounts;
create trigger trg_huaban_accounts_updated_at
before update on public.huaban_accounts
for each row execute function public.set_huaban_accounts_updated_at();

comment on table public.huaban_accounts is
'Verified Huaban user accounts. Phone verification is the first stable identity anchor; friend_code remains device/referral metadata.';

comment on table public.huaban_phone_verifications is
'Short-lived SMS OTP records. Store only hashed codes, rate-limit by normalized phone and IP hash in API.';
