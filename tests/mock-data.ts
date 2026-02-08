/**
 * Mock Polymarket activity data for dry-run testing
 */

export interface MockTradeActivity {
  transactionHash: string;
  timestamp: number;
  side: 'BUY' | 'SELL';
  asset: string;
  price: number;
  size: number;
  title: string;
  name?: string;
  pseudonym?: string;
  targetAddress: string;
}

// Test target addresses
export const TARGET_ADDRESS_1 = '0x1234567890123456789012345678901234567890';
export const TARGET_ADDRESS_2 = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';

// Market data
export const MARKET_WILL_IT_RAIN = 'Will it rain tomorrow?';
export const MARKET_ELECTION = 'Who will win the election?';
export const ASSET_RAIN_YES = '0x1111111111111111111111111111111111111111111111111111111111111111';
export const ASSET_RAIN_NO = '0x2222222222222222222222222222222222222222222222222222222222222222';
export const ASSET_ELECTION_A = '0x3333333333333333333333333333333333333333333333333333333333333333';

/**
 * Scenario A: Target BUY → Mirror BUY
 * Target buys 10 shares at $0.5
 */
export const scenarioABuy: MockTradeActivity = {
  transactionHash: '0xabc123def456789012345678901234567890abcdef1234567890abcdef123456',
  timestamp: Math.floor(Date.now() / 1000),
  side: 'BUY',
  asset: ASSET_RAIN_YES,
  price: 0.5,
  size: 10,
  title: MARKET_WILL_IT_RAIN,
  name: 'TestTrader1',
  pseudonym: 'RainMaker',
  targetAddress: TARGET_ADDRESS_1
};

/**
 * Scenario B: Target SELL → Mirror SELL
 * Target sells 5 shares at $0.6
 */
export const scenarioBSell: MockTradeActivity = {
  transactionHash: '0xdef789abc0123456789012345678901234567890abcdef1234567890abcdef12',
  timestamp: Math.floor(Date.now() / 1000) + 60,
  side: 'SELL',
  asset: ASSET_RAIN_YES,
  price: 0.6,
  size: 5,
  title: MARKET_WILL_IT_RAIN,
  name: 'TestTrader1',
  pseudonym: 'RainMaker',
  targetAddress: TARGET_ADDRESS_1
};

/**
 * Scenario C: Duplicate Detection
 * Same trade tx hash appears twice
 */
export const scenarioCDuplicate: MockTradeActivity = {
  transactionHash: '0xduplicate1234567890123456789012345678901234567890duplicate123456',
  timestamp: Math.floor(Date.now() / 1000) + 120,
  side: 'BUY',
  asset: ASSET_RAIN_NO,
  price: 0.45,
  size: 20,
  title: MARKET_WILL_IT_RAIN,
  name: 'TestTrader1',
  pseudonym: 'RainMaker',
  targetAddress: TARGET_ADDRESS_1
};

/**
 * Scenario D: Multiple Targets
 * Two targets trade simultaneously
 */
export const scenarioDTarget1Buy: MockTradeActivity = {
  transactionHash: '0xtarget1abc1234567890123456789012345678901234567890target1abc123',
  timestamp: Math.floor(Date.now() / 1000) + 180,
  side: 'BUY',
  asset: ASSET_ELECTION_A,
  price: 0.55,
  size: 15,
  title: MARKET_ELECTION,
  name: 'ElectionTrader',
  pseudonym: 'PoliWhale',
  targetAddress: TARGET_ADDRESS_1
};

export const scenarioDTarget2Buy: MockTradeActivity = {
  transactionHash: '0xtarget2def4567890123456789012345678901234567890target2def456',
  timestamp: Math.floor(Date.now() / 1000) + 185, // 5 seconds later
  side: 'BUY',
  asset: ASSET_RAIN_YES,
  price: 0.48,
  size: 25,
  title: MARKET_WILL_IT_RAIN,
  name: 'WeatherTrader',
  pseudonym: 'CloudChaser',
  targetAddress: TARGET_ADDRESS_2
};

/**
 * Scenario E: No Position to SELL
 * Target sells but we have 0 position
 */
export const scenarioENoPositionSell: MockTradeActivity = {
  transactionHash: '0xnosell789abc0123456789012345678901234567890nosell789abc012345',
  timestamp: Math.floor(Date.now() / 1000) + 240,
  side: 'SELL',
  asset: ASSET_RAIN_NO, // We haven't bought this asset
  price: 0.5,
  size: 10,
  title: MARKET_WILL_IT_RAIN,
  name: 'TestTrader1',
  pseudonym: 'RainMaker',
  targetAddress: TARGET_ADDRESS_1
};

/**
 * Helper to convert mock trade to executor TradeActivity format
 */
export function toTradeActivity(mockTrade: MockTradeActivity): any {
  return {
    transactionHash: mockTrade.transactionHash,
    timestamp: mockTrade.timestamp,
    side: mockTrade.side,
    asset: mockTrade.asset,
    price: mockTrade.price,
    size: mockTrade.size,
    title: mockTrade.title,
    name: mockTrade.name,
    pseudonym: mockTrade.pseudonym
  };
}

/**
 * Create a mock API response for a target's activity
 */
export function createMockApiResponse(trades: MockTradeActivity[]): any[] {
  return trades.map(trade => ({
    transactionHash: trade.transactionHash,
    timestamp: trade.timestamp,
    side: trade.side,
    asset: trade.asset,
    price: trade.price,
    size: trade.size,
    title: trade.title,
    name: trade.name,
    pseudonym: trade.pseudonym
  }));
}

/**
 * All test scenarios for easy access
 */
export const allScenarios = {
  scenarioABuy,
  scenarioBSell,
  scenarioCDuplicate,
  scenarioDTarget1Buy,
  scenarioDTarget2Buy,
  scenarioENoPositionSell
};
