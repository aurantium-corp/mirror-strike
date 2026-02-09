import { ethers } from 'ethers';
import Safe, { EthersAdapter } from '@safe-global/protocol-kit';
import * as dotenv from 'dotenv';

dotenv.config();

const WALLET_ADDRESS = '0x4D1a0200D75AC5f706382102C1747170d43B1211';
const RPC_URL = 'https://1rpc.io/matic';
const PRIVATE_KEY = process.env.PRIVATE_KEY!;

async function inspect() {
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const signer = new ethers.Wallet(PRIVATE_KEY, provider);

    const ethAdapter = new EthersAdapter({
        ethers,
        signerOrProvider: signer
    });

    try {
        const safeSdk = await Safe.create({
            ethAdapter: ethAdapter as any,
            safeAddress: WALLET_ADDRESS
        });
        console.log("Safe SDK initialized.");
        const owners = await safeSdk.getOwners();
        console.log(`Owners: ${owners}`);
    } catch (e) {
        console.error("Safe SDK failed:", (e as any).message);
    }
}

inspect();
