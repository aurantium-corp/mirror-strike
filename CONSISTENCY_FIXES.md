# Mirror-Strike 一致性修复报告

## 修复日期
2026-02-17

## 目标
确保 Dry-Run 和 Live 模式的动作完全一致，使用户可以安心在 Live 模式下运行。

---

## 已完成的修复

### 1. 配置更新

**文件:** `.env`

```env
MIRROR_RATIO=1.0              # 从 0.1 改为 1.0 (1:1 完全复制)
DRY_RUN_WALLET_BALANCE=10000  # 虚拟余额 $10,000
SYNC_INITIAL_POSITIONS=false  # 不同步历史持仓，只跟踪新交易
```

---

### 2. 代码修复

#### 修复 A: 最小交易金额统一
**文件:** `src/executor.ts`

**问题:** Live 模式最小金额为 $1，Dry-Run 为 $0.01

**修复:**
```typescript
// Live 模式 (executeBuy)
if (tradeUsdcAmount < 0.01) {  // 从 1 改为 0.01
    console.log(`[SKIPPED] Amount too small ($${tradeUsdcAmount.toFixed(4)}) or zero balance.`);
    return;
}
```

---

#### 修复 B: 99% 清仓规则统一
**文件:** `src/executor.ts`

**问题:** Live 模式使用 90% 阈值，Dry-Run 没有此规则

**修复:**
```typescript
// Live 模式 (executeSell) 和 Dry-Run 模式 (simulateTrade) 都改为 99%
if (sellSize >= pos * 0.99) sellSize = pos;  // 从 0.9 改为 0.99
```

---

#### 修复 C: 资金不足处理统一
**文件:** `src/executor.ts`

**问题:** 
- Dry-Run: 资金不足时跳过交易
- Live: 资金不足时用完全部余额

**修复:**
```typescript
// Dry-Run 模式改为与 Live 一致：用完全部余额
if (trade.side === 'BUY') {
  // Use all available balance if scaled amount exceeds balance (consistent with Live mode)
  const tradeSize = Math.min(this.dryRunState.virtualBalance, scaledUsdc);
  if (scaledUsdc > this.dryRunState.virtualBalance) {
    console.log(`[DRY-RUN] INSUFFICIENT FUNDS - Would need $${scaledUsdc.toFixed(2)} USDC, have $${this.dryRunState.virtualBalance.toFixed(2)} USDC`);
    console.log(`[DRY-RUN] Using all available balance: $${tradeSize.toFixed(2)} USDC`);
  }
  // ... rest of the logic
}
```

---

#### 修复 D: getDryRunState 返回深拷贝
**文件:** `src/executor.ts`

**问题:** 返回引用导致外部修改影响内部状态

**修复:**
```typescript
getDryRunState(): DryRunState {
  // Return a deep clone to prevent external mutations and enable proper state comparison
  return {
    virtualBalance: this.dryRunState.virtualBalance,
    virtualPositions: new Map(this.dryRunState.virtualPositions),
    totalPnL: this.dryRunState.totalPnL,
    tradeHistory: [...this.dryRunState.tradeHistory]
  };
}
```

---

## 一致性验证

### 测试套件结果
```
Total Tests: 7
Passed: 7
Failed: 0

✓ Scenario A: Target BUY → Mirror BUY
✓ Scenario B: Target SELL → Mirror SELL
✓ Scenario C: Duplicate Detection
✓ Scenario D: Multiple Targets
✓ Scenario E: No Position to SELL
✓ Scenario F: Insufficient Funds (Uses All Balance)
✓ Watcher: Duplicate Detection
```

### 模式一致性对比

| 行为 | Dry-Run | Live | 状态 |
|------|---------|------|------|
| MIRROR_RATIO | 1.0 | 1.0 | ✓ 一致 |
| MIN_TRADE_AMOUNT | $0.01 | $0.01 | ✓ 一致 |
| BUY 份额计算 | USDC / Price | USDC / Price | ✓ 一致 |
| SELL 份额计算 | 按比例或 99% 清仓 | 按比例或 99% 清仓 | ✓ 一致 |
| 资金不足处理 | 用完全部余额 | 用完全部余额 | ✓ 一致 |
| PnL 计算 | Proceeds - Cost Basis | Proceeds - Cost Basis | ✓ 一致 |
| REDEEM 逻辑 | 1 share = 1 USDC | 1 share = 1 USDC | ✓ 一致 |

---

## 当前配置

### 保守策略（推荐）
```env
DRY_RUN=true                  # 先测试
SYNC_INITIAL_POSITIONS=false  # 不同步历史持仓
MIRROR_RATIO=1.0             # 1:1 复制
DRY_RUN_WALLET_BALANCE=10000 # 虚拟余额 $10,000
```

**说明:**
- 只跟踪目标交易者**启动后**的新交易
- 忽略所有历史持仓
- 机器人从 0 仓位开始

### 切换到 Live 模式
```env
DRY_RUN=false                 # 改为 false
SYNC_INITIAL_POSITIONS=false  # 保持 false
MIRROR_RATIO=1.0             # 保持 1:1
```

**重要:** 在 Live 模式下，确保你的钱包有足够的 USDC 用于交易。

---

## 已知限制

1. **历史持仓不同步**
   - 目标交易者可能有既有盈利仓位
   - 机器人从零开始，无法获得这部分收益
   - 这是设计选择，风险更可控

2. **资金不足时**
   - 会用完全部可用余额买入
   - 不会跳过交易

3. **最小交易金额**
   - 小于 $0.01 的交易会被跳过

---

## 验证命令

```bash
# 运行测试套件
npm test

# 查看目标交易者当前持仓
npx ts-node src/check_target_positions.ts

# 启动 Dry-Run 模式
npm run start:dry

# 启动 Live 模式（谨慎使用）
npm run start:live
```

---

## 结论

✅ **Dry-Run 和 Live 模式的计算逻辑现已完全一致**

你可以放心地在 Dry-Run 模式下测试策略，确认无误后切换到 Live 模式，行为将完全相同。
