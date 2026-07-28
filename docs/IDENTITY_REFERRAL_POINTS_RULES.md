# 身份、推荐关系、积分入账确定性规则

本文件是华伴 V1.1 的硬约束。任何实现、迁移、后台操作和 n8n 工作流都不能绕过这些规则。

## 1. 用户身份唯一性

用户账号以 `hb_users.id` 为主键，手机号验证是第一阶段唯一登录入口之一。

核心原则：身份码全局唯一，用户个人身份码唯一，手机号绑定唯一。

必须满足：

- 一个手机号只对应一个有效用户账号。
- 一个个人身份码只对应一个用户。
- 一个用户只能有一个有效个人身份码。
- 身份码一旦发放，不允许复用给另一个用户。
- 身份码作废只能改状态，不能删除历史。

数据库约束：

- `hb_users.phone_e164 unique`
- `hb_identity_codes.code unique`
- `hb_identity_codes(user_id, code_kind)` 对 personal/business 建唯一索引

## 2. 推荐关系确定性

推荐关系只在用户首次有效绑定时确定。

必须满足：

- 被推荐人 `referee_code` 只能绑定一次推荐来源。
- 推荐人和被推荐人不能是同一个身份码。
- 直接推荐和二级推荐要分字段保存。
- 任何改绑、撤销、拒绝必须保留原事件，不允许覆盖历史。
- n8n 或后台重复提交同一次推荐时必须用 `idempotency_key` 幂等。

数据库约束：

- `hb_referral_events.referee_code unique`
- `hb_referral_events.idempotency_key unique`
- `check (inviter_code <> referee_code)`

## 3. 积分入账确定性

积分必须是账本事件，不允许只改余额。

必须满足：

- 每次积分入账必须有唯一 `event_key`。
- 同一个用户、同一个动作、同一个对象只能产生一次积分事件。
- 积分状态必须可区分：待审核、确认、拒绝、冲正。
- 余额由 confirmed 事件汇总或由受控任务刷新，不允许前端直接写余额。
- 冲正必须新增或更新状态为 `reversed`，保留原始事件。
- 人工审核类积分先进入 `pending_review`，审核通过再 confirmed。

推荐 `event_key` 格式：

```text
{tenant}:{user_code}:{action}:{ref_type}:{ref_id}
```

示例：

```text
hb_v1_1:HB110001:profile_completed:profile:me
hb_v1_1:HB110238:direct_referral_verified:identity:HB110517
hb_v1_1:HB110001:city_post_published:dynamic:post_123
```

数据库约束：

- `hb_points_events.event_key unique`
- `hb_points_events.status in pending_review/confirmed/rejected/reversed`

## 4. 后台和 n8n 要求

后台必须能看到：

- 身份码总数、重复风险、缺失身份码用户。
- 推荐关系总数、被推荐人重复风险、自推荐风险。
- 积分流水总数、重复 event_key 风险、无归属积分、待审核积分。
- 每次 n8n 入账任务的输入、输出、状态、错误、重试和回滚说明。

n8n 工作流只能写入事件或请求后台 API，不能直接无审计地改余额。

## 5. 接 Supabase 前的验收

接生产库前必须通过：

- schema 约束检查。
- 本地 mock 重复提交检查。
- 旧库只读审计检查。
- 后台统计和明细抽样检查。
- 至少 6 个测试用户身份码、推荐关系、积分流水一致性检查。
