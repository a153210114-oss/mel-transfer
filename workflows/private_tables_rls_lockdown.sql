-- HuaBan private table lockdown.
-- Purpose:
-- 1. Stop browser anon keys from reading or mutating private identity, points,
--    referral, friendship, and order tables by changing REST query parameters.
-- 2. Force all sensitive reads/writes through server APIs that verify the
--    Supabase Auth user and use SUPABASE_SERVICE_ROLE_KEY.
--
-- Run this only after the corresponding client features have server API
-- wrappers. Service-role API routes bypass RLS; browser anon/authenticated
-- clients will be denied unless explicit policies are added later.

do $$
declare
  table_name text;
  tables text[] := array[
    'huaban_accounts',
    'huaban_identity_links',
    'huaban_friendships',
    'huaban_referral_events',
    'huaban_point_events',
    'huaban_orders',
    'huaban_phone_verifications'
  ];
begin
  foreach table_name in array tables loop
    if to_regclass('public.' || table_name) is not null then
      execute format('alter table public.%I enable row level security', table_name);
      execute format('alter table public.%I force row level security', table_name);
      execute format('revoke all on table public.%I from anon', table_name);
      execute format('revoke all on table public.%I from authenticated', table_name);
    end if;
  end loop;
end $$;

comment on schema public is
  'HuaBan security note: private identity, referral, points, friendship, and order data must be accessed through verified server APIs, not browser REST filters.';
