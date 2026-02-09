import { ethers } from 'ethers';
import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY!;
const WALLET_ADDRESS = process.env.WALLET_ADDRESS!;
const RPC_URL = 'https://polygon-bor-rpc.publicnode.com';

const CTF_ADDRESS = '0x4d979261e0176d38006e58f4978c4a17951b62e6';
const USDC_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';

const CTF_ABI = [
    "function redeemPositions(address collateralToken, bytes32 parentCollectionId, bytes32 conditionId, uint256[] indexSets)",
    "function isApprovedForAll(address owner, address operator) view returns (bool)",
    "function setApprovalForAll(address operator, bool approved)"
];

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function redeemDirect() {
    console.log(`[REDEEM] Starting direct redemption for ${WALLET_ADDRESS}...`);
    
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const ctf = new ethers.Contract(CTF_ADDRESS, CTF_ABI, wallet);

    // 1. Fetch positions
    const url = `https://data-api.polymarket.com/positions?user=${WALLET_ADDRESS}`;
    console.log(`[REDEEM] Fetching positions from ${url}...`);
    let positions;
    try {
        const response = await axios.get(url);
        positions = response.data;
    } catch (e: any) {
        console.error('[REDEEM] Failed to fetch positions:', e.message);
        return;
    }

    const redeemablePositions = positions.filter((p: any) => p.redeemable === true);
    console.log(`[REDEEM] Found ${redeemablePositions.length} redeemable positions.`);

    if (redeemablePositions.length === 0) {
        console.log('[REDEEM] Nothing to redeem.');
        return;
    }

    const parentCollectionId = ethers.constants.HashZero;

    // 2. Redeem loop
    for (const pos of redeemablePositions) {
        console.log(`\n[REDEEM] Processing: ${pos.title} (${pos.outcome})`);
        
        try {
            const indexSet = [1 << pos.outcomeIndex]; // Bitmask for the outcome
            
            console.log(`[TX] Sending redeem transaction...`);
            const tx = await ctf.redeemPositions(
                USDC_ADDRESS,
                parentCollectionId,
                pos.conditionId,
                indexSet
            );
            console.log(`[TX] Hash: ${tx.hash}`);
            await tx.wait();
            console.log(`[SUCCESS] Redeemed.`);
            
            console.log('[WAIT] Sleeping 2s to respect rate limits...');
            await sleep(2000);
        } catch (e: any) {
            console.error(`[ERROR] Failed to redeem ${pos.title}:`, e.message || e);
        }
    }
    console.log('[REDEEM] All done.');
}

redeemDirect().catch(console.error);