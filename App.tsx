import React, { useState } from 'react';
import { useTradingEngine } from './hooks/useTradingEngine';
import { LayoutDashboard, List } from 'lucide-react';
import DashboardHeader from './components/DashboardHeader';
import SignalPanel from './components/SignalPanel';
import ChartPanel from './components/ChartPanel';
import PositionsTable from './components/PositionsTable';
import SettingsModal from './components/SettingsModal';
import MobileTradeModal from './components/MobileTradeModal';
import MobileHeader from './components/mobile/MobileHeader';
import MobileDashboard from './components/mobile/MobileDashboard';
import MobileTrades from './components/mobile/MobileTrades';
import MobileBottomNav from './components/mobile/MobileBottomNav';
import { AssetSymbol, StrategyType, Trade } from './types';
import { DEFAULT_REMOTE_URL } from './constants';

const App: React.FC = () => {
  const { assets, account, trades, toggleBot, setStrategy, resetAccount, brokerMode, oandaConfig, configureOanda, isConnected } = useTradingEngine();
  const [activeSymbol, setActiveSymbol] = useState<AssetSymbol>(AssetSymbol.NAS100);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeMobileTab, setActiveMobileTab] = useState<'dashboard' | 'trades'>('dashboard');
  const [mobileSelectedTrade, setMobileSelectedTrade] = useState<Trade | null>(null);

  // Service Worker & Notifications Setup
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
        try { await reg.update(); } catch {}
        
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') return;
        
        const vapid = (import.meta as any)?.env?.VITE_VAPID_PUBLIC_KEY;
        if (!vapid) return;
        
        const existing = await reg.pushManager.getSubscription();
        const sub = existing || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapid) });
        
        const base = typeof window !== 'undefined' ? (localStorage.getItem('remoteUrl') || DEFAULT_REMOTE_URL) : DEFAULT_REMOTE_URL;
        await fetch(`${base.replace(/\/$/, '')}/push/subscribe`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sub) });
      } catch { }
    };
    run();
  }, []);

  const activeAssetData = assets[activeSymbol];
  const openTrade = trades.find(t => t.symbol === activeSymbol && t.status === 'OPEN');
  // Only show trade details if explicitly selected. 
  // If Live View (selectedTrade is null), we pass openTrade separately so SignalPanel can show a summary/status but not the full card.
  
  const handleTradeSelect = (trade: Trade) => {
    setSelectedTrade(trade);
    setActiveSymbol(trade.symbol as AssetSymbol);
    setMobileSelectedTrade(trade);
  };

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white font-sans selection:bg-blue-500/30 flex flex-col">
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentMode={brokerMode}
        oandaConfig={oandaConfig}
        onSave={configureOanda}
        isIndicesConnected={isConnected}
      />

      <div className="hidden md:block">
        <DashboardHeader 
            account={account} 
            toggleAsset={(s) => {
            setActiveSymbol(s);
            setSelectedTrade(null); // Clear selection when manually changing asset
            }} 
            activeAsset={activeSymbol}
            onOpenSettings={() => setIsSettingsOpen(true)}
        />
      </div>

      {/* Mobile Header */}
      <div className="md:hidden">
        <MobileHeader 
            title={activeMobileTab === 'dashboard' ? 'INDICES DASHBOARD' : 'INDICES HISTORY'}
            account={account}
            onOpenSettings={() => setIsSettingsOpen(true)}
            activeAsset={activeSymbol}
            onToggleAsset={(s) => {
              setActiveSymbol(s);
              setMobileSelectedTrade(null); // Clear selection when manually changing asset
            }}
        />
      </div>

      <main className="flex-1 p-0 md:p-6 overflow-y-auto">
        {/* Desktop Layout */}
        <div className="hidden md:block max-w-[1600px] mx-auto space-y-6">
            <div className="grid grid-cols-12 gap-6 min-h-[500px]">
                <div className="col-span-4 h-full">
                    {activeAssetData ? (
                        <SignalPanel 
                            asset={activeAssetData} 
                            trade={selectedTrade} 
                            activeOpenTrade={openTrade}
                            onToggleStrategy={setStrategy} 
                            onClearSelection={() => setSelectedTrade(null)}
                        />
                    ) : (
                        <div className="h-full flex items-center justify-center bg-[#13141b] rounded-2xl border border-white/5">
                            <span className="text-gray-500">Loading Asset Data...</span>
                        </div>
                    )}
                </div>
                <div className="col-span-8 h-full">
                    {activeAssetData ? (
                         <ChartPanel asset={activeAssetData} />
                    ) : (
                        <div className="h-full flex items-center justify-center bg-[#13141b] rounded-2xl border border-white/5">
                            <span className="text-gray-500">Loading Chart...</span>
                        </div>
                    )}
                </div>
            </div>
            <div className="h-[400px]">
                <PositionsTable 
                    trades={trades} 
                    onSelectTrade={handleTradeSelect}
                    selectedTradeId={selectedTrade?.id}
                />
            </div>
        </div>

        {/* Mobile Layout */}
        <div className="md:hidden pb-20">
             {activeMobileTab === 'dashboard' ? (
                activeAssetData ? (
                    <MobileDashboard 
                        asset={activeAssetData}
                        activeStrategies={activeAssetData.activeStrategies || []}
                        onToggleStrategy={setStrategy}
                        isAutoTrading={activeAssetData.botActive}
                        onToggleAuto={() => toggleBot(activeAssetData.symbol)}
                    />
                ) : (
                    <div className="flex items-center justify-center h-64 text-gray-500">Loading...</div>
                )
             ) : (
                 <MobileTrades 
                    trades={trades}
                    onSelectTrade={handleTradeSelect}
                 />
             )}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden">
        <MobileBottomNav activeTab={activeMobileTab} onTabChange={setActiveMobileTab} />
      </div>

      <MobileTradeModal 
        isOpen={!!mobileSelectedTrade}
        onClose={() => setMobileSelectedTrade(null)}
        trade={mobileSelectedTrade}
        assetData={mobileSelectedTrade ? assets[mobileSelectedTrade.symbol as AssetSymbol] : undefined}
      />
    </div>
  );
};

export default App;
