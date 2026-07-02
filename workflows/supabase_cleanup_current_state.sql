-- 华伴 Supabase 数据清理 SQL
-- 目的：保留表结构和真实业务数据，只清理明显测试/演示数据。
-- 当前版本已按你现有字段结构调整：
-- contacts.name / contacts.phone
-- drivers.full_name / drivers.phone
-- trips.passenger_name / trips.passenger_phone
-- referrals 通过 contacts.id 关联清理
-- recruitment_leads.name / recruitment_leads.contact
--
-- 执行前建议：
-- 1. Supabase 先备份。
-- 2. 先执行【预览】段，看将要删除多少行。
-- 3. 确认没问题后再执行【删除】段。

-- =========================
-- 预览：只查看，不删除
-- =========================

with test_contacts as (
  select id
  from contacts
  where coalesce(phone, '') ilike any (array['%test%','%测试%','%demo%','%123456%'])
     or coalesce(name, '') ilike any (array['%test%','%测试%','%demo%'])
     or coalesce(customer_id, '') ilike any (array['%test%','%demo%'])
),
test_drivers as (
  select id
  from drivers
  where coalesce(phone, '') ilike any (array['%test%','%测试%','%demo%','%123456%'])
     or coalesce(full_name, '') ilike any (array['%test%','%测试%','%demo%'])
     or coalesce(email, '') ilike any (array['%test%','%demo%'])
),
test_trips as (
  select id
  from trips
  where coalesce(passenger_phone, '') ilike any (array['%test%','%测试%','%demo%','%123456%'])
     or coalesce(passenger_name, '') ilike any (array['%test%','%测试%','%demo%'])
),
test_referrals as (
  select r.id
  from referrals r
  where r.referrer_id in (select id from test_contacts)
     or r.referee_id in (select id from test_contacts)
     or coalesce(r.customer_id, '') ilike any (array['%test%','%demo%'])
),
test_tour_plaza as (
  select id
  from tour_plaza
  where coalesce(title, '') ilike any (array['%test%','%测试%','%demo%'])
     or coalesce(description, '') ilike any (array['%test%','%测试%','%demo%'])
     or coalesce(author_name, '') ilike any (array['%test%','%测试%','%demo%'])
),
test_recruitment_leads as (
  select id
  from recruitment_leads
  where coalesce(channel, '') ilike any (array['%test%','%demo%','%old%'])
     or coalesce(name, '') ilike any (array['%test%','%测试%','%demo%'])
     or coalesce(contact, '') ilike any (array['%test%','%测试%','%demo%','%123456%'])
)
select 'contacts' as table_name, count(*) as rows_to_delete from test_contacts
union all
select 'drivers', count(*) from test_drivers
union all
select 'trips', count(*) from test_trips
union all
select 'referrals', count(*) from test_referrals
union all
select 'tour_plaza', count(*) from test_tour_plaza
union all
select 'recruitment_leads', count(*) from test_recruitment_leads;

-- =========================
-- 删除：确认预览结果后再执行
-- =========================

begin;

with test_contacts as (
  select id
  from contacts
  where coalesce(phone, '') ilike any (array['%test%','%测试%','%demo%','%123456%'])
     or coalesce(name, '') ilike any (array['%test%','%测试%','%demo%'])
     or coalesce(customer_id, '') ilike any (array['%test%','%demo%'])
),
test_referrals as (
  select r.id
  from referrals r
  where r.referrer_id in (select id from test_contacts)
     or r.referee_id in (select id from test_contacts)
     or coalesce(r.customer_id, '') ilike any (array['%test%','%demo%'])
)
delete from referrals
where id in (select id from test_referrals);

with test_trips as (
  select id
  from trips
  where coalesce(passenger_phone, '') ilike any (array['%test%','%测试%','%demo%','%123456%'])
     or coalesce(passenger_name, '') ilike any (array['%test%','%测试%','%demo%'])
)
delete from trips
where id in (select id from test_trips);

with test_contacts as (
  select id
  from contacts
  where coalesce(phone, '') ilike any (array['%test%','%测试%','%demo%','%123456%'])
     or coalesce(name, '') ilike any (array['%test%','%测试%','%demo%'])
     or coalesce(customer_id, '') ilike any (array['%test%','%demo%'])
)
delete from contacts
where id in (select id from test_contacts);

with test_drivers as (
  select id
  from drivers
  where coalesce(phone, '') ilike any (array['%test%','%测试%','%demo%','%123456%'])
     or coalesce(full_name, '') ilike any (array['%test%','%测试%','%demo%'])
     or coalesce(email, '') ilike any (array['%test%','%demo%'])
)
delete from drivers
where id in (select id from test_drivers);

with test_tour_plaza as (
  select id
  from tour_plaza
  where coalesce(title, '') ilike any (array['%test%','%测试%','%demo%'])
     or coalesce(description, '') ilike any (array['%test%','%测试%','%demo%'])
     or coalesce(author_name, '') ilike any (array['%test%','%测试%','%demo%'])
)
delete from tour_plaza
where id in (select id from test_tour_plaza);

with test_recruitment_leads as (
  select id
  from recruitment_leads
  where coalesce(channel, '') ilike any (array['%test%','%demo%','%old%'])
     or coalesce(name, '') ilike any (array['%test%','%测试%','%demo%'])
     or coalesce(contact, '') ilike any (array['%test%','%测试%','%demo%','%123456%'])
)
delete from recruitment_leads
where id in (select id from test_recruitment_leads);

commit;

-- 如果执行后发现误删，立即从 Supabase 备份恢复。
