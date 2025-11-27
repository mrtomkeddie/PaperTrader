
import React, { useMemo } from 'react';
import { AssetData, StrategyType, AssetSymbol, Trade } from '../types';
import { ASSET_CONFIG } from '../constants';
import { TrendingUp, TrendingDown, Sparkles, BrainCircuit, ChevronUp, ChevronDown, CircleDollarSign, Activity, Landmark, Clock } from 'lucide-react';
import Sparkline from './Sparkline';

interface Props {
    asset: AssetData;
    trades: Trade[];
    toggleBot: (s: AssetSymbol) => void;
    setStrategy: (s: AssetSymbol, st: StrategyType) => void; // This maps to toggleStrategy in hook
}

const AssetCard: React.FC<Props> = ({ asset, trades, toggleBot, setStrategy }) => {
    const config = ASSET_CONFIG[asset.symbol];
    const isUp = asset.history.length > 1 && asset.history[asset.history.length - 1].value >= asset.history[asset.history.length - 2].value;

    const trendIsBullish = asset.trend === 'UP';

    // --- Performance Calculations ---
    const stats = useMemo(() => {
        const closedTrades = trades.filter(t => t.status === 'CLOSED');
        const openCount = trades.filter(t => t.status === 'OPEN').length;
        const totalTrades = closedTrades.length;
        const wins = closedTrades.filter(t => t.pnl > 0).length;
        const losses = totalTrades - wins;
        const totalPnL = closedTrades.reduce((acc, t) => acc + t.pnl, 0);
        const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
        return { totalPnL, winRate, wins, losses, totalTrades, openCount };
    }, [trades]);

    const getIcon = () => {
        switch (asset.symbol) {
            case AssetSymbol.XAUUSD: return <CircleDollarSign size={24} strokeWidth={2} />;
            case AssetSymbol.NAS100: return <Activity size={24} strokeWidth={2} />;
            default: return <Activity size={24} />;
        }
    };

    const getIconColor = () => {
        switch (asset.symbol) {
            case AssetSymbol.XAUUSD: return 'bg-yellow-500/20 text-yellow-400';
            case AssetSymbol.NAS100: return 'bg-blue-500/20 text-blue-400';
            default: return 'bg-gray-500/20 text-gray-400';
        }
    };

    const getAvailableStrategies = (symbol: AssetSymbol) => {
        if (symbol === AssetSymbol.XAUUSD) {
            return [StrategyType.LONDON_SWEEP, StrategyType.AI_AGENT];
        }
        if (symbol === AssetSymbol.NAS100) {
            return [StrategyType.NY_ORB, StrategyType.AI_AGENT];
        }
        return [StrategyType.AI_AGENT];
    };

    const availableStrategies = getAvailableStrategies(asset.symbol);
    const pnlIsPositive = stats.totalPnL >= 0;

    return (
        <div className="bg-ios-card rounded-[22px] p-5 mb-6 lg:mb-0 relative overflow-hidden shadow-2xl shadow-black/50 border border-white/5">

            {/* Thinking Indicator Overlay */}
            {asset.isThinking && (
                <div className="absolute top-0 right-0 p-4 z-10">
                    <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                        <BrainCircuit size={14} className="text-purple-400 animate-pulse" />
                        <span className="text-[10px] font-bold text-purple-200">AI ANALYZING</span>
                    </div>
                </div>
            )}

            {/* Header Row */}
            <div className="flex justify-between items-start mb-6 pt-2">
                <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${getIconColor()}`}>
                        {getIcon()}
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white tracking-tight">{asset.symbol}</h3>
                        <div className="flex items-center gap-1.5">
                            <span className="text-2xl font-bold tracking-tight tabular-nums text-white">
                                {asset.currentPrice.toLocaleString('en-US', { minimumFractionDigits: config.decimals, maximumFractionDigits: config.decimals })}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${isUp ? 'bg-ios-green/10 text-ios-green' : 'bg-ios-red/10 text-ios-red'}`}>
                        {isUp ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                        <span className="text-sm font-bold tabular-nums">
                            {asset.history.length > 0 ? (((asset.currentPrice - asset.history[0].value) / asset.history[0].value) * 100).toFixed(2) : '0.00'}%
                        </span>
                    </div>

                    {/* Macro Trend Badge */}
                    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${trendIsBullish ? 'border-ios-green/30 text-ios-green' : 'border-ios-red/30 text-ios-red'}`}>
                        <span>Macro:</span>
                        {trendIsBullish ? <ChevronUp size={10} strokeWidth={4} /> : <ChevronDown size={10} strokeWidth={4} />}
                        <span>{asset.trend}</span>
                    </div>
                </div>
            </div>

            {/* Sparkline Visualization */}
            <div className="h-12 w-full mb-6 mt-[-10px] opacity-90">
                <Sparkline data={asset.history.map(h => h.value)} trend={asset.trend} width={320} height={48} />
            </div>

            {/* Performance Stats Grid (Replaces Chart & Indicators) */}
            <div className="grid grid-cols-3 gap-3 mb-6">
                {/* PnL */}
                <div className="bg-white/5 rounded-xl p-3 border border-white/5 flex flex-col justify-center">
                    <span className="text-[9px] text-ios-gray uppercase font-bold mb-1">Net P&L</span>
                    <span className={`text-sm font-bold tabular-nums ${pnlIsPositive ? 'text-ios-green' : 'text-ios-red'}`}>
                        {pnlIsPositive ? '+' : ''}{stats.totalPnL.toFixed(2)}
                    </span>
                </div>

                {/* Win Rate */}
                <div className="bg-white/5 rounded-xl p-3 border border-white/5 flex flex-col justify-center">
                    <span className="text-[9px] text-ios-gray uppercase font-bold mb-1">Win Rate</span>
                    <div className="flex items-baseline gap-0.5">
                        <span className="text-sm font-bold text-white tabular-nums">{stats.winRate.toFixed(0)}</span>
                        <span className="text-[10px] text-ios-gray">%</span>
                    </div>
                </div>

                {/* O/W/L Count */}
                <div className="bg-white/5 rounded-xl p-3 border border-white/5 flex flex-col justify-center">
                    <span className="text-[9px] text-ios-gray uppercase font-bold mb-1">O / W / L</span>
                    <div className="flex items-center gap-1 text-xs font-bold">
                        <span className="text-white">{stats.openCount}</span>
                        <span className="text-white/20">/</span>
                        <span className="text-ios-green">{stats.wins}</span>
                        <span className="text-white/20">/</span>
                        <span className="text-ios-red">{stats.losses}</span>
                    </div>
                </div>
            </div>

            {/* Controls Section */}
            <div className="space-y-4">
                {/* Strategy Segmented Control - Now Multi-Select */}
                <div>
                    <label className="text-[11px] font-semibold text-ios-gray uppercase tracking-wider ml-1 mb-2 block">Active Strategies</label>
                    <div className="bg-black/40 p-1.5 rounded-xl flex flex-wrap gap-2">
                        {availableStrategies.map((strat) => {
                            const isActive = asset.activeStrategies.includes(strat);
                            let label: string = strat;
                            let activeColor = 'bg-[#3A3A3C]';
                            let textColor = 'text-white';

                            if (strat === StrategyType.AI_AGENT) {
                                label = 'Gemini AI';
                                activeColor = 'bg-purple-600/80';
                            }
                            if (strat === StrategyType.LONDON_SWEEP) {
                                label = 'Ldn Sweep';
                                activeColor = 'bg-yellow-600/80';
                            }
                            if (strat === StrategyType.LONDON_CONTINUATION) {
                                label = 'Ldn Cont.';
                            }
                            if (strat === StrategyType.NY_ORB) {
                                label = 'NY ORB';
                                activeColor = 'bg-blue-600/80';
                            }
                            if (strat === StrategyType.TREND_FOLLOW) {
                                label = 'Trend Follow';
                                activeColor = 'bg-orange-600/80';
                            }

                            return (
                                <button
                                    key={strat}
                                    type="button"
                                    onClick={() => setStrategy(asset.symbol, strat)}
                                    className={`flex-1 py-2 px-3 min-w-[80px] rounded-[9px] text-[10px] font-bold transition-all duration-200 flex items-center justify-center gap-1.5 border
                                ${isActive
                                            ? `${activeColor} ${textColor} border-white/10 shadow-md scale-[1.02]`
                                            : 'bg-[#1C1C1E] text-neutral-500 border-transparent hover:bg-white/5'}`}
                                >
                                    {strat === StrategyType.AI_AGENT && <Sparkles size={10} className={isActive ? 'text-white' : ''} />}
                                    {(strat === StrategyType.LONDON_SWEEP || strat === StrategyType.LONDON_CONTINUATION) && <Landmark size={10} className={isActive ? 'text-white' : ''} />}
                                    {strat === StrategyType.NY_ORB && <Clock size={10} className={isActive ? 'text-white' : ''} />}
                                    {strat === StrategyType.TREND_FOLLOW && <TrendingUp size={10} className={isActive ? 'text-white' : ''} />}
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Bot Toggle Switch */}
                <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                    <div className="flex flex-col">
                        <span className="text-sm font-semibold text-white">Auto-Trading</span>
                        <span className="text-[10px] text-ios-gray">
                            {asset.botActive ? 'Engine is running' : 'Engine paused'}
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={() => toggleBot(asset.symbol)}
                        className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 ease-in-out ${asset.botActive ? 'bg-ios-green' : 'bg-neutral-700'}`}
                    >
                        <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-300 ${asset.botActive ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AssetCard;
