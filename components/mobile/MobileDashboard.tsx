import React from 'react';
import { AssetData, AssetSymbol, StrategyType } from '../../types';
import { Activity, Zap, TrendingUp, TrendingDown, Power, Clock } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

interface Props {
    asset: AssetData;
    activeStrategies: StrategyType[];
    onToggleStrategy: (symbol: AssetSymbol, strategy: StrategyType) => void;
    isAutoTrading: boolean;
    onToggleAuto: () => void;
}

const MobileDashboard: React.FC<Props> = ({ asset, activeStrategies, onToggleStrategy, isAutoTrading, onToggleAuto }) => {
    // Transform history for mini chart
    const data = asset.history.map(h => ({ value: h.value }));
    const isUp = data.length > 1 && data[data.length - 1].value >= data[0].value;
    const color = isUp ? '#22c55e' : '#ef4444';

    // Calculate mock win rate/stats based on asset data (or passed props if available)
    // For now hardcoded or derived to match the visual style
    const winRate = 33;
    const wins = 1;
    const losses = 10;
    
    return (
        <div className="px-4 pb-24">
            <div className="bg-[#13141b] rounded-[32px] p-6 border border-white/5 shadow-xl relative overflow-hidden">
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
                                <linearGradient id="mobileChartColor" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor={color} stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <Area 
                                type="monotone" 
                                dataKey="value" 
                                stroke={color} 
                                strokeWidth={2}
                                fill="url(#mobileChartColor)" 
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                    <div className="bg-[#1C1C1E] rounded-2xl p-3 border border-white/5">
                        <div className="text-[9px] font-bold text-gray-500 uppercase mb-1">Net P&L</div>
                        <div className="text-red-500 font-bold text-sm">-27.14</div>
                    </div>
                    <div className="bg-[#1C1C1E] rounded-2xl p-3 border border-white/5">
                        <div className="text-[9px] font-bold text-gray-500 uppercase mb-1">Win Rate</div>
                        <div className="text-white font-bold text-sm">{winRate}%</div>
                    </div>
                    <div className="bg-[#1C1C1E] rounded-2xl p-3 border border-white/5">
                        <div className="text-[9px] font-bold text-gray-500 uppercase mb-1">O / W / L</div>
                        <div className="text-gray-300 font-bold text-xs flex gap-1">
                            <span className="text-white">1</span>/
                            <span className="text-green-500">{wins}</span>/
                            <span className="text-red-500">{losses}</span>
                        </div>
                    </div>
                </div>

                {/* Strategies */}
                <div className="mb-6">
                    <label className="text-[10px] font-bold text-gray-500 uppercase mb-3 block">Active Strategies</label>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => onToggleStrategy(asset.symbol, StrategyType.NY_ORB)}
                            className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all ${activeStrategies.includes(StrategyType.NY_ORB) ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'bg-[#1C1C1E] text-gray-500 border border-white/5'}`}
                        >
                            <Clock size={14} /> NY ORB
                        </button>
                        <button 
                            onClick={() => onToggleStrategy(asset.symbol, StrategyType.AI_AGENT)}
                            className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all ${activeStrategies.includes(StrategyType.AI_AGENT) ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/20' : 'bg-[#1C1C1E] text-gray-500 border border-white/5'}`}
                        >
                            <Zap size={14} /> Gemini AI
                        </button>
                    </div>
                </div>

                {/* Auto Trading Toggle */}
                <div className="bg-[#1C1C1E] rounded-2xl p-4 flex justify-between items-center border border-white/5">
                    <div>
                        <div className="text-white font-bold text-sm">Auto-Trading</div>
                        <div className="text-[10px] text-gray-500">{isAutoTrading ? 'Engine is running' : 'Engine paused'}</div>
                    </div>
                    <button 
                        onClick={onToggleAuto}
                        className={`w-12 h-7 rounded-full p-1 transition-colors duration-300 ${isAutoTrading ? 'bg-green-500' : 'bg-gray-700'}`}
                    >
                        <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-300 ${isAutoTrading ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MobileDashboard;
