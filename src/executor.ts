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
const CTF_ABI = ["function balanceOf(address account, uint256 id) view returns (uint256)"];

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

export class Executor {
  private client!: ClobClient;
  private signer!: ethers.Wallet;
  private provider!: ethers.providers.JsonRpcProvider;
  private usdc!: ethers.Contract;
  private ctf!: ethers.Contract;
  private isInitialized: boolean = false;
  private isDryRun: boolean;
  private stateFile: string;
  
  private dryRunState = { virtualBalance: 300, virtualPositions: new Map<string, any>(), totalPnL: 0, tradeHistory: [] as any[] };

  constructor(isDryRun: boolean = DRY_RUN) {
    this.isDryRun = isDryRun;
    this.stateFile = path.join(process.cwd(), 'dashboard-executor.json');
    console.log(`[Executor] Starting PID: ${process.pid} | Mode: ${this.isDryRun ? 'DRY-RUN' : 'LIVE'}`);

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
      let cash = this.isDryRun ? this.dryRunState.virtualBalance : await this.getBalance();
      const state = {
        timestamp: Date.now(),
        mode: this.isDryRun ? 'DRY-RUN' : 'LIVE',
        cash: cash,
        portfolio: cash,
        balance: cash,
        totalPnL: this.dryRunState.totalPnL,
        positions: Array.from(this.dryRunState.virtualPositions.values()),
        lastTrade: this.dryRunState.tradeHistory.slice(-1)[0] || null
      };
      fs.writeFileSync(this.stateFile, JSON.stringify(state, null, 2));
    } catch (e) {}
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

  async execute(trade: TradeActivity): Promise<void> {
    if (!this.isInitialized) return;
    console.log(`[${this.isDryRun ? 'DRY-RUN' : 'LIVE EXECUTION'}] Mirroring ${trade.side} - ${trade.title}`);

    try {
      if (this.isDryRun) {
        await this.simulateTrade(trade);
      } else {
        if (trade.side === 'BUY') await this.executeBuy(trade);
        else await this.executeSell(trade);
      }
    } catch (e) {
      console.error(`[EXECUTION ERROR] ${(e as any).message}`);
    }
  }

  private async executeBuy(trade: TradeActivity): Promise<void> {
    const balance = await this.getBalance();
    const tradeSize = Math.min(balance, trade.size * trade.price);
    if (tradeSize < 1) return;

    let slippage = 1.02;
    for (let i = 0; i < 3; i++) {
      try {
        let price = trade.price * slippage;
        if (price >= 1.0) price = 0.999;
        console.log(`[ACTION] BUY Attempt ${i+1} | Price: ${price.toFixed(4)}`);
        await this.client.createAndPostOrder({
          tokenID: trade.asset, price, side: Side.BUY, size: tradeSize / price, feeRateBps: 0
        });
        console.log(`[SUCCESS] BUY Executed`);
        await this.exportState();
        return;
      } catch (err) {
        console.warn(`[RETRY] BUY Failed: ${(err as any).message}`);
        slippage += 0.02;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  private async executeSell(trade: TradeActivity): Promise<void> {
    const pos = await this.getPositionSize(trade.asset);
    if (pos <= 0) return;
    const sellSize = Math.min(trade.size, pos);

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
    if (trade.side === 'BUY') {
      const tradeSize = Math.min(this.dryRunState.virtualBalance, trade.size * trade.price);
      if (tradeSize < 0.01) return;
      this.dryRunState.virtualBalance -= tradeSize;
      this.dryRunState.tradeHistory.push({ side: 'BUY', title: trade.title });
    } else {
      this.dryRunState.tradeHistory.push({ side: 'SELL', title: trade.title });
    }
    await this.exportState();
  }
}
