# LD_03 华伴入口推广工作流

目标：让 Agent 根据 `source_registry` 自动生成华伴推广任务，把合适的文案投放到合适入口；但不做垃圾推广，不自动注册、不自动加群、不自动群发。

## 总原则

Agent 可以自动做：

- 选择适合当前城市/人群/服务类型的入口。
- 生成不同平台风格的推广文案。
- 生成二维码、短链、落地页参数。
- 生成后台推广任务。
- 对自有渠道或已明确授权渠道自动发布。

Agent 不可以自动做：

- 自动注册第三方网站账号。
- 自动加微信群、Facebook 群、论坛。
- 自动发私信、群发、刷屏。
- 绕过平台审核、验证码、频率限制。
- 在禁止广告的社区发广告。
- 假装普通用户推荐华伴。

## 入口分级

### A 级：可自动发布

条件：

- 华伴自有页面、公众号、邮件列表、短信列表。
- 已授权的合作方渠道。
- 明确允许 API 发布或后台发布的入口。

动作：

- 自动生成文案。
- 自动发布或定时发布。
- 记录发布时间、链接、点击参数。

### B 级：人工确认后发布

条件：

- 公开中文网站、论坛、分类信息。
- 允许广告但需要人工账号或人工审核。
- 小红书、Facebook 公开主页等需要人工确认的渠道。

动作：

- Agent 生成文案和发布建议。
- 进入后台 `outreach_task`。
- 管理员复制、编辑、发布。

### C 级：只观察不推广

条件：

- 微信群、Facebook 私密群、需要加群的社区。
- 明确禁止广告的平台。
- 政府公开网站、行业资质核验网站。

动作：

- 不发布推广。
- 只作为需求/供给/资质核验入口。
- 如有人工授权，只记录为人工任务。

## 推广任务字段

- 城市 / 国家。
- 目标人群：用户、服务者、司机、专业服务者。
- 入口来源：`source_registry.id` 或入口名称。
- 渠道等级：A / B / C。
- 文案版本：短文、长文、群消息、分类广告、服务者招募。
- 落地页：`https://www.huabanapp.com/?ref=...`
- 二维码：华伴二维码或带参数二维码。
- 状态：draft、needs_review、scheduled、published、rejected。
- 合规备注。

## 默认文案方向

### 用户招募

快来领你的 AI，有趣又有用。  
华伴是你的生活帮手、工作助理和休闲陪伴。你有事直接说，它会帮你整理需求，找到靠谱的人。

### 服务者招募

如果你在海外为华人提供接送机、包车、翻译、律师、会计、电工、跑腿或本地生活服务，欢迎加入华伴城市服务网络。  
华伴不抽佣，不赚差价，只帮需要的人遇见可靠的人。

### 本地需求场景

在海外遇到问题，不用到处问。  
把需求告诉华伴 AI，它会帮你整理、搜索公开线索、核验来源，再匹配可能靠谱的人。

## 分流逻辑

```text
for each source in source_registry:
  if source is government_registry or industry_directory:
    skip promotion
    keep for qualification verification
  else if source has authorized_auto_publish:
    create outreach_task(status=scheduled)
  else if source allows public posting but needs human account:
    create outreach_task(status=needs_review)
  else:
    create outreach_task(status=blocked_or_observe_only)
```

## 后台口径

后台看到的是：

> 推广任务：可自动发布 / 待人工确认 / 只观察不推广。
