import React, { useState } from 'react';
import { Trade } from '../types';
import DeepDiveModal from './DeepDiveModal';
import { Filter, Search, ChevronDown, CheckCircle2 } from 'lucide-react';

interface TradeHistoryProps {
  trades: Trade[];
}

const AGENT_FILTERS = ['ALL', 'quant', 'macro', 'risk'];

export const TradeHistory: React.FC<TradeHistoryProps> = ({ trades }) => {
  const [filter, setFilter] = useState('ALL');
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);

  // Sorting: Newest first
  const sortedTrades = [...trades].sort((a, b) => b.openTime - a.openTime);

  const filteredTrades = filter === 'ALL'
    ? sortedTrades
    : sortedTrades.filter(t => t.agentId === filter);

  return (
    <div className="h-full flex flex-col bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden backdrop-blur-sm">
      {/* Header / Filter Bar */}
      <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/80">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
          <Search className="w-4 h-4 text-cyan-500" />
          Trade Audit Log
        </h2>

        <div className="relative group">
          <button className="flex items-center gap-2 px-3 py-1.5 bg-[#0a0f1e] border border-gray-700 rounded text-xs font-mono text-cyan-400 hover:border-cyan-500 transition-colors">
            <Filter className="w-3 h-3" />
            Agent: {filter.toUpperCase()}
            <ChevronDown className="w-3 h-3" />
          </button>

          {/* Dropdown Menu */}
          <div className="absolute right-0 mt-2 w-32 bg-[#0a0f1e] border border-gray-700 rounded shadow-xl z-20 hidden group-hover:block animate-in fade-in zoom-in-95 duration-100">
            {AGENT_FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`w-full text-left px-3 py-2 text-xs font-mono hover:bg-gray-800 transition-colors flex items-center justify-between ${filter === f ? 'text-cyan-400' : 'text-gray-400'}`}
              >
                {f.toUpperCase()}
                {filter === f && <CheckCircle2 className="w-3 h-3" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-12 gap-2 px-6 py-2 bg-gray-950/50 text-[10px] text-gray-500 font-mono uppercase tracking-wider border-b border-gray-800/50">
        <div className="col-span-2">Time</div>
        <div className="col-span-2">Agent</div>
        <div className="col-span-1">Action</div>
        <div className="col-span-2 text-right">Price</div>
        <div className="col-span-1 text-right">Size</div>
        <div className="col-span-4 pl-4">Reasoning Snippet</div>
      </div>

      {/* Table Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {filteredTrades.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-600 space-y-2">
            <Search className="w-8 h-8 opacity-20" />
            <span className="text-xs font-mono">No audit records found.</span>
          </div>
        ) : (
          filteredTrades.map((t) => (
            <div
              key={t.id}
              onClick={() => setSelectedTrade(t)}
              className="grid grid-cols-12 gap-2 px-6 py-3 border-b border-gray-800/30 hover:bg-white/[0.02] cursor-pointer transition-colors group text-xs font-mono text-gray-400 items-center"
            >
              <div className="col-span-2 text-gray-500">{new Date(t.openTime).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
              <div className="col-span-2 flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${t.agentId === 'quant' ? 'bg-cyan-500' : t.agentId === 'macro' ? 'bg-blue-500' : 'bg-orange-500'}`} />
                <span className="uppercase">{t.agentId}</span>
              </div>
              <div className={`col-span-1 font-bold ${t.type === 'BUY' ? 'text-green-500' : 'text-red-500'}`}>{t.type}</div>
              <div className="col-span-2 text-right text-gray-300">{t.entryPrice.toFixed(2)}</div>
              <div className="col-span-1 text-right">{t.initialSize}</div>
              <div className="col-span-4 pl-4 text-gray-500 truncate group-hover:text-cyan-400 transition-colors">
                {t.entryReason || "No reasoning logged..."}
              </div>
            </div>
          ))
        )}
      </div>

      <DeepDiveModal
        isOpen={!!selectedTrade}
        onClose={() => setSelectedTrade(null)}
        trade={selectedTrade}
      />
    </div>
  );
};
