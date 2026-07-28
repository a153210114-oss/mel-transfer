# API Contract

Base path: `/api/v1`

认证方式先按 `Authorization: Bearer <token>` 预留。第一阶段可用 mock token 打通端到端流程。

## External Integrations

V1.1 当前确认的外部接口只有两个：

| 接口 | 用途 | 环境变量建议 |
| --- | --- | --- |
| Google Map | 地图、地址、距离、附近范围、城市定位 | `GOOGLE_MAPS_API_KEY` |
| 手机号验证 | 注册、登录、身份码绑定、账号找回 | `PHONE_VERIFY_PROVIDER`、`PHONE_VERIFY_API_KEY`、`PHONE_VERIFY_SENDER_ID` |

其他外部 API 暂不作为第一阶段生产依赖。小店/API 自动化可以先保存授权配置、字段映射和待审核状态，等后台确认后再接具体供应商。

Google Map 使用边界：

- 前端只使用被域名和 API 类型限制的公开 Key。
- 后端反向解析、批量迁移、Places 搜索使用服务端环境变量，不把 Key 写入前端。
- Google 返回的数据必须标记 `addressSource = reverse_geocode | google_place`。
- 坐标反解出的门牌、街名、区域需要用户确认后才视为精确地址。
- 公开展示默认降级到城市/区域；完整地址仅在用户授权、服务履约或后台审计场景显示。
- Google 地图本身支持地址标注，但部分中文用户不会准确使用；华伴前端要提供“AI 帮我补全地址 / 只显示大概区域 / 我来手动修改”的确认流程。

## AI Model Slots

当前 AI 能力按 6 个模型位管理：

| 模型位 | 用途 |
| --- | --- |
| `conversation_assistant` | 日常对话、页面控制、功能解释 |
| `publish_composer` | 动态配文、标题、标签、可见范围建议 |
| `local_search` | 附近动态、名片、市集和服务线索搜索 |
| `relation_recommender` | 好友推荐、共同兴趣、地域分组、推荐理由 |
| `review_risk` | 内容审核建议、积分异常、服务卡风险提示 |
| `automation_designer` | 小店 API 字段映射、n8n 工作流草稿、运行摘要 |

模型位是产品职责划分，不要求第一阶段必须使用 6 个不同底层模型。后台要按模型位记录 Prompt、调用日志、输入输出摘要、错误和人工接管状态。

## Auth

### POST `/auth/send-code`

发送验证码。

```json
{
  "phoneE164": "+61400000000"
}
```

Response:

```json
{
  "ok": true,
  "cooldownSeconds": 60
}
```

### POST `/auth/verify-code`

校验验证码并创建或同步身份码。

```json
{
  "phoneE164": "+61400000000",
  "code": "123456"
}
```

Response:

```json
{
  "token": "mock.jwt",
  "user": {
    "id": "uuid",
    "identityCode": "HB123456",
    "isNew": true
  }
}
```

身份码确定性要求：

- 手机号验证成功后只允许绑定到一个用户。
- 个人身份码全局唯一，不能复用。
- 身份码作废只能变更状态，不能删除历史。

## Referral

推荐关系在用户首次有效绑定时确定，之后不能静默改绑。

### POST `/referrals/bind`

```json
{
  "inviterCode": "HB110001",
  "refereeCode": "HB110517",
  "source": "qr_open",
  "idempotencyKey": "hb_v1_1:referral:HB110001:HB110517"
}
```

规则：

- `refereeCode` 只能绑定一次推荐来源。
- `inviterCode` 不能等于 `refereeCode`。
- 重复请求必须返回同一结果，不能重复入账。
- 直接推荐和二级推荐积分由后台/n8n 根据确认后的推荐事件发放。

## Profile And Card

### GET `/me`

获取当前用户资料、名片、积分摘要。

### PATCH `/me/profile`

```json
{
  "displayName": "小华",
  "avatarUrl": "https://example.com/avatar.jpg",
  "city": "Melbourne",
  "location": {
    "latitude": -37.8136,
    "longitude": 144.9631,
    "formattedAddress": "Melbourne VIC, Australia",
    "placeId": "google_place_id",
    "visibilityLevel": "city",
    "addressVerified": false
  },
  "bio": "刚到墨尔本，喜欢咖啡和徒步。",
  "languages": ["zh-CN", "en"]
}
```

用户头像可编辑。公开头像变更需要写入审核记录，确保身份码、推荐关系和积分流水仍可追踪。

位置字段规则：

- `latitude` / `longitude` 是底层定位依据。
- `formattedAddress` 是展示地址，不等同于已确认精确地址。
- `placeId` 优先保存 Google Place ID，便于后续更新和去重。
- `visibilityLevel` 可选：`private`、`friends`、`city`、`public`、`admin_only`。
- 新版本优先直接调用 Google Map；老数据只有坐标时，只作为历史补全来源，后端批量反解后写入 `hb_location_addresses`，并要求用户确认。
- 用户不会使用 Google 地址标注时，可以只发定位或输入模糊地址，由 AI 调用 Google Map 解析后给出候选地址，再让用户一键确认或修改。

### POST `/locations`

统一位置入口。服务端调用 Google Geocoding API，支持搜索地点、坐标反查和确认保存。生产环境应限制调用频率和权限。

Search request:

```json
{
  "action": "search",
  "query": "Glen Waverley 咖啡",
  "city": "Melbourne"
}
```

Reverse geocode request:

```json
{
  "action": "reverse_geocode",
  "latitude": -37.8136,
  "longitude": 144.9631
}
```

Save request:

```json
{
  "action": "save",
  "entityType": "user_profile",
  "friendCode": "HB110001",
  "confirmed": true,
  "visibilityLevel": "city"
}
```

Response:

```json
{
  "results": [
    {
    "country": "Australia",
    "state": "VIC",
    "city": "Melbourne",
    "suburb": "Melbourne",
    "street": "",
    "streetNumber": "",
    "postalCode": "3000",
    "formattedAddress": "Melbourne VIC 3000, Australia",
    "placeId": "google_place_id",
    "addressSource": "reverse_geocode",
    "precisionLevel": "city",
    "addressVerified": false,
    "verificationStatus": "needs_user_confirmation"
    }
  ],
  "location": {
    "id": "uuid"
  }
}
```

## AI Companion

每个用户可以配置自己的 AI 伙伴。AI 伙伴支持起名、换形象、调活泼程度和节日皮肤。

### GET `/me/ai-companion`

```json
{
  "name": "小伴",
  "avatarUrl": "/assets/brand/huaban-logo-v1.png",
  "imageStyle": "huaban_default",
  "liveliness": "lively",
  "tone": "warm_action",
  "holidaySkin": {
    "enabled": false,
    "skinKey": "",
    "startsAt": null,
    "endsAt": null
  },
  "reviewStatus": "approved"
}
```

### PATCH `/me/ai-companion`

```json
{
  "name": "小伴",
  "avatarUrl": "https://example.com/my-ai.png",
  "imageStyle": "custom",
  "liveliness": "very_lively",
  "tone": "humorous",
  "holidaySkin": {
    "enabled": true,
    "skinKey": "winter_scarf"
  }
}
```

`liveliness` 可选：

- `quiet`
- `natural`
- `lively`
- `very_lively`

AI 形象如果用于公开名片、动态或分享页，需要进入后台审核队列。

### GET `/cards/:userId`

查看作者名片。

### PATCH `/me/card`

更新自己的公开名片。

```json
{
  "title": "墨尔本生活搭子",
  "industryTags": ["留学", "本地生活"],
  "interestTags": ["咖啡", "徒步"],
  "visibility": "city"
}
```

## Dynamics

朋友圈、视频号、附近动态、个人主页动态统一为一个动态接口。用 `dynamicType` 和 `mediaType` 区分内容形态，不拆成多套接口。

### GET `/dynamics?city=Melbourne&scope=nearby&cursor=...`

返回动态流。

`scope` 可选：

- `nearby`：附近动态
- `profile`：个人主页动态
- `following`：关注动态
- `recommended`：AI 推荐动态

### POST `/dynamics`

发布动态。

```json
{
  "city": "Melbourne",
  "dynamicType": "note",
  "mediaType": "image",
  "content": "今天在 Carlton 发现一家适合聊天的咖啡店。",
  "media": [
    {
      "mediaType": "image",
      "url": "https://example.com/photo.jpg"
    }
  ],
  "tags": ["咖啡", "Carlton"]
}
```

`dynamicType` 可选：

- `note`：图文动态
- `video`：视频动态
- `question`：提问
- `notice`：公告

`mediaType` 可选：

- `text`
- `image`
- `video`

媒体数量规则：

- `image`：最多 6 张，前端只展示当前主图，多图用圆点分页提示左右滑动。
- `video`：只能 1 个视频，不和多图混排；基础版视频时长上限 15 秒。

### POST `/dynamics/:dynamicId/actions`

点赞、收藏、关注作者或评论。

```json
{
  "actionType": "comment",
  "commentBody": "求店名！"
}
```

## Friendships

### POST `/friendships`

添加好友。

```json
{
  "addresseeId": "uuid",
  "source": "city_post"
}
```

### GET `/friends`

获取好友列表，包含备注、标签、未读数。
好友地域分组固定为：

- `local`：当地
- `remote_domestic`：异地
- `overseas`：异国

### PATCH `/friends/:friendId/note`

```json
{
  "remarkName": "Carlton 咖啡搭子",
  "geoGroup": "local",
  "tags": ["咖啡", "同城"],
  "sourceNote": "来自附近动态",
  "privateNote": "聊过周末活动"
}
```

## Messages

### GET `/messages/:friendId?cursor=...`

获取聊天记录。

### POST `/messages/:friendId`

发送消息。

```json
{
  "messageType": "text",
  "body": "你好，我看到你发的 Carlton 咖啡动态。"
}
```

### POST `/messages/:friendId/read`

标记已读。

### GET `/releases/current`

获取当前用户可见的新版本、新功能预览和展示视频。

```json
{
  "releases": [
    {
      "releaseKey": "ai_form_builder_preview",
      "versionName": "AI 表单助手预览",
      "releaseType": "feature_preview",
      "rolloutPolicy": "optional",
      "summary": "一句话生成报名表、服务表和需求收集表。",
      "aiExplanation": "你可以先看 30 秒演示，再决定是否体验。",
      "videos": [
        {
          "videoUrl": "https://cdn.huabanapp.com/releases/ai-form-builder.mp4",
          "coverUrl": "https://cdn.huabanapp.com/releases/ai-form-builder.jpg",
          "durationSeconds": 30
        }
      ],
      "actions": ["try_now", "keep_current", "remind_later"]
    }
  ]
}
```

### POST `/releases/:releaseKey/choice`

用户选择是否体验、保持当前版本、稍后提醒、开通插件或回滚。

```json
{
  "choice": "try_now",
  "source": "message",
  "confirmationText": "我先试用新版表单"
}
```

### POST `/releases/:releaseKey/events`

记录版本更新触达、打开、视频观看和选择数据。

```json
{
  "channel": "message",
  "eventType": "video_completed",
  "eventPayload": {
    "durationWatchedSeconds": 28
  }
}
```

## Growth

### GET `/me/growth`

获取当前用户积分权益、释放档位、贡献值说明和可参与任务。

```json
{
  "pointsBalance": 1280,
  "releaseLevel": "L8",
  "releaseRatio": "1/128",
  "levelWeight": 128,
  "poolTotal": 42000000,
  "currentRoundPoints": 328125,
  "contributionFormula": "有效积分 × 释放等级权重 × 早期席位奖励",
  "tasks": [
    {
      "id": "task_invite_3",
      "title": "邀请 3 位华人朋友完成名片",
      "pointsReward": 120
    }
  ]
}
```

### POST `/growth/events`

记录积分事件。发布动态、互动、邀请、反馈、贡献任务完成都写入积分流水。

```json
{
  "eventKey": "hb_v1_1:HB110001:invite_verified_friend:identity:HB110517",
  "eventType": "invite_verified_friend",
  "growthChannel": "invitation",
  "pointsDelta": 40,
  "basePoints": 20,
  "status": "confirmed",
  "reason": "邀请好友完成二维码名片",
  "refType": "friendship",
  "refId": "uuid",
  "ownerCode": "HB110001",
  "relatedCode": "HB110517"
}
```

积分确定性要求：

- `eventKey` 必填且唯一，用于幂等入账。
- 前端不能直接改积分余额，只能提交积分事件。
- 后台只统计 `confirmed` 事件进入有效积分。
- 待人工审核的积分必须先写入 `pending_review`。
- 冲正必须保留流水，不能删除原事件。

### GET `/co-creation/tasks?city=Melbourne`

获取当前城市可参与的贡献任务。

## Admin Operations

后台第一阶段先实现管理中心和运营巡检闭环：后台可查看用户、动态、关系、城市内容、AI Prompt、自动化、积分等级和数据统计；巡检可由后台触发，服务端运行检查，结果回显，并写入自动化任务记录。

### GET `/admin/overview`

后台首页汇总。

```json
{
  "stats": {
    "users": 5,
    "dynamics": 2,
    "friendships": 0,
    "pendingReviews": 2,
    "automationJobs": 1,
    "aiPrompts": 2,
    "pointsBalance": 1280,
    "inspectionStatus": "ok"
  },
  "modules": []
}
```

### GET `/admin/users`

用户管理列表，包含状态、城市、好友地域分组和积分摘要。

### GET `/admin/dynamics`

动态管理列表。朋友圈、视频号、附近内容统一来自 `/dynamics`。

### GET `/admin/friendships`

名片关系管理，返回好友地域分组：当地、异地、异国。

### GET `/admin/city-content`

城市内容待审核队列。

### POST `/admin/city-content/review`

审核城市内容、服务名片或动态。

```json
{
  "id": "review_1",
  "status": "approved"
}
```

## Content Moderation

华伴内容审核参考 X 的分层治理方式：自动检测 + 用户举报 + 人工复核 + 申诉纠错 + 透明记录。

### POST `/moderation/precheck`

发布前预检动态、资料、小店服务卡、AI 生成文本或自动化输出。预检不等于最终审核，但会决定是否直接放行、提示修改、加标签、降推荐或进入人工审核。

```json
{
  "refType": "dynamic",
  "city": "Melbourne",
  "content": "今天在 Carlton 找到一家咖啡店。",
  "mediaType": "text",
  "sourcePage": "home_composer"
}
```

返回：

```json
{
  "ok": true,
  "riskCategory": "unknown",
  "riskLevel": "low",
  "riskScore": 0.08,
  "suggestedAction": "allow",
  "ageGateRequired": false,
  "audienceMinAge": null,
  "sensitiveReason": "",
  "userMessage": "可以发布。",
  "reviewRequired": false
}
```

`riskCategory` 可选：

- `illegal`
- `child_safety`
- `harassment`
- `hate`
- `privacy`
- `sexual`
- `violence`
- `self_harm`
- `regulated`
- `misleading`
- `ip_rights`
- `spam_abuse`
- `unknown`

`suggestedAction` 可选：

- `allow`
- `user_warning`
- `sensitive_label`
- `age_gate`
- `limit_visibility`
- `hold_for_review`
- `remove_content`
- `lock_feature`
- `verify_identity`
- `freeze_points`
- `escalate_human`

### 成人与儿童内容展示

成人合法敏感内容可以走年龄门槛：

```json
{
  "riskCategory": "sexual",
  "riskLevel": "medium",
  "suggestedAction": "age_gate",
  "ageGateRequired": true,
  "audienceMinAge": 18,
  "sensitiveReason": "adult_sensitive_content",
  "userMessage": "此内容可能不适合所有人，确认已成年后可查看。"
}
```

前端展示：

```text
内容遮挡 → 敏感提示 → 成年证明/年龄确认 → 用户主动打开
```

未成年人风险内容不能通过成年证明打开：

```json
{
  "riskCategory": "child_safety",
  "riskLevel": "critical",
  "suggestedAction": "hold_for_review",
  "ageGateRequired": false,
  "reviewRequired": true,
  "userMessage": "此内容涉及未成年人安全风险，不能展示。我们会交给人工复核。"
}
```

### POST `/content-reports`

用户举报动态、资料、服务卡、聊天消息或自动化输出。

```json
{
  "refType": "dynamic",
  "refId": "post_1",
  "reason": "scam",
  "note": "疑似虚假服务"
}
```

举报后写入 `hb_content_reports`，并生成 `hb_moderation_events`；高风险内容进入 `hb_admin_review_queue`。

### POST `/moderation/appeals`

用户对内容限制、移除、账号限制、积分冻结等处置结果发起申诉。

```json
{
  "reviewId": "review_1",
  "reason": "内容是正常活动介绍，愿意补充证明。"
}
```

### GET `/admin/moderation/queue`

后台审核队列。返回风险分类、风险等级、建议动作、AI 原因、用户举报、申诉状态和人工处置状态。

### POST `/admin/moderation/review`

后台人工处置。

```json
{
  "reviewId": "review_1",
  "finalAction": "limit_visibility",
  "status": "actioned",
  "reviewNote": "内容涉及高风险服务，限制推荐并要求补充资质。"
}
```

### GET `/admin/moderation/transparency`

审核透明度统计，用于后台日报：

- 自动预检数量。
- 用户举报数量。
- 各风险分类数量。
- 自动放行、提示修改、加标签、降推荐、人工审核、移除、申诉成功数量。
- 平均处理时间。

### GET `/admin/supply/profiles`

供给侧资料池。迁回旧版供给资料、手动录入、公开线索、用户提交名片和雷达入库资料。

### POST `/admin/supply/profiles`

手动添加供给方。用于朋友还没下载华伴时，先保存姓名、电话、行业、城市和备注，生成待认领供给资料。

```json
{
  "name": "李师傅机场接送",
  "contact": "+61400...",
  "serviceType": "接送机",
  "city": "Melbourne",
  "intro": "7 座车，需提前确认时间和行李"
}
```

### GET `/admin/supply/tasks`

供给采集任务池。雷达优先从任务池随机挑选待执行任务。

### GET `/admin/supply/processing`

待处理供给资料，例如图片识别、用户推荐、公开线索清洗结果。

### GET `/admin/supply/radar`

供给雷达状态：启用状态、最近运行、跳过原因、冷却时间、随机概率、每次任务数量。

### POST `/admin/supply/radar/tick`

手动触发雷达试扫。第一阶段 mock 会从采集任务池取一条任务，生成一条待审核供给资料，并写入自动化任务记录。

```json
{
  "force": true
}
```

### GET `/admin/demands`

需求卡列表。用于迁回旧版真实需求整理和供需匹配基础数据，不包含订单、合约或重交易履约流程。

### GET `/admin/website/content?page=official_home`

读取官网内容草稿或发布版本。第一阶段支持官网首页、规则边界、隐私政策、支持与反馈、APP 使用说明。

### POST `/admin/website/content`

保存官网草稿或发布版本。

```json
{
  "pageKey": "official_home",
  "publish": true,
  "content": {
    "heroTitle": "华伴 AI",
    "heroSubtitle": "一款内置 AI 的本地生活 App，帮助用户从海量信息中挣脱，重新专注自己的本地生活。与本地相连，与世界相通。"
  }
}
```

### GET `/admin/ai-prompts`

AI Prompt 管理列表。

### POST `/admin/ai-prompts`

更新 Prompt 文案或状态。

```json
{
  "id": "prompt_growth_explain",
  "body": "新的积分解释口径",
  "status": "active"
}
```

### GET `/admin/growth`

后台积分等级摘要，包含用户端规则和创始人系统入账摘要。

### GET `/admin/stats`

后台数据统计摘要。

### GET `/admin/ops-inspection`

获取最近一次运营巡检报告。如果服务端内存中还没有报告，会即时生成一份。

```json
{
  "generatedAt": "2026-07-27T00:00:00.000Z",
  "status": "ok",
  "summary": {
    "total": 10,
    "passed": 10,
    "failed": 0,
    "critical": 0,
    "warnings": 0
  },
  "checks": [],
  "nextActions": []
}
```

`status` 可选：

- `ok`：核心功能齐备。
- `warning`：有非关键提醒。
- `blocked`：关键项缺失，需要处理后再部署。

### POST `/admin/ops-inspection/run`

手动重新巡检。会生成 `tmp/ops-inspection-report.json`，并写入自动化任务记录。

### GET `/admin/automation-jobs`

获取最近自动化任务记录。

```json
{
  "jobs": [
    {
      "id": "job_1",
      "jobName": "HB11_06_Admin_Operation_Center",
      "status": "done",
      "payload": {
        "status": "ok"
      }
    }
  ]
}
```

### GET `/admin/n8n-workflows`

获取 n8n 工作流设计和运行状态。n8n 是后台审核通过后的自动化执行引擎，不绕过用户授权和人工审核。

```json
{
  "workflows": [
    {
      "workflowId": "n8n_shop_api_sync",
      "workflowName": "小店 API 同步",
      "triggerType": "Webhook / 后台审核",
      "ownerUserId": "me",
      "authorizationScope": "服务卡、库存、预约状态",
      "status": "draft",
      "lastRunAt": null,
      "lastResult": "等待商家授权和后台审核",
      "retryCount": 0,
      "rollbackNote": "未启用，无需回滚"
    }
  ]
}
```

状态值：

- `draft`：草稿，未接真实执行。
- `pending_review`：等待后台审核。
- `active`：已授权并启用。
- `paused`：暂停。
- `failed`：最近运行失败。
- `revoked`：授权已撤销。

## Founder System Accrual

### GET `/founder/system-accrual`

创始人账号的系统积分来源。创始人使用同一套积分等级体系，区别是系统自动按用户侧有效释放积分入账。

```json
{
  "founderPoints": 10000,
  "releaseLevel": "L8",
  "userReleasedPoints": 20000,
  "accrualRule": "用户侧有效释放 2 分，创始人与系统建设账户自动获得 1 分",
  "roundingRule": "不足 2 分的尾差继续累计，凑满 2 分后再入账 1 分"
}
```

含义：创始人账号看到 `10000` 分，表示用户侧有效释放已累计 `20000` 分。

## AI

### POST `/ai/compose-post`

整理动态文案。

```json
{
  "draft": "今天在 Carlton 咖啡店不错，适合聊天",
  "city": "Melbourne"
}
```

### POST `/ai/search-local`

AI 搜索附近内容、名片和本地服务。前端所有微信式/小红书式搜索入口都调用 AI，不做普通关键词搜索直连。

```json
{
  "query": "这周末有什么华人活动",
  "city": "Melbourne"
}
```

### POST `/ai/recommend-cards`

根据内容、城市、兴趣推荐名片。

```json
{
  "city": "Melbourne",
  "postId": "uuid",
  "interestTags": ["咖啡", "徒步"]
}
```

### GET `/subscriptions/plans`

返回当前可展示或预留的 AI 执行能力订阅档位。V1.1 可只展示低调说明，不接真实支付。

```json
{
  "plans": [
    {
      "planKey": "free",
      "planName": "基础版",
      "aiCapabilities": ["basic_chat", "open_pages", "basic_search"],
      "includedPlugins": [],
      "status": "active"
    },
    {
      "planKey": "creator",
      "planName": "创作版",
      "aiCapabilities": ["multi_step_action", "creative_generation", "form_builder"],
      "includedPlugins": ["copywriting_pro", "image_generation", "form_builder"],
      "status": "reserved"
    }
  ]
}
```

### GET `/me/subscription`

返回当前用户订阅档位、插件权益和额度。

```json
{
  "planKey": "free",
  "status": "active",
  "plugins": [
    {
      "pluginKey": "image_generation",
      "status": "trial",
      "quotaTotal": 3,
      "quotaUsed": 1,
      "expiresAt": null
    }
  ]
}
```

### GET `/plugins/catalog`

返回 AI 插件目录。插件可以是免费、试用、订阅内、按额度或预留状态。

```json
{
  "plugins": [
    {
      "pluginKey": "automation_builder",
      "pluginName": "自动化助手",
      "minPlanKey": "business",
      "pricingMode": "subscription",
      "requiresAuthorization": true,
      "requiresModeration": true,
      "status": "reserved"
    }
  ]
}
```

### POST `/plugins/usage/preview`

AI 执行收费能力前预估是否可用、是否消耗额度、是否需要确认。

```json
{
  "pluginKey": "form_builder",
  "actionType": "create_event_form",
  "units": 1,
  "refType": "dynamic"
}
```

返回：

```json
{
  "allowed": true,
  "billable": true,
  "confirmationRequired": true,
  "message": "这次操作会使用 1 次表单插件额度，确认后继续。",
  "quota": {
    "quotaTotal": 20,
    "quotaUsed": 3,
    "quotaRemaining": 17
  }
}
```

### POST `/plugins/usage/confirm`

用户确认后写入插件用量事件。确认可以来自按钮、文字或语音。

```json
{
  "pluginKey": "form_builder",
  "actionType": "create_event_form",
  "units": 1,
  "aiActionRunId": "uuid",
  "confirmationText": "可以，生成吧"
}
```

### POST `/ai/command`

AI 综合控制入口。语音召唤、文字指令和搜索框统一调用这个接口，由 AI 判断是打开页面、发布动态、搜索、匹配名片、打开左上角功能菜单，还是解释积分权益机制。

用户问到积分、等级、释放、权重、分配、候补、封顶、共创、共建时，AI 返回 `open_growth`，并按 `docs/AI_ASSISTANT_DUTIES.md` 的口径解释。

该接口同时承担华伴 AI 语音操控训练系统的运行入口。它要把用户输入分为三层：

- `function_key`：覆盖华伴全部功能键，每个按钮/菜单/开关/提交动作都有 `actionKey`。
- `single_action`：简单提示词，对应一个内部功能。
- `multi_step_action`：多个提示词，对应多个顺序动作。
- `semantic_task` / `creative_generation` / `form_builder` / `automation_builder`：语义理解后拆解执行。

AI 指令同时进入新手养成系统。用户使用提示词完成真实功能后，按难度指数获得积分，详见 `docs/AI_PROMPT_GROWTH_SYSTEM.md`。

| 难度 | 类型 | 示例 | 积分 |
| --- | --- | --- | --- |
| D1 | 单一功能提示词 | 打开地图导航、打开通讯录、我要发动态 | +2 |
| D2 | 同一意图多表达 | 我要跟 Owen 通话、找 Owen 语音、给 Owen 打电话 | +3 |
| D3 | 多步骤任务 | 打开通讯录，找到 Owen，拨打语音通话 | +6 |
| D4 | 生成类任务 | 生成动态文案、图片、视频、表单草稿 | +10 |
| D5 | 自动化任务 | 小店 API、n8n 工作流、表单同步和自动运行 | +20 |

入账规则：

- 必须完成真实动作，不能只输入提示词刷分。
- 同一用户、同一标准意图、同一天只奖励一次。
- 支付、实名、公开发布、外部 API 授权等高风险动作必须先确认或审核。
- 付费插件按订阅和额度计费，但付费本身不直接提高积分权重。

```json
{
  "text": "帮我匹配当地喜欢咖啡的新朋友",
  "city": "Melbourne",
  "inputMode": "voice",
  "context": {
    "currentPage": "homePage"
  }
}
```

返回动作示例：

```json
{
  "action": "match_cards",
  "intent": "match_local_cards",
  "complexity": "multi_step_action",
  "confidence": 0.88,
  "message": "已根据城市、兴趣和好友分组匹配名片。",
  "slots": {
    "city": "Melbourne",
    "interestTags": ["咖啡"],
    "geoScope": "local"
  },
  "actionPlan": [
    { "step": 1, "action": "search_cards", "status": "planned" },
    { "step": 2, "action": "rank_by_relation_and_interest", "status": "planned" },
    { "step": 3, "action": "open_recommendation_list", "status": "planned" }
  ],
  "requiresConfirmation": false,
  "requiresModeration": false,
  "requiresAuthorization": false,
  "pluginRequired": false,
  "cards": []
}
```

复杂动作示例：

```json
{
  "text": "帮我做一个周末咖啡局报名表",
  "city": "Melbourne",
  "inputMode": "voice"
}
```

返回：

```json
{
  "action": "create_form",
  "intent": "create_event_form",
  "complexity": "form_builder",
  "message": "我先帮你生成报名表草稿，发布前会让你确认。",
  "slots": {
    "city": "Melbourne",
    "topic": "周末咖啡局",
    "contentType": "form"
  },
  "actionPlan": [
    { "step": 1, "action": "open_form_builder" },
    { "step": 2, "action": "generate_form_fields" },
    { "step": 3, "action": "moderation_precheck" },
    { "step": 4, "action": "request_user_confirm" }
  ],
  "requiresConfirmation": true,
  "requiresModeration": true,
  "requiresAuthorization": false,
  "pluginRequired": true,
  "pluginKey": "form_builder",
  "billingConfirmationRequired": true,
  "usagePreview": {
    "units": 1,
    "unitType": "form",
    "billable": true,
    "message": "这次操作会使用 1 次表单插件额度，确认后继续。"
  },
  "finalExecution": {
    "mode": "ai_delegate_after_user_confirm",
    "allowed": true,
    "confirmationRequired": true
  }
}
```

训练与后台接口：

- `GET /admin/ai-action-catalog`：华伴全功能键目录。
- `POST /admin/ai-action-catalog`：新增或更新功能键、别名、页面和安全等级。
- `GET /admin/ai-intents`：意图库。
- `POST /admin/ai-intents`：新增或更新意图、槽位和默认动作计划。
- `GET /admin/ai-training-samples`：提示词训练样本。
- `POST /admin/ai-training-samples`：新增简单提示词、多提示词或语义任务样本。
- `GET /admin/ai-action-runs`：语音/文字命令执行记录、成功率、失败率、人工接管率。
- `GET /admin/subscription-plans`：订阅档位和 AI 能力边界。
- `POST /admin/subscription-plans`：新增或更新订阅档位、能力、插件和状态。
- `GET /admin/plugins`：插件目录、定价模式、最低档位、审核/授权要求。
- `POST /admin/plugins`：新增或更新插件配置。
- `GET /admin/plugin-entitlements`：用户插件开通、额度、有效期和状态。
- `GET /admin/plugin-usage`：插件用量、扣减、失败、回滚和收入统计预留。
- `GET /admin/releases`：版本更新、新功能预览、灰度和回滚状态。
- `POST /admin/releases`：创建或更新版本发布计划、AI 解释文案、功能 key、插件 key 和强制/可选策略。
- `POST /admin/releases/:releaseKey/videos`：绑定新功能展示视频、封面和字幕。
- `POST /admin/releases/:releaseKey/send-message`：通过首页消息列表发送版本更新或功能预览消息。
- `GET /admin/releases/:releaseKey/analytics`：查看送达、打开、视频播放、完成观看和用户选择数据。
