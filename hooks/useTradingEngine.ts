
import { useState, useEffect, useRef, useCallback } from 'react';
import { AssetSymbol, StrategyType, Trade, AssetData, AccountState, BrokerMode, OandaConfig } from '../types';
import { INITIAL_BALANCE, TICK_RATE_MS, ASSET_CONFIG, DEFAULT_REMOTE_URL } from '../constants';

export const useTradingEngine = () => {
  // --- Settings State ---
  // Always default to Remote Server
  const brokerMode = BrokerMode.REMOTE_SERVER;

  const [remoteUrl, setRemoteUrl] = useState(() => {
      if (typeof window !== 'undefined') return localStorage.getItem('remoteUrl') || DEFAULT_REMOTE_URL;
      return DEFAULT_REMOTE_URL;
  });

  const [oandaConfig, setOandaConfig] = useState<OandaConfig>({ apiKey: '', accountId: '', environment: 'practice' });

  // --- ACCOUNT STATE ---
  const [account, setAccount] = useState<AccountState>({ balance: INITIAL_BALANCE, equity: INITIAL_BALANCE, dayPnL: 0 });
  const [trades, setTrades] = useState<Trade[]>([]);

  // Assets State
  const initialAssets: Record<AssetSymbol, AssetData> = {
    [AssetSymbol.XAUUSD]: createInitialAsset(AssetSymbol.XAUUSD),
    [AssetSymbol.NAS100]: createInitialAsset(AssetSymbol.NAS100)
  };
  const [assets, setAssets] = useState<Record<AssetSymbol, AssetData>>(initialAssets);
  
  // --- MAIN ENGINE LOOP (POLLING ONLY) ---
  useEffect(() => {
    const interval = setInterval(async () => {
      
      // --- REMOTE SERVER POLL ---
      try {
          const res = await fetch(`${remoteUrl}/state`);
          if (res.ok) {
              const state = await res.json();
              // We only update if we got valid data back
              if (state.assets && state.account && state.trades) {
                  setAssets(state.assets);
                  setAccount(state.account);
                  setTrades(state.trades);
              }
          }
      } catch (e) {
          // Silent fail or maybe show a connection error indicator in a real app
          // console.error("Polling failed", e); 
      }
      
    }, TICK_RATE_MS);

    return () => clearInterval(interval);
  }, [remoteUrl]);

  // --- Public Interface Wrappers for Remote Calls ---
  const toggleBot = useCallback(async (symbol: AssetSymbol) => {
      try { await fetch(`${remoteUrl}/toggle/${encodeURIComponent(symbol)}`, { method: 'POST' }); } catch (e) {}
  }, [remoteUrl]);

  const setStrategy = useCallback(async (symbol: AssetSymbol, s: StrategyType) => {
      try { await fetch(`${remoteUrl}/strategy/${encodeURIComponent(symbol)}`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ strategy: s }) }); } catch (e) {}
  }, [remoteUrl]);

  const resetAccount = useCallback(async () => {
     if (confirm("Reset Remote Account? This will clear history on the server.")) {
          try { await fetch(`${remoteUrl}/reset`, { method: 'POST' }); } catch(e) {}
     }
  }, [remoteUrl]);

  const configureOanda = useCallback(async (mode: BrokerMode, config: OandaConfig, url?: string): Promise<boolean> => {
      // In this simplified mode, we mostly care about the URL
      if (typeof window !== 'undefined') {
          if (url) { localStorage.setItem('remoteUrl', url); setRemoteUrl(url); }
      }
      return true;
  }, []);

  return { assets, account, trades, toggleBot, setStrategy, resetAccount, brokerMode, oandaConfig, configureOanda };
};

function createInitialAsset(symbol: AssetSymbol): AssetData {
    return {
      symbol,
      currentPrice: ASSET_CONFIG[symbol].startPrice,
      history: [],
      rsi: 50, ema: ASSET_CONFIG[symbol].startPrice, ema200: ASSET_CONFIG[symbol].startPrice, trend: 'UP',
      macd: { macdLine: 0, signalLine: 0, histogram: 0 },
      bollinger: { upper: 0, middle: 0, lower: 0 },
      slope: 0,
      botActive: true,
      strategy: symbol === AssetSymbol.XAUUSD ? StrategyType.LONDON_SWEEP : StrategyType.NY_ORB,
      isThinking: false, isLive: false,
    };
}
