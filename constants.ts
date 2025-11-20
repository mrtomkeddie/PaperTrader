
import { AssetSymbol, StrategyType } from './types';

export const INITIAL_BALANCE = 10000;
export const DEFAULT_REMOTE_URL = 'http://localhost:3001';

// Simulation settings
export const TICK_RATE_MS = 1000; // Updates every second
export const HISTORY_LENGTH = 300; // Length for chart and indicators
export const AI_THROTTLE_MS = 6000; 

export const OANDA_CONFIG = {
  baseUrl: 'https://api-fxpractice.oanda.com/v3',
  streamUrl: 'https://stream-fxpractice.oanda.com/v3',
  symbolMap: {
    [AssetSymbol.XAUUSD]: 'XAU_USD',
    [AssetSymbol.NAS100]: 'NAS100_USD'
  }
};

export const ASSET_CONFIG = {
  [AssetSymbol.XAUUSD]: {
    startPrice: 2350.00,
    volatility: 0.001,
    decimals: 2,
    lotSize: 10, // 10 Ounces
  },
  [AssetSymbol.NAS100]: {
    startPrice: 18500.00,
    volatility: 0.0015,
    decimals: 1,
    lotSize: 1, // 1 Contract
  }
};

export const STRATEGY_CONFIG: Record<string, any> = {
  [StrategyType.LONDON_SWEEP]: {
    // Gold Institutional
    startTimeUTC: 6, // 06:00 UTC (Approx London Open Pre-market)
    endTimeUTC: 10,  // 10:00 UTC
    timeframe: 5, // 5m Candles
    riskPerTrade: 0.01, // 1% Risk
    minSweepSize: 0.5, // $0.50 Gold move
    slPadding: 1.0 // $1.00 buffer
  },
  [StrategyType.NY_ORB]: {
    // NAS100 Institutional
    startTimeUTC: 13, // 13:30 UTC (NY Open)
    orbDurationMinutes: 60, // 1 Hour Opening Range
    riskPerTrade: 0.01,
  },
  [StrategyType.TREND_FOLLOW]: {
    emaFast: 20,
    emaSlow: 50,
    riskPerTrade: 0.01
  },
  [StrategyType.AI_AGENT]: {
    tpPercent: 0.02, 
    slPercent: 0.01, 
  }
};
