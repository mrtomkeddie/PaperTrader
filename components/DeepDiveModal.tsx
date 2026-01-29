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

    const data = trade.decisionSnapshot || { error: "No detailed log captured for this trade." };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="w-full max-w-2xl bg-[#0a0f1e] border border-cyan-500/30 rounded-lg shadow-[0_0_30px_rgba(6,182,212,0.15)] flex flex-col max-h-[85vh] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900/50">
                    <div className="flex items-center gap-2">
                        <Terminal className="text-cyan-400 w-5 h-5" />
                        <h2 className="text-lg font-mono font-bold text-cyan-400 tracking-wider">
                            DECISION_LOG // {trade.agentId?.toUpperCase()}
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6 font-mono text-sm relative">
                    {/* Matrix rain effect background (simplified as subtle grid for now) */}
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(18,18,18,0)_1px,transparent_1px),linear-gradient(90deg,rgba(18,18,18,0)_1px,transparent_1px)] bg-[size:20px_20px] opacity-20 pointer-events-none"></div>

                    <div className="relative z-10 space-y-6">
                        {/* Meta Data */}
                        <div className="grid grid-cols-2 gap-4 text-xs text-gray-500 mb-4 border-b border-gray-800 pb-4">
                            <div>TIMESTAMP: <span className="text-gray-300">{new Date(trade.openTime).toISOString()}</span></div>
                            <div>SYMBOL: <span className="text-gray-300">{trade.symbol}</span></div>
                            <div>ACTION: <span className={trade.type === 'BUY' ? 'text-green-400' : 'text-red-400'}>{trade.type}</span></div>
                            <div>EXEC PRICE: <span className="text-gray-300">{trade.entryPrice}</span></div>
                        </div>

                        {/* Specific Agent Data Formatting */}
                        {trade.agentId === 'quant' && (
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="p-3 bg-gray-900/50 rounded border border-gray-800">
                                    <div className="text-cyan-500 text-xs mb-1">RSI (14)</div>
                                    <div className="text-xl font-bold">{data.rsi?.toFixed(2) || 'N/A'}</div>
                                </div>
                                <div className="p-3 bg-gray-900/50 rounded border border-gray-800">
                                    <div className="text-cyan-500 text-xs mb-1">TREND (200EMA)</div>
                                    <div className="text-xl font-bold">{data.trend || 'N/A'}</div>
                                </div>
                            </div>
                        )}

                        {/* Raw JSON View */}
                        <div>
                            <div className="text-gray-500 text-xs mb-2 uppercase tracking-widest">Raw Synapse Output</div>
                            <div className="bg-[#05050a] p-4 rounded border border-gray-800 overflow-x-auto">
                                <pre className="text-green-500/90 leading-relaxed custom-scrollbar">
                                    {JSON.stringify(data, null, 2)}
                                </pre>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-3 border-t border-gray-800 bg-gray-900/50 text-[10px] text-gray-500 font-mono flex justify-between">
                    <span>LOG ID: {trade.id}</span>
                    <span className="animate-pulse">● SYSTEM_AUDIT_MODE</span>
                </div>
            </div>
        </div>
    );
};

export default DeepDiveModal;
