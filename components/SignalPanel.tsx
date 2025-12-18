import React from 'react';
import { AssetData, Trade, StrategyType, AssetSymbol } from '../types';
import { AlertTriangle, TrendingUp, TrendingDown, Shield, Target, Zap } from 'lucide-react';

interface Props {
    asset: AssetData;
    trade: Trade | null | undefined; // Selected trade
    activeOpenTrade?: Trade | undefined; // Background active trade
    onToggleStrategy?: (symbol: AssetSymbol, strategy: StrategyType) => void;
    onClearSelection?: () => void;
    hideStrategies?: boolean;
}

const STRATEGY_CONFIG: Record<string, StrategyType[]> = {
    [AssetSymbol.NAS100]: [StrategyType.AI_AGENT, StrategyType.NY_ORB, StrategyType.TREND_FOLLOW, StrategyType.MEAN_REVERT],
    [AssetSymbol.XAUUSD]: [StrategyType.AI_AGENT, StrategyType.LONDON_SWEEP, StrategyType.TREND_FOLLOW, StrategyType.MEAN_REVERT],
};

const AVAILABLE_STRATEGIES = [
    { type: StrategyType.AI_AGENT, label: 'Gemini AI' },
    { type: StrategyType.TREND_FOLLOW, label: 'Trend Follow' },
    { type: StrategyType.MEAN_REVERT, label: 'Mean Revert' },
    { type: StrategyType.NY_ORB, label: 'NY ORB' },
    { type: StrategyType.LONDON_SWEEP, label: 'London Sweep' },
];

const SignalPanel: React.FC<Props> = ({ asset, trade, activeOpenTrade, onToggleStrategy, onClearSelection, hideStrategies }) => {
    // Determine Signal Status
    // If a specific trade is selected, show its status.
    // If Live View (no trade selected), show AI Sentiment.
    
    let signalTitle = "WAITING FOR SIGNAL";
    let signalColor = "bg-gray-800 text-gray-400";
    let confidence = trade?.confidence ?? asset.aiConfidence ?? 0;
    
    if (trade) {
        if (trade.status === 'CLOSED') {
            signalTitle = `${trade.type} CLOSED`;
            signalColor = "bg-gray-700 text-gray-300 border-gray-600";
        } else if (trade.type === 'BUY') {
            signalTitle = "LONG POSITION ACTIVE";
            signalColor = "bg-green-500/20 text-green-500 border-green-500/50";
        } else {
            signalTitle = "SHORT POSITION ACTIVE";
            signalColor = "bg-red-500/20 text-red-500 border-red-500/50";
        }
    } else if (asset.aiSentiment && asset.aiSentiment !== 'NEUTRAL') {
        if (asset.aiSentiment === 'BULLISH') {
            signalTitle = confidence > 80 ? "STRONG BUY" : "BUY SIGNAL";
            signalColor = "bg-green-600 text-white shadow-[0_0_20px_rgba(22,163,74,0.5)]";
        } else {
            signalTitle = confidence > 80 ? "STRONG SELL" : "SELL SIGNAL";
            signalColor = "bg-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.5)]";
        }
    } else {
        // Fallback to trend
        if (asset.trend === 'UP') {
            signalTitle = "BULLISH TREND";
            signalColor = "bg-green-900/50 text-green-400 border border-green-500/30";
        } else if (asset.trend === 'DOWN') {
            signalTitle = "BEARISH TREND";
            signalColor = "bg-red-900/50 text-red-400 border border-red-500/30";
        }
    }

    const slPrice = trade ? trade.stopLoss : (asset.currentPrice * (asset.trend === 'UP' ? 0.995 : 1.005));
    const tpPrice = trade ? trade.tpLevels[0].price : (asset.currentPrice * (asset.trend === 'UP' ? 1.01 : 0.99));

    // Use entryReason if viewing a past/active trade, otherwise live AI reason
    const reasonText = trade?.entryReason || asset.aiReason || "AI is analyzing market structure. Waiting for clear confirmation...";
    
    const getFriendlyOutcome = (t: Trade) => {
        if (t.closeReason === 'STOP_LOSS') {
            if (t.pnl > 0) return "Closed by Trailing Stop. Although the final portion stopped out, partial profits were already banked.";
            return "Stop Loss Hit: The market reversed. Trade closed to protect capital.";
        }
        return t.outcomeReason;
    };

    return (
        <div className="bg-[#13141b] rounded-2xl p-4 md:p-6 border border-white/5 h-full flex flex-col relative overflow-hidden">
            {/* Background Active Trade Indicator (Only in Live View) */}
            {!trade && activeOpenTrade && (
                <div className="absolute top-0 left-0 right-0 bg-blue-600/10 border-b border-blue-500/20 px-4 py-1.5 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                         <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                         <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Position Running</span>
                    </div>
                    <span className={`text-[10px] font-mono font-bold ${(activeOpenTrade.floatingPnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {(activeOpenTrade.floatingPnl || 0) >= 0 ? '+' : ''}{(activeOpenTrade.floatingPnl || 0).toFixed(2)}
                    </span>
                </div>
            )}

            <div className={`flex justify-between items-start mb-6 ${(!trade && activeOpenTrade) ? 'mt-6' : ''}`}>
                <h3 className="text-lg font-bold text-white">
                    {trade ? (
                        <div className="flex flex-col">
                            <span className="text-xl">{trade.symbol}</span>
                            <span className="text-xs text-gray-500 font-normal">
                                {new Date(trade.openTime).toLocaleString('en-GB', { 
                                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' 
                                })}
                            </span>
                        </div>
                    ) : "Live Market Monitor"}
                </h3>
                
                {trade && onClearSelection && (
                    <button 
                        onClick={onClearSelection}
                        className="px-3 py-1.5 bg-blue-600/20 text-blue-400 text-xs font-bold rounded-lg hover:bg-blue-600/30 transition-colors border border-blue-500/30 flex items-center gap-2"
                    >
                        <Zap size={12} /> Live View
                    </button>
                )}
            </div>

            {/* Signal Banner */}
            <div className={`w-full py-3 px-4 rounded-xl flex items-center justify-center mb-6 border border-transparent ${signalColor} transition-all duration-500`}>
                <h2 className="text-xl font-black tracking-tighter uppercase">{signalTitle}</h2>
            </div>

            {/* Stats Grid */}
            <div className="space-y-4 mb-6">
                <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Confidence:</span>
                    <span className="text-white font-bold">{confidence}%</span>
                </div>
                
                {trade && (
                    <>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-400 flex items-center gap-2"><Shield size={14} /> Stop Loss:</span>
                            <span className="text-red-400 font-mono">{slPrice.toFixed(2)}</span>
                        </div>
                        
                        {/* Take Profit Ladder */}
                        <div className="space-y-2 pt-2 border-t border-white/5">
                            {trade.tpLevels.map((tp) => (
                                <div key={tp.id} className="flex justify-between items-center text-sm">
                                    <span className={`flex items-center gap-1 ${tp.hit ? 'text-green-500 font-bold' : 'text-gray-400'}`}>
                                        <Target size={12} className={tp.hit ? "text-green-500 fill-green-500/20" : ""}/> TP {tp.id} ({tp.percentage * 100}%):
                                    </span>
                                    <span className={`${tp.hit ? 'text-green-500 line-through' : 'text-green-400'} font-mono font-bold`}>
                                        {tp.price.toFixed(2)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* AI Reasoning Box */}
            <div className="bg-black/30 rounded-xl p-4 border border-white/5 flex-1 mb-6 overflow-y-auto">
                <div className="flex items-center gap-2 mb-2">
                    <Zap size={14} className="text-yellow-500" />
                    <span className="text-xs font-bold text-gray-300 uppercase">
                        {trade ? "Entry Analysis" : "Live AI Analysis"}
                    </span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                    {reasonText}
                </p>
                
                {trade && getFriendlyOutcome(trade) && (
                    <div className="mt-4 pt-3 border-t border-white/10">
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp size={14} className={trade.pnl >= 0 ? "text-green-500" : "text-red-500"} />
                            <span className="text-xs font-bold text-gray-300 uppercase">Outcome Analysis</span>
                        </div>
                        <p className="text-xs text-gray-400 leading-relaxed">
                            {getFriendlyOutcome(trade)}
                        </p>
                    </div>
                )}

                <div className="mt-3 text-[10px] text-gray-600 border-t border-white/5 pt-2">
                    Trend: {asset.trend} | RSI: {asset.rsi.toFixed(1)} | Vol: {(asset.bollinger.upper - asset.bollinger.lower).toFixed(2)}
                </div>
            </div>

            {/* Strategy Toggles (Show if no trade OR if trade is active/open) */}
            {(!trade || trade.status === 'OPEN') && onToggleStrategy && !hideStrategies && (
                <div className="border-t border-white/5 pt-4 mt-auto">
                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
                        <Zap size={12} className="text-blue-400"/> Active Strategies
                    </h4>
                    <div className="space-y-3">
                        {AVAILABLE_STRATEGIES
                            .filter(s => STRATEGY_CONFIG[asset.symbol]?.includes(s.type))
                            .map((strat) => {
                             const isActive = asset.activeStrategies?.includes(strat.type) ?? false;
                             return (
                                <div key={strat.type} className="flex items-center justify-between group">
                                    <span className={`text-sm transition-colors ${isActive ? 'text-white font-medium' : 'text-gray-500'}`}>
                                        {strat.label}
                                    </span>
                                    <button 
                                        onClick={() => onToggleStrategy(asset.symbol, strat.type)}
                                        className={`w-9 h-5 rounded-full relative transition-all duration-300 focus:outline-none ${isActive ? 'bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.3)]' : 'bg-gray-800 border border-gray-700'}`}
                                    >
                                        <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${isActive ? 'translate-x-4' : 'translate-x-0'}`} />
                                    </button>
                                </div>
                             );
                        })}
                    </div>
                </div>
            )}

            </div>
    );
};

export default SignalPanel;
