import axios from 'axios';
import dotenv from 'dotenv';
import { Executor } from './executor';
import * as fs from 'fs';
import * as path from 'path';
import { sendHexNotification } from './telegram/notifier';

dotenv.config();

// New Endpoint: Polymarket Data API
const API_URL = 'https://data-api.polymarket.com/activity';
const DRY_RUN = process.env.DRY_RUN === 'true';

// State file for persisting last checked timestamps across restarts
const STATE_FILE = path.join(__dirname, '..', DRY_RUN ? '.watcher-state-dryrun.json' : '.watcher-state.json');

interface WatcherState {
  [target: string]: {
    lastChecked: number;
    processedTxHashes: string[];
  };
}

export interface TradeActivity {
  transactionHash: string;
  timestamp: number;
  side: 'BUY' | 'SELL';
  asset: string;
  price: number;
  size: number;
  title: string;
  name?: string;
  pseudonym?: string;
  [key: string]: any;
}

export class Watcher {
  private targets: string[];
  private executor: Executor;
  private state: WatcherState;
  private readonly maxProcessedTxHashes: number = 100; // Keep last 100 tx hashes per target
  private isDryRun: boolean;
  private stateFile: string;

  constructor(targets: string[], executor: Executor, isDryRun: boolean = DRY_RUN) {
    // Normalize and filter empty targets
    this.targets = targets
      .map(t => t.toLowerCase().trim())
      .filter(t => t.length > 0);
    
    this.executor = executor;
    this.isDryRun = isDryRun;
    this.state = this.loadState();
    this.stateFile = path.join(process.cwd(), 'dashboard-watcher.json');
    
    if (this.isDryRun) {
      console.log('[Watcher] 🧪 Dry-run mode - state will be saved to .watcher-state-dryrun.json');
    }
  }

  /**
   * Scan existing positions for all targets
   * This provides visibility into what the whale is currently holding
   */
  private async scanInitialPositions(): Promise<void> {
    console.log('\n[Watcher] 🔍 Scanning initial positions for targets...');
    // await sendHexNotification('🔮 *Hex Starting Up*\n🔍 Scanning target positions...');
    
    for (const target of this.targets) {
      try {
        const url = `https://data-api.polymarket.com/positions?user=${target}`;
        const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const positions = response.data;

        if (Array.isArray(positions) && positions.length > 0) {
          console.log(`[Watcher] Target ${target} current positions:`);
          positions.forEach((p: any) => {
            if (parseFloat(p.size) !== 0) {
              const info = `• ${p.title}\n  Size: ${p.size} | Avg: ${p.avgPrice}`;
              console.log(`  ${info}`);
            }
          });
        } else {
          console.log(`[Watcher] Target ${target} has no active positions.`);
        }
      } catch (error) {
        console.error(`[Watcher] Failed to scan positions for ${target}:`, (error as Error).message);
      }
    }
    console.log('[Watcher] Scan complete.\n');
  }

  /**
   * Load persisted state from disk
   */
  private loadState(): WatcherState {
    try {
      if (fs.existsSync(STATE_FILE)) {
        const data = fs.readFileSync(STATE_FILE, 'utf-8');
        const parsed = JSON.parse(data);
        console.log(`[Watcher] Loaded state for ${Object.keys(parsed).length} targets`);
        return parsed;
      }
    } catch (error) {
      console.error('[Watcher] Failed to load state:', (error as Error).message);
    }
    return {};
  }

  /**
   * Save current state to disk
   */
  private saveState(): void {
    try {
      fs.writeFileSync(STATE_FILE, JSON.stringify(this.state, null, 2));
    } catch (error) {
      console.error('[Watcher] Failed to save state:', (error as Error).message);
    }
  }

  /**
   * Initialize state for a target if not exists
   */
  private initTargetState(target: string): void {
    if (!this.state[target]) {
      const now = Math.floor(Date.now() / 1000);
      this.state[target] = {
        lastChecked: now, 
        processedTxHashes: []
      };
      console.log(`[Watcher] New target ${target} - monitoring from ${new Date(now * 1000).toISOString()}`);
    }
  }

  /**
   * Check if a transaction has already been processed
   */
  private isProcessed(target: string, txHash: string): boolean {
    return this.state[target]?.processedTxHashes.includes(txHash) ?? false;
  }

  /**
   * Mark a transaction as processed
   */
  private markProcessed(target: string, txHash: string): void {
    if (!this.state[target]) return;
    
    this.state[target].processedTxHashes.push(txHash);
    if (this.state[target].processedTxHashes.length > this.maxProcessedTxHashes) {
      this.state[target].processedTxHashes = this.state[target].processedTxHashes.slice(-this.maxProcessedTxHashes);
    }
  }

  /**
   * Export state for dashboard
   */
  exportState(): void {
    try {
      const targetsStatus = this.targets.map(t => ({
        address: t,
        lastChecked: this.state[t]?.lastChecked || 0,
        txCount: this.state[t]?.processedTxHashes.length || 0
      }));
      
      const state = {
        timestamp: Date.now(),
        targets: targetsStatus
      };
      fs.writeFileSync(this.stateFile, JSON.stringify(state, null, 2));
    } catch (e) {
      console.error('[Watcher] Failed to export state:', e);
    }
  }

  private normalizeTimestamp(ts: number): number {
    return ts > 100000000000 ? Math.floor(ts / 1000) : ts;
  }

  /**
   * Poll a single target for new trade activity
   */
  private async pollTarget(target: string): Promise<void> {
    this.initTargetState(target);
    
    try {
      const url = `${API_URL}?user=${target}&type=TRADE&limit=20`;
      const response = await axios.get(url, { 
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 10000 
      });
      
      const activities: TradeActivity[] = response.data;
      if (!Array.isArray(activities) || activities.length === 0) return;

      const newTrades = activities.filter((trade: TradeActivity) => {
        const tradeTs = this.normalizeTimestamp(trade.timestamp);
        const isNewTimestamp = tradeTs > this.state[target].lastChecked;
        const isNewTx = !this.isProcessed(target, trade.transactionHash);
        return isNewTimestamp && isNewTx;
      });
      
      if (newTrades.length > 0) {
        console.log(`[!] New activity detected for target ${target}: ${newTrades.length} trade(s)`);
        newTrades.sort((a, b) => a.timestamp - b.timestamp);
        
        for (const trade of newTrades) {
          console.log(`[TRADE] ${trade.side} | ${trade.title} | Asset: ${trade.asset} | Tx: ${trade.transactionHash.slice(0, 16)}...`);
          try {
            await this.executor.execute(trade);
            this.markProcessed(target, trade.transactionHash);
          } catch (execError) {
            console.error(`[Watcher] Executor failed for trade ${trade.transactionHash}:`, (execError as Error).message);
          }
        }
        
        const newestTimestamp = Math.max(...newTrades.map(t => this.normalizeTimestamp(t.timestamp)));
        this.state[target].lastChecked = newestTimestamp;
        this.saveState();
      }
    } catch (error) {
      if (!axios.isAxiosError(error) || error.response?.status !== 404) {
        console.error(`[Watcher] Error polling ${target}:`, (error as Error).message);
      }
    }
  }

  async poll(): Promise<void> {
    if (this.targets.length === 0) return;
    for (const target of this.targets) {
      await this.pollTarget(target);
    }
    this.exportState();
  }

  /**
   * Start the watcher loop
   */
  async start(intervalMs: number = 2000): Promise<void> {
    if (this.targets.length === 0) {
      console.log('[Watcher] No targets configured. Bot will idle.');
      return;
    }

    console.log(`[Watcher] ${this.isDryRun ? '🧪 DRY-RUN MODE - ' : ''}Initializing executor...`);
    await this.executor.init();

    // MANDATORY: Force lastChecked to FUTURE (now + 60s) for ALL targets to ignore any historical or startup lag data
    const now = Math.floor(Date.now() / 1000) + 60;
    console.log(`[Watcher] 🕒 Synchronizing state to ${new Date(now * 1000).toISOString()} (60s Future offset) to ensure ZERO backfill...`);
    
    for (const target of this.targets) {
      this.state[target] = {
        lastChecked: now,
        processedTxHashes: []
      };
    }
    this.saveState();

    // Log current status
    await this.scanInitialPositions();

    console.log(`[Watcher] ✅ Monitoring ${this.targets.length} target(s) for NEW live trades (Interval: ${intervalMs}ms).`);
    
    // Start loop
    await this.poll();
    setInterval(() => this.poll(), intervalMs);
    setInterval(() => this.saveState(), 30000);
  }

  addTarget(target: string): void {
    const normalized = target.toLowerCase().trim();
    if (!this.targets.includes(normalized)) {
      this.targets.push(normalized);
      this.initTargetState(normalized);
    }
  }

  removeTarget(target: string): void {
    const normalized = target.toLowerCase().trim();
    this.targets = this.targets.filter(t => t !== normalized);
    delete this.state[normalized];
    this.saveState();
  }

  getTargets(): string[] {
    return [...this.targets];
  }
}