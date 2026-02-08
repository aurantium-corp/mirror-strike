import axios from 'axios';

const candidates = [
  '0x8c74b4eef9a894433B8126aA11d1345efb2B0488',
  '0x1B3CB941Da6aae2481147e8C177306950fF7Be0B',
  '0x5cF81c5c4500429f46025B5C0251C9702618d9E7',
  '0xa772dE12507bF3fa3B344e8E7826b3bb6d14f88C',
  '0x505da8075db50c4fe971aacf4b56cea1289c87b2',
  '0x4b27447b0370371b9e2b25be6845d7f144cec899',
  '0x6FAC4C06086fA4De0728e85a6C12d46B74C76D7e',
  '0x1D507F92d6577b4DED3e864Df93549266D12FB34',
  '0x751a2b86cab503496efd325c8344e10159349ea1'
];

async function check() {
    for (const address of candidates) {
        try {
            // Polymarket User Profile API (Gamma)
            // https://gamma-api.polymarket.com/users/{address} ??
            // Actually, let's use the Data API 'activity' trick again, as it returned the name 'fiig' for the first one.
            
            const url = `https://data-api.polymarket.com/activity?user=${address}&type=TRADE&limit=1`;
            const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            
            if (response.data && response.data.length > 0) {
                const user = response.data[0];
                console.log(`[CHECK] ${address} -> Name: ${user.name}, Pseudonym: ${user.pseudonym}`);
                
                if (user.name === 'Sharky6999' || user.pseudonym === 'Sharky6999') {
                    console.log(`[FOUND] !!! TARGET IDENTIFIED: ${address} !!!`);
                    process.exit(0);
                }
            } else {
                console.log(`[CHECK] ${address} -> No recent activity/info`);
            }
        } catch (e) {
            console.log(`[ERROR] ${address}: ${(e as any).message}`);
        }
    }
}

check();
