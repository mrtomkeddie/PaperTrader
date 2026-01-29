
export enum AssetSymbol {
  XAUUSD = 'XAUUSD'
}

export enum StrategyType {
  // Basic / Trend
  TREND_FOLLOW = 'TREND_FOLLOW',
  MEAN_REVERT = 'MEAN_REVERT',
  AI_AGENT = 'AI_AGENT',
  MANUAL = 'MANUAL',

  // Institutional Strategies
  LONDON_SWEEP = 'LONDON_SWEEP',
  LONDON_CONTINUATION = 'LONDON_CONTINUATION'
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
  confidence?: number; // Confidence score at entry (0-100)
  entryReason?: string; // Why the trade was taken
  outcomeReason?: string; // Analysis of the result (what worked/failed)
  closeReason?: 'TAKE_PROFIT' | 'STOP_LOSS' | 'MANUAL' | 'PARTIAL_CLOSE' | 'AI_GUARDIAN'; // Why it closed
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
  activeStrategies: StrategyType[]; // CHANGED: Array of strategies
  isThinking?: boolean; // UI state for when AI is querying
  isLive?: boolean; // Connected to WebSocket or API

  // AI Data
  aiSentiment?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  aiConfidence?: number;
  aiReason?: string;
}

export interface AccountState {
  balance: number;
  equity: number;
  dayPnL: number;
  totalPnL?: number;
  winRate?: number;
}

export interface AgentAccount {
  name: string;
  role: string;
  balance: number;
  equity: number;
  isThinking: boolean;
  lastAction: string;
  lastThought: string;
}

export interface MarketContextType {
  assets: Record<AssetSymbol, AssetData>;
  account: AccountState;
  accounts?: Record<string, AgentAccount>; // New Support
  trades: Trade[];
  toggleBot: (symbol: AssetSymbol) => void;
  toggleStrategy: (symbol: AssetSymbol, strategy: StrategyType) => void;
  resetAccount: () => void;
}
