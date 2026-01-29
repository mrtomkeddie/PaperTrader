import React from 'react';
import { Trade, TimeFilter } from '../types';
import { formatDate, formatNumber } from '../utils/formatters';

interface Props {
    trades: Trade[];
    onSelectTrade: (trade: Trade) => void;
    selectedTradeId?: string | null;
}

// PositionsTable is now a pure table renderer, container handled by parent
const PositionsTable: React.FC<Props> = ({ trades, onSelectTrade, selectedTradeId }) => {
    const safeTrades = trades || [];
    // Since App.tsx filters trades, we just render what's passed
    const displayTrades = safeTrades.sort((a, b) => b.openTime - a.openTime);



    const renderDesktopTable = (data: Trade[], title: string, isHistory: boolean = false) => (
        <div className="mb-0">
            {/* Title removed, handled by parent */}
            <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-premium-bg/50 backdrop-blur-sm z-10">
                        <tr className="border-b border-premium-border text-xs font-bold text-gray-500 uppercase tracking-wider">
                            <th className="py-3 px-4">Type</th>
                            <th className="py-3 px-4">Entry</th>
                            <th className="py-3 px-4">Qty</th>
                            <th className="py-3 px-4">Realized</th>
                            <th className="py-3 px-4">Floating</th>
                            <th className="py-3 px-4">Open Time</th>
                            {isHistory && <th className="py-3 px-4">Close Time</th>}
                        </tr>
                    </thead>
                    <tbody className="text-sm font-medium">
                        {data.map(trade => {
                            const realized = trade.pnl || 0;
                            const floating = trade.status === 'OPEN' ? (trade.floatingPnl || 0) : 0;
                            const isSelected = selectedTradeId === trade.id;

                            return (
                                <tr
                                    key={trade.id}
                                    onClick={() => onSelectTrade(trade)}
                                    className={`border-b border-white/5 cursor-pointer transition-colors ${isSelected ? 'bg-white/10' : 'hover:bg-white/5'}`}
                                >
                                    <td className={`py-3 px-4 font-bold ${trade.type === 'BUY' ? 'text-premium-green/90' : 'text-premium-red/90'}`}>{trade.type}</td>
                                    <td className="py-3 px-4 text-gray-300 font-mono">{formatNumber(trade?.entryPrice, 2)}</td>
                                    <td className="py-3 px-4 text-gray-300 font-mono">{formatNumber(trade?.currentSize, 2)}</td>
                                    <td className={`py-3 px-4 font-mono ${realized >= 0 ? 'text-premium-green' : 'text-premium-red'}`}>
                                        {realized >= 0 ? '+' : ''}{formatNumber(realized, 2)}
                                    </td>
                                    <td className={`py-3 px-4 font-mono ${floating >= 0 ? 'text-premium-green shadow-glow-green' : 'text-premium-red'}`}>
                                        {trade?.status === 'OPEN' ? (floating >= 0 ? '+' : '') + formatNumber(floating, 2) : '-'}
                                    </td>
                                    <td className="py-3 px-4 text-gray-500 text-xs font-mono">
                                        {formatDate(trade.openTime, 'en-GB', {
                                            day: '2-digit',
                                            month: '2-digit',
                                            year: '2-digit',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </td>
                                    {isHistory && (
                                        <td className="py-3 px-4 text-gray-500 text-xs font-mono">
                                            {trade.status === 'CLOSED' && trade.closeTime ? formatDate(trade.closeTime, 'en-GB', {
                                                day: '2-digit',
                                                month: '2-digit',
                                                year: '2-digit',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            }) : '-'}
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderMobileCard = (trade: Trade) => {
        const realized = trade.pnl || 0;
        const floating = trade.status === 'OPEN' ? (trade.floatingPnl || 0) : 0;
        const isSelected = selectedTradeId === trade.id;

        return (
            <div
                key={trade.id}
                onClick={() => onSelectTrade(trade)}
                className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer mb-3 ${isSelected ? 'bg-white/10 border-white/20 shadow-lg' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
            >
                <div className="flex justify-between items-center mb-3">
                    <div className="flex flex-col items-start gap-1">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${trade.type === 'BUY' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                            {trade.type}
                        </span>
                        <span className="text-[10px] text-gray-500 font-mono">
                            O: {formatDate(trade.openTime, 'en-GB', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                            })}
                        </span>
                        {trade.status === 'CLOSED' && trade.closeTime && (
                            <span className="text-[10px] text-gray-500 font-mono">
                                C: {formatDate(trade.closeTime, 'en-GB', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}
                            </span>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className={`bg-black/20 rounded-lg p-2 border ${realized >= 0 ? 'border-green-500/10' : 'border-red-500/10'}`}>
                        <div className="text-gray-500 mb-1 text-center uppercase text-[10px] font-bold">Realized</div>
                        <div className={`font-bold font-mono text-center text-sm ${realized >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {realized >= 0 ? '+' : ''}{formatNumber(realized, 2)}
                        </div>
                    </div>

                    <div className={`bg-black/20 rounded-lg p-2 border ${floating >= 0 ? 'border-green-500/10' : 'border-red-500/10'} ${trade.status === 'CLOSED' ? 'opacity-30' : ''}`}>
                        <div className="text-gray-500 mb-1 text-center uppercase text-[10px] font-bold">Floating</div>
                        <div className={`font-bold font-mono text-center text-sm ${floating >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {trade.status === 'OPEN' ? (floating >= 0 ? '+' : '') + formatNumber(floating, 2) : '-'}
                        </div>
                    </div>
                </div>

                <div className="flex justify-between mt-3 text-[10px] text-gray-500 font-mono px-1">
                    <span>Lot: {formatNumber(trade.currentSize, 2)}</span>
                    <span>@{formatNumber(trade.entryPrice, 2)}</span>
                </div>
            </div>
        );
    };

    return (
        <div className="h-full flex flex-col">
            {/* Legacy container removed */}
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {/* Desktop View */}
                <div className="hidden md:block">
                    {displayTrades.length > 0 ? renderDesktopTable(displayTrades, "", false) : (
                        <div className="py-20 text-center text-gray-600 font-mono text-sm tracking-widest animate-pulse">NO ACTIVE TRADES</div>
                    )}
                </div>

                {/* Mobile View */}
                <div className="md:hidden">
                    {displayTrades.length > 0 ? (
                        <div className="mb-6">
                            {displayTrades.map(renderMobileCard)}
                        </div>
                    ) : (
                        <div className="py-12 text-center text-gray-600 italic">No active trades</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PositionsTable;
