import React from 'react';
import { Trade } from '../types';

interface Props {
    trades: Trade[];
    onSelectTrade: (trade: Trade) => void;
    selectedTradeId?: string | null;
}

const PositionsTable: React.FC<Props> = ({ trades, onSelectTrade, selectedTradeId }) => {
    const openTrades = trades.filter(t => t.status === 'OPEN').sort((a, b) => b.openTime - a.openTime);
    const closedTrades = trades.filter(t => t.status !== 'OPEN').sort((a, b) => (b.closeTime || 0) - (a.closeTime || 0)).slice(0, 50);

    const renderDesktopTable = (data: Trade[], title: string) => (
        <div className="mb-6">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 sticky top-0 bg-[#13141b] z-10 py-2">{title}</h4>
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-white/5 text-xs font-bold text-gray-500 uppercase tracking-wider">
                            <th className="py-3 px-4">Type</th>
                            <th className="py-3 px-4">Symbol</th>
                            <th className="py-3 px-4">Entry</th>
                            <th className="py-3 px-4">Qty</th>
                            <th className="py-3 px-4">P&L</th>
                            <th className="py-3 px-4">Time</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm font-medium">
                        {data.map(trade => {
                            const isProfit = (trade.pnl || trade.floatingPnl || 0) >= 0;
                            const pnlVal = trade.status === 'OPEN' ? (trade.floatingPnl || 0) : trade.pnl;
                            const isSelected = selectedTradeId === trade.id;
                            
                            return (
                                <tr 
                                    key={trade.id} 
                                    onClick={() => onSelectTrade(trade)}
                                    className={`border-b border-white/5 cursor-pointer transition-colors ${isSelected ? 'bg-white/10' : 'hover:bg-white/5'}`}
                                >
                                    <td className={`py-3 px-4 ${trade.type === 'BUY' ? 'text-green-500' : 'text-red-500'}`}>{trade.type}</td>
                                    <td className="py-3 px-4 text-white font-bold">{trade.symbol}</td>
                                    <td className="py-3 px-4 text-gray-300">{trade.entryPrice.toFixed(2)}</td>
                                    <td className="py-3 px-4 text-gray-300">{trade.currentSize.toFixed(2)}</td>
                                    <td className={`py-3 px-4 ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
                                        {isProfit ? '+' : ''}{pnlVal.toFixed(2)}
                                    </td>
                                    <td className="py-3 px-4 text-gray-500 text-xs font-mono">
                                        {new Date(trade.closeTime || trade.openTime).toLocaleString('en-GB', {
                                            day: '2-digit',
                                            month: '2-digit',
                                            year: '2-digit',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderMobileCard = (trade: Trade) => {
        const isProfit = (trade.pnl || trade.floatingPnl || 0) >= 0;
        const pnlVal = trade.status === 'OPEN' ? (trade.floatingPnl || 0) : trade.pnl;
        const isSelected = selectedTradeId === trade.id;
        
        return (
            <div 
                key={trade.id}
                onClick={() => onSelectTrade(trade)}
                className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer mb-3 ${isSelected ? 'bg-white/10 border-white/20 shadow-lg' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
            >
                <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-lg">{trade.symbol}</span>
                        <span className="text-[10px] text-gray-500 font-mono">
                            {new Date(trade.closeTime || trade.openTime).toLocaleString('en-GB', {
                                day: '2-digit',
                                month: '2-digit',
                                year: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                            })}
                        </span>
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${trade.type === 'BUY' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {trade.type}
                    </span>
                </div>
                
                <div className="grid grid-cols-3 gap-4 text-xs">
                    <div className="bg-black/20 rounded-lg p-2 border border-white/5">
                        <div className="text-gray-500 mb-1">Entry</div>
                        <div className="text-white font-mono">{trade.entryPrice.toFixed(2)}</div>
                    </div>
                    <div className="bg-black/20 rounded-lg p-2 border border-white/5">
                        <div className="text-gray-500 mb-1">Size</div>
                        <div className="text-white font-mono">{trade.currentSize.toFixed(2)}</div>
                    </div>
                    <div className={`bg-black/20 rounded-lg p-2 border ${isProfit ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
                        <div className="text-gray-500 mb-1 text-right">P&L</div>
                        <div className={`font-bold font-mono text-right ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
                            {isProfit ? '+' : ''}{pnlVal.toFixed(2)}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="bg-[#13141b] rounded-2xl p-4 md:p-6 border border-white/5 h-full flex flex-col">
            <h3 className="text-lg font-bold text-white mb-4 flex justify-between items-center">
                <span>Positions</span>
                <span className="text-xs font-normal text-gray-500">
                    {openTrades.length} Active | {closedTrades.length} Recent
                </span>
            </h3>
            
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {/* Desktop View */}
                <div className="hidden md:block">
                    {openTrades.length > 0 && renderDesktopTable(openTrades, "Open Positions")}
                    {closedTrades.length > 0 && renderDesktopTable(closedTrades, "History")}
                    {openTrades.length === 0 && closedTrades.length === 0 && (
                        <div className="py-12 text-center text-gray-600 italic">No trades found</div>
                    )}
                </div>

                {/* Mobile View */}
                <div className="md:hidden">
                    {openTrades.length > 0 && (
                        <div className="mb-6">
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Open Positions</h4>
                            {openTrades.map(renderMobileCard)}
                        </div>
                    )}
                    
                    {closedTrades.length > 0 && (
                        <div>
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">History</h4>
                            {closedTrades.map(renderMobileCard)}
                        </div>
                    )}

                    {openTrades.length === 0 && closedTrades.length === 0 && (
                        <div className="py-12 text-center text-gray-600 italic">No trades found</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PositionsTable;
