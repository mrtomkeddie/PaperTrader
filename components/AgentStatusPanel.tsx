import React from 'react';
import { AgentAccount } from '../types';
import { TrendingUp, Shield, Activity, Zap } from 'lucide-react';

interface Props {
    accounts?: Record<string, AgentAccount>;
}

const AgentCard: React.FC<{ agent: AgentAccount; icon: React.ReactNode; color: string; textColor: string }> = ({ agent, icon, color, textColor }) => (
    <div className="bg-[#13141b] rounded-xl p-4 border border-white/5 flex flex-col relative overflow-hidden group hover:border-white/10 transition-colors shadow-sm">
        <div className={`absolute top-0 left-0 w-1 h-full ${color}`} />

        <div className="flex justify-between items-start mb-3 pl-2">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-white/5 ${textColor}`}>
                    {icon}
                </div>
                <div>
                    <h3 className="text-sm font-bold text-white">{agent.name}</h3>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">{agent.role}</p>
                </div>
            </div>
            <div className="text-right">
                <p className="text-[10px] text-gray-400 uppercase">Equity</p>
                <p className={`text-base font-mono font-bold ${agent.equity >= 1000 ? 'text-green-400' : 'text-red-400'}`}>
                    £{agent.equity.toFixed(2)}
                </p>
            </div>
        </div>

        {/* Status Pulse */}
        <div className="flex items-center gap-2 mb-3 pl-2 bg-white/5 rounded-lg py-1 px-2 border border-white/5">
            <div className={`w-1.5 h-1.5 rounded-full ${agent.isThinking ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`} />
            <span className="text-[10px] text-gray-300 font-mono truncate w-full">
                {agent.isThinking ? 'ANALYZING MARKETS...' : agent.lastAction}
            </span>
        </div>

        {/* Thoughts (Reasoning) */}
        <div className="mt-auto pl-2 pt-2">
            <div className="flex items-start gap-1.5 opacity-60">
                <Zap size={10} className="mt-0.5 text-yellow-500 flex-shrink-0" />
                <p className="text-[10px] text-gray-400 italic line-clamp-2 leading-relaxed">
                    "{agent.lastThought || 'Initializing neural simulation...'}"
                </p>
            </div>
        </div>
    </div>
);

const AgentStatusPanel: React.FC<Props> = ({ accounts }) => {
    if (!accounts) return null;

    const quant = accounts['quant'];
    const macro = accounts['macro'];
    const risk = accounts['risk'];

    if (!quant || !macro || !risk) return (
        <div className="w-full h-32 flex items-center justify-center bg-[#13141b] rounded-xl border border-white/5 mb-6">
            <div className="flex flex-col items-center gap-2 text-gray-500 animate-pulse">
                <Activity size={24} />
                <span className="text-xs font-mono uppercase">Connecting to Agent Network...</span>
            </div>
        </div>
    );

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <AgentCard agent={quant} icon={<Activity size={18} />} color="bg-blue-500" textColor="text-blue-500" />
            <AgentCard agent={macro} icon={<TrendingUp size={18} />} color="bg-purple-500" textColor="text-purple-500" />
            <AgentCard agent={risk} icon={<Shield size={18} />} color="bg-orange-500" textColor="text-orange-500" />
        </div>
    );
};

export default AgentStatusPanel;
