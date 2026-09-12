# Android 构建指南

## 前置条件
- Rust stable + targets: `rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android`
- JDK 17（Gradle 8.14.3 不支持 Java 25+）
- Android SDK：cmdline-tools + platforms;android-34 + build-tools;34.0.0 + ndk;27.0.12077973 + platform-tools

## 环境变量
```powershell
$env:ANDROID_HOME = "C:\Android\sdk"
$env:NDK_HOME = "C:\Android\sdk\ndk\27.0.12077973"
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.20.101-hotspot"
```

## 构建
```powershell
npm install
npm run tauri android init    # 首次
npm run tauri android build   # 产出 APK + AAB
```

产物位置：
- APK: `src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk`
- AAB: `src-tauri/gen/android/app/build/outputs/bundle/universalRelease/app-universal-release.aab`

## 平台适配
- Windows 专属代码（DPAPI / Mica / 剪贴板图片复制）已用 `#[cfg(windows)]` 隔离
- 非 Windows 密钥存储：Android 侧可接入 tauri-plugin-stronghold 或 Keystore
- 响应式布局：窄屏下双栏变 Tab、工具条固定底部（CSS media query 可后续优化）

## 常见问题
| 错误 | 原因 | 修复 |
|---|---|---|
| Unsupported class file major version 69 | JDK 版本太高（25） | 装 JDK 17，设 JAVA_HOME |
| refused to allow workflow | gh token 缺 workflow scope | gh auth refresh -s workflow |
| 符号链接权限 | Windows 未开开发者模式 | 设置→隐私和安全→开发者模式→开 |
