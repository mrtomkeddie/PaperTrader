import React from 'react';
import { TrendingUp, TrendingDown, DollarSign, Activity, PauseCircle, PlayCircle } from 'lucide-react';
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
        isHalted?: boolean; // Kept for Margin Call indicator if needed, but UI usage removed
        lastThought?: string;
        todayPnL?: number;
    };
    isActive?: boolean;
}

export const AgentCard: React.FC<AgentCardProps> = ({
    agent,
    isActive
}) => {
    const { id, name, role, balance, equity, isThinking, lastAction, lastThought, todayPnL } = agent;
    const isProfitable = equity >= 1000;
    const pnl = equity - 1000;
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
    }[id] || 'text-gray-400';

    // Helper to get agent color for dynamic styling (used in the new structure)
    const getAgentColor = (agentId: string) => {
        switch (agentId) {
            case 'quant': return 'text-premium-cyan';
            case 'macro': return 'text-premium-gold';
            case 'risk': return 'text-premium-red';
            default: return 'text-gray-400';
        }
    };

    // Placeholder for Icon component (assuming it's a dynamic icon based on agent type)
    // For this change, we'll use a generic Activity icon if a specific one isn't provided
    const Icon = Activity;

    const getBorderColor = (agentId: string, thinking: boolean) => {
        const colors = {
            quant: thinking ? 'border-premium-cyan shadow-[0_0_30px_rgba(0,240,255,0.15)] bg-premium-cyan/5' : 'border-premium-cyan/30 hover:border-premium-cyan/50 bg-premium-cyan/5',
            macro: thinking ? 'border-premium-gold shadow-[0_0_30px_rgba(255,215,0,0.15)] bg-premium-gold/5' : 'border-premium-gold/30 hover:border-premium-gold/50 bg-premium-gold/5',
            risk: thinking ? 'border-premium-red shadow-[0_0_30px_rgba(255,0,0,0.15)] bg-premium-red/5' : 'border-premium-red/30 hover:border-premium-red/50 bg-premium-red/5'
        }[agentId] || 'border-white/10 bg-white/5';

        return colors;
    };

    return (
        <div className={`p-4 rounded-xl border relative overflow-hidden transition-all duration-300 ${getBorderColor(id, isThinking)}`}>

            {/* Header */}
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-gradient-to-br ${getAgentColor(id).replace('text-', 'from-').replace('500', '500/20')} to-black border border-white/10`}>
                        <Icon className={`w-5 h-5 ${getAgentColor(id)}`} />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                            {name}
                            {isThinking && (
                                <span className="relative flex h-2 w-2">
                                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${id === 'quant' ? 'bg-premium-cyan' : id === 'macro' ? 'bg-premium-gold' : 'bg-premium-red'}`}></span>
                                    <span className={`relative inline-flex rounded-full h-2 w-2 ${id === 'quant' ? 'bg-premium-cyan' : id === 'macro' ? 'bg-premium-gold' : 'bg-premium-red'}`}></span>
                                </span>
                            )}
                        </h3>
                        <p className="text-[10px] text-gray-400 font-mono tracking-wider opacity-80">{role}</p>
                    </div>
                </div>
                <div className={`px-2 py-1 rounded text-[10px] font-mono font-bold border backdrop-blur-md ${isProfitable ? 'border-premium-green/30 text-premium-green bg-premium-green/5' : 'border-premium-red/30 text-premium-red bg-premium-red/5'}`}>
                    {pnl >= 0 ? '+' : ''}{(pnlPercent || 0).toFixed(1)}%
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex justify-between items-end">
                    <div className="text-gray-500 text-[10px] uppercase font-bold tracking-widest">Equity</div>
                    <div className="text-3xl font-mono font-bold text-white tracking-tighter">
                        £{(equity || 0).toFixed(2)}
                    </div>
                </div>

                <div className="pt-3 border-t border-white/5">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Today's P&L</span>
                        <span className={`text-sm font-bold font-mono ${pnl >= 0 ? 'text-premium-green' : 'text-premium-red'}`}>
                            {pnl >= 0 ? '+' : ''}£{Math.abs(pnl).toFixed(2)}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};
