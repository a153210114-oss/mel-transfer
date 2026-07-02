-- 华伴 Supabase 数据清理草案
-- 目的：保留表结构和真实业务数据，清理测试/演示/旧流程数据。
-- 使用方式：先在 Supabase 做备份，再在 SQL Editor 中按段执行。
-- 注意：不要整库 drop，不要删除表结构。

begin;

-- 1. 清理明显测试联系方式
-- 如有真实用户电话刚好包含这些关键词，请先手动排除。
delete from referrals
where referee_phone ilike any (array['%test%','%测试%','%demo%','%123456%'])
   or referrer_code ilike any (array['%test%','%demo%']);

delete from trips
where passenger_phone ilike any (array['%test%','%测试%','%demo%','%123456%'])
   or passenger_name ilike any (array['%test%','%测试%','%demo%']);

delete from contacts
where phone ilike any (array['%test%','%测试%','%demo%','%123456%'])
   or full_name ilike any (array['%test%','%测试%','%demo%']);

delete from drivers
where phone ilike any (array['%test%','%测试%','%demo%','%123456%'])
   or full_name ilike any (array['%test%','%测试%','%demo%']);

-- 2. 清理旧 workflow 或测试来源的线索
delete from recruitment_leads
where channel ilike any (array['%test%','%demo%','%old%'])
   or name ilike any (array['%test%','%测试%','%demo%'])
   or contact ilike any (array['%test%','%测试%','%demo%','%123456%']);

-- 3. 可选：如果 tour_plaza 中有测试内容，按标题/描述关键词清理。
-- delete from tour_plaza
-- where title ilike any (array['%test%','%测试%','%demo%'])
--    or description ilike any (array['%test%','%测试%','%demo%']);

commit;

-- 如执行后发现误删，立即从 Supabase 备份恢复。
