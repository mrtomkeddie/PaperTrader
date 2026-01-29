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

        // Trade cooldown & limits
        this.lastTradeTime = 0;
        this.TRADE_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes between trades
        this.MAX_OPEN_TRADES = 2; // Max 2 open trades per agent
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
     * Check if agent can trade (cooldown + max trades)
     */
    canTrade() {
        const now = Date.now();
        const timeSinceLastTrade = now - this.lastTradeTime;

        // Check cooldown
        if (timeSinceLastTrade < this.TRADE_COOLDOWN_MS) {
            const remaining = Math.ceil((this.TRADE_COOLDOWN_MS - timeSinceLastTrade) / 1000);
            console.log(`[AGENT: ${this.name}] COOLDOWN: ${remaining}s remaining`);
            return false;
        }

        // Check max open trades
        const openTrades = this.trades.filter(t => t.status === 'OPEN');
        if (openTrades.length >= this.MAX_OPEN_TRADES) {
            console.log(`[AGENT: ${this.name}] MAX TRADES: Already has ${openTrades.length} open trades`);
            return false;
        }

        return true;
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
        // CHECK COOLDOWN & LIMITS
        if (!this.canTrade()) {
            return null;
        }

        // VALIDATION: Reject trades with invalid data
        if (!entryPrice || isNaN(entryPrice) || entryPrice <= 0) {
            console.warn(`[AGENT: ${this.name}] REJECTED TRADE: Invalid entryPrice (${entryPrice})`);
            return null;
        }
        if (!size || isNaN(size) || size < 0.01) {
            console.warn(`[AGENT: ${this.name}] REJECTED TRADE: Invalid size (${size})`);
            return null;
        }
        if (!stopLoss || isNaN(stopLoss) || stopLoss <= 0) {
            console.warn(`[AGENT: ${this.name}] REJECTED TRADE: Invalid stopLoss (${stopLoss})`);
            return null;
        }

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
        this.lastTradeTime = Date.now(); // Update cooldown timer
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
