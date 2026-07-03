# LD_01 搜索结果分流规则

适用范围：所有 Agent、人工、外部 AI 搜索到的中文站点、社群、论坛、黄页、招聘页、服务页结果；也适用于用户在华伴里提出的任何商品/服务需求，以及供给侧提交的任何商品/服务能力。

目标：不要把搜索结果一锅端进线索库。先判断是否符合当前需求，再决定进入哪一个后台队列。同时，每个需求和供给都要作为“全球市场信号”保存，扫描其他国家地区是否也存在同类需求和供给。

## 全局原则

任何用户需求、供给侧能力、公开搜索结果，都必须同时做两件事：

1. **本地匹配**：先看当前城市/国家有没有可用需求或供给。
2. **全球扫描**：再看其他华人聚集国家地区是否也有同类需求和供给。
3. **时间过滤**：需求侧只搜索和导入 90 天以内发布的信息；供给侧只搜索和导入 2 年以内发布的信息。
4. **资质核验**：律师、会计、电工、水管、房产中介等可能受监管服务，必须优先查政府公开网站、行业协会公开目录或官方商业登记，作为供给资质验证的一部分。

默认全球扫描目标：

- 澳洲：墨尔本、悉尼、布里斯班
- 新西兰：奥克兰
- 新加坡
- 加拿大：多伦多、温哥华
- 美国：洛杉矶、纽约
- 英国：伦敦
- 德国：慕尼黑

数据库字段建议：

- `fields.global_scan`: `true`
- `fields.global_scan_targets`: 目标城市/国家数组
- `fields.market_signal.source_city`: 原始需求/供给城市
- `fields.market_signal.category`: 需求/供给类别
- `fields.market_signal.keyword`: 标准化关键词
- `fields.market_signal.scan_goal`: `find_matching_demand_and_supply_in_other_countries`
- `fields.freshness_policy.demand_days`: `90`
- `fields.freshness_policy.supply_days`: `730`
- `fields.qualification_policy.required`: 是否需要政府/行业公开核验
- `fields.qualification_policy.priority_sources`: `government_public_registry | industry_association_public_directory | official_business_register`

## 两类结果

### 1. 符合需求：直接导入线索库

进入 `beta_leads` 或 `recruitment_leads`，作为可 review 的线索。

条件：

- 地区匹配：城市/国家与当前任务一致，或明确可服务该地区。
- 类型匹配：服务类型、需求类型和当前任务一致。
- 信息可核验：有公开来源链接、截图来源、公开联系方式、服务描述、时间或价格中的至少两项。
- 联系方式不违规：不能是猜测、打码补全、绕过登录得到的信息。
- 未过期：需求帖必须是 90 天以内发布；供给帖必须是 2 年以内发布。超出时间窗口的结果不直接导入，只能进入日常任务或丢弃。
- 受监管供给已标记核验路径：若是法律、税务、持牌技工、房产等服务，必须记录政府/行业公开核验入口；没有核验入口时不能标记为高可信。

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
- `fields.global_scan`: `true`
- `fields.market_signal`: 全球市场信号摘要
- `fields.freshness_policy`: `{"demand_days":90,"supply_days":730}`
- `fields.qualification_policy`: 资质核验策略和公开查询来源

### 2. 不符合当前需求但有价值：进入后台日常任务

不直接进入线索库，不给用户推荐。进入后台作为人工日常任务：人工注册、人工登录核验、继续搜索、渠道补充、过期判断。

条件：

- 地区不完全匹配，但可作为未来城市/渠道扩展。
- 服务类型不匹配，但属于华伴可扩展服务。
- 需要登录、加群、人工认证、人工搜索才能继续。
- 联系方式被打码、隐藏或需要点击登录后显示。
- 页面是渠道源，不是具体供给/需求。
- 信息太碎，暂不能给用户或服务者跟进。
- 发布时间超出窗口，但渠道本身仍有价值。

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
- `fields.global_scan`: `true`，如果它能帮助判断其他城市供需

## 禁止

- 不自动注册第三方网站账号。
- 不自动加微信群、Facebook 群、论坛账号。
- 不绕过验证码、登录、打码电话或平台限制。
- 不把 AI 猜测的电话、微信、邮箱写成真实联系方式。
- 不把未核验线索推荐给用户。
- 不把普通广告页、黄页或社群自称资质，当作政府/行业公开核验结果。
- 不宣称“官方认证”“平台担保”“一定靠谱”；只能说“公开来源显示/待人工复核”。

## 标准分流伪代码

```text
for each search_result:
  if matches_current_need && has_public_evidence && contact_or_source_is_valid:
    if result_is_demand && published_within_90_days:
      route = direct_import
      status = new
      stage = ld_01_ceo_review
    else if result_is_supply && published_within_730_days:
      route = direct_import
      status = new
      stage = ld_01_ceo_review
    else:
      route = daily_task
      status = todo
      stage = daily_search_task
  else:
    route = daily_task
    status = todo
    stage = daily_search_task

  always:
    create_or_update_market_signal
    scan_other_countries_for_matching_demand_and_supply
    if result_is_regulated_supply:
      search_government_public_registry
      record_license_registry_url_or_mark_missing
      require_human_review_before_recommendation
```

## 用户可见口径

用户看到的是：

> 我先帮你找公开线索和已入驻服务者。找到后会按来源和可信度整理给你，不会把没核验的信息直接推荐给你。

后台看到的是：

> 直接导入线索 / 日常搜索任务。
