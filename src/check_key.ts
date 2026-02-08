import { ethers } from 'ethers';
const key = '0xad44ea8441406976f654a3164171fc1b8310b5f0f615d89094911b95e39c68c8';
const wallet = new ethers.Wallet(key);
console.log('Derived Address:', wallet.address);
