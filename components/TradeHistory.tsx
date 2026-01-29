import React, { useState } from 'react';
import { Trade } from '../types';
import DeepDiveModal from './DeepDiveModal';
import { Filter, Search, ChevronDown, CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';

interface TradeHistoryProps {
  trades: Trade[];
}

const AGENT_IDS = ['quant', 'macro', 'risk'];

export const TradeHistory: React.FC<TradeHistoryProps> = ({ trades }) => {
  const [activeAgents, setActiveAgents] = useState<string[]>(['quant', 'macro', 'risk']);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);

  const toggleAgent = (id: string) => {
    setActiveAgents(prev =>
      prev.includes(id)
        ? (prev.length > 1 ? prev.filter(a => a !== id) : prev) // keep at least one
        : [...prev, id]
    );
  };

  const isAllSelected = activeAgents.length === AGENT_IDS.length;

  // Sorting: Newest first
  const sortedTrades = [...trades].sort((a, b) => b.openTime - a.openTime);

  const filteredTrades = sortedTrades.filter(t => activeAgents.includes(t.agentId));

  return (
    <div className="h-full flex flex-col bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden backdrop-blur-sm">
      {/* Header / Filter Bar */}
      <div className="p-4 border-b border-gray-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-900/80">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
          <Search className="w-4 h-4 text-cyan-500" />
          Trade Audit Log
        </h2>

        <div className="flex items-center gap-2 bg-black/40 p-1 rounded-lg border border-gray-800">
          <button
            onClick={() => setActiveAgents(AGENT_IDS)}
            className={`px-3 py-1 rounded text-[10px] font-mono transition-all ${isAllSelected ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-gray-500 hover:text-gray-300'}`}
          >
            ALL
          </button>
          <div className="w-px h-4 bg-gray-800 mx-1" />
          {AGENT_IDS.map(id => {
            const isActive = activeAgents.includes(id);
            const colorClass = id === 'quant' ? 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10' :
              id === 'macro' ? 'text-blue-400 border-blue-500/30 bg-blue-500/10' :
                'text-orange-400 border-orange-500/30 bg-orange-500/10';

            return (
              <button
                key={id}
                onClick={() => toggleAgent(id)}
                className={`px-3 py-1 rounded text-[10px] font-mono border transition-all ${isActive ? colorClass : 'border-transparent text-gray-600 hover:text-gray-400'}`}
              >
                {id.toUpperCase()}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-12 gap-2 px-6 py-2 bg-gray-950/50 text-[10px] text-gray-500 font-mono uppercase tracking-wider border-b border-gray-800/50">
        <div className="col-span-2">Time</div>
        <div className="col-span-1">Agent</div>
        <div className="col-span-1">Action</div>
        <div className="col-span-2 text-right">Price</div>
        <div className="col-span-1 text-right">Size</div>
        <div className="col-span-1 text-right">PnL</div>
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
          filteredTrades.map((t) => {
            const displayPnL = t.status === 'OPEN' ? (t.floatingPnl || 0) : (t.pnl || 0);

            return (
              <div
                key={t.id}
                onClick={() => setSelectedTrade(t)}
                className="grid grid-cols-12 gap-2 px-6 py-3 border-b border-gray-800/30 hover:bg-white/[0.02] cursor-pointer transition-colors group text-xs font-mono text-gray-400 items-center"
              >
                <div className="col-span-2 text-gray-500">{new Date(t.openTime).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                <div className="col-span-1 flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${t.agentId === 'quant' ? 'bg-cyan-500' : t.agentId === 'macro' ? 'bg-blue-500' : 'bg-orange-500'}`} />
                  <span className="uppercase truncate">{t.agentId}</span>
                </div>
                <div className={`col-span-1 font-bold ${t.type === 'BUY' ? 'text-green-500' : 'text-red-500'}`}>{t.type}</div>
                <div className="col-span-2 text-right text-gray-300">{(t.entryPrice || 0).toFixed(2)}</div>
                <div className="col-span-1 text-right">{(t.initialSize || 0)}</div>
                <div className={`col-span-1 text-right font-bold ${displayPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {formatCurrency(displayPnL)}
                </div>
                <div className="col-span-4 pl-4 text-gray-500 truncate group-hover:text-cyan-400 transition-colors">
                  {t.entryReason || "No reasoning logged..."}
                </div>
              </div>
            );
          })
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
