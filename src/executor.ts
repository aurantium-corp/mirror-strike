import axios from 'axios';
import { ClobClient, Side } from '@polymarket/clob-client';
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY!;
const WALLET_ADDRESS = process.env.WALLET_ADDRESS!;
const DRY_RUN = process.env.DRY_RUN === 'true';
const USDC_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
const CTF_ADDRESS = '0x4D97DCd97eC945f40cF65F87097CCe65Ea957C55';
const ERC20_ABI = ["function balanceOf(address owner) view returns (uint256)"];
const CTF_ABI = [
  "function balanceOf(address account, uint256 id) view returns (uint256)",
  "function redeemPositions(address collateralToken, bytes32 parentCollectionId, bytes32 conditionId, uint256[] indexSets)"
];

export interface TradeActivity {
  transactionHash: string;
  timestamp: number;
  side: 'BUY' | 'SELL' | 'REDEEM' | 'MERGE';
  asset: string;
  price: number;
  size: number;
  title: string;
  name?: string;
  pseudonym?: string;
  usdcSize?: number;
  conditionId?: string;
  [key: string]: any;
}

export interface DryRunState {
  virtualBalance: number;
  virtualPositions: Map<string, any>;
  totalPnL: number;
  tradeHistory: any[];
}

export class Executor {
  private client!: ClobClient;
  private signer!: ethers.Wallet;
  private provider!: ethers.providers.JsonRpcProvider;
  private usdc!: ethers.Contract;
  private ctf!: ethers.Contract;
  private isInitialized: boolean = false;
  private isDryRun: boolean;
  private mirrorRatio: number;
  private stateFile: string;

  private dryRunState: DryRunState;
  
  // Price cache to avoid API call jitter
  private priceCache: Map<string, { price: number; timestamp: number }> = new Map();
  private readonly PRICE_CACHE_TTL = 60000; // 60 seconds

  constructor(isDryRun: boolean = DRY_RUN) {
    this.isDryRun = isDryRun;
    this.mirrorRatio = parseFloat(process.env.MIRROR_RATIO || '1.0');
    this.stateFile = path.join(process.cwd(), 'dashboard-executor.json');

    const initialBalance = parseFloat(process.env.DRY_RUN_WALLET_BALANCE || '1000');
    this.dryRunState = { 
      virtualBalance: initialBalance, 
      virtualPositions: new Map<string, any>(), 
      totalPnL: 0, 
      tradeHistory: [] as any[] 
    };

    console.log(`[Executor] 🚀 INITIALIZING EXECUTOR | PID: ${process.pid} | MODE: ${this.isDryRun ? 'DRY-RUN' : 'LIVE'} | MIRROR_RATIO: ${this.mirrorRatio} | BALANCE: $${initialBalance}`);

    if (this.isDryRun) {
      this.isInitialized = true;
      this.exportState();
      return;
    }

    this.provider = new ethers.providers.JsonRpcProvider('https://polygon-rpc.com');
    this.signer = new ethers.Wallet(PRIVATE_KEY, this.provider);
    this.usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, this.provider);
    this.ctf = new ethers.Contract(CTF_ADDRESS, CTF_ABI, this.provider);
    
    this.client = new ClobClient('https://clob.polymarket.com', 137, this.signer, undefined, 1, WALLET_ADDRESS);
    this.exportState();
  }

  async init(): Promise<void> {
    if (this.isInitialized || this.isDryRun) { this.isInitialized = true; return; }
    try {
      console.log('[Executor] 🔐 Initializing Live CLOB Client...');
      const apiCreds = await this.client.createOrDeriveApiKey();
      this.client = new ClobClient('https://clob.polymarket.com', 137, this.signer, apiCreds, 1, WALLET_ADDRESS);
      this.isInitialized = true;
      console.log('[Executor] ✅ Live CLOB Client Ready.');
    } catch (e) {
      console.error('[Executor] ❌ Init failed:', (e as any).message);
      throw e;
    }
  }

  private async retryHelper<T>(operation: () => Promise<T>, retries: number = 3, delay: number = 1000): Promise<T> {
    try { return await operation(); } catch (error) {
      if (retries > 0) {
        console.warn(`[RETRY] Retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        return this.retryHelper(operation, retries - 1, delay * 1.5);
      }
      throw error;
    }
  }

  async exportState(): Promise<void> {
    try {
      // Cash = available balance for trading
      let cash = this.isDryRun ? this.dryRunState.virtualBalance : await this.getBalance();
      
      const positions = Array.from(this.dryRunState.virtualPositions.values());
      
      // Calculate total cost basis (how much we invested)
      const totalInvested = positions.reduce((sum, pos) => sum + (pos.totalCost || 0), 0);
      
      // Try to calculate portfolio market value if we have current prices
      let portfolioMarketValue = 0;
      let hasMarketPrice = false;
      
      // Clean up expired price cache entries
      const now = Date.now();
      for (const [key, entry] of this.priceCache.entries()) {
        if (now - entry.timestamp > this.PRICE_CACHE_TTL) {
          this.priceCache.delete(key);
        }
      }
      
      // In dry-run mode, fetch current prices from CLOB API with caching
      if (this.isDryRun) {
        for (const pos of positions) {
          try {
            // Check if we have a valid cached price
            const cachedEntry = this.priceCache.get(pos.asset);
            let currentPrice: number | undefined;
            
            if (cachedEntry && (now - cachedEntry.timestamp < this.PRICE_CACHE_TTL)) {
              currentPrice = cachedEntry.price;
            }
            
            // Fetch price from API if not cached or expired
            if (currentPrice === undefined && pos.conditionId) {
              const response = await axios.get(
                `https://clob.polymarket.com/markets/${pos.conditionId}`,
                { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 5000 }
              );
              
              // Extract price from tokens array
              const tokens = response.data?.tokens || [];
              for (const token of tokens) {
                if (token.token_id === pos.asset) {
                  currentPrice = parseFloat(token.price || '0');
                  // Cache the price
                  this.priceCache.set(pos.asset, { price: currentPrice, timestamp: Date.now() });
                  break;
                }
              }
            }
            
            if (currentPrice && currentPrice > 0) {
              pos.curPrice = currentPrice;
              portfolioMarketValue += pos.size * currentPrice;
              hasMarketPrice = true;
            } else {
              // Fallback to cost basis if no price available
              portfolioMarketValue += pos.totalCost || 0;
            }
          } catch (e) {
            // On API error, try to use cached price even if expired
            const cachedEntry = this.priceCache.get(pos.asset);
            if (cachedEntry && cachedEntry.price > 0) {
              pos.curPrice = cachedEntry.price;
              portfolioMarketValue += pos.size * cachedEntry.price;
              hasMarketPrice = true;
            } else {
              // Final fallback to cost basis
              portfolioMarketValue += pos.totalCost || 0;
            }
          }
        }
      } else {
        for (const pos of positions) {
          const marketPrice = pos.currentPrice || pos.curPrice;
          if (marketPrice && marketPrice > 0) {
            portfolioMarketValue += pos.size * marketPrice;
            hasMarketPrice = true;
          } else {
            // Fallback to cost basis if no market price
            portfolioMarketValue += pos.totalCost || 0;
          }
        }
      }
      
      // Total Balance = Cash + Portfolio Market Value
      // This represents: available cash + current value of holdings
      const totalBalance = cash + portfolioMarketValue;
      
      // Calculate unrealized PnL (paper gains/losses on current positions)
      const unrealizedPnL = hasMarketPrice ? (portfolioMarketValue - totalInvested) : 0;
      
      // Total PnL = Realized (from closed trades) + Unrealized (from open positions)
      const totalPnL = this.dryRunState.totalPnL + unrealizedPnL;
      
      const state = {
        timestamp: Date.now(),
        mode: this.isDryRun ? 'DRY-RUN' : 'LIVE',
        cash: cash,                           // Available cash for trading
        invested: totalInvested,              // Total cost basis (how much we put in)
        portfolio: portfolioMarketValue,      // Current market value of positions
        balance: totalBalance,                // Total account value (cash + portfolio market value)
        realizedPnL: this.dryRunState.totalPnL,  // PnL from closed trades
        unrealizedPnL: unrealizedPnL,         // Paper gains/losses on open positions
        totalPnL: totalPnL,                   // Combined PnL
        hasMarketPrice: hasMarketPrice,       // Whether portfolio value uses real market prices
        mirrorRatio: this.mirrorRatio,
        positions: positions,
        lastTrade: this.dryRunState.tradeHistory.slice(-1)[0] || null
      };
      
      const tempFile = `${this.stateFile}.tmp`;
      fs.writeFileSync(tempFile, JSON.stringify(state, null, 2));
      fs.renameSync(tempFile, this.stateFile);
    } catch (e) {
      // Quiet fail
    }
  }

  getDryRunState(): DryRunState {
    // Return a deep clone to prevent external mutations and enable proper state comparison
    return {
      virtualBalance: this.dryRunState.virtualBalance,
      virtualPositions: new Map(this.dryRunState.virtualPositions),
      totalPnL: this.dryRunState.totalPnL,
      tradeHistory: [...this.dryRunState.tradeHistory]
    };
  }

  resetDryRunState(balance: number, mirrorRatio?: number): void {
    this.dryRunState = { virtualBalance: balance, virtualPositions: new Map<string, any>(), totalPnL: 0, tradeHistory: [] as any[] };
    if (mirrorRatio !== undefined) {
      this.mirrorRatio = mirrorRatio;
    }
  }

  async getBalance(): Promise<number> {
    try {
      const b = await this.usdc.balanceOf(WALLET_ADDRESS);
      return parseFloat(ethers.utils.formatUnits(b, 6));
    } catch (e) { return 0; }
  }

  async getPositionSize(assetId: string): Promise<number> {
    try {
      const b = await this.ctf.balanceOf(WALLET_ADDRESS, assetId);
      return parseFloat(ethers.utils.formatUnits(b, 0));
    } catch (e) { return 0; }
  }

  async getMyPositions(): Promise<any[]> {
    if (this.isDryRun) {
        return Array.from(this.dryRunState.virtualPositions.values());
    }
    try {
        const url = `https://data-api.polymarket.com/positions?user=${WALLET_ADDRESS}`;
        const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        return Array.isArray(response.data) ? response.data.filter((p: any) => parseFloat(p.size) > 0) : [];
    } catch (e) {
        return [];
    }
  }

  /**
   * Parse market end time from title (e.g., "Bitcoin Up or Down - February 17, 10:45AM-10:50AM ET")
   * Returns the end time as a Date object, or null if cannot parse
   */
  private parseMarketEndTime(title: string): Date | null {
    try {
      const currentYear = new Date().getFullYear();
      
      // Pattern: "Month DD, HH:MMAM-HH:MMAM ET" or "Month DD, HH:MMAM ET"
      const timeRangeMatch = title.match(/([A-Za-z]+\s+\d+),\s*(\d+:\d+[AP]M)-(\d+:\d+[AP]M)\s*ET/);
      const singleTimeMatch = title.match(/([A-Za-z]+\s+\d+),\s*(\d+[AP]M)\s*ET/);
      
      if (timeRangeMatch) {
        // Has time range like "10:45AM-10:50AM"
        const dateStr = timeRangeMatch[1]; // "February 17"
        const endTimeStr = timeRangeMatch[3]; // "10:50AM"
        const fullDateStr = `${dateStr} ${currentYear} ${endTimeStr} UTC-0500`;
        return new Date(fullDateStr);
      } else if (singleTimeMatch) {
        // Has single time like "10AM"
        const dateStr = singleTimeMatch[1]; // "February 17"
        const timeStr = singleTimeMatch[2]; // "10AM"
        const fullDateStr = `${dateStr} ${currentYear} ${timeStr} UTC-0500`;
        return new Date(fullDateStr);
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Check if a market has expired based on its title
   */
  private isMarketExpired(title: string): boolean {
    const endTime = this.parseMarketEndTime(title);
    if (!endTime) return false;
    
    // Add 5 minute buffer after market end to allow final settlements
    const bufferMs = 5 * 60 * 1000;
    return Date.now() > (endTime.getTime() + bufferMs);
  }

  /**
   * Proactively check and redeem any resolved positions
   */
  async autoCleanup(): Promise<void> {
    console.log(`[Executor] 🧹 Running auto-cleanup...`);
    const positions = await this.getMyPositions();
    console.log(`[Cleanup] Checking ${positions.length} positions...`);
    if (positions.length === 0) return;

    let removedCount = 0;
    for (const pos of positions) {
        const title = pos.title || '';
        
        // Check if market has expired based on title
        const isExpired = this.isMarketExpired(title);
        console.log(`[Cleanup] Checking: ${title.substring(0, 50)}... expired=${isExpired}`);
        
        if (isExpired) {
            console.log(`[Cleanup] ⏰ Market EXPIRED: ${title}`);
            const assetId = pos.asset || pos.assetId || pos.conditionId;
            console.log(`[Cleanup] AssetId: ${assetId}`);
            if (assetId) {
                // Remove expired position without redeeming (market is closed)
                if (this.isDryRun) {
                    const hadPosition = this.dryRunState.virtualPositions.has(assetId);
                    this.dryRunState.virtualPositions.delete(assetId);
                    if (hadPosition) {
                        removedCount++;
                        console.log(`[Cleanup] 🗑️  Removed expired position from dry-run: ${title}`);
                    }
                }
            }
            continue;
        }
        
        // In Polymarket API, resolved positions often have specific flags or 
        // we can identify them if the current price is 0 or 1.
        let curPrice = parseFloat(pos.curPrice || pos.currentPrice || "0.5");
        
        // In Dry-Run, virtual positions might not have updated prices. Fetch if needed.
        if (this.isDryRun && (!pos.curPrice || pos.curPrice === undefined)) {
            try {
                // Determine asset ID (conditionId or asset)
                const assetId = pos.asset || pos.assetId || pos.conditionId;
                if (assetId && this.client) {
                   const price = await this.client.getMidpoint(assetId);
                   if (price) {
                       // price might be an object or string depending on SDK version, cast to string safe
                       curPrice = parseFloat(price.toString());
                       pos.curPrice = curPrice; // Update virtual position for next check
                   }
                }
            } catch (e) {
                // Ignore, keep default
            }
        }

        const isResolved = curPrice <= 0.01 || curPrice >= 0.99;
        
        if (isResolved) {
            console.log(`[Cleanup] Found resolved position: ${pos.title} (Price: ${curPrice})`);
            const assetId = pos.asset || pos.assetId || pos.conditionId;
            if (assetId) {
                await this.executeRedeem({
                    transactionHash: 'internal-cleanup',
                    timestamp: Date.now(),
                    side: 'REDEEM',
                    asset: assetId,
                    price: curPrice,
                    size: parseFloat(pos.size),
                    title: pos.title,
                    conditionId: pos.conditionId || assetId
                });
            }
        }
    }
    
    // Export state after cleanup
    await this.exportState();
  }

  async execute(trade: TradeActivity): Promise<void> {
    if (!this.isInitialized) return;
    console.log(`[${this.isDryRun ? 'DRY-RUN' : 'LIVE EXECUTION'}] Mirroring ${trade.side} - ${trade.title}`);

    try {
      if (this.isDryRun) {
        await this.simulateTrade(trade);
      } else {
        if (trade.side === 'BUY') await this.executeBuy(trade);
        else if (trade.side === 'SELL') await this.executeSell(trade);
        else if (trade.side === 'REDEEM') await this.executeRedeem(trade);
        else if (trade.side === 'MERGE') await this.executeMerge(trade);
      }
    } catch (e) {
      console.error(`[EXECUTION ERROR] ${(e as any).message}`);
    }
  }

  private async executeRedeem(trade: TradeActivity): Promise<void> {
    if (!trade.conditionId) {
        console.warn(`[REDEEM] Skipped - No conditionId provided`);
        return;
    }
    console.log(`[ACTION] REDEEMing for condition: ${trade.conditionId}`);
    try {
        if (this.isDryRun) return; // Already handled in simulateTrade

        // CTF redeemPositions parameters:
        // collateralToken, parentCollectionId (0x...0), conditionId, indexSets ([1, 2])
        // Most Polymarket markets use indexSets [1, 2] for Yes/No
        const tx = await this.ctf.connect(this.signer).redeemPositions(
            USDC_ADDRESS,
            ethers.constants.HashZero,
            trade.conditionId,
            [1, 2]
        );
        console.log(`[SUCCESS] REDEEM TX Sent: ${tx.hash}`);
        await tx.wait();
        console.log(`[SUCCESS] REDEEM Confirmed`);
        await this.exportState();
    } catch (err) {
        console.error(`[ERROR] REDEEM failed: ${(err as any).message}`);
    }
  }

  private async executeMerge(trade: TradeActivity): Promise<void> {
    // Merge typically happens when target has both YES/NO or is cleaning up
    // In many cases, it's safer to just let the user handle merge, 
    // but we can attempt to merge if we hold the asset
    console.log(`[ACTION] MERGE requested for: ${trade.title}`);
    try {
        // Polymarket clob-client uses mergePositions
        // Note: This requires specific conditionId and amounts
        // For now we log and try a basic merge if possible, or skip if complex
        console.log(`[SKIPPED] MERGE is currently monitoring-only in Live mode to prevent complex state issues.`);
    } catch (err) {
        console.error(`[ERROR] MERGE failed: ${(err as any).message}`);
    }
  }

  private async executeBuy(trade: TradeActivity): Promise<void> {
    const balance = await this.getBalance();
    // Use target's exact USDC size, default to calculated if missing
    const targetUsdcSize = trade.usdcSize || (trade.size * trade.price);
    const scaledUsdcAmount = targetUsdcSize * this.mirrorRatio;
    const tradeUsdcAmount = Math.min(balance, scaledUsdcAmount);

    console.log(`[SCALE] Target: $${targetUsdcSize.toFixed(2)} × ${this.mirrorRatio} = $${scaledUsdcAmount.toFixed(2)} | Actual: $${tradeUsdcAmount.toFixed(2)}`);

    if (tradeUsdcAmount < 0.01) {
        console.log(`[SKIPPED] Amount too small ($${tradeUsdcAmount.toFixed(4)}) or zero balance.`);
        return;
    }

    let slippage = 1.02; // Start with 2% slippage allowance
    for (let i = 0; i < 3; i++) {
      try {
        let priceLimit = trade.price * slippage;
        if (priceLimit >= 1.0) priceLimit = 0.999;
        
        // Calculate shares based on our target USDC amount and target's entry price
        // Note: CLOB will fill at best available price up to priceLimit
        const sharesToBuy = tradeUsdcAmount / trade.price;

        console.log(`[ACTION] BUY Attempt ${i+1} | Target: $${tradeUsdcAmount.toFixed(2)} | Max Price: ${priceLimit.toFixed(4)}`);
        
        const order = await this.client.createAndPostOrder({
          tokenID: trade.asset, 
          price: parseFloat(priceLimit.toFixed(4)), 
          side: Side.BUY, 
          size: parseFloat(sharesToBuy.toFixed(4)), 
          feeRateBps: 0
        });
        
        console.log(`[SUCCESS] BUY Order Posted: ${JSON.stringify(order)}`);
        await this.exportState();
        return;
      } catch (err) {
        console.warn(`[RETRY] BUY Failed: ${(err as any).message}`);
        slippage += 0.03; // Increase slippage on retry
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }
  }

  private async executeSell(trade: TradeActivity): Promise<void> {
    const pos = await this.getPositionSize(trade.asset);
    if (pos <= 0) return;

    // Calculate proportional sell size based on target's sell amount
    const targetSellUsdc = trade.usdcSize || (trade.size * trade.price);
    const scaledSellUsdc = targetSellUsdc * this.mirrorRatio;
    const sellShares = scaledSellUsdc / trade.price;
    let sellSize = Math.min(pos, sellShares);
    // If calculated sell >= 99% of position, sell everything to avoid dust
    if (sellSize >= pos * 0.99) sellSize = pos;

    console.log(`[SCALE] Sell target: $${targetSellUsdc.toFixed(2)} × ${this.mirrorRatio} = $${scaledSellUsdc.toFixed(2)} | Shares: ${sellSize.toFixed(4)} / ${pos.toFixed(4)}`);

    let slippage = 0.98;
    for (let i = 0; i < 3; i++) {
      try {
        let price = trade.price * slippage;
        if (price <= 0) price = 0.001;
        console.log(`[ACTION] SELL Attempt ${i+1} | Price: ${price.toFixed(4)}`);
        await this.client.createAndPostOrder({
          tokenID: trade.asset, price, side: Side.SELL, size: sellSize, feeRateBps: 0
        });
        console.log(`[SUCCESS] SELL Executed`);
        await this.exportState();
        return;
      } catch (err) {
        console.warn(`[RETRY] SELL Failed: ${(err as any).message}`);
        slippage -= 0.02;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  private async simulateTrade(trade: TradeActivity) {
    const targetUsdc = trade.usdcSize || (trade.size * trade.price);
    const scaledUsdc = targetUsdc * this.mirrorRatio;

    if (trade.side === 'BUY') {
      // Use all available balance if scaled amount exceeds balance (consistent with Live mode)
      const tradeSize = Math.min(this.dryRunState.virtualBalance, scaledUsdc);
      if (scaledUsdc > this.dryRunState.virtualBalance) {
        console.log(`[DRY-RUN] INSUFFICIENT FUNDS - Would need $${scaledUsdc.toFixed(2)} USDC, have $${this.dryRunState.virtualBalance.toFixed(2)} USDC`);
        console.log(`[DRY-RUN] Using all available balance: $${tradeSize.toFixed(2)} USDC`);
      }
      if (tradeSize < 0.01) return;
      const shares = tradeSize / trade.price;
      this.dryRunState.virtualBalance -= tradeSize;

      // Update virtual position
      const existing = this.dryRunState.virtualPositions.get(trade.asset);
      if (existing) {
        const newTotalCost = existing.totalCost + tradeSize;
        const newSize = existing.size + shares;
        existing.size = newSize;
        existing.totalCost = newTotalCost;
        existing.averageEntryPrice = newTotalCost / newSize;
      } else {
        this.dryRunState.virtualPositions.set(trade.asset, {
          asset: trade.asset,
          conditionId: trade.conditionId,
          title: trade.title,
          outcome: trade.outcome, // Store outcome (Up/Down) to distinguish positions
          size: shares,
          averageEntryPrice: trade.price,
          totalCost: tradeSize
        });
      }

      console.log(`[DRY-RUN] Would BUY ${shares.toFixed(4)} shares at $${trade.price} (cost: $${tradeSize.toFixed(2)})`);
      this.dryRunState.tradeHistory.push({ side: 'BUY', title: trade.title, amount: tradeSize, shares });
    } else if (trade.side === 'SELL') {
      const position = this.dryRunState.virtualPositions.get(trade.asset);
      if (!position || position.size <= 0) {
        console.log(`[DRY-RUN] Cannot SELL - no position held`);
        return;
      }

      const scaledShares = scaledUsdc / trade.price;
      let sellShares = Math.min(position.size, scaledShares);
      // If calculated sell >= 99% of position, sell everything to avoid dust
      if (sellShares >= position.size * 0.99) sellShares = position.size;
      const sellProceeds = sellShares * trade.price;
      const costBasis = sellShares * position.averageEntryPrice;
      const pnl = sellProceeds - costBasis;

      position.size -= sellShares;
      position.totalCost -= costBasis;
      if (position.size < 0.0001) {
        this.dryRunState.virtualPositions.delete(trade.asset);
      }

      this.dryRunState.virtualBalance += sellProceeds;
      this.dryRunState.totalPnL += pnl;

      console.log(`[DRY-RUN] Would SELL ${sellShares.toFixed(4)} shares at $${trade.price} (proceeds: $${sellProceeds.toFixed(2)}, PnL: $${pnl.toFixed(2)})`);
      this.dryRunState.tradeHistory.push({ side: 'SELL', title: trade.title, shares: sellShares, proceeds: sellProceeds, pnl });
    } else if (trade.side === 'REDEEM') {
      // Try to find position by asset first, then by conditionId
      let position = this.dryRunState.virtualPositions.get(trade.asset);
      if (!position && trade.conditionId) {
          for (const p of this.dryRunState.virtualPositions.values()) {
              if (p.conditionId === trade.conditionId) {
                  position = p;
                  break;
              }
          }
      }

      if (position && position.size > 0) {
        const amount = position.size; // 1 share = 1 USDC on win
        const costBasis = position.totalCost;
        const pnl = amount - costBasis;
        
        this.dryRunState.virtualBalance += amount;
        this.dryRunState.totalPnL += pnl;
        this.dryRunState.virtualPositions.delete(position.asset);
        
        console.log(`[DRY-RUN] Would REDEEM ${amount.toFixed(4)} winning shares for $${amount.toFixed(2)} (PnL: $${pnl.toFixed(2)})`);
        this.dryRunState.tradeHistory.push({ side: 'REDEEM', title: trade.title, amount, pnl });
      } else {
        console.log(`[DRY-RUN] REDEEM detected for ${trade.title} but we hold no position.`);
      }
    } else if (trade.side === 'MERGE') {
      // Try to find position by asset first, then by conditionId
      let position = this.dryRunState.virtualPositions.get(trade.asset);
      if (!position && trade.conditionId) {
          for (const p of this.dryRunState.virtualPositions.values()) {
              if (p.conditionId === trade.conditionId) {
                  position = p;
                  break;
              }
          }
      }

      if (position && position.size > 0) {
        const proceeds = position.size * (trade.price || 1.0);
        this.dryRunState.virtualBalance += proceeds;
        this.dryRunState.virtualPositions.delete(position.asset);
        console.log(`[DRY-RUN] Would MERGE positions for ${trade.title} (Proceeds: $${proceeds.toFixed(2)})`);
      }
    }
    await this.exportState();
  }

  /**
   * Force cleanup all expired positions immediately
   * This can be called via API or on startup
   */
  async forceCleanupExpiredPositions(): Promise<{ removed: number; remaining: number }> {
    console.log(`[Executor] 🧹 Force cleaning up expired positions...`);
    const positions = await this.getMyPositions();
    let removedCount = 0;
    
    for (const pos of positions) {
      const title = pos.title || '';
      if (this.isMarketExpired(title)) {
        const assetId = pos.asset || pos.assetId || pos.conditionId;
        if (assetId && this.isDryRun) {
          if (this.dryRunState.virtualPositions.has(assetId)) {
            this.dryRunState.virtualPositions.delete(assetId);
            removedCount++;
            console.log(`[ForceCleanup] 🗑️  Removed: ${title}`);
          }
        }
      }
    }
    
    await this.exportState();
    const remaining = this.dryRunState.virtualPositions.size;
    console.log(`[ForceCleanup] ✅ Removed ${removedCount} expired positions, ${remaining} remaining`);
    return { removed: removedCount, remaining };
  }
}
