# Dashboard Control Panel

## 新增功能 (2026-02-17)

Dashboard 现在包含控制面板，可以直接从网页界面控制机器人。

## 控制按钮

### 1. Trading Mode Toggle
- **当前模式显示**: DRY-RUN MODE 或 LIVE MODE
- **按钮**: "Switch to LIVE" 或 "Switch to DRY-RUN"
- **功能**: 切换 .env 文件中的 DRY_RUN 设置
- **警告**: 切换到 LIVE 模式时会显示警告提示

### 2. Stop Bot
- **功能**: 停止 mirror-strike 机器人 (pm2 stop)
- **确认**: 需要用户确认
- **状态**: 停止后按钮禁用，Start 按钮启用

### 3. Start Bot
- **功能**: 启动 mirror-strike 机器人 (pm2 start)
- **状态**: 启动后 Stop 按钮启用，Start 按钮禁用

## 状态指示器

在页面顶部 header 区域：
- 🟢 **Bot: Online** - 机器人正在运行
- 🔴 **Bot: Offline** - 机器人已停止
- 🟢 **DRY-RUN MODE** - 测试模式
- 🟠 **LIVE MODE** - 真实交易模式 (带脉冲动画警告)

## API 端点

| 方法 | 端点 | 功能 |
|------|------|------|
| GET | /api/mode | 获取当前模式 |
| POST | /api/mode/toggle | 切换模式 |
| GET | /api/bot/status | 获取机器人状态 |
| POST | /api/bot/stop | 停止机器人 |
| POST | /api/bot/start | 启动机器人 |

## 安全特性

1. **确认对话框**: 切换模式和停止机器人时需要确认
2. **Toast 通知**: 操作成功/失败时显示提示
3. **视觉警告**: LIVE 模式有脉冲动画效果
4. **按钮状态**: 根据当前状态禁用/启用按钮

## 访问地址

https://www.aurantium.cc/ms-dashboard/
