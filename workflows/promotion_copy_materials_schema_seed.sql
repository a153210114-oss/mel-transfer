-- Huaban promotion copy materials
-- Purpose: reusable copy assets for homepage, posters, short videos, outreach rewrites and AI promotion agent.

create table if not exists public.promotion_copy_materials (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid default '00000000-0000-0000-0000-000000000001',
  material_key text not null,
  segment text not null,
  audience text not null check (audience in ('student','family','business','creator','supplier','general','mixed')),
  copy_type text not null check (copy_type in ('slogan','headline','long_copy','poster','video_script','social_post','agent_rule')),
  title text not null,
  pain_point text,
  desire text,
  headline text not null,
  body text not null,
  short_line text,
  cta text,
  landing_url text default 'https://www.huabanapp.com/',
  channels jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  usage_notes text,
  priority integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists promotion_copy_materials_key_unique
  on public.promotion_copy_materials (material_key);
create index if not exists promotion_copy_materials_segment_idx
  on public.promotion_copy_materials (segment);
create index if not exists promotion_copy_materials_audience_idx
  on public.promotion_copy_materials (audience);
create index if not exists promotion_copy_materials_type_idx
  on public.promotion_copy_materials (copy_type);
create index if not exists promotion_copy_materials_active_priority_idx
  on public.promotion_copy_materials (is_active, priority);

insert into public.promotion_copy_materials (
  material_key, segment, audience, copy_type, title, pain_point, desire,
  headline, body, short_line, cta, landing_url, channels, tags, usage_notes, priority, is_active
) values (
  'core_positioning_capable_companion',
  'core',
  'general',
  'headline',
  '有能力的协助者',
  '用户不想被当成不会做事的人，也不想再下载一个只会聊天的 App。',
  '希望 AI 尊重自己，同时真的能把事情往前推。',
  '华伴，是一个有能力的协助者。',
  '你来决定方向，华伴来执行细节。华伴不是来定义你的，也不是替你证明你不行。它会理解你的目标，整理混乱，推进下一步，让想做的事一点点变成结果。',
  '你来决定方向，华伴来执行细节。',
  '有事，叫华伴。',
  'https://www.huabanapp.com/',
  '["homepage","poster","video","wechat","xiaohongshu"]'::jsonb,
  '["core","positioning","confidence","assistant"]'::jsonb,
  '适合官网首屏、副标题、视频结尾和品牌统一口径。',
  10,
  true
)
on conflict (material_key) do update set
  segment=excluded.segment,
  audience=excluded.audience,
  copy_type=excluded.copy_type,
  title=excluded.title,
  pain_point=excluded.pain_point,
  desire=excluded.desire,
  headline=excluded.headline,
  body=excluded.body,
  short_line=excluded.short_line,
  cta=excluded.cta,
  landing_url=excluded.landing_url,
  channels=excluded.channels,
  tags=excluded.tags,
  usage_notes=excluded.usage_notes,
  priority=excluded.priority,
  is_active=excluded.is_active,
  updated_at=now();

insert into public.promotion_copy_materials (
  material_key, segment, audience, copy_type, title, pain_point, desire,
  headline, body, short_line, cta, landing_url, channels, tags, usage_notes, priority, is_active
) values (
  'emotional_huaban_understands_you',
  'young_focus',
  'student',
  'long_copy',
  '华伴懂你',
  '从小到大活在别人的目光里，被要求、被责备、被比较、被贴标签，慢慢学会迎合，却忘了爱自己。',
  '想更自由、更独立、更有爱，把生活重新握回自己手里，改写自己的人生。',
  '华伴懂你。',
  '从小到大，我们常常活在别人的目光里。被要求、被责备、被比较，也被贴上各种标签。慢慢地，我们学会了迎合，却忘了怎样好好爱自己。可你心里一直有一个愿望：想更自由，更独立，也更有爱。想把生活重新握回自己手里，想一点点改写自己的人生。华伴不是来定义你的。华伴是一个有能力的协助者，陪你整理混乱，推进目标，找回节奏。你来决定方向，华伴来执行细节。成就更出色的你。',
  '华伴不是来定义你的。华伴来陪你改写人生。',
  '领养你的华伴 AI。',
  'https://www.huabanapp.com/?ref=student_free',
  '["homepage","xiaohongshu","video","poster"]'::jsonb,
  '["emotion","young_people","freedom","self_growth"]'::jsonb,
  '适合打年轻海外华人、留学生、自由自主和自我成长人群；语气要温柔，不要卖惨。',
  20,
  true
)
on conflict (material_key) do update set
  segment=excluded.segment,
  audience=excluded.audience,
  copy_type=excluded.copy_type,
  title=excluded.title,
  pain_point=excluded.pain_point,
  desire=excluded.desire,
  headline=excluded.headline,
  body=excluded.body,
  short_line=excluded.short_line,
  cta=excluded.cta,
  landing_url=excluded.landing_url,
  channels=excluded.channels,
  tags=excluded.tags,
  usage_notes=excluded.usage_notes,
  priority=excluded.priority,
  is_active=excluded.is_active,
  updated_at=now();

insert into public.promotion_copy_materials (
  material_key, segment, audience, copy_type, title, pain_point, desire,
  headline, body, short_line, cta, landing_url, channels, tags, usage_notes, priority, is_active
) values (
  'focus_execution_better_self',
  'young_focus',
  'student',
  'poster',
  '成就更出色的自己',
  '专注力和执行力欠缺，想做的事很多，真正完成的太少。',
  '渴望成就感，渴望有人稳定陪自己把目标推进到底。',
  '成就更出色的自己。',
  '不是你不够好，很多时候只是没人陪你把事情推进到底。华伴始终陪着你，把目标拆小，把下一步说清楚，把事情持续往前推。让每一次开始，都更接近完成。',
  '华伴，陪你把想法推进成结果。',
  '把一个目标交给华伴试试。',
  'https://www.huabanapp.com/?ref=focus_better_self',
  '["poster","xiaohongshu","student_groups","video"]'::jsonb,
  '["focus","execution","achievement","self_growth"]'::jsonb,
  '适合专注力、执行力、拖延、自我提升人群；不要鸡血，要给温柔但确定的推进感。',
  30,
  true
)
on conflict (material_key) do update set
  segment=excluded.segment,
  audience=excluded.audience,
  copy_type=excluded.copy_type,
  title=excluded.title,
  pain_point=excluded.pain_point,
  desire=excluded.desire,
  headline=excluded.headline,
  body=excluded.body,
  short_line=excluded.short_line,
  cta=excluded.cta,
  landing_url=excluded.landing_url,
  channels=excluded.channels,
  tags=excluded.tags,
  usage_notes=excluded.usage_notes,
  priority=excluded.priority,
  is_active=excluded.is_active,
  updated_at=now();

insert into public.promotion_copy_materials (
  material_key, segment, audience, copy_type, title, pain_point, desire,
  headline, body, short_line, cta, landing_url, channels, tags, usage_notes, priority, is_active
) values (
  'anti_algorithm_quiet_autonomy',
  'young_focus',
  'student',
  'social_post',
  '不被算法拖走',
  '本来只想办一件事，却被红点、广告、推荐流和碎片信息拖走。',
  '想静静做自己想做的事，想要不被操控的自主感。',
  '不想被红点、广告和推荐流拖着走？',
  '本来只想办点事，却一头扎进信息碎片里。华伴 AI+，你主动，它才出现。学习、生活、行程、情绪和创意，都可以先跟华伴聊。一个安静、有用、听你指挥的 AI 工具。',
  '你主动，它才出现。',
  '试试华伴 AI+。',
  'https://www.huabanapp.com/?ref=student_free',
  '["xiaohongshu","student_groups","moments","short_video"]'::jsonb,
  '["anti_algorithm","red_dot","attention","autonomy"]'::jsonb,
  '适合年轻人、留学生、独居和讨厌信息流打扰的人群。',
  40,
  true
)
on conflict (material_key) do update set
  segment=excluded.segment,
  audience=excluded.audience,
  copy_type=excluded.copy_type,
  title=excluded.title,
  pain_point=excluded.pain_point,
  desire=excluded.desire,
  headline=excluded.headline,
  body=excluded.body,
  short_line=excluded.short_line,
  cta=excluded.cta,
  landing_url=excluded.landing_url,
  channels=excluded.channels,
  tags=excluded.tags,
  usage_notes=excluded.usage_notes,
  priority=excluded.priority,
  is_active=excluded.is_active,
  updated_at=now();

insert into public.promotion_copy_materials (
  material_key, segment, audience, copy_type, title, pain_point, desire,
  headline, body, short_line, cta, landing_url, channels, tags, usage_notes, priority, is_active
) values (
  'family_ai_not_left_behind',
  'family_ai',
  'family',
  'social_post',
  '全家用 AI',
  'AI 页面复杂，年长者不敢用，家庭消息容易被群聊和红点淹没。',
  '希望一家人都能简单、安全、私密地用上 AI，不被时代落下。',
  '全家用 AI，就用华伴 AI+。',
  '爸爸、妈妈、宝宝，都可以先跟华伴聊一句。家里的提醒、学习、行程、购物和联系家人，都能慢慢理顺。没有一排排红点，不催促，不替你决定。需要时出现，不需要时安静待着。',
  '带家人用上 AI，不被时代落下。',
  '欢迎全家一起试试。',
  'https://www.huabanapp.com/?ref=family_ai',
  '["wechat_parent_groups","moments","family_groups","poster"]'::jsonb,
  '["family","ai_literacy","privacy","low_disturbance"]'::jsonb,
  '适合妈妈群、家长群、家庭用户；不要制造焦虑，强调简单和安心。',
  50,
  true
)
on conflict (material_key) do update set
  segment=excluded.segment,
  audience=excluded.audience,
  copy_type=excluded.copy_type,
  title=excluded.title,
  pain_point=excluded.pain_point,
  desire=excluded.desire,
  headline=excluded.headline,
  body=excluded.body,
  short_line=excluded.short_line,
  cta=excluded.cta,
  landing_url=excluded.landing_url,
  channels=excluded.channels,
  tags=excluded.tags,
  usage_notes=excluded.usage_notes,
  priority=excluded.priority,
  is_active=excluded.is_active,
  updated_at=now();

insert into public.promotion_copy_materials (
  material_key, segment, audience, copy_type, title, pain_point, desire,
  headline, body, short_line, cta, landing_url, channels, tags, usage_notes, priority, is_active
) values (
  'private_family_local_circle',
  'family_ai',
  'family',
  'poster',
  '一家人的悄悄话',
  '熟人聊天和本地连接混在一起，好友列表、红点、群消息让重要联系被淹没。',
  '希望家人和当地朋友联系更私密、更安静、更容易找到。',
  '一家人的悄悄话。私密，不被淹没。',
  '微信联系熟人，华伴连接家人和当地朋友。想联系谁，直接告诉华伴；想不起名字时，再打开好友列表。真正做到非必要，少打扰。',
  '微信联系熟人，华伴连接当地朋友。',
  '添加家人或当地好友。',
  'https://www.huabanapp.com/?ref=local_circle',
  '["homepage","poster","family_groups","local_groups"]'::jsonb,
  '["local_circle","privacy","family_chat","no_red_dot"]'::jsonb,
  '适合通讯功能、扫码加好友、家庭套餐和本地圈子推广。',
  60,
  true
)
on conflict (material_key) do update set
  segment=excluded.segment,
  audience=excluded.audience,
  copy_type=excluded.copy_type,
  title=excluded.title,
  pain_point=excluded.pain_point,
  desire=excluded.desire,
  headline=excluded.headline,
  body=excluded.body,
  short_line=excluded.short_line,
  cta=excluded.cta,
  landing_url=excluded.landing_url,
  channels=excluded.channels,
  tags=excluded.tags,
  usage_notes=excluded.usage_notes,
  priority=excluded.priority,
  is_active=excluded.is_active,
  updated_at=now();

insert into public.promotion_copy_materials (
  material_key, segment, audience, copy_type, title, pain_point, desire,
  headline, body, short_line, cta, landing_url, channels, tags, usage_notes, priority, is_active
) values (
  'supplier_strength_needed_answer',
  'supplier_income',
  'supplier',
  'social_post',
  '你的强项也许正被寻找',
  '有手艺、有资源、有服务能力，却只被熟人知道；发广告又怕打扰别人。',
  '希望被需要，也希望被需要能够变成收入和事业机会。',
  '你熟视无睹的强项，也许正是 TA 苦苦寻觅的答案。',
  '会开车、会修东西、会做饭、会教孩子、会报税、会翻译、会做设计、会跑腿？这些在海外不是小事。告诉华伴你会什么、在哪、什么时候方便。有人真正需要时，华伴让你被看见。不刷屏，不乱发广告。被需要，也可以变成收入。',
  '被需要，也可以变成收入。',
  '把你能提供的告诉华伴。',
  'https://www.huabanapp.com/?ref=supplier_income',
  '["service_groups","driver_groups","restaurant_groups","xiaohongshu","moments"]'::jsonb,
  '["supplier","income","skills","needed"]'::jsonb,
  '适合服务者、手艺人、司机、餐饮、专业人士；不要承诺收益。',
  70,
  true
)
on conflict (material_key) do update set
  segment=excluded.segment,
  audience=excluded.audience,
  copy_type=excluded.copy_type,
  title=excluded.title,
  pain_point=excluded.pain_point,
  desire=excluded.desire,
  headline=excluded.headline,
  body=excluded.body,
  short_line=excluded.short_line,
  cta=excluded.cta,
  landing_url=excluded.landing_url,
  channels=excluded.channels,
  tags=excluded.tags,
  usage_notes=excluded.usage_notes,
  priority=excluded.priority,
  is_active=excluded.is_active,
  updated_at=now();

insert into public.promotion_copy_materials (
  material_key, segment, audience, copy_type, title, pain_point, desire,
  headline, body, short_line, cta, landing_url, channels, tags, usage_notes, priority, is_active
) values (
  'business_demand_finds_you',
  'supplier_income',
  'business',
  'headline',
  '让更多需求找到你',
  '小生意、手艺和资源难以被看见，推广成本高，客户线索散。',
  '希望事业成型，被真正需要的人找到，并推向更大的市场。',
  '让更多需求找到你。',
  '华伴能当你的事业助手：把能力、产品和服务整理清楚，打磨介绍，生成推广内容，记录线索。让事业成型，并推向更大的市场。',
  '让事业成型，并推向更大的市场。',
  '把你的事业交给华伴整理。',
  'https://www.huabanapp.com/?ref=supplier_income',
  '["homepage","business_groups","poster","short_video"]'::jsonb,
  '["business","demand","promotion","growth"]'::jsonb,
  '适合事业型用户、商家入驻、个人名片、推广视频和官网身份页。',
  80,
  true
)
on conflict (material_key) do update set
  segment=excluded.segment,
  audience=excluded.audience,
  copy_type=excluded.copy_type,
  title=excluded.title,
  pain_point=excluded.pain_point,
  desire=excluded.desire,
  headline=excluded.headline,
  body=excluded.body,
  short_line=excluded.short_line,
  cta=excluded.cta,
  landing_url=excluded.landing_url,
  channels=excluded.channels,
  tags=excluded.tags,
  usage_notes=excluded.usage_notes,
  priority=excluded.priority,
  is_active=excluded.is_active,
  updated_at=now();

insert into public.promotion_copy_materials (
  material_key, segment, audience, copy_type, title, pain_point, desire,
  headline, body, short_line, cta, landing_url, channels, tags, usage_notes, priority, is_active
) values (
  'merchant_decentralized_no_commission',
  'merchant',
  'supplier',
  'slogan',
  '去中心化，不抽佣',
  '商家和服务者被平台抽佣、绑架流量、难以沉淀自己的客户。',
  '希望直接连接真实需求，拥有自己的客户和口碑。',
  '去中心化，不抽佣。',
  '华伴不是中间抽佣平台。商家、司机、餐馆、配送和服务者可以直接面对真实需求，华伴整理服务内容、可信证据和客户线索，让需要的人遇见能提供的人。',
  '不是抽佣平台，是需求连接工具。',
  '告诉华伴你能提供什么。',
  'https://www.huabanapp.com/?ref=supplier_income',
  '["merchant_groups","driver_groups","restaurant_groups","service_groups"]'::jsonb,
  '["merchant","no_commission","decentralized","subscription"]'::jsonb,
  '对商户和服务者使用；不能承诺固定收入。',
  90,
  true
)
on conflict (material_key) do update set
  segment=excluded.segment,
  audience=excluded.audience,
  copy_type=excluded.copy_type,
  title=excluded.title,
  pain_point=excluded.pain_point,
  desire=excluded.desire,
  headline=excluded.headline,
  body=excluded.body,
  short_line=excluded.short_line,
  cta=excluded.cta,
  landing_url=excluded.landing_url,
  channels=excluded.channels,
  tags=excluded.tags,
  usage_notes=excluded.usage_notes,
  priority=excluded.priority,
  is_active=excluded.is_active,
  updated_at=now();

insert into public.promotion_copy_materials (
  material_key, segment, audience, copy_type, title, pain_point, desire,
  headline, body, short_line, cta, landing_url, channels, tags, usage_notes, priority, is_active
) values (
  'creative_director_script_image_video',
  'creator',
  'creator',
  'poster',
  '你负责创意，华伴来完成',
  '有想法，但写不出文案、做不成脚本、图片和视频。',
  '希望把灵感快速变成作品、海报、短视频和产品介绍。',
  '你负责创意，华伴来完成。',
  '一句模糊的想法，也可以先交给华伴。文案、标题、分镜、图片提示词、视频脚本和产品介绍，华伴先整理成可修改的草稿。你负责方向，华伴来执行细节。',
  '把想法变成作品。',
  '打开创意制作工具。',
  'https://www.huabanapp.com/?ref=creative_director',
  '["creator_groups","xiaohongshu","homepage","video_workspace"]'::jsonb,
  '["creator","copywriting","image_prompt","video_script"]'::jsonb,
  '适合创意总监形象、脚本工作台、海报和视频制作场景。',
  100,
  true
)
on conflict (material_key) do update set
  segment=excluded.segment,
  audience=excluded.audience,
  copy_type=excluded.copy_type,
  title=excluded.title,
  pain_point=excluded.pain_point,
  desire=excluded.desire,
  headline=excluded.headline,
  body=excluded.body,
  short_line=excluded.short_line,
  cta=excluded.cta,
  landing_url=excluded.landing_url,
  channels=excluded.channels,
  tags=excluded.tags,
  usage_notes=excluded.usage_notes,
  priority=excluded.priority,
  is_active=excluded.is_active,
  updated_at=now();

insert into public.promotion_copy_materials (
  material_key, segment, audience, copy_type, title, pain_point, desire,
  headline, body, short_line, cta, landing_url, channels, tags, usage_notes, priority, is_active
) values (
  'overseas_problem_clear_next_step',
  'overseas_life',
  'general',
  'social_post',
  '人在海外，有事叫华伴',
  '人在海外遇到电工、水管、律师、会计、出行、餐馆等问题时，搜索结果广告太多，不知道信谁。',
  '希望不用被信息淹没，直接获得清楚可靠的下一步。',
  '人在海外，有事叫华伴。',
  '不是更多广告，而是更清楚的下一步。遇到出行、生活、专业服务、本地咨询、餐饮外卖和商品需求，先跟华伴说。华伴来整理情况、核验重点、给出可选择结果。',
  '不是更多广告，是更清楚的下一步。',
  '说一件真实的小事试试。',
  'https://www.huabanapp.com/?ref=overseas_life',
  '["wechat_groups","google_landing","homepage","poster"]'::jsonb,
  '["overseas","life_service","trust","next_step"]'::jsonb,
  '适合海外生活通用推广和 Google 官网落地页。',
  110,
  true
)
on conflict (material_key) do update set
  segment=excluded.segment,
  audience=excluded.audience,
  copy_type=excluded.copy_type,
  title=excluded.title,
  pain_point=excluded.pain_point,
  desire=excluded.desire,
  headline=excluded.headline,
  body=excluded.body,
  short_line=excluded.short_line,
  cta=excluded.cta,
  landing_url=excluded.landing_url,
  channels=excluded.channels,
  tags=excluded.tags,
  usage_notes=excluded.usage_notes,
  priority=excluded.priority,
  is_active=excluded.is_active,
  updated_at=now();

insert into public.promotion_copy_materials (
  material_key, segment, audience, copy_type, title, pain_point, desire,
  headline, body, short_line, cta, landing_url, channels, tags, usage_notes, priority, is_active
) values (
  'series_have_a_matter_call_huaban',
  'video_series',
  'mixed',
  'video_script',
  '系列短剧：有事，叫华伴',
  '不同人群都有真实痛点：红点打扰、AI 难用、生意没人知道、家人消息淹没、平台抽佣、创意卡住、海外找人难。',
  '希望通过真实场景快速理解华伴能做什么。',
  '系列名：有事，叫华伴。',
  '第1集：本来只想打个电话。痛点：红点和推荐流拖走注意力。华伴：你刚才想联系谁？我来打开对话。第2集：爸妈也能用 AI。痛点：AI 太复杂。华伴：我来记提醒，也可以直接问家人。第3集：你的强项，可能正被人找。痛点：有手艺却没人知道。华伴：我来整理服务范围、时间和介绍。第4集：一家人的悄悄话。痛点：重要家人消息被淹没。华伴：我来打开你和 TA 的对话。第5集：生意不是发广告。痛点：平台抽佣和广告无效。华伴：我来整理菜单、价格和配送方式。第6集：创意不再卡住。痛点：有想法但写不出来。华伴：让我来写脚本。第7集：别在海外一个人硬扛。痛点：搜索广告太多不知道信谁。华伴：我来整理情况，先判断紧急程度，再找可核验选择。',
  '真实痛点突然被华伴接住。',
  '看 15 秒懂华伴。',
  'https://www.huabanapp.com/video.html',
  '["short_video","official_site","xiaohongshu","wechat"]'::jsonb,
  '["video_series","pain_points","scenario","story"]'::jsonb,
  '用于连续短剧、分镜扩展和视频工作台。每集可独立拆成 15-30 秒。',
  120,
  true
)
on conflict (material_key) do update set
  segment=excluded.segment,
  audience=excluded.audience,
  copy_type=excluded.copy_type,
  title=excluded.title,
  pain_point=excluded.pain_point,
  desire=excluded.desire,
  headline=excluded.headline,
  body=excluded.body,
  short_line=excluded.short_line,
  cta=excluded.cta,
  landing_url=excluded.landing_url,
  channels=excluded.channels,
  tags=excluded.tags,
  usage_notes=excluded.usage_notes,
  priority=excluded.priority,
  is_active=excluded.is_active,
  updated_at=now();
