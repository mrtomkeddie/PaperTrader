import { useEffect, useRef, useState } from 'react';
import { DEFAULT_REMOTE_URL, CRYPTO_DEFAULT_REMOTE_URL } from '../constants';

export interface CryptoAssetData {
  symbol: string;
  currentPrice: number;
  history: { time: string; value: number }[];
  rsi: number;
  ema: number;
  ema200: number;
  trend: 'UP' | 'DOWN';
  botActive: boolean;
  activeStrategies: string[];
  isLive?: boolean;
  aiAnalyzing?: boolean;
}

export interface CryptoTrade {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  entryPrice: number;
  initialSize: number;
  currentSize: number;
  stopLoss: number;
  tp1: number;
  tp2: number;
  tp3: number;
  tp1Hit?: boolean;
  tp2Hit?: boolean;
  tp3Hit?: boolean;
  openTime: number;
  closeTime?: number;
  closePrice?: number;
  pnl: number;
  status: 'OPEN' | 'CLOSED';
  strategy?: string;
}

export interface CryptoAccount { balance: number; equity: number; dayPnL: number; totalPnL?: number; }

export const useCryptoEngine = () => {
  const isDev = (typeof window !== 'undefined' && window.location && window.location.hostname === 'localhost') || ((import.meta as any)?.env?.DEV);
  const [remoteUrl, setRemoteUrl] = useState(() => {
    const saved = (typeof window !== 'undefined') ? localStorage.getItem('cryptoRemoteUrl') : null;
    if (saved) return saved.replace(/\/$/, '');
    const envUrl = (import.meta as any)?.env?.VITE_CRYPTO_REMOTE_URL;
    if (envUrl) return envUrl.replace(/\/$/, '');
    if (isDev) return '/crypto';
    return CRYPTO_DEFAULT_REMOTE_URL.replace(/\/$/, '');
  });
  const [assets, setAssets] = useState<Record<string, CryptoAssetData>>({});
  const [account, setAccount] = useState<CryptoAccount>({ balance: 0, equity: 0, dayPnL: 0, totalPnL: 0 });
  const [trades, setTrades] = useState<CryptoTrade[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const base = remoteUrl.trim().replace(/\/$/, '');
    const open = () => {
      const stream = new EventSource(`${base}/events?ts=${Date.now()}`);
      esRef.current = stream;
      stream.onopen = () => { try { setIsConnected(true); } catch {} };
      stream.onmessage = (ev) => {
        try {
          const s = JSON.parse(ev.data);
          if (s.assets && s.account && s.trades) {
            setAssets(s.assets);
            setAccount(s.account);
            setTrades(s.trades);
            setIsConnected(true);
          }
        } catch {}
      };
      stream.onerror = () => {
        try { stream.close(); } catch {};
        esRef.current = null;
        setIsConnected(false);
        setTimeout(() => { try { open(); } catch {} }, 2000);
      };
    };
    open();
    (async () => {
      try {
        const res = await fetch(`${base}/state?ts=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
          const s = await res.json();
          if (s.assets && s.account && s.trades) {
            setAssets(s.assets);
            setAccount(s.account);
            setTrades(s.trades);
            setIsConnected(true);
          }
        }
      } catch {}
    })();
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${base}/state?ts=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
          const s = await res.json();
          if (s.assets && s.account && s.trades) {
            setAssets(s.assets);
            setAccount(s.account);
            setTrades(s.trades);
            setIsConnected(true);
          }
        }
      } catch {}
    }, 1500);
    return () => { try { clearInterval(interval); } catch {}; try { esRef.current?.close(); } catch {}; esRef.current = null; };
  }, [remoteUrl]);

  const toggleBot = async (symbol: string) => {
    const base = remoteUrl.trim().replace(/\/$/, '');
    try { await fetch(`${base}/toggle/${encodeURIComponent(symbol)}`, { method: 'POST' }); } catch {}
  };
  const setStrategy = async (symbol: string, strategy: string) => {
    const base = remoteUrl.trim().replace(/\/$/, '');
    try { await fetch(`${base}/strategy/${encodeURIComponent(symbol)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ strategy }) }); } catch {}
  };
  const changeRemote = (url: string) => {
    try { if (typeof window !== 'undefined') localStorage.setItem('cryptoRemoteUrl', url); } catch {}
    setRemoteUrl(url);
  };
  return { assets, account, trades, isConnected, remoteUrl, setRemoteUrl: changeRemote, toggleBot, setStrategy };
};