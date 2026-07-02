# 华伴项目纯净版清理清单

更新时间：2026-07-02

## 已在本地完成

- 已备份当前状态到本地 `.backup-20260702-145753/`
  - `project-snapshot.tar.gz`：完整项目快照
  - `uncommitted.diff`：清理前未提交差异
  - `git-status.txt`：清理前状态
- 已删除测试残留目录与文件
- 已删除旧版 n8n 工作流文件
- 已删除根目录旧接口副本 `chat.js`、`tts.js`
- 已保留当前 Vercel API：`api/chat.js`、`api/tts.js`
- 已保留当前华伴品牌、CIS、AI 共生模型、免责条款、招募广告、测试路线图
- 已保留最新 n8n 招募工作流：
  - `workflows/HB_01_supply_recruit_agent.json`
  - `workflows/HB_02_user_recruit_agent.json`
  - `workflows/AI_RECRUIT_SUPPLY_AGENT.md`
  - `workflows/AI_RECRUIT_USER_AGENT.md`

## GitHub 保留策略

保留仓库：

- `a153210114-oss/mel-transfer`

建议后续可在 GitHub 上把仓库名改为：

- `huaban-app`

本次纯净版提交后，GitHub 应只保留当前最新版文件。旧测试文件和旧工作流会随提交删除。

## Vercel 保留策略

保留一个项目：

- 当前 `mel-transfer` 项目

建议后续在 Vercel 内将项目显示名改为：

- `huaban-app`

保留域名：

- `huabanapp.com`
- `www.huabanapp.com`
- `mel-transfer.vercel.app` 可保留为 Vercel 默认预览域名，不对外宣传

DNS 保留：

```text
A      @       216.198.79.1
CNAME  www     cname.vercel-dns.com
NS     @       ns29.domaincontrol.com
NS     @       ns30.domaincontrol.com
CNAME  _domainconnect   _domainconnect.gd.domaincontrol.com
```

删除/关闭：

- GoDaddy Website Builder
- Parking 停放页
- Forwarding 转发
- 多余 A / AAAA / CNAME 记录

## n8n 保留策略

保留：

- `HB_01_supply_recruit_agent`
- `HB_02_user_recruit_agent`

清理：

- 旧版线索发现工作流
- 旧版接送机监控工作流
- 未启用或无当前业务用途的测试 workflow

## Supabase 保留策略

保留表结构和当前业务表：

- `contacts`
- `drivers`
- `trips`
- `referrals`
- `tour_plaza`
- `recruitment_leads`

清理内容：

- 测试乘客
- 测试司机
- 测试订单
- 旧线索测试数据
- 无真实业务意义的演示数据

执行前请先在 Supabase 做数据库备份。清理 SQL 草案见：

- `workflows/supabase_cleanup_current_state.sql`

## Codex 聊天记录

Codex 系统聊天记录无法由项目代码删除。项目文件层面只保留本次聊天形成的最新内容。
