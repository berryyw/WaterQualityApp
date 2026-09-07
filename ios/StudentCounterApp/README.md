# StudentCounterApp

这是一个可直接复制到 Xcode 的 `SwiftUI` 代码结构，适合做“学生运动计数”方向的 iOS App 首版。

## 功能

- 跳绳优先的训练流程
- 手动 `+1` 计数
- `减一` 纠错
- 手动切换下一组
- 目标训练 / 自由计数双模式
- 本机保存训练记录
- 最近 7 天统计
- 按项目累计统计
- 首次引导
- 设置页
- 完成训练弹层
- 每日提醒训练
- 连续打卡与成就徽章
- Xcode 预览数据

## 建议环境

- Xcode 16+
- iOS 17+
- SwiftUI
- Charts

## 如何使用

1. 在 Xcode 新建一个 `iOS App` 项目。
2. 选择 `Interface: SwiftUI`，`Language: Swift`。
3. 删除默认生成的 `ContentView.swift`。
4. 把当前目录下的所有 `.swift` 文件拖进 Xcode 项目。
5. 确认 Target 勾选了这些文件。
6. 运行到模拟器或真机。

## 文件说明

- `StudentCounterApp.swift`: App 入口
- `RootView.swift`: 顶层 Tab 导航
- `OnboardingView.swift`: 首次引导
- `TrainingView.swift`: 训练主页面
- `StatsView.swift`: 统计页面
- `SettingsView.swift`: 设置页
- `CompletionSheet.swift`: 训练完成弹层
- `CounterStore.swift`: 状态管理与本地存储
- `Models.swift`: 数据模型
- `DesignTokens.swift`: 设计 Token
- `Haptics.swift`: 触感反馈封装
- `NotificationManager.swift`: 每日提醒通知管理
- `EmptyStateCard.swift`: 空状态卡片
- `AchievementBadgeView.swift`: 成就徽章卡片
- `MockData.swift`: Xcode 预览样例数据
- `AppStoreGuide.md`: 上架素材与商店文案建议
- `ReleaseChecklist.md`: 上架检查清单
- `BrandAssetsGuide.md`: 图标与启动页品牌资产方案
- `LaunchScreenReferenceView.swift`: 启动页参考视图

## 后续建议

- 增加 `AppIcon`
- 增加启动页资源
- 增加本地通知提醒
- 增加 `Widget`
- 后续接入 `iCloud` 同步
