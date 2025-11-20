
export enum AssetSymbol {
  XAUUSD = 'XAU/USD',
  NAS100 = 'NAS100'
}

export enum StrategyType {
  // Basic / Trend
  TREND_FOLLOW = 'TREND_FOLLOW',
  AI_AGENT = 'AI_AGENT',
  
  // Institutional Strategies
  LONDON_SWEEP = 'LONDON_SWEEP', 
  LONDON_CONTINUATION = 'LONDON_CONTINUATION',
  NY_ORB = 'NY_ORB'
}

export enum TradeType {
  BUY = 'BUY',
  SELL = 'SELL'
}

export enum BrokerMode {
  REMOTE_SERVER = 'REMOTE_SERVER'
}

export type TimeFilter = 'TODAY' | 'WEEK' | 'MONTH' | 'ALL';

export interface OandaConfig {
  apiKey: string;
  accountId: string;
  environment: 'practice' | 'live';
}

export interface TpLevel {
  id: number;
  price: number;
  percentage: number; // 0.4 = 40%
  hit: boolean;
}

export interface Trade {
  id: string;
  symbol: AssetSymbol;
  type: TradeType;
  
  entryPrice: number;
  initialSize: number; // Starting Lots
  currentSize: number; // Remaining Lots
  
  stopLoss: number;
  
  // Multi-Level Take Profit
  tpLevels: TpLevel[]; 

  openTime: number;
  closeTime?: number;
  closePrice?: number;
  
  pnl: number; // Accumulated Realized PnL
  floatingPnl?: number; // Current unrealized (for UI)
  
  status: 'OPEN' | 'CLOSED';
  strategy: StrategyType;
  
  // Analysis Fields
  entryReason?: string; // Why the trade was taken
  closeReason?: 'TAKE_PROFIT' | 'STOP_LOSS' | 'MANUAL' | 'PARTIAL_CLOSE'; // Why it closed
  brokerId?: string; // ID from Oanda if applicable
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isClosed: boolean;
}

export interface PricePoint {
  time: string;
  value: number;
}

export interface AssetData {
  symbol: AssetSymbol;
  currentPrice: number;
  history: PricePoint[];
  rsi: number;
  ema: number;
  // The "Big Picture" Trend
  trend: 'UP' | 'DOWN'; 
  ema200: number;
  slope: number; // Linear Regression Slope (Trend Angle)

  // New Indicators
  macd: { macdLine: number; signalLine: number; histogram: number };
  bollinger: { upper: number; middle: number; lower: number };
  
  botActive: boolean;
  strategy: StrategyType;
  isThinking?: boolean; // UI state for when AI is querying
  isLive?: boolean; // Connected to WebSocket or API
}

export interface AccountState {
  balance: number;
  equity: number;
  dayPnL: number;
}

export interface MarketContextType {
  assets: Record<AssetSymbol, AssetData>;
  account: AccountState;
  trades: Trade[];
  toggleBot: (symbol: AssetSymbol) => void;
  setStrategy: (symbol: AssetSymbol, strategy: StrategyType) => void;
  resetAccount: () => void;
}
