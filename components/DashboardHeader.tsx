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

    const totalOpenPnL = totalEquity - totalBalance;

    return (
        <header className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#0a0b14] w-full">
            {/* LEFT: Logo & Kill Switch */}
            <div className="flex items-center gap-6">
                <img src="/pt2logo.png" alt="Paper Trader 2.0" className="h-10 w-auto object-contain" />

                <div className="flex items-center gap-3 px-4 py-2 bg-black/40 rounded-xl border border-white/5 shadow-inner">
                    <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-[0.2em]">Master Kill Switch</span>
                        <span className={`text-[10px] font-mono font-bold ${isGloballyActive ? 'text-green-500' : 'text-red-500 animate-pulse'}`}>
                            {isGloballyActive ? 'SYSTEM_ARMED' : 'SYSTEM_PAUSED'}
                        </span>
                    </div>
                    <button
                        onClick={() => toggleMaster(!isGloballyActive)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 focus:outline-none ring-2 ring-offset-1 ring-offset-black ${isGloballyActive ? 'bg-green-600 ring-green-500/50' : 'bg-red-600 ring-red-500/50'}`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-all duration-300 shadow-[0_0_10px_rgba(255,255,255,0.8)] ${isGloballyActive ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>
            </div>

            {/* CENTER: Stats - evenly spaced */}
            <div className="flex items-center gap-12">
                {/* Balance */}
                <div className="flex items-center gap-3">
                    <div className="text-xl font-bold text-white tabular-nums">
                        {formatCurrency(totalBalance)}
                    </div>
                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded border transition-colors ${isGloballyActive ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full bg-current ${isGloballyActive ? 'animate-pulse' : ''}`} />
                        <span className="text-[9px] font-bold uppercase tracking-wider">{isGloballyActive ? 'ONLINE' : 'PAUSED'}</span>
                    </div>
                </div>

                {/* Open P&L */}
                <div className="text-center">
                    <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Open P&L</div>
                    <div className={`text-xl font-bold tabular-nums ${totalOpenPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {formatCurrency(totalOpenPnL)}
                    </div>
                </div>
            </div>

            {/* RIGHT: Settings */}
            <div className="flex items-center gap-3">
                <button
                    onClick={onOpenSettings}
                    className="p-2 bg-[#1C1C1E] rounded-lg border border-white/5 text-gray-400 hover:text-white transition-colors"
                    title="Settings"
                >
                    <Settings size={18} />
                </button>
            </div>
        </header>
    );
};

export default DashboardHeader;
