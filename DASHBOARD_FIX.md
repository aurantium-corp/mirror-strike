# Dashboard 修复说明

## 修复日期
2026-02-17

## 修复内容

### 问题
Dashboard 中的 Cash Balance 和 Portfolio Value 显示相同的数字，这不符合逻辑。

### 正确的定义
- **Cash Balance**: 可用现金余额，可用于买入新仓位
- **Portfolio Value**: 当前所有持仓的市场价值总和
- **Total Value**: 总资产 = Cash + Portfolio

### 代码修复

#### 1. 后端修复 (src/executor.ts)
```typescript
async exportState(): Promise<void> {
  let cash = this.isDryRun ? this.dryRunState.virtualBalance : await this.getBalance();
  
  // Calculate portfolio value
  let portfolioValue = 0;
  const positions = Array.from(this.dryRunState.virtualPositions.values());
  for (const pos of positions) {
    const currentPrice = pos.currentPrice || pos.curPrice || pos.averageEntryPrice || 0;
    portfolioValue += pos.size * currentPrice;
  }
  
  const totalValue = cash + portfolioValue;
  
  const state = {
    cash: cash,                    // 可用现金
    portfolio: portfolioValue,      // 持仓总价值
    balance: totalValue,            // 总资产
    // ...
  };
}
```

#### 2. 前端修复 (dashboard-server/public/index.html)
更新了四个统计框的显示：
- 💵 Cash Balance (可用現金)
- 📈 Portfolio Value (持倉總值)
- 💎 Total Value (總資產 = 現金+持倉)
- 📊 Total PnL (總盈虧)

## 部署状态
- ✅ 后端代码已更新并编译
- ✅ 前端界面已更新
- ✅ 服务已重启
- ✅ Dashboard 正常显示三个不同的数值

## 访问地址
https://www.aurantium.cc/ms-dashboard/
