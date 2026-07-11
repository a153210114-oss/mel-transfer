# 华伴 App 原生打包手册

当前工程已经接入 Capacitor：

- Android 工程：`android/`
- iOS 工程：`ios/`
- App ID：`com.huabanapp.ai`
- App 名称：`华伴`
- App Web 入口：`https://www.huabanapp.com/ai.html`

## 常用命令

```bash
npm run cap:sync
npm run cap:android
npm run cap:ios
```

## Android 内测流程

环境要求：

- JDK 17 或以上。
- Android Studio 或 Android SDK/Gradle 构建环境。

1. 执行 `npm run cap:sync`。
2. 执行 `npm run cap:android` 打开 Android Studio。
3. 在 Android Studio 中确认包名为 `com.huabanapp.ai`。
4. 生成测试 APK 或 AAB。
5. 上传到 Google Play Console 的 Internal testing / Closed testing。

当前内测版说明：

- App 入口使用线上页面 `https://www.huabanapp.com/ai.html`，便于快速修复。
- 手机号验证码入口先显示“即将开放”，不阻碍用户使用。
- 推荐、好友和积分先绑定当前设备身份码；短信供应商接入后再归集到正式账号。
- 当前安卓权限保留相机、麦克风、定位和网络；通讯录、通知先不上，避免内测审核和用户信任成本。

## iOS TestFlight 流程

1. 执行 `npm run cap:sync`。
2. 执行 `npm run cap:ios` 打开 Xcode。
3. 在 Xcode 中登录 Apple Developer 账号。
4. 设置 Team、Bundle Identifier、Signing。
5. Archive 后上传到 App Store Connect。
6. 先走 TestFlight，再考虑正式审核。

## 上架前必查

- App 图标替换成最终华伴 logo。
- 截图：iPhone、Android 各准备 3-5 张。
- 隐私政策、用户协议、支持页线上可访问。
- 相机、麦克风、定位、通讯录、通知权限说明与实际功能一致。
- 社交、名片、服务撮合相关功能要有举报/屏蔽/安全提示。

## 说明

第一版采用线上页面作为 App 内容来源，方便快速更新和公测修复。正式稳定后，可以把核心页面和资源打包进 App，减少网络波动影响。
