import React from 'react';
import { TrendingUp, TrendingDown, DollarSign, Activity } from 'lucide-react';

interface AgentCardProps {
    agent: {
        id: string;
        name: string;
        role: string;
        balance: number;
        equity: number;
        lastAction: string;
        isThinking: boolean;
    };
}

export const AgentCard: React.FC<AgentCardProps> = ({ agent }) => {
    const isProfitable = agent.equity >= 1000;
    const pnl = agent.equity - 1000;
    const pnlPercent = (pnl / 1000) * 100;

    // Agent Color Themes
    const theme = {
        quant: 'border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.3)]',
        macro: 'border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]',
        risk: 'border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.3)]'
    }[agent.id] || 'border-gray-700';

    const glowText = {
        quant: 'text-cyan-400',
        macro: 'text-blue-400',
        risk: 'text-orange-400'
    }[agent.id] || 'text-gray-400';

    return (
        <div className={`bg-gray-900/80 border ${theme} rounded-xl p-4 flex flex-col justify-between h-full backdrop-blur-sm transition-all duration-300 hover:scale-[1.02]`}>
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className={`text-lg font-bold ${glowText} uppercase tracking-wider flex items-center gap-2`}>
                        {agent.name}
                        {agent.isThinking && (
                            <span className="relative flex h-3 w-3">
                                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-current`}></span>
                                <span className={`relative inline-flex rounded-full h-3 w-3 bg-current`}></span>
                            </span>
                        )}
                    </h3>
                    <p className="text-xs text-gray-400 font-mono">{agent.role}</p>
                </div>
                <div className={`px-2 py-1 rounded text-xs font-bold border ${isProfitable ? 'border-green-500/30 text-green-400 bg-green-500/10' : 'border-red-500/30 text-red-400 bg-red-500/10'}`}>
                    {pnl >= 0 ? '+' : ''}{pnlPercent.toFixed(1)}%
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex justify-between items-end">
                    <div className="text-gray-400 text-xs uppercase">Equity</div>
                    <div className="text-2xl font-mono font-bold text-white tracking-widest">
                        £{(agent?.equity || 0).toFixed(2)}
                    </div>
                </div>

                <div className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-500">
                        <span>Balance</span>
                        <span>£{(agent?.balance || 0).toFixed(2)}</span>
                    </div>
                    {/* Add chart sparkline here later */}
                </div>

                <div className="pt-3 border-t border-gray-800">
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500 uppercase">Action</span>
                        <span className={`text-sm font-bold font-mono ${agent.lastAction === 'BUY' ? 'text-green-400' : agent.lastAction === 'SELL' ? 'text-red-400' : 'text-gray-400'}`}>
                            {agent.lastAction}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};
