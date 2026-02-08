import { Executor, TradeActivity } from './executor';

async function testMirrorOrder() {
    console.log('Starting Mirror Order Logic Test (Dry-run)');
    
    // Set DRY_RUN env
    process.env.DRY_RUN = 'true';
    
    const executor = new Executor(true);
    await executor.init();
    
    const initialBalance = executor.getDryRunState().virtualBalance;
    console.log(`Initial Balance: $${initialBalance} USDC`);

    // 1. Simulate a BUY trade from target
    const mockBuyTrade: TradeActivity = {
        transactionHash: '0xmock_buy_hash',
        timestamp: Date.now(),
        side: 'BUY',
        asset: '0xasset_abc_yes_token',
        price: 0.5,
        size: 200, // $100 worth
        title: 'Will GPT-5 release in 2025?',
        name: 'WhaleTrader'
    };

    console.log('--- Step 1: Simulate BUY ($100) ---');
    await executor.execute(mockBuyTrade);

    const stateAfterBuy = executor.getDryRunState();
    const pos = stateAfterBuy.virtualPositions.get(mockBuyTrade.asset);
    
    console.log(`Balance after BUY: $${stateAfterBuy.virtualBalance} USDC`);
    console.log(`Position size: ${pos?.size} shares`);
    console.log(`Avg Price: ${pos?.averageEntryPrice}`);

    // Assertions
    if (stateAfterBuy.virtualBalance !== initialBalance - 100) {
        console.error('FAIL: Balance mismatch after BUY!');
    } else if (pos?.size !== 200) {
        console.error('FAIL: Position size mismatch after BUY!');
    } else {
        console.log('PASS: BUY Logic Verified.');
    }

    // 2. Simulate a partial SELL trade from target
    const mockSellTrade: TradeActivity = {
        transactionHash: '0xmock_sell_hash',
        timestamp: Date.now(),
        side: 'SELL',
        asset: '0xasset_abc_yes_token',
        price: 0.6, // Profit!
        size: 100,  // Target sells half
        title: 'Will GPT-5 release in 2025?',
        name: 'WhaleTrader'
    };

    console.log('--- Step 2: Simulate SELL (100 shares @ $0.6) ---');
    await executor.execute(mockSellTrade);

    const stateAfterSell = executor.getDryRunState();
    const posAfterSell = stateAfterSell.virtualPositions.get(mockSellTrade.asset);

    console.log(`Balance after SELL: $${stateAfterSell.virtualBalance} USDC`);
    console.log(`Remaining position: ${posAfterSell?.size} shares`);
    console.log(`Total PnL: $${stateAfterSell.totalPnL}`);

    // Proceeds = 100 * 0.6 = $60
    // Cost Basis = 100 * 0.5 = $50
    // PnL = $10
    if (Math.abs(stateAfterSell.virtualBalance - (initialBalance - 100 + 60)) > 0.0001) {
        console.error('FAIL: Balance mismatch after SELL!');
    } else if (Math.abs(stateAfterSell.totalPnL - 10) > 0.0001) {
        console.error('FAIL: PnL calculation mismatch!');
    } else {
        console.log('PASS: SELL Logic Verified.');
    }
    
    console.log('Mirror Logic Test Complete.');
}

testMirrorOrder().catch(console.error);