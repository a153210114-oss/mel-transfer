# 华伴 AI 招募客服工作流说明

## 文件

- `HB_01_supply_recruit_agent.json`：服务供应侧招募客服
- `HB_02_user_recruit_agent.json`：普通用户招募客服
- `AI_RECRUIT_SUPPLY_AGENT.md`：供应侧客服策略说明
- `AI_RECRUIT_USER_AGENT.md`：用户侧客服策略说明
- `recruitment_leads_schema.sql`：Supabase 招募线索表

## 需要的环境变量

在 n8n 中配置：

```text
ANTHROPIC_API_KEY
SUPABASE_URL
SUPABASE_ANON_KEY
```

## Webhook 路径

供应侧：

```text
POST /webhook/huaban/supply-recruit
```

用户侧：

```text
POST /webhook/huaban/user-recruit
```

## 输入示例：供应侧

```json
{
  "channel": "website",
  "message": "我在墨尔本做接送机，有商务车，可以加入吗？",
  "name": "王师傅",
  "contact": "wechat: example",
  "city": "Melbourne",
  "country": "Australia"
}
```

## 输入示例：用户侧

```json
{
  "channel": "website",
  "message": "我爸妈下周到墨尔本，需要接机",
  "city": "Melbourne",
  "country": "Australia"
}
```

## 下一步接入位置

第一阶段不急着全站接入，建议只放在：

1. 合伙人/服务者招募页
2. 首页“司机入驻”
3. 小红书或微信群广告落地页
4. 管理员手动录入测试

## 注意

- 工作流草案已是有效 JSON，但导入 n8n 后仍需根据你的 n8n 版本检查节点参数。
- Supabase 表需要先执行 `recruitment_leads_schema.sql`。
- 不要让 AI 自动群发私信；只能处理用户主动提交或授权的线索。

