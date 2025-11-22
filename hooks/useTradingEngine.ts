import { useState, useEffect, useRef, useCallback } from 'react';
import { AssetSymbol, StrategyType, Trade, AssetData, AccountState, BrokerMode, OandaConfig } from '../types';
import { INITIAL_BALANCE, TICK_RATE_MS, ASSET_CONFIG, DEFAULT_REMOTE_URL } from '../constants';

export const useTradingEngine = () => {
  // --- Settings State ---
  // Always default to Remote Server
  const brokerMode = BrokerMode.REMOTE_SERVER;

  const [remoteUrl, setRemoteUrl] = useState(() => {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('remoteUrl');
        return saved || DEFAULT_REMOTE_URL;
      }
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
  const esRef = useRef<EventSource | null>(null);
  const lastUpdateRef = useRef<number>(0);
  
  // --- MAIN ENGINE LOOP (POLLING ONLY) ---
  useEffect(() => {
    try {
      const cleanUrl = remoteUrl.trim().replace(/\/$/, "");
      const es = new EventSource(`${cleanUrl}/events?ts=${Date.now()}`);
      esRef.current = es;
      es.onmessage = (ev) => {
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
      es.onerror = () => {
        try { es.close(); } catch {}
        esRef.current = null;
        setIsConnected(false);
      };
      const watchdog = setInterval(() => {
        const stale = Date.now() - (lastUpdateRef.current || 0) > 12000;
        if (stale) {
          try { es.close(); } catch {}
          esRef.current = null;
          setIsConnected(false);
          try {
            const alt = DEFAULT_REMOTE_URL.trim().replace(/\/$/, "");
            if (alt && alt !== remoteUrl) {
              const es2 = new EventSource(`${alt}/events?ts=${Date.now()}`);
              esRef.current = es2;
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
              es2.onerror = () => { try { es2.close(); } catch {}; esRef.current = null; };
            }
          } catch {}
        }
      }, 5000);
      return () => { try { clearInterval(watchdog); } catch {}; try { es.close(); } catch {}; esRef.current = null; };
    } catch {}
  }, [remoteUrl]);
    const interval = setInterval(async () => {
      
      // --- REMOTE SERVER POLL ---
      try {
          // Auto-fix dirty URLs from iPhone copy-paste
          const cleanUrl = remoteUrl.trim().replace(/\/$/, "");
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);
          const res = await fetch(`${cleanUrl}/state?ts=${Date.now()}`, { cache: 'no-store', signal: controller.signal });
          clearTimeout(timeout);
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
                  const controller2 = new AbortController();
                  const timeout2 = setTimeout(() => controller2.abort(), 4000);
                  const res2 = await fetch(`${alt}/state?ts=${Date.now()}`, { cache: 'no-store', signal: controller2.signal });
                  clearTimeout(timeout2);
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
          ...(saved ? [saved] : []),
          'http://localhost:3001',
          'http://localhost:3002',
          DEFAULT_REMOTE_URL
        ];
        for (const base of candidates) {
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 4000);
            const res = await fetch(`${base.replace(/\/$/, '')}/state?ts=${Date.now()}`, { method: 'GET', cache: 'no-store', signal: controller.signal });
            clearTimeout(timeout);
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