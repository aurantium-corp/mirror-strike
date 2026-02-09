import { ClobClient, Side } from '@polymarket/clob-client';
import { ethers } from 'ethers';
import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY!;
const WALLET_ADDRESS = process.env.WALLET_ADDRESS!;

async function liquidateAll() {
    console.log(`[LIQUIDATE] Starting liquidation for ${WALLET_ADDRESS}...`);
    
    const provider = new ethers.providers.JsonRpcProvider('https://polygon-rpc.com');
    const signer = new ethers.Wallet(PRIVATE_KEY, provider);
    
    // Initialize CLOB Client
    const client = new ClobClient('https://clob.polymarket.com', 137, signer, undefined, 1, WALLET_ADDRESS);
    const creds = await client.createOrDeriveApiKey();
    const l2Client = new ClobClient('https://clob.polymarket.com', 137, signer, creds, 1, WALLET_ADDRESS);

    // 1. Fetch current positions
    const posUrl = `https://data-api.polymarket.com/positions?user=${WALLET_ADDRESS}`;
    console.log(`[LIQUIDATE] Fetching positions from: ${posUrl}`);
    const posResp = await axios.get(posUrl);
    const positions = posResp.data;

    if (!Array.isArray(positions) || positions.length === 0) {
        console.log('[LIQUIDATE] No positions found.');
        return;
    }

    const activePositions = positions.filter(p => parseFloat(p.size) > 0.01 && p.redeemable === false);
    console.log(`[LIQUIDATE] Found ${activePositions.length} active (non-resolved) positions.`);

    for (const pos of activePositions) {
        const size = parseFloat(pos.size);
        const title = pos.title;
        const asset = pos.asset || pos.assetId;

        console.log(`\n[LIQUIDATE] Closing: ${title} | Size: ${size}`);

        try {
            // 2. Fetch Orderbook to get "Current Price" (Best Bid)
            console.log(`[PRICE] Fetching orderbook for ${asset}...`);
            const book = await l2Client.getOrderBook(asset);
            const bestBid = book.bids && book.bids.length > 0 ? parseFloat(book.bids[0].price) : 0.01;
            
            console.log(`[PRICE] Best Bid found: $${bestBid}`);

            // 3. Sell at Best Bid (or slightly lower to ensure match)
            const sellPrice = Math.max(0.001, bestBid); 
            
            const feeRatesToTry = [0, 1000];
            let sold = false;

            for (const feeRate of feeRatesToTry) {
                if (sold) break;
                try {
                    const order = await l2Client.createAndPostOrder({
                        tokenID: asset,
                        price: sellPrice,
                        side: Side.SELL,
                        size: size,
                        feeRateBps: feeRate
                    });
                    console.log(`[SUCCESS] Sold at $${sellPrice} | Order: ${JSON.stringify(order)}`);
                    sold = true;
                } catch (err: any) {
                    if (feeRate === 0) continue;
                    console.error(`[FAILED] Error:`, err.message || JSON.stringify(err));
                }
            }
        } catch (err: any) {
            console.error(`[ERROR] Process failed for ${title}:`, err.message);
        }
    }

    console.log('\n[LIQUIDATE] Liquidation cycle complete.');
}

liquidateAll().catch(console.error);