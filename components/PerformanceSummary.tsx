
import React, { useState, useMemo } from 'react';
import { Trade, TimeFilter } from '../types';
import { Calendar, TrendingUp, Percent, BarChart3 } from 'lucide-react';

interface Props {
  trades: Trade[];
}

const PerformanceSummary: React.FC<Props> = ({ trades }) => {
  const [filter, setFilter] = useState<TimeFilter>('TODAY');

  const stats = useMemo(() => {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    
    const filteredTrades = trades.filter(t => {
        if (t.status === 'OPEN') return false; // Only count closed trades for stats
        if (!t.closeTime) return false;
        
        switch (filter) {
            case 'TODAY': return (now - t.closeTime) < oneDay;
            case 'WEEK': return (now - t.closeTime) < (oneDay * 7);
            case 'MONTH': return (now - t.closeTime) < (oneDay * 30);
            case 'ALL': return true;
            default: return true;
        }
    });

    const totalTrades = filteredTrades.length;
    const winningTrades = filteredTrades.filter(t => t.pnl > 0).length;
    const totalPnL = filteredTrades.reduce((acc, t) => acc + t.pnl, 0);
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    
    return { totalTrades, winningTrades, totalPnL, winRate };
  }, [trades, filter]);

  const isPositive = stats.totalPnL >= 0;

  return (
    <div className="bg-ios-card rounded-[22px] p-5 mb-6 border border-white/5 shadow-xl">
        {/* Header & Filter */}
        <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <BarChart3 size={16} className="text-ios-blue" />
                Performance
            </h3>
            
            <div className="flex bg-black/40 rounded-lg p-0.5">
                {(['TODAY', 'WEEK', 'MONTH', 'ALL'] as TimeFilter[]).map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-2.5 py-1 text-[10px] font-bold rounded-[6px] transition-all ${filter === f ? 'bg-[#636366] text-white shadow' : 'text-neutral-500 hover:text-neutral-300'}`}
                    >
                        {f}
                    </button>
                ))}
            </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
            {/* Net PnL */}
            <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                <span className="text-[10px] text-ios-gray uppercase font-semibold block mb-1">Net P&L</span>
                <div className={`text-2xl font-bold tabular-nums tracking-tight ${isPositive ? 'text-ios-green' : 'text-ios-red'}`}>
                    {isPositive ? '+' : ''}{stats.totalPnL.toFixed(2)}
                </div>
            </div>

            {/* Win Rate */}
            <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                <span className="text-[10px] text-ios-gray uppercase font-semibold block mb-1">Win Rate</span>
                <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-white tabular-nums">{stats.winRate.toFixed(0)}</span>
                    <span className="text-sm text-ios-gray font-medium">%</span>
                </div>
            </div>

            {/* Trade Count */}
            <div className="bg-white/5 rounded-xl p-3 border border-white/5 col-span-2 flex justify-between items-center">
                <div>
                    <span className="text-[10px] text-ios-gray uppercase font-semibold block">Total Trades</span>
                    <span className="text-lg font-bold text-white">{stats.totalTrades}</span>
                </div>
                <div className="flex gap-3 text-xs font-medium">
                    <span className="text-ios-green">{stats.winningTrades} Wins</span>
                    <span className="text-white/20">|</span>
                    <span className="text-ios-red">{stats.totalTrades - stats.winningTrades} Losses</span>
                </div>
            </div>
        </div>
    </div>
  );
};

export default PerformanceSummary;
