# 运营巡检 MVP

V1.1 第一阶段先实现可执行巡检闭环，后续再接正式 n8n、告警和细分运营策略。

## 目标

- 后台可以手动触发巡检。
- 服务端可以生成巡检报告。
- 巡检结果可以在后台查看。
- 每次巡检写入自动化任务记录。
- 部署前可以用同一套检查避免漏项。

## 入口

- 后台页面：`/admin/ops-center.html`
- 获取最近报告：`GET /api/v1/admin/ops-inspection`
- 重新巡检：`POST /api/v1/admin/ops-inspection/run`
- 自动化任务记录：`GET /api/v1/admin/automation-jobs`
- 本地脚本：`node scripts/ops-inspection.mjs`

## 当前检查项

- 用户端是否存在积分权益入口。
- AI 职责文档是否包含积分解释和合规边界。
- 推广飞轮文档是否包含 4200 万总池、1/128 首轮释放、净利润 80% 分配池。
- 动态接口是否统一。
- AI 指令接口是否存在。
- `hb_automation_jobs`、`hb_ai_logs`、`hb_points_events` 是否存在。
- 用户端和 AI 口径是否避免固定收益承诺。

## 后续完善

- 接入真实数据库写入 `hb_automation_jobs`。
- 接入 n8n 定时触发。
- 按城市输出日报。
- 增加内容审核、积分异常、AI 调用失败、接口错误率告警。
- 增加创始人手机端的运营摘要入口。
