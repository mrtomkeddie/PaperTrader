import React from 'react';
import { Search, HelpCircle, Sun, Moon, ToggleLeft, ToggleRight, Settings } from 'lucide-react';
import { AccountState, AssetSymbol, AgentAccount } from '../types';
import { formatCurrency } from '../utils/formatters';

interface Props {
    account: AccountState;
    accounts?: Record<string, AgentAccount>; // Add accounts for aggregation
    toggleAsset: (s: AssetSymbol) => void;
    activeAsset: AssetSymbol;
    onOpenSettings: () => void;
}

const DashboardHeader: React.FC<Props> = ({ account, accounts, toggleAsset, activeAsset, onOpenSettings }) => {
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
        <header className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#0a0b14]">
            {/* LEFT: Logo */}
            <div className="flex items-center gap-3">
                <img src="/pt2logo.png" alt="Paper Trader 2.0" className="h-10 w-auto object-contain" />
            </div>

            {/* CENTER: Stats - evenly spaced */}
            <div className="flex items-center gap-12">
                {/* Balance */}
                <div className="flex items-center gap-3">
                    <div className="text-xl font-bold text-white tabular-nums">
                        {formatCurrency(totalBalance)}
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-green-500/10 border border-green-500/20">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-[9px] font-bold text-green-500 uppercase tracking-wider">ONLINE</span>
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
