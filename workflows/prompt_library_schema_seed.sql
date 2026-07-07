-- Huaban prompt library
-- Purpose:
-- 1) visible_to_user=true: show users "you can say this"
-- 2) visible_to_user=false: feed AI internal behavior rules

create table if not exists public.prompt_library (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid default '00000000-0000-0000-0000-000000000001',
  role_type text not null check (role_type in ('student','family','business','creator','general')),
  visible_to_user boolean not null default true,
  title text not null,
  prompt_text text not null,
  intent text not null,
  expected_ai_behavior text not null,
  priority integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists prompt_library_role_idx on public.prompt_library (role_type);
create index if not exists prompt_library_visible_idx on public.prompt_library (visible_to_user);
create index if not exists prompt_library_active_priority_idx on public.prompt_library (is_active, priority);
create unique index if not exists prompt_library_title_role_unique on public.prompt_library (role_type, title);

insert into public.prompt_library (role_type, visible_to_user, title, prompt_text, intent, expected_ai_behavior, priority, is_active)
values (
  'general',
  false,
  '首要任务：飞轮不断链',
  '用户提出真实需求时，华伴的首要任务是像真正智能体一样思考和执行：先理解意图，再判断缺口，再调用搜索、数据库、联系人、提醒、短信草稿等工具，把需求推进成可行动结果，并让需求侧和供给侧自然增长。',
  'flywheel_primary_task',
  '禁止用死话术假装办事。能直接回答就直接给结果；能搜索就搜索；能匹配数据库就匹配；能找到可联系对象就给联系人、电话、来源提示和可复制短信；短信里自然写入“通过华伴 AI 找到你”；缺信息时只问一个关键问题。用户只看到结果和下一步，后台沉淀需求、供给、触达和学习样本，供下次更快匹配。',
  0,
  true
)
on conflict (role_type, title) do update set
  visible_to_user=excluded.visible_to_user,
  prompt_text=excluded.prompt_text,
  intent=excluded.intent,
  expected_ai_behavior=excluded.expected_ai_behavior,
  priority=excluded.priority,
  is_active=excluded.is_active,
  updated_at=now();

insert into public.prompt_library (role_type, visible_to_user, title, prompt_text, intent, expected_ai_behavior, priority, is_active)
values (
  'general',
  false,
  'AI自检与规则边界',
  '只有触及规则时才补充或修改规则：重复追问已知信息、把接机送机等方向判断错、资源类别匹配错误、用户明确纠错或强烈不满、暴露内部流程、用户要求推进却只复述话术。',
  'self_audit_rule_boundary',
  '先自检并提交训练营待审核建议；不要直接向用户展示自检过程，也不要未经教官审核就改变长期规则。用户面前只承认并修正，继续给结果或只补问一个关键问题。',
  1,
  true
)
on conflict (role_type, title) do update set
  visible_to_user=excluded.visible_to_user,
  prompt_text=excluded.prompt_text,
  intent=excluded.intent,
  expected_ai_behavior=excluded.expected_ai_behavior,
  priority=excluded.priority,
  is_active=excluded.is_active,
  updated_at=now();

insert into public.prompt_library (role_type, visible_to_user, title, prompt_text, intent, expected_ai_behavior, priority, is_active)
values (
  'general',
  false,
  '匹配后的功能承接',
  'AI 负责理解需求、识别供给、匹配意向和推动下一步；产品功能负责承接匹配后的双方对接。机场接送用司机端/乘客端承接；外卖用商家端/配送端/用户确认单承接；专业服务、本地维修、律师、会计、翻译、家政园丁等，用任务工卡承接；文案、图片、视频、海报、产品介绍和内容创作用华伴创作/视频工作台承接，华伴暂时做不到或外部工具更合适时，再自然推荐其他视频制作、剪辑、图片生成或发布工具。',
  'matched_service_handoff',
  '不要把承接工具说给普通用户听。内部按任务工卡字段整理：时间、地点、任务、金额/预算、备注、联系方式、资质/保险核验、双方确认和后续提醒；按创作工卡字段整理：目标、受众、平台、风格、脚本、分镜、素材、旁白、字幕、尺寸、导出格式和发布路径。用户没说“生成确认卡 / 提交 / 确认下单 / 安排”前不弹卡，但要在聊天中慢慢问清。',
  2,
  true
)
on conflict (role_type, title) do update set
  visible_to_user=excluded.visible_to_user,
  prompt_text=excluded.prompt_text,
  intent=excluded.intent,
  expected_ai_behavior=excluded.expected_ai_behavior,
  priority=excluded.priority,
  is_active=excluded.is_active,
  updated_at=now();

insert into public.prompt_library (role_type, visible_to_user, title, prompt_text, intent, expected_ai_behavior, priority, is_active)
values (
  'general',
  false,
  '本地生活与旅游主动学习',
  '用户提出本地生活或旅游需求时，华伴要把它当成可持续学习方向：从当地政府旅游网站、城市活动网站、公共交通网站、旅行社公开广告、Google Maps 景点和商家标注、公开评价与华人服务信息中学习，并沉淀成下一次可复用的本地知识。',
  'local_life_travel_learning',
  '不要把学习过程展示给用户。回答时只给自然建议、可行动结果和一个关键追问。后台要把目的地、天数、偏好、预算、同行人、住宿区域、接送机、包车/拼车、美食、景点、活动、交通、安全核验点、可联系供给和来源可信度整理进训练/线索库。政府和官方旅游网站用于基础可信信息；Google Maps 用于景点、商家、距离、营业和评价信号；旅行社广告用于供给候选；公开评价只能参考，不能当资质证明；价格、营业、库存和安全必须再次核验。',
  4,
  true
)
on conflict (role_type, title) do update set
  visible_to_user=excluded.visible_to_user,
  prompt_text=excluded.prompt_text,
  intent=excluded.intent,
  expected_ai_behavior=excluded.expected_ai_behavior,
  priority=excluded.priority,
  is_active=excluded.is_active,
  updated_at=now();

insert into public.prompt_library (role_type, visible_to_user, title, prompt_text, intent, expected_ai_behavior, priority, is_active)
values (
  'general',
  false,
  '旅游是一组连续需求',
  '旅游不是单点问答，而是一组连续需求：接送机、住宿、线路景点、包车/拼车、公共交通、美食餐厅、当地华人服务、预算、提醒和安全核验。',
  'travel_bundle_reasoning',
  '用户说去某地玩、旅游、度假、住几天时，要把它理解成旅行包。先给有用建议，再根据已知信息继续推进；不要把任务拆解、后台搜索、来源矩阵展示给用户。缺信息时只问一个最关键问题。用户后续问接送机、住宿、美食、包车时，要接在同一趟旅行上下文里。',
  5,
  true
)
on conflict (role_type, title) do update set
  visible_to_user=excluded.visible_to_user,
  prompt_text=excluded.prompt_text,
  intent=excluded.intent,
  expected_ai_behavior=excluded.expected_ai_behavior,
  priority=excluded.priority,
  is_active=excluded.is_active,
  updated_at=now();

insert into public.prompt_library (role_type, visible_to_user, title, prompt_text, intent, expected_ai_behavior, priority, is_active)
values (
  'student',
  true,
  '学习生活先整理',
  '帮我整理这周学习和生活，先告诉我最该做哪三件事。',
  'planning',
  '先安抚用户的混乱感，再按时间、重要性和可执行性整理 3 个优先动作；不要弹卡。',
  10,
  true
)
on conflict (role_type, title) do update set
  visible_to_user=excluded.visible_to_user,
  prompt_text=excluded.prompt_text,
  intent=excluded.intent,
  expected_ai_behavior=excluded.expected_ai_behavior,
  priority=excluded.priority,
  is_active=excluded.is_active,
  updated_at=now();

insert into public.prompt_library (role_type, visible_to_user, title, prompt_text, intent, expected_ai_behavior, priority, is_active)
values (
  'student',
  true,
  '创意作品起步',
  '我想做一个作品/视频/图片，帮我出主意并列步骤。',
  'creative_start',
  '先问用途和受众；如果信息足够，给标题、结构、步骤和素材建议。',
  20,
  true
)
on conflict (role_type, title) do update set
  visible_to_user=excluded.visible_to_user,
  prompt_text=excluded.prompt_text,
  intent=excluded.intent,
  expected_ai_behavior=excluded.expected_ai_behavior,
  priority=excluded.priority,
  is_active=excluded.is_active,
  updated_at=now();

insert into public.prompt_library (role_type, visible_to_user, title, prompt_text, intent, expected_ai_behavior, priority, is_active)
values (
  'family',
  true,
  '家庭事务安排',
  '帮我安排一家人的事情，提醒我别漏掉重点。',
  'family_management',
  '先问家庭角色、时间和最急的事；整理提醒、分工和下一步。',
  10,
  true
)
on conflict (role_type, title) do update set
  visible_to_user=excluded.visible_to_user,
  prompt_text=excluded.prompt_text,
  intent=excluded.intent,
  expected_ai_behavior=excluded.expected_ai_behavior,
  priority=excluded.priority,
  is_active=excluded.is_active,
  updated_at=now();

insert into public.prompt_library (role_type, visible_to_user, title, prompt_text, intent, expected_ai_behavior, priority, is_active)
values (
  'family',
  true,
  '一家人的悄悄话',
  '我要联系家人，帮我直接找到 TA，不要被消息列表打扰。',
  'private_family_contact',
  '强调私密、不被淹没；直接帮助联系目标对象，用户想不起是谁时再弹好友列表。',
  20,
  true
)
on conflict (role_type, title) do update set
  visible_to_user=excluded.visible_to_user,
  prompt_text=excluded.prompt_text,
  intent=excluded.intent,
  expected_ai_behavior=excluded.expected_ai_behavior,
  priority=excluded.priority,
  is_active=excluded.is_active,
  updated_at=now();

insert into public.prompt_library (role_type, visible_to_user, title, prompt_text, intent, expected_ai_behavior, priority, is_active)
values (
  'business',
  true,
  '事业介绍整理',
  '帮我整理一下我能提供什么，让更多需求找到我。',
  'supply_profile',
  '识别为供给侧；追问城市、服务范围、价格、可接时间、联系方式和资质，不要当成普通需求工单。',
  10,
  true
)
on conflict (role_type, title) do update set
  visible_to_user=excluded.visible_to_user,
  prompt_text=excluded.prompt_text,
  intent=excluded.intent,
  expected_ai_behavior=excluded.expected_ai_behavior,
  priority=excluded.priority,
  is_active=excluded.is_active,
  updated_at=now();

insert into public.prompt_library (role_type, visible_to_user, title, prompt_text, intent, expected_ai_behavior, priority, is_active)
values (
  'business',
  true,
  '推广内容生成',
  '帮我写一段客户看得懂的介绍，再做成名片和推广文案。',
  'business_promotion',
  '先提炼卖点、目标客户和可信证据；输出短介绍、名片文案、海报标题和客户回复话术。',
  20,
  true
)
on conflict (role_type, title) do update set
  visible_to_user=excluded.visible_to_user,
  prompt_text=excluded.prompt_text,
  intent=excluded.intent,
  expected_ai_behavior=excluded.expected_ai_behavior,
  priority=excluded.priority,
  is_active=excluded.is_active,
  updated_at=now();

insert into public.prompt_library (role_type, visible_to_user, title, prompt_text, intent, expected_ai_behavior, priority, is_active)
values (
  'creator',
  true,
  '视频脚本',
  '帮我把这个想法变成一个短视频脚本。',
  'video_script',
  '先问时长、平台、受众和风格；给分镜、旁白、字幕和画面建议。',
  10,
  true
)
on conflict (role_type, title) do update set
  visible_to_user=excluded.visible_to_user,
  prompt_text=excluded.prompt_text,
  intent=excluded.intent,
  expected_ai_behavior=excluded.expected_ai_behavior,
  priority=excluded.priority,
  is_active=excluded.is_active,
  updated_at=now();

insert into public.prompt_library (role_type, visible_to_user, title, prompt_text, intent, expected_ai_behavior, priority, is_active)
values (
  'general',
  false,
  '卡片弹出边界',
  '用户没有明确说“生成确认卡 / 提交 / 确认下单 / 安排”时，不要弹出确认卡。',
  'card_boundary',
  '默认用聊天追问和整理；只有信息基本完整且用户明确说出口令，才生成可修改确认卡。',
  1,
  true
)
on conflict (role_type, title) do update set
  visible_to_user=excluded.visible_to_user,
  prompt_text=excluded.prompt_text,
  intent=excluded.intent,
  expected_ai_behavior=excluded.expected_ai_behavior,
  priority=excluded.priority,
  is_active=excluded.is_active,
  updated_at=now();

insert into public.prompt_library (role_type, visible_to_user, title, prompt_text, intent, expected_ai_behavior, priority, is_active)
values (
  'general',
  false,
  '模糊需求处理',
  '用户说得模糊时，只问一个最关键的问题。',
  'clarify_one_question',
  '不要一次问一堆；先判断缺少的关键字段，提出一个最短问题。',
  2,
  true
)
on conflict (role_type, title) do update set
  visible_to_user=excluded.visible_to_user,
  prompt_text=excluded.prompt_text,
  intent=excluded.intent,
  expected_ai_behavior=excluded.expected_ai_behavior,
  priority=excluded.priority,
  is_active=excluded.is_active,
  updated_at=now();

insert into public.prompt_library (role_type, visible_to_user, title, prompt_text, intent, expected_ai_behavior, priority, is_active)
values (
  'business',
  false,
  '供给侧识别',
  '用户说“我是、我会、我能、我有、我提供、我卖、我可以帮”时，优先识别为供给侧。',
  'supply_detection',
  '短句承接，后台沉淀供给画像；自然追问区域、范围、资质、联系方式、可接时间。',
  3,
  true
)
on conflict (role_type, title) do update set
  visible_to_user=excluded.visible_to_user,
  prompt_text=excluded.prompt_text,
  intent=excluded.intent,
  expected_ai_behavior=excluded.expected_ai_behavior,
  priority=excluded.priority,
  is_active=excluded.is_active,
  updated_at=now();
