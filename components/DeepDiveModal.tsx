import React from 'react';
import { createPortal } from 'react-dom';
import { X, Target, AlertTriangle, TrendingUp, TrendingDown, BrainCircuit, Activity, Zap, Repeat, CheckCircle2, Circle, Terminal } from 'lucide-react';
import { Trade, TradeType } from '../types';
import { formatDate, formatNumber, formatCurrency } from '../utils/formatters';

interface DeepDiveModalProps {
    isOpen: boolean;
    onClose: () => void;
    trade: Trade | null;
}

const DeepDiveModal: React.FC<DeepDiveModalProps> = ({ isOpen, onClose, trade }) => {
    if (!isOpen || !trade) return null;

    const isBuy = trade.type === TradeType.BUY;
    const isProfit = (trade.pnl || 0) >= 0;

    // Agent mapping for display
    const agentMap: Record<string, { name: string; icon: any; color: string }> = {
        quant: { name: 'Quant Agent', icon: Zap, color: 'text-cyan-400' },
        macro: { name: 'Macro Agent', icon: Activity, color: 'text-blue-400' },
        risk: { name: 'Risk Agent', icon: AlertTriangle, color: 'text-orange-400' },
    };

    const agent = agentMap[trade.agentId] || { name: trade.agentId.toUpperCase(), icon: Terminal, color: 'text-gray-400' };

    // Helper for result analysis text
    const getResultAnalysis = () => {
        if (trade.closeReason === 'STOP_LOSS') {
            if (trade.pnl && trade.pnl > 0) return "Closed by Trailing Stop. Although the final portion stopped out, partial profits were already banked.";
            return "Stop Loss Hit: The market reversed against our prediction. The trade was closed automatically to protect your capital.";
        }
        if (trade.pnl && trade.pnl > 0) {
            return "Trade complete. Targets were met and profits have been settled into your account.";
        }
        return "Trade cycle complete. The position has been closed and the result is final.";
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />

            <div
                className="bg-[#1C1C1E]/90 backdrop-blur-xl w-full max-w-sm md:max-w-4xl rounded-[28px] border border-white/10 shadow-2xl relative z-10 animate-fade-in-up max-h-[85vh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header - Fixed at top */}
                <div className="px-6 py-5 border-b border-white/5 flex justify-between items-center bg-gradient-to-b from-white/5 to-transparent shrink-0">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${isBuy ? 'bg-ios-blue/20 text-ios-blue' : 'bg-ios-red/20 text-ios-red'}`}>
                            {isBuy ? 'B' : 'S'}
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5">
                                <agent.icon size={12} className={agent.color} />
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${agent.color}`}>{agent.name}</span>
                            </div>
                            <h2 className="text-xl font-bold text-white tracking-tight">{trade.symbol}</h2>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
                        <X size={16} className="text-white" />
                    </button>
                </div>

                {/* Scrollable Content Area */}
                <div className="overflow-y-auto custom-scrollbar flex-1">
                    <div className="p-6 md:grid md:grid-cols-12 md:gap-8 space-y-6 md:space-y-0">

                        {/* LEFT COLUMN (Statistics) */}
                        <div className="md:col-span-4 space-y-6 md:border-r md:border-white/5 md:pr-8">
                            {/* PnL Hero */}
                            <div className="text-center md:text-left">
                                <span className="text-xs font-semibold uppercase tracking-wider text-ios-gray block mb-1">
                                    Realized Net Result
                                </span>
                                <span className={`text-4xl font-bold tabular-nums tracking-tight ${isProfit ? 'text-ios-green' : 'text-ios-red'}`}>
                                    {isProfit ? '+' : ''}{formatCurrency(trade.pnl)}
                                </span>
                                <div className="text-[10px] text-ios-gray mt-1 uppercase tracking-tighter">
                                    Closed {formatDate(trade.closeTime || trade.openTime, 'en-GB', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>

                            {/* Entry/Stop Data */}
                            <div className="grid grid-cols-2 md:grid-cols-1 gap-3 opacity-60">
                                <div className="bg-black/40 rounded-xl p-3 border border-white/5">
                                    <div className="flex items-center gap-1.5 text-ios-gray text-[9px] uppercase font-bold mb-1">
                                        <Target size={10} /> Entry Price
                                    </div>
                                    <span className="text-white font-mono text-xs">{formatNumber(trade.entryPrice, 2)}</span>
                                </div>
                                <div className="bg-black/40 rounded-xl p-3 border border-white/5">
                                    <div className="flex items-center gap-1.5 text-ios-gray text-[9px] uppercase font-bold mb-1">
                                        <AlertTriangle size={10} /> Stop Loss
                                    </div>
                                    <span className="text-white font-mono text-xs">{formatNumber(trade.stopLoss, 2)}</span>
                                </div>
                            </div>

                            <div className="bg-white/5 rounded-xl p-4 border border-white/5 hidden md:block">
                                <div className="text-[9px] text-ios-gray font-mono uppercase tracking-tighter mb-2">Trade UUID</div>
                                <div className="text-[10px] text-gray-500 font-mono break-all">{trade.id}</div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN (Context & Analysis) */}
                        <div className="md:col-span-8 space-y-6">
                            {/* Analysis Text */}
                            <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                                <p className="text-sm text-ios-gray leading-relaxed italic">
                                    {getResultAnalysis()}
                                </p>
                            </div>

                            <div className="grid md:grid-cols-2 gap-6">
                                {/* 3-Level Profit Ladder */}
                                <div className="space-y-3">
                                    <h4 className="text-[10px] uppercase font-bold text-ios-gray ml-1">Profit Ladder</h4>
                                    {trade.tpLevels && trade.tpLevels.length > 0 ? trade.tpLevels.map((level, idx) => (
                                        <div key={level.id} className={`flex items-center justify-between p-3 rounded-xl border ${level.hit ? 'bg-ios-green/10 border-ios-green/30' : 'bg-black/40 border-white/5'}`}>
                                            <div className="flex items-center gap-3">
                                                {level.hit ? <CheckCircle2 size={18} className="text-ios-green" /> : <Circle size={18} className="text-white/20" />}
                                                <div>
                                                    <div className="text-xs font-bold text-white">
                                                        {idx === 0 ? 'TP 1 (Bank)' : idx === 1 ? 'TP 2 (Target)' : 'TP 3 (Runner)'}
                                                    </div>
                                                    <div className="text-[10px] text-ios-gray">Close {level.percentage * 100}%</div>
                                                </div>
                                            </div>
                                            <span className={`font-mono text-xs ${level.hit ? 'text-ios-green font-bold line-through' : 'text-white/40'}`}>
                                                {formatNumber(level.price, 2)}
                                            </span>
                                        </div>
                                    )) : (
                                        <div className="text-center py-4 text-ios-gray text-xs italic border border-dashed border-white/10 rounded-xl">
                                            No TP levels captured.
                                        </div>
                                    )}
                                </div>

                                {/* Thinking Process */}
                                <div className="space-y-2">
                                    <h4 className="text-[10px] uppercase font-bold text-ios-gray ml-1">Thinking Process</h4>
                                    <div className="bg-white/5 rounded-2xl p-5 border border-white/5 shadow-inner h-full">
                                        <p className="text-xs text-gray-300 leading-relaxed italic">
                                            "{trade.entryReason || 'No reasoning captured for this node event.'}"
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer (Mobile Only basically, but keep for verifying stats) */}
                <div className="px-6 py-4 border-t border-white/5 bg-white/[0.02] flex justify-between items-center shrink-0 md:hidden">
                    <div className="text-[9px] text-ios-gray font-mono uppercase tracking-tighter">
                        ID: {trade.id.substring(0, 12)}...
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-1 h-1 rounded-full bg-ios-green animate-pulse" />
                        <span className="text-[9px] text-ios-green font-bold uppercase tracking-tighter">Verified</span>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default DeepDiveModal;
