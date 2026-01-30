import React, { useState } from 'react';
import { Trade } from '../types';
import DeepDiveModal from './DeepDiveModal';
import { Filter, Search, ChevronDown, CheckCircle2, Terminal } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';
import { GlassCard } from './ui/GlassCard';

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
    <GlassCard className="h-full flex flex-col p-0 overflow-hidden">
      {/* Header / Filter Bar */}
      <div className="p-4 border-b border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-black/20">
        <h2 className="text-xs font-bold text-premium-cyan/80 uppercase tracking-widest flex items-center gap-2 font-mono">
          <Terminal className="w-4 h-4" />
          Trade_History_Log
        </h2>

        <div className="flex flex-wrap items-center gap-2 bg-black/40 p-1 rounded-lg border border-white/10">
          <button
            onClick={() => setActiveAgents(AGENT_IDS)}
            className={`px-3 py-1 rounded text-[10px] font-mono transition-all uppercase tracking-wider ${isAllSelected ? 'bg-premium-cyan/20 text-premium-cyan shadow-[0_0_8px_rgba(0,240,255,0.2)]' : 'text-gray-500 hover:text-gray-300'}`}
          >
            ALL
          </button>
          <div className="w-px h-3 bg-white/10 mx-1" />
          {AGENT_IDS.map(id => {
            const isActive = activeAgents.includes(id);
            // Default inactive style
            let btnClass = 'text-gray-600 hover:text-gray-400 border-transparent';

            if (isActive) {
              if (id === 'quant') btnClass = 'text-premium-cyan border-premium-cyan/30 bg-premium-cyan/10 shadow-[0_0_8px_rgba(0,240,255,0.15)]';
              else if (id === 'macro') btnClass = 'text-blue-400 border-blue-500/30 bg-blue-500/10 shadow-[0_0_8px_rgba(59,130,246,0.15)]';
              else btnClass = 'text-premium-gold border-premium-gold/30 bg-premium-gold/10 shadow-[0_0_8px_rgba(212,175,55,0.15)]';
            }

            return (
              <button
                key={id}
                onClick={() => toggleAgent(id)}
                className={`px-3 py-1 rounded text-[10px] font-mono border transition-all uppercase tracking-wider ${btnClass}`}
              >
                {id}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-black/40 text-[10px] text-gray-500 font-mono uppercase tracking-wider border-b border-white/5">
        <div className="col-span-3 sm:col-span-2">Time</div>
        <div className="col-span-5 sm:col-span-1">Agent</div>
        <div className="hidden sm:block sm:col-span-1">Type</div>
        <div className="hidden sm:block sm:col-span-2 text-right">Price</div>
        <div className="hidden sm:block sm:col-span-1 text-right">Size</div>
        <div className="col-span-4 sm:col-span-1 text-right">PnL</div>
        <div className="hidden sm:block sm:col-span-4 pl-4">Log_Snippet</div>
      </div>

      {/* Table Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-black/10">
        {filteredTrades.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-600 space-y-2 opacity-50">
            <Search className="w-8 h-8 opacity-20" />
            <h2 className="text-xs font-mono font-bold text-gray-500 tracking-[0.2em] animate-pulse">
              NO_LOGS_FOUND
            </h2>
          </div>
        ) : (
          filteredTrades.map((t) => {
            const displayPnL = t.status === 'OPEN' ? (t.floatingPnl || 0) : (t.pnl || 0);

            return (
              <div
                key={t.id}
                onClick={() => setSelectedTrade(t)}
                className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-white/5 hover:bg-white/[0.03] cursor-pointer transition-all duration-200 group text-xs font-mono text-gray-400 items-center relative"
              >
                {/* Hover Highlight Line */}
                <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-premium-cyan opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="col-span-3 sm:col-span-2 text-gray-500 font-light group-hover:text-gray-300 transition-colors">
                  {new Date(t.openTime).toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                </div>

                <div className="col-span-5 sm:col-span-1 flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${t.agentId === 'quant' ? 'bg-premium-cyan shadow-[0_0_5px_cyan]' : t.agentId === 'macro' ? 'bg-blue-500 shadow-[0_0_5px_blue]' : 'bg-premium-gold shadow-[0_0_5px_gold]'}`} />
                  <span className="uppercase tracking-wide text-[10px] opacity-80">{t.agentId.substring(0, 3)}</span>
                </div>

                <div className={`hidden sm:block sm:col-span-1 font-bold ${t.type === 'BUY' ? 'text-premium-green drop-shadow-[0_0_3px_rgba(0,255,163,0.3)]' : 'text-premium-red drop-shadow-[0_0_3px_rgba(255,77,77,0.3)]'}`}>
                  {t.type}
                </div>

                <div className="hidden sm:block sm:col-span-2 text-right text-gray-300 group-hover:text-white transition-colors">
                  {(t.entryPrice || 0).toFixed(2)}
                </div>

                <div className="hidden sm:block sm:col-span-1 text-right text-gray-500">
                  {(t.initialSize || 0)}
                </div>

                <div className={`col-span-4 sm:col-span-1 text-right font-bold ${displayPnL >= 0 ? 'text-premium-green' : 'text-premium-red'}`}>
                  {formatCurrency(displayPnL)}
                </div>

                <div className="hidden sm:block sm:col-span-4 pl-4 text-gray-600 truncate group-hover:text-premium-cyan/70 transition-colors text-[10px] italic">
                  {t.entryReason ? `// ${t.entryReason}` : "// No logic logged..."}
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
    </GlassCard>
  );
};
