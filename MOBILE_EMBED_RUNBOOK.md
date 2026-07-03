# 华伴嵌入用户手机端说明

目标：让用户不用找网址，把华伴像 App 一样放到手机桌面。

## 用户路径

1. 用户用手机浏览器打开 `https://www.huabanapp.com/`。
2. 华伴 AI 在合适时机提示“添加到手机桌面”。
3. iPhone：点 Safari 分享按钮，选择“添加到主屏幕”。
4. Android：点浏览器菜单，选择“安装应用”或“添加到主屏幕”。
5. 用户以后直接点桌面图标进入华伴。

## 已实现

- `manifest.json`：App 名称、图标、启动地址、独立窗口模式。
- `apple-touch-icon`：iPhone 主屏幕图标。
- `sw.js`：缓存华伴手机壳，提升再次打开速度。
- `beforeinstallprompt`：Android/Chrome 可直接弹出安装提示。
- iOS 手动引导：Safari 分享按钮添加主屏幕。

## 测试清单

- iPhone Safari 打开后能看到添加桌面引导。
- iPhone 添加到主屏幕后，桌面图标显示华伴 logo。
- 从桌面图标打开，顶部浏览器地址栏不明显干扰体验。
- Android Chrome 点击“添加”后能触发安装或添加主屏幕。
- 断网后再次打开，至少能看到华伴页面壳。
- 麦克风权限由用户主动点击语音后再申请。

## 注意

- iOS 不支持网页自动弹出安装框，只能引导用户点分享按钮。
- Service worker 只在 HTTPS 或 localhost 生效，`file://` 本地打开不会注册。
- 每次改 `sw.js` 缓存策略时，修改 `CACHE_NAME` 版本号。
