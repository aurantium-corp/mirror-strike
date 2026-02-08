import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY!;
const WALLET_ADDRESS = process.env.WALLET_ADDRESS!;

async function check() {
    const wallet = new ethers.Wallet(PRIVATE_KEY);
    console.log(`Signer Address: ${wallet.address}`);
    console.log(`Target Wallet Address: ${WALLET_ADDRESS}`);
    
    if (wallet.address.toLowerCase() === WALLET_ADDRESS.toLowerCase()) {
        console.log("MATCH: Target is an EOA.");
    } else {
        console.log("NO MATCH: Target is likely a Proxy (Safe).");
    }
}

check();
