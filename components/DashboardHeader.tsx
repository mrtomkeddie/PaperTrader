import React from 'react';
import { Search, HelpCircle, Sun, Moon, ToggleLeft, ToggleRight, Settings } from 'lucide-react';
import { AccountState, AssetSymbol, AgentAccount } from '../types';
import { formatCurrency } from '../utils/formatters';

interface Props {
    account: AccountState;
    accounts?: Record<string, AgentAccount>;
    assets: Record<AssetSymbol, any>;
    toggleAsset: (s: AssetSymbol) => void;
    activeAsset: AssetSymbol;
    onOpenSettings: () => void;
    toggleMaster: (active: boolean) => void;
}

const DashboardHeader: React.FC<Props> = ({ account, accounts, assets, toggleAsset, activeAsset, onOpenSettings, toggleMaster }) => {
    // Determine if system is globally active
    const isGloballyActive = assets[activeAsset]?.botActive ?? true;

    // Aggregate data from Agents if available, otherwise fallback
    const agentValues = accounts ? Object.values(accounts) : [];
    const hasAgents = agentValues.length > 0;

    const totalBalance = hasAgents
        ? agentValues.reduce((acc, a) => acc + (a?.balance || 0), 0)
        : (account?.balance || 0);

    const totalEquity = hasAgents
        ? agentValues.reduce((acc, a) => acc + (a?.equity || 0), 0)
        : (account?.equity || 0);



    const haltedAgents = agentValues.filter(a => a?.isHalted);

    return (
        <div className="flex flex-col w-full">
            {haltedAgents.length > 0 && (
                <div className="bg-red-900/50 border-b border-red-500/30 px-6 py-2 flex items-center justify-between animate-pulse">
                    <div className="flex items-center gap-2 text-red-200 font-bold text-xs uppercase tracking-wider">
                        <span className="text-xl">⚠️</span>
                        <span>CRITICAL: {haltedAgents.map(a => a?.name).join(', ')} HALTED (Equity &lt; 80%) - ADJUST STRATEGY IMMEDIATELY</span>
                    </div>
                </div>
            )}
            <header className="flex items-center justify-between w-full">
                {/* LEFT: Logo & Kill Switch */}
                <div className="flex items-center gap-6">


                    <div className="flex items-center gap-3 px-4 py-2 bg-premium-card rounded-xl border border-premium-border shadow-inner backdrop-blur-sm">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-[0.2em]">Master Kill Switch</span>
                            <span className={`text-[10px] font-mono font-bold ${isGloballyActive ? 'text-premium-green drop-shadow-[0_0_5px_rgba(0,255,163,0.5)]' : 'text-premium-red animate-pulse'}`}>
                                {isGloballyActive ? 'SYSTEM_ARMED' : 'SYSTEM_PAUSED'}
                            </span>
                        </div>
                        <button
                            onClick={() => toggleMaster(!isGloballyActive)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 focus:outline-none ring-2 ring-offset-1 ring-offset-premium-bg ${isGloballyActive ? 'bg-premium-green ring-premium-green/50 shadow-glow-green' : 'bg-premium-red ring-premium-red/50 shadow-glow-red'}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-all duration-300 shadow-md ${isGloballyActive ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>
                </div>

                {/* CENTER: Stats - evenly spaced */}
                <div className="flex items-center gap-12">
                    {/* Balance */}
                    <div className="flex items-center gap-3">
                        <div className="text-xl font-bold text-white tabular-nums tracking-tight font-mono">
                            {formatCurrency(totalBalance)}
                        </div>
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded border transition-colors ${isGloballyActive ? 'bg-premium-green/10 border-premium-green/20 text-premium-green' : 'bg-premium-red/10 border-premium-red/20 text-premium-red'}`}>
                            <div className={`w-1.5 h-1.5 rounded-full bg-current ${isGloballyActive ? 'animate-pulse' : ''}`} />
                            <span className="text-[9px] font-bold uppercase tracking-wider">{isGloballyActive ? 'ONLINE' : 'PAUSED'}</span>
                        </div>
                    </div>


                </div>


            </header>
        </div>
    );
};

export default DashboardHeader;
