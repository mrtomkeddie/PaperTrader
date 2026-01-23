import React from 'react';
import { AssetData, AssetSymbol, StrategyType } from '../../types';
import { Activity, Zap, TrendingUp, TrendingDown, Power, Clock } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';

interface Props {
    assets: Record<AssetSymbol, AssetData>;
    onToggleStrategy: (symbol: AssetSymbol, strategy: StrategyType) => void;
    onToggleAuto: (symbol: AssetSymbol) => void;
}

const STRATEGY_CONFIG: Record<string, StrategyType[]> = {

    [AssetSymbol.XAUUSD]: [StrategyType.AI_AGENT, StrategyType.LONDON_SWEEP, StrategyType.TREND_FOLLOW, StrategyType.MEAN_REVERT],
};

const AVAILABLE_STRATEGIES = [
    { type: StrategyType.AI_AGENT, label: 'Gemini AI', icon: Zap, color: 'purple' },
    { type: StrategyType.TREND_FOLLOW, label: 'Trend', icon: TrendingUp, color: 'blue' },
    { type: StrategyType.MEAN_REVERT, label: 'MeanRev', icon: TrendingDown, color: 'orange' },
    { type: StrategyType.NY_ORB, label: 'NY ORB', icon: Clock, color: 'blue' },
    { type: StrategyType.LONDON_SWEEP, label: 'London', icon: Activity, color: 'yellow' },
];

const AssetCard: React.FC<{
    asset: AssetData;
    onToggleStrategy: (symbol: AssetSymbol, strategy: StrategyType) => void;
    onToggleAuto: (symbol: AssetSymbol) => void;
}> = ({ asset, onToggleStrategy, onToggleAuto }) => {
    // Transform history for mini chart
    const data = asset.history.map(h => ({ value: h.value }));
    const isUp = data.length > 1 && data[data.length - 1].value >= data[0].value;
    const color = isUp ? '#22c55e' : '#ef4444';
    const activeStrategies = asset.activeStrategies || [];

    return (
        <div className="bg-[#13141b] rounded-[32px] p-6 border border-white/5 shadow-xl relative overflow-hidden mb-6">
            {/* Header */}
            <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#1C1C1E] flex items-center justify-center border border-white/5">
                        <Activity size={20} className="text-blue-500" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white leading-none">{asset.symbol}</h2>
                        <span className="text-xl font-mono font-bold text-white/90">{asset.currentPrice.toFixed(1)}</span>
                    </div>
                </div>
                <div className={`px-2 py-1 rounded-lg border ${isUp ? 'border-green-500/20 bg-green-500/10 text-green-500' : 'border-red-500/20 bg-red-500/10 text-red-500'}`}>
                    <div className="flex items-center gap-1 text-xs font-bold">
                        {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        0.00%
                    </div>
                </div>
            </div>

            {/* Mini Chart */}
            <div className="h-32 -mx-2 mb-6">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data}>
                        <defs>
                            <linearGradient id={`mobileChartColor-${asset.symbol}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={color} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <Area
                            type="monotone"
                            dataKey="value"
                            stroke={color}
                            strokeWidth={2}
                            fill={`url(#mobileChartColor-${asset.symbol})`}
                        />
                        <YAxis domain={['dataMin', 'dataMax']} hide />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {/* Strategy Toggles */}
            <div className="mb-6">
                <h3 className="text-xs font-bold text-gray-500 uppercase mb-3 ml-1">Active Strategies</h3>
                <div className="flex flex-wrap gap-2">
                    {AVAILABLE_STRATEGIES
                        .filter(s => STRATEGY_CONFIG[asset.symbol]?.includes(s.type))
                        .map((strat) => {
                            const isActive = activeStrategies.includes(strat.type);

                            // Determine active color classes based on asset
                            const activeClasses = asset.symbol === AssetSymbol.XAUUSD
                                ? 'bg-yellow-600 text-white border-yellow-500 shadow-lg shadow-yellow-900/20'
                                : 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-900/20';

                            return (
                                <button
                                    key={strat.type}
                                    onClick={() => onToggleStrategy(asset.symbol, strat.type)}
                                    className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 border
                                ${isActive
                                            ? activeClasses
                                            : 'bg-[#1C1C1E] text-gray-500 border-white/5 hover:bg-white/5'}`}
                                >
                                    <strat.icon size={14} className={isActive ? 'text-white' : 'text-gray-500'} />
                                    {strat.label}
                                </button>
                            );
                        })}
                </div>
            </div>

            {/* Auto Trading Toggle */}
            <div className="bg-[#1C1C1E] rounded-2xl p-4 flex justify-between items-center border border-white/5">
                <div>
                    <div className="text-white font-bold text-sm">Auto-Trading</div>
                    <div className="text-[10px] text-gray-500">{asset.botActive ? 'Engine is running' : 'Engine paused'}</div>
                </div>
                <button
                    onClick={() => onToggleAuto(asset.symbol)}
                    className={`w-12 h-7 rounded-full p-1 transition-colors duration-300 ${asset.botActive ? 'bg-green-500' : 'bg-gray-600'}`}
                >
                    <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300 ${asset.botActive ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
            </div>
        </div>
    );
};

const MobileDashboard: React.FC<Props> = ({ assets, onToggleStrategy, onToggleAuto }) => {
    return (
        <div className="px-4 pb-24">
            {/* Render both cards explicitly for requested layout */}


            {assets[AssetSymbol.XAUUSD] && (
                <AssetCard
                    asset={assets[AssetSymbol.XAUUSD]}
                    onToggleStrategy={onToggleStrategy}
                    onToggleAuto={onToggleAuto}
                />
            )}
        </div>
    );
};

export default MobileDashboard;
