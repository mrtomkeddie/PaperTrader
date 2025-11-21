
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
import admin from 'firebase-admin';

// Load .env file from root
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Cloud Request Logger
app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.path}`);
    next();
});

const PORT = process.env.PORT || 3001;
const API_KEY = process.env.API_KEY;
const OANDA_TOKEN = process.env.OANDA_API_KEY;
const OANDA_ACCOUNT_ID = process.env.OANDA_ACCOUNT_ID;
const OANDA_ENV = process.env.OANDA_ENV || 'practice';
const USE_OANDA = !!(OANDA_TOKEN && OANDA_ACCOUNT_ID);

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
            res.on('data', () => {});
        });
        req.on('error', () => {});
        req.write(postData);
        req.end();
    } catch {}
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
    'XAU/USD': { startPrice: 2350, volatility: 0.001, decimals: 2, lotSize: 10, valuePerPoint: 1, minLot: 0.01, maxLot: 100, lotStep: 0.01 },
    'NAS100': { startPrice: 18500, volatility: 0.0015, decimals: 1, lotSize: 1, valuePerPoint: 1, minLot: 0.01, maxLot: 100, lotStep: 0.01 }
};

const INITIAL_BALANCE = 500;
const RISK_PER_TRADE = 0.01;

// --- STATE ---
let account = {
    balance: INITIAL_BALANCE,
    equity: INITIAL_BALANCE,
    dayPnL: 0
};

let trades = [];

let pushSubscriptions = [];

// --- PERSISTENCE ---
const DATA_DIR = path.join(process.cwd(), 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');

function loadState() {
    try {
        if (fs.existsSync(STATE_FILE)) {
            const raw = fs.readFileSync(STATE_FILE, 'utf8');
            const parsed = JSON.parse(raw);
            if (parsed && parsed.account && Array.isArray(parsed.trades)) {
                account = parsed.account;
                trades = parsed.trades;
                pushSubscriptions = Array.isArray(parsed.pushSubscriptions) ? parsed.pushSubscriptions : [];
                console.log(`[SYSTEM] Loaded persisted state: ${trades.length} trades, balance £${account.balance.toFixed(2)}`);
            }
        }
    } catch (e) {
        console.warn('[SYSTEM] Failed to load state:', e.message);
    }
}

function saveState() {
    try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        const payload = JSON.stringify({ account, trades, pushSubscriptions }, null, 2);
        fs.writeFileSync(STATE_FILE, payload, 'utf8');
    } catch (e) {
        console.warn('[SYSTEM] Failed to save state:', e.message);
    }
    cloudSaveState();
}

// CANDLE STORAGE (Symbol -> M5 Candles [])
let candlesM5 = {
    'XAU/USD': [], 'NAS100': []
};

// MARKET STATE (bid/ask/mid per symbol)
const SPREAD_PCT = { 'XAU/USD': 0.0002, 'NAS100': 0.0005 };
let market = {
    'XAU/USD': { bid: ASSET_CONFIG['XAU/USD'].startPrice * (1 - SPREAD_PCT['XAU/USD']/2), ask: ASSET_CONFIG['XAU/USD'].startPrice * (1 + SPREAD_PCT['XAU/USD']/2), mid: ASSET_CONFIG['XAU/USD'].startPrice },
    'NAS100': { bid: ASSET_CONFIG['NAS100'].startPrice * (1 - SPREAD_PCT['NAS100']/2), ask: ASSET_CONFIG['NAS100'].startPrice * (1 + SPREAD_PCT['NAS100']/2), mid: ASSET_CONFIG['NAS100'].startPrice }
};

function updateMarketFromMid(symbol, mid) {
    const sp = SPREAD_PCT[symbol] || 0.0002;
    const bid = mid * (1 - sp/2);
    const ask = mid * (1 + sp/2);
    market[symbol] = { bid, ask, mid };
}

// AI CACHE (To prevent spamming API)
let aiState = {
    'XAU/USD': { lastCheck: 0, sentiment: 'NEUTRAL', confidence: 0, reason: '' },
    'NAS100': { lastCheck: 0, sentiment: 'NEUTRAL', confidence: 0, reason: '' }
};

// INITIALIZE ASSETS WITH BOTH STRATEGIES ACTIVE BY DEFAULT
let assets = {
    'XAU/USD': createAsset('XAU/USD', ['LONDON_SWEEP', 'TREND_FOLLOW']), 
    'NAS100': createAsset('NAS100', ['NY_ORB', 'TREND_FOLLOW'])
};

function createAsset(symbol, defaultStrategies) {
    return {
        symbol,
        currentPrice: ASSET_CONFIG[symbol].startPrice,
        history: [],
        rsi: 50,
        ema: ASSET_CONFIG[symbol].startPrice,
        ema200: ASSET_CONFIG[symbol].startPrice,
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
            You are a senior algorithmic trader. Analyze this market data for ${symbol}:
            - Price: ${asset.currentPrice}
            - Trend (200 EMA): ${asset.trend}
            - RSI (14): ${asset.rsi.toFixed(2)}
            - Slope: ${asset.slope.toFixed(4)}
            - Volatility Band Width: ${(asset.bollinger.upper - asset.bollinger.lower).toFixed(2)}

            Determine the immediate market sentiment.
            Respond ONLY with a JSON object in this format:
            { "sentiment": "BULLISH" | "BEARISH" | "NEUTRAL", "confidence": number (0-100), "reason": "short explanation" }
        `;

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
    ws.on('open', () => {});
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
                asset.slope = calculateSlope(asset.history.map(h => h.value), 10);
                asset.rsi = calculateRSI(asset.history.map(h => h.value));
                asset.trend = price > asset.ema200 ? 'UP' : 'DOWN';
                const sma = asset.ema;
                const stdDev = asset.currentPrice * 0.002;
                asset.bollinger = { upper: sma + stdDev*2, middle: sma, lower: sma - stdDev*2 };
                updateCandles(symbol, asset.currentPrice);
                processTicks(symbol);
            }
        } catch {}
    });
    ws.on('close', () => { setTimeout(connectLiveFeed, 5000); });
    ws.on('error', () => { try { ws.close(); } catch {} });
}

function connectOanda() {
    const host = OANDA_ENV === 'live' ? 'stream-fxtrade.oanda.com' : 'stream-fxpractice.oanda.com';
    const instruments = ['XAU_USD','NAS100_USD'].join(',');
    const options = {
        hostname: host,
        path: `/v3/accounts/${OANDA_ACCOUNT_ID}/pricing/stream?instruments=${encodeURIComponent(instruments)}`,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${OANDA_TOKEN}` }
    };
    const req = https.request(options, (res) => {
        let buffer = '';
        res.on('data', (chunk) => {
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
                        const symbol = inst === 'XAU_USD' ? 'XAU/USD' : inst === 'NAS100_USD' ? 'NAS100' : null;
                        if (!symbol || !mid) continue;
                        market[symbol] = { bid, ask, mid };
                        const asset = assets[symbol];
                        asset.currentPrice = market[symbol].mid;
                        asset.isLive = true;
                        asset.history.push({ time: new Date().toLocaleTimeString(), value: market[symbol].mid });
                        if (asset.history.length > 300) asset.history.shift();
                        asset.ema = calculateEMA(asset.currentPrice, asset.ema, 20);
                        asset.ema200 = calculateEMA(asset.currentPrice, asset.ema200, 200);
                        asset.slope = calculateSlope(asset.history.map(h => h.value), 10);
                        asset.rsi = calculateRSI(asset.history.map(h => h.value));
                        asset.trend = asset.currentPrice > asset.ema200 ? 'UP' : 'DOWN';
                        const sma = asset.ema;
                        const stdDev = asset.currentPrice * 0.002;
                        asset.bollinger = { upper: sma + stdDev*2, middle: sma, lower: sma - stdDev*2 };
                        updateCandles(symbol, asset.currentPrice);
                        processTicks(symbol);
                    }
                } catch {}
            }
        });
        res.on('end', () => { setTimeout(connectLiveFeed, 5000); });
    });
    req.on('error', () => { setTimeout(connectLiveFeed, 5000); });
    req.end();
}

function connectLiveFeed() {
    if (USE_OANDA) connectOanda(); else connectBinance();
}

connectLiveFeed();

function notifyAll(title, body) {
    if (!webpushClient || !process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;
    const payload = JSON.stringify({ title, body });
    for (const sub of pushSubscriptions) {
        try { webpushClient.sendNotification(sub, payload).catch(() => {}); } catch {}
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
                sendSms(`CLOSE ${symbol} ${trade.type} @ ${price.toFixed(2)} (AI_GUARDIAN) PnL ${pnl.toFixed(2)}`);
                notifyAll('Trade Closed', `${symbol} ${trade.type} @ ${price.toFixed(2)} (AI_GUARDIAN) PnL ${pnl.toFixed(2)}`);
                continue;
            }
        }

        // B. TRAILING STOP
        // If profit > 0.2%, move SL to Breakeven + Trail
        const currentProfitPct = isBuy ? (bid - trade.entryPrice)/trade.entryPrice : (trade.entryPrice - ask)/trade.entryPrice;
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
    account.equity = account.balance;
    if (closedPnL !== 0) saveState();

    // 2. Run Strategies (Only if no open trade)
    if (!asset.botActive) return;
    if (openTrades.length > 0) return; // Max 1 trade per asset

    // A. TREND FOLLOW (24/7)
    if (asset.activeStrategies.includes('TREND_FOLLOW')) {
            const isTrendUp = asset.currentPrice > asset.ema200;
            const pullback = isTrendUp ? asset.currentPrice <= asset.ema : asset.currentPrice >= asset.ema;
            const confirm = isTrendUp ? asset.slope > 0.1 : asset.slope < -0.1;
            if (isTrendUp && pullback && confirm) executeTrade(symbol, 'BUY', asset.currentPrice, 'TREND_FOLLOW', 'AGGRESSIVE');
            else if (!isTrendUp && pullback && confirm) executeTrade(symbol, 'SELL', asset.currentPrice, 'TREND_FOLLOW', 'AGGRESSIVE');
    }
    
    // B. LONDON SWEEP (GOLD)
    if (asset.activeStrategies.includes('LONDON_SWEEP') && symbol === 'XAU/USD') {
            const candles = candlesM5[symbol];
            if (candles.length > 10) {
                const lowest = Math.min(...candles.slice(-10, -1).map(c => c.low));
                const current = candles[candles.length - 1];
                if (current.low < lowest && asset.currentPrice > lowest + 0.5) {
                    executeTrade(symbol, 'BUY', asset.currentPrice, 'LONDON_SWEEP', 'CONSERVATIVE');
                }
            }
    }
    
    // C. NY ORB (NAS100)
    if (asset.activeStrategies.includes('NY_ORB') && symbol === 'NAS100') {
            const volExpansion = asset.bollinger.upper - asset.bollinger.lower > asset.currentPrice * 0.002;
            if (volExpansion && asset.trend === 'UP' && asset.currentPrice > asset.bollinger.upper) {
                executeTrade(symbol, 'BUY', asset.currentPrice, 'NY_ORB', 'AGGRESSIVE');
            }
    }

    // D. AI AGENT (Real Gemini)
    if (asset.activeStrategies.includes('AI_AGENT') && aiState[symbol].confidence > 75) {
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
    for (const t of trades) {
      if (t.status === 'OPEN' && market[t.symbol]) {
        const { bid, ask } = market[t.symbol];
        const isBuy = t.type === 'BUY';
        const exit = isBuy ? bid : ask;
        t.floatingPnl = (isBuy ? exit - t.entryPrice : t.entryPrice - exit) * t.currentSize;
      }
    }
  } catch {}
  res.json({ account, trades, assets });
});

app.get('/export/json', (req, res) => {
  const status = (req.query.status || 'closed').toString().toUpperCase();
  const data = status === 'ALL' ? trades : trades.filter(t => t.status === 'CLOSED');
  res.json(data);
});

app.get('/export/csv', (req, res) => {
  const status = (req.query.status || 'closed').toString().toUpperCase();
  const list = status === 'ALL' ? trades : trades.filter(t => t.status === 'CLOSED');
  const headers = ['id','symbol','type','entryPrice','initialSize','currentSize','stopLoss','openTime','closeTime','closePrice','pnl','status','strategy'];
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
  res.setHeader('Content-Disposition', 'attachment; filename="trades.csv"');
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

app.get('/health', (req, res) => res.send('OK')); // Cloud Health Check

app.post('/toggle/:symbol', (req, res) => {
    const { symbol } = req.params;
    if (assets[symbol]) assets[symbol].botActive = !assets[symbol].botActive;
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
    }
    res.sendStatus(200);
});

app.post('/reset', (req, res) => {
    account = { balance: INITIAL_BALANCE, equity: INITIAL_BALANCE, dayPnL: 0 };
    trades = [];
    pushSubscriptions = [];
    saveState();
    res.sendStatus(200);
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

app.post('/push/test', (req, res) => {
    notifyAll('Push Test', 'Notifications are configured');
    res.sendStatus(200);
});

// Start Server
app.listen(PORT, '0.0.0.0', () => console.log(`Scheduler running on port ${PORT}`));

// Keep-Alive Ping for Free Tier (Optional)
setInterval(() => {
    try {
        http.get(`http://localhost:${PORT}/health`);
    } catch (e) {}
}, 14 * 60 * 1000); // Every 14 mins
let webpushClient = null;
(async () => {
    try {
        const mod = await import('web-push');
        webpushClient = mod.default || mod;
        const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
        const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
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
const FIREBASE_SA = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
let db = null;
try {
  if (FIREBASE_SA) {
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(FIREBASE_SA)) });
    db = admin.firestore();
    console.log('[SYSTEM] Firestore initialized');
  }
} catch {}

async function cloudLoadState() {
  try {
    if (!db) return;
    const snap = await db.doc('pt2/state').get();
    if (snap.exists) {
      const data = snap.data() || {};
      const cloudTrades = Array.isArray(data.trades) ? data.trades : [];
      const mergedById = new Map();
      for (const t of trades) mergedById.set(t.id, t);
      for (const t of cloudTrades) if (t && t.id && !mergedById.has(t.id)) mergedById.set(t.id, t);
      trades = Array.from(mergedById.values());

      const cloudSubs = Array.isArray(data.pushSubscriptions) ? data.pushSubscriptions : [];
      const subsByEndpoint = new Map();
      for (const s of pushSubscriptions) if (s && s.endpoint) subsByEndpoint.set(s.endpoint, s);
      for (const s of cloudSubs) if (s && s.endpoint && !subsByEndpoint.has(s.endpoint)) subsByEndpoint.set(s.endpoint, s);
      pushSubscriptions = Array.from(subsByEndpoint.values());

      console.log(`[SYSTEM] Cloud state merged: ${trades.length} trades`);
      saveState();
    }
  } catch {}
}

function cloudSaveState() {
  try {
    if (!db) return;
    db.doc('pt2/state').set({ account, trades, pushSubscriptions, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true }).catch(() => {});
  } catch {}
}

setInterval(() => { try { cloudSaveState(); } catch {} }, 5 * 60 * 1000);
