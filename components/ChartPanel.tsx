import React from 'react';
import { AssetData, Trade } from '../types';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, ReferenceDot } from 'recharts';

interface Props {
    asset: AssetData;
    selectedTrade?: Trade | null;
}

const ChartPanel: React.FC<Props> = ({ asset, selectedTrade }) => {
    // Determine Data Source
    // If selectedTrade is present and matches symbol, and we have candles, use candles for better history
    const showHistorical = !!(selectedTrade && selectedTrade.symbol === asset.symbol && asset.candles && asset.candles.length > 0);
    
    let data: any[];
    let xFormatter: (val: any) => string;
    
    if (showHistorical && asset.candles) {
        data = asset.candles.map(c => ({
            time: c.time, // Timestamp number
            value: c.close,
            // formatted: new Date(c.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }));
        xFormatter = (tick: number) => new Date(tick).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
        data = asset.history.map(h => ({
            time: h.time, // String "HH:MM:SS"
            value: h.value
        }));
        xFormatter = (tick: string) => {
            if (typeof tick === 'string') return tick.split(':').slice(0,2).join(':');
            return '';
        };
    }

    const isUp = data.length > 1 && data[data.length - 1].value >= data[0].value;
    const color = isUp ? '#22c55e' : '#ef4444'; // green-500 : red-500

    return (
        <div className="bg-[#13141b] rounded-2xl p-4 md:p-6 border border-white/5 h-[300px] md:h-full flex flex-col relative overflow-hidden">
            <div className="flex justify-between items-start mb-4 z-10">
                <h3 className="text-lg font-bold text-white">
                    {showHistorical ? 'Historical Analysis' : 'Intraday Chart'}
                </h3>
                {showHistorical && (
                    <span className="text-xs text-blue-400 bg-blue-500/10 px-2 py-1 rounded border border-blue-500/20">
                        Trade View
                    </span>
                )}
            </div>

            {/* Grid Overlay / Decoration */}
            <div className="absolute inset-0 pointer-events-none opacity-5">
                 {/* Can add grid pattern here if needed via CSS */}
            </div>

            <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data}>
                        <defs>
                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                                <stop offset="95%" stopColor={color} stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                        <XAxis 
                            dataKey="time" 
                            stroke="#525252" 
                            tick={{fontSize: 10}} 
                            tickFormatter={xFormatter}
                            minTickGap={30}
                            type={showHistorical ? 'number' : 'category'}
                            domain={showHistorical ? ['dataMin', 'dataMax'] : undefined}
                            scale={showHistorical ? 'time' : undefined}
                        />
                        <YAxis 
                            domain={['auto', 'auto']} 
                            stroke="#525252" 
                            tick={{fontSize: 10}} 
                            orientation="right"
                            tickFormatter={(val) => val.toFixed(1)}
                        />
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#1C1C1E', borderColor: '#333', borderRadius: '8px' }}
                            itemStyle={{ color: '#fff' }}
                            labelFormatter={(label) => showHistorical ? new Date(label).toLocaleString() : label}
                            formatter={(val: number) => [val.toFixed(2), 'Price']}
                        />
                        <Area 
                            type="monotone" 
                            dataKey="value" 
                            stroke={color} 
                            strokeWidth={2}
                            fillOpacity={1} 
                            fill="url(#colorValue)" 
                            isAnimationActive={false}
                        />

                        {/* Trade Markers */}
                        {showHistorical && selectedTrade && (
                            <>
                                {/* Entry Line & Dot */}
                                <ReferenceLine 
                                    y={selectedTrade.entryPrice} 
                                    stroke="#3b82f6" 
                                    strokeDasharray="3 3" 
                                    label={{ position: 'right', value: 'Entry', fill: '#3b82f6', fontSize: 10 }} 
                                />
                                <ReferenceDot 
                                    x={selectedTrade.openTime} 
                                    y={selectedTrade.entryPrice} 
                                    r={4} 
                                    fill="#3b82f6" 
                                    stroke="none" 
                                />
                                
                                {/* Exit Line & Dot (if closed) */}
                                {selectedTrade.status === 'CLOSED' && selectedTrade.closePrice && selectedTrade.closeTime && (
                                    <>
                                        <ReferenceLine 
                                            y={selectedTrade.closePrice} 
                                            stroke={selectedTrade.pnl >= 0 ? '#22c55e' : '#ef4444'} 
                                            strokeDasharray="3 3" 
                                            label={{ position: 'right', value: 'Exit', fill: selectedTrade.pnl >= 0 ? '#22c55e' : '#ef4444', fontSize: 10 }} 
                                        />
                                        <ReferenceDot 
                                            x={selectedTrade.closeTime} 
                                            y={selectedTrade.closePrice} 
                                            r={4} 
                                            fill={selectedTrade.pnl >= 0 ? '#22c55e' : '#ef4444'} 
                                            stroke="none" 
                                        />
                                    </>
                                )}

                                {/* TP Levels */}
                                {selectedTrade.tpLevels.map((tp) => (
                                    <ReferenceLine 
                                        key={tp.id} 
                                        y={tp.price} 
                                        stroke="#10b981" 
                                        strokeDasharray="3 3" 
                                        strokeOpacity={0.3} 
                                        label={{ position: 'insideRight', value: `TP${tp.id}`, fill: '#10b981', fontSize: 9 }} 
                                    />
                                ))}
                                
                                {/* Stop Loss */}
                                <ReferenceLine 
                                    y={selectedTrade.stopLoss} 
                                    stroke="#ef4444" 
                                    strokeDasharray="3 3" 
                                    strokeOpacity={0.3} 
                                    label={{ position: 'insideRight', value: 'SL', fill: '#ef4444', fontSize: 9 }} 
                                />
                            </>
                        )}

                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default ChartPanel;
