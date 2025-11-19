import React from 'react';

interface Props {
  label: string;
  value: string | number;
  status?: 'neutral' | 'buy' | 'sell';
}

const IndicatorBadge: React.FC<Props> = ({ label, value, status = 'neutral' }) => {
  const getColors = () => {
    if (status === 'buy') return 'bg-ios-green/15 text-ios-green border-ios-green/20';
    if (status === 'sell') return 'bg-ios-red/15 text-ios-red border-ios-red/20';
    return 'bg-white/10 text-ios-gray border-white/5';
  };

  return (
    <div className={`flex flex-col items-center justify-center px-3 py-2 rounded-xl border ${getColors()} backdrop-blur-sm`}>
      <span className="opacity-80 text-[10px] uppercase tracking-wider font-semibold mb-0.5">{label}</span>
      <span className="text-xs font-bold tabular-nums">{value}</span>
    </div>
  );
};

export default IndicatorBadge;