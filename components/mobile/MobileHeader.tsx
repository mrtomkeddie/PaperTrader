import React from 'react';
import { Settings } from 'lucide-react';
import { AccountState, AssetSymbol } from '../../types';
import { formatCurrency } from '../../utils/formatters';

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
        <div className="pt-16 pb-2 px-6 bg-premium-bg/95 backdrop-blur-md flex flex-col items-center relative border-b border-premium-border">
            {/* Top Bar */}
            <div className="w-full flex justify-between items-center mb-1">
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-premium-green animate-pulse shadow-glow-green" />
                    <span className="text-[10px] font-bold text-gray-500 tracking-widest uppercase">{title}</span>
                </div>
                <button onClick={onOpenSettings} className="text-gray-500 hover:text-white transition-colors">
                    <Settings size={16} />
                </button>
            </div>

            {/* Balance */}
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 tracking-tight mb-2 font-mono">
                {formatCurrency(account.balance)}
            </h1>

            {/* Asset Toggle Removed */}
        </div>
    );
};

export default MobileHeader;
