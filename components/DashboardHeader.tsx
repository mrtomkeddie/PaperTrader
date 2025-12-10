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
                    <div className="w-8 h-8 bg-gradient-to-tr from-cyan-400 to-blue-600 rounded-lg flex items-center justify-center transform rotate-3">
                        <span className="text-white font-bold text-lg">M</span>
                    </div>
                    <span className="text-xl font-bold tracking-tight text-white">MARKETECHO</span>
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
                    <button 
                        onClick={() => toggleAsset(AssetSymbol.NAS100)}
                        className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeAsset === AssetSymbol.NAS100 ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                    >
                        NAS100
                    </button>
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
                        <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Paper Balance</div>
                        <div className="text-lg md:text-xl font-bold text-white tabular-nums">
                            £{account.balance.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                    </div>

                    <div className="text-right hidden xl:block">
                         <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Open P&L</div>
                         <div className={`text-xl font-bold tabular-nums ${account.totalPnL && account.totalPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {account.totalPnL && account.totalPnL >= 0 ? '+' : ''}£{(account.totalPnL || 0).toFixed(2)}
                         </div>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default DashboardHeader;
