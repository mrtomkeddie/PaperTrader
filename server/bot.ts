import { symbols, SymbolKey } from '../config/symbols';
import { ExchangeClient, OHLCV } from './exchangeClient';
import { isWeekendUTC, sma, rsi, updateVWAP, updateWeekendRange, VWAPState, RangeState, checkRangeBreakRetestLong, checkRangeBreakRetestShort, computeLotSize, RISK_PER_TRADE } from './strategies';
import { v4 as uuidv4 } from 'uuid';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { WebSocket } from 'ws';

dotenv.config();

type StrategyId = 'VWAP_MEAN_REV' | 'BTC_RANGE_RETEST' | 'AI_AGENT';
type Side = 'BUY' | 'SELL';
type Status = 'OPEN' | 'CLOSED';

interface Trade {
  id: string;
  symbol: string;
  strategy: StrategyId;
  type: Side;
  entryPrice: number;
  initialSize: number;
  currentSize: number;
  stopLoss: number;
  tp1: number;
  tp2: number;
  tp3: number;
  tp1Hit: boolean;
  tp2Hit: boolean;
  tp3Hit: boolean;
  openTime: number;
  closeTime?: number;
  closePrice?: number;
  pnl: number;
  status: Status;
}

interface SymbolState {
  closes15m: number[];
  closes1h: number[];
  sma20: number;
  sma50: number;
  rsi14: number;
  vwap: VWAPState;
  range: RangeState;
  last15m?: OHLCV;
  last1h?: OHLCV;
  lastTick?: number;
  lastTickTs?: number;
  uiTicks?: number[];
  botActive: boolean;
  activeStrategies: string[];
}

const account = { balance: 10000, equity: 10000, dayPnL: 0, totalPnL: 0 };
const trades: Trade[] = [];
const state: Record<string, SymbolState> = {};
const aiState: Record<string, { lastCheck: number; sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL'; confidence: number }> = {};
const API_KEY = process.env.API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY || process.env.GENAI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
const aiClient = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;
let webpushClient: any = null;
let pushSubscriptions: any[] = [];

for (const s of Object.keys(symbols)) {
  const defaults = s === 'BTCUSDT' ? ['VWAP', 'RANGE', 'AI_AGENT'] : ['VWAP', 'AI_AGENT'];
  state[s] = { closes15m: [], closes1h: [], sma20: 0, sma50: 0, rsi14: 50, vwap: { pv: 0, v: 0, vwap: 0 }, range: { high: null, low: null, frozen: false, brokeAbove: false, brokeBelow: false }, lastTick: undefined, uiTicks: [], botActive: true, activeStrategies: defaults };
  aiState[s] = { lastCheck: 0, sentiment: 'NEUTRAL', confidence: 0 };
}

function hasOpen(symbol: string, strategy: StrategyId) {
  return trades.some(t => t.symbol === symbol && t.strategy === strategy && t.status === 'OPEN');
}

function placeTrade(symbol: string, strategy: StrategyId, type: Side, entry: number, sl: number, tp1: number, tp2: number, tp3: number) {
  const size = computeLotSize(symbol, entry, sl, account.balance);
  if (size <= 0) return;
  const t: Trade = { id: uuidv4(), symbol, strategy, type, entryPrice: entry, initialSize: size, currentSize: size, stopLoss: sl, tp1, tp2, tp3, tp1Hit: false, tp2Hit: false, tp3Hit: false, openTime: Date.now(), pnl: 0, status: 'OPEN' };
  trades.unshift(t);
  notifyAll('Trade Opened', `${symbol} ${type} @ ${entry.toFixed(2)} (${strategy})`);
}

function manageTrades(symbol: string, bid: number, ask: number, sma20: number, last1h?: OHLCV) {
  let closed = 0;
  for (const t of trades) {
    if (t.symbol !== symbol || t.status !== 'OPEN') continue;
    const isBuy = t.type === 'BUY';
    const exit = isBuy ? bid : ask;
    if (state[symbol].activeStrategies.includes('AI_AGENT') && aiState[symbol].confidence > 80) {
      const snt = aiState[symbol].sentiment;
      if (isBuy && snt === 'BEARISH' && t.strategy === 'AI_AGENT') { t.status = 'CLOSED'; t.closeTime = Date.now(); t.closePrice = exit; const pnl = (exit - t.entryPrice) * t.currentSize; t.pnl += pnl; account.balance += pnl; closed += pnl; continue; }
      if (!isBuy && snt === 'BULLISH' && t.strategy === 'AI_AGENT') { t.status = 'CLOSED'; t.closeTime = Date.now(); t.closePrice = exit; const pnl = (t.entryPrice - exit) * t.currentSize; t.pnl += pnl; account.balance += pnl; closed += pnl; continue; }
    }
    if (isBuy && exit <= t.stopLoss) { t.status = 'CLOSED'; t.closeTime = Date.now(); t.closePrice = exit; const pnl = (exit - t.entryPrice) * t.currentSize; t.pnl += pnl; account.balance += pnl; closed += pnl; continue; }
    if (!isBuy && exit >= t.stopLoss) { t.status = 'CLOSED'; t.closeTime = Date.now(); t.closePrice = exit; const pnl = (t.entryPrice - exit) * t.currentSize; t.pnl += pnl; account.balance += pnl; closed += pnl; continue; }
    if (!t.tp1Hit) {
      const hit = isBuy ? exit >= t.tp1 : exit <= t.tp1;
      if (hit) { const qty = t.initialSize * 0.4; const pnl = (isBuy ? t.tp1 - t.entryPrice : t.entryPrice - t.tp1) * qty; t.pnl += pnl; account.balance += pnl; closed += pnl; t.currentSize -= qty; t.tp1Hit = true; t.stopLoss = t.entryPrice; notifyAll('TP1 Hit', `${t.symbol} ${t.type} PnL ${pnl.toFixed(2)}`); }
    }
    if (t.tp1Hit && !t.tp2Hit) {
      const hit = isBuy ? exit >= t.tp2 : exit <= t.tp2;
      if (hit) { const qty = t.initialSize * 0.4; const pnl = (isBuy ? t.tp2 - t.entryPrice : t.entryPrice - t.tp2) * qty; t.pnl += pnl; account.balance += pnl; closed += pnl; t.currentSize -= qty; t.tp2Hit = true; if (t.strategy === 'VWAP_MEAN_REV' || t.strategy === 'AI_AGENT') { if (isBuy) t.stopLoss = Math.max(t.stopLoss, sma20 * 0.999); else t.stopLoss = Math.min(t.stopLoss, sma20 * 1.001); } else if (t.strategy === 'BTC_RANGE_RETEST' && last1h) { if (isBuy) t.stopLoss = Math.max(t.stopLoss, last1h.low * 0.999); else t.stopLoss = Math.min(t.stopLoss, last1h.high * 1.001); } notifyAll('TP2 Hit', `${t.symbol} ${t.type} PnL ${pnl.toFixed(2)}`); }
    }
    if (t.tp2Hit && !t.tp3Hit) {
      const hit = isBuy ? exit >= t.tp3 : exit <= t.tp3;
      if (hit) { const qty = t.initialSize * 0.2; const pnl = (isBuy ? t.tp3 - t.entryPrice : t.entryPrice - t.tp3) * qty; t.pnl += pnl; account.balance += pnl; closed += pnl; t.currentSize -= qty; t.tp3Hit = true; t.status = 'CLOSED'; t.closeTime = Date.now(); t.closePrice = exit; notifyAll('Trade Closed', `${t.symbol} ${t.type} Final PnL ${pnl.toFixed(2)}`); }
    }
  }
  account.equity = account.balance;
  account.dayPnL += closed;
  account.totalPnL += closed;
}

function evaluateVWAPMeanReversion(symbol: string) {
  const cfg = (symbols as any)[symbol];
  if (!cfg.enabled || !cfg.runVWAPMeanReversion) return;
  const st = state[symbol];
  if (!st.botActive || !st.activeStrategies.includes('VWAP')) return;
  if (st.closes15m.length < 60) return;
  const now = new Date(st.last15m!.time);
  if (!isWeekendUTC(now)) return;
  if (hasOpen(symbol, 'VWAP_MEAN_REV')) return;
  const close = st.closes15m[st.closes15m.length - 1];
  const prevClose = st.closes15m[st.closes15m.length - 2];
  const vwap = st.vwap.vwap || close;
  const deviation = (close - vwap) / vwap;
  const prevSma20 = sma(st.closes15m.slice(0, st.closes15m.length - 1), 20);
  const longCross = prevClose < prevSma20 && close > st.sma20;
  const shortCross = prevClose > prevSma20 && close < st.sma20;
  const longOk = deviation <= -0.015 && st.rsi14 < 30 && longCross;
  const shortOk = deviation >= 0.015 && st.rsi14 > 70 && shortCross;
  if (longOk) {
    const sl = close * (1 - 0.008);
    const tp1 = vwap;
    const tp2 = st.sma50 > close ? st.sma50 : close * 1.01;
    const tp3 = close + 2 * (tp1 - close);
    placeTrade(symbol, 'VWAP_MEAN_REV', 'BUY', close, sl, tp1, tp2, tp3);
  } else if (shortOk) {
    const sl = close * (1 + 0.008);
    const tp1 = vwap;
    const tp2 = st.sma50 < close ? st.sma50 : close * 0.99;
    const tp3 = close - 2 * (close - tp1);
    placeTrade(symbol, 'VWAP_MEAN_REV', 'SELL', close, sl, tp1, tp2, tp3);
  }
}

function evaluateRangeBreakRetest(symbol: string) {
  const cfg = (symbols as any)[symbol];
  if (!cfg.enabled || !cfg.runRangeBreakRetest) return;
  const st = state[symbol];
  if (!st.botActive || !st.activeStrategies.includes('RANGE')) return;
  if (!st.last1h) return;
  const now = new Date(st.last1h.time);
  if (!isWeekendUTC(now)) return;
  if (!st.range.frozen || st.range.high == null || st.range.low == null) return;
  if (hasOpen(symbol, 'BTC_RANGE_RETEST')) return;
  const c = st.last1h;
  const longOk = checkRangeBreakRetestLong(st.range, { close: c.close, low: c.low });
  const shortOk = checkRangeBreakRetestShort(st.range, { close: c.close, high: c.high });
  if (longOk) {
    const entry = c.close;
    const sl = entry * (1 - 0.005);
    const tp1 = entry + (entry - st.range.high);
    const tp2 = entry + 2 * (entry - st.range.high);
    const tp3 = st.range.high + (st.range.high - st.range.low);
    placeTrade(symbol, 'BTC_RANGE_RETEST', 'BUY', entry, sl, tp1, tp2, tp3);
  } else if (shortOk) {
    const entry = c.close;
    const sl = entry * (1 + 0.005);
    const tp1 = entry - (st.range.low - entry);
    const tp2 = entry - 2 * (st.range.low - entry);
    const tp3 = st.range.low - (st.range.high - st.range.low);
    placeTrade(symbol, 'BTC_RANGE_RETEST', 'SELL', entry, sl, tp1, tp2, tp3);
  }
}

function on15m(symbol: string, c: OHLCV) {
  const st = state[symbol];
  st.last15m = c;
  st.closes15m.push(c.close);
  if (st.closes15m.length > 300) st.closes15m.shift();
  st.sma20 = sma(st.closes15m, 20);
  st.sma50 = sma(st.closes15m, 50);
  st.rsi14 = rsi(st.closes15m, 14);
  st.vwap = updateVWAP(st.vwap, c.close, c.volume, c.time);
  try { consultGemini(symbol); } catch { }
  evaluateVWAPMeanReversion(symbol);
  evaluateAIAgent(symbol);
  const bid = c.close * 0.999;
  const ask = c.close * 1.001;
  manageTrades(symbol, bid, ask, st.sma20, state[symbol].last1h);
}

function on1h(symbol: string, c: OHLCV) {
  const st = state[symbol];
  st.last1h = c;
  st.closes1h.push(c.close);
  if (st.closes1h.length > 300) st.closes1h.shift();
  st.range = updateWeekendRange(st.range, { time: c.time, high: c.high, low: c.low, close: c.close });
  evaluateRangeBreakRetest(symbol);
}

function main() {
  console.log('Bot starting...');
  const client = new ExchangeClient();
  const unsub: (() => void)[] = [];
  for (const s of Object.keys(symbols) as SymbolKey[]) {
    if (!(symbols as any)[s].enabled) continue;
    console.log(`Subscribing to ${s}...`);
    unsub.push(client.subscribe(s, '15m', c => on15m(s, c)));
    if ((symbols as any)[s].runRangeBreakRetest) unsub.push(client.subscribe(s, '1h', c => on1h(s, c)));
    setTimeout(() => { try { consultGemini(s); } catch { } }, 2000);
  }
  // Coinbase WebSocket for real-time price updates (single connection for all symbols)
  try {
    const symbolMap: Record<string, string> = {
      'BTCUSDT': 'BTC-USD',
      'ETHUSDT': 'ETH-USD',
      'SOLUSDT': 'SOL-USD'
    };
    const reverseMap: Record<string, string> = {
      'BTC-USD': 'BTCUSDT',
      'ETH-USD': 'ETHUSDT',
      'SOL-USD': 'SOLUSDT'
    };
    const productIds = Object.keys(symbols)
      .filter(s => (symbols as any)[s].enabled)
      .map(s => symbolMap[s as SymbolKey])
      .filter(Boolean);
    console.log('Connecting to Coinbase WebSocket...');
    const ws = new WebSocket('wss://advanced-trade-ws.coinbase.com');
    ws.on('open', () => {
      console.log('Connected to Coinbase WebSocket');
      const subscribeMsg = {
        type: 'subscribe',
        product_ids: productIds,
        channel: 'ticker'
      };
      ws.send(JSON.stringify(subscribeMsg));
      console.log(`Subscribed to Coinbase ticker for: ${productIds.join(', ')}`);
    });
    ws.on('message', (buf: any) => {
      try {
        const msg = JSON.parse(buf.toString());
        if (msg.channel === 'ticker' && msg.events) {
          for (const event of msg.events) {
            if (event.type === 'ticker' && event.tickers) {
              for (const ticker of event.tickers) {
                const productId = ticker.product_id;
                const internalSymbol = reverseMap[productId];
                if (!internalSymbol || !state[internalSymbol]) continue;
                const p = parseFloat(ticker.price);
                if (!isFinite(p)) continue;
                const s = internalSymbol as SymbolKey;
                state[s].lastTick = p;
                state[s].lastTickTs = Date.now();
                const arr = state[s].uiTicks || [];
                arr.push(p);
                if (arr.length > 120) arr.shift();
                state[s].uiTicks = arr;
                const bid = p * 0.999;
                const ask = p * 1.001;
                manageTrades(s, bid, ask, state[s].sma20, state[s].last1h);
              }
            }
          }
        }
      } catch (e) { console.error('Error processing Coinbase ticker:', e); }
    });
    ws.on('error', (e) => console.error('Coinbase WebSocket error:', e));
    ws.on('close', () => console.log('Coinbase WebSocket closed'));
    unsub.push(() => { try { ws.close(); } catch { } });
  } catch (e) { console.error('Error setting up Coinbase WebSocket:', e); }
}

main();

const app = express();
app.use(cors());
const clients = new Set<any>();
function buildState() {
  const assets: Record<string, any> = {};
  for (const s of Object.keys(state)) {
    const st = state[s];
    const price = typeof st.lastTick === 'number' ? st.lastTick : (st.last15m ? st.last15m.close : 0);
    const fast = (st.uiTicks || []).slice(-100);
    const fastSma50 = fast.length >= 50 ? sma(fast, 50) : 0;
    const trend = price > (fastSma50 > 0 ? fastSma50 : st.sma50) ? 'UP' : 'DOWN';
    const history = fast.length > 0 ? fast.map((v, i) => ({ time: String(i), value: v })) : st.closes15m.slice(-100).map((v, i) => ({ time: String(i), value: v }));
    const ai = aiState[s];
    const aiAnalyzing = ai && (Date.now() - ai.lastCheck < 15000);
    const fastRsi = fast.length >= 15 ? rsi(fast, 14) : st.rsi14;
    const ema200 = fastSma50 > 0 ? fastSma50 : st.sma50;
    assets[s] = { symbol: s, currentPrice: price, history, rsi: fastRsi, ema: st.sma20, ema200, trend, botActive: st.botActive, activeStrategies: st.activeStrategies, isLive: true, aiAnalyzing };
  }
  return { assets, account, trades };
}
app.get('/state', (req, res) => {
  res.json(buildState());
});
app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  clients.add(res);
  const send = () => { try { res.write(`data: ${JSON.stringify(buildState())}\n\n`); } catch { } };
  const timer = setInterval(send, 1000);
  req.on('close', () => { try { clearInterval(timer); } catch { }; clients.delete(res); });
});
app.post('/push/subscribe', express.json(), (req, res) => {
  try {
    const sub = req.body;
    if (!sub || !sub.endpoint) return res.status(400).end();
    const exists = pushSubscriptions.find(s => s.endpoint === sub.endpoint);
    if (!exists) pushSubscriptions.push(sub);
    res.sendStatus(201);
  } catch { res.sendStatus(500); }
});
app.post('/push/test', (req, res) => { try { notifyAll('Push Test', 'Crypto notifications enabled'); res.sendStatus(200); } catch { res.sendStatus(500); } });
app.post('/toggle/:symbol', (req, res) => {
  const s = req.params.symbol;
  if (!state[s]) return res.status(404).end();
  state[s].botActive = !state[s].botActive;
  res.json({ botActive: state[s].botActive });
});
app.post('/strategy/:symbol', express.json(), (req, res) => {
  const s = req.params.symbol;
  const strat = String(req.body?.strategy || '').toUpperCase();
  if (!state[s] || !strat) return res.status(400).end();
  const list = state[s].activeStrategies;
  const idx = list.indexOf(strat);
  if (idx >= 0) list.splice(idx, 1); else list.push(strat);
  state[s].activeStrategies = [...list];
  res.json({ activeStrategies: state[s].activeStrategies });
});
const port = Number(process.env.PORT || 3002);
app.listen(port, () => {
  console.log(`Crypto bot server listening on port ${port}`);
});
app.get('/ai_status', (req, res) => {
  try { res.json({ enabled: !!aiClient, aiState }); } catch { res.status(500).end(); }
});

async function consultGemini(symbol: string) {
  const now = Date.now();
  if (now - aiState[symbol].lastCheck < 5 * 60 * 1000) return;
  aiState[symbol].lastCheck = now;
  if (!aiClient) return;
  const st = state[symbol];
  if (!st.activeStrategies.includes('AI_AGENT')) return;
  const price = st.last15m ? st.last15m.close : 0;
  const prompt = `
  You are a disciplined Crypto Swing Trader.
  Your Goal: Identify strong trend continuation setups and ignore temporary chop.

  Market Data for ${symbol}:
  - Price: ${price}
  - Trend (Price vs SMA50): ${price > st.sma50 ? 'UP' : 'DOWN'}
  - Momentum (RSI 14): ${st.rsi14.toFixed(2)}

  CRITICAL RULES:
  1. RESPECT THE TREND: If Trend is 'UP' (Price > SMA50), you are looking for BUYS. A temporary dip in RSI is likely a buying opportunity, NOT a reversal. Rate it as NEUTRAL.
  2. GUARDIAN LOGIC: Only switch to "BEARISH" in an Uptrend if there is a massive breakdown structure. Otherwise, maintain a NEUTRAL/BULLISH bias.
  3. CONFIDENCE SCORING:
     - High (>80): Strong alignment (e.g. Price > SMA50 AND RSI > 50 and rising).
     - Low (<50): Conflicting signals (e.g. Price > SMA50 but RSI is overbought/diverging).

  Respond ONLY with a JSON object:
  { "sentiment": "BULLISH" | "BEARISH" | "NEUTRAL", "confidence": number (0-100), "reason": "concise rationale" }`;
  try {
    const resp = await aiClient.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: 'application/json' } });
    const text = (resp as any).text || '';
    const obj = JSON.parse(text);
    const snt = String(obj.sentiment || 'NEUTRAL').toUpperCase() as 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    const conf = typeof obj.confidence === 'number' ? obj.confidence : 0;
    aiState[symbol] = { lastCheck: now, sentiment: snt, confidence: conf };
  } catch { }
}

function evaluateAIAgent(symbol: string) {
  const st = state[symbol];
  if (!st.botActive || !st.activeStrategies.includes('AI_AGENT')) return;
  const hasAnyOpen = trades.some(t => t.symbol === symbol && t.status === 'OPEN');
  if (hasAnyOpen) return;
  const info = aiState[symbol];
  if (info.confidence < 70) return;
  const price = st.last15m ? st.last15m.close : 0;
  const isUp = price > st.sma50;
  if (info.sentiment === 'BULLISH' && isUp) {
    const sl = price * 0.992;
    const tp1 = price * 1.006;
    const tp2 = price * 1.012;
    const tp3 = price * 1.03;
    placeTrade(symbol, 'AI_AGENT', 'BUY', price, sl, tp1, tp2, tp3);
  } else if (info.sentiment === 'BEARISH' && !isUp) {
    const sl = price * 1.008;
    const tp1 = price * 0.994;
    const tp2 = price * 0.988;
    const tp3 = price * 0.97;
    placeTrade(symbol, 'AI_AGENT', 'SELL', price, sl, tp1, tp2, tp3);
  }
}

function notifyAll(title: string, body: string) {
  try {
    if (!webpushClient || !process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;
    const payload = JSON.stringify({ title, body });
    for (const sub of pushSubscriptions) { try { webpushClient.sendNotification(sub, payload).catch(() => { }); } catch { } }
  } catch { }
}

(async () => {
  try {
    const mod = await import('web-push');
    webpushClient = (mod as any).default || mod;
    const pub = process.env.VAPID_PUBLIC_KEY;
    const priv = process.env.VAPID_PRIVATE_KEY;
    if (pub && priv) webpushClient.setVapidDetails('mailto:admin@example.com', pub, priv);
  } catch { }
})();

async function fetchPrice(symbol: string) {
  try {
    const pid = symbol === 'BTCUSDT' ? 'BTC-USD' : symbol === 'ETHUSDT' ? 'ETH-USD' : symbol === 'SOLUSDT' ? 'SOL-USD' : '';
    if (!pid) return;
    const r = await fetch(`https://api.coinbase.com/v2/prices/${pid}/spot`);
    if (!r.ok) return;
    const j = await r.json();
    const amt = parseFloat(String(j?.data?.amount || '0'));
    if (!isFinite(amt) || amt <= 0) return;
    const p = amt;
    state[symbol].lastTick = p;
    state[symbol].lastTickTs = Date.now();
    const arr = state[symbol].uiTicks || [];
    arr.push(p);
    if (arr.length > 120) arr.shift();
    state[symbol].uiTicks = arr;
  } catch { }
}

setInterval(() => {
  try {
    const now = Date.now();
    for (const s of Object.keys(state)) {
      const ts = state[s].lastTickTs || 0;
      if (!ts || now - ts > 8000) fetchPrice(s);
    }
  } catch { }
}, 5000);