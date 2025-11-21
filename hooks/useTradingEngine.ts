
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
  const [isConnected, setIsConnected] = useState(false); // New connection state

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
          // Auto-fix dirty URLs from iPhone copy-paste
          const cleanUrl = remoteUrl.trim().replace(/\/$/, "");
          
          const res = await fetch(`${cleanUrl}/state`);
          if (res.ok) {
              const state = await res.json();
              // We only update if we got valid data back
              if (state.assets && state.account && state.trades) {
                  setAssets(state.assets);
                  setAccount(state.account);
                  setTrades(state.trades);
                  setIsConnected(true); // Connection successful
              }
          } else {
              setIsConnected(false); // Server reachable but returned error
          }
      } catch (e) {
          setIsConnected(false); // Network error (server down or wrong URL)
      }
      
    }, TICK_RATE_MS);

    return () => clearInterval(interval);
  }, [remoteUrl]);

  // --- Public Interface Wrappers for Remote Calls ---
  const toggleBot = useCallback(async (symbol: AssetSymbol) => {
      const cleanUrl = remoteUrl.trim().replace(/\/$/, "");
      try { await fetch(`${cleanUrl}/toggle/${encodeURIComponent(symbol)}`, { method: 'POST' }); } catch (e) {}
  }, [remoteUrl]);

  const toggleStrategy = useCallback(async (symbol: AssetSymbol, s: StrategyType) => {
      const cleanUrl = remoteUrl.trim().replace(/\/$/, "");
      try { await fetch(`${cleanUrl}/strategy/${encodeURIComponent(symbol)}`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ strategy: s }) }); } catch (e) {}
  }, [remoteUrl]);

  const resetAccount = useCallback(async () => {
     if (confirm("Reset Remote Account? This will clear history on the server.")) {
          const cleanUrl = remoteUrl.trim().replace(/\/$/, "");
          try { await fetch(`${cleanUrl}/reset`, { method: 'POST' }); } catch(e) {}
     }
  }, [remoteUrl]);

  const configureOanda = useCallback(async (mode: BrokerMode, config: OandaConfig, url?: string): Promise<boolean> => {
      // In this simplified mode, we mostly care about the URL
      if (typeof window !== 'undefined') {
          if (url) { 
              const clean = url.trim().replace(/\/$/, "");
              localStorage.setItem('remoteUrl', clean); 
              setRemoteUrl(clean); 
          }
      }
      return true;
  }, []);

  // Return remoteUrl so UI can display it for debug
  return { assets, account, trades, toggleBot, setStrategy: toggleStrategy, resetAccount, brokerMode, oandaConfig, configureOanda, isConnected, remoteUrl };
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
      activeStrategies: symbol === AssetSymbol.XAUUSD ? [StrategyType.LONDON_SWEEP] : [StrategyType.NY_ORB],
      isThinking: false, isLive: false,
    };
}
