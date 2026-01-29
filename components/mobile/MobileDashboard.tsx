import React from 'react';
import { AssetSymbol, AssetData, Trade, StrategyType } from '../../types';
import AssetCard from '../AssetCard';

interface Props {
    assets: Record<AssetSymbol, AssetData>;
    trades: Trade[];
    onToggleStrategy: (symbol: AssetSymbol, strategy: StrategyType) => void;
    onToggleAuto: (symbol: AssetSymbol) => void;
}

const MobileDashboard: React.FC<Props> = ({ assets, trades, onToggleStrategy, onToggleAuto }) => {
    return (
        <div className="p-4 space-y-4">
            {Object.values(assets).map(asset => (
                <AssetCard
                    key={asset.symbol}
                    asset={asset}
                    trades={trades.filter(t => t.symbol === asset.symbol)}
                    toggleBot={onToggleAuto}
                    setStrategy={onToggleStrategy}
                />
            ))}
        </div>
    );
};

export default MobileDashboard;
