# 华伴 AI 模型调度中心

用户端只看到一个华伴 AI。后台根据任务类型选择不同模型和供应商。

## 已接入的供应商

- Anthropic：默认文字对话、复杂规划、图片理解。
- OpenAI：可作为文字对话、复杂规划、搜索核验等任务的供应商。
- Gemini：可作为文字对话、复杂规划、搜索核验等任务的供应商。
- SiliconFlow：当前用于语音输出，也可作为文字模型备用。

## 任务类型

- `director`：总调度模型。负责理解中文需求、判断任务类型、分配给最擅长的模型，并做结果质检。这个角色优先使用中文理解能力强的模型，不追求最低成本。
- `casual_chat`：闲聊陪伴，优先便宜、快、语气自然。
- `chat`：通用对话。
- `complex_planning`：旅行计划、商业方案、规则设计、多步骤推理。
- `search_verify`：找人、找服务、公开信息核验。
- `supply_intel`：识别用户能提供的商品、服务、资源。
- `booking_action`：预约、下单、提醒、确认等办事动作。
- `vision_understanding`：图片、截图、票据、菜单、海报识别。

## 环境变量

基础密钥：

- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `GEMINI_API_KEY` 或 `GOOGLE_API_KEY`
- `SILICONFLOW_API_KEY`

按任务切换供应商和模型：

- `HUABAN_MODEL_FAST_PROVIDER` / `HUABAN_MODEL_FAST`
- `HUABAN_MODEL_DIRECTOR_PROVIDER` / `HUABAN_MODEL_DIRECTOR`
- `HUABAN_MODEL_DEFAULT_PROVIDER` / `HUABAN_MODEL_DEFAULT`
- `HUABAN_MODEL_INTENT_PROVIDER` / `HUABAN_MODEL_INTENT`
- `HUABAN_MODEL_ACTION_PROVIDER` / `HUABAN_MODEL_ACTION`
- `HUABAN_MODEL_SEARCH_PROVIDER` / `HUABAN_MODEL_SEARCH`
- `HUABAN_MODEL_REASONING_PROVIDER` / `HUABAN_MODEL_REASONING`
- `HUABAN_MODEL_VISION_PROVIDER` / `HUABAN_MODEL_VISION`

供应商值目前支持：

- `anthropic`
- `openai`
- `gemini`
- `siliconflow`（文字备用；视觉暂不走 SiliconFlow）

## 默认策略

没有配置时，文字和图片默认走 Anthropic。这样不会影响现有线上功能。

## 评估与切换规则

模型不能随便换。当前采用三步：

1. 导演模型先判断用户需求属于哪类任务。
2. 只有导演置信度达到门槛，才允许从初判任务切到另一个专家任务。
3. 专家模型完成后，导演模型做一次质检，记录是否通过、分数和改进建议。

默认门槛：

- `HUABAN_MODEL_DIRECTOR_MIN_CONFIDENCE`：默认 `0.62`。
- `HUABAN_MODEL_AUDIT_MIN_SCORE`：默认 `0.55`。
- `HUABAN_MODEL_DIRECTOR_ENABLED=false`：可关闭导演调度。
- `HUABAN_MODEL_AUDIT_ENABLED=false`：可关闭质检。

后台 Token 监控会记录：

- 是否发生路由切换。
- 切换是否通过门槛。
- 导演置信度。
- 质检分数。
- 质检是否通过。

后续要切换某类任务，只改环境变量。例如：

```text
HUABAN_MODEL_REASONING_PROVIDER=openai
HUABAN_MODEL_REASONING=gpt-4.1
```

或：

```text
HUABAN_MODEL_SEARCH_PROVIDER=gemini
HUABAN_MODEL_SEARCH=gemini-2.5-flash
```

## 监控

前台调用返回 `huaban_usage`，会写入 `token_usage.fields`：

- `route`：任务类型。
- `route_reason`：为什么选这个路由。
- `cost_tier`：低/中成本层级。

后台 Token 监控会显示模型、供应商和任务路由，用来判断哪类需求最烧 token、哪类模型效果最好。
