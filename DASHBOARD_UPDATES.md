# Dashboard Updates (2026-02-17)

## 1. My Portfolio Overview 区域修改

### 变更前
- Cash Balance
- Portfolio Value
- Total Value (已移除)
- Total PnL

### 变更后
- 💵 Cash Balance - 可用現金
- 📈 Portfolio Value - 持倉總值
- 📊 Positions - 持倉數量 (新增)
- 📈 Total PnL - 總盈虧

## 2. 控制面板增强

### 新增功能
- **Clear old records** 复选框 (默认勾选)
- 启动机器人时可选择是否清除旧记录

### 清除记录包括
- `.watcher-state.json`
- `.watcher-state-dryrun.json`
- `dashboard-executor.json` (重置为空对象)
- `dashboard-watcher.json` (重置为空对象)

### 使用方法
1. 勾选 "Clear old records" (默认已勾选)
2. 点击 "Start Bot"
3. 确认对话框会提示是否清除记录
4. 机器人将以干净状态启动

## 3. API 更新

### 启动机器人 (带清除选项)
```bash
POST /api/bot/start?clear=true   # 清除记录后启动
POST /api/bot/start              # 保留记录启动
```

## 4. 安全特性

- 启动前确认对话框显示是否清除记录
- Toast 通知显示操作结果
- 清除操作不可逆，请谨慎使用
