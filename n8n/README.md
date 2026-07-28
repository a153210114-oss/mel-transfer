# n8n Workflows

V1.1 先保留 8 条主工作流。第一阶段不追求复杂编排，先保证每条工作流都有触发入口、授权边界、审核状态、可观测记录、失败提示和回滚说明。

新增测试工作流草稿：

- `huaban-v1.1-5-agent-user-simulation.workflow.json`
- `huaban-v1.1-external-invite-promotion.workflow.json`

用途：用 5 个模拟用户 Agent 测试用户端页面按键链、华伴 AI 指令理解、真实动作完成确认和积分入账。

第二组用途：用 5 个推广 Agent 测试异城手机号外部邀请，覆盖短信和邮件推广路径，确认未注册用户只生成邀请与待确认记录，不提前发放积分。

配套文档：

- `docs/USER_ACTION_SCENARIO_CHAINS.md`

本地等价脚本：

```bash
npm run agents:live
npm run promo:live
npm run referral:live
npm run identity:live
```

原则：Agent 只能在动作确认后写积分事件；不能只因用户输入提示词就发积分。
二级推荐必须按 A→B→C 验证：B 获得一级推荐积分，A 获得二级推荐积分，重复提交不能重复入账。
身份确定性必须覆盖：更换手机号不更换身份码、二维码扫描和分享链接解析到同一身份码与推荐码、重复入口不改首位推荐关系。

所有工作流必须写入 `hb_automation_jobs`，AI 相关步骤必须写入 `hb_ai_logs`。

每条工作流至少要记录：

- `workflow_id`
- `workflow_name`
- `trigger_type`
- `owner_user_id`
- `authorization_scope`
- `status`
- `last_run_at`
- `last_result`
- `retry_count`
- `rollback_note`

## HB11_01_User_Onboarding

触发：用户完成手机号验证、资料完善、二维码名片创建。

动作：

- 写入 `hb_points_events`：注册 30 分、完善资料 20 分、创建名片 30 分。
- 刷新 `/api/v1/me/growth` 摘要。
- 失败时写入 `hb_automation_jobs.status = failed`。

## HB11_02_City_Post_AI_Process

触发：用户发布动态、提交反馈、发布城市需求。

动作：

- 调用 AI 做内容分类、风险检查、城市标签、推荐标签。
- 写入 `hb_ai_logs`。
- 合规内容进入 `/api/v1/dynamics`。
- 需要人工复核的内容进入后台待处理。

## HB11_03_Card_Relation_Automation

触发：加好友、关注作者、收藏名片、扫码交换名片。

动作：

- 写入好友关系和来源。
- 归档好友地域分组：当地、异地、异国。
- 可选触发 AI 匹配 `/api/v1/ai/recommend-cards`。

## HB11_04_Message_Notification

触发：私信、评论、@、系统通知。

动作：

- 写入消息摘要。
- 高频消息合并推送。
- 用户语音搜索或消息搜索统一走 `/api/v1/ai/command`。

## HB11_05_City_Daily_Report

触发：每日城市运营巡检。

动作：

- 汇总新增用户、动态、名片、反馈、待审内容、积分释放事件。
- 输出城市日报给后台。
- 异常写入 `hb_automation_jobs`。

## HB11_06_Admin_Operation_Center

触发：后台手动点击“立即巡检”、定时巡检、部署前巡检。

动作：

- 调用 `POST /api/v1/admin/ops-inspection/run`。
- 生成 `tmp/ops-inspection-report.json`。
- 写入 `hb_automation_jobs`，状态为 `done` 或 `needs_attention`。
- 后台页面 `/admin/ops-center.html` 读取 `GET /api/v1/admin/ops-inspection` 展示结果。

当前最小可执行闭环：

```text
管理员打开后台 -> 点击立即巡检 -> dev server 运行 scripts/ops-inspection.mjs -> 写入报告 -> 返回后台 -> 写入自动化任务记录
```

## HB11_07_Shop_API_Automation

触发：用户或商家在“小店与卡包”里授权服务卡、库存、预约、菜单、报价、课程表、排班或订单状态 API。

动作：

- AI 帮用户识别 API 字段、生成字段映射和同步说明。
- 后台审核授权范围、有效期、调用频率和风险级别。
- n8n 按授权范围执行同步、提醒、摘要和 Webhook 回调。
- 每次运行写入 `hb_automation_jobs`，包含输入摘要、输出摘要、错误、重试次数和人工接管状态。
- 用户撤销授权后立即暂停流程，并写入 `rollback_note`。

边界：

- 不绕过用户授权读取第三方数据。
- 不直接执行不可回滚支付或高风险交易。
- 不绕过后台审核自动发布敏感服务。

## HB11_08_Friend_Note_AI_Automation

触发：用户查看好友资料、聊天摘要、推荐给朋友、添加备注或标签。

动作：

- AI 从用户授权范围内生成备注、标签、来源和推荐理由建议。
- 用户确认后写入好友资料。
- 后台保留来源和变更记录，便于排查推荐关系与积分事件。

边界：

- AI 只生成建议，不自动修改好友资料。
- 不能把私聊内容无授权地用于公开推荐。
