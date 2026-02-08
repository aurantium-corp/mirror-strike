import { ClobClient } from '@polymarket/clob-client';
import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY!;
const WALLET_ADDRESS = process.env.WALLET_ADDRESS!;

async function check() {
    const provider = new ethers.providers.JsonRpcProvider('https://polygon-rpc.com');
    const signer = new ethers.Wallet(PRIVATE_KEY, provider);
    
    // SignatureType 2 = GNOSIS_SAFE
    const client = new ClobClient('https://clob.polymarket.com', 137, signer, undefined, 2, WALLET_ADDRESS);
    
    try {
        console.log('[AUTH] Deriving Keys...');
        const creds = await client.createOrDeriveApiKey();
        console.log('[SUCCESS] Keys derived.');
        
        const l2Client = new ClobClient(
            'https://clob.polymarket.com', 
            137, 
            signer, 
            creds, 
            2, 
            WALLET_ADDRESS
        );

        console.log('[ACTION] Checking balance/allowance via API...');
        const result = await l2Client.getBalanceAllowance({
            asset_type: 'collateral' as any
        });
        console.log('[SUCCESS] Result:', JSON.stringify(result));
        
    } catch (e) {
        console.error('[ERROR]', (e as any).message);
    }
}

check();
