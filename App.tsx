import React, { useState, Component, ErrorInfo, ReactNode } from 'react';
import { useTradingEngine } from './hooks/useTradingEngine';
import DashboardHeader from './components/DashboardHeader';
import { AgentCard } from './components/AgentCard';
// NeuralFeed removed
import { TradingViewWidget } from './components/TradingViewWidget'; // Kept generic import but not used in visual
import SettingsModal from './components/SettingsModal';
import MobileHeader from './components/mobile/MobileHeader';
import { Sidebar } from './components/Sidebar';
import { AssetSymbol, StrategyType, Trade } from './types';
import { DEFAULT_REMOTE_URL } from './constants';
import PositionsTable from './components/PositionsTable';
import { Layers, Receipt, History, AlertTriangle } from 'lucide-react';
import { TradeHistory } from './components/TradeHistory';
import { GlassCard } from './components/ui/GlassCard';

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
          <h1 className="text-2xl font-bold mb-2 uppercase tracking-tighter text-premium-red">Neural System Failure</h1>
          <p className="text-gray-400 mb-8 max-w-md text-center">A critical error occurred in the trading interface. Remote logs have been captured.</p>
          <div className="bg-red-950/20 border border-red-900/50 rounded-lg p-6 w-full max-w-2xl overflow-auto font-mono text-xs text-red-400">
            <pre className="whitespace-pre-wrap">
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

  // Unified View State: 'dashboard' | 'history'
  const [activeView, setActiveView] = useState<'dashboard' | 'history' | 'settings'>('dashboard');

  // Mobile Tabs: 'dashboard' | 'trades' | 'history'
  const [activeMobileTab, setActiveMobileTab] = useState<'dashboard' | 'trades' | 'history'>('dashboard');

  const activeAssetData = assets ? assets[activeSymbol] : null; // activeSymbol likely redundant for now but keeping it

  return (
    <div className="min-h-screen bg-premium-bg text-white font-sans selection:bg-premium-cyan/30 flex md:flex-row flex-col bg-[url('/grid.svg')] bg-fixed">
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentMode={brokerMode}
        oandaConfig={oandaConfig}
        onSave={configureOanda}
        isIndicesConnected={isConnected}
      />

      {/* --- Desktop Sidebar --- */}
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* --- Mobile Header --- */}
      <div className="md:hidden">
        <MobileHeader
          title={activeMobileTab === 'history' ? 'TRADE HISTORY' : 'TERMINAL'}
          account={account}
          accounts={accounts}
          onOpenSettings={() => setIsSettingsOpen(true)}
          activeAsset={activeSymbol}
        />
      </div>

      <main className="flex-1 relative flex flex-col h-screen overflow-y-auto custom-scrollbar">

        {/* --- Desktop Status Header (Moved inside main content area) --- */}
        <div className="hidden md:block sticky top-0 z-40 px-6 py-4 bg-premium-bg/80 backdrop-blur-md border-b border-premium-border/50">
          <DashboardHeader
            account={account}
            accounts={accounts}
            assets={assets}
            toggleAsset={(s) => setActiveSymbol(s)}
            activeAsset={activeSymbol}
            onOpenSettings={() => setIsSettingsOpen(true)}
            toggleMaster={toggleMaster}
          />
        </div>

        {/* --- DESKTOP LAYOUT --- */}
        <div className="hidden md:block p-6 max-w-[1920px] mx-auto space-y-6 w-full">
          {activeView === 'dashboard' ? (
            <>
              {/* ROW 1: AGENT CARDS */}
              <div className="grid grid-cols-3 gap-6">
                {['quant', 'macro', 'risk'].map(id => {
                  const agent = accounts?.[id];
                  return agent ? <AgentCard key={id} agent={agent} /> : (
                    <GlassCard key={id} className="h-32 flex items-center justify-center animate-pulse">
                      <span className="text-gray-500 font-mono text-xs tracking-widest uppercase">Initializing {id}...</span>
                    </GlassCard>
                  );
                })}
              </div>

              {/* ROW 2: MAIN CONTENT (Positions) */}
              <div className="grid grid-cols-12 gap-6">
                {/* ACTIVE POSITIONS - Full Width */}
                <GlassCard className="col-span-12 flex flex-col min-h-[300px]">
                  <div className="px-6 py-4 border-b border-premium-border bg-premium-bg/40 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-premium-gold uppercase tracking-widest flex items-center gap-2">
                      <Layers className="w-4 h-4 text-premium-cyan" />
                      Active Positions
                    </h3>
                    <div className="text-xs font-mono text-premium-cyan bg-premium-cyan/10 px-3 py-1 rounded border border-premium-cyan/20 shadow-glow-cyan">
                      OPEN PL: £{((trades || []).filter(t => t && t.status === 'OPEN').reduce((acc, t) => acc + (t.floatingPnl || 0), 0)).toFixed(2)}
                    </div>
                  </div>
                  <div className="flex-1">
                    <PositionsTable trades={(trades || []).filter(t => t && t.status === 'OPEN')} onSelectTrade={() => { }} selectedTradeId={null} />
                  </div>
                </GlassCard>
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
      <div className="md:hidden fixed bottom-0 w-full bg-premium-bg/90 backdrop-blur-lg border-t border-premium-border flex justify-around p-4 z-50 safe-area-bottom">
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
