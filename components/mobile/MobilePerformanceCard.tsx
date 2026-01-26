import React, { useMemo } from 'react';
import { Trade } from '../../types';
import { BarChart2 } from 'lucide-react';

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
        <div className="bg-[#13141b] rounded-2xl p-5 border border-white/5 mb-6 shadow-xl">
            <div className="flex items-center gap-2 mb-4 text-xs font-bold text-gray-400">
                <BarChart2 size={14} /> Performance {filter !== 'ALL' && <span className="text-[9px] px-1.5 py-0.5 bg-white/5 rounded text-gray-500">{filter}</span>}
            </div>
            <div className="flex gap-4">
                <div className="bg-[#1C1C1E] rounded-xl p-3 border border-white/5 flex-1">
                    <div className="text-[9px] font-bold text-gray-500 uppercase mb-1">Net P&L</div>
                    <div className={`${stats.netPnL >= 0 ? 'text-green-500' : 'text-red-500'} font-bold text-lg`}>
                        {stats.netPnL >= 0 ? '+' : ''}{stats.netPnL.toFixed(2)}
                    </div>
                </div>
                <div className="bg-[#1C1C1E] rounded-xl p-3 border border-white/5 flex-1">
                    <div className="text-[9px] font-bold text-gray-500 uppercase mb-1">Win Rate</div>
                    <div className="text-white font-bold text-lg">{stats.winRate}<span className="text-xs text-gray-500">%</span></div>
                </div>
            </div>
            <div className="mt-4 flex justify-between items-center text-[10px] text-gray-500 font-bold border-t border-white/5 pt-3">
                <span>TOTAL TRADES</span>
                <div className="flex gap-3">
                    <span className="text-green-500">{stats.wins} Wins</span>
                    <span className="text-gray-700">|</span>
                    <span className="text-red-500">{stats.losses} Losses</span>
                </div>
            </div>
        </div>
    );
};

export default MobilePerformanceCard;
