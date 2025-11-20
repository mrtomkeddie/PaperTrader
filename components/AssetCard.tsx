
import React from 'react';
import { AssetData, StrategyType, AssetSymbol } from '../types';
import { ASSET_CONFIG } from '../constants';
import { AreaChart, Area, YAxis, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Sparkles, BrainCircuit, ChevronUp, ChevronDown, CircleDollarSign, Activity, Landmark, Clock } from 'lucide-react';
import IndicatorBadge from './IndicatorBadge';

interface Props {
  asset: AssetData;
  toggleBot: (s: AssetSymbol) => void;
  setStrategy: (s: AssetSymbol, st: StrategyType) => void;
}

const AssetCard: React.FC<Props> = ({ asset, toggleBot, setStrategy }) => {
  const config = ASSET_CONFIG[asset.symbol];
  const isUp = asset.history.length > 1 && asset.history[asset.history.length - 1].value >= asset.history[asset.history.length - 2].value;
  
  const rsiStatus = asset.rsi < 30 ? 'buy' : asset.rsi > 70 ? 'sell' : 'neutral';
  const macdDiff = asset.macd.macdLine - asset.macd.signalLine;
  const macdStatus = macdDiff > 0 ? 'buy' : 'sell';
  const distToLower = asset.currentPrice - asset.bollinger.lower;
  const distToUpper = asset.bollinger.upper - asset.currentPrice;
  let bandStatus: 'neutral' | 'buy' | 'sell' = 'neutral';
  if (distToLower < 1) bandStatus = 'buy';
  if (distToUpper < 1) bandStatus = 'sell';
  
  const strokeColor = isUp ? '#30D158' : '#FF453A'; // iOS Green / Red
  const trendIsBullish = asset.trend === 'UP';

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

  // Determine optimal strategies per asset
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

  return (
    <div className="bg-ios-card rounded-[22px] p-5 mb-6 relative overflow-hidden shadow-2xl shadow-black/50 border border-white/5">
      
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
      <div className="flex justify-between items-start mb-6 pt-5">
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
                   {asset.history.length > 0 ? (((asset.currentPrice - asset.history[0].value)/asset.history[0].value)*100).toFixed(2) : '0.00'}%
                </span>
            </div>
            
            {/* Big Picture Trend Badge */}
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${trendIsBullish ? 'border-ios-green/30 text-ios-green' : 'border-ios-red/30 text-ios-red'}`}>
                <span>Macro:</span>
                {trendIsBullish ? <ChevronUp size={10} strokeWidth={4} /> : <ChevronDown size={10} strokeWidth={4} />}
                <span>{asset.trend}</span>
            </div>
        </div>
      </div>

      {/* Chart Area */}
      <div className="h-28 mb-6 -mx-5">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={asset.history}>
            <defs>
              <linearGradient id={`grad${asset.symbol}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={strokeColor} stopOpacity={0.25}/>
                <stop offset="100%" stopColor={strokeColor} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <YAxis domain={['dataMin', 'dataMax']} hide />
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke={strokeColor} 
              strokeWidth={2.5}
              fill={`url(#grad${asset.symbol})`} 
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Live Indicators */}
      <div className="grid grid-cols-3 gap-3 mb-6">
         <IndicatorBadge label="RSI (14)" value={asset.rsi.toFixed(0)} status={rsiStatus} />
         <IndicatorBadge label="MACD" value={macdDiff > 0 ? 'BULL' : 'BEAR'} status={macdStatus} />
         <IndicatorBadge label="BANDS" value={bandStatus === 'buy' ? 'LOW' : bandStatus === 'sell' ? 'HIGH' : 'MID'} status={bandStatus} />
      </div>

      {/* Controls Section */}
      <div className="space-y-4">
        {/* Strategy Segmented Control */}
        <div>
            <label className="text-[11px] font-semibold text-ios-gray uppercase tracking-wider ml-1 mb-2 block">Active Strategy</label>
            <div className="bg-black/40 p-1 rounded-xl flex relative overflow-x-auto">
                {availableStrategies.map((strat) => {
                    const isActive = asset.strategy === strat;
                    let label: string = strat;
                    if (strat === StrategyType.AI_AGENT) label = 'Gemini AI';
                    if (strat === StrategyType.LONDON_SWEEP) label = 'Ldn Sweep';
                    if (strat === StrategyType.LONDON_CONTINUATION) label = 'Ldn Cont.';
                    if (strat === StrategyType.NY_ORB) label = 'NY ORB';
                    
                    return (
                        <button 
                            key={strat}
                            onClick={() => setStrategy(asset.symbol, strat)}
                            className={`flex-1 py-2 px-2 min-w-[80px] rounded-[9px] text-[10px] font-bold transition-all duration-300 relative z-10 flex items-center justify-center gap-1
                                ${isActive ? 'text-white shadow-lg bg-[#636366]' : 'text-neutral-500 hover:text-neutral-300'}`}
                        >
                            {strat === StrategyType.AI_AGENT && <Sparkles size={10} className={isActive ? 'text-purple-300' : ''} />}
                            {(strat === StrategyType.LONDON_SWEEP || strat === StrategyType.LONDON_CONTINUATION) && <Landmark size={10} className={isActive ? 'text-yellow-300' : ''} />}
                            {strat === StrategyType.NY_ORB && <Clock size={10} className={isActive ? 'text-blue-300' : ''} />}
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
