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
        this.isHalted = false; // Margin Call Flag

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
        // PnL updates handled by Manager
    }

    calculateSafeLotSize(entryPrice, stopLoss, riskPercent = 1) {
        if (!entryPrice || !stopLoss) return 0;

        const riskAmount = this.equity * (riskPercent / 100);
        const priceDiff = Math.abs(entryPrice - stopLoss);
        if (priceDiff === 0) return 0;

        // XAUUSD Standard: 1 Lot = 100 oz. $1 move = $100 PnL.
        const contractSize = 100;
        const maxLossPerLot = priceDiff * contractSize;

        let safeLots = riskAmount / maxLossPerLot;

        // CRITICAL RISK FIX: If safe size is less than minimum, return 0 (Reject Trade)
        // instead of flooring to 0.01 which causes over-leveraging.
        if (safeLots < 0.01) {
            console.warn(`[AGENT: ${this.name}] RISK REJECTION: Required size ${safeLots.toFixed(4)} < 0.01 min lot. (Risk: £${riskAmount.toFixed(2)})`);
            return 0;
        }

        // Clamp to max
        if (safeLots > 5.0) safeLots = 5.0; // Account hard cap

        // Step to 0.01
        return Number(Math.floor(safeLots * 100) / 100);
    }

    checkMargin(size, price) {
        // Simple Leverage Check: 100:1 leverage
        const requiredMargin = price * size * 100 * 0.01; // 1:100 leverage
        const freeMargin = this.equity - requiredMargin;

        // CRITICAL: Margin Call Check
        if (this.equity < (this.balance * 0.80)) {
            console.warn(`[AGENT: ${this.name}] MARGIN CALL WARNING: Equity < 80%. Trading Halted.`);
            this.isHalted = true;
            return false;
        } else {
            this.isHalted = false; // Auto-recover if funds added
        }

        return freeMargin > 0;
    }

    /**
     * Execute a trade
     */
    executeTrade(symbol, type, size, entryPrice, stopLoss, tpLevels, reason, snapshot = {}) {
        // 1. RE-CALCULATE SIZE based on Risk Management (Override AI's prompt if unsafe)
        // We trust the AI for direction/SL, but NOT for sizing.
        const safeSize = this.calculateSafeLotSize(entryPrice, stopLoss, 1.0); // 1% Risk

        if (safeSize <= 0) {
            console.warn(`[AGENT: ${this.name}] Trade Rejected: Risk too high for minimum lot size.`);
            return null;
        }

        // 2. CHECK MARGIN & STOP DRAWDOWN
        if (!this.checkMargin(safeSize, entryPrice)) {
            console.warn(`[AGENT: ${this.name}] Trade Rejected: Insufficient Margin or Drawdown Limit.`);
            return null;
        }

        // CHECK COOLDOWN & LIMITS
        if (!this.canTrade()) {
            return null;
        }

        // VALIDATION: Reject trades with invalid data
        if (!entryPrice || isNaN(entryPrice) || entryPrice <= 0) return null;
        if (!stopLoss || isNaN(stopLoss) || stopLoss <= 0) return null;

        const trade = {
            id: `${this.id}-${Date.now()}`,
            agentId: this.id,
            symbol,
            type,
            initialSize: safeSize, // Use Calculated Safe Size
            currentSize: safeSize,
            entryPrice,
            stopLoss,
            tpLevels: tpLevels || [],
            openTime: Date.now(),
            status: 'OPEN',
            pnl: 0,
            entryReason: reason,
            decisionSnapshot: snapshot,
            strategy: 'AI_AGENT'
        };

        this.trades.push(trade);
        this.newTrades.push(trade);
        this.lastAction = `OPEN ${type} ${symbol} (${safeSize} lots)`;
        this.lastTradeTime = Date.now(); // Update cooldown timer
        console.log(`[AGENT: ${this.name}] Executed Trade: ${type} ${symbol} @ ${entryPrice} [Risk Adjusted: ${safeSize} lots]`);
        return trade;
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
            lastThought: this.lastThought,
            isHalted: this.isHalted
        };
    }
}
