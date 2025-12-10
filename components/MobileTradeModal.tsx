import React from 'react';
import { X } from 'lucide-react';
import { Trade, AssetData, StrategyType, AssetSymbol } from '../types';
import SignalPanel from './SignalPanel';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    trade: Trade | null;
    assetData?: AssetData;
}

const MobileTradeModal: React.FC<Props> = ({ isOpen, onClose, trade, assetData }) => {
    if (!isOpen || !trade || !assetData) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:hidden">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
            
            <div className="relative w-full max-h-[90vh] h-[600px] flex flex-col bg-[#13141b] rounded-2xl border border-white/10 shadow-2xl overflow-hidden animate-fade-in-up">
                {/* Close Button Header */}
                <div className="absolute top-4 right-4 z-10">
                    <button 
                        onClick={onClose}
                        className="p-2 bg-black/50 rounded-full text-white/70 hover:text-white border border-white/5 backdrop-blur-md"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content - Reusing SignalPanel */}
                <div className="flex-1 overflow-hidden p-2">
                    <SignalPanel 
                        asset={assetData} 
                        trade={trade} 
                        hideStrategies={true}
                        // We don't pass onToggleStrategy or onClearSelection because this is a read-only view of the trade
                    />
                </div>
            </div>
        </div>
    );
};

export default MobileTradeModal;
