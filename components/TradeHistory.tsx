
import React, { useState } from 'react';
import { Trade, TradeType, StrategyType } from '../types';
import { Clock, ChevronRight } from 'lucide-react';
import TradeDetailModal from './TradeDetailModal';

interface Props {
  trades: Trade[];
}

const TradeHistory: React.FC<Props> = ({ trades }) => {
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);

  const getStrategyBadge = (strategy: StrategyType) => {
    switch (strategy) {
      case StrategyType.MOMENTUM:
        return { label: 'MOMENTUM', className: 'bg-orange-500/15 text-orange-400 border-orange-500/20' };
      case StrategyType.SWING:
        return { label: 'SWING', className: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20' };
      case StrategyType.AI_AGENT:
        return { label: 'GEMINI', className: 'bg-purple-500/15 text-purple-300 border-purple-500/20' };
      default:
        return { label: 'MANUAL', className: 'bg-gray-500/20 text-gray-300 border-gray-500/20' };
    }
  };

  if (trades.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-ios-gray">
        <Clock className="w-12 h-12 mb-4 opacity-20" strokeWidth={1} />
        <p className="text-sm font-medium">No trades executed yet</p>
      </div>
    );
  }

  return (
    <>
      <div className="pb-24">
        <div className="flex items-center justify-between mb-4 px-2">
          <h3 className="text-lg font-bold text-white">History</h3>
          <span className="text-xs text-ios-gray bg-white/10 px-2 py-1 rounded-full">{trades.length} Trades</span>
        </div>
        
        <div className="bg-ios-card rounded-[20px] overflow-hidden border border-white/5">
          {trades.map((trade, index) => {
            const isProfit = (trade.pnl || 0) >= 0;
            const isOpen = trade.status === 'OPEN';
            const isLast = index === trades.length - 1;
            const badge = getStrategyBadge(trade.strategy);
            
            return (
              <div key={trade.id}>
                <div 
                    onClick={() => setSelectedTrade(trade)}
                    className="p-4 flex justify-between items-center active:bg-white/5 transition-colors cursor-pointer group"
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
                        {trade.strategy === StrategyType.AI_AGENT && trade.entryReason && (
                          <span className="text-purple-300/50 truncate max-w-[100px] hidden sm:inline-block">• {trade.entryReason.split('(')[0]}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      {isOpen ? (
                        <div className="bg-ios-blue text-white text-[10px] font-bold px-2 py-1 rounded-full animate-pulse">
                            OPEN
                        </div>
                      ) : (
                        <div className={`text-base font-bold tabular-nums ${isProfit ? 'text-ios-green' : 'text-ios-red'}`}>
                          {isProfit ? '+' : ''}{trade.pnl?.toFixed(2)}
                        </div>
                      )}
                      <div className="text-[10px] text-ios-gray mt-1">
                        {new Date(trade.openTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-white/20 group-hover:text-white/50 transition-colors" />
                  </div>
                </div>
                {!isLast && <div className="h-[1px] bg-ios-separator ml-16 opacity-50" />} 
              </div>
            );
          })}
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
