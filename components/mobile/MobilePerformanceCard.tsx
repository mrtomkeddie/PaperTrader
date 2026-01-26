import React, { useMemo } from 'react';
import { Trade } from '../../types';
import { BarChart3, TrendingUp, TrendingDown, Clock, CheckCircle2, XCircle } from 'lucide-react';

interface Props {
    trades: Trade[];
    filter?: 'TODAY' | 'WEEK' | 'MONTH' | 'ALL';
}

const MobilePerformanceCard: React.FC<Props> = ({ trades, filter = 'ALL' }) => {
    const stats = useMemo(() => {
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;

        const filteredTrades = trades.filter(t => {
            if (t.status === 'OPEN') return false;
            const time = t.closeTime || t.openTime || 0;

            // Basic time filtering
            if (filter === 'TODAY') {
                const tradeDate = new Date(time);
                const currentDate = new Date(now);
                return tradeDate.toDateString() === currentDate.toDateString();
            }
            if (filter === 'WEEK') return (now - time) < (oneDay * 7);
            if (filter === 'MONTH') return (now - time) < (oneDay * 30);

            return true;
        });

        const totalTrades = filteredTrades.length;
        const wins = filteredTrades.filter(t => t.pnl >= 0).length;
        const losses = filteredTrades.filter(t => t.pnl < 0).length;
        const winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0;
        const netPnL = filteredTrades.reduce((sum, t) => sum + t.pnl, 0);

        return { totalTrades, wins, losses, winRate, netPnL };
    }, [trades, filter]);

    return (
        <div className="bg-[#1c1c1e] rounded-[24px] p-5 border border-white/5 shadow-xl">
            {/* Header / Main Stat */}
            <div className="flex justify-between items-start mb-6">
                <div>
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                        <BarChart3 size={12} /> Net P&L ({filter})
                    </div>
                    <div className={`text-3xl font-bold tracking-tight ${stats.netPnL >= 0 ? 'text-white' : 'text-red-500'}`}>
                        {stats.netPnL >= 0 ? '+' : ''}£{stats.netPnL.toFixed(2)}
                    </div>
                </div>
                <div className={`px-2 py-1 rounded-lg border flex items-center gap-1 ${stats.netPnL >= 0
                        ? 'border-[#ccff00]/20 bg-[#ccff00]/10 text-[#ccff00]'
                        : 'border-red-500/20 bg-red-500/10 text-red-500'
                    }`}>
                    {stats.netPnL >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    <span className="text-xs font-bold">{stats.winRate}% WR</span>
                </div>
            </div>

            {/* Grid Stats */}
            <div className="grid grid-cols-2 gap-3">
                {/* Wins Card */}
                <div className="bg-[#2c2c2e] rounded-xl p-3 border border-white/5 relative overflow-hidden group">
                    <div className="absolute top-2 right-2 text-green-500/20 group-hover:text-green-500/40 transition-colors">
                        <CheckCircle2 size={32} />
                    </div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Winning Trades</div>
                    <div className="text-xl font-bold text-white flex items-baseline gap-1">
                        {stats.wins} <span className="text-[10px] text-gray-500 font-normal">/ {stats.totalTrades}</span>
                    </div>
                    <div className="h-1 w-full bg-white/5 rounded-full mt-2 overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: `${stats.winRate}%` }} />
                    </div>
                </div>

                {/* Losses Card */}
                <div className="bg-[#2c2c2e] rounded-xl p-3 border border-white/5 relative overflow-hidden group">
                    <div className="absolute top-2 right-2 text-red-500/20 group-hover:text-red-500/40 transition-colors">
                        <XCircle size={32} />
                    </div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Losing Trades</div>
                    <div className="text-xl font-bold text-white flex items-baseline gap-1">
                        {stats.losses} <span className="text-[10px] text-gray-500 font-normal">/ {stats.totalTrades}</span>
                    </div>
                    <div className="h-1 w-full bg-white/5 rounded-full mt-2 overflow-hidden">
                        <div className="h-full bg-red-500 rounded-full" style={{ width: `${100 - stats.winRate}%` }} />
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center text-[10px] text-gray-500 font-bold">
                <span className="flex items-center gap-1"><Clock size={10} /> UPDATED LIVE</span>
                <span>{stats.totalTrades} TOTAL EXECUTIONS</span>
            </div>
        </div>
    );
};

export default MobilePerformanceCard;
