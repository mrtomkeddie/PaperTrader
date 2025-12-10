import React, { useState } from 'react';
import { Trade, StrategyType } from '../../types';
import { BarChart2, ChevronRight } from 'lucide-react';

interface Props {
    trades: Trade[];
    onSelectTrade: (trade: Trade) => void;
}

const getStrategyLabel = (strategy: string) => {
    switch (strategy) {
        case StrategyType.NY_ORB: return 'NY ORB';
        case StrategyType.AI_AGENT: return 'Gemini AI';
        case StrategyType.TREND_FOLLOW: return 'Trend';
        case StrategyType.LONDON_SWEEP: return 'Ldn Sweep';
        case StrategyType.LONDON_CONTINUATION: return 'Ldn Cont';
        default: return strategy.replace(/_/g, ' ');
    }
};

const MobileTrades: React.FC<Props> = ({ trades, onSelectTrade }) => {
    const [activeFilter, setActiveFilter] = useState<'ALL' | 'NY ORB' | 'GEMINI'>('ALL');

    const openTrades = trades.filter(t => t.status === 'OPEN').sort((a, b) => b.openTime - a.openTime);
    
    const allClosedTrades = trades.filter(t => t.status !== 'OPEN');
    
    const filteredClosedTrades = allClosedTrades.filter(t => {
        if (activeFilter === 'ALL') return true;
        if (activeFilter === 'NY ORB') return t.strategy === StrategyType.NY_ORB;
        if (activeFilter === 'GEMINI') return t.strategy !== StrategyType.NY_ORB;
        return true;
    }).sort((a, b) => (b.closeTime || 0) - (a.closeTime || 0));

    const displayedTrades = filteredClosedTrades.slice(0, 20);

    // Calculate Performance Stats based on filtered trades
    const totalTrades = filteredClosedTrades.length;
    const wins = filteredClosedTrades.filter(t => t.pnl >= 0).length;
    const losses = filteredClosedTrades.filter(t => t.pnl < 0).length;
    const winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0;
    const netPnL = filteredClosedTrades.reduce((sum, t) => sum + t.pnl, 0);

    const TradeCard = ({ trade, isActive }: { trade: Trade, isActive?: boolean }) => {
        const pnl = isActive ? (trade.floatingPnl || 0) : trade.pnl;
        const isWin = pnl >= 0;
        
        return (
            <div 
                onClick={() => onSelectTrade(trade)}
                className="bg-[#13141b] rounded-2xl p-4 border border-white/5 mb-2 flex items-center justify-between active:scale-[0.98] transition-transform"
            >
                <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${isActive ? 'bg-blue-600 text-white' : 'bg-[#1C1C1E] text-gray-500 border border-white/5'}`}>
                        {trade.type === 'BUY' ? 'B' : 'S'}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">{trade.symbol}</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold ${trade.strategy === StrategyType.NY_ORB ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                                {getStrategyLabel(trade.strategy)}
                            </span>
                        </div>
                        <div className="text-[10px] text-gray-500 mt-0.5">@ {trade.entryPrice.toFixed(2)}</div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="text-right">
                        <div className={`text-sm font-bold font-mono ${isWin ? 'text-green-500' : 'text-red-500'}`}>
                            {isWin ? '+' : ''}{pnl.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-gray-500">
                            {new Date(trade.closeTime || trade.openTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>
                    </div>
                    <ChevronRight size={14} className="text-gray-700" />
                </div>
            </div>
        );
    };

    return (
        <div className="px-4 pb-24">
            {/* Filter Pills */}
            <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
                {(['ALL', 'NY ORB', 'GEMINI'] as const).map((f) => (
                    <button 
                        key={f} 
                        onClick={() => setActiveFilter(f)}
                        className={`px-4 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap transition-colors ${activeFilter === f ? 'bg-white text-black' : 'bg-[#1C1C1E] text-gray-500 border border-white/5'}`}
                    >
                        {f}
                    </button>
                ))}
            </div>

            {/* Performance Card */}
            <div className="bg-[#13141b] rounded-2xl p-5 border border-white/5 mb-6">
                <div className="flex items-center gap-2 mb-4 text-xs font-bold text-gray-400">
                    <BarChart2 size={14} /> Performance
                </div>
                <div className="flex gap-4">
                    <div className="bg-[#1C1C1E] rounded-xl p-3 border border-white/5 flex-1">
                        <div className="text-[9px] font-bold text-gray-500 uppercase mb-1">Net P&L</div>
                        <div className={`${netPnL >= 0 ? 'text-green-500' : 'text-red-500'} font-bold text-lg`}>
                            {netPnL >= 0 ? '+' : ''}{netPnL.toFixed(2)}
                        </div>
                    </div>
                    <div className="bg-[#1C1C1E] rounded-xl p-3 border border-white/5 flex-1">
                        <div className="text-[9px] font-bold text-gray-500 uppercase mb-1">Win Rate</div>
                        <div className="text-white font-bold text-lg">{winRate}<span className="text-xs text-gray-500">%</span></div>
                    </div>
                </div>
                <div className="mt-4 flex justify-between items-center text-[10px] text-gray-500 font-bold border-t border-white/5 pt-3">
                    <span>TOTAL TRADES</span>
                    <div className="flex gap-3">
                        <span className="text-green-500">{wins} Wins</span>
                        <span className="text-gray-700">|</span>
                        <span className="text-red-500">{losses} Losses</span>
                    </div>
                </div>
            </div>

            {/* Active Positions */}
            {openTrades.length > 0 && (
                <div className="mb-6">
                    <div className="flex justify-between items-center mb-2 px-1">
                        <h3 className="text-[10px] font-bold text-gray-500 uppercase">Active Positions</h3>
                        <button className="text-[10px] text-gray-600">Hide</button>
                    </div>
                    {openTrades.map(t => <TradeCard key={t.id} trade={t} isActive />)}
                </div>
            )}

            {/* Past Trades */}
            <div>
                <div className="flex justify-between items-center mb-2 px-1">
                    <h3 className="text-[10px] font-bold text-gray-500 uppercase">Past Trades</h3>
                    <button className="text-[10px] text-gray-600">Hide</button>
                </div>
                {displayedTrades.map(t => <TradeCard key={t.id} trade={t} />)}
                {displayedTrades.length === 0 && (
                    <div className="text-center py-8 text-gray-500 text-xs">No trades found</div>
                )}
            </div>
        </div>
    );
};

export default MobileTrades;
