import { Watcher } from './watcher';
import { Executor } from './executor';
import * as dotenv from 'dotenv';

dotenv.config();

const RAW_DRY_RUN = String(process.env.DRY_RUN).trim();
const DRY_RUN = RAW_DRY_RUN === 'true';
const TARGETS = (process.env.TARGET_ADDRESSES || '')
  .split(',')
  .map(t => t.trim())
  .filter(t => t.length > 0);

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║           Mirror-Strike Copy Trading Bot               ║');
console.log(`║  MODE: ${DRY_RUN ? '🧪 DRY-RUN' : '🚀 LIVE TRADE'} (Raw env: "${process.env.DRY_RUN}")  ║`);
console.log('╚════════════════════════════════════════════════════════╝');
console.log(`[MAIN] Initializing for ${TARGETS.length} targets...`);

const executor = new Executor(DRY_RUN);
const watcher = new Watcher(TARGETS, executor, DRY_RUN);

process.on('SIGINT', () => {
  console.log('\n[MAIN] Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[MAIN] Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

async function main() {
  try {
    await watcher.start(2000);
  } catch (error) {
    console.error('[MAIN] Failed to start bot:', error);
    process.exit(1);
  }
}

main();