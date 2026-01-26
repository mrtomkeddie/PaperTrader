import React, { useMemo } from 'react';
import { AssetData, AssetSymbol, StrategyType, Trade } from '../../types';
import { Activity, Zap, TrendingUp, TrendingDown, Layers, BarChart3, Target, Flame } from 'lucide-react';
import MobilePerformanceCard from './MobilePerformanceCard';
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';

interface Props {
    assets: Record<AssetSymbol, AssetData>;
    trades: Trade[];
    onToggleStrategy: (symbol: AssetSymbol, strategy: StrategyType) => void;
    onToggleAuto: (symbol: AssetSymbol) => void;
}

const STRATEGY_CONFIG: Record<string, StrategyType[]> = {
    [AssetSymbol.XAUUSD]: [StrategyType.AI_AGENT, StrategyType.LONDON_SWEEP, StrategyType.TREND_FOLLOW, StrategyType.MEAN_REVERT],
};

const AVAILABLE_STRATEGIES = [
    { type: StrategyType.AI_AGENT, label: 'Gemini AI', icon: Zap, color: 'text-purple-400' },
    { type: StrategyType.TREND_FOLLOW, label: 'Trend', icon: TrendingUp, color: 'text-blue-400' },
    { type: StrategyType.MEAN_REVERT, label: 'MeanRev', icon: TrendingDown, color: 'text-orange-400' },
    { type: StrategyType.LONDON_SWEEP, label: 'London', icon: Activity, color: 'text-yellow-400' },
];

const AssetCard: React.FC<{
    asset: AssetData;
    onToggleStrategy: (symbol: AssetSymbol, strategy: StrategyType) => void;
    onToggleAuto: (symbol: AssetSymbol) => void;
}> = ({ asset, onToggleStrategy, onToggleAuto }) => {
    // Transform history for mini chart
    const data = asset.history.map(h => ({ value: h.value }));
    const isUp = data.length > 1 && data[data.length - 1].value >= data[0].value;
    const color = isUp ? '#ccff00' : '#ef4444'; // Neon Green or Red
    const activeStrategies = asset.activeStrategies || [];

    // Calculate percent change (mock calculation for visual)
    const prevClose = data.length > 10 ? data[data.length - 10].value : data[0]?.value || asset.currentPrice;
    const pctChange = ((asset.currentPrice - prevClose) / prevClose) * 100;

    return (
        <div className="bg-[#1c1c1e] rounded-[32px] p-6 border border-white/5 relative overflow-hidden mb-8 shadow-2xl">
            {/* Header Section */}
            <div className="flex justify-between items-start mb-8 relative z-10">
                <div>
                    <h2 className="text-3xl font-bold text-white tracking-tight mb-1">{asset.symbol}</h2>
                    <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${isUp ? 'bg-[#ccff00]/10 text-[#ccff00]' : 'bg-red-500/10 text-red-500'}`}>
                            {pctChange > 0 ? '+' : ''}{pctChange.toFixed(2)}%
                        </span>
                        <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Intraday</span>
                    </div>
                </div>

                {/* Auto Toggle Pill */}
                <button
                    onClick={() => onToggleAuto(asset.symbol)}
                    className={`flex items-center gap-2 pl-3 pr-1 py-1 rounded-full border transition-all duration-300 ${asset.botActive
                            ? 'bg-[#ccff00]/10 border-[#ccff00]/20 text-[#ccff00]'
                            : 'bg-white/5 border-white/10 text-gray-400'
                        }`}
                >
                    <span className="text-[10px] font-bold tracking-wide uppercase">
                        {asset.botActive ? 'Active' : 'Paused'}
                    </span>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${asset.botActive ? 'bg-[#ccff00] text-black' : 'bg-[#2c2c2e] text-gray-500'
                        }`}>
                        <Power size={12} strokeWidth={3} />
                    </div>
                </button>
            </div>

            {/* Main Price & Chart Area */}
            <div className="relative mb-8">
                <div className="text-5xl font-mono font-bold text-white tracking-tighter mb-4">
                    {asset.currentPrice.toFixed(2)}
                </div>

                {/* Chart Overlay */}
                <div className="h-24 w-full opacity-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data}>
                            <defs>
                                <linearGradient id={`mobileChartColor-${asset.symbol}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={color} stopOpacity={0.4} />
                                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <Area
                                type="monotone"
                                dataKey="value"
                                stroke={color}
                                strokeWidth={3}
                                strokeLinecap="round"
                                fill={`url(#mobileChartColor-${asset.symbol})`}
                                isAnimationActive={false}
                            />
                            <YAxis domain={['dataMin', 'dataMax']} hide />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Strategies Grid - Bento Style */}
            <div>
                <div className="flex items-center justify-between mb-3 px-1">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                        <Layers size={12} /> Active Agents
                    </h3>
                    <span className="text-[10px] font-bold bg-[#2c2c2e] text-gray-400 px-2 py-0.5 rounded-md">
                        {activeStrategies.length} Enabled
                    </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    {AVAILABLE_STRATEGIES
                        .filter(s => STRATEGY_CONFIG[asset.symbol]?.includes(s.type))
                        .map((strat) => {
                            const isActive = activeStrategies.includes(strat.type);
                            return (
                                <button
                                    key={strat.type}
                                    onClick={() => onToggleStrategy(asset.symbol, strat.type)}
                                    className={`relative group overflow-hidden rounded-2xl p-3 text-left transition-all duration-200 border ${isActive
                                            ? 'bg-[#2c2c2e] border-white/10'
                                            : 'bg-[#1c1c1e] border-transparent opacity-60'
                                        }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className={`p-1.5 rounded-lg ${isActive ? 'bg-white/10' : 'bg-white/5'} ${strat.color}`}>
                                            <strat.icon size={14} strokeWidth={2.5} />
                                        </div>
                                        {isActive && (
                                            <div className="h-1.5 w-1.5 rounded-full bg-[#ccff00] shadow-[0_0_8px_#ccff00]" />
                                        )}
                                    </div>
                                    <div className="text-xs font-bold text-gray-200">{strat.label}</div>
                                    <div className="text-[10px] text-gray-500 font-medium leading-tight mt-0.5">
                                        {isActive ? 'Monitoring market' : 'Disabled'}
                                    </div>

                                    {/* Active Glow Effect */}
                                    {isActive && (
                                        <div className="absolute inset-0 border-2 border-white/5 rounded-2xl pointer-events-none" />
                                    )}
                                </button>
                            );
                        })}
                </div>
            </div>
        </div>
    );
};

const MobileDashboard: React.FC<Props> = ({ assets, trades, onToggleStrategy, onToggleAuto }) => {
    // Calculate Daily Progress for "Greeting"
    const todayTrades = trades.filter(t => {
        if (t.status === 'OPEN') return false;
        const d = new Date(t.closeTime || 0);
        const now = new Date();
        return d.getDate() === now.getDate() && d.getMonth() === now.getMonth();
    });
    const dailyPnL = todayTrades.reduce((sum, t) => sum + t.pnl, 0);
    const dailyGoal = 100; // Mock Goal
    const progress = Math.min((Math.max(0, dailyPnL) / dailyGoal) * 100, 100);

    return (
        <div className="min-h-screen bg-black text-white px-5 pt-8 pb-32 font-sans">
            {/* Greeting Header */}
            <div className="mb-8">
                <div className="flex justify-between items-end mb-2">
                    <div>
                        <div className="text-gray-400 text-sm font-medium mb-0.5">Welcome back,</div>
                        <h1 className="text-3xl font-bold tracking-tight">Trader</h1>
                    </div>
                    <div className="bg-[#1c1c1e] p-2 rounded-full border border-white/10">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#ccff00] to-green-500 flex items-center justify-center text-black font-bold">T</div>
                    </div>
                </div>

                {/* Daily Goal Progress */}
                <div className="bg-[#1c1c1e] rounded-2xl p-4 border border-white/5 mt-4 flex items-center justify-between">
                    <div>
                        <div className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                            <Target size={12} className="text-[#ccff00]" /> Daily Goal
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-xl font-bold text-white">£{dailyPnL.toFixed(0)}</span>
                            <span className="text-xs text-gray-500 font-medium">/ £{dailyGoal}</span>
                        </div>
                    </div>
                    <div className="w-24 h-2 bg-[#2c2c2e] rounded-full overflow-hidden">
                        <div
                            className="h-full bg-[#ccff00] rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <div className="h-10 w-10 flex items-center justify-center rounded-full bg-[#ccff00]/10 text-[#ccff00]">
                        <Flame size={18} fill={progress >= 100 ? "#ccff00" : "none"} />
                    </div>
                </div>
            </div>

            {assets[AssetSymbol.XAUUSD] && (
                <>
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <BarChart3 size={18} className="text-[#ccff00]" />
                        Market Overview
                    </h3>

                    <AssetCard
                        asset={assets[AssetSymbol.XAUUSD]}
                        onToggleStrategy={onToggleStrategy}
                        onToggleAuto={onToggleAuto}
                    />

                    <h3 className="text-lg font-bold mb-4 mt-8 flex items-center gap-2">
                        <Activity size={18} className="text-blue-400" />
                        Performance
                    </h3>
                    <MobilePerformanceCard trades={trades} filter="TODAY" />
                </>
            )}
        </div>
    );
};

export default MobileDashboard;
