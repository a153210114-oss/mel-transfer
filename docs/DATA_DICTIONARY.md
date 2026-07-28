# 数据字典

## 用户与身份

- `hb_users`：账号主体，保存手机号、状态、最后登录时间。
- `hb_identity_codes`：用户短身份码，用于展示、搜索和二维码名片。
- `hb_profiles`：个人资料，包括昵称、头像、城市、简介和语言。
- `hb_location_addresses`：统一结构化地址对象。老系统坐标、用户资料、动态、小店和需求卡都可挂到这里；保存 `lat/lng`、国家、省州、城市、区域、街名、门牌、邮编、`formatted_address`、`place_id`、来源、精度、可见级别和用户确认状态。
- `hb_ai_companions`：用户自己的 AI 伙伴设置，包括名字、形象、活泼程度、语气和节日皮肤。
- `hb_cards`：公开名片，承载二维码、可见性、行业和兴趣标签。

## 关系与通讯

- `hb_friendships`：好友关系与关注关系。
- `hb_referral_events`：推荐关系事件。被推荐人只能绑定一次推荐来源，重复提交通过 `idempotency_key` 幂等处理。
- `hb_friend_notes`：备注名、好友地域分组、标签、来源和运营备注。`geo_group` 固定为 `local` 当地、`remote_domestic` 异地、`overseas` 异国。
- `hb_messages`：好友之间的文本、语音、图片消息。

## 内容流

- `hb_city_posts`：统一动态主表。朋友圈式图文、视频号式视频、附近动态、个人主页动态都走这一张表和同一个 `/dynamics` 接口，通过 `dynamic_type` 与 `media_type` 区分。
- `hb_post_media`：动态媒体。
- `hb_post_actions`：点赞、收藏、关注和评论入口事件。
- `hb_admin_review_queue`：后台审核队列，统一承接动态、评论、资料、AI 形象、小店服务卡、自动化输出和积分异常。
- `hb_moderation_events`：内容安全事件流水，记录预检、举报、自动巡检、人工审核、申诉、处置和回滚。
- `hb_content_reports`：用户举报记录，关联被举报的动态、资料、服务卡、聊天消息或自动化输出。
- `hb_moderation_appeals`：用户对审核/处置结果的申诉记录。

## 增长与自动化

- `hb_points_events`：积分权益流水，记录内容、关系、邀请、反馈、共创等增长燃料。每条流水必须有唯一 `event_key`，后台只统计 `confirmed` 进入有效积分。
- `hb_user_growth_profiles`：用户积分档案，保存有效积分、释放档位和贡献分。
- `hb_founder_system_accrual`：创始人账号系统入账记录。用户侧有效释放 2 分，创始人与系统建设账户自动获得 1 分。
- `hb_co_creation_tasks`：共创任务，例如邀请新用户、整理城市内容、提交反馈、组织活动。
- `hb_ai_logs`：AI 调用、输入摘要、输出摘要与状态。
- `hb_ai_intents`：AI 意图库，定义简单提示词、多步骤任务和语义任务的槽位、动作计划、安全等级。
- `hb_ai_action_catalog`：AI 可操控功能键目录，覆盖用户端、后台和自动化里的按钮、菜单、开关、提交、保存、发布和发送动作。
- `hb_ai_training_samples`：AI 语音/文字训练样本，保存用户口语表达、标准意图、槽位、预期动作和安全预期。
- `hb_ai_action_runs`：AI 操作运行记录，记录用户输入、语义解析、动作计划、确认/审核/授权状态和执行结果。
- `hb_subscription_plans`：AI 执行能力订阅档位，定义免费、增强、创作、商家、运营等能力边界。
- `hb_user_subscriptions`：用户订阅状态，记录档位、有效期、来源、暂停、过期和撤销。
- `hb_plugin_catalog`：收费/预留插件目录，例如语音操控增强、图文视频生成、表单、小店 API、n8n 自动化。
- `hb_user_plugin_entitlements`：用户插件权益，记录插件 key、套餐、额度、已用量、有效期和状态。
- `hb_plugin_usage_events`：插件用量事件，记录每次 AI 执行或生成消耗的插件、单位、账单状态和关联对象。
- `hb_release_versions`：版本更新与新功能预览计划，记录版本 key、类型、AI 解释、灰度范围和可选/强制策略。
- `hb_release_videos`：版本更新展示视频，绑定版本、封面、时长、标题和状态。
- `hb_user_release_choices`：用户版本选择记录，保存体验新版、保持当前、稍后提醒、开通插件或回滚。
- `hb_release_delivery_events`：版本更新触达事件，记录消息送达、打开、视频播放和选择行为。
- `hb_automation_jobs`：n8n 或后端自动化任务记录。
- `hb_supply_profiles`：供给侧资料池，迁回旧版公开资料、用户提交名片、行业服务能力和联系方式。
- `hb_supply_collection_tasks`：供给采集任务池，供雷达随机挑选和后台手动采集使用。
- `hb_supply_radar_state`：供给雷达启用、冷却、概率、最近运行/跳过原因。
- `hb_demand_cards`：用户真实需求卡，用于 AI 整理、人工复核和供需匹配。
- `hb_site_content`：官网内容草稿和发布版本。
- `hb_site_events`：官网访问、点击、来源和设备日志。

## 位置与地址

老系统只有坐标时，不直接把坐标当成最终地址。迁移流程为：

1. 继续保留 `latitude` / `longitude`。
2. 调用 Google Geocoding API 反向解析，写入 `hb_location_addresses`。
3. `address_verified = false`，`verification_status = needs_user_confirmation`。
4. 前端提示用户确认或补充门牌、街名、区域。
5. 公开展示按 `visibility_level` 分层：公开动态默认展示城市/区域，小店和到店服务在授权后展示更精确地址，后台可审计完整地址对象。

产品交互要求：

- Google 地图本身有地址标注能力，但部分中文用户不会准确使用。
- 华伴允许用户只发送定位、输入模糊地址或说“我在附近/这个店旁边”。
- AI 根据坐标和文本调用 Google Map 生成候选地址。
- 用户只需选择“这个地址正确 / 只显示大概区域 / 我要修改门牌街名”。
- 未确认前，地址对象只能作为 `needs_user_confirmation` 使用，不能当成精确公开地址。

迁移命令：

```bash
npm run locations:reverse-geocode -- --limit=50
npm run locations:reverse-geocode -- --limit=50 --write
```

需要环境变量：

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_MAPS_API_KEY`
