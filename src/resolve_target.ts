import axios from 'axios';
async function resolveUser(username: string) {
    const url = `https://polymarket.com/@${username}`;
    console.log(`[?] Fetching ${url}...`);

    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
            }
        });

        const html = response.data;
        
        // Strategy 1: Look for Next.js data blob
        // <script id="__NEXT_DATA__" type="application/json">
        const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/);
        if (nextDataMatch && nextDataMatch[1]) {
            const json = JSON.parse(nextDataMatch[1]);
            console.log('[+] Found NEXT_DATA');
            
            // Traverse JSON to find the user profile matching the username
            const str = JSON.stringify(json);
            
            // Search for "username":"Sharky6999" nearby "address":"..."
            // Or look for the specific profile structure
            // Usually: props -> pageProps -> dehydratedState -> queries -> state -> data -> ...
            
            console.log(`[DEBUG] JSON length: ${str.length}`);
            
            // Heuristic: Find all occurrences of the username and print surrounding context
            const usernameIndex = str.indexOf(username);
            if (usernameIndex !== -1) {
                console.log(`[+] Found username '${username}' at index ${usernameIndex}`);
                const context = str.substring(Math.max(0, usernameIndex - 500), Math.min(str.length, usernameIndex + 500));
                console.log(`[DEBUG] Context: ${context}`);
                
                // Try to extract address from this context
                const addressMatch = context.match(/0x[a-fA-F0-9]{40}/);
                if (addressMatch) {
                     console.log(`[SUCCESS] Found likely address in context: ${addressMatch[0]}`);
                     return addressMatch[0];
                }
            } else {
                console.log(`[-] Username '${username}' not found in NEXT_DATA json string.`);
            }
        }

        // Strategy 2: Regex for 0x addresses in the whole body (messy but effective)
        // We look for the pattern often found in profile links or metadata
        // Polymarket profiles often display the address truncated, but maybe the full one is in a data attribute
        const allAddresses = html.match(/0x[a-fA-F0-9]{40}/g);
        if (allAddresses) {
            // The most frequent address is likely the user's (or the contract factory)
            // But usually the user's address appears near the username
            console.log(`[?] Found ${allAddresses.length} addresses in HTML.`);
            // Filter out known contract addresses if possible, or just print unique ones
            const unique = [...new Set(allAddresses)];
            console.log('[?] Candidates:', unique);
            return unique[0]; // Best guess
        }

        console.log('[-] Could not resolve address from HTML.');

    } catch (error) {
        console.error(`[!] Error fetching profile: ${(error as any).message}`);
    }
}

const target = process.argv[2] || 'Sharky6999';
resolveUser(target);
