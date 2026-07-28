# 动态接口规则

华伴 V1.1 不区分朋友圈接口、视频号接口、附近动态接口。统一使用：

```text
GET  /api/v1/dynamics
POST /api/v1/dynamics
POST /api/v1/dynamics/:dynamicId/actions
```

## 内容形态

`dynamicType`

- `note`：图文动态
- `video`：视频动态
- `question`：提问
- `notice`：公告

`mediaType`

- `text`
- `image`
- `video`

## 媒体数量

- 图片最多 6 张；动态流只显示当前主图，多图用底部圆点提示左右滑动。
- 视频只能 1 个；视频动态不与多图混排；基础版视频时长上限 15 秒。

## 场景

`scope`

- `nearby`：附近动态
- `profile`：个人主页动态
- `following`：关注动态
- `recommended`：AI 推荐动态

## 原则

- 一个动态模型覆盖图文和视频。
- 动态页参考小红书内容展示逻辑，但华伴动态流优先大图/单视频展示。
- 个人资料页只显示“动态”，不使用“朋友圈”或“视频号”命名。
- 点赞、关注、收藏、评论都走动态 action。
