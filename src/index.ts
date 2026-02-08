import { Watcher } from './watcher';
import { Executor } from './executor';
import dotenv from 'dotenv';

dotenv.config();

// Load targets from env or config
// Supports: TARGET_ADDRESSES=0xabc...,0xdef...,0xghi...
const TARGETS = (process.env.TARGET_ADDRESSES || '')
  .split(',')
  .map(t => t.trim())
  .filter(t => t.length > 0);

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║           Mirror-Strike Copy Trading Bot               ║');
console.log('║              Action-Based Mirroring v2.0               ║');
console.log('╚════════════════════════════════════════════════════════╝');
console.log();

// Initialize executor and watcher
const executor = new Executor();
const watcher = new Watcher(TARGETS, executor);

// Graceful shutdown handling
process.on('SIGINT', () => {
  console.log('\n[MAIN] Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[MAIN] Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('[MAIN] Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[MAIN] Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the bot
async function main() {
  try {
    await watcher.start(2000); // Poll every 2 seconds for faster reaction
    
    // If no targets, keep running but idle
    if (TARGETS.length === 0) {
      console.log('[MAIN] Bot is running in idle mode. Set TARGET_ADDRESSES to start mirroring.');
      
      // Keep the process alive
      setInterval(() => {
        // Heartbeat to show bot is still running
        const now = new Date().toISOString();
        console.log(`[MAIN] ${now} - Idle (no targets configured)`);
      }, 60000); // Log every minute
    }
  } catch (error) {
    console.error('[MAIN] Failed to start bot:', error);
    process.exit(1);
  }
}

main();
