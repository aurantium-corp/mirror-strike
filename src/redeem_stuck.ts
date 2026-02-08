import { ethers } from 'ethers';
import axios from 'axios';
import Safe from '@safe-global/protocol-kit';
import { MetaTransactionData, OperationType } from '@safe-global/types-kit';
import dotenv from 'dotenv';

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY!;
const WALLET_ADDRESS = process.env.WALLET_ADDRESS!;
const RPC_URL = process.env.RPC_URL || 'https://polygon-rpc.com';

const CTF_ADDRESS = '0x4D979261E0176D38006E58F4978c4a17951B62e6';
const USDC_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';

const CTF_ABI = [
    "function redeemPositions(address collateralToken, bytes32 parentCollectionId, bytes32 conditionId, uint256[] indexSets)"
];

async function redeemStuck() {
    console.log(`[REDEEM] Target Wallet (Safe): ${WALLET_ADDRESS}`);
    
    // Fetch positions
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

    // Initialize Safe SDK
    let safeSdk: Safe;
    try {
        safeSdk = await Safe.init({
            provider: RPC_URL,
            signer: PRIVATE_KEY,
            safeAddress: WALLET_ADDRESS
        });
        console.log('[REDEEM] Safe SDK initialized.');
    } catch (e: any) {
        console.error('[REDEEM] Failed to initialize Safe SDK:', e.message);
        return;
    }

    const ctfInterface = new ethers.Interface(CTF_ABI);
    const parentCollectionId = ethers.ZeroHash;

    const transactions: MetaTransactionData[] = redeemablePositions.map((pos: any) => {
        const indexSet = 1 << pos.outcomeIndex;
        console.log(`[BATCH] Adding: ${pos.title} (${pos.outcome}) - Condition: ${pos.conditionId}`);
        return {
            to: CTF_ADDRESS,
            data: ctfInterface.encodeFunctionData("redeemPositions", [
                USDC_ADDRESS,
                parentCollectionId,
                pos.conditionId,
                [indexSet]
            ]),
            value: '0',
            operation: OperationType.Call
        };
    });

    try {
        console.log(`[ACTION] Creating Batched Safe transaction with ${transactions.length} calls...`);
        const safeTransaction = await safeSdk.createTransaction({ transactions });
        
        console.log(`[ACTION] Signing batched transaction...`);
        const signedSafeTransaction = await safeSdk.signTransaction(safeTransaction);
        
        console.log(`[ACTION] Executing batched transaction...`);
        const executeTxResponse = await safeSdk.executeTransaction(signedSafeTransaction);
        console.log(`[TX] Sent: ${executeTxResponse.hash}`);
        
        console.log(`[SUCCESS] Positions redemption initiated.`);
    } catch (e: any) {
        console.error(`[ERROR] Failed to execute batched redemption:`, e.message);
        console.log('[REDEEM] Attempting one-by-one fallback...');
        for (const txData of transactions) {
            try {
                const singleTx = await safeSdk.createTransaction({ transactions: [txData] });
                const signedTx = await safeSdk.signTransaction(singleTx);
                const resp = await safeSdk.executeTransaction(signedTx);
                console.log(`[SUCCESS] Individual redemption sent: ${resp.hash}`);
            } catch (err: any) {
                console.error(`[ERROR] Individual redemption failed:`, err.message);
            }
        }
    }
}

redeemStuck();
