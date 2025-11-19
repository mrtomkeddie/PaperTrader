
import React, { useState } from 'react';
import { useTradingEngine } from './hooks/useTradingEngine';
import AssetCard from './components/AssetCard';
import TradeHistory from './components/TradeHistory';
import SettingsModal from './components/SettingsModal';
import { Wallet, BarChart2, Clock, RefreshCw, ArrowUpRight, ArrowDownRight, Settings } from 'lucide-react';
import { AssetSymbol, BrokerMode } from './types';

const App: React.FC = () => {
  const { assets, account, trades, toggleBot, setStrategy, resetAccount, brokerMode, oandaConfig, configureOanda } = useTradingEngine();
  const [view, setView] = useState<'dashboard' | 'history'>('dashboard');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const isPositiveDay = account.dayPnL >= 0;

  // Decide which assets to show based on Broker Mode
  const visibleAssets = brokerMode === BrokerMode.SIMULATION_CRYPTO 
     ? [AssetSymbol.BTCUSD, AssetSymbol.ETHUSD]
     : [AssetSymbol.XAUUSD, AssetSymbol.NAS100];

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-ios-blue/30">
      
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        currentMode={brokerMode}
        oandaConfig={oandaConfig}
        onSave={configureOanda}
      />

      {/* Main Scrollable Content */}
      <main className="pb-28 px-5 pt-14 max-w-lg mx-auto">
        
        {/* Premium Header */}
        <header className="mb-8">
          <div className="flex justify-between items-start mb-2">
             <span className="text-sm font-semibold text-ios-gray uppercase tracking-wide">Total Equity</span>
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
            £{account.equity.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h1>
          
          {/* Daily PnL Badge */}
          <div className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-bold ${isPositiveDay ? 'bg-ios-green/15 text-ios-green' : 'bg-ios-red/15 text-ios-red'}`}>
            {isPositiveDay ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
            <span>
                £{Math.abs(account.dayPnL).toFixed(2)} ({((account.dayPnL / account.balance) * 100).toFixed(2)}%)
            </span>
            <span className="ml-1 opacity-60 font-medium text-xs">Today</span>
          </div>
        </header>

        {view === 'dashboard' ? (
          <div className="space-y-6 animate-fade-in">
             {/* Available Margin Mini-Stat */}
             <div className="flex items-center justify-between bg-ios-card px-4 py-3 rounded-2xl border border-white/5">
                <div className="flex items-center gap-2 text-ios-gray text-sm font-medium">
                    <Wallet size={16} />
                    <span>Free Margin</span>
                </div>
                <span className="text-white font-bold tabular-nums">
                    £{account.balance.toLocaleString('en-GB', { minimumFractionDigits: 0 })}
                </span>
             </div>
            
             {/* Broker Status Banner (Only if Oanda) */}
             {brokerMode === BrokerMode.OANDA_PAPER && (
                <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 text-center">
                    <p className="text-xs text-orange-400 font-semibold">Broker: OANDA Paper Trading</p>
                </div>
             )}

             <div>
                <h2 className="text-xl font-bold text-white mb-4">
                    {brokerMode === BrokerMode.SIMULATION_CRYPTO ? 'Live Crypto Markets' : 'Forex / CFDs'}
                </h2>
                
                {visibleAssets.map(symbol => (
                    <AssetCard 
                        key={symbol}
                        asset={assets[symbol]} 
                        toggleBot={toggleBot} 
                        setStrategy={setStrategy}
                    />
                ))}
             </div>
          </div>
        ) : (
          <div className="animate-fade-in">
            <TradeHistory trades={trades} />
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
          onClick={() => setView('history')}
          className={`flex flex-col items-center justify-center w-16 h-full gap-1 transition-all duration-300 ${view === 'history' ? 'text-ios-blue' : 'text-neutral-500'}`}
        >
          <Clock size={24} strokeWidth={view === 'history' ? 2.5 : 2} />
        </button>
      </div>
      
      {/* Background Ambience */}
      <div className="fixed top-0 left-0 right-0 h-96 bg-gradient-to-b from-indigo-900/20 to-transparent pointer-events-none -z-10" />
    </div>
  );
};

export default App;
