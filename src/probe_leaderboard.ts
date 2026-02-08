import axios from 'axios';

const endpoints = [
    'https://gamma-api.polymarket.com/leaderboards',
    'https://gamma-api.polymarket.com/leaderboard',
    'https://data-api.polymarket.com/leaderboards',
    'https://data-api.polymarket.com/leaderboard',
    'https://gamma-api.polymarket.com/events?limit=5&sort=volume', // High volume events -> check top holders
];

async function scan() {
    for (const url of endpoints) {
        try {
            console.log(`[PROBE] ${url}`);
            const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            console.log(`[SUCCESS] Status: ${res.status}`);
            if (Array.isArray(res.data) && res.data.length > 0) {
                console.log('[DATA] Found array data. Sample:', JSON.stringify(res.data[0]).substring(0, 200));
            } else {
                console.log('[DATA] Object:', Object.keys(res.data));
            }
        } catch (e) {
            console.log(`[FAIL] ${(e as any).message}`);
        }
    }
}

scan();
