import React from 'react';
import { X, Terminal } from 'lucide-react';
import { Trade } from '../types';

interface DeepDiveModalProps {
    isOpen: boolean;
    onClose: () => void;
    trade: Trade | null;
}

const DeepDiveModal: React.FC<DeepDiveModalProps> = ({ isOpen, onClose, trade }) => {
    if (!isOpen || !trade) return null;

    const data: any = trade.decisionSnapshot || { error: "No detailed log captured for this trade." };

    // Theme colors matching the Agent Cards - Use literal values for Tailwind
    const themes = {
        quant: {
            accent: 'text-cyan-400',
            border: 'border-cyan-500/30',
            glow: 'shadow-[0_0_30px_rgba(6,182,212,0.15)]',
            bg: 'bg-cyan-500/10'
        },
        macro: {
            accent: 'text-blue-400',
            border: 'border-blue-500/30',
            glow: 'shadow-[0_0_30px_rgba(59,130,246,0.15)]',
            bg: 'bg-blue-500/10'
        },
        risk: {
            accent: 'text-orange-400',
            border: 'border-orange-500/30',
            glow: 'shadow-[0_0_30px_rgba(249,115,22,0.15)]',
            bg: 'bg-orange-500/10'
        }
    };

    const currentTheme = themes[trade.agentId as keyof typeof themes] || themes.quant;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
            <div
                className={`w-full max-w-2xl bg-[#0a0f1e] border ${currentTheme.border} rounded-2xl ${currentTheme.glow} flex flex-col max-h-[95vh] sm:max-h-[90vh] overflow-hidden`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-gray-800 bg-gray-900/50">
                    <div className="flex items-center gap-3">
                        <Terminal className={`${currentTheme.accent} w-5 h-5`} />
                        <div>
                            <h2 className={`text-lg font-mono font-bold ${currentTheme.accent} tracking-wider`}>
                                DECISION_LOG // {trade.agentId?.toUpperCase()}
                            </h2>
                            <div className="text-[10px] text-gray-500 font-mono">ENCRYPTED_SYNAPSE_STREAM</div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-all">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-4 sm:p-6 font-mono text-sm relative custom-scrollbar">
                    {/* Grid background */}
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:30px_30px] opacity-20 pointer-events-none"></div>

                    <div className="relative z-10 space-y-8">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="p-3 bg-black/40 rounded-xl border border-gray-800/50">
                                <div className="text-[10px] text-gray-500 uppercase mb-1">Status</div>
                                <div className={`text-xs font-bold ${trade.status === 'OPEN' ? 'text-cyan-400' : 'text-gray-400'}`}>{trade.status}</div>
                            </div>
                            <div className="p-3 bg-black/40 rounded-xl border border-gray-800/50">
                                <div className="text-[10px] text-gray-500 uppercase mb-1">Type</div>
                                <div className={`text-xs font-bold ${trade.type === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>{trade.type}</div>
                            </div>
                            <div className="p-3 bg-black/40 rounded-xl border border-gray-800/50">
                                <div className="text-[10px] text-gray-500 uppercase mb-1">Entry Price</div>
                                <div className="text-xs font-bold text-gray-200">${trade.entryPrice.toFixed(2)}</div>
                            </div>
                            <div className="p-3 bg-black/40 rounded-xl border border-gray-800/50">
                                <div className="text-[10px] text-gray-500 uppercase mb-1">Size</div>
                                <div className="text-xs font-bold text-gray-200">{trade.initialSize} Lot</div>
                            </div>
                        </div>

                        {/* Reasoning Snippet */}
                        <div className="space-y-2">
                            <div className={`${currentTheme.accent} text-[10px] font-bold uppercase tracking-widest`}>Thinking Process</div>
                            <div className="p-4 bg-[#050510] rounded-xl border border-gray-800 italic text-gray-300 leading-relaxed ring-1 ring-inset ring-white/5">
                                "{trade.entryReason || 'No reasoning captured.'}"
                            </div>
                        </div>

                        {/* Agent Specific Data Formatting */}
                        <div className="space-y-4">
                            <div className={`${currentTheme.accent} text-[10px] font-bold uppercase tracking-widest flex items-center gap-2`}>
                                <div className={`w-1 h-1 rounded-full bg-current pulse`}></div>
                                Signal Parameters
                            </div>

                            {trade.agentId === 'quant' && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="p-4 bg-gray-900/30 rounded-xl border border-gray-800 flex justify-between items-center">
                                        <span className="text-gray-500 text-xs">RSI (14)</span>
                                        <span className="text-lg font-bold text-cyan-400">{data.rsi?.toFixed(2) || 'N/A'}</span>
                                    </div>
                                    <div className="p-4 bg-gray-900/30 rounded-xl border border-gray-800 flex justify-between items-center">
                                        <span className="text-gray-500 text-xs">Trend</span>
                                        <span className="text-lg font-bold text-cyan-400 uppercase">{data.trend || 'N/A'}</span>
                                    </div>
                                </div>
                            )}

                            {trade.agentId === 'macro' && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="p-4 bg-gray-900/30 rounded-xl border border-gray-800 flex justify-between items-center">
                                        <span className="text-gray-500 text-xs">Sentiment</span>
                                        <span className={`text-lg font-bold ${data.sentiment_score >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {data.sentiment_score > 0 ? '+' : ''}{data.sentiment_score || '0'}
                                        </span>
                                    </div>
                                    <div className="p-4 bg-gray-900/30 rounded-xl border border-gray-800 flex justify-between items-center">
                                        <span className="text-gray-500 text-xs">Outlook</span>
                                        <span className="text-lg font-bold text-blue-400">{data.timeframe || 'Mid-Term'}</span>
                                    </div>
                                </div>
                            )}

                            {trade.agentId === 'risk' && (
                                <div className="p-4 bg-gray-900/30 rounded-xl border border-gray-800 flex justify-between items-center">
                                    <span className="text-gray-500 text-xs">Risk Tolerance</span>
                                    <span className="text-lg font-bold text-orange-400">Low-Risk Hedge</span>
                                </div>
                            )}
                        </div>

                        {/* Raw JSON View */}
                        <div className="space-y-2">
                            <div className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Full Synapse Payload</div>
                            <div className="bg-black/60 p-4 sm:p-5 rounded-xl border border-gray-800/80 max-h-48 overflow-y-auto custom-scrollbar">
                                <pre className={`${currentTheme.accent} text-[11px] leading-relaxed opacity-80 whitespace-pre-wrap break-all`}>
                                    {JSON.stringify(data, null, 2)}
                                </pre>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-800 bg-gray-900/50 text-[9px] text-gray-500 font-mono flex justify-between items-center">
                    <div className="flex gap-4">
                        <span>ID: {trade.id}</span>
                        <span>NODE: BRAIN_01</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                        <span className="tracking-tighter uppercase">Verifying_Signature_Success</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DeepDiveModal;
