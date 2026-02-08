import { ClobClient } from '@polymarket/clob-client';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY!;
const PROXY_ADDRESS = process.env.PROXY_ADDRESS || process.env.WALLET_ADDRESS!;

async function onboard() {
    console.log(`[ONBOARD] Target Proxy: ${PROXY_ADDRESS}`);
    const provider = new ethers.providers.JsonRpcProvider('https://polygon-rpc.com');
    const signer = new ethers.Wallet(PRIVATE_KEY, provider);
    console.log(`[ONBOARD] Owner/Signer: ${signer.address}`);

    // Create a base client for L1 operations
    const client = new ClobClient('https://clob.polymarket.com', 137, signer);

    try {
        console.log('[ONBOARD] Step 1: Attempting to derive API Key...');
        // createOrDeriveApiKey will attempt to derive if it exists, or create if it doesn't
        // But if the account isn't onboarded, it fails.
        const creds = await client.createOrDeriveApiKey();
        console.log('[OK] API Key derived/created successfully!');
        console.log(`[OK] Key: ${creds.key}`);
        
        // Save to .env for future use (L2 Auth)
        updateEnv({
            CLOB_API_KEY: creds.key,
            CLOB_SECRET: creds.secret,
            CLOB_PASSPHRASE: creds.passphrase
        });

        // Test L2 Client
        const l2Client = new ClobClient('https://clob.polymarket.com', 137, signer, creds, 1, PROXY_ADDRESS);
        const orders = await l2Client.getOpenOrders();
        console.log(`[OK] Connection verified. Open orders count: ${Array.isArray(orders) ? orders.length : 'N/A'}`);

    } catch (e: any) {
        console.error('[ERROR] Initial attempt failed:', e.message);
        
        if (JSON.stringify(e).includes('Could not create api key')) {
            console.log('[INFO] This error usually means the account needs to be ONBOARDED on Polymarket.');
            console.log('[INFO] Checking for profile...');
            // In a real scenario, we might need to call specific onboarding endpoints
            // but the CLOB SDK's createOrDeriveApiKey usually handles creation.
            // If it fails, let's try getProfile to see if the server recognizes us.
            try {
                // @ts-ignore - checking if getProfile exists in this version of SDK
                if (typeof client.getProfile === 'function') {
                    // @ts-ignore
                    const profile = await client.getProfile();
                    console.log('[PROFILE]', profile);
                }
            } catch (pErr) {
                console.log('[INFO] Profile check failed too. You MUST sign in once at Polymarket.com to "Enable Trading".');
            }
        }
    }
}

function updateEnv(vars: Record<string, string>) {
    const envPath = path.join(process.cwd(), '.env');
    let content = fs.readFileSync(envPath, 'utf8');
    
    for (const [key, value] of Object.entries(vars)) {
        const regex = new RegExp(`^${key}=.*`, 'm');
        if (regex.test(content)) {
            content = content.replace(regex, `${key}=${value}`);
        } else {
            content += `
${key}=${value}`;
        }
    }
    
    fs.writeFileSync(envPath, content);
    console.log('[OK] .env updated with CLOB credentials.');
}

onboard();
