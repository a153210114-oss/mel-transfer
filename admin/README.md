# Admin

后台第一阶段先做可进入、可查看、可触发动作的最小管理中心。

模块：

- 用户管理
- 动态管理
- 名片关系管理
- 城市内容管理
- 供给侧资料管理
- 供给雷达
- 需求匹配
- 官网管理
- AI Prompt 管理
- 自动化任务管理
- 数据统计
- 积分等级管理
- 后台首页：`/admin/`
- 创始人手机端积分看板：`/admin/founder-mobile.html`
- 运营巡检中心：`/admin/ops-center.html`

## 创始人积分来源

创始人账号使用同一套积分和等级规则。

区别只在积分来源：用户侧有效释放 2 分，创始人与系统建设账户自动获得 1 分。

## 运营巡检

第一阶段已提供最小后台闭环：

- `GET /api/v1/admin/ops-inspection`：读取最近巡检报告。
- `POST /api/v1/admin/ops-inspection/run`：手动触发巡检。
- `GET /api/v1/admin/automation-jobs`：查看自动化任务记录。

巡检脚本为 `scripts/ops-inspection.mjs`，报告输出到 `tmp/ops-inspection-report.json`。
