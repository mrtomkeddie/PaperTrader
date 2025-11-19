
import { AssetSymbol, StrategyType } from './types';

export const INITIAL_BALANCE = 10000;

// Simulation settings
export const TICK_RATE_MS = 1000; // Updates every second
export const HISTORY_LENGTH = 300; // Length for chart and indicators
export const AI_THROTTLE_MS = 6000; 

export const OANDA_CONFIG = {
  baseUrl: 'https://api-fxpractice.oanda.com/v3',
  streamUrl: 'https://stream-fxpractice.oanda.com/v3',
  symbolMap: {
    [AssetSymbol.BTCUSD]: 'BTC_USD',
    [AssetSymbol.ETHUSD]: 'ETH_USD',
    [AssetSymbol.XAUUSD]: 'XAU_USD',
    [AssetSymbol.NAS100]: 'NAS100_USD'
  }
};

export const ASSET_CONFIG = {
  [AssetSymbol.BTCUSD]: {
    startPrice: 64000.00,
    volatility: 0.002, 
    decimals: 2,
    lotSize: 0.1, // 0.1 BTC
  },
  [AssetSymbol.ETHUSD]: {
    startPrice: 3400.00,
    volatility: 0.003, 
    decimals: 2,
    lotSize: 1, // 1 ETH
  },
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

export const STRATEGY_CONFIG = {
  [StrategyType.MOMENTUM]: {
    // "Micro-Momentum Sniper" (Optimized for BTC/ETH Live Data)
    // Catches the explosive moves, takes money off the table fast.
    // STRICTER RULES:
    rsiOverbought: 70, // Capped at 70 to prevent buying the top.
    rsiOversold: 30,
    tpPercent: 0.006, // 0.6% Target (Quick hit)
    slPercent: 0.003, // 0.3% Stop (Tight risk management 1:2 Ratio)
  },
  [StrategyType.SWING]: {
    // "Trend Follower" (Optimized for Gold/XAUUSD)
    // Slower, safer, rides the EMA 200.
    rsiOverbought: 80, // More breathing room
    rsiOversold: 20,
    tpPercent: 0.015, // 1.5% Target (Big moves)
    slPercent: 0.008, // 0.8% Stop (Wide to avoid wicks)
  },
  [StrategyType.AI_AGENT]: {
    // AI Managed
    tpPercent: 0.02, 
    slPercent: 0.01, 
  }
};
