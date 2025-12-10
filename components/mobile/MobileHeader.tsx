import React from 'react';
import { Settings } from 'lucide-react';
import { AccountState, AssetSymbol } from '../../types';

interface Props {
    title: string;
    account: AccountState;
    onOpenSettings: () => void;
    activeAsset?: AssetSymbol;
    onToggleAsset?: (asset: AssetSymbol) => void;
}

const MobileHeader: React.FC<Props> = ({ title, account, onOpenSettings, activeAsset, onToggleAsset }) => {
    // Determine daily PnL color
    const pnl = account.totalPnL || 0;
    const isPositive = pnl >= 0;

    return (
        <div className="pt-16 pb-6 px-6 bg-[#0a0b14] flex flex-col items-center relative">
            {/* Top Bar */}
            <div className="w-full flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] font-bold text-gray-500 tracking-widest uppercase">{title}</span>
                </div>
                <button onClick={onOpenSettings} className="text-gray-500 hover:text-white transition-colors">
                    <Settings size={18} />
                </button>
            </div>

            {/* Balance */}
            <h1 className="text-4xl font-black text-white tracking-tight mb-3">
                £{account.balance.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h1>

            {/* PnL Pill */}
            <div className={`px-4 py-1.5 rounded-full flex items-center gap-2 ${isPositive ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                {isPositive ? (
                    <span className="text-xs font-bold">↗ £{pnl.toFixed(2)} (+{(pnl / account.balance * 100).toFixed(2)}%) Today</span>
                ) : (
                    <span className="text-xs font-bold">↘ £{Math.abs(pnl).toFixed(2)} ({(pnl / account.balance * 100).toFixed(2)}%) Today</span>
                )}
            </div>

            {/* Asset Toggle */}
            {activeAsset && onToggleAsset && (
                <div className="flex gap-2 mt-4 bg-[#1C1C1E] p-1 rounded-lg border border-white/5">
                    <button 
                        onClick={() => onToggleAsset(AssetSymbol.NAS100)}
                        className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeAsset === AssetSymbol.NAS100 ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                    >
                        NAS100
                    </button>
                    <button 
                        onClick={() => onToggleAsset(AssetSymbol.XAUUSD)}
                        className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeAsset === AssetSymbol.XAUUSD ? 'bg-yellow-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                    >
                        GOLD
                    </button>
                </div>
            )}
        </div>
    );
};

export default MobileHeader;
