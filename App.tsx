import React, { useState } from 'react';
import { useTradingEngine } from './hooks/useTradingEngine';
import { useCryptoEngine } from './hooks/useCryptoEngine';
import AssetCard from './components/AssetCard';
import CryptoAssetCard from './components/CryptoAssetCard';
import TradeHistory from './components/TradeHistory';
import SettingsModal from './components/SettingsModal';
import { Wallet, BarChart2, Clock, RefreshCw, ArrowUpRight, ArrowDownRight, Settings, Server, Wifi, WifiOff } from 'lucide-react';
import { AssetSymbol, Trade, StrategyType, TradeType } from './types';
import { DEFAULT_REMOTE_URL, CRYPTO_DEFAULT_REMOTE_URL } from './constants';

const App: React.FC = () => {
  const { assets, account, trades, toggleBot, setStrategy, resetAccount, brokerMode, oandaConfig, configureOanda, isConnected } = useTradingEngine();
  const { assets: cAssets, account: cAccount, trades: cTrades, isConnected: cConnected, toggleBot: cToggleBot, setStrategy: cSetStrategy, setRemoteUrl: setCryptoRemote } = useCryptoEngine();
  const [view, setView] = useState<'dashboard' | 'indicesHistory' | 'crypto' | 'cryptoHistory'>('dashboard');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [remoteUrl, setRemoteUrl] = useState(''); // used for display in offline banner
  const [isWeekendClosed, setIsWeekendClosed] = useState(false);
  const [marketCountdown, setMarketCountdown] = useState('');

  const formatDuration = (ms: number) => {
    const total = Math.floor(ms / 1000);
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    const prefix = days > 0 ? `${days}d ` : '';
    return `${prefix}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const nextOpen = (now: Date) => {
    const day = now.getDay();
    if (day === 6) {
      const next = new Date(now);
      const add = 7 - day;
      next.setDate(now.getDate() + add);
      next.setHours(18, 0, 0, 0);
      return next;
    }
    if (day === 0) {
      const next = new Date(now);
      next.setHours(18, 0, 0, 0);
      return next;
    }
    return now;
  };

  const isWeekend = (now: Date) => {
    const day = now.getDay();
    if (day === 6) return true;
    if (day === 0) {
      const open = new Date(now);
      open.setHours(18, 0, 0, 0);
      return now.getTime() < open.getTime();
    }
    return false;
  };

  React.useEffect(() => {
    const update = () => {
      const now = new Date();
      const closed = isWeekend(now);
      setIsWeekendClosed(closed);
      if (closed) {
        const open = nextOpen(now);
        const diff = open.getTime() - now.getTime();
        setMarketCountdown(formatDuration(diff));
      } else {
        setMarketCountdown('');
      }
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  React.useEffect(() => {
    const urlBase64ToUint8Array = (base64String: string) => {
      const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
      const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
      return outputArray;
    };
    const run = async () => {
      try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
        const reg = await navigator.serviceWorker.register('/sw.js');
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') return;
        const vapid = (import.meta as any)?.env?.VITE_VAPID_PUBLIC_KEY;
        if (!vapid) return;
        const existing = await reg.pushManager.getSubscription();
        const sub = existing || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapid) });
        const base = typeof window !== 'undefined' ? (localStorage.getItem('remoteUrl') || DEFAULT_REMOTE_URL) : DEFAULT_REMOTE_URL;
        const cryptoBase = typeof window !== 'undefined' ? (localStorage.getItem('cryptoRemoteUrl') || ((import.meta as any)?.env?.VITE_CRYPTO_REMOTE_URL || CRYPTO_DEFAULT_REMOTE_URL)) : CRYPTO_DEFAULT_REMOTE_URL;
        await fetch(`${base.replace(/\/$/, '')}/push/subscribe`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sub) });
        await fetch(`${String(cryptoBase).replace(/\/$/, '')}/push/subscribe`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sub) });
      } catch { }
    };
    run();
  }, []);

  const isPositiveDay = account.dayPnL >= 0;

  // Fixed Assets: Gold and Nasdaq only
  const visibleAssets = [AssetSymbol.XAUUSD, AssetSymbol.NAS100];

  const combinedTrades: Trade[] = React.useMemo(() => {
    const mapCrypto = (ct: any): Trade => {
      const isBuy = ct.type === 'BUY';
      const price = cAssets?.[ct.symbol]?.currentPrice ?? ct.entryPrice;
      const exit = isBuy ? price * 0.999 : price * 1.001;
      const tpLevels = [
        { id: 1, price: ct.tp1, percentage: 0.4, hit: !!ct.tp1Hit },
        { id: 2, price: ct.tp2, percentage: 0.4, hit: !!ct.tp2Hit },
        { id: 3, price: ct.tp3, percentage: 0.2, hit: !!ct.tp3Hit },
      ];
      return {
        id: ct.id,
        symbol: ct.symbol as any,
        type: ct.type as any,
        entryPrice: ct.entryPrice,
        initialSize: ct.initialSize,
        currentSize: ct.currentSize,
        stopLoss: ct.stopLoss,
        tpLevels,
        openTime: ct.openTime,
        closeTime: ct.closeTime,
        closePrice: ct.closePrice,
        pnl: ct.pnl,
        floatingPnl: ct.status === 'OPEN' ? (isBuy ? exit - ct.entryPrice : ct.entryPrice - exit) * ct.currentSize : undefined,
        status: ct.status as any,
        strategy: StrategyType.AI_AGENT,
      };
    };
    const cryptoMapped = cTrades.map(mapCrypto).sort((a, b) => b.openTime - a.openTime);
    return cryptoMapped;
  }, [cTrades, cAssets]);

  const currentRemoteUrl = typeof window !== 'undefined' ? localStorage.getItem('remoteUrl') || 'Default' : 'Default';

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-ios-blue/30">
      {/* Main Scrollable Content */}
      <main className="pb-28 px-5 max-w-lg mx-auto" style={{ paddingTop: 'calc(max(56px, env(safe-area-inset-top)) + 8px)' }}>

        {/* Premium Header */}
        <header className="mb-8 relative z-20">
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full animate-pulse ${((view === 'crypto' || view === 'cryptoHistory') ? (cConnected || Object.keys(cAssets || {}).length > 0) : (isConnected || visibleAssets.some(s => !!assets[s]))) ? 'bg-ios-green' : 'bg-ios-red'}`} />
              <span className="text-sm font-semibold text-ios-gray uppercase tracking-wide">{view === 'dashboard' ? 'Indices Dashboard' : view === 'indicesHistory' ? 'Indices History' : view === 'crypto' ? 'Crypto Desk' : 'Crypto History'}</span>
            </div>
            <div className="flex gap-3">
              <button onClick={resetAccount} className="text-ios-blue hover:opacity-80 active:scale-95 transition-transform">
                <RefreshCw size={20} />
              </button>
              <button onClick={() => setIsSettingsOpen(true)} className="text-ios-gray hover:text-white active:scale-95 transition-colors">
                <Settings size={20} />
              </button>
            </div>
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-white tabular-nums mb-3">
            £{((view === 'crypto' || view === 'cryptoHistory') ? cAccount.equity : account.equity).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h1>

          {/* Daily PnL Badge */}
          <div className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-bold ${((view === 'crypto' || view === 'cryptoHistory') ? cAccount.dayPnL >= 0 : account.dayPnL >= 0) ? 'bg-ios-green/15 text-ios-green' : 'bg-ios-red/15 text-ios-red'}`}>
            {((view === 'crypto' || view === 'cryptoHistory') ? cAccount.dayPnL >= 0 : account.dayPnL >= 0) ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
            <span>
              £{Math.abs((view === 'crypto' || view === 'cryptoHistory') ? cAccount.dayPnL : account.dayPnL).toFixed(2)} ({((((view === 'crypto' || view === 'cryptoHistory') ? cAccount.dayPnL : account.dayPnL) / ((view === 'crypto' || view === 'cryptoHistory') ? cAccount.balance : account.balance)) * 100).toFixed(2)}%)
            </span>
            <span className="ml-1 opacity-60 font-medium text-xs">Today</span>
          </div>
        </header>

        {view === 'dashboard' ? (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h2 className="text-xl font-bold text-white mb-4">
                Institutional Desk
              </h2>

              {visibleAssets.map(symbol => (
                <AssetCard
                  key={symbol}
                  asset={assets[symbol]}
                  trades={trades.filter(t => t.symbol === symbol)}
                  toggleBot={toggleBot}
                  setStrategy={setStrategy}
                />
              ))}
            </div>
          </div>
        ) : view === 'crypto' ? (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h2 className="text-xl font-bold text-white mb-4">Crypto Desk</h2>
              <div className="space-y-6">
                {['BTCUSDT', 'ETHUSDT', 'SOLUSDT'].map(sym => (
                  cAssets[sym] ? <CryptoAssetCard key={sym} asset={cAssets[sym]} trades={cTrades.filter(t => t.symbol === sym)} toggleBot={cToggleBot} setStrategy={cSetStrategy} /> : null
                ))}
              </div>
            </div>
          </div>
        ) : view === 'indicesHistory' ? (
          <div className="animate-fade-in">
            <TradeHistory trades={trades} />
          </div>
        ) : (
          <div className="animate-fade-in">
            <TradeHistory trades={combinedTrades} />
          </div>
        )}
      </main>

      {/* iOS Style Floating Tab Bar */}
      <div className="fixed bottom-6 left-4 right-4 h-16 bg-ios-card/80 backdrop-blur-2xl border border-white/10 rounded-[32px] flex justify-around items-center z-50 shadow-2xl shadow-black/50 max-w-lg mx-auto">
        <button
          onClick={() => setView('dashboard')}
          className={`flex flex-col items-center justify-center w-16 h-full gap-1 transition-all duration-300 ${view === 'dashboard' ? 'text-ios-blue' : 'text-neutral-500'}`}
        >
          <BarChart2 size={24} strokeWidth={view === 'dashboard' ? 2.5 : 2} />
        </button>

        <div className="w-[1px] h-8 bg-white/10"></div>

        <button
          onClick={() => setView('indicesHistory')}
          className={`flex flex-col items-center justify-center w-16 h-full gap-1 transition-all duration-300 ${view === 'indicesHistory' ? 'text-ios-blue' : 'text-neutral-500'}`}
        >
          <Clock size={24} strokeWidth={view === 'indicesHistory' ? 2.5 : 2} />
        </button>

        <div className="w-[1px] h-8 bg-white/10"></div>

        <button
          onClick={() => setView('crypto')}
          className={`flex flex-col items-center justify-center w-16 h-full gap-1 transition-all duration-300 ${view === 'crypto' ? 'text-ios-blue' : 'text-neutral-500'}`}
        >
          <Server size={24} strokeWidth={view === 'crypto' ? 2.5 : 2} />
        </button>

        <div className="w-[1px] h-8 bg-white/10"></div>

        <button
          onClick={() => setView('cryptoHistory')}
          className={`flex flex-col items-center justify-center w-16 h-full gap-1 transition-all duration-300 ${view === 'cryptoHistory' ? 'text-ios-blue' : 'text-neutral-500'}`}
        >
          <Clock size={24} strokeWidth={view === 'cryptoHistory' ? 2.5 : 2} />
        </button>
      </div>

      {/* Background Ambience */}
      <div className="fixed top-0 left-0 right-0 h-96 bg-gradient-to-b from-yellow-900/10 to-transparent pointer-events-none -z-10" />
    </div>
  );
};

export default App;
