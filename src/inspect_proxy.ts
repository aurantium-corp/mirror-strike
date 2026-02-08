import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const WALLET_ADDRESS = '0x4D1a0200D75AC5f706382102C1747170d43B1211';
const RPC_URL = 'https://1rpc.io/matic';
const PRIVATE_KEY = process.env.PRIVATE_KEY!;

async function inspect() {
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const signer = new ethers.Wallet(PRIVATE_KEY, provider);
    const abi = ["function owner() view returns (address)"];
    const contract = new ethers.Contract(WALLET_ADDRESS, abi, provider);
    
    try {
        const owner = await contract.owner();
        console.log(`Proxy Owner: ${owner}`);
        console.log(`My Signer: ${signer.address}`);
        if (owner.toLowerCase() === signer.address.toLowerCase()) {
            console.log("MATCH: I am the owner.");
        } else {
            console.log("NO MATCH.");
        }
    } catch (e) {
        console.error("Failed to get owner:", (e as any).message);
    }
}

inspect();
