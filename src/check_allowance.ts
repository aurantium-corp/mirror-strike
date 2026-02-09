import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY!;
const WALLET_ADDRESS = process.env.WALLET_ADDRESS!;
const RPC_URL = process.env.RPC_URL || 'https://polygon-rpc.com';

const USDC_ADDRESS = '0x2791bca1f2de4661ed88a30c99a7a9449aa84174';
const CTF_ADDRESS = '0x4d979261e0176d38006e58f4978c4a17951b62e6';
const CTF_EXCHANGE = '0x4bfb41d5b3570defd03c39a9a4d8de6bd8b8982e';

const ERC20_ABI = [
    "function allowance(address owner, address spender) view returns (uint256)",
    "function balanceOf(address owner) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)"
];

const CTF_ABI = [
    "function isApprovedForAll(address owner, address operator) view returns (bool)",
    "function setApprovalForAll(address operator, bool approved)"
];

async function check() {
    console.log(`[CHECK] Verifying Allowance for ${WALLET_ADDRESS}...`);
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    
    // Check USDC
    const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, wallet);
    try {
        const balance = await usdc.balanceOf(WALLET_ADDRESS);
        console.log(`[BALANCE] USDC: ${ethers.utils.formatUnits(balance, 6)}`);

        const allowance = await usdc.allowance(WALLET_ADDRESS, CTF_EXCHANGE);
        console.log(`[ALLOWANCE] USDC -> Exchange: ${ethers.utils.formatUnits(allowance, 6)}`);

        if (allowance.lt(ethers.utils.parseUnits("100", 6))) {
            console.log('[ACTION] USDC Allowance too low. Approving Max Uint...');
            const tx = await usdc.approve(CTF_EXCHANGE, ethers.constants.MaxUint256);
            console.log(`[TX] USDC Approval sent: ${tx.hash}`);
            await tx.wait();
            console.log('[SUCCESS] USDC Approved.');
        } else {
            console.log('[OK] USDC Allowance sufficient.');
        }

    } catch (e) {
        console.error('[ERROR] USDC Check:', e);
    }

    // Check CTF
    const ctf = new ethers.Contract(CTF_ADDRESS, CTF_ABI, wallet);
    try {
        const isApproved = await ctf.isApprovedForAll(WALLET_ADDRESS, CTF_EXCHANGE);
        console.log(`[ALLOWANCE] CTF -> Exchange: ${isApproved}`);

        if (!isApproved) {
            console.log('[ACTION] CTF Approval missing. Setting Approval For All...');
            const tx = await ctf.setApprovalForAll(CTF_EXCHANGE, true);
            console.log(`[TX] CTF Approval sent: ${tx.hash}`);
            await tx.wait();
            console.log('[SUCCESS] CTF Approved.');
        } else {
            console.log('[OK] CTF Allowance sufficient.');
        }
    } catch (e) {
        console.error('[ERROR] CTF Check:', e);
    }
}

check();
