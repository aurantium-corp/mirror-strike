# Mirror-Strike Documentation

Mirror-Strike is a copy trading bot for Polymarket that monitors target trader wallets and mirrors their trades.

## Table of Contents

- [Installation](#installation)
- [Configuration](#configuration)
- [Dry-Run Mode](#dry-run-mode)
- [Running the Bot](#running-the-bot)
- [Testing](#testing)
- [Architecture](#architecture)

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file in the project root:

```env
# Required for live trading
PRIVATE_KEY=your_private_key_here
WALLET_ADDRESS=your_wallet_address_here

# Required for monitoring
TARGET_ADDRESSES=0xabc...,0xdef...

# Optional: Enable dry-run mode
DRY_RUN=true
```

## Dry-Run Mode

Dry-run mode allows you to test the mirroring logic without executing real trades. All trade actions are simulated and logged, with virtual positions and PnL tracked.

### Enabling Dry-Run Mode

Set the environment variable:

```bash
export DRY_RUN=true
```

Or use the npm script:

```bash
npm run start:dry
```

### What Dry-Run Mode Does

When `DRY_RUN=true`:

- ✅ No real trades are executed on Polymarket
- ✅ No CLOB client initialization (no API keys needed)
- ✅ Virtual balance starts at **$100 USDC**
- ✅ All intended trades are logged with `[DRY-RUN]` prefix
- ✅ Virtual positions are tracked per asset
- ✅ PnL is calculated and tracked
- ✅ **Insufficient funds detection** - logs when target trade exceeds available capital
- ✅ Trade history is maintained
- ✅ State is saved to `.watcher-state-dryrun.json` (separate from live state)

### Dry-Run Logs

Example dry-run output:

```
[Executor] 🧪 DRY-RUN MODE ENABLED - No real trades will be executed
[Executor] Virtual Balance: $100.00 USDC

------------------------------------------------
[DRY-RUN] Mirroring BUY from RainMaker
MARKET: Will it rain tomorrow?
ASSET: 0x1111...1111
SIDE: BUY
TARGET PRICE: 0.5
TARGET SIZE: 10 shares
TX HASH: 0xabc...
[DRY-RUN] Virtual Balance: $100.00 USDC
[DRY-RUN] Would BUY $5.00 worth of asset 0x1111...1111
[DRY-RUN] Price: 0.5, Size: 10.0000 shares
[DRY-RUN] Virtual position updated: 10.0000 shares @ avg $0.5000
[DRY-RUN] Remaining virtual balance: $95.00 USDC
------------------------------------------------
```

### Insufficient Funds Example

When a target's trade exceeds available virtual capital:

```
[DRY-RUN] Virtual Balance: $50.00 USDC
[DRY-RUN] INSUFFICIENT FUNDS - Would need $250.00 USDC, have $50.00 USDC
```

### Accessing Dry-Run State

The `Executor` class provides methods to access dry-run state:

```typescript
const executor = new Executor(true); // true = dry-run mode

// Check if in dry-run mode
if (executor.isDryRunMode()) {
  console.log('Running in dry-run mode');
}

// Get full dry-run state
const state = executor.getDryRunState();
console.log('Virtual Balance:', state.virtualBalance);
console.log('Total PnL:', state.totalPnL);
console.log('Trade History:', state.tradeHistory);

// Get position for specific asset
const position = executor.getVirtualPosition(assetId);
console.log('Position size:', position?.size);
console.log('Average entry:', position?.averageEntryPrice);

// Reset state (useful for testing)
executor.resetDryRunState(100); // Reset with $100 balance
```

### Dry-Run State Structure

```typescript
interface DryRunState {
  virtualBalance: number;           // Available virtual USDC
  virtualPositions: Map<string, VirtualPosition>;  // Asset positions
  totalPnL: number;                 // Cumulative profit/loss
  tradeHistory: DryRunTrade[];      // All simulated trades
}

interface VirtualPosition {
  asset: string;                    // Asset ID
  size: number;                     // Position size in shares
  averageEntryPrice: number;        // Average entry price
  totalCost: number;                // Total cost basis
}

interface DryRunTrade {
  timestamp: number;
  side: 'BUY' | 'SELL';
  asset: string;
  price: number;
  size: number;
  title: string;
  txHash: string;
  pnl?: number;                     // PnL for SELL trades
}
```

## Running the Bot

### Live Trading

```bash
npm start
# or
npm run start:live
```

### Dry-Run Mode

```bash
npm run start:dry
# or
DRY_RUN=true npm start
```

## Testing

The dry-run test suite verifies the mirroring logic without making real trades.

### Run All Tests

```bash
npm test
```

This runs the test suite in dry-run mode, executing:

1. **Scenario A**: Target BUY → Mirror BUY
2. **Scenario B**: Target SELL → Mirror SELL  
3. **Scenario C**: Duplicate Detection
4. **Scenario D**: Multiple Targets
5. **Scenario E**: No Position to SELL
6. **Scenario F**: Insufficient Funds
7. **Watcher Duplicate Detection**

### Test Output

```
╔══════════════════════════════════════════════════════════╗
║      Mirror-Strike Dry-Run Test Suite                    ║
╚══════════════════════════════════════════════════════════╝

🧪 Executing with DRY_RUN=true (no real trades)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Scenario A: Target BUY → Mirror BUY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ PASS: Scenario A: Target BUY → Mirror BUY

...

╔══════════════════════════════════════════════════════════╗
║                    TEST SUMMARY                          ║
╠══════════════════════════════════════════════════════════╣
║  Total Tests:  6                                         ║
║  Passed:        6                                        ║
║  Failed:        0                                        ║
╚══════════════════════════════════════════════════════════╝
```

### Test Scenarios Explained

#### Scenario A: Target BUY → Mirror BUY
- Target buys 10 shares at $0.5
- Verifies `[DRY-RUN] Would BUY` is logged
- Verifies virtual position is created
- Verifies virtual balance is reduced

#### Scenario B: Target SELL → Mirror SELL
- First buys to establish position
- Target sells 5 shares at $0.6
- Verifies `[DRY-RUN] Would SELL` is logged
- Verifies virtual position is reduced
- Verifies PnL is calculated

#### Scenario C: Duplicate Detection
- Same trade tx hash appears twice
- Verifies duplicate detection at executor level
- Note: Full duplicate detection happens at Watcher level

#### Scenario D: Multiple Targets
- Two targets trade simultaneously
- Verifies each target's trades are handled independently
- Verifies separate positions for different assets

#### Scenario E: No Position to SELL
- Target sells asset we don't hold
- Verifies `[DRY-RUN] Cannot SELL - no position held` is logged
- Verifies balance remains unchanged

#### Scenario F: Insufficient Funds
- Target attempts to buy with more capital than we have
- Verifies `[DRY-RUN] INSUFFICIENT FUNDS` is logged
- Verifies balance remains unchanged
- Verifies no position is created

## Architecture

### Components

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Watcher   │────▶│   Executor  │────▶│    CLOB     │
│             │     │             │     │    Client   │
│ - Polls API │     │ - Risk Mgmt │     │             │
│ - Tracks TX │     │ - Execute   │     │ - Live Mode │
│ - Dedupe    │     │ - Simulate  │     │ - Dry-Run   │
└─────────────┘     └─────────────┘     └─────────────┘
```

### Flow

1. **Watcher** polls Polymarket Data API for target addresses
2. New trades are detected and passed to **Executor**
3. **Executor** either:
   - **Live Mode**: Executes real trades via CLOB Client
   - **Dry-Run Mode**: Simulates trades, updates virtual state
4. State is persisted to disk for recovery

### Key Files

- `src/watcher.ts` - Monitors target wallets for new trades
- `src/executor.ts` - Executes or simulates trades
- `tests/dry-run.test.ts` - Test suite
- `tests/mock-data.ts` - Mock trade data for testing
