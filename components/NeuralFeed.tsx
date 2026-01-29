import React, { useEffect, useRef } from 'react';
import { Cpu, Shield, Brain, Activity } from 'lucide-react';

interface Decision {
    agentId: string;
    action: string;
    confidence: number;
    reason: string;
    timestamp: number;
    sentiment_score?: number;
}

interface NeuralFeedProps {
    decisions: Decision[];
}

export const NeuralFeed: React.FC<NeuralFeedProps> = ({ decisions }) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom on new message
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [decisions]);

    const getIcon = (id: string) => {
        switch (id) {
            case 'quant': return <Cpu className="w-4 h-4 text-cyan-400" />;
            case 'macro': return <Brain className="w-4 h-4 text-blue-400" />;
            case 'risk': return <Shield className="w-4 h-4 text-orange-400" />;
            default: return <Activity className="w-4 h-4 text-gray-400" />;
        }
    };

    const getBadge = (action: string, confidence: number) => {
        const color = action === 'BUY' ? 'bg-green-500/20 text-green-400 border-green-500/50'
            : action === 'SELL' ? 'bg-red-500/20 text-red-400 border-red-500/50'
                : 'bg-gray-500/20 text-gray-400 border-gray-500/50';

        return (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${color} uppercase`}>
                {action} | {confidence}%
            </span>
        );
    };

    return (
        <div className="bg-black/40 border border-gray-800 rounded-xl overflow-hidden flex flex-col h-full">
            <div className="p-3 border-b border-gray-800 bg-gray-900/50 flex justify-between items-center">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    Neural Decision Feed
                </h3>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent">
                {decisions.length === 0 && (
                    <div className="text-center text-gray-600 text-xs italic py-10">
                        Waiting for initial synapse...
                    </div>
                )}
                {decisions.map((d, index) => (
                    <div key={index} className="flex gap-3 animate-slide-in-right opacity-0" style={{ animationFillMode: 'forwards', animationDelay: `${index * 50}ms` }}>
                        <div className={`mt-1 p-1.5 rounded-lg bg-gray-900 border border-gray-800 h-fit`}>
                            {getIcon(d.agentId)}
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-bold text-gray-300 uppercase">{d.agentId}</span>
                                <span className="text-[10px] text-gray-600 font-mono">{new Date(d.timestamp).toLocaleTimeString()}</span>
                                {getBadge(d.action, d.confidence)}
                            </div>
                            <div className="p-3 rounded-r-xl rounded-bl-xl bg-gray-800/40 border border-gray-700/50 text-sm text-gray-300 font-mono leading-relaxed shadow-sm hover:border-gray-600 transition-colors">
                                {d.reason}
                                {d.sentiment_score !== undefined && (
                                    <div className="mt-2 pt-2 border-t border-gray-700/50 flex items-center gap-2">
                                        <span className="text-[10px] text-gray-500 uppercase">Sentiment Score</span>
                                        <div className={`h-1 flex-1 rounded-full bg-gray-700 overflow-hidden`}>
                                            <div
                                                className={`h-full ${d.sentiment_score > 0 ? 'bg-green-500' : 'bg-red-500'}`}
                                                style={{ width: `${Math.abs(d.sentiment_score) * 10}%`, marginLeft: d.sentiment_score < 0 ? 'auto' : '0' }}
                                            />
                                        </div>
                                        <span className={`text-[10px] font-bold ${d.sentiment_score > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {d.sentiment_score > 0 ? '+' : ''}{d.sentiment_score}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
