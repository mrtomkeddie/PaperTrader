import { QuantAgent } from './agents/QuantAgent.js';
import { MacroAgent } from './agents/MacroAgent.js';
import { RiskAgent } from './agents/RiskAgent.js';

export class Manager {
    constructor() {
        this.agents = [
            new QuantAgent(),
            new MacroAgent(),
            new RiskAgent()
        ];
        this.marketData = {}; // Symbol -> Data
        this.newTradesQueue = [];
    }

    /**
     * Initialize agents (load state from DB)
     * @param {Object} persistedState - The JSON state from Firebase/Local
     */
    hydrate(persistedState) {
        if (!persistedState || !persistedState.accounts) return;

        this.agents.forEach(agent => {
            const state = persistedState.accounts[agent.id];
            if (state) {
                agent.balance = state.balance;
                agent.equity = state.equity;
            }

            // Load active trades
            if (persistedState.trades) {
                agent.trades = persistedState.trades.filter(t => t.agentId === agent.id);
            }
        });
        console.log('[MANAGER] Agents hydrated from state.');
    }

    /**
     * Process a market tick
     * @param {string} symbol 
     * @param {Object} data - Enriched market data (price, rsi, trend, etc.)
     */
    onTick(symbol, data) {
        this.marketData[symbol] = data;

        // Trigger agents
        this.agents.forEach(agent => {
            try {
                agent.onTick(data);
                // Collect new trades
                const newTrades = agent.getNewTrades();
                if (newTrades.length > 0) {
                    this.newTradesQueue.push(...newTrades);
                }
            } catch (e) {
                console.error(`[MANAGER] Error ticking agent ${agent.name}:`, e);
            }
        });
    }

    consumeNewTrades() {
        const trades = [...this.newTradesQueue];
        this.newTradesQueue = [];
        return trades;
    }

    recalculateState(allTrades) {
        this.agents.forEach(agent => {
            const agentTrades = allTrades.filter(t => t.agentId === agent.id);
            agent.trades = agentTrades;

            const closedPnL = agentTrades
                .filter(t => t.status === 'CLOSED')
                .reduce((sum, t) => sum + (t.pnl || 0), 0);

            const floatingPnL = agentTrades
                .filter(t => t.status === 'OPEN')
                .reduce((sum, t) => sum + (t.floatingPnl || 0), 0);

            agent.balance = 1000 + closedPnL;
            agent.equity = agent.balance + floatingPnL;
        });
    }

    /**
     * Get total system state for frontend/DB
     */
    getState() {
        const accounts = {};
        let allTrades = [];

        this.agents.forEach(agent => {
            accounts[agent.id] = {
                name: agent.name,
                role: agent.role,
                balance: agent.balance,
                equity: agent.equity,
                isThinking: agent.isThinking,
                lastAction: agent.lastAction,
                lastThought: agent.lastThought
            };
            allTrades = allTrades.concat(agent.trades);
        });

        return {
            accounts,
            trades: allTrades
        };
    }
}
