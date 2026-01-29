import React from 'react';
import { TrendingUp, TrendingDown, DollarSign, Activity } from 'lucide-react';
import { GlassCard } from './ui/GlassCard';

interface AgentCardProps {
    agent: {
        id: string;
        name: string;
        role: string;
        balance: number;
        equity: number;
        lastAction: string;
        isThinking: boolean;
        isHalted?: boolean;
    };
}

interface AgentCardProps {
    agent: {
        id: string;
        name: string;
        role: string;
        balance: number;
        equity: number;
        lastAction: string;
        isThinking: boolean;
        isHalted?: boolean;
    };
}

export const AgentCard: React.FC<AgentCardProps> = ({ agent }) => {
    const isProfitable = agent.equity >= 1000;
    const pnl = agent.equity - 1000;
    const pnlPercent = (pnl / 1000) * 100;

    // Agent Color Themes mapped to Premium Colors
    const themeColor = {
        quant: 'cyan',
        macro: 'gold',  // Changing macro to gold for variety/hierarchy
        risk: 'red'     // Risk is red/orange
    }[agent.id] || 'gray';

    const glowClass = {
        quant: 'shadow-glow-cyan/20 border-premium-cyan/30',
        macro: 'shadow-glow-gold/20 border-premium-gold/30',
        risk: 'shadow-none border-premium-red/30'
    }[agent.id] || 'border-premium-border';

    const textGlow = {
        quant: 'text-premium-cyan drop-shadow-[0_0_5px_rgba(0,240,255,0.5)]',
        macro: 'text-premium-gold drop-shadow-[0_0_5px_rgba(212,175,55,0.5)]',
        risk: 'text-premium-red'
    }[agent.id] || 'text-gray-400';

    return (
        <GlassCard className={`p-5 flex flex-col justify-between h-full transition-all duration-300 hover:scale-[1.02] ${agent.isHalted ? 'border-premium-red shadow-[0_0_20px_rgba(255,77,77,0.4)]' : glowClass}`}>
            {agent.isHalted && (
                <div className="absolute inset-0 bg-red-950/40 z-0 pointer-events-none" />
            )}

            <div className="flex justify-between items-start mb-4 relative z-10">
                <div>
                    <h3 className={`text-xl font-bold ${agent.isHalted ? 'text-premium-red' : textGlow} uppercase tracking-widest flex items-center gap-2`}>
                        {agent.name}
                        {agent.isHalted ? (
                            <span className="bg-red-600 text-white text-[9px] px-2 py-0.5 rounded-full animate-pulse ml-2">HALTED</span>
                        ) : agent.isThinking && (
                            <span className="relative flex h-3 w-3">
                                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-current`}></span>
                                <span className={`relative inline-flex rounded-full h-3 w-3 bg-current`}></span>
                            </span>
                        )}
                    </h3>
                    <p className="text-xs text-gray-400 font-mono tracking-wider opacity-80">{agent.role}</p>
                </div>
                <div className={`px-2 py-1 rounded text-xs font-mono font-bold border backdrop-blur-md ${isProfitable ? 'border-premium-green/30 text-premium-green bg-premium-green/5' : 'border-premium-red/30 text-premium-red bg-premium-red/5'}`}>
                    {pnl >= 0 ? '+' : ''}{(pnlPercent || 0).toFixed(1)}%
                </div>
            </div>

            <div className="space-y-4 relative z-10">
                <div className="flex justify-between items-end">
                    <div className="text-gray-500 text-[10px] uppercase font-bold tracking-widest">Equity</div>
                    <div className="text-3xl font-mono font-bold text-white tracking-tighter">
                        £{(agent?.equity || 0).toFixed(2)}
                    </div>
                </div>

                <div className="pt-3 border-t border-white/5">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Last Action</span>
                        <span className={`text-sm font-bold font-mono ${agent.lastAction === 'BUY' ? 'text-premium-green' : agent.lastAction === 'SELL' ? 'text-premium-red' : 'text-gray-500'}`}>
                            {agent.lastAction}
                        </span>
                    </div>
                </div>
            </div>
        </GlassCard>
    );
};
