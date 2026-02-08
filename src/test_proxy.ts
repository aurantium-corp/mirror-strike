import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const PROXY_ADDRESS = '0x4D1a0200D75AC5f706382102C1747170d43B1211';
const RPC_URL = 'https://1rpc.io/matic';
const PRIVATE_KEY = process.env.PRIVATE_KEY!;

const PROXY_ABI = [
    "function proxy(address dest, uint256 value, bytes calldata data) returns (bytes)"
];

const USDC_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
const ERC20_ABI = ["function balanceOf(address owner) view returns (uint256)"];

async function testProxy() {
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const signer = new ethers.Wallet(PRIVATE_KEY, provider);
    const proxy = new ethers.Contract(PROXY_ADDRESS, PROXY_ABI, signer);
    
    const usdcInterface = new ethers.utils.Interface(ERC20_ABI);
    const data = usdcInterface.encodeFunctionData("balanceOf", [PROXY_ADDRESS]);

    console.log(`[TEST] Calling proxy(USDC, 0, balanceOf(proxy))...`);
    try {
        // Since it's a read call, we use callStatic
        const result = await proxy.callStatic.proxy(USDC_ADDRESS, 0, data);
        const balance = usdcInterface.decodeFunctionResult("balanceOf", result);
        console.log(`[SUCCESS] Proxy returned balance: ${ethers.utils.formatUnits(balance[0], 6)}`);
    } catch (e) {
        console.error(`[ERROR] Proxy call failed:`, (e as any).message);
    }
}

testProxy();
