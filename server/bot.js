
import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { WebSocket } from 'ws';
import http from 'http';
import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { initFirebase, loadStateFromCloud, saveStateToCloud, clearCloudState } from './firebase.js';
import webpush from 'web-push';

// Load .env file from root
dotenv.config();

// --- WEB PUSH SETUP ---
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(
      'mailto:example@yourdomain.org',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    console.log('[SYSTEM] Web Push VAPID keys configured');
  } catch (e) {
    console.error('[SYSTEM] Failed to set VAPID details:', e);
  }
} else {
  console.warn('[SYSTEM] Missing VAPID keys for push notifications');
}

const app = express();
app.use(cors());
app.use(express.json());

// Cloud Request Logger
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.path}`);
  next();
});

const PORT = process.env.PORT || 3001;
const API_KEY = process.env.API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY || process.env.GENAI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
const OANDA_TOKEN = process.env.OANDA_API_KEY;
const OANDA_ACCOUNT_ID = process.env.OANDA_ACCOUNT_ID;
const OANDA_ENV = process.env.OANDA_ENV || 'practice';
const USE_OANDA = !!(OANDA_TOKEN && OANDA_ACCOUNT_ID);
const CRYPTO_UPSTREAM_URL = process.env.CRYPTO_UPSTREAM_URL || process.env.CRYPTO_REMOTE_URL || 'http://localhost:3002';
const ENABLE_GITHUB_SYNC = process.env.GITHUB_SYNC_ENABLED === 'true';

// --- NOTIFICATIONS (Twilio SMS) ---
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM = process.env.TWILIO_FROM;
const TWILIO_TO = process.env.TWILIO_TO;

function sendSms(body) {
  try {
    if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM || !TWILIO_TO) return;
    const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64');
    const postData = new URLSearchParams({ From: TWILIO_FROM, To: TWILIO_TO, Body: body }).toString();
    const options = {
      hostname: 'api.twilio.com',
      path: `/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    const req = https.request(options, (res) => {
      res.on('data', () => { });
    });
    req.on('error', () => { });
    req.write(postData);
    req.end();
  } catch { }
}

// --- GOOGLE GENAI SETUP ---
let aiClient = null;

console.log("[SYSTEM] Initializing Bot Server...");

if (API_KEY) {
  try {
    aiClient = new GoogleGenAI({ apiKey: API_KEY });
    console.log("[SYSTEM] Gemini AI Client Initialized Successfully");
    console.log("[SYSTEM] Key found: " + API_KEY.substring(0, 8) + "...");
  } catch (e) {
    console.error("[SYSTEM] Failed to initialize Gemini Client:", e);
  }
} else {
  console.warn("-----------------------------------------------------------");
  console.warn("[SYSTEM] WARNING: No API_KEY found in environment variables.");
  console.warn("[SYSTEM] 1. Ensure a file named '.env' exists in the root folder.");
  console.warn("[SYSTEM] 2. Ensure it contains the line: API_KEY=your_key_here");
  console.warn("[SYSTEM] AI strategies will default to Simulation Mode (Random Walk).");
  console.warn("-----------------------------------------------------------");
}

// --- TYPES & CONFIG ---
const ASSET_CONFIG = {
  'NAS100': { startPrice: 18500, volatility: 0.0015, decimals: 1, lotSize: 1, valuePerPoint: 1, minLot: 0.01, maxLot: 100, lotStep: 0.01 }
};

const INITIAL_BALANCE = 500;
const RISK_PER_TRADE = 0.01;

// --- STATE ---
let account = {
  balance: INITIAL_BALANCE,
  equity: INITIAL_BALANCE,
  dayPnL: 0,
  totalPnL: 0
};

let trades = [];

let pushSubscriptions = [];

const sseClients = new Set();

// --- PERSISTENCE ---
const DATA_DIR = path.join(process.cwd(), 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');

function recalculateAccountState() {
  let realized = 0;
  let day = 0;
  const startOfDay = new Date().setHours(0, 0, 0, 0);
  for (const t of trades) {
    if (t.status === 'CLOSED') {
      realized += (t.pnl || 0);
      const time = t.closeTime || t.openTime || 0;
      if (time >= startOfDay) day += (t.pnl || 0);
    }
  }
  account.balance = INITIAL_BALANCE + realized;
  account.equity = account.balance;
  account.totalPnL = realized;
  account.dayPnL = day;
  console.log(`[SYSTEM] Recalculated: Bal £${account.balance.toFixed(2)}, Day £${account.dayPnL.toFixed(2)}`);
  saveState();
}

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf8');
      try {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.account && Array.isArray(parsed.trades)) {
          account = parsed.account;
          trades = parsed.trades;
          pushSubscriptions = Array.isArray(parsed.pushSubscriptions) ? parsed.pushSubscriptions : [];

          // Restore Asset Configuration
          if (parsed.assets && typeof assets !== 'undefined') {
            for (const [sym, cfg] of Object.entries(parsed.assets)) {
              if (assets[sym]) {
                if (Array.isArray(cfg.activeStrategies)) assets[sym].activeStrategies = cfg.activeStrategies;
                if (typeof cfg.botActive === 'boolean') assets[sym].botActive = cfg.botActive;
              }
            }
            if (assets['NAS100']) {
              assets['NAS100'].activeStrategies = (assets['NAS100'].activeStrategies || []).filter(s => s !== 'TREND_FOLLOW');
            }
          }

          recalculateAccountState();
          console.log(`[SYSTEM] Loaded persisted state: ${trades.length} trades, balance £${account.balance.toFixed(2)}`);
          return;
        }
      } catch (parseError) {
        console.warn('[SYSTEM] State file corrupted, attempting backup...');
      }
    }

    // Try backup if main fails
    const BACKUP_FILE = `${STATE_FILE}.bak`;
    if (fs.existsSync(BACKUP_FILE)) {
      const raw = fs.readFileSync(BACKUP_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && parsed.account && Array.isArray(parsed.trades)) {
        account = parsed.account;
        trades = parsed.trades;
        pushSubscriptions = Array.isArray(parsed.pushSubscriptions) ? parsed.pushSubscriptions : [];

        // Restore Asset Configuration from Backup
        if (parsed.assets && typeof assets !== 'undefined') {
          for (const [sym, cfg] of Object.entries(parsed.assets)) {
            if (assets[sym]) {
              if (Array.isArray(cfg.activeStrategies)) assets[sym].activeStrategies = cfg.activeStrategies;
              if (typeof cfg.botActive === 'boolean') assets[sym].botActive = cfg.botActive;
            }
          }
        }

        recalculateAccountState();
        console.log(`[SYSTEM] Loaded backup state: ${trades.length} trades`);
      }
    }
  } catch (e) {
    console.warn('[SYSTEM] Failed to load state:', e.message);
  }
}

function saveState() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });

    // Persist Asset Configuration
    const assetsConfig = {};
    if (typeof assets !== 'undefined') {
      for (const [sym, data] of Object.entries(assets)) {
        assetsConfig[sym] = {
          activeStrategies: data.activeStrategies,
          botActive: data.botActive
        };
      }
    }

    const payload = JSON.stringify({ account, trades, pushSubscriptions, assets: assetsConfig }, null, 2);

    // Create backup of current state if it exists
    if (fs.existsSync(STATE_FILE)) {
      try {
        fs.copyFileSync(STATE_FILE, `${STATE_FILE}.bak`);
      } catch { }
    }

    // Atomic write: Write to temp file then rename
    const tempFile = `${STATE_FILE}.tmp`;
    fs.writeFileSync(tempFile, payload, 'utf8');
    fs.renameSync(tempFile, STATE_FILE);
  } catch (e) {
    console.warn('[SYSTEM] Failed to save state:', e.message);
  }
  cloudSaveState();
}

// CANDLE STORAGE (Symbol -> M5 Candles [])
let candlesM5 = {
  'NAS100': []
};
let candlesH1 = {
  'NAS100': []
};

// MARKET STATE (bid/ask/mid per symbol)
const SPREAD_PCT = { 'NAS100': 0.0005 };
let market = {
  'NAS100': { bid: ASSET_CONFIG['NAS100'].startPrice * (1 - SPREAD_PCT['NAS100'] / 2), ask: ASSET_CONFIG['NAS100'].startPrice * (1 + SPREAD_PCT['NAS100'] / 2), mid: ASSET_CONFIG['NAS100'].startPrice }
};

function updateMarketFromMid(symbol, mid) {
  const sp = SPREAD_PCT[symbol] || 0.0002;
  const bid = mid * (1 - sp / 2);
  const ask = mid * (1 + sp / 2);
  market[symbol] = { bid, ask, mid };
}

function isWithinLondonSweepWindow(ts) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(ts));
    let hh = 0, mm = 0;
    for (const p of parts) {
      if (p.type === 'hour') hh = parseInt(p.value, 10);
      else if (p.type === 'minute') mm = parseInt(p.value, 10);
    }
    const m = hh * 60 + mm;
    return m >= (7 * 60 + 45) && m <= (10 * 60 + 30);
  } catch { return false; }
}

// AI CACHE (To prevent spamming API)
let aiState = {
  'NAS100': { lastCheck: 0, sentiment: 'NEUTRAL', confidence: 0, reason: '' }
};

// INITIALIZE ASSETS WITH BOTH STRATEGIES ACTIVE BY DEFAULT
let assets = {
  'NAS100': createAsset('NAS100', ['NY_ORB'])
};

function createAsset(symbol, defaultStrategies) {
  return {
    symbol,
    currentPrice: ASSET_CONFIG[symbol].startPrice,
    history: [],
    rsi: 50,
    ema: ASSET_CONFIG[symbol].startPrice,
    ema200: ASSET_CONFIG[symbol].startPrice,
    ema200H1: ASSET_CONFIG[symbol].startPrice,
    htfTrend: 'UP',
    trend: 'UP',
    macd: { macdLine: 0, signalLine: 0, histogram: 0 },
    bollinger: { upper: 0, middle: 0, lower: 0 },
    slope: 0,
    botActive: true,
    activeStrategies: defaultStrategies, // Array of strings
    isLive: false,
    isThinking: false
  };
}

loadState();
console.log(USE_OANDA ? '[SYSTEM] Using OANDA pricing stream' : '[SYSTEM] Using Binance pricing stream (fallback)');
cloudLoadState();
setInterval(() => { try { cloudLoadState(); } catch { } }, 10 * 60 * 1000);

if (ENABLE_GITHUB_SYNC) {
  (async () => { try { await githubLoadState(); } catch { } })();
  setInterval(() => { try { githubLoadState(); } catch { } }, 10 * 60 * 1000);
}
async function githubLoadState() {
  try {
    const url = 'https://raw.githubusercontent.com/mrtomkeddie/Paper-Trader-2.0/main/data/state.json';
    const raw = await new Promise((resolve) => {
      try {
        const req = https.get(url, (res) => {
          let buf = '';
          res.on('data', (d) => { buf += d; });
          res.on('end', () => resolve(buf));
        });
        req.on('error', () => resolve(null));
        req.end();
      } catch { resolve(null); }
    });
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed?.trades) ? parsed.trades : [];
    const keyForTrade = (t) => {
      if (!t) return '';
      if (t.id) return t.id;
      const parts = [t.symbol, t.entryPrice, t.openTime || t.open_time || t.openTimestamp, t.initialSize];
      return parts.filter(Boolean).join('|');
    };
    const mergedByKey = new Map();
    for (const t of trades) mergedByKey.set(keyForTrade(t), t);
    for (const t of arr) {
      const k = keyForTrade(t);
      if (!k) continue;
      const existing = mergedByKey.get(k);
      if (!existing) {
        mergedByKey.set(k, t);
      } else {
        const preferRemote = (existing.status !== 'CLOSED' && t.status === 'CLOSED') ||
          (typeof t.closeTime === 'number' && typeof existing.closeTime === 'number' && t.closeTime > existing.closeTime);
        if (preferRemote) mergedByKey.set(k, t);
      }
    }
    const mergedList = Array.from(mergedByKey.values());
    if (mergedList.length > trades.length) {
      trades = mergedList;
      if (parsed?.account && typeof parsed.account.balance === 'number') account = parsed.account;
      saveState();
      console.log(`[SYSTEM] GitHub state merged: ${trades.length} trades`);
    }
  } catch { }
}



// --- INDICATORS MATH ---
const calculateEMA = (currentPrice, prevEMA, period) => {
  if (!prevEMA) return currentPrice;
  const k = 2 / (period + 1);
  return currentPrice * k + prevEMA * (1 - k);
};

const calculateSlope = (prices, period = 10) => {
  if (prices.length < period) return 0;
  const slice = prices.slice(-period);
  const n = slice.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += slice[i];
    sumXY += i * slice[i];
    sumXX += i * i;
  }
  return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
};

const calculateRSI = (prices, period = 14) => {
  if (prices.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - (100 / (1 + rs));
};

const calculateEMAFromSeries = (prices, period = 200) => {
  if (!Array.isArray(prices) || prices.length === 0) return 0;
  const k = 2 / (period + 1);
  let ema;
  if (prices.length >= period) {
    const firstSlice = prices.slice(0, period);
    const sma = firstSlice.reduce((a, b) => a + b, 0) / firstSlice.length;
    ema = sma;
    for (let i = period; i < prices.length; i++) {
      ema = prices[i] * k + ema * (1 - k);
    }
  } else {
    ema = prices.reduce((a, b) => a + b, 0) / prices.length;
  }
  return ema;
};

// --- REAL AI INTEGRATION ---
async function consultGemini(symbol, asset) {
  // 1. Check Rate Limit (Max once every 5 mins per asset)
  const now = Date.now();
  if (now - aiState[symbol].lastCheck < 5 * 60 * 1000) {
    return null; // Too soon, use cached decision
  }

  if (!aiClient) {
    // Fallback to Simulator if no API Key
    aiState[symbol].lastCheck = now;
    return null;
  }

  assets[symbol].isThinking = true;

  try {
    console.log(`[AI] Consulting Gemini for ${symbol}...`);

    const prompt = `
You are a seasoned Trend Following Swing Trader. You do not panic during noise.
Your Goal: Identify valid entries in the direction of the trend and ignore temporary pullbacks.

Market Data for ${symbol}:
- Price: ${asset.currentPrice}
- Primary Trend (200 EMA): ${asset.trend}
- Higher Timeframe Trend (1H 200 EMA): ${asset.htfTrend}
- Momentum (RSI 14): ${asset.rsi.toFixed(2)}
- Immediate Slope: ${asset.slope.toFixed(4)}
- Volatility (Band Width): ${(asset.bollinger.upper - asset.bollinger.lower).toFixed(2)}

CRITICAL RULES:
CONTEXT: The Higher Timeframe (1H) Trend is the 'King'. Follow these rules:
- If 1H Trend is UP: Look for BUYS (view 5m dips as buying opportunities). Do not bet against the trend.
- If 1H Trend is DOWN: Look for SELLS (view 5m rallies as selling opportunities). Do not bet against the trend.
- If 1H Trend is NEUTRAL or FLAT: You are FREE to trade BOTH directions. Scalp the range and look for momentum in either direction.

1. RESPECT THE TREND: In a strong trend (UP/DOWN), temporary counter-moves are likely healthy pullbacks, NOT reversals. Rate them as NEUTRAL, not against the trend.
2. THE GUARDIAN CHECK: Only output a counter-trend signal if there is a catastrophic reversal (e.g. price crashing in an uptrend). Otherwise, hold the bias or stay NEUTRAL.
3. NEUTRAL MARKET FREEDOM: In a NEUTRAL/FLAT 1H trend, you can be BULLISH or BEARISH based on 5m momentum, RSI, and slope. Look for breakouts or range scalps.
4. CONFIDENCE SCORING:
   - High Confidence (>80): Perfect alignment (e.g. Uptrend + Positive Slope + RSI rising from 40, OR Neutral trend + strong momentum signal).
   - Low Confidence (<50): Conflicting signals (e.g. Uptrend + Negative Slope without clear pullback pattern).

Determine the market sentiment based on specific Trend Following logic.
Respond ONLY with a JSON object in this format:
{ "sentiment": "BULLISH" | "BEARISH" | "NEUTRAL", "confidence": number (0-100), "reason": "concise trade rationale" }`;

    const response = await aiClient.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text;
    const decision = JSON.parse(text);

    aiState[symbol] = {
      lastCheck: now,
      sentiment: decision.sentiment,
      confidence: decision.confidence,
      reason: decision.reason
    };

    console.log(`[AI] Decision for ${symbol}: ${decision.sentiment} (${decision.confidence}%)`);

  } catch (error) {
    console.error(`[AI] Error consulting Gemini:`, error);
  } finally {
    assets[symbol].isThinking = false;
  }
}


// --- LIVE DATA CONNECTION (BINANCE) ---
let ws;
function connectBinance() {
  ws = new WebSocket('wss://stream.binance.com:9443/ws/paxgusdt@kline_1m/btcusdt@kline_1m');
  ws.on('open', () => { });
  ws.on('message', (data) => {
    try {
      const event = JSON.parse(data);
      const isGold = event.s === 'PAXGUSDT';
      const isNas = event.s === 'BTCUSDT';
      const symbol = isGold ? 'XAU/USD' : isNas ? 'NAS100' : null;
      if (symbol && event.k) {
        const price = isNas ? parseFloat(event.k.c) / 5 : parseFloat(event.k.c);
        updateMarketFromMid(symbol, price);
        const asset = assets[symbol];
        asset.currentPrice = market[symbol].mid;
        asset.isLive = true;
        asset.history.push({ time: new Date().toLocaleTimeString(), value: market[symbol].mid });
        if (asset.history.length > 300) asset.history.shift();
        asset.ema = calculateEMA(asset.currentPrice, asset.ema, 20);
        asset.ema200 = calculateEMA(asset.currentPrice, asset.ema200, 200);
        const closedCloses = candlesM5[symbol].filter(c => c.isClosed).map(c => c.close);
        asset.slope = calculateSlope(closedCloses, 10);
        asset.rsi = calculateRSI(asset.history.map(h => h.value));
        asset.trend = price > asset.ema200 ? 'UP' : 'DOWN';
        const sma = asset.ema;
        const stdDev = asset.currentPrice * 0.002;
        asset.bollinger = { upper: sma + stdDev * 2, middle: sma, lower: sma - stdDev * 2 };
        updateCandles(symbol, asset.currentPrice);
        updateCandlesH1(symbol, asset.currentPrice);
        processTicks(symbol);
      }
    } catch { }
  });
  ws.on('close', () => { setTimeout(connectLiveFeed, 5000); });
  ws.on('error', () => { try { ws.close(); } catch { } });
}

let oandaReq = null;
let lastOandaHeartbeat = Date.now();

function connectOanda() {
  const host = OANDA_ENV === 'live' ? 'stream-fxtrade.oanda.com' : 'stream-fxpractice.oanda.com';
  const instruments = ['NAS100_USD'].join(',');
  const options = {
    hostname: host,
    path: `/v3/accounts/${OANDA_ACCOUNT_ID}/pricing/stream?instruments=${encodeURIComponent(instruments)}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${OANDA_TOKEN}` }
  };

  if (oandaReq) { try { oandaReq.destroy(); } catch { } }

  oandaReq = https.request(options, (res) => {
    let buffer = '';
    res.on('data', (chunk) => {
      lastOandaHeartbeat = Date.now();
      buffer += chunk.toString();
      const parts = buffer.split('\n');
      buffer = parts.pop() || '';
      for (const line of parts) {
        if (!line.trim()) continue;
        try {
          const evt = JSON.parse(line);
          if (evt.type === 'PRICE') {
            const inst = evt.instrument;
            const bid = parseFloat(evt.bids?.[0]?.price || evt.closeoutBid || '0');
            const ask = parseFloat(evt.asks?.[0]?.price || evt.closeoutAsk || '0');
            const mid = ask && bid ? (ask + bid) / 2 : (parseFloat(evt.price || '0'));
            const symbol = inst === 'NAS100_USD' ? 'NAS100' : null;
            if (!symbol || !mid) continue;
            market[symbol] = { bid, ask, mid };
            const asset = assets[symbol];
            asset.currentPrice = market[symbol].mid;
            asset.isLive = true;
            asset.history.push({ time: new Date().toLocaleTimeString(), value: market[symbol].mid });
            if (asset.history.length > 300) asset.history.shift();
            asset.ema = calculateEMA(asset.currentPrice, asset.ema, 20);
            asset.ema200 = calculateEMA(asset.currentPrice, asset.ema200, 200);
            const closedCloses2 = candlesM5[symbol].filter(c => c.isClosed).map(c => c.close);
            asset.slope = calculateSlope(closedCloses2, 10);
            asset.rsi = calculateRSI(asset.history.map(h => h.value));
            asset.trend = asset.currentPrice > asset.ema200 ? 'UP' : 'DOWN';
            const sma = asset.ema;
            const stdDev = asset.currentPrice * 0.002;
            asset.bollinger = { upper: sma + stdDev * 2, middle: sma, lower: sma - stdDev * 2 };
            updateCandles(symbol, asset.currentPrice);
            updateCandlesH1(symbol, asset.currentPrice);
            processTicks(symbol);
          }
        } catch { }
      }
    });
    res.on('end', () => { setTimeout(connectLiveFeed, 5000); });
  });
  oandaReq.on('error', () => { setTimeout(connectLiveFeed, 5000); });
  oandaReq.end();
}

// OANDA Watchdog: Force reconnect if stream is silent > 60s
setInterval(() => {
  if (Date.now() - lastOandaHeartbeat > 60000) {
    console.warn('[SYSTEM] OANDA stream silent > 1min. Force reconnecting...');
    connectLiveFeed();
    lastOandaHeartbeat = Date.now();
  }
}, 10000);

function connectLiveFeed() {
  connectOanda();
}

connectLiveFeed();

(async () => {
  try {
    if (!USE_OANDA) return;
    const host = OANDA_ENV === 'live' ? 'api-fxtrade.oanda.com' : 'api-fxpractice.oanda.com';
    const map = { 'NAS100': 'NAS100_USD' };
    for (const symbol of Object.keys(assets)) {
      const inst = map[symbol];
      if (!inst) continue;
      const options = {
        hostname: host,
        path: `/v3/instruments/${encodeURIComponent(inst)}/candles?granularity=H1&price=M&count=200`,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${OANDA_TOKEN}` }
      };
      await new Promise((resolve) => {
        const req = https.request(options, (res) => {
          let buf = '';
          res.on('data', (chunk) => { buf += chunk.toString(); });
          res.on('end', () => {
            try {
              const j = JSON.parse(buf);
              const arr = Array.isArray(j.candles) ? j.candles : [];
              const list = [];
              for (const c of arr) {
                if (!c || c.complete === false) continue;
                const o = parseFloat(c.mid?.o || c.open || c.close || '0');
                const h = parseFloat(c.mid?.h || c.high || '0');
                const l = parseFloat(c.mid?.l || c.low || '0');
                const cl = parseFloat(c.mid?.c || c.close || '0');
                const t = new Date(c.time).getTime();
                if (isFinite(cl) && cl > 0) list.push({ open: o || cl, high: h || cl, low: l || cl, close: cl, time: t, isClosed: true });
              }
              candlesH1[symbol] = list.slice(-200);
              const closes = candlesH1[symbol].map(e => e.close);
              if (closes.length > 0) {
                const emaH1 = calculateEMAFromSeries(closes, 200);
                assets[symbol].ema200H1 = emaH1;
                const price = assets[symbol].currentPrice;
                assets[symbol].htfTrend = (price > emaH1) ? 'UP' : 'DOWN';
              }
            } catch { }
            resolve(null);
          });
        });
        req.on('error', () => resolve(null));
        req.end();
      });
    }
    console.log('[SYSTEM] Initialized 1H history and EMA200 for Indices/Gold');
  } catch { }
})();

function notifyAll(title, body) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;
  const payload = JSON.stringify({ title, body });
  for (const sub of pushSubscriptions) {
    try { webpush.sendNotification(sub, payload).catch(() => { }); } catch { }
  }
}


// --- CANDLE ENGINE ---
function updateCandles(symbol, price) {
  const timeframeMs = 5 * 60 * 1000;
  const now = Date.now();
  const currentCandles = candlesM5[symbol];

  if (currentCandles.length === 0) {
    currentCandles.push({ open: price, high: price, low: price, close: price, time: now, isClosed: false });
    return;
  }

  const lastCandle = currentCandles[currentCandles.length - 1];
  const timeElapsed = now - lastCandle.time;

  if (timeElapsed < timeframeMs) {
    lastCandle.high = Math.max(lastCandle.high, price);
    lastCandle.low = Math.min(lastCandle.low, price);
    lastCandle.close = price;
  } else {
    lastCandle.isClosed = true;
    // Candle Close Event - Good time to check AI
    consultGemini(symbol, assets[symbol]);

    currentCandles.push({ open: price, high: price, low: price, close: price, time: now, isClosed: false });
    if (currentCandles.length > 200) currentCandles.shift();
  }
}

function updateCandlesH1(symbol, price) {
  const timeframeMs = 60 * 60 * 1000;
  const now = Date.now();
  const list = candlesH1[symbol];
  if (list.length === 0) {
    list.push({ open: price, high: price, low: price, close: price, time: now, isClosed: false });
    return;
  }
  const last = list[list.length - 1];
  const elapsed = now - last.time;
  if (elapsed < timeframeMs) {
    last.high = Math.max(last.high, price);
    last.low = Math.min(last.low, price);
    last.close = price;
  } else {
    last.isClosed = true;
    list.push({ open: price, high: price, low: price, close: price, time: now, isClosed: false });
    if (list.length > 200) list.shift();
    const closes = list.filter(c => c.isClosed).map(c => c.close);
    if (closes.length > 0) {
      const emaH1 = calculateEMAFromSeries(closes, 200);
      assets[symbol].ema200H1 = emaH1;
      const p = assets[symbol].currentPrice;
      assets[symbol].htfTrend = (p > emaH1) ? 'UP' : 'DOWN';
    }
  }
}

// --- STRATEGY & TRADE LOGIC ---
function executeTrade(symbol, type, price, strategy, risk) {
  const isBuy = type === 'BUY';

  const { bid, ask } = market[symbol];
  const fillPrice = isBuy ? ask : bid;
  const sl = isBuy ? fillPrice * (1 - 0.0015) : fillPrice * (1 + 0.0015);
  const tp1 = isBuy ? fillPrice * (1 + 0.006) : fillPrice * (1 - 0.006);
  const tp2 = isBuy ? fillPrice * (1 + 0.01) : fillPrice * (1 - 0.01);
  const tp3 = isBuy ? fillPrice * (1 + 0.03) : fillPrice * (1 - 0.03);

  const cfg = ASSET_CONFIG[symbol] || { minLot: 0.01, maxLot: 100, lotStep: 0.01 };
  const monetaryRisk = Math.abs(account.balance) * RISK_PER_TRADE;
  const slDistance = Math.abs(fillPrice - sl);
  const rawLotSize = slDistance > 0 ? (monetaryRisk / (slDistance * (cfg.valuePerPoint || 1))) : cfg.minLot;
  let lotSize = Math.max(cfg.minLot, Math.min(rawLotSize, cfg.maxLot));
  lotSize = Math.round(lotSize / cfg.lotStep) * cfg.lotStep;
  lotSize = Math.max(cfg.minLot, Math.min(lotSize, cfg.maxLot));

  const trade = {
    id: uuidv4(), symbol, type, entryPrice: fillPrice, initialSize: lotSize, currentSize: lotSize,
    stopLoss: sl, tpLevels: [
      { id: 1, price: tp1, percentage: 0.4, hit: false },
      { id: 2, price: tp2, percentage: 0.4, hit: false },
      { id: 3, price: tp3, percentage: 0.2, hit: false }
    ],
    openTime: Date.now(), status: 'OPEN', strategy, pnl: 0, entryReason: `${strategy} Signal`
  };
  trades.unshift(trade);
  console.log(`[BOT] Executed ${type} on ${symbol} @ ${price} via ${strategy}`);
  sendSms(`OPEN ${symbol} ${type} @ ${fillPrice.toFixed(2)} (${strategy})`);
  notifyAll('Trade Opened', `${symbol} ${type} @ ${fillPrice.toFixed(2)} (${strategy})`);
  saveState();
}

function processTicks(symbol) {
  let closedPnL = 0;
  let closedAnyTrade = false;
  const openTrades = trades.filter(t => t.status === 'OPEN' && t.symbol === symbol);
  const asset = assets[symbol];
  const { bid, ask, mid } = market[symbol];
  const price = mid;

  // 1. Manage Trades (TP/SL + AI GUARDIAN + TRAILING)
  for (const trade of openTrades) {
    const isBuy = trade.type === 'BUY';

    // A. AI GUARDIAN (Panic Close)
    if (asset.activeStrategies.includes('AI_AGENT') && aiState[symbol].confidence > 80) {
      const sentiment = aiState[symbol].sentiment;
      // If Long and Sentiment is Bearish -> Close
      if (isBuy && sentiment === 'BEARISH') {
        trade.status = 'CLOSED'; trade.closeReason = 'AI_GUARDIAN'; trade.closeTime = Date.now(); trade.closePrice = price;
        console.log(`[AI GUARDIAN] Panic Closed ${symbol} Trade due to Strong Bearish Sentiment`);
        const pnl = (price - trade.entryPrice) * trade.currentSize;
        trade.pnl += pnl; account.balance += pnl; closedPnL += pnl;
        closedAnyTrade = true;
        sendSms(`CLOSE ${symbol} ${trade.type} @ ${price.toFixed(2)} (AI_GUARDIAN) PnL ${pnl.toFixed(2)}`);
        notifyAll('Trade Closed', `${symbol} ${trade.type} @ ${price.toFixed(2)} (AI_GUARDIAN) PnL ${pnl.toFixed(2)}`);
        continue; // Next trade
      }
      // If Short and Sentiment is Bullish -> Close
      if (!isBuy && sentiment === 'BULLISH') {
        trade.status = 'CLOSED'; trade.closeReason = 'AI_GUARDIAN'; trade.closeTime = Date.now(); trade.closePrice = price;
        console.log(`[AI GUARDIAN] Panic Closed ${symbol} Trade due to Strong Bullish Sentiment`);
        const pnl = (trade.entryPrice - price) * trade.currentSize;
        trade.pnl += pnl; account.balance += pnl; closedPnL += pnl;
        closedAnyTrade = true;
        sendSms(`CLOSE ${symbol} ${trade.type} @ ${price.toFixed(2)} (AI_GUARDIAN) PnL ${pnl.toFixed(2)}`);
        notifyAll('Trade Closed', `${symbol} ${trade.type} @ ${price.toFixed(2)} (AI_GUARDIAN) PnL ${pnl.toFixed(2)}`);
        continue;
      }
    }

    // B. TRAILING STOP
    // If profit > 0.2%, move SL to Breakeven + Trail
    const currentProfitPct = isBuy ? (bid - trade.entryPrice) / trade.entryPrice : (trade.entryPrice - ask) / trade.entryPrice;
    if (currentProfitPct > 0.002) {
      if (isBuy) {
        const newSL = bid * 0.999;
        if (newSL > trade.stopLoss) trade.stopLoss = newSL;
      } else {
        const newSL = ask * 1.001;
        if (newSL < trade.stopLoss) trade.stopLoss = newSL;
      }
    }

    // C. STANDARD TP CHECKS
    for (const level of trade.tpLevels) {
      if (!level.hit) {
        const hit = isBuy ? bid >= level.price : ask <= level.price;
        if (hit) {
          const closeAmt = trade.initialSize * level.percentage;
          const exit = isBuy ? bid : ask;
          const pnl = (isBuy ? exit - trade.entryPrice : trade.entryPrice - exit) * closeAmt;
          trade.currentSize -= closeAmt;
          trade.pnl += pnl;
          level.hit = true;
          account.balance += pnl;
          closedPnL += pnl;
          if (level.id === 1) trade.stopLoss = trade.entryPrice; // Breakeven
        }
      }
    }

    // D. STANDARD SL CHECK
    if (isBuy ? bid <= trade.stopLoss : ask >= trade.stopLoss) {
      trade.status = 'CLOSED'; trade.closeReason = 'STOP_LOSS'; trade.closeTime = Date.now(); trade.closePrice = price;
      const exit = isBuy ? bid : ask;
      const pnl = (isBuy ? exit - trade.entryPrice : trade.entryPrice - exit) * trade.currentSize;
      trade.pnl += pnl; account.balance += pnl; closedPnL += pnl;
      closedAnyTrade = true;
      sendSms(`CLOSE ${symbol} ${trade.type} @ ${exit.toFixed(2)} (STOP_LOSS) PnL ${pnl.toFixed(2)}`);
      notifyAll('Trade Closed', `${symbol} ${trade.type} @ ${exit.toFixed(2)} (STOP_LOSS) PnL ${pnl.toFixed(2)}`);
    }
  }
  for (const t of openTrades) {
    const isBuy = t.type === 'BUY';
    const exit = isBuy ? bid : ask;
    t.floatingPnl = (isBuy ? exit - t.entryPrice : t.entryPrice - exit) * t.currentSize;
  }
  account.dayPnL += closedPnL;
  account.totalPnL += closedPnL;
  account.equity = account.balance;
  if (closedAnyTrade || closedPnL !== 0) saveState();

  // 2. Run Strategies (Only if no open trade)
  if (!asset.botActive) return;
  if (openTrades.length > 0) return; // Max 1 trade per asset
  {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date());
    const hh = parseInt(String(parts.find(p => p.type === 'hour')?.value || '0'), 10);
    const mm = parseInt(String(parts.find(p => p.type === 'minute')?.value || '0'), 10);
    const inLunch = (hh === 11 && mm >= 30) || (hh > 11 && hh < 15);
    if (symbol === 'NAS100' && inLunch) { console.log('[FILTER] Signal skipped - Lunch Pause'); return; }
  }
  const nowUtc = new Date();
  const dow = nowUtc.getUTCDay();
  const hour = nowUtc.getUTCHours();
  if ((dow === 5 && hour >= 21) || dow === 6 || dow === 0) return;

  // A. TREND FOLLOW (24/7)
  if (asset.activeStrategies.includes('TREND_FOLLOW') && symbol !== 'NAS100') {
    const isTrendUp = asset.currentPrice > asset.ema200;
    const pullback = isTrendUp ? asset.currentPrice <= asset.ema : asset.currentPrice >= asset.ema;
    const confirm = isTrendUp ? asset.slope > 0.1 : asset.slope < -0.1;
    if (isTrendUp && pullback && confirm) executeTrade(symbol, 'BUY', asset.currentPrice, 'TREND_FOLLOW', 'AGGRESSIVE');
    else if (!isTrendUp && pullback && confirm) executeTrade(symbol, 'SELL', asset.currentPrice, 'TREND_FOLLOW', 'AGGRESSIVE');
  }

  // B. LONDON SWEEP (GOLD)
  if (asset.activeStrategies.includes('LONDON_SWEEP') && symbol === 'XAU/USD') {
    const allow = isWithinLondonSweepWindow(Date.now());
    if (allow) {
      const candles = candlesM5[symbol];
      if (candles.length > 10) {
        const lowest = Math.min(...candles.slice(-10, -1).map(c => c.low));
        const current = candles[candles.length - 1];
        if (current.low < lowest && asset.currentPrice > lowest + 0.5) {
          executeTrade(symbol, 'BUY', asset.currentPrice, 'LONDON_SWEEP', 'CONSERVATIVE');
        }
      }
    }
  }

  // C. NY ORB (NAS100)
  if (asset.activeStrategies.includes('NY_ORB') && symbol === 'NAS100') {
    const volExpansion = asset.bollinger.upper - asset.bollinger.lower > asset.currentPrice * 0.0016;
    if (volExpansion && asset.trend === 'UP' && asset.currentPrice > asset.bollinger.upper) {
      console.log(`[NY_ORB] ${symbol} BUY @ ${asset.currentPrice.toFixed(2)}`);
      executeTrade(symbol, 'BUY', asset.currentPrice, 'NY_ORB', 'AGGRESSIVE');
    }
  }

  // D. AI AGENT (Real Gemini)
  const minConfidence = (symbol === 'NAS100' && hour >= 16 && hour < 17) ? 85 : 75;
  if (asset.activeStrategies.includes('AI_AGENT') && aiState[symbol].confidence > minConfidence) {
    const sentiment = aiState[symbol].sentiment;
    // If AI is Bullish and we are in Uptrend -> Buy
    if (sentiment === 'BULLISH' && asset.trend === 'UP') {
      executeTrade(symbol, 'BUY', asset.currentPrice, 'AI_AGENT', 'SMART');
      // Reset state so we don't spam
      aiState[symbol].confidence = 0;
    } else if (sentiment === 'BEARISH' && asset.trend === 'DOWN') {
      executeTrade(symbol, 'SELL', asset.currentPrice, 'AI_AGENT', 'SMART');
      aiState[symbol].confidence = 0;
    }
  }
}

// --- API ---
app.get('/state', (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  } catch { }
  try {
  } catch { }
  try {
    for (const t of trades) {
      if (t.status === 'OPEN' && market[t.symbol]) {
        const { bid, ask } = market[t.symbol];
        const isBuy = t.type === 'BUY';
        const exit = isBuy ? bid : ask;
        t.floatingPnl = (isBuy ? exit - t.entryPrice : t.entryPrice - exit) * t.currentSize;
      }
    }
  } catch { }
  res.json({ account, trades, assets });
});

app.get('/events', (req, res) => {
  try {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Connection', 'keep-alive');
  } catch { }
  try { res.write(`retry: 3000\n\n`); } catch { }
  sseClients.add(res);
  try { const payload = JSON.stringify({ account, trades, assets }); res.write(`data: ${payload}\n\n`); } catch { }
  req.on('close', () => { try { sseClients.delete(res); } catch { } });
});

app.get('/export/json', (req, res) => {
  const status = (req.query.status || 'closed').toString().toUpperCase();
  const data = status === 'ALL' ? trades : trades.filter(t => t.status === 'CLOSED');
  res.json(data);
});

app.get('/export/csv', (req, res) => {
  const status = (req.query.status || 'closed').toString().toUpperCase();
  const symbolParam = (req.query.symbol || '').toString();
  let list = status === 'ALL' ? trades : trades.filter(t => t.status === 'CLOSED');
  if (symbolParam && symbolParam !== 'ALL') list = list.filter(t => t.symbol === symbolParam);
  const headers = ['id', 'symbol', 'type', 'entryPrice', 'initialSize', 'currentSize', 'stopLoss', 'openTime', 'closeTime', 'closePrice', 'pnl', 'status', 'strategy'];
  const rows = list.map(t => [
    t.id,
    t.symbol,
    t.type,
    t.entryPrice,
    t.initialSize,
    t.currentSize,
    t.stopLoss,
    t.openTime,
    t.closeTime || '',
    t.closePrice || '',
    t.pnl || 0,
    t.status,
    t.strategy
  ].join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  const fname = symbolParam && symbolParam !== 'ALL' ? `trades_${symbolParam.replace(/[^A-Za-z0-9_-]/g, '')}.csv` : 'trades.csv';
  res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
  res.send(csv);
});

app.get('/cloud/status', async (req, res) => {
  try {
    if (!db) return res.json({ initialized: false });
    const snap = await db.doc('pt2/state').get();
    if (!snap.exists) return res.json({ initialized: true, exists: false });
    const data = snap.data() || {};
    const tradeCount = Array.isArray(data.trades) ? data.trades.length : 0;
    const updatedAt = data.updatedAt || null;
    res.json({ initialized: true, exists: true, tradeCount, accountBalance: data.account?.balance, updatedAt });
  } catch (e) {
    res.status(500).json({ initialized: !!db, error: e?.message || 'error' });
  }
});

app.post('/cloud/sync', (req, res) => {
  try {
    saveState();
    res.sendStatus(200);
  } catch (e) {
    res.status(500).json({ error: e?.message || 'error' });
  }
});

app.post('/cloud/merge', async (req, res) => {
  try {
    await cloudLoadState();
    res.json({ trades: trades.length, accountBalance: account.balance });
  } catch (e) {
    res.status(500).json({ error: e?.message || 'error' });
  }
});

app.post('/cloud/clear', async (req, res) => {
  try {
    const ok = await clearCloudState(account);
    if (!ok) return res.status(500).json({ error: 'clear_failed' });
    trades = [];
    account = { balance: INITIAL_BALANCE, equity: INITIAL_BALANCE, dayPnL: 0, totalPnL: 0 };
    saveState();
    res.json({ cleared: true, trades: trades.length, balance: account.balance });
  } catch (e) {
    res.status(500).json({ error: e?.message || 'error' });
  }
});

app.get('/health', (req, res) => res.send('OK'));
app.get('/crypto/state', async (req, res) => {
  try {
    const url = `${CRYPTO_UPSTREAM_URL.replace(/\/$/, '')}/state?ts=${Date.now()}`;
    const r = await fetch(url, { headers: { 'Cache-Control': 'no-store' } });
    const data = await r.json();
    res.json(data);
  } catch {
    res.status(502).json({ error: 'bad_gateway' });
  }
});
app.get('/crypto/events', (req, res) => {
  try {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
  } catch { }
  const target = `${CRYPTO_UPSTREAM_URL.replace(/\/$/, '')}/events?ts=${Date.now()}`;
  const isHttps = target.startsWith('https://');
  const client = (isHttps ? https : http).request(target, (up) => {
    up.on('data', (chunk) => { try { res.write(chunk); } catch { } });
    up.on('end', () => { try { res.end(); } catch { } });
  });
  client.on('error', () => { try { res.end(); } catch { } });
  client.end();
  req.on('close', () => { try { client.destroy(); } catch { } });
});
app.post('/crypto/toggle/:symbol', async (req, res) => {
  try {
    const url = `${CRYPTO_UPSTREAM_URL.replace(/\/$/, '')}/toggle/${encodeURIComponent(req.params.symbol)}`;
    const r = await fetch(url, { method: 'POST' });
    res.sendStatus(r.status);
  } catch {
    res.sendStatus(502);
  }
});
app.post('/crypto/strategy/:symbol', async (req, res) => {
  try {
    const url = `${CRYPTO_UPSTREAM_URL.replace(/\/$/, '')}/strategy/${encodeURIComponent(req.params.symbol)}`;
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ strategy: req.body?.strategy }) });
    const data = await r.json().catch(() => null);
    if (data) res.json(data); else res.sendStatus(r.status);
  } catch {
    res.sendStatus(502);
  }
});

app.post('/toggle/:symbol', (req, res) => {
  const { symbol } = req.params;
  if (assets[symbol]) {
    assets[symbol].botActive = !assets[symbol].botActive;
    saveState();
  }
  res.sendStatus(200);
});

app.post('/strategy/:symbol', (req, res) => {
  const { symbol } = req.params;
  const { strategy } = req.body; // Strategy to toggle
  console.log(`[STRATEGY] Toggling ${strategy} on ${symbol}`);
  if (assets[symbol]) {
    const list = assets[symbol].activeStrategies;
    if (list.includes(strategy)) {
      // Remove
      assets[symbol].activeStrategies = list.filter(s => s !== strategy);
    } else {
      // Add
      assets[symbol].activeStrategies.push(strategy);
    }
    saveState();
  }
  res.sendStatus(200);
});

app.post('/reset', (req, res) => {
  try {
    const arch = path.join(DATA_DIR, 'archives');
    fs.mkdirSync(arch, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const dst = path.join(arch, `state-${ts}.json`);
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf8');
      fs.writeFileSync(dst, raw, 'utf8');
    }
  } catch { }
  account = { balance: INITIAL_BALANCE, equity: INITIAL_BALANCE, dayPnL: 0, totalPnL: 0 };
  trades = [];
  pushSubscriptions = [];
  saveState();
  res.sendStatus(200);
});

app.post('/reset_account', (req, res) => {
  account = { balance: INITIAL_BALANCE, equity: INITIAL_BALANCE, dayPnL: 0, totalPnL: 0 };
  saveState();
  res.sendStatus(200);
});

app.post('/import', (req, res) => {
  try {
    const secret = process.env.IMPORT_SECRET || null;
    const header = req.headers['x-import-secret'];
    if (secret && header !== secret) return res.status(403).json({ error: 'forbidden' });
    const body = req.body || {};
    const newAccount = body.account;
    const newTrades = body.trades;
    if (!newAccount || typeof newAccount.balance !== 'number' || !Array.isArray(newTrades)) {
      return res.status(400).json({ error: 'invalid' });
    }
    account = { ...account, ...newAccount };
    trades = newTrades;
    saveState();
    res.sendStatus(200);
  } catch (e) {
    res.status(500).json({ error: e?.message || 'error' });
  }
});

app.post('/import/csv', (req, res) => {
  try {
    const secret = process.env.IMPORT_SECRET || null;
    const header = req.headers['x-import-secret'];
    if (secret && header !== secret) return res.status(403).json({ error: 'forbidden' });
    const body = req.body || {};
    const fileArg = body.path || body.file || body.filename || 'public/trades (3).csv';
    const fullPath = path.resolve(process.cwd(), fileArg);
    const publicDir = path.join(process.cwd(), 'public');
    if (!fullPath.startsWith(publicDir)) return res.status(400).json({ error: 'invalid_path' });
    if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'not_found' });
    const raw = fs.readFileSync(fullPath, 'utf8');
    const splitCSV = (line) => {
      const out = []; let cur = ''; let q = false; for (let i = 0; i < line.length; i++) { const ch = line[i]; if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else { q = !q; } } else if (ch === ',' && !q) { out.push(cur); cur = ''; } else { cur += ch; } } out.push(cur); return out;
    };
    const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) return res.status(400).json({ error: 'empty_csv' });
    const headerRow = splitCSV(lines[0]).map(s => s.trim());
    const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const mapKey = (s) => {
      const k = norm(s);
      if (k === 'id') return 'id';
      if (k === 'symbol' || k === 'asset' || k === 'instrument') return 'symbol';
      if (k === 'type' || k === 'side') return 'type';
      if (k === 'entryprice' || k === 'entry' || k === 'openprice' || k === 'priceopen') return 'entryPrice';
      if (k === 'initialsize' || k === 'size' || k === 'quantity' || k === 'lot') return 'initialSize';
      if (k === 'currentsize') return 'currentSize';
      if (k === 'stoploss' || k === 'sl') return 'stopLoss';
      if (k === 'opentime' || k === 'opened' || k === 'openat' || k === 'dateopened') return 'openTime';
      if (k === 'closetime' || k === 'closed' || k === 'closeat' || k === 'dateclosed') return 'closeTime';
      if (k === 'closeprice' || k === 'exitprice' || k === 'priceclose') return 'closePrice';
      if (k === 'pnl' || k === 'profit' || k === 'pl') return 'pnl';
      if (k === 'status') return 'status';
      if (k === 'strategy') return 'strategy';
      return s;
    };
    const idx = headerRow.map(mapKey);
    const toNum = (v) => { const n = typeof v === 'string' ? parseFloat(v.replace(/[^0-9.\-]/g, '')) : v; return isFinite(n) ? n : 0; };
    const toTime = (v) => {
      if (v == null || v === '') return undefined;
      if (typeof v === 'number') return v;
      const s = v.toString().trim();
      const asNum = Number(s);
      if (Number.isFinite(asNum) && asNum > 0) return asNum;
      const t = Date.parse(s);
      return Number.isFinite(t) ? t : undefined;
    };
    const symMap = (s) => { const u = (s || '').toString().toUpperCase().replace(/\s+/g, ''); if (u === 'XAUUSD' || u === 'XAU_USD' || u === 'GOLD') return 'XAU/USD'; if (u === 'NAS100' || u === 'NAS100_USD') return 'NAS100'; return s; };
    const typeMap = (s) => { const u = (s || '').toString().toUpperCase(); if (u === 'LONG' || u === 'BUY') return 'BUY'; if (u === 'SHORT' || u === 'SELL') return 'SELL'; return 'BUY'; };
    const stratMap = (s) => { const u = (s || '').toString().toUpperCase(); if (u.includes('TREND')) return 'TREND_FOLLOW'; if (u.includes('ORB')) return 'NY_ORB'; if (u.includes('LONDON')) return 'LONDON_SWEEP'; if (u.includes('GEMINI') || u.includes('AI')) return 'AI_AGENT'; return 'MANUAL'; };
    const parsed = [];
    for (let r = 1; r < lines.length; r++) {
      const row = splitCSV(lines[r]);
      const obj = {};
      for (let c = 0; c < idx.length; c++) obj[idx[c]] = row[c];
      const symbol = symMap(obj['symbol']);
      const type = typeMap(obj['type']);
      const entryPrice = toNum(obj['entryPrice']);
      const initialSize = toNum(obj['initialSize']);
      const currentSize = obj['currentSize'] != null ? toNum(obj['currentSize']) : initialSize;
      const stopLoss = obj['stopLoss'] != null ? toNum(obj['stopLoss']) : entryPrice;
      const openTime = toTime(obj['openTime']) || Date.now();
      const closeTime = toTime(obj['closeTime']);
      const closePrice = obj['closePrice'] != null ? toNum(obj['closePrice']) : undefined;
      const strategy = stratMap(obj['strategy']);
      const status = (obj['status'] || '').toString().toUpperCase() === 'OPEN' ? 'OPEN' : 'CLOSED';
      const idVal = obj['id'] || '';
      const idFinal = idVal && idVal.toString().length > 0 ? idVal : uuidv4();
      let pnl = obj['pnl'] != null ? toNum(obj['pnl']) : 0;
      if (pnl === 0 && closePrice != null) {
        const isBuy = type === 'BUY';
        pnl = (isBuy ? closePrice - entryPrice : entryPrice - closePrice) * (status === 'OPEN' ? currentSize : initialSize);
      }
      parsed.push({ id: idFinal, symbol, type, entryPrice, initialSize, currentSize, stopLoss, openTime, closeTime, closePrice, pnl, status, strategy });
    }
    const keyForTrade = (t) => { if (!t) return ''; if (t.id) return t.id; const parts = [t.symbol, t.entryPrice, t.openTime, t.initialSize]; return parts.filter(Boolean).join('|'); };
    const map = new Map();
    for (const t of trades) map.set(keyForTrade(t), t);
    for (const t of parsed) {
      const k = keyForTrade(t);
      const ex = map.get(k);
      if (!ex) { map.set(k, t); continue; }
      const preferNew = (
        (ex.status !== 'CLOSED' && t.status === 'CLOSED') ||
        (typeof ex.closeTime !== 'number' && typeof t.closeTime === 'number') ||
        (typeof t.closeTime === 'number' && typeof ex.closeTime === 'number' && t.closeTime > ex.closeTime)
      );
      if (preferNew) map.set(k, t);
    }
    trades = Array.from(map.values());
    saveState();
    res.json({ imported: parsed.length, total: trades.length });
  } catch (e) {
    res.status(500).json({ error: e?.message || 'error' });
  }
});

app.post('/push/subscribe', (req, res) => {
  try {
    const sub = req.body;
    if (!sub || !sub.endpoint) return res.status(400).send('Invalid');
    const exists = pushSubscriptions.find(s => s.endpoint === sub.endpoint);
    if (!exists) {
      pushSubscriptions.push(sub);
      saveState();
    }
    res.sendStatus(201);
  } catch {
    res.sendStatus(500);
  }
});

app.get('/push/config', (req, res) => {
  try {
    const pub = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY || '';
    res.json({ publicKey: pub });
  } catch {
    res.json({ publicKey: '' });
  }
});

app.post('/push/test', (req, res) => {
  notifyAll('Push Test', 'Notifications are configured');
  res.sendStatus(200);
});

app.post('/admin/close', (req, res) => {
  try {
    const sp = (req.body?.symbol || req.query?.symbol || 'XAU/USD').toString();
    let closedPnL = 0; let closed = 0;
    const targets = sp === 'ALL' ? Array.from(new Set(trades.filter(t => t.status === 'OPEN').map(t => t.symbol))) : [sp];
    for (const symbol of targets) {
      const mkt = market[symbol] || {};
      const bid = mkt.bid; const ask = mkt.ask;
      const openList = trades.filter(t => t.status === 'OPEN' && t.symbol === symbol);
      for (const t of openList) {
        const isBuy = t.type === 'BUY';
        const exit = isBuy ? (bid != null ? bid : t.entryPrice) : (ask != null ? ask : t.entryPrice);
        t.status = 'CLOSED';
        t.closeReason = 'MANUAL';
        t.closeTime = Date.now();
        t.closePrice = exit;
        const pnl = (isBuy ? exit - t.entryPrice : t.entryPrice - exit) * t.currentSize;
        t.pnl += pnl; account.balance += pnl; closedPnL += pnl; closed++;
        try { notifyAll('Trade Closed', `${symbol} ${t.type} @ ${Number(exit).toFixed(2)} (ADMIN_CLOSE) PnL ${pnl.toFixed(2)}`); } catch { }
        try { sendSms(`CLOSE ${symbol} ${t.type} @ ${Number(exit).toFixed(2)} (ADMIN_CLOSE) PnL ${pnl.toFixed(2)}`); } catch { }
      }
    }
    if (closedPnL !== 0) { account.dayPnL += closedPnL; account.totalPnL += closedPnL; account.equity = account.balance; }
    saveState();
    res.json({ closed, closedPnL });
  } catch (e) {
    res.status(500).json({ error: e?.message || 'error' });
  }
});

// Start Server
app.listen(PORT, '0.0.0.0', () => console.log(`Scheduler running on port ${PORT}`));

// Keep-Alive Ping for Free Tier (Optional)
setInterval(() => {
  try {
    http.get(`http://localhost:${PORT}/health`);
  } catch (e) { }
}, 14 * 60 * 1000); // Every 14 mins

setInterval(() => {
  try {
    const now = new Date();
    const isFriday = now.getUTCDay() === 5;
    const isTime = now.getUTCHours() === 21 && now.getUTCMinutes() === 55;
    if (isFriday && isTime) {
      console.log('[SYSTEM] Weekend Close - Closing all positions');
      let closedPnL = 0;
      for (const symbol of ['NAS100']) {
        const mkt = market[symbol];
        if (!mkt) continue;
        const { bid, ask, mid } = mkt;
        const openList = trades.filter(t => t.status === 'OPEN' && t.symbol === symbol);
        for (const t of openList) {
          const isBuy = t.type === 'BUY';
          const exit = isBuy ? bid : ask;
          t.status = 'CLOSED';
          t.closeReason = 'MANUAL';
          t.closeTime = Date.now();
          t.closePrice = exit;
          const pnl = (isBuy ? exit - t.entryPrice : t.entryPrice - exit) * t.currentSize;
          t.pnl += pnl;
          account.balance += pnl;
          closedPnL += pnl;
          notifyAll('Trade Closed', `${symbol} ${t.type} @ ${exit.toFixed(2)} (WEEKEND_CLOSE) PnL ${pnl.toFixed(2)}`);
        }
      }
      if (closedPnL !== 0) {
        account.dayPnL += closedPnL;
        account.totalPnL += closedPnL;
        account.equity = account.balance;
      }
      saveState();
    }
  } catch { }
}, 60 * 1000);

function sseBroadcast() {
  try {
    const payload = JSON.stringify({ account, trades, assets });
    for (const client of sseClients) {
      try { client.write(`data: ${payload}\n\n`); } catch { }
    }
  } catch { }
}

setInterval(() => { try { sseBroadcast(); } catch { } }, 3000);
let webpushClient = null;
(async () => {
  try {
    const mod = await import('web-push');
    webpushClient = mod.default || mod;
    const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY;
    const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || process.env.VITE_VAPID_PRIVATE_KEY;
    if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
      webpushClient.setVapidDetails('mailto:admin@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
      console.log('[SYSTEM] Web Push initialized');
    } else {
      console.warn('[SYSTEM] VAPID keys not set; push notifications disabled');
    }
  } catch (e) {
    console.warn('[SYSTEM] web-push module not available; push notifications disabled');
  }
})();
// --- FIREBASE CLOUD PERSISTENCE ---
initFirebase();
((async () => {
  if (process.env.AUTOCLEAR_ON_BOOT === 'true') {
    try {
      await clearCloudState(account);
      trades = [];
      account = { balance: INITIAL_BALANCE, equity: INITIAL_BALANCE, dayPnL: 0, totalPnL: 0 };
      saveState();
    } catch { }
  }
})());

async function cloudLoadState() {
  try {
    const data = await loadStateFromCloud();
    if (data) {
      const cloudTrades = Array.isArray(data.trades) ? data.trades : [];

      const keyForTrade = (t) => {
        if (!t) return '';
        if (t.id) return t.id;
        const parts = [t.symbol, t.entryPrice, t.openTime || t.open_time || t.openTimestamp, t.initialSize];
        return parts.filter(Boolean).join('|');
      };

      const mergedByKey = new Map();
      for (const t of trades) mergedByKey.set(keyForTrade(t), t);
      for (const t of cloudTrades) {
        const k = keyForTrade(t);
        if (!k) continue;
        const existing = mergedByKey.get(k);
        if (!existing) {
          mergedByKey.set(k, t);
        } else {
          try {
            const preferCloud = (existing.status !== 'CLOSED' && t.status === 'CLOSED') ||
              (typeof t.closeTime === 'number' && typeof existing.closeTime === 'number' && t.closeTime > existing.closeTime);
            if (preferCloud) mergedByKey.set(k, t);
          } catch { }
        }
      }
      trades = Array.from(mergedByKey.values());

      const cloudSubs = Array.isArray(data.pushSubscriptions) ? data.pushSubscriptions : [];
      const subsByEndpoint = new Map();
      for (const s of pushSubscriptions) if (s && s.endpoint) subsByEndpoint.set(s.endpoint, s);
      for (const s of cloudSubs) if (s && s.endpoint && !subsByEndpoint.has(s.endpoint)) subsByEndpoint.set(s.endpoint, s);
      pushSubscriptions = Array.from(subsByEndpoint.values());

      try { recalculateAccountState(); } catch { }
      console.log(`[SYSTEM] Cloud state merged: ${trades.length} trades`);
      saveState();
    }
  } catch { }
}

function cloudSaveState() {
  saveStateToCloud({ account, trades, pushSubscriptions });
}

setInterval(() => { try { cloudSaveState(); } catch { } }, 60 * 1000);

async function flushAndExit(code = 0) {
  try {
    saveState();
    await saveStateToCloud({ account, trades, pushSubscriptions });
  } catch { }
  process.exit(code);
}

process.on('SIGINT', () => flushAndExit(0));
process.on('SIGTERM', () => flushAndExit(0));
