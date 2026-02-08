import { ClobClient } from '@polymarket/clob-client';
import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY!;
const WALLET_ADDRESS = process.env.WALLET_ADDRESS!;

async function cleanUp() {
    console.log(`[CLEANUP] Connecting to ${WALLET_ADDRESS}...`);
    const provider = new ethers.providers.JsonRpcProvider('https://polygon-rpc.com');
    const signer = new ethers.Wallet(PRIVATE_KEY, provider);
    
    // Init Client (L1)
    const client = new ClobClient('https://clob.polymarket.com', 137, signer, undefined, 2, WALLET_ADDRESS);
    
    try {
        console.log('[AUTH] Deriving Keys...');
        const creds = await client.createOrDeriveApiKey();
        
        const l2Client = new ClobClient(
            'https://clob.polymarket.com', 
            137, 
            signer, 
            creds, 
            2, // GNOSIS_SAFE
            WALLET_ADDRESS
        );

        console.log('[ACTION] Cancelling ALL open orders...');
        const result = await l2Client.cancelAll();
        console.log('[SUCCESS] Cancel Result:', result);
        
    } catch (e) {
        console.error('[ERROR]', (e as any).message);
        if ((e as any).response) console.error('[API]', JSON.stringify((e as any).response.data));
    }
}

cleanUp();
