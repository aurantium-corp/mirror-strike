import { Executor } from './executor';

async function runTest() {
    console.log('[TEST] Starting LIVE Simulation...');
    
    const executor = new Executor();
    await executor.init();

    // Real Asset ID from recent logs (Bitcoin Up/Down)
    const realAssetId = '4032540539378079249741826408877106123256145372388053630226902381886391553670';

    const mockTrade = {
        transactionHash: '0xtest1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab',
        timestamp: Math.floor(Date.now() / 1000),
        name: 'TEST_USER',
        side: 'BUY' as const,
        outcome: 'Yes',
        title: 'TEST TRADE - Bitcoin Market',
        price: 0.50, // Limit price
        size: 1000,
        asset: realAssetId
    };

    console.log('[TEST] Injecting Real Trade Signal...');
    await executor.execute(mockTrade);

    console.log('[TEST] Simulation Complete.');
}

runTest();
