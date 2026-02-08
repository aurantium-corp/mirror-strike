import axios from 'axios';

async function checkPositions() {
    const address = '0x4D1a0200D75AC5f706382102C1747170d43B1211';
    const url = 'https://data-api.polymarket.com/positions?user=' + address;
    console.log('[POSITIONS] Fetching URL: ' + url);

    try {
        const response = await axios.get(url);
        const positions = response.data;

        if (Array.isArray(positions) && positions.length > 0) {
            console.log('[POSITIONS] Found ' + positions.length + ' positions:');
            for (const pos of positions) {
                console.log('- Market: ' + pos.title);
                console.log('  Outcome: ' + pos.outcome);
                console.log('  Size: ' + pos.size);
                console.log('  Avg Price: $' + pos.avgPrice);
                console.log('  Current Value: $' + pos.currentValue);
                console.log('  P&L: $' + pos.percentPnl + '% ($' + pos.cashPnl + ')');
                console.log('  Redeemable: ' + pos.redeemable);
                console.log('  Resolved: ' + (pos.endDate ? 'Yes' : 'No'));
                console.log('  ---');
            }
        } else {
            console.log('[POSITIONS] No active positions found.');
        }
    } catch (e) {
        console.error('[ERROR]', (e as any).message);
        // Print the response status if available
        if ((e as any).response) {
            console.error('[API ERROR STATUS]', (e as any).response.status);
            console.error('[API ERROR DATA]', (e as any).response.data);
        }
    }
}

checkPositions();
