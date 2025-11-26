import React, { useState } from 'react';
import { Trade, TradeType, StrategyType } from '../types';
import { DEFAULT_REMOTE_URL } from '../constants';
import { Clock, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import TradeDetailModal from './TradeDetailModal';
import PerformanceSummary from './PerformanceSummary';

interface Props {
  trades: Trade[];
}

const getStrategyBadge = (strategy: StrategyType) => {
  switch (strategy) {
    case StrategyType.TREND_FOLLOW:
      return { label: 'TREND', className: 'bg-orange-500/15 text-orange-400 border-orange-500/20' };
    case StrategyType.LONDON_SWEEP:
      return { label: 'LDN SWEEP', className: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20' };
    case StrategyType.LONDON_CONTINUATION:
      return { label: 'LDN CONT', className: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20' };
    case StrategyType.NY_ORB:
      return { label: 'NY ORB', className: 'bg-blue-500/15 text-blue-400 border-blue-500/20' };
    case StrategyType.AI_AGENT:
      return { label: 'GEMINI', className: 'bg-purple-500/15 text-purple-300 border-purple-500/20' };
    default:
      return { label: 'MANUAL', className: 'bg-gray-500/20 text-gray-300 border-gray-500/20' };
  }
};

interface TradeRowProps {
  trade: Trade;
  onSelect: (trade: Trade) => void;
}

const TradeRow: React.FC<TradeRowProps> = ({ trade, onSelect }) => {
  const isProfit = (trade.pnl || 0) >= 0;
  const isOpen = trade.status === 'OPEN';
  const badge = getStrategyBadge(trade.strategy);

  return (
    <div 
        onClick={() => onSelect(trade)}
        className="p-4 flex justify-between items-center active:bg-white/5 transition-colors cursor-pointer group border-b border-white/5 last:border-0"
    >
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold ${trade.type === TradeType.BUY ? 'bg-ios-blue/20 text-ios-blue' : 'bg-ios-red/20 text-ios-red'}`}>
          {trade.type === TradeType.BUY ? 'B' : 'S'}
        </div>
        <div>
          <div className="flex items-center gap-2">
              <span className="text-base font-bold text-white">{trade.symbol}</span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded border font-semibold tracking-wide uppercase ${badge.className}`}>
                  {badge.label}
              </span>
          </div>
          <div className="text-xs text-ios-gray tabular-nums mt-0.5 flex items-center gap-1">
            <span>@ {trade.entryPrice.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <div className="text-right">
          {isOpen ? (
            <div className="flex flex-col items-end">
               <div className="bg-ios-blue text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse mb-0.5">
                    OPEN
               </div>
               <span className={`text-xs font-bold tabular-nums ${(trade.floatingPnl || 0) >= 0 ? 'text-ios-green' : 'text-ios-red'}`}>
                  {(trade.floatingPnl || 0) >= 0 ? '+' : ''}{(trade.floatingPnl || 0).toFixed(2)}
               </span>
            </div>
          ) : (
            <div className={`text-base font-bold tabular-nums ${isProfit ? 'text-ios-green' : 'text-ios-red'}`}>
              {isProfit ? '+' : ''}{trade.pnl?.toFixed(2)}
            </div>
          )}
          <div className="text-[10px] text-ios-gray mt-0.5">
            {new Date(trade.openTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
          </div>
        </div>
        <ChevronRight size={16} className="text-white/20 group-hover:text-white/50 transition-colors" />
      </div>
    </div>
  );
};

const TradeHistory: React.FC<Props> = ({ trades }) => {
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [symbolFilter, setSymbolFilter] = useState<'ALL' | string>('ALL');
  const [strategyFilter, setStrategyFilter] = useState<'ALL' | StrategyType>('ALL');
  const [activeOpen, setActiveOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(true);

  const filteredTrades = trades.filter(t => {
    const symbolOk = symbolFilter === 'ALL' ? true : t.symbol === symbolFilter;
    const strategyOk = strategyFilter === 'ALL' ? true : t.strategy === strategyFilter;
    return symbolOk && strategyOk;
  });
  const activeTrades = filteredTrades.filter(t => t.status === 'OPEN');
  const closedTrades = filteredTrades.filter(t => t.status === 'CLOSED');

  if (trades.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-ios-gray">
        <Clock className="w-12 h-12 mb-4 opacity-20" strokeWidth={1} />
        <p className="text-sm font-medium">No trades in this account</p>
      </div>
    );
  }

  return (
    <>
      <div className="pb-24 lg:pb-0">
        <div className="space-y-5 mb-6">
          {/* Symbol Filters */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
               <h3 className="text-[10px] font-bold text-ios-gray uppercase tracking-wider">Asset</h3>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2 [&::-webkit-scrollbar]:hidden">
              {(['ALL', ...Array.from(new Set(trades.map(t => t.symbol)))] as const).map(opt => (
                <button
                  key={String(opt)}
                  onClick={() => setSymbolFilter(String(opt))}
                  className={`px-4 py-2 text-xs font-bold rounded-full transition-all whitespace-nowrap border ${
                    symbolFilter === String(opt) 
                      ? 'bg-white text-black border-white shadow-lg shadow-white/10 scale-105' 
                      : 'bg-white/5 text-ios-gray border-white/5 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {String(opt) === 'ALL' ? 'All Assets' : String(opt)}
                </button>
              ))}
            </div>
          </div>

          {/* Strategy Filters */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
               <h3 className="text-[10px] font-bold text-ios-gray uppercase tracking-wider">Strategy</h3>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2 [&::-webkit-scrollbar]:hidden">
              {(['ALL', ...Array.from(new Set(trades.map(t => t.strategy).filter(Boolean)))] as (('ALL'|StrategyType)[])).map(opt => (
                <button
                  key={String(opt)}
                  onClick={() => setStrategyFilter(opt as StrategyType | 'ALL')}
                  className={`px-4 py-2 text-xs font-bold rounded-full transition-all whitespace-nowrap border ${
                    strategyFilter === opt 
                      ? 'bg-white text-black border-white shadow-lg shadow-white/10 scale-105' 
                      : 'bg-white/5 text-ios-gray border-white/5 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {opt === 'ALL' ? 'All Strategies' : getStrategyBadge(opt as StrategyType).label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <PerformanceSummary trades={closedTrades} />

        {/* Active Trades Section */}
        {activeTrades.length > 0 && (
            <div className="mb-6">
                <div className="flex items-center justify-between mb-2 px-2">
                    <h3 className="text-sm font-bold text-ios-gray uppercase tracking-wider">Active Positions</h3>
                    <button onClick={() => setActiveOpen(!activeOpen)} className="text-xs text-ios-gray hover:text-white flex items-center gap-1 px-2 py-1 rounded">
                        {activeOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        {activeOpen ? 'Hide' : 'Show'}
                    </button>
                </div>
                {activeOpen && (
                    <div className="bg-ios-card rounded-[20px] overflow-hidden border border-white/5">
                        {activeTrades.map(trade => <TradeRow key={trade.id} trade={trade} onSelect={setSelectedTrade} />)}
                    </div>
                )}
            </div>
        )}

        {/* History Section */}
        <div>
            <div className="flex items-center justify-between mb-2 px-2">
                <h3 className="text-sm font-bold text-ios-gray uppercase tracking-wider">Past Trades</h3>
                <button onClick={() => setHistoryOpen(!historyOpen)} className="text-xs text-ios-gray hover:text-white flex items-center gap-1 px-2 py-1 rounded">
                    {historyOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    {historyOpen ? 'Hide' : 'Show'}
                </button>
            </div>
            {historyOpen && (
                <div className="bg-ios-card rounded-[20px] overflow-hidden border border-white/5">
                    {closedTrades.length > 0 ? (
                        closedTrades.map(trade => <TradeRow key={trade.id} trade={trade} onSelect={setSelectedTrade} />)
                    ) : (
                        <div className="p-6 text-center text-xs text-ios-gray">No closed history</div>
                    )}
                </div>
            )}
        </div>
      </div>

      {/* Detail Modal */}
      <TradeDetailModal 
         trade={selectedTrade} 
         onClose={() => setSelectedTrade(null)} 
      />
    </>
  );
};

export default TradeHistory;