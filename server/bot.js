
import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { WebSocket } from 'ws';
import http from 'http';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// --- TYPES & CONFIG ---
const ASSET_CONFIG = {
    'XAU/USD': { startPrice: 2350, volatility: 0.001, decimals: 2, lotSize: 10 },
    'NAS100': { startPrice: 18500, volatility: 0.0015, decimals: 1, lotSize: 1 }
};

const INITIAL_BALANCE = 10000;

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

let assets = {
    'XAU/USD': createAsset('XAU/USD', 'LONDON_SWEEP'), 
    'NAS100': createAsset('NAS100', 'NY_ORB')
};

function createAsset(symbol, defaultStrategy) {
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
        strategy: defaultStrategy,
        isLive: false
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
                // Scale BTC to look like NAS100 for simulation purposes if needed, or use raw
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
                asset.trend = price > asset.ema200 ? 'UP' : 'DOWN';

                updateCandles(symbol, price);
                processTicks(); // Run bot logic on tick
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

function processTicks() {
    let closedPnL = 0;
    const openTrades = trades.filter(t => t.status === 'OPEN');

    // 1. Manage Trades (TP/SL)
    for (const trade of openTrades) {
        const asset = assets[trade.symbol];
        const price = asset.currentPrice;
        const isBuy = trade.type === 'BUY';

        // Check TP
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

        // Check SL
        if (isBuy ? price <= trade.stopLoss : price >= trade.stopLoss) {
            trade.status = 'CLOSED'; trade.closeReason = 'STOP_LOSS'; trade.closeTime = Date.now(); trade.closePrice = price;
            const pnl = (isBuy ? price - trade.entryPrice : trade.entryPrice - price) * trade.currentSize;
            trade.pnl += pnl; account.balance += pnl; closedPnL += pnl;
        }
    }
    account.dayPnL += closedPnL;

    // 2. Run Strategies
    for (const symbol of Object.keys(assets)) {
        const asset = assets[symbol];
        if (!asset.botActive) continue;
        if (openTrades.some(t => t.symbol === symbol)) continue; // Max 1 trade

        // A. TREND FOLLOW
        if (asset.strategy === 'TREND_FOLLOW') {
             const isTrendUp = asset.currentPrice > asset.ema200;
             const pullback = isTrendUp ? asset.currentPrice <= asset.ema : asset.currentPrice >= asset.ema;
             const confirm = isTrendUp ? asset.slope > 0.1 : asset.slope < -0.1;
             if (isTrendUp && pullback && confirm) executeTrade(symbol, 'BUY', asset.currentPrice, 'TREND_FOLLOW', 'AGGRESSIVE');
             else if (!isTrendUp && pullback && confirm) executeTrade(symbol, 'SELL', asset.currentPrice, 'TREND_FOLLOW', 'AGGRESSIVE');
        }
        // B. LONDON SWEEP (GOLD)
        else if (asset.strategy === 'LONDON_SWEEP' && symbol === 'XAU/USD') {
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
        else if (asset.strategy === 'NY_ORB' && symbol === 'NAS100') {
             const volExpansion = asset.bollinger.upper - asset.bollinger.lower > asset.currentPrice * 0.002;
             if (volExpansion && asset.trend === 'UP' && asset.currentPrice > asset.bollinger.upper) {
                 executeTrade(symbol, 'BUY', asset.currentPrice, 'NY_ORB', 'AGGRESSIVE');
             }
        }
    }
}

// --- API ---
app.get('/state', (req, res) => res.json({ account, trades, assets }));

app.get('/health', (req, res) => res.send('OK')); // Cloud Health Check

app.post('/toggle/:symbol', (req, res) => {
    const { symbol } = req.params;
    if (assets[symbol]) assets[symbol].botActive = !assets[symbol].botActive;
    res.sendStatus(200);
});

app.post('/strategy/:symbol', (req, res) => {
    const { symbol } = req.params;
    const { strategy } = req.body;
    if (assets[symbol]) assets[symbol].strategy = strategy;
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
