# LD_01 搜索结果分流规则

适用范围：所有 Agent、人工、外部 AI 搜索到的中文站点、社群、论坛、黄页、招聘页、服务页结果。

目标：不要把搜索结果一锅端进线索库。先判断是否符合当前需求，再决定进入哪一个后台队列。

## 两类结果

### 1. 符合需求：直接导入线索库

进入 `beta_leads` 或 `recruitment_leads`，作为可 review 的线索。

条件：

- 地区匹配：城市/国家与当前任务一致，或明确可服务该地区。
- 类型匹配：服务类型、需求类型和当前任务一致。
- 信息可核验：有公开来源链接、截图来源、公开联系方式、服务描述、时间或价格中的至少两项。
- 联系方式不违规：不能是猜测、打码补全、绕过登录得到的信息。
- 未明显过期：招聘/服务帖没有显著过期，或需要标记为“需确认是否仍有效”。

建议字段：

- `channel`: `driver_supply_intel | demand_supply_intel | public_source_intel`
- `stage`: `ld_01_ceo_review`
- `status`: `new`
- `score`: `A | B | C`
- `next_action`: `manual_contact_and_qualification_check | verify_source_and_match | research_company_contact`
- `fields.routing_result`: `direct_import`
- `fields.match_reason`: 符合原因
- `fields.source_url`: 来源链接
- `fields.source_platform`: 来源平台
- `fields.verification_status`: `verified_contact_from_public_listing | public_web_needs_verification | source_verified_but_contacts_masked`

### 2. 不符合当前需求但有价值：进入后台日常任务

不直接进入线索库，不给用户推荐。进入后台作为人工日常任务：人工注册、人工登录核验、继续搜索、渠道补充、过期判断。

条件：

- 地区不完全匹配，但可作为未来城市/渠道扩展。
- 服务类型不匹配，但属于华伴可扩展服务。
- 需要登录、加群、人工认证、人工搜索才能继续。
- 联系方式被打码、隐藏或需要点击登录后显示。
- 页面是渠道源，不是具体供给/需求。
- 信息太碎，暂不能给用户或服务者跟进。

建议字段：

- `channel`: `ld_01_daily_task`
- `stage`: `daily_search_task`
- `status`: `todo`
- `score`: `B | C`
- `next_action`: `manual_register_or_login_verify | continue_public_search | add_to_source_matrix | expire_check`
- `fields.routing_result`: `daily_task`
- `fields.task_reason`: 为什么不能直接导入
- `fields.source_platform`: 来源平台
- `fields.blocked_by`: `masked_phone | login_required | group_access_required | unclear_fit | expired_possible`
- `fields.original_query`: 原搜索词

## 禁止

- 不自动注册第三方网站账号。
- 不自动加微信群、Facebook 群、论坛账号。
- 不绕过验证码、登录、打码电话或平台限制。
- 不把 AI 猜测的电话、微信、邮箱写成真实联系方式。
- 不把未核验线索推荐给用户。

## 标准分流伪代码

```text
for each search_result:
  if matches_current_need && has_public_evidence && contact_or_source_is_valid:
    route = direct_import
    status = new
    stage = ld_01_ceo_review
  else:
    route = daily_task
    status = todo
    stage = daily_search_task
```

## 用户可见口径

用户看到的是：

> 我先帮你找公开线索和已入驻服务者。找到后会按来源和可信度整理给你，不会把没核验的信息直接推荐给你。

后台看到的是：

> 直接导入线索 / 日常搜索任务。

