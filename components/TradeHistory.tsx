import React, { useState } from 'react';
import { Trade, TradeType, StrategyType, TimeFilter } from '../types';
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
    case StrategyType.MEAN_REVERT:
      return { label: 'MEANREV', className: 'bg-teal-500/15 text-teal-300 border-teal-500/20' };
    case StrategyType.LONDON_SWEEP:
      return { label: 'LDN SWEEP', className: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20' };
    case StrategyType.LONDON_CONTINUATION:
      return { label: 'LDN CONT', className: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20' };
    case StrategyType.NY_ORB:
      return { label: 'NY ORB', className: 'bg-blue-500/15 text-blue-400 border-blue-500/20' };
    case StrategyType.AI_AGENT:
      return { label: 'GEMINI', className: 'bg-purple-500/15 text-purple-300 border-purple-500/20' };
    case StrategyType.MANUAL:
      return { label: 'MANUAL', className: 'bg-gray-500/20 text-gray-300 border-gray-500/20' };
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
          <div className="text-[10px] text-ios-gray mt-0.5 flex flex-col items-end">
            <div>Open: {new Date(trade.openTime).toLocaleDateString([], {month: 'short', day: 'numeric'})} {new Date(trade.openTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
            {trade.status === 'CLOSED' && trade.closeTime && (
                <div>Close: {new Date(trade.closeTime).toLocaleDateString([], {month: 'short', day: 'numeric'})} {new Date(trade.closeTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
            )}
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
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('ALL');
  const [activeOpen, setActiveOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(true);

  const filteredTrades = trades.filter(t => {
    const symbolOk = symbolFilter === 'ALL' ? true : t.symbol === symbolFilter;
    const strategyOk = strategyFilter === 'ALL' ? true : t.strategy === strategyFilter;
    return symbolOk && strategyOk;
  });
  const activeTrades = filteredTrades.filter(t => t.status === 'OPEN');
  const closedTrades = filteredTrades
    .filter(t => t.status === 'CLOSED')
    .filter(t => {
      const now = Date.now();
      const oneDay = 24 * 60 * 60 * 1000;
      const time = (t.closeTime ?? t.openTime ?? 0) as number;
      if (time === 0 && timeFilter !== 'ALL') return false;
      switch (timeFilter) {
        case 'TODAY': {
          const tradeDate = new Date(time);
          const currentDate = new Date(now);
          return tradeDate.toDateString() === currentDate.toDateString();
        }
        case 'WEEK':
          return (now - time) < (oneDay * 7);
        case 'MONTH':
          return (now - time) < (oneDay * 30);
        case 'ALL':
        default:
          return true;
      }
    })
    .sort((a, b) => {
      const ta = (a.closeTime ?? a.openTime ?? 0) as number;
      const tb = (b.closeTime ?? b.openTime ?? 0) as number;
      return tb - ta;
    });

  if (filteredTrades.length === 0) {
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
        <div className="mb-3 px-2 flex items-center justify-between">
          <h3 className="text-sm font-bold text-ios-gray uppercase tracking-wider">Filter</h3>
          <div className="flex gap-2">
            {(() => { const allowed = Array.from(new Set(trades.map(t => t.symbol))); const opts = ['ALL', ...allowed.filter(s => trades.some(t => t.symbol === s))] as const; return opts; })().map(opt => (
              <button
                key={String(opt)}
                onClick={() => setSymbolFilter(String(opt))}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-[6px] transition-all ${symbolFilter === String(opt) ? 'bg-[#636366] text-white shadow' : 'text-neutral-500 hover:text-neutral-300'}`}
              >
                {String(opt) === 'ALL' ? 'All' : String(opt)}
              </button>
            ))}
          </div>
        </div>
        <div className="mb-3 px-2 flex items-center justify-between">
          <h3 className="text-sm font-bold text-ios-gray uppercase tracking-wider">Strategy</h3>
          <div className="flex gap-2">
            {(() => { const allowed = Object.values(StrategyType) as StrategyType[]; const opts: ('ALL' | StrategyType)[] = ['ALL', ...allowed.filter(s => trades.some(t => t.strategy === s))]; return opts; })().map(opt => (
              <button
                key={String(opt)}
                onClick={() => setStrategyFilter(opt as StrategyType | 'ALL')}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-[6px] transition-all ${strategyFilter === opt ? 'bg-[#636366] text-white shadow' : 'text-neutral-500 hover:text-neutral-300'}`}
              >
                {opt === 'ALL' ? 'All' : getStrategyBadge(opt as StrategyType).label}
              </button>
            ))}
          </div>
        </div>
        <div className="mb-3 px-2 flex items-center justify-between">
          <h3 className="text-sm font-bold text-ios-gray uppercase tracking-wider">Time</h3>
          <div className="flex gap-2">
            {(['TODAY', 'WEEK', 'MONTH', 'ALL'] as TimeFilter[]).map(opt => (
              <button
                key={opt}
                onClick={() => setTimeFilter(opt)}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-[6px] transition-all ${timeFilter === opt ? 'bg-[#636366] text-white shadow' : 'text-neutral-500 hover:text-neutral-300'}`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <PerformanceSummary 
          trades={closedTrades} 
          filter={timeFilter}
        />

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
