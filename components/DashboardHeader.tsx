import React from 'react';
import { Search, HelpCircle, Sun, Moon, ToggleLeft, ToggleRight, Settings } from 'lucide-react';
import { AccountState, AssetSymbol } from '../types';

interface Props {
    account: AccountState;
    toggleAsset: (s: AssetSymbol) => void;
    activeAsset: AssetSymbol;
    onOpenSettings: () => void;
}

const DashboardHeader: React.FC<Props> = ({ account, toggleAsset, activeAsset, onOpenSettings }) => {
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
                <div className="flex bg-[#1C1C1E] rounded-lg p-1 border border-white/5">
                    <div
                        className="px-4 py-1.5 rounded-md text-xs font-bold bg-yellow-600 text-white shadow cursor-default"
                    >
                        GOLD
                    </div>
                </div>

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
                            £{account.balance.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="flex justify-end mt-1">
                            <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-green-500/10 border border-green-500/20">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                <span className="text-[9px] font-bold text-green-500 uppercase tracking-wider">ONLINE</span>
                            </div>
                        </div>
                    </div>

                    <div className="text-right hidden xl:block">
                        <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Open P&L</div>
                        <div className={`text-xl font-bold tabular-nums ${account.totalPnL && account.totalPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {account.totalPnL && account.totalPnL >= 0 ? '+' : ''}£{(account.totalPnL || 0).toFixed(2)}
                        </div>
                    </div>

                    <div className="text-right hidden lg:block">
                        <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Win Rate</div>
                        <div className={`text-xl font-bold tabular-nums ${(account.winRate || 0) >= 50 ? 'text-green-500' : 'text-orange-500'}`}>
                            {(account.winRate || 0).toFixed(1)}%
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default DashboardHeader;
