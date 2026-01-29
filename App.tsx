import React, { useState, Component, ErrorInfo, ReactNode } from 'react';
import { useTradingEngine } from './hooks/useTradingEngine';
import DashboardHeader from './components/DashboardHeader';
import { AgentCard } from './components/AgentCard';
// NeuralFeed removed
import { TradingViewWidget } from './components/TradingViewWidget'; // Kept generic import but not used in visual
import SettingsModal from './components/SettingsModal';
import MobileHeader from './components/mobile/MobileHeader';
import { AssetSymbol, StrategyType, Trade } from './types';
import { DEFAULT_REMOTE_URL } from './constants';
import PositionsTable from './components/PositionsTable';
import { Layers, Receipt, History, AlertTriangle } from 'lucide-react';
import { TradeHistory } from './components/TradeHistory';

// --- Error Boundary ---
interface EBProps { children: ReactNode; }
interface EBState { hasError: boolean; error: Error | null; }

class ErrorBoundary extends Component<EBProps, EBState> {
  constructor(props: EBProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0a0b14] text-white flex flex-col items-center justify-center p-10 font-sans">
          <AlertTriangle className="w-16 h-16 text-red-500 mb-6 animate-pulse" />
          <h1 className="text-2xl font-bold mb-2 uppercase tracking-tighter">Neural System Failure</h1>
          <p className="text-gray-400 mb-8 max-w-md text-center">A critical error occurred in the trading interface. Remote logs have been captured.</p>
          <div className="bg-red-950/20 border border-red-900/50 rounded-lg p-6 w-full max-w-2xl overflow-auto">
            <pre className="text-red-400 text-xs font-mono whitespace-pre-wrap">
              {this.state.error?.stack || this.state.error?.message}
            </pre>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mt-8 px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-bold uppercase text-sm transition-colors"
          >
            Reboot System
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const AppContent: React.FC = () => {
  const { assets, account, accounts, decisions, trades, toggleBot, setStrategy, resetAccount, brokerMode, oandaConfig, configureOanda, isConnected, toggleMaster } = useTradingEngine();
  const [activeSymbol, setActiveSymbol] = useState<AssetSymbol>(AssetSymbol.XAUUSD);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false); // Desktop Toggle

  // Mobile Tabs: 'dashboard' | 'trades' | 'history'
  const [activeMobileTab, setActiveMobileTab] = useState<'dashboard' | 'trades' | 'history'>('dashboard');

  const activeAssetData = assets ? assets[activeSymbol] : null;

  // Prepare Agent Data for Rendering
  const agentList = accounts ? Object.values(accounts) : [];

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white font-sans selection:bg-cyan-500/30 flex flex-col">
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentMode={brokerMode}
        oandaConfig={oandaConfig}
        onSave={configureOanda}
        isIndicesConnected={isConnected}
      />

      {/* --- Desktop Header --- */}
      <div className="hidden md:block sticky top-0 z-50">
        <div className="flex justify-between items-center px-6 py-4 bg-[#0a0f1e]/95 backdrop-blur border-b border-gray-800 shadow-lg">
          <DashboardHeader
            account={account}
            accounts={accounts}
            assets={assets}
            toggleAsset={(s) => setActiveSymbol(s)}
            activeAsset={activeSymbol}
            onOpenSettings={() => setIsSettingsOpen(true)}
            toggleMaster={toggleMaster}
          />
          {/* Desktop View Toggle */}
          <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-800 ml-4">
            <button
              onClick={() => setShowHistory(false)}
              className={`px-3 py-1 rounded text-xs font-bold uppercase transition-all ${!showHistory ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-500 hover:text-gray-300'}`}
            >
              Terminal
            </button>
            <button
              onClick={() => setShowHistory(true)}
              className={`px-3 py-1 rounded text-xs font-bold uppercase transition-all ${showHistory ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-500 hover:text-gray-300'}`}
            >
              Trade History
            </button>
          </div>
        </div>
      </div>

      {/* --- Mobile Header --- */}
      <div className="md:hidden">
        <MobileHeader
          title={activeMobileTab === 'history' ? 'TRADE HISTORY' : 'TERMINAL'}
          account={account}
          onOpenSettings={() => setIsSettingsOpen(true)}
          activeAsset={activeSymbol}
        />
      </div>

      <main className="flex-1 relative">
        {/* --- DESKTOP LAYOUT (FLEXIBLE) --- */}
        <div className="hidden md:block p-6 max-w-[1920px] mx-auto space-y-6">
          {!showHistory ? (
            <>
              {/* ROW 1: AGENT CARDS */}
              <div className="grid grid-cols-3 gap-6">
                {['quant', 'macro', 'risk'].map(id => {
                  const agent = accounts?.[id];
                  return agent ? <AgentCard key={id} agent={agent} /> : (
                    <div key={id} className="bg-gray-900/50 border border-gray-800 rounded-xl animate-pulse h-32 flex items-center justify-center">
                      <span className="text-gray-600 font-mono text-sm">Initializing {id.toUpperCase()}...</span>
                    </div>
                  );
                })}
              </div>

              {/* ROW 2: MAIN CONTENT (Positions & Feed) */}
              <div className="grid grid-cols-12 gap-6 min-h-[600px]">

                {/* ACTIVE POSITIONS - Full Width */}
                <div className="col-span-12 bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden flex flex-col shadow-xl">
                  <div className="px-6 py-4 border-b border-gray-800 bg-gray-900/80 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      <Layers className="w-4 h-4 text-cyan-400" />
                      Active Positions
                    </h3>
                    <div className="text-xs font-mono text-cyan-500 bg-cyan-950/30 px-3 py-1 rounded border border-cyan-900/50">
                      OPEN PL: £{((trades || []).filter(t => t && t.status === 'OPEN').reduce((acc, t) => acc + (t.floatingPnl || 0), 0)).toFixed(2)}
                    </div>
                  </div>
                  <div className="flex-1 min-h-[500px]">
                    <PositionsTable trades={(trades || []).filter(t => t && t.status === 'OPEN')} onSelectTrade={() => { }} selectedTradeId={null} />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="animate-in fade-in zoom-in-95 duration-300 min-h-[80vh]">
              <TradeHistory trades={trades} />
            </div>
          )}
        </div>

        {/* --- MOBILE LAYOUT (STACKED / TABBED) --- */}
        <div className="md:hidden h-full overflow-y-auto pb-24 p-4 space-y-4">

          {/* DASHBOARD TAB */}
          {activeMobileTab === 'dashboard' && (
            <>
              {/* Agent Carousel (Scrollable Row) */}
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide snap-x">
                {['quant', 'macro', 'risk'].map(id => {
                  const agent = accounts?.[id];
                  return (
                    <div key={id} className="min-w-[85vw] snap-center">
                      {agent ? <AgentCard agent={agent} /> : <div className="h-40 bg-gray-900 rounded-xl animate-pulse" />}
                    </div>
                  );
                })}
              </div>

              <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 text-center text-gray-400 text-sm">
                Select a tab below to view details.
              </div>
            </>
          )}

          {/* FEED TAB removed */}

          {/* TRADES TAB */}
          {activeMobileTab === 'trades' && (
            <div className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800 min-h-[50vh]">
              <PositionsTable trades={(trades || []).filter(t => t && t.status === 'OPEN')} onSelectTrade={() => { }} selectedTradeId={null} />
            </div>
          )}

          {/* HISTORY TAB */}
          {activeMobileTab === 'history' && (
            <div className="h-full min-h-[70vh]">
              <TradeHistory trades={trades} />
            </div>
          )}

        </div>
      </main>

      {/* Mobile Bottom Nav Override */}
      <div className="md:hidden fixed bottom-0 w-full bg-[#0a0b14] border-t border-gray-800 flex justify-around p-4 z-50 safe-area-bottom">
        <button
          onClick={() => setActiveMobileTab('dashboard')}
          className={`flex flex-col items-center gap-1 ${activeMobileTab === 'dashboard' ? 'text-cyan-400' : 'text-gray-600'}`}
        >
          <LayoutDashboard size={20} />
          <span className="text-[10px] uppercase font-bold">Dash</span>
        </button>
        <button
          onClick={() => setActiveMobileTab('trades')}
          className={`flex flex-col items-center gap-1 ${activeMobileTab === 'trades' ? 'text-cyan-400' : 'text-gray-600'}`}
        >
          <Receipt size={20} />
          <span className="text-[10px] uppercase font-bold">Trades</span>
        </button>
        <button
          onClick={() => setActiveMobileTab('history')}
          className={`flex flex-col items-center gap-1 ${activeMobileTab === 'history' ? 'text-cyan-400' : 'text-gray-600'}`}
        >
          <History size={20} />
          <span className="text-[10px] uppercase font-bold">History</span>
        </button>
      </div>

    </div>
  );
};

// StartIcon Helper for Nav - defining it inline or importing
function LayoutDashboard({ size, className }: { size: number, className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" /><rect width="7" height="9" x="14" y="12" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" /></svg>
}

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
};

export default App;
