import React from 'react';
import { Trade, TimeFilter } from '../types';
import { formatDate, formatNumber } from '../utils/formatters';

interface Props {
    trades: Trade[];
    onSelectTrade: (trade: Trade) => void;
    selectedTradeId?: string | null;
}

const PositionsTable: React.FC<Props> = ({ trades, onSelectTrade, selectedTradeId }) => {
    const safeTrades = trades || [];
    const displayTrades = safeTrades.sort((a, b) => b.openTime - a.openTime);

    return (
        <div className="h-full flex flex-col">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-black/40 text-[10px] text-gray-500 font-mono uppercase tracking-wider border-b border-white/5 sticky top-0 backdrop-blur-sm z-10">
                <div className="col-span-3 sm:col-span-2">Agent</div>
                <div className="col-span-2 sm:col-span-1">Type</div>
                <div className="hidden sm:block sm:col-span-2">Entry</div>
                <div className="hidden sm:block sm:col-span-1">Size</div>
                <div className="col-span-3 sm:col-span-2 text-right">Realized</div>
                <div className="col-span-4 sm:col-span-2 text-right">Floating</div>
                <div className="hidden sm:block sm:col-span-2 text-right">Time</div>
            </div>

            {/* Table Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-black/10">
                {displayTrades.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-gray-600 space-y-2 opacity-50">
                        <span className="text-xs font-mono font-bold text-gray-500 tracking-[0.2em] animate-pulse">
                            NO_ACTIVE_TRADES
                        </span>
                    </div>
                ) : (
                    displayTrades.map((trade) => {
                        const realized = trade.pnl || 0;
                        const floating = trade.status === 'OPEN' ? (trade.floatingPnl || 0) : 0;
                        const isSelected = selectedTradeId === trade.id;

                        return (
                            <div
                                key={trade.id}
                                onClick={() => onSelectTrade(trade)}
                                className={`grid grid-cols-12 gap-4 px-6 py-3 border-b border-white/5 cursor-pointer transition-all duration-200 group text-xs font-mono items-center relative ${isSelected ? 'bg-white/10' : 'hover:bg-white/[0.03]'}`}
                            >
                                {/* Hover Highlight Line */}
                                <div className={`absolute left-0 top-0 bottom-0 w-[2px] opacity-0 group-hover:opacity-100 transition-opacity ${trade.type === 'BUY' ? 'bg-premium-green' : 'bg-premium-red'}`} />

                                {/* Agent */}
                                <div className="col-span-3 sm:col-span-2 flex items-center gap-2">
                                    <div className={`w-1.5 h-1.5 rounded-full ${trade.agentId === 'quant' ? 'bg-premium-cyan shadow-[0_0_5px_cyan]' : trade.agentId === 'macro' ? 'bg-premium-gold shadow-[0_0_5px_gold]' : 'bg-premium-red shadow-[0_0_5px_red]'}`} />
                                    <span className="uppercase tracking-wide text-[10px] opacity-80 text-gray-400 group-hover:text-gray-200">{trade.agentId ? trade.agentId.substring(0, 3) : 'MAN'}</span>
                                </div>

                                {/* Type */}
                                <div className={`col-span-2 sm:col-span-1 font-bold ${trade.type === 'BUY' ? 'text-premium-green drop-shadow-[0_0_3px_rgba(0,255,163,0.3)]' : 'text-premium-red drop-shadow-[0_0_3px_rgba(255,77,77,0.3)]'}`}>
                                    {trade.type}
                                </div>

                                {/* Entry */}
                                <div className="hidden sm:block sm:col-span-2 text-gray-400">
                                    {formatNumber(trade.entryPrice, 2)}
                                </div>

                                {/* Size */}
                                <div className="hidden sm:block sm:col-span-1 text-gray-500">
                                    {formatNumber(trade.currentSize, 2)}
                                </div>

                                {/* Realized */}
                                <div className={`col-span-3 sm:col-span-2 text-right ${realized >= 0 ? 'text-premium-green/70' : 'text-premium-red/70'}`}>
                                    {realized !== 0 ? (realized > 0 ? '+' : '') + formatNumber(realized, 1) : '-'}
                                </div>

                                {/* Floating */}
                                <div className={`col-span-4 sm:col-span-2 text-right font-bold ${floating >= 0 ? 'text-premium-green' : 'text-premium-red'}`}>
                                    {floating > 0 ? '+' : ''}{formatNumber(floating, 1)}
                                </div>

                                {/* Time */}
                                <div className="hidden sm:block sm:col-span-2 text-right text-gray-600 text-[10px]">
                                    {formatDate(trade.openTime, 'en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default PositionsTable;
