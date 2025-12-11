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
        // Check local storage first to allow overrides
        const raw = localStorage.getItem('remoteUrl');
        const saved = raw ? raw.trim().replace(/\/$/, '') : '';
        const hasProto = /^https?:\/\//i.test(saved);
        const isLocalhost = saved.includes('localhost') || saved.includes('127.0.0.1');
        
        // Only accept saved URL if it is valid AND NOT localhost (to enforce production)
        if (hasProto && saved && !isLocalhost) return saved;

        // Force connection to Deployed/Remote Server by default
        return DEFAULT_REMOTE_URL;
      }
      return DEFAULT_REMOTE_URL;
  });

  const [oandaConfig, setOandaConfig] = useState<OandaConfig>({ apiKey: '', accountId: '', environment: 'practice' });

  // --- ACCOUNT STATE ---
  const [account, setAccount] = useState<AccountState>({ balance: INITIAL_BALANCE, equity: INITIAL_BALANCE, dayPnL: 0, totalPnL: 0 });
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
            if (state.assets) setAssets(state.assets);
            if (state.account) setAccount(state.account);
            if (state.trades) setTrades(state.trades);
            setIsConnected(true);
            lastUpdateRef.current = Date.now();
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
          try { connect(remoteUrl); } catch {}
        }
      }, 5000);
      return () => { try { clearInterval(watchdog); } catch {}; try { es.close(); } catch {}; esRef.current = null; };
    } catch {}
  }, [remoteUrl]);

  useEffect(() => {
    const id = setInterval(async () => {
      const stale = Date.now() - (lastUpdateRef.current || 0) > 6000;
      if (!stale) return;
      try {
        const clean = remoteUrl.trim().replace(/\/$/, "");
        const r = await fetch(`${clean}/state?ts=${Date.now()}`, { cache: 'no-store' });
        if (r.ok) {
          const s = await r.json();
          if (s.assets) setAssets(s.assets);
          if (s.account) setAccount(s.account);
          if (s.trades) setTrades(s.trades);
          setIsConnected(true);
          lastUpdateRef.current = Date.now();
        }
      } catch {}
    }, 5000);
    return () => { try { clearInterval(id); } catch {} };
  }, [remoteUrl]);

  

  useEffect(() => {
    if (isConnected) return;
    const interval = setInterval(async () => {
      try {
          const cleanUrl = remoteUrl.trim().replace(/\/$/, "");
          const res = await fetch(`${cleanUrl}/state?ts=${Date.now()}`, { cache: 'no-store' });
          if (res.ok) {
              const state = await res.json();
              if (state.assets) setAssets(state.assets);
              if (state.account) setAccount(state.account);
              if (state.trades) setTrades(state.trades);
              setIsConnected(true);
          } else {
              setIsConnected(false);
          }
      } catch (e) {
          setIsConnected(false);
      }
    }, TICK_RATE_MS);
    return () => clearInterval(interval);
  }, [remoteUrl, isConnected]);

  // --- Auto-discover best remote server on first load ---
  useEffect(() => {
    const chooseUrl = async () => {
      try {
        const rawSaved = typeof window !== 'undefined' ? localStorage.getItem('remoteUrl') : null;
        const saved = rawSaved ? rawSaved.trim().replace(/\/$/, '') : null;
        const hasProto = saved ? /^https?:\/\//i.test(saved) : false;
        
        // Check if saved URL is localhost
        const isSavedLocalhost = saved ? (saved.includes('localhost') || saved.includes('127.0.0.1')) : false;

        // Force Production: Ignore isDev and localhost logic to ensure we always connect to the deployed server
        // We only respect saved URL if it's NOT localhost (e.g. if user manually pointed to another remote)
        // Otherwise, revert to DEFAULT_REMOTE_URL (Production)
        
        let preferred = DEFAULT_REMOTE_URL;
        
        if (hasProto && saved && !isSavedLocalhost) {
            preferred = saved;
        }
        
        if (typeof window !== 'undefined') localStorage.setItem('remoteUrl', preferred);
        setRemoteUrl(preferred);
      } catch {}
    };
    chooseUrl();
  }, []);

  // Removed auto-localhost discovery interval to enforce consistent server connection

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
          const res = await fetch(`${cleanUrl}/strategy/${encodeURIComponent(symbol)}`, { 
              method: 'POST', 
              headers: {'Content-Type': 'application/json'}, 
              body: JSON.stringify({ strategy: s }) 
          }); 
          if (!res.ok) throw new Error('Server rejected strategy toggle');
      } catch (e) {
          // Revert optimistic update if server request fails
          setAssets(prev => {
              const asset = prev[symbol];
              // We can't easily "undo" without knowing the previous state exactly,
              // but we can toggle it back.
              // Better: just rely on the next poll/SSE to fix it, but let's notify.
              // Or simpler: Toggle it back manually.
              const list = asset.activeStrategies;
              const newList = list.includes(s) 
                  ? list.filter(strat => strat !== s) // It was added, so remove it
                  : [...list, s]; // It was removed, so add it back
               
              // Actually, if we just toggled it, the "current" list (in prev) has the NEW state.
              // So we need to reverse the logic to get back to OLD state.
              // BUT 'prev' in this setter might be different from the 'prev' in the first setter due to closure?
              // No, 'prev' is the current state when this runs.
              // If the first setter ran, 'prev' here has the CHANGED state.
              // So we just toggle 's' again to revert.
              
              const revertList = list.includes(s)
                  ? list.filter(strat => strat !== s)
                  : [...list, s];

              return {
                  ...prev,
                  [symbol]: { ...asset, activeStrategies: revertList }
              };
          });
          console.error("Failed to toggle strategy, reverting UI", e);
      }
  }, [remoteUrl]);

  const resetAccount = useCallback(async () => {
     if (confirm("Reset account balance only? History will be preserved.")) {
          const cleanUrl = remoteUrl.trim().replace(/\/$/, "");
          try { await fetch(`${cleanUrl}/reset_account`, { method: 'POST' }); } catch(e) {}
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
    const defaultStrategies = symbol === AssetSymbol.NAS100 
        ? [StrategyType.NY_ORB, StrategyType.AI_AGENT]
        : [StrategyType.AI_AGENT];

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
