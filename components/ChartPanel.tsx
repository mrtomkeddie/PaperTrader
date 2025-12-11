import React from 'react';
import { AssetData } from '../types';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface Props {
    asset: AssetData;
}

const ChartPanel: React.FC<Props> = ({ asset }) => {
    // Transform history for Recharts
    const data = asset.history.map(h => ({
        time: h.time,
        value: h.value
    }));

    const isUp = data.length > 1 && data[data.length - 1].value >= data[0].value;
    const color = isUp ? '#22c55e' : '#ef4444'; // green-500 : red-500

    return (
        <div className="bg-[#13141b] rounded-2xl p-4 md:p-6 border border-white/5 h-[300px] md:h-full flex flex-col relative overflow-hidden">
            <div className="flex justify-between items-start mb-4 z-10">
                <h3 className="text-lg font-bold text-white">Intraday Chart</h3>
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
                            tickFormatter={(tick) => tick.split(':').slice(0,2).join(':')}
                            minTickGap={30}
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
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default ChartPanel;
