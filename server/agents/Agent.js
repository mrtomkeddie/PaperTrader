export class Agent {
    /**
     * @param {string} id - 'quant', 'macro', 'risk'
     * @param {string} name - Display Name
     * @param {string} role - Description of role
     * @param {number} initialBalance - Starting capital
     */
    constructor(id, name, role, initialBalance = 1000) {
        this.id = id;
        this.name = name;
        this.role = role;
        this.balance = initialBalance;
        this.equity = initialBalance;
        this.trades = []; // Active and closed trades for this agent
        this.isThinking = false;
        this.lastThought = "";
        this.lastAction = "WAITING";
        this.newTrades = [];
        this.latestDecision = null; // Store full JSON decision
    }

    /**
     * Core "tick" function called by the Manager every cycle.
     * Must be implemented by subclasses.
     * @param {Object} marketData - The current market snapshot
     */
    async onTick(marketData) {
        throw new Error("onTick method must be implemented");
    }

    /**
     * Execute a trade
     * @param {string} symbol
     * @param {string} type - 'BUY' or 'SELL'
     * @param {number} size - Lot size
     * @param {number} entryPrice
     * @param {number} stopLoss
     * @param {Object} tpLevels - Optional Take Profit configuration
     * @param {string} reason - AI reasoning
     * @param {Object} snapshot - specific data points (rsi, sentiment, etc.)
     */
    executeTrade(symbol, type, size, entryPrice, stopLoss, tpLevels, reason, snapshot = {}) {
        const trade = {
            id: `${this.id}-${Date.now()}`,
            agentId: this.id,
            symbol,
            type,
            initialSize: size,
            currentSize: size,
            entryPrice,
            stopLoss,
            tpLevels: tpLevels || [],
            openTime: Date.now(),
            status: 'OPEN',
            pnl: 0,
            entryReason: reason,
            decisionSnapshot: snapshot,
            strategy: 'AI_AGENT' // Can be customized per agent
        };

        this.trades.push(trade);
        this.newTrades.push(trade);
        this.lastAction = `OPEN ${type} ${symbol}`;
        console.log(`[AGENT: ${this.name}] Executed Trade: ${type} ${symbol} @ ${entryPrice}`);
        return trade;
    }

    getNewTrades() {
        const t = [...this.newTrades];
        this.newTrades = [];
        return t;
    }

    /**
     * Update open trades (check SL/TP/PnL)
     * The Manager will likely handle price updates, but agents can manage their own exits.
     * @param {Object} marketData
     */
    updateTrades(marketData) {
        // Basic PnL update logic would go here, or be handled centrally
    }

    toJson() {
        return {
            id: this.id,
            name: this.name,
            role: this.role,
            balance: this.balance,
            equity: this.equity,
            isThinking: this.isThinking,
            lastAction: this.lastAction,
            lastThought: this.lastThought
        };
    }
}
