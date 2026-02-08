import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY!;
const WALLET_ADDRESS = process.env.WALLET_ADDRESS!;
const RPC_URL = process.env.RPC_URL || 'https://polygon-rpc.com';

const USDC_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
const CTF_EXCHANGE = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E';

const ERC20_ABI = [
    "function allowance(address owner, address spender) view returns (uint256)",
    "function balanceOf(address owner) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)"
];

async function check() {
    console.log(`[CHECK] Verifying Allowance for ${WALLET_ADDRESS}...`);
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, wallet);

    try {
        const balance = await usdc.balanceOf(WALLET_ADDRESS);
        console.log(`[BALANCE] USDC: ${ethers.utils.formatUnits(balance, 6)}`);

        const allowance = await usdc.allowance(WALLET_ADDRESS, CTF_EXCHANGE);
        console.log(`[ALLOWANCE] CTF Exchange: ${ethers.utils.formatUnits(allowance, 6)}`);

        if (allowance.lt(ethers.utils.parseUnits("100", 6))) {
            console.log('[ACTION] Allowance too low. Approving Max Uint...');
            const tx = await usdc.approve(CTF_EXCHANGE, ethers.constants.MaxUint256);
            console.log(`[TX] Approval sent: ${tx.hash}`);
            await tx.wait();
            console.log('[SUCCESS] Approved.');
        } else {
            console.log('[OK] Allowance sufficient.');
        }

    } catch (e) {
        console.error('[ERROR]', e);
    }
}

check();
