import { ClobClient } from '@polymarket/clob-client';
import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY!;
const WALLET_ADDRESS = process.env.WALLET_ADDRESS!;

async function check() {
    console.log(`[CHECK] Inspecting ${WALLET_ADDRESS}...`);
    const provider = new ethers.providers.JsonRpcProvider('https://polygon-rpc.com');
    const signer = new ethers.Wallet(PRIVATE_KEY, provider);
    
    // Init Client (L1 is enough to check L2 state usually, or derive keys again)
    const client = new ClobClient('https://clob.polymarket.com', 137, signer);
    const creds = await client.createOrDeriveApiKey();
    const l2Client = new ClobClient('https://clob.polymarket.com', 137, signer, creds, 1, WALLET_ADDRESS);

    // 1. Check Collateral Balance (via CLOB API if possible, or Chain)
    // CLOB doesn't usually return balance directly, we check allowance/collateral via chain usually.
    // But let's check Open Orders.
    
    try {
        console.log('[CHECK] Fetching Open Orders...');
        const ordersResp = await l2Client.getOpenOrders(); // Returns OpenOrdersResponse
        const orders = ordersResp as any; // Usually contains data array or is array?
        // OpenOrdersResponse usually has a list of orders?
        // Let's print raw first to be safe
        console.log(`[ORDERS] Response keys: ${Object.keys(orders)}`);
        
        // Assuming array or .data?
        // Docs say it returns OpenOrder[] or object with data?
        // Let's assume array for now based on typical usage, or inspect
        if (Array.isArray(orders)) {
             console.log(`[ORDERS] Count: ${orders.length}`);
             if (orders.length > 0) console.log(orders);
        } else {
             console.log('[ORDERS] Raw:', JSON.stringify(orders).substring(0, 500));
        }
        
    } catch (e) {
        console.error('[ERROR]', (e as any).message);
    }
}

check();
