
import { useState, useEffect, useRef, useCallback } from 'react';
import { AssetSymbol, StrategyType, Trade, TradeType, AssetData, AccountState, BrokerMode, OandaConfig } from '../types';
import { INITIAL_BALANCE, TICK_RATE_MS, HISTORY_LENGTH, ASSET_CONFIG, STRATEGY_CONFIG, AI_THROTTLE_MS, OANDA_CONFIG } from '../constants';
import { calculateRSI, calculateEMA, generateRandomWalk, calculateStandardDeviation, calculateBollingerBands, calculateMACD, calculateLinearRegressionSlope } from '../utils/indicators';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenAI, Type } from "@google/genai";
import { OandaService } from '../services/oanda';

// Helper to safely get AI Client without crashing on "process is not defined"
const getAiClient = () => {
  const apiKey = (typeof process !== 'undefined' && process.env) ? process.env.API_KEY : '';
  return new GoogleGenAI({ apiKey });
};

export const useTradingEngine = () => {
  // --- Settings State with Persistence ---
  const [brokerMode, setBrokerMode] = useState<BrokerMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('brokerMode');
      return saved ? (saved as BrokerMode) : BrokerMode.SIMULATION_CRYPTO;
    }
    return BrokerMode.SIMULATION_CRYPTO;
  });

  const [oandaConfig, setOandaConfig] = useState<OandaConfig>(() => {
     if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('oandaConfig');
        return saved ? JSON.parse(saved) : { apiKey: '', accountId: '', environment: 'practice' };
     }
     return { apiKey: '', accountId: '', environment: 'practice' };
  });

  const oandaServiceRef = useRef<OandaService | null>(null);

  // --- Account State ---
  const [account, setAccount] = useState<AccountState>({
    balance: INITIAL_BALANCE,
    equity: INITIAL_BALANCE,
    dayPnL: 0,
  });

  const initialAssets: Record<AssetSymbol, AssetData> = {
    [AssetSymbol.BTCUSD]: createInitialAsset(AssetSymbol.BTCUSD),
    [AssetSymbol.ETHUSD]: createInitialAsset(AssetSymbol.ETHUSD),
    [AssetSymbol.XAUUSD]: createInitialAsset(AssetSymbol.XAUUSD),
    [AssetSymbol.NAS100]: createInitialAsset(AssetSymbol.NAS100)
  };

  const [assets, setAssets] = useState<Record<AssetSymbol, AssetData>>(initialAssets);
  const [trades, setTrades] = useState<Trade[]>([]);

  // Refs
  const assetsRef = useRef(assets);
  const tradesRef = useRef(trades);
  const accountRef = useRef(account);
  const lastAiCallRef = useRef<Record<string, number>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const brokerModeRef = useRef(brokerMode);

  useEffect(() => { assetsRef.current = assets; }, [assets]);
  useEffect(() => { tradesRef.current = trades; }, [trades]);
  useEffect(() => { accountRef.current = account; }, [account]);
  useEffect(() => { brokerModeRef.current = brokerMode; }, [brokerMode]);

  // Initialize Oanda Service when config changes
  useEffect(() => {
    if (oandaConfig.apiKey && oandaConfig.accountId) {
      oandaServiceRef.current = new OandaService(oandaConfig);
    }
  }, [oandaConfig]);

  // --- WebSocket Setup (Binance) ---
  useEffect(() => {
    // Only connect to Binance if in Crypto Simulation mode
    if (brokerMode !== BrokerMode.SIMULATION_CRYPTO) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    const setupWebSocket = () => {
        const ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@trade/ethusdt@trade');
        
        ws.onopen = () => {
            console.log('Connected to Binance Live Feed');
            setAssets(prev => {
                const next = {...prev};
                next[AssetSymbol.BTCUSD].isLive = true;
                next[AssetSymbol.ETHUSD].isLive = true;
                return next;
            });
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            const symbol = data.s === 'BTCUSDT' ? AssetSymbol.BTCUSD : AssetSymbol.ETHUSD;
            const price = parseFloat(data.p);

            const currentAsset = assetsRef.current[symbol];
            if (currentAsset) {
                currentAsset.currentPrice = price;
            }
        };

        ws.onclose = () => {
            setAssets(prev => {
                const next = {...prev};
                Object.keys(next).forEach(k => next[k as AssetSymbol].isLive = false);
                return next;
            });
        };

        wsRef.current = ws;
    };

    setupWebSocket();
    return () => {
        wsRef.current?.close();
    };
  }, [brokerMode]);

  // --- Helper: Consult Gemini ---
  const consultGemini = async (symbol: AssetSymbol, price: number, history: number[], rsi: number, ema: number, volatility: number, trend: string) => {
    try {
      const ai = getAiClient(); // Lazy init
      const trendText = trend === 'UP' ? "BULLISH (Price > EMA200)" : "BEARISH (Price < EMA200)";
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `
          Act as a Pro Trader.
          Asset: ${symbol}
          Price: ${price}
          Trend: ${trendText}
          RSI: ${rsi}
          Volatility: ${volatility.toFixed(4)}
          
          Goal: Identify high probability setups.
          
          DECISION JSON:
          { "action": "BUY"|"SELL"|"HOLD", "confidence": 0-100, "riskLevel": "AGGRESSIVE"|"CONSERVATIVE", "reason": "string" }
        `,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              action: { type: Type.STRING, enum: ["BUY", "SELL", "HOLD"] },
              confidence: { type: Type.INTEGER },
              riskLevel: { type: Type.STRING, enum: ["AGGRESSIVE", "CONSERVATIVE"] },
              reason: { type: Type.STRING }
            },
            required: ["action", "confidence", "riskLevel", "reason"]
          }
        }
      });

      const text = response.text;
      return text ? JSON.parse(text) : null;
    } catch (e) {
      console.error("Gemini API Error:", e);
      return null;
    }
  };

  // --- Engine Loop ---
  useEffect(() => {
    const interval = setInterval(async () => {
      const currentAssets = { ...assetsRef.current };
      const currentTrades = [...tradesRef.current];
      const currentAccount = { ...accountRef.current };
      const currentMode = brokerModeRef.current;

      // Filter active assets based on mode
      const activeSymbols = currentMode === BrokerMode.SIMULATION_CRYPTO 
          ? [AssetSymbol.BTCUSD, AssetSymbol.ETHUSD]
          : [AssetSymbol.XAUUSD, AssetSymbol.NAS100];

      let totalFloatingPnL = 0;

      // 0. Oanda Price Fetch / Account Sync
      if (currentMode === BrokerMode.OANDA_PAPER && oandaServiceRef.current) {
          // Sync Account Balance periodically
          if (Math.random() < 0.2) { // 20% chance per tick (approx every 5s)
              if (typeof oandaServiceRef.current.getAccountSummary === 'function') {
                  const summary = await oandaServiceRef.current.getAccountSummary();
                  if (summary) {
                      currentAccount.balance = summary.balance;
                      currentAccount.equity = summary.nav;
                  }
              }
          }

          const prices = await oandaServiceRef.current.getPrices(activeSymbols as AssetSymbol[]);
          if (prices) {
             prices.forEach((p: any) => {
                const symbolKey = Object.keys(OANDA_CONFIG.symbolMap).find(key => OANDA_CONFIG.symbolMap[key as AssetSymbol] === p.instrument) as AssetSymbol;
                if (symbolKey && currentAssets[symbolKey]) {
                    currentAssets[symbolKey].currentPrice = parseFloat(p.closeoutAsk); // Use Ask price
                    currentAssets[symbolKey].isLive = true;
                }
             });
          }
      }

      // 1. Process Market Data
      activeSymbols.forEach((symbol) => {
        const asset = currentAssets[symbol];
        const config = ASSET_CONFIG[symbol];
        
        // If NOT live, simulate random walk
        let newPrice = asset.currentPrice;
        if (!asset.isLive) {
            newPrice = generateRandomWalk(asset.currentPrice, config.volatility);
        }
        
        // Update History
        const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const newHistory = [...asset.history, { time: timeString, value: newPrice }].slice(-HISTORY_LENGTH);
        
        // Calculate Indicators
        const priceArray = newHistory.map(p => p.value);
        const newRSI = calculateRSI(priceArray);
        const newEMA = calculateEMA(newPrice, asset.ema, 20); 
        const newEMA200 = calculateEMA(newPrice, asset.ema200, 200);
        const newBands = calculateBollingerBands(priceArray);
        const newMACD = calculateMACD(priceArray);
        const newSlope = calculateLinearRegressionSlope(priceArray, 10); // Check slope of last 10 ticks

        const newTrend = newPrice >= newEMA200 ? 'UP' : 'DOWN';

        currentAssets[symbol] = {
          ...asset,
          currentPrice: newPrice,
          history: newHistory,
          rsi: newRSI,
          ema: newEMA,
          ema200: newEMA200,
          trend: newTrend,
          bollinger: newBands,
          macd: newMACD,
          slope: newSlope
        };
      });

      // 2. Manage Open Trades (Partial TPs and Trailing Stops)
      const openTrades = currentTrades.filter(t => t.status === 'OPEN');
      let closedTradesPnL = 0;

      for (const trade of openTrades) {
        const currentPrice = currentAssets[trade.symbol].currentPrice;
        const isBuy = trade.type === TradeType.BUY;
        
        // Calculate current float PnL
        const priceDiff = isBuy ? currentPrice - trade.entryPrice : trade.entryPrice - currentPrice;
        const currentTradePnL = priceDiff * trade.currentSize;
        trade.floatingPnl = currentTradePnL;
        totalFloatingPnL += currentTradePnL;

        // --- CHECK TP LEVELS (Scaling Out) ---
        for (const level of trade.tpLevels) {
            if (!level.hit) {
                const hitTp = isBuy ? currentPrice >= level.price : currentPrice <= level.price;
                
                if (hitTp) {
                    // EXECUTE PARTIAL CLOSE
                    const closeAmount = trade.initialSize * level.percentage;
                    const pnlRealized = (isBuy ? level.price - trade.entryPrice : trade.entryPrice - level.price) * closeAmount;
                    
                    console.log(`HIT TP Level ${level.id} for ${trade.symbol}. Closing ${closeAmount} units.`);
                    
                    let oandaSuccess = true;
                    if (currentMode === BrokerMode.OANDA_PAPER && trade.brokerId && oandaServiceRef.current) {
                        // Call Oanda to close specific units
                        oandaSuccess = await oandaServiceRef.current.closeTrade(trade.brokerId, closeAmount);
                    }
                    
                    if (oandaSuccess) {
                        trade.currentSize -= closeAmount;
                        trade.pnl += pnlRealized;
                        level.hit = true;
                        currentAccount.balance += pnlRealized;
                        closedTradesPnL += pnlRealized;

                        // LOGIC: ACTIONS AFTER TP
                        if (level.id === 1) {
                            // TP1 Hit: Move Stop to Breakeven
                            trade.stopLoss = trade.entryPrice;
                        } else if (level.id === 2) {
                            // TP2 Hit: Engage tight trailing stop for the runner
                            // No specific action needed here, handled by Trailing Logic below
                        }
                    }
                }
            }
        }

        // --- TRAILING STOP LOGIC (For Runners) ---
        // If TP2 has been hit, we trail the price aggressively
        const tp2Hit = trade.tpLevels.find(l => l.id === 2)?.hit;
        
        if (tp2Hit) {
             const trailDistance = Math.abs(trade.entryPrice - trade.tpLevels[0].price) * 0.5; // Trail by half the distance to TP1
             if (isBuy) {
                 const newStop = currentPrice - trailDistance;
                 if (newStop > trade.stopLoss) trade.stopLoss = newStop;
             } else {
                 const newStop = currentPrice + trailDistance;
                 if (newStop < trade.stopLoss) trade.stopLoss = newStop;
             }
        }

        // --- FULL CLOSE CHECK (Stop Loss or Final TP) ---
        let close = false;
        let closeReason: 'STOP_LOSS' | 'TAKE_PROFIT' | undefined;

        if (isBuy) {
          if (currentPrice <= trade.stopLoss) { close = true; closeReason = 'STOP_LOSS'; }
        } else {
          if (currentPrice >= trade.stopLoss) { close = true; closeReason = 'STOP_LOSS'; }
        }
        
        // Also close if size is basically zero (floating point safety)
        if (trade.currentSize <= 0.001) {
            close = true;
            closeReason = 'TAKE_PROFIT';
        }

        if (close) {
          trade.status = 'CLOSED';
          trade.closePrice = currentPrice;
          trade.closeTime = Date.now();
          trade.closeReason = closeReason;
          
          // Realize remaining PnL
          if (trade.currentSize > 0.001) {
             const finalPnL = (isBuy ? currentPrice - trade.entryPrice : trade.entryPrice - currentPrice) * trade.currentSize;
             trade.pnl += finalPnL;
             currentAccount.balance += finalPnL;
             closedTradesPnL += finalPnL;
          }
        }
      }

      currentAccount.dayPnL += closedTradesPnL;
      currentAccount.equity = currentAccount.balance + totalFloatingPnL;

      // 3. Bot Logic
      for (const symbol of activeSymbols) {
        const asset = currentAssets[symbol];
        const prevAsset = assetsRef.current[symbol];
        const hasOpenTrade = openTrades.some(t => t.symbol === symbol && t.status === 'OPEN');
        
        if (asset.botActive && !hasOpenTrade) {
          const stratConfig = STRATEGY_CONFIG[asset.strategy];
          let signal: TradeType | null = null;
          let riskLevel = 'CONSERVATIVE';
          let entryReason = '';
          
          // --- AI STRATEGY ---
          if (asset.strategy === StrategyType.AI_AGENT) {
             const now = Date.now();
             const lastCall = lastAiCallRef.current[symbol] || 0;
             if (now - lastCall > AI_THROTTLE_MS && !asset.isThinking) {
                (async () => {
                   setAssets(prev => ({...prev, [symbol]: { ...prev[symbol], isThinking: true }}));
                   const priceArray = asset.history.map(h => h.value);
                   const volatility = calculateStandardDeviation(priceArray);
                   const decision = await consultGemini(symbol, asset.currentPrice, priceArray, asset.rsi, asset.ema, volatility, asset.trend);
                   lastAiCallRef.current[symbol] = Date.now();

                   if (decision && decision.action !== 'HOLD' && decision.confidence > 75) {
                      const newSignal = decision.action === 'BUY' ? TradeType.BUY : TradeType.SELL;
                      const isTrendAligned = (newSignal === TradeType.BUY && asset.trend === 'UP') || (newSignal === TradeType.SELL && asset.trend === 'DOWN');
                      
                      if (isTrendAligned) {
                        executeTrade(symbol, newSignal, asset.currentPrice, asset.strategy, decision.riskLevel, decision.reason);
                      }
                   }
                   setAssets(prev => ({...prev, [symbol]: { ...prev[symbol], isThinking: false }}));
                })();
             }
          } 
          // --- MOMENTUM STRATEGY (Breakout with Slope Filter) ---
          else if (asset.strategy === StrategyType.MOMENTUM) {
              const currentBandWidth = asset.bollinger.upper - asset.bollinger.lower;
              const prevBandWidth = prevAsset ? (prevAsset.bollinger.upper - prevAsset.bollinger.lower) : currentBandWidth;
              const isExpanding = currentBandWidth > (prevBandWidth * 1.0001); 
              
              const hasMomentum = Math.abs(asset.slope) > 0.3;
              const breakUpper = asset.currentPrice > asset.bollinger.upper;
              const breakLower = asset.currentPrice < asset.bollinger.lower;
              
              if (asset.trend === 'UP' && breakUpper && isExpanding && hasMomentum && asset.rsi > 55 && asset.rsi <= stratConfig.rsiOverbought) {
                 signal = TradeType.BUY;
                 entryReason = `Momentum Breakout: Price broke Upper Band with steep slope (${asset.slope.toFixed(2)}) and expanding volatility.`;
              }
              
              if (asset.trend === 'DOWN' && breakLower && isExpanding && hasMomentum && asset.rsi < 45 && asset.rsi >= stratConfig.rsiOversold) {
                 signal = TradeType.SELL;
                 entryReason = `Momentum Breakdown: Price broke Lower Band with steep slope (${asset.slope.toFixed(2)}) and expanding volatility.`;
              }
              riskLevel = 'AGGRESSIVE';
          }
          // --- SWING STRATEGY ---
          else if (asset.strategy === StrategyType.SWING) {
             const macdLine = asset.macd.macdLine;
             const signalLine = asset.macd.signalLine;
             const prevMacd = prevAsset ? prevAsset.macd.macdLine : macdLine;
             const prevSignal = prevAsset ? prevAsset.macd.signalLine : signalLine;
             const crossedUp = prevMacd < prevSignal && macdLine > signalLine;
             const crossedDown = prevMacd > prevSignal && macdLine < signalLine;

             if (crossedUp && asset.trend === 'UP' && asset.rsi < 70) {
                 signal = TradeType.BUY;
                 entryReason = "Swing Entry: MACD Bullish Crossover confirmed by long-term Uptrend (Price > EMA200).";
             } else if (crossedDown && asset.trend === 'DOWN' && asset.rsi > 30) {
                 signal = TradeType.SELL;
                 entryReason = "Swing Entry: MACD Bearish Crossover confirmed by long-term Downtrend (Price < EMA200).";
             }
             riskLevel = 'CONSERVATIVE';
          }
          
          if (signal) {
              executeTrade(symbol, signal, asset.currentPrice, asset.strategy, riskLevel, entryReason);
          }
        }
      }

      setAssets(prev => {
        const next = { ...prev };
        activeSymbols.forEach(sym => {
           next[sym] = { ...prev[sym], ...currentAssets[sym] };
        });
        return next;
      });

      setTrades(currentTrades);
      setAccount(currentAccount);

    }, TICK_RATE_MS);

    return () => clearInterval(interval);
  }, []);

  // Helper to create trade object with 3-Level Scaling Out
  const executeTrade = async (symbol: AssetSymbol, type: TradeType, price: number, strategy: StrategyType, riskLevel: string = 'CONSERVATIVE', reason?: string) => {
      let stratConfig = STRATEGY_CONFIG[strategy]; 
      if (!stratConfig) stratConfig = STRATEGY_CONFIG[StrategyType.MOMENTUM];

      let tpBasePercent = stratConfig.tpPercent;
      let slPercent = stratConfig.slPercent;

      if (symbol === AssetSymbol.NAS100) {
          tpBasePercent *= 1.5; 
          slPercent *= 1.5;
      } else if (symbol === AssetSymbol.XAUUSD && strategy === StrategyType.SWING) {
          tpBasePercent = 0.02;
          slPercent = 0.01;
      }

      const isBuy = type === TradeType.BUY;
      const stopLoss = isBuy ? price * (1 - slPercent) : price * (1 + slPercent);

      // Calculate 3 Levels of Take Profit
      // TP1: 0.6x of Target (Bank early)
      // TP2: 1.0x of Target (Standard)
      // TP3: 3.0x of Target (Moonbag)
      const tp1Price = isBuy ? price * (1 + (tpBasePercent * 0.6)) : price * (1 - (tpBasePercent * 0.6));
      const tp2Price = isBuy ? price * (1 + tpBasePercent) : price * (1 - tpBasePercent);
      const tp3Price = isBuy ? price * (1 + (tpBasePercent * 3.0)) : price * (1 - (tpBasePercent * 3.0));

      // OANDA CHECK
      let oandaOrderId: string | undefined = undefined;
      
      if (brokerModeRef.current === BrokerMode.OANDA_PAPER && oandaServiceRef.current) {
          // NOTE: When trading manually via API with scaling out, we cannot attach a single TP to the order easily.
          // We set the Stop Loss on the order, but we handle TPs via partial closes in the loop.
          const orderResult = await oandaServiceRef.current.placeOrder(symbol, ASSET_CONFIG[symbol].lotSize, type, stopLoss, 0); // 0 TP on order
          
          if (!orderResult || !orderResult.orderCreateTransaction) {
              console.log('Oanda Trade Aborted / Failed');
              return;
          }
          oandaOrderId = orderResult.orderCreateTransaction.id;
      }

      const newTrade: Trade = {
        id: uuidv4(),
        symbol,
        type,
        entryPrice: price,
        initialSize: ASSET_CONFIG[symbol].lotSize,
        currentSize: ASSET_CONFIG[symbol].lotSize,
        stopLoss,
        // No single TP, instead we have levels
        tpLevels: [
            { id: 1, price: tp1Price, percentage: 0.4, hit: false }, // Close 40%
            { id: 2, price: tp2Price, percentage: 0.4, hit: false }, // Close 40%
            { id: 3, price: tp3Price, percentage: 0.2, hit: false }, // Leave 20% runner
        ],
        openTime: Date.now(),
        status: 'OPEN',
        strategy,
        pnl: 0,
        entryReason: reason,
        brokerId: oandaOrderId
      };
      
      setTrades(prev => [newTrade, ...prev]);
  };

  const toggleBot = useCallback((symbol: AssetSymbol) => {
    setAssets(prev => ({ ...prev, [symbol]: { ...prev[symbol], botActive: !prev[symbol].botActive } }));
  }, []);

  const setStrategy = useCallback((symbol: AssetSymbol, strategy: StrategyType) => {
    setAssets(prev => ({ ...prev, [symbol]: { ...prev[symbol], strategy } }));
  }, []);

  const resetAccount = useCallback(() => {
     setAccount({ balance: INITIAL_BALANCE, equity: INITIAL_BALANCE, dayPnL: 0 });
     setTrades([]);
  }, []);

  const configureOanda = useCallback(async (mode: BrokerMode, config: OandaConfig): Promise<boolean> => {
     if (mode === BrokerMode.OANDA_PAPER) {
        const tempService = new OandaService(config);
        const isValid = await tempService.validateConnection();
        if (!isValid) return false;
     }
     if (typeof window !== 'undefined') {
        localStorage.setItem('brokerMode', mode);
        localStorage.setItem('oandaConfig', JSON.stringify(config));
     }
     setBrokerMode(mode);
     setOandaConfig(config);
     setAssets(initialAssets);
     return true;
  }, []);

  return { assets, account, trades, toggleBot, setStrategy, resetAccount, brokerMode, oandaConfig, configureOanda };
};

function createInitialAsset(symbol: AssetSymbol): AssetData {
    const defaultStrategy = symbol === AssetSymbol.XAUUSD ? StrategyType.SWING : StrategyType.MOMENTUM;
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
      botActive: false,
      strategy: defaultStrategy,
      isThinking: false,
      isLive: false,
    };
}
