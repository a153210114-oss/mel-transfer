-- Huaban referral / points test cleanup
-- Safe version: skips tables that do not exist.
--
-- Use in Supabase SQL Editor:
-- 1. Run PREVIEW block first.
-- 2. If counts look right, run DELETE block.
--
-- Edit these test codes / phones before execution if you used different devices.

-- =========================
-- PREVIEW ONLY
-- =========================

do $$
declare
  test_codes text[] := array['O1X619','WSL6E4','JKKKMO','A111','B222','C333'];
  test_phones text[] := array['0449251218','+61449251218','61449251218'];
  row_count bigint := 0;
begin
  create temp table if not exists huaban_cleanup_preview(
    table_name text,
    rows_to_delete bigint
  );
  truncate huaban_cleanup_preview;

  if to_regclass('public.huaban_point_events') is not null then
    select count(*) into row_count
    from public.huaban_point_events
    where upper(coalesce(owner_code, '')) = any(test_codes)
       or upper(coalesce(related_code, '')) = any(test_codes)
       or coalesce(fields->>'source', '') in ('test','profile_page_save_referral','profile_client_referral_fallback','server_referral_bind','huaban_friend_referral');
    insert into huaban_cleanup_preview values ('huaban_point_events', row_count);
  else
    insert into huaban_cleanup_preview values ('huaban_point_events_missing', 0);
  end if;

  if to_regclass('public.huaban_referral_events') is not null then
    select count(*) into row_count
    from public.huaban_referral_events
    where upper(coalesce(inviter_code, '')) = any(test_codes)
       or upper(coalesce(referee_code, '')) = any(test_codes)
       or regexp_replace(coalesce(inviter_phone, ''), '[\s().-]', '', 'g') = any(test_phones)
       or regexp_replace(coalesce(referee_phone, ''), '[\s().-]', '', 'g') = any(test_phones)
       or coalesce(source, '') in ('test','profile_page_save_referral','profile_client_referral_fallback','friend_qr_add_reconcile');
    insert into huaban_cleanup_preview values ('huaban_referral_events', row_count);
  else
    insert into huaban_cleanup_preview values ('huaban_referral_events_missing', 0);
  end if;

  if to_regclass('public.huaban_friendships') is not null then
    select count(*) into row_count
    from public.huaban_friendships
    where upper(coalesce(owner_code, '')) = any(test_codes)
       or upper(coalesce(friend_code, '')) = any(test_codes)
       or regexp_replace(coalesce(friend_phone, ''), '[\s().-]', '', 'g') = any(test_phones)
       or coalesce(source, '') in ('test','qr_referral','server_referral_bind','profile_client_referral_fallback');
    insert into huaban_cleanup_preview values ('huaban_friendships', row_count);
  else
    insert into huaban_cleanup_preview values ('huaban_friendships_missing', 0);
  end if;

  if to_regclass('public.huaban_identity_links') is not null then
    select count(*) into row_count
    from public.huaban_identity_links
    where upper(coalesce(friend_code, '')) = any(test_codes)
       or upper(coalesce(inviter_code, '')) = any(test_codes)
       or upper(coalesce(owner_code, '')) = any(test_codes)
       or regexp_replace(coalesce(phone, ''), '[\s().-]', '', 'g') = any(test_phones)
       or regexp_replace(coalesce(normalized_phone, ''), '[\s().-]', '', 'g') = any(test_phones)
       or coalesce(source, '') in ('profile_page_save','profile_page_save_referral','referral_inviter','referral_referee');
    insert into huaban_cleanup_preview values ('huaban_identity_links', row_count);
  else
    insert into huaban_cleanup_preview values ('huaban_identity_links_missing', 0);
  end if;
end $$;

select * from huaban_cleanup_preview order by table_name;

-- =========================
-- DELETE AFTER CONFIRMATION
-- =========================

do $$
declare
  test_codes text[] := array['O1X619','WSL6E4','JKKKMO','A111','B222','C333'];
  test_phones text[] := array['0449251218','+61449251218','61449251218'];
  row_count bigint := 0;
begin
  create temp table if not exists huaban_cleanup_deleted(
    table_name text,
    deleted_rows bigint
  );
  truncate huaban_cleanup_deleted;

  if to_regclass('public.huaban_point_events') is not null then
    delete from public.huaban_point_events
    where upper(coalesce(owner_code, '')) = any(test_codes)
       or upper(coalesce(related_code, '')) = any(test_codes)
       or coalesce(fields->>'source', '') in ('test','profile_page_save_referral','profile_client_referral_fallback','server_referral_bind','huaban_friend_referral');
    get diagnostics row_count = ROW_COUNT;
    insert into huaban_cleanup_deleted values ('huaban_point_events', row_count);
  else
    insert into huaban_cleanup_deleted values ('huaban_point_events_missing', 0);
  end if;

  if to_regclass('public.huaban_referral_events') is not null then
    delete from public.huaban_referral_events
    where upper(coalesce(inviter_code, '')) = any(test_codes)
       or upper(coalesce(referee_code, '')) = any(test_codes)
       or regexp_replace(coalesce(inviter_phone, ''), '[\s().-]', '', 'g') = any(test_phones)
       or regexp_replace(coalesce(referee_phone, ''), '[\s().-]', '', 'g') = any(test_phones)
       or coalesce(source, '') in ('test','profile_page_save_referral','profile_client_referral_fallback','friend_qr_add_reconcile');
    get diagnostics row_count = ROW_COUNT;
    insert into huaban_cleanup_deleted values ('huaban_referral_events', row_count);
  else
    insert into huaban_cleanup_deleted values ('huaban_referral_events_missing', 0);
  end if;

  if to_regclass('public.huaban_friendships') is not null then
    delete from public.huaban_friendships
    where upper(coalesce(owner_code, '')) = any(test_codes)
       or upper(coalesce(friend_code, '')) = any(test_codes)
       or regexp_replace(coalesce(friend_phone, ''), '[\s().-]', '', 'g') = any(test_phones)
       or coalesce(source, '') in ('test','qr_referral','server_referral_bind','profile_client_referral_fallback');
    get diagnostics row_count = ROW_COUNT;
    insert into huaban_cleanup_deleted values ('huaban_friendships', row_count);
  else
    insert into huaban_cleanup_deleted values ('huaban_friendships_missing', 0);
  end if;

  if to_regclass('public.huaban_identity_links') is not null then
    delete from public.huaban_identity_links
    where upper(coalesce(friend_code, '')) = any(test_codes)
       or upper(coalesce(inviter_code, '')) = any(test_codes)
       or upper(coalesce(owner_code, '')) = any(test_codes)
       or regexp_replace(coalesce(phone, ''), '[\s().-]', '', 'g') = any(test_phones)
       or regexp_replace(coalesce(normalized_phone, ''), '[\s().-]', '', 'g') = any(test_phones)
       or coalesce(source, '') in ('profile_page_save','profile_page_save_referral','referral_inviter','referral_referee');
    get diagnostics row_count = ROW_COUNT;
    insert into huaban_cleanup_deleted values ('huaban_identity_links', row_count);
  else
    insert into huaban_cleanup_deleted values ('huaban_identity_links_missing', 0);
  end if;
end $$;

select * from huaban_cleanup_deleted order by table_name;
