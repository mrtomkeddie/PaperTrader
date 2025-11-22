import { useState, useEffect, useRef, useCallback } from 'react';
import { AssetSymbol, StrategyType, Trade, AssetData, AccountState, BrokerMode, OandaConfig } from '../types';
import { INITIAL_BALANCE, TICK_RATE_MS, ASSET_CONFIG, DEFAULT_REMOTE_URL } from '../constants';

export const useTradingEngine = () => {
  // --- Settings State ---
  // Always default to Remote Server
  const brokerMode = BrokerMode.REMOTE_SERVER;

  const isDev = (import.meta as any)?.env?.DEV;
  const [remoteUrl, setRemoteUrl] = useState(() => {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('remoteUrl');
        if (saved) return saved;
        if (isDev) return '/api';
        return DEFAULT_REMOTE_URL;
      }
      return isDev ? '/api' : DEFAULT_REMOTE_URL;
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
  const esRef = useRef<EventSource | null>(null);
  const lastUpdateRef = useRef<number>(0);
  
  // --- MAIN ENGINE LOOP (POLLING ONLY) ---
  useEffect(() => {
    try {
      const connect = (base: string) => {
        const clean = base.trim().replace(/\/$/, "");
        const stream = new EventSource(`${clean}/events?ts=${Date.now()}`);
        esRef.current = stream;
        stream.onmessage = (ev) => {
          try {
            const state = JSON.parse(ev.data);
            if (state.assets && state.account && state.trades) {
              setAssets(state.assets);
              setAccount(state.account);
              setTrades(state.trades);
              setIsConnected(true);
              lastUpdateRef.current = Date.now();
            }
          } catch {}
        };
        stream.onerror = () => {
          try { stream.close(); } catch {}
          esRef.current = null;
          setIsConnected(false);
          setTimeout(() => {
            try { connect(remoteUrl); } catch {}
          }, 2000);
        };
        return stream;
      };
      const es = connect(remoteUrl);
      const watchdog = setInterval(() => {
        const stale = Date.now() - (lastUpdateRef.current || 0) > 12000;
        if (stale) {
          try { es.close(); } catch {}
          esRef.current = null;
          setIsConnected(false);
          try {
            connect(remoteUrl);
          } catch {}
          try {
            const alt = DEFAULT_REMOTE_URL.trim().replace(/\/$/, "");
            if (alt && alt !== remoteUrl) {
              const es2 = connect(alt);
              es2.onmessage = (ev2) => {
                try {
                  const s2 = JSON.parse(ev2.data);
                  if (s2.assets && s2.account && s2.trades) {
                    if (typeof window !== 'undefined') localStorage.setItem('remoteUrl', alt);
                    setRemoteUrl(alt);
                    setAssets(s2.assets);
                    setAccount(s2.account);
                    setTrades(s2.trades);
                    setIsConnected(true);
                    lastUpdateRef.current = Date.now();
                  }
                } catch {}
              };
            }
          } catch {}
        }
      }, 5000);
      return () => { try { clearInterval(watchdog); } catch {}; try { es.close(); } catch {}; esRef.current = null; };
    } catch {}
  }, [remoteUrl]);

  useEffect(() => {
    const interval = setInterval(async () => {
      
      // --- REMOTE SERVER POLL ---
      try {
          // Auto-fix dirty URLs from iPhone copy-paste
          const cleanUrl = remoteUrl.trim().replace(/\/$/, "");
          const res = await fetch(`${cleanUrl}/state?ts=${Date.now()}`, { cache: 'no-store' });
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
          try {
              const alt = DEFAULT_REMOTE_URL.trim().replace(/\/$/, "");
              if (alt && alt !== remoteUrl) {
                  const res2 = await fetch(`${alt}/state?ts=${Date.now()}`, { cache: 'no-store' });
                  if (res2.ok) {
                      const state2 = await res2.json();
                      if (state2.assets && state2.account && state2.trades) {
                          if (typeof window !== 'undefined') localStorage.setItem('remoteUrl', alt);
                          setRemoteUrl(alt);
                          setAssets(state2.assets);
                          setAccount(state2.account);
                          setTrades(state2.trades);
                          setIsConnected(true);
                      }
                  }
              }
          } catch {}
      }
      
    }, TICK_RATE_MS);

    return () => clearInterval(interval);
  }, [remoteUrl]);

  // --- Auto-discover best remote server on first load ---
  useEffect(() => {
    const chooseUrl = async () => {
      try {
        const saved = typeof window !== 'undefined' ? localStorage.getItem('remoteUrl') : null;
        const candidates = [
          ...(isDev ? ['/api'] : []),
          DEFAULT_REMOTE_URL,
          ...(saved ? [saved] : []),
          'http://localhost:3001',
          'http://localhost:3002'
        ];
        for (const base of candidates) {
          try {
            const res = await fetch(`${base.replace(/\/$/, '')}/state?ts=${Date.now()}`, { method: 'GET', cache: 'no-store' });
            if (res.ok) {
              const clean = base.replace(/\/$/, '');
              if (typeof window !== 'undefined') {
                localStorage.setItem('remoteUrl', clean);
              }
              setRemoteUrl(clean);
              return;
            }
          } catch {}
        }
      } catch {}
    };
    chooseUrl();
  }, []);

  // --- Public Interface Wrappers for Remote Calls ---
  const toggleBot = useCallback(async (symbol: AssetSymbol) => {
    const cleanUrl = remoteUrl.trim().replace(/\/$/, "");
    try { await fetch(`${cleanUrl}/toggle/${encodeURIComponent(symbol)}`, { method: 'POST' }); } catch (e) {}
  }, [remoteUrl]);

  const toggleStrategy = useCallback(async (symbol: AssetSymbol, s: StrategyType) => {
      const cleanUrl = remoteUrl.trim().replace(/\/$/, "");
      
      // Optimistic UI Update: Update local state instantly
      setAssets(prev => {
        const asset = prev[symbol];
        const list = asset.activeStrategies;
        const newList = list.includes(s) 
            ? list.filter(strat => strat !== s)
            : [...list, s];
        
        return {
            ...prev,
            [symbol]: { ...asset, activeStrategies: newList }
        };
      });

      try { 
          await fetch(`${cleanUrl}/strategy/${encodeURIComponent(symbol)}`, { 
              method: 'POST', 
              headers: {'Content-Type': 'application/json'}, 
              body: JSON.stringify({ strategy: s }) 
          }); 
      } catch (e) {
          // Revert logic could go here if needed, but next poll will sync anyway
      }
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
    // Default strategies match server/bot.js defaults
    const defaultStrategies = symbol === AssetSymbol.XAUUSD 
        ? [StrategyType.LONDON_SWEEP, StrategyType.TREND_FOLLOW]
        : [StrategyType.NY_ORB, StrategyType.TREND_FOLLOW];

    return {
      symbol,
      currentPrice: ASSET_CONFIG[symbol].startPrice,
      history: [],
      rsi: 50, ema: ASSET_CONFIG[symbol].startPrice, ema200: ASSET_CONFIG[symbol].startPrice, trend: 'UP',
      macd: { macdLine: 0, signalLine: 0, histogram: 0 },
      bollinger: { upper: 0, middle: 0, lower: 0 },
      slope: 0,
      botActive: true,
      activeStrategies: defaultStrategies,
      isThinking: false, isLive: false,
    };
}