
import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { WebSocket } from 'ws';
import http from 'http';
import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';

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
    'XAU/USD': { startPrice: 2350, volatility: 0.001, decimals: 2, lotSize: 10 },
    'NAS100': { startPrice: 18500, volatility: 0.0015, decimals: 1, lotSize: 1 }
};

const INITIAL_BALANCE = 500;

// --- STATE ---
let account = {
    balance: INITIAL_BALANCE,
    equity: INITIAL_BALANCE,
    dayPnL: 0
};

let trades = [];

// CANDLE STORAGE (Symbol -> M5 Candles [])
let candlesM5 = {
    'XAU/USD': [], 'NAS100': []
};

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
function connectWebSocket() {
    console.log('[SYSTEM] Connecting to Live Data Stream...');
    ws = new WebSocket('wss://stream.binance.com:9443/ws/paxgusdt@kline_1m/btcusdt@kline_1m');

    ws.on('open', () => {
        console.log('[SYSTEM] Connected to Binance stream.');
    });

    ws.on('message', (data) => {
        try {
            const event = JSON.parse(data);
            const isGold = event.s === 'PAXGUSDT';
            const isNas = event.s === 'BTCUSDT';
            const symbol = isGold ? 'XAU/USD' : isNas ? 'NAS100' : null;
            
            if (symbol && event.k) {
                // Scale BTC to look like NAS100 for simulation purposes
                const price = isNas ? parseFloat(event.k.c) / 5 : parseFloat(event.k.c);
                
                // Update Asset
                const asset = assets[symbol];
                asset.currentPrice = price;
                asset.isLive = true;
                asset.history.push({ time: new Date().toLocaleTimeString(), value: price });
                if (asset.history.length > 300) asset.history.shift();

                // Recalc Indicators
                asset.ema = calculateEMA(price, asset.ema, 20);
                asset.ema200 = calculateEMA(price, asset.ema200, 200);
                asset.slope = calculateSlope(asset.history.map(h => h.value), 10);
                asset.rsi = calculateRSI(asset.history.map(h => h.value));
                asset.trend = price > asset.ema200 ? 'UP' : 'DOWN';

                // Calculate Bollinger Bands (Simplified for speed)
                // In prod, use full history calc
                const sma = asset.ema; // Approx
                const stdDev = asset.currentPrice * 0.002; // Approx
                asset.bollinger = { upper: sma + stdDev*2, middle: sma, lower: sma - stdDev*2 };

                updateCandles(symbol, price);
                processTicks(symbol); // Run bot logic on tick
            }
        } catch (e) {
            console.error("Data Parse Error", e);
        }
    });

    ws.on('close', () => {
        console.log('[SYSTEM] WebSocket Disconnected. Reconnecting in 5s...');
        setTimeout(connectWebSocket, 5000);
    });

    ws.on('error', (err) => {
        console.error('[SYSTEM] WebSocket Error:', err.message);
        ws.close();
    });
}

// Initialize Connection
connectWebSocket();


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
     const lotSize = ASSET_CONFIG[symbol].lotSize;
     const isBuy = type === 'BUY';
     const slPct = 0.005; 
     const tpPct = 0.01; 

     const sl = isBuy ? price * (1 - slPct) : price * (1 + slPct);
     const tp1 = isBuy ? price * (1 + tpPct*0.6) : price * (1 - tpPct*0.6);
     const tp2 = isBuy ? price * (1 + tpPct) : price * (1 - tpPct);
     const tp3 = isBuy ? price * (1 + tpPct*3) : price * (1 - tpPct*3);

     const trade = {
         id: uuidv4(), symbol, type, entryPrice: price, initialSize: lotSize, currentSize: lotSize,
         stopLoss: sl, tpLevels: [
             { id: 1, price: tp1, percentage: 0.4, hit: false },
             { id: 2, price: tp2, percentage: 0.4, hit: false },
             { id: 3, price: tp3, percentage: 0.2, hit: false }
         ],
         openTime: Date.now(), status: 'OPEN', strategy, pnl: 0, entryReason: `${strategy} Signal`
     };
     trades.unshift(trade);
     console.log(`[BOT] Executed ${type} on ${symbol} @ ${price} via ${strategy}`);
}

function processTicks(symbol) {
    let closedPnL = 0;
    const openTrades = trades.filter(t => t.status === 'OPEN' && t.symbol === symbol);
    const asset = assets[symbol];
    const price = asset.currentPrice;

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
                continue; // Next trade
            }
            // If Short and Sentiment is Bullish -> Close
            if (!isBuy && sentiment === 'BULLISH') {
                trade.status = 'CLOSED'; trade.closeReason = 'AI_GUARDIAN'; trade.closeTime = Date.now(); trade.closePrice = price;
                console.log(`[AI GUARDIAN] Panic Closed ${symbol} Trade due to Strong Bullish Sentiment`);
                const pnl = (trade.entryPrice - price) * trade.currentSize;
                trade.pnl += pnl; account.balance += pnl; closedPnL += pnl;
                continue;
            }
        }

        // B. TRAILING STOP
        // If profit > 0.2%, move SL to Breakeven + Trail
        const currentProfitPct = isBuy ? (price - trade.entryPrice)/trade.entryPrice : (trade.entryPrice - price)/trade.entryPrice;
        if (currentProfitPct > 0.002) {
             if (isBuy) {
                 const newSL = price * 0.999; // Trail 0.1% behind
                 if (newSL > trade.stopLoss) trade.stopLoss = newSL;
             } else {
                 const newSL = price * 1.001;
                 if (newSL < trade.stopLoss) trade.stopLoss = newSL;
             }
        }

        // C. STANDARD TP CHECKS
        for (const level of trade.tpLevels) {
            if (!level.hit) {
                const hit = isBuy ? price >= level.price : price <= level.price;
                if (hit) {
                    const closeAmt = trade.initialSize * level.percentage;
                    const pnl = (isBuy ? level.price - trade.entryPrice : trade.entryPrice - level.price) * closeAmt;
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
        if (isBuy ? price <= trade.stopLoss : price >= trade.stopLoss) {
            trade.status = 'CLOSED'; trade.closeReason = 'STOP_LOSS'; trade.closeTime = Date.now(); trade.closePrice = price;
            const pnl = (isBuy ? price - trade.entryPrice : trade.entryPrice - price) * trade.currentSize;
            trade.pnl += pnl; account.balance += pnl; closedPnL += pnl;
        }
    }
    account.dayPnL += closedPnL;
    account.equity = account.balance;

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
app.get('/state', (req, res) => res.json({ account, trades, assets }));

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
