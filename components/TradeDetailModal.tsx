import React from 'react';
import { createPortal } from 'react-dom';
import { Trade, TradeType, StrategyType } from '../types';
import { X, Target, AlertTriangle, TrendingUp, TrendingDown, BrainCircuit, Activity, Zap, Repeat, CheckCircle2, Circle } from 'lucide-react';
import { formatDate, formatNumber } from '../utils/formatters';

interface Props {
  trade: Trade | null;
  onClose: () => void;
}

const TradeDetailModal: React.FC<Props> = ({ trade, onClose }) => {
  if (!trade) return null;

  const isProfit = (trade.pnl || 0) >= 0;
  const isBuy = trade.type === TradeType.BUY;

  // Helper for result analysis text
  const getResultAnalysis = () => {
    if (trade.status === 'OPEN') {
      const tp1Hit = trade.tpLevels[0].hit;
      if (tp1Hit) return "Trade is active. First profit target hit! Stop Loss moved to Breakeven to secure risk-free trade.";
      return "Trade is active. Monitoring market conditions for TP1...";
    }

    if (trade.closeReason === 'STOP_LOSS') {
      if (trade.pnl > 0) return "Closed by Trailing Stop. Although the final portion stopped out, partial profits were already banked.";
      return "Stop Loss Hit: The market reversed. Trade closed to protect capital.";
    }
    return "Trade cycle complete.";
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />

      <div className="bg-[#1C1C1E]/90 backdrop-blur-xl w-full max-w-sm rounded-[28px] border border-white/10 shadow-2xl relative z-10 animate-fade-in-up max-h-[85vh] flex flex-col overflow-hidden">

        {/* Header - Fixed at top */}
        <div className="px-6 py-5 border-b border-white/5 flex justify-between items-center bg-gradient-to-b from-white/5 to-transparent shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${isBuy ? 'bg-ios-blue/20 text-ios-blue' : 'bg-ios-red/20 text-ios-red'}`}>
              {isBuy ? 'B' : 'S'}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">{trade.symbol}</h2>
              <p className="text-xs text-ios-gray">{formatDate(trade.openTime)}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
            <X size={16} className="text-white" />
          </button>
        </div>

        {/* Scrollable Content Area */}
        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">

          {/* PnL Hero */}
          <div className="text-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-ios-gray block mb-1">
              {trade.status === 'OPEN' ? 'Floating P&L' : 'Realized Net Result'}
            </span>
            <span className={`text-4xl font-bold tabular-nums tracking-tight ${(trade.status === 'OPEN' ? (trade.floatingPnl || 0) : (trade.pnl || 0)) >= 0 ? 'text-ios-green' : 'text-ios-red'}`}>
              {(trade.status === 'OPEN' ? (trade.floatingPnl || 0) : (trade.pnl || 0)) >= 0 ? '+' : ''}
              {formatNumber((trade.status === 'OPEN' ? (trade.floatingPnl || 0) : (trade.pnl || 0)), 2)}
            </span>
            {trade.status === 'OPEN' && (
              <div className="text-xs text-ios-blue font-bold mt-1 animate-pulse">ACTIVE - RUNNING</div>
            )}
          </div>

          {/* 3-Level Profit Ladder */}
          <div className="space-y-3">
            <h4 className="text-[10px] uppercase font-bold text-ios-gray ml-1">Profit Ladder</h4>
            {trade.tpLevels.map((level, idx) => (
              <div key={level.id} className={`flex items-center justify-between p-3 rounded-xl border ${level.hit ? 'bg-ios-green/10 border-ios-green/30' : 'bg-black/40 border-white/5'}`}>
                <div className="flex items-center gap-3">
                  {level.hit ? <CheckCircle2 size={18} className="text-ios-green" /> : <Circle size={18} className="text-white/20" />}
                  <div>
                    <div className="text-xs font-bold text-white">
                      {idx === 0 ? 'TP 1 (Bank)' : idx === 1 ? 'TP 2 (Target)' : 'TP 3 (Runner)'}
                    </div>
                    <div className="text-[10px] text-ios-gray">Close {level.percentage * 100}%</div>
                  </div>
                </div>
                <span className={`font-mono text-xs ${level.hit ? 'text-ios-green font-bold line-through' : 'text-white/40'}`}>
                  {formatNumber(level.price, 2)}
                </span>
              </div>
            ))}
          </div>

          {/* Analysis Text */}
          <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
            <p className="text-sm text-ios-gray leading-relaxed">
              {getResultAnalysis()}
            </p>
          </div>

          {/* Entry/Stop Data */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-black/40 rounded-xl p-3 border border-white/5">
              <div className="flex items-center gap-1.5 text-ios-gray text-[10px] uppercase font-bold mb-1">
                <Target size={12} /> Entry
              </div>
              <span className="text-white font-mono">{formatNumber(trade.entryPrice, 2)}</span>
            </div>
            <div className="bg-black/40 rounded-xl p-3 border border-white/5">
              <div className="flex items-center gap-1.5 text-ios-gray text-[10px] uppercase font-bold mb-1">
                <AlertTriangle size={12} /> Stop Loss
              </div>
              <span className="text-white font-mono">{formatNumber(trade.stopLoss, 2)}</span>
            </div>
          </div>

        </div>
      </div>
    </div>,
    document.body
  );
};

export default TradeDetailModal;
