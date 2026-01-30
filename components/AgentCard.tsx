import { TrendingUp, TrendingDown, DollarSign, Activity, PauseCircle, PlayCircle, Shield } from 'lucide-react';
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
        lastThought?: string;
        dayPnL?: number;
        winRate?: number;
    };
    isActive?: boolean;
}

export const AgentCard: React.FC<AgentCardProps> = ({
    agent,
    isActive
}) => {
    const { id, name, role, balance, equity, isThinking, lastAction, lastThought, dayPnL, winRate } = agent;
    const isProfitable = equity >= 1000;
    const pnl = agent?.dayPnL ?? 0;

    // Helper to get agent color for dynamic styling (used in the new structure)
    const getAgentColor = (agentId: string) => {
        switch (agentId) {
            case 'quant': return 'text-premium-cyan';
            case 'macro': return 'text-premium-gold';
            case 'risk': return 'text-premium-red';
            default: return 'text-gray-400';
        }
    };

    // Dynamic Icon Selection
    const getIcon = (agentId: string) => {
        switch (agentId) {
            case 'quant': return Activity;
            case 'macro': return TrendingUp;
            case 'risk': return Shield;
            default: return Activity;
        }
    };

    const Icon = getIcon(id);

    const getBorderColor = (agentId: string, thinking: boolean) => {
        const colors = {
            quant: thinking ? 'border-premium-cyan shadow-[0_0_30px_rgba(0,240,255,0.15)] bg-premium-cyan/5' : 'border-premium-cyan shadow-[0_0_15px_rgba(0,240,255,0.05)] bg-premium-cyan/5',
            macro: thinking ? 'border-premium-gold shadow-[0_0_30px_rgba(255,215,0,0.15)] bg-premium-gold/5' : 'border-premium-gold shadow-[0_0_15px_rgba(255,215,0,0.05)] bg-premium-gold/5',
            risk: thinking ? 'border-premium-red shadow-[0_0_30px_rgba(255,0,0,0.15)] bg-premium-red/5' : 'border-premium-red shadow-[0_0_15px_rgba(255,0,0,0.05)] bg-premium-red/5'
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
                    WR: {(winRate || 0).toFixed(1)}%
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex justify-between items-end">
                    <div className="text-gray-500 text-[10px] uppercase font-bold tracking-widest">Total Realized</div>
                    <div className="text-3xl font-mono font-bold text-white tracking-tighter">
                        £{(balance - 1000).toFixed(2)}
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
