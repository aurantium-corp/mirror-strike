import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const WALLET_ADDRESS = '0x4D1a0200D75AC5f706382102C1747170d43B1211';
const RPC_URL = 'https://polygon-bor-rpc.publicnode.com';

async function inspect() {
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const abi = ["function owner() view returns (address)"];
    const contract = new ethers.Contract(WALLET_ADDRESS, abi, provider);
    const owner = await contract.owner();
    console.log(`Owner: ${owner}`);
}

inspect();
