# 华伴一稿成片工作流

目标：做到“给一个剧本，就能生成接近满意的视频”。  
核心方法：剧本不是只写文字，而是一次输出 **人物设定 + 痛点画面 + 镜头分镜 + 旁白 + 字幕 + 视频生成提示词 + 质检标准**。

## 1. 一稿成片输入格式

每个视频脚本必须按这个结构写，缺一项就不要进入生成：

```text
视频标题：
目标人群：
人物：
人物辨识点：
人物口头禅：
痛点画面：
用户内心：
华伴介入：
结果变化：
主旁白：
字幕：
画面风格：
结尾口号：
二维码/落地页：
禁用内容：
```

## 2. 一稿成片输出格式

AI 或人工拿到剧本后，必须转换成这个生产包：

```text
1. 成片目标
2. 角色卡
3. 场景卡
4. 15 秒镜头表
5. 旁白音频稿
6. 字幕稿
7. 每镜头画面提示词
8. 负面提示词
9. 封面海报提示词
10. 质检清单
```

## 3. 15 秒标准镜头表

| 时间 | 画面 | 人物动作 | 旁白 | 字幕 | 生成重点 |
| --- | --- | --- | --- | --- | --- |
| 0-3s | 痛点爆发 | 用户被打断/卡住/焦虑 | 先戳痛点 | 8-12字 | 必须一眼看懂痛点 |
| 3-6s | 情绪口头禅 | 人物说一句真实话 | 用户内心 | 8-12字 | 建立共鸣 |
| 6-10s | 华伴出现 | 手机界面变干净 | 华伴接住 | 8-12字 | 华伴绿出现 |
| 10-13s | 结果变化 | 任务被整理/推进 | 结果清楚 | 8-12字 | 对比前后 |
| 13-15s | 品牌定格 | Logo + QR | 口号 | 口号 | 清楚可扫码 |

## 4. 旁白规则

旁白必须满足：

- 第一秒说痛点，不铺垫。
- 每句 8-14 个字。
- 15 秒最多 6 句。
- 不能解释后台、平台、功能菜单。
- 不能说“帮你”，改用“我来、交给我、华伴来”。
- 最后一句必须能单独成为广告语。

旁白公式：

```text
[痛点]。
[内心真实话]。
[华伴出现]。
[执行动作]。
[结果变化]。
[品牌口号]。
```

## 5. 字幕规则

- 字幕要比旁白更短。
- 每屏最多两行。
- 关键词用华伴绿。
- 不放小字说明。
- 不能堆功能。

字幕公式：

```text
痛点：本来只想办一件事
内心：却又被红点拖走
行动：交给华伴
结果：先做这一件
结尾：成就更出色的你
```

## 6. 画面提示词总模板

```text
Create a 15-second vertical short video for Huaban AI+.
Aspect ratio: 9:16.
Style: realistic overseas Chinese life, documentary feeling, warm but clean, not glossy corporate ad.
Main character: [人物辨识点], consistent face, clothing and props across all shots.
Scene: [具体地点].
Pain point must be visible: [红点/空白文档/家务清单/平台抽佣/搜索广告/群聊噪音].
Before Huaban: chaotic, crowded, anxious, noisy phone screen.
After Huaban: clean AI chat bubble, calm layout, Huaban green #07C160, clear next step.
Do not show backend, dashboard, platform, charts or complex app menu.
Show only: user, phone, Huaban AI chat, result.
Subtitles: large simplified Chinese subtitles, max two lines.
Ending: Huaban logo, QR code area, slogan: [结尾口号].
```

## 7. 负面提示词

每个视频生成任务都必须附上：

```text
No futuristic robot, no sci-fi hologram, no corporate dashboard, no stock-photo smile, no crowded UI, no tiny text, no unreadable QR code, no exaggerated luxury, no abstract neon background, no random English text, no broken Chinese characters, no backend platform screen, no multiple inconsistent faces.
```

## 8. 一稿成片质检清单

生成后只看 10 件事：

1. 前 3 秒是否看懂痛点？
2. 人物是否有明显记忆点？
3. 人物口头禅是否真实？
4. 华伴是否像有能力的协助者，而不是客服？
5. 有没有说“帮你”？如果有，改。
6. 有没有露出后台、平台、功能菜单？如果有，删。
7. 字幕是否够大、够短？
8. 旁白是否有力，不绕？
9. 结尾二维码是否清楚？
10. 看完是否知道“我可以拿华伴做什么”？

不满足 8 条以上，不算可发布。

## 9. 第一条标准成片包

### 视频标题

本来只想打个电话

### 目标人群

年轻海外华人 / 留学生 / 容易被红点和推荐流打断的人

### 人物

小林，22 岁，留学生。

### 人物辨识点

圆框眼镜、灰色 oversize 卫衣、贴满贴纸的电脑、桌上一杯喝到一半的咖啡，手机永远有一堆红点。

### 人物口头禅

“我刚才要干嘛来着？”

### 痛点画面

小林本来只是想打电话，打开手机后，被微信群、短视频、猜你喜欢、99+ 红点连续打断。30 分钟过去，她突然忘了最初要做什么。

### 用户内心

不是不想变好，只是每天都被碎片信息拖走。

### 华伴介入

小林打开华伴，说：“我刚才想联系老师。”  
华伴回复：“我来打开对话，先做这一件。”

### 结果变化

手机画面从混乱变干净，只剩老师对话和一个明确下一步。小林松一口气。

### 主旁白

本来只想办一件事。  
却又被红点拖走。  
不是你不自律。  
只是生活太吵。  
华伴在，先做这一件。  
成就更出色的你。

### 字幕

本来只想办一件事  
却又被红点拖走  
不是你不自律  
只是生活太吵  
华伴在，先做这一件  
成就更出色的你

### 15 秒镜头表

| 时间 | 画面 | 人物动作 | 旁白 | 字幕 |
| --- | --- | --- | --- | --- |
| 0-3s | 手机 99+ 红点、群聊、短视频自动闪过 | 小林皱眉滑手机 | 本来只想办一件事 | 本来只想办一件事 |
| 3-6s | 桌上咖啡冷了，电脑作业空着 | 小林愣住说口头禅 | 却又被红点拖走 | 却又被红点拖走 |
| 6-9s | 华伴聊天界面出现，背景变干净 | 小林输入“我刚才想联系老师” | 不是你不自律 | 不是你不自律 |
| 9-12s | 华伴回复“我来打开对话，先做这一件” | 小林点头，深呼吸 | 只是生活太吵 | 只是生活太吵 |
| 12-15s | 老师对话打开，Logo + QR 定格 | 小林开始发消息 | 华伴在，先做这一件。成就更出色的你 | 成就更出色的你 |

### 每镜头提示词

镜头 1：

```text
Close-up of a young overseas Chinese student holding a phone, many red notification dots, WeChat group messages, short video feed and recommendation cards flashing rapidly. Round glasses, gray oversized hoodie, sticker-covered laptop on desk, half-finished coffee. Anxious and distracted mood, realistic documentary style, vertical 9:16.
```

镜头 2：

```text
Medium shot of the same student sitting at a messy study desk, cold coffee, blank assignment on laptop, phone in hand. She looks confused and says "我刚才要干嘛来着？" Realistic overseas student room, soft night light, no glamour, strong emotional authenticity.
```

镜头 3：

```text
Phone screen transforms from noisy apps to a clean Huaban AI chat interface. Huaban green #07C160 accent, simple chat bubble: "我刚才想联系老师". Background becomes calmer, red dots fade away. Do not show backend or platform menu.
```

镜头 4：

```text
Clean phone UI with Huaban AI reply: "我来打开对话，先做这一件." The student takes a breath and focuses. Minimal interface, large readable Chinese text, warm and calm lighting.
```

镜头 5：

```text
Final brand frame: Huaban logo, scan-ready QR code area, slogan "成就更出色的你". Clean white and Huaban green design, no clutter, vertical poster-like ending.
```

### 封面海报提示词

```text
Vertical poster for Huaban AI+, young overseas Chinese student with round glasses and gray hoodie, red notification dots floating around the phone, messy desk and blank laptop behind her. On the phone, a clean Huaban AI chat bubble appears in green. Headline: "成就更出色的你". Subcopy: "华伴在，先做这一件." QR code area bottom right. Realistic, emotional, clean, no sci-fi robot, no crowded text.
```

### 发布文案

本来只想办一件事，  
却又被红点和推荐流拖走。  

不是你不自律，  
只是生活太吵。  

华伴在，先做这一件。  
成就更出色的你。  

试试华伴 AI+：https://www.huabanapp.com/?ref=focus_better_self

## 10. 执行规则

以后每个视频脚本，都必须先变成“一稿成片包”，再进入视频生成工具。  
如果只写故事、不写镜头、不写提示词，不允许进入制作。

