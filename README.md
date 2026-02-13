# Mirror-Strike 📈

**Polymarket Copy Trading Bot** — Automatically mirror CLOB trades from target wallets.

## 🎯 What It Does

Mirror-Strike monitors specified Ethereum addresses (your "targets") on Polymarket and automatically copies their CLOB (Central Limit Order Book) trades to your own account in real-time.

### Features

- **Real-time Trade Mirroring:** Automatically executes BUY/SELL orders to match target trades
- **Multiple Targets:** Monitor multiple wallets simultaneously
- **Dry-Run Mode:** Test strategies without risking real funds (`DRY_RUN=true`)
- **Mirror Ratio:** Scale trade sizes (default 1:1, configurable via `MIRROR_RATIO`)
- **Position Tracking:** Tracks virtual portfolio in dry-run mode
- **State Persistence:** Saves state across restarts (processed tx hashes, timestamps)
- **Dashboard Export:** Generates JSON state files for external monitoring
- **Whale Notifications:** Optional Telegram alerts for significant trades
- **Retry Logic:** Automatic retries with progressive slippage adjustment

## 📋 Prerequisites

- Node.js (v18+)
- npm or yarn
- Polymarket account with funded wallet (USDC on Polygon)
- Private key with permissions on your wallet

## 🚀 Installation

```bash
# Clone the repository
git clone https://github.com/sivahuang77/mirror-strike.git
cd mirror-strike

# Install dependencies
npm install

# Build TypeScript
npm run build
```

## ⚙️ Configuration

Create a `.env` file in the project root:

```env
# Required: Your Polymarket wallet credentials
PRIVATE_KEY=0x...
WALLET_ADDRESS=0x...

# Required: Target wallets to mirror (comma-separated)
TARGET_ADDRESSES=0x123...,0x456...

# Optional: Trade scaling factor (default: 1.0 = 100% mirror)
MIRROR_RATIO=1.0

# Optional: Dry-run mode (true = simulation only, false = live trading)
DRY_RUN=true
```

### Environment Variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `PRIVATE_KEY` | ✅ | Your wallet's private key | — |
| `WALLET_ADDRESS` | ✅ | Your wallet address (must match private key) | — |
| `TARGET_ADDRESSES` | ✅ | Comma-separated list of addresses to mirror | — |
| `MIRROR_RATIO` | ❌ | Trade size multiplier (e.g., 0.5 = 50% of target trade) | `1.0` |
| `DRY_RUN` | ❌ | `true` for simulation, `false` for live trading | `false` |

## 🏃 Usage

### Start Bot (Dry Run)

```bash
# Test without risking real funds
DRY_RUN=true npm start
```

### Start Bot (Live Trading)

```bash
# Live trading - ensure sufficient USDC balance
npm start
```

### Run Tests

```bash
# Dry-run test
npm test

# Live test (actual API calls, no orders)
npm run test:live
```

### Build

```bash
npm run build
```

## 🏗️ Architecture

```
src/
├── index.ts           # Entry point, starts watcher loop
├── watcher.ts         # Monitors targets for new trades via Polymarket API
├── executor.ts        # Executes mirrored trades on your account
├── telegram/          # Optional notification system
└── tests/            # Test utilities

knowledge/            # Trading knowledge base (market rules, conditions)
conductor/            # (Reserved for future multi-bot orchestration)
```

### How It Works

1. **Watcher** polls Polymarket Data API for each target address at 2-second intervals
2. Detects new `TRADE` activity (BUY/SELL orders)
3. Filters out already-processed transactions using state persistence
4. **Executor** mirrors the trade on your account:
   - **BUY:** Orders shares at target price with slippage allowance (retries with higher slippage)
   - **SELL:** Sells existing position proportionally based on target's sell size
5. Updates state (processed tx hashes, last checked timestamp)
6. Exports JSON state for dashboard monitoring

### Trade Execution Logic

**Buys:**
- Scales USDC amount by `MIRROR_RATIO`
- Limits order price to target price + slippage (starts at 2%, increases on retry)
- Retries up to 3 times if order fills fail

**Sells:**
- Calculates proportional sell size based on target's USDC value
- Sells up to 90% of held position to avoid dust
- Retries with decreasing slippage

**Dry-Run:**
- Simulates trades with virtual balance ($1000 USDC default)
- Tracks virtual PnL
- No real orders placed

## 📊 Dashboard State Files

The bot generates JSON files for monitoring:

- `dashboard-watcher.json` — Target monitoring status, last checked times, USDC balances, positions
- `dashboard-executor.json` — Your portfolio, cash, positions, recent trades
- `.watcher-state.json` — Internal state (processed tx hashes, timestamps)

## ⚠️ Important Notes

- **Initial Sync:** On first run, the bot syncs to `now + 60s` to avoid processing historical trades
- **USDC Balance:** Ensure sufficient USDC in your wallet (on Polygon) for buy orders
- **Slippage:** Progressive slippage adjustment helps fill orders in volatile markets
- **No Position Mirroring:** The bot mirrors *trades*, not portfolio states. If a target holds a position you don't, it won't buy until they trade
- **RPC Provider:** Uses `https://polygon-rpc.com` for balance queries

## 🔒 Security

- **Never commit `.env` file** — contains sensitive credentials
- **Private Key:** Store securely, use environment variables only
- **Dry-Run First:** Always test strategies in dry-run mode before going live

## 🐛 Troubleshooting

**"No targets configured"**
- Check `TARGET_ADDRESSES` in `.env`
- Ensure addresses are comma-separated with no spaces

**"Insufficient funds"**
- Check USDC balance on Polygon: `balanceOf(WALLET_ADDRESS)`
- Fund wallet with USDC on Polygon network

**Orders not filling**
- Check slippage settings in logs
- Market may have moved between detection and execution
- Consider reducing `MIRROR_RATIO` for faster fills

**API errors**
- Verify Polymarket API is accessible
- Check rate limits (bot polls at 2s intervals)

## 📄 License

ISC

## 🤝 Contributing

Contributions welcome! Please ensure:
1. All tests pass
2. Dry-run mode always works
3. No hardcoded credentials
4. Clear commit messages

---

**⚠️ DISCLAIMER:** This bot is for educational purposes. Trading prediction markets involves significant risk. Use at your own risk. The authors are not responsible for any financial losses.
