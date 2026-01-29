import React from 'react';
import { Search, HelpCircle, Sun, Moon, ToggleLeft, ToggleRight, Settings } from 'lucide-react';
import { AccountState, AssetSymbol, AgentAccount } from '../types';

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
        ? agentValues.reduce((acc, a) => acc + a.balance, 0)
        : account.balance;

    const totalEquity = hasAgents
        ? agentValues.reduce((acc, a) => acc + a.equity, 0)
        : account.equity;

    const totalOpenPnL = totalEquity - totalBalance;

    return (
        <header className="flex flex-col md:flex-row md:items-center justify-between px-4 md:px-6 py-4 border-b border-white/5 bg-[#0a0b14] gap-4 md:gap-0">
            {/* Top Row: Logo & Mobile Settings */}
            <div className="flex items-center justify-between w-full md:w-auto">
                <div className="flex items-center gap-2">
                    <img src="/pt2logo.png" alt="Paper Trader 2.0" className="h-12 w-auto object-contain" />
                </div>

                {/* Mobile Settings Button */}
                <button
                    onClick={onOpenSettings}
                    className="md:hidden p-2 bg-[#1C1C1E] rounded-lg border border-white/5 text-gray-400 hover:text-white transition-colors"
                >
                    <Settings size={18} />
                </button>
            </div>

            {/* Bottom Row: Controls & Stats */}
            <div className="flex items-center justify-between w-full md:w-auto md:gap-6">

                {/* Desktop Settings & Stats */}
                <div className="flex items-center gap-4 md:gap-6">
                    <button
                        onClick={onOpenSettings}
                        className="hidden md:block p-2 bg-[#1C1C1E] rounded-lg border border-white/5 text-gray-400 hover:text-white transition-colors"
                        title="Settings"
                    >
                        <Settings size={18} />
                    </button>

                    <div className="text-right">
                        <div className="text-lg md:text-xl font-bold text-white tabular-nums">
                            £{totalBalance.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="flex justify-end mt-1">
                            <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-green-500/10 border border-green-500/20">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                <span className="text-[9px] font-bold text-green-500 uppercase tracking-wider">ONLINE</span>
                            </div>
                        </div>
                    </div>

                    <div className="text-right">
                        <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Open P&L</div>
                        <div className={`text-xl font-bold tabular-nums ${totalOpenPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {totalOpenPnL >= 0 ? '+' : ''}£{totalOpenPnL.toFixed(2)}
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default DashboardHeader;
