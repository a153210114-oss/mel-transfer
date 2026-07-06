# 华伴 AI 招募客服工作流说明

## 文件

- `HB_01_supply_recruit_agent.json`：服务供应侧招募客服
- `HB_02_user_recruit_agent.json`：普通用户招募客服
- `AI_RECRUIT_SUPPLY_AGENT.md`：供应侧客服策略说明
- `AI_RECRUIT_USER_AGENT.md`：用户侧客服策略说明
- `recruitment_leads_schema.sql`：Supabase 招募线索表
- `LD_01_search_result_routing.md`：搜索结果分流规则，区分直接入库和后台日常任务
- `LD_01_daily_search_tasks_seed.sql`：不符合当前需求但有价值的后台日常搜索任务模板
- `LD_01_melbourne_driver_supply_seed.sql`：墨尔本中文司机供给线索种子
- `LD_01_melbourne_driver_supply_review.md`：墨尔本中文司机供给人工 review 表
- `source_registry_schema_seed.sql`：中文公开信息入口库表和第一批入口种子
- `LD_02_source_registry_workflow.md`：入口库登记、搜索、分流和合规边界规则
- `outreach_campaign_schema_seed.sql`：华伴推广任务队列表和第一批推广任务种子
- `promotion_copy_materials_schema_seed.sql`：华伴推广文案素材库，沉淀官网、海报、短视频、社群投放和 AI 改写可复用文案
- `VIDEO_SERIES_VISUAL_CIS.md`：华伴视频系列视觉 CIS，规定人物辨识度、痛点画面、旁白标准和生成提示词模板
- `VIDEO_ONE_SCRIPT_TO_FINAL_WORKFLOW.md`：一稿成片工作流，把一个剧本扩展成角色卡、镜头表、旁白、字幕、视频提示词和质检清单
- `prompt_library_schema_seed.sql`：华伴提示词库，区分用户可见提示词和 AI 内部训练规则
- `PG_01_promotion_agent_playbook.md`：推广 Agent 开工手册，按年轻/留学生、家庭、小生意/手艺人三条线分工投放
- `LD_03_outreach_campaign_workflow.md`：入口推广工作流，区分自动发布、人工确认和只观察
- `LD_04_human_outreach_daily_sop.md`：人工客服推广日常 SOP，明确每天做什么、怎么做、工作量和完成率
- `OPS_01_team_recruitment_and_management.md`：运营团队招募、在线会议、任务分配和考核设计
- `ops_team_schema_seed.sql`：运营团队成员、岗位、任务、会议表和第一批模板数据

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
- LD_01 搜索结果必须先分流：符合当前需求的直接进入线索库；不符合但有价值的进入 `ld_01_daily_task`，作为人工注册、人工登录核验、继续搜索或渠道补充任务。
- LD_02 入口库负责登记网站平台、搜索引擎、商家目录和政府公开核验入口；需要登录、加群、验证码或打码联系方式的入口只能进入人工任务。
- LD_03 推广任务只能对自有或明确授权入口自动发布；微信群、Facebook 群、论坛等默认只生成待人工确认任务，不能自动群发。
- PG_01 把推广分成三条线：年轻海外华人/留学生、家庭用户、小生意/手艺人。Agent 负责找入口、分人群、生成任务、文案和二维码；人工负责确认、发布、回复和记录反馈。
- 推广文案素材库负责长期沉淀表达清晰、能打中痛点的文案；推广任务和视频脚本可以从素材库挑选再改写，不要每次从零生成。
- 视频系列必须按 `VIDEO_SERIES_VISUAL_CIS.md` 执行：人物鲜明、痛点可见、旁白有力，不能做只有漂亮画面没有真实冲突的泛 AI 广告。
- 单条视频进入制作前，必须先按 `VIDEO_ONE_SCRIPT_TO_FINAL_WORKFLOW.md` 生成“一稿成片包”；只写故事、不写镜头和提示词，不进入制作。
- 提示词库用于降低用户使用门槛，同时让 AI 记住关键行为边界：先聊天、只问一个关键问题、不要过早弹卡，用户明确说“生成确认卡 / 提交 / 确认下单 / 安排”后再生成确认卡。
- LD_04 人工客服每天按推广任务领取、文案微调、人工发布、回复咨询和复盘记录执行，并用完成率衡量。
- OPS_01 通过后台招募运营团队，按岗位分配任务，使用腾讯会议/Zoom/Google Meet 链接组织晨会、复盘会和周会，并按完成率考核。
