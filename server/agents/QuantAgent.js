import { Agent } from './Agent.js';
import OpenAI from 'openai';

export class QuantAgent extends Agent {
    constructor() {
        super('quant', 'The Quant', 'Technical Scalper (DeepSeek R1)', 1000);

        // Initialize DeepSeek Client
        if (process.env.DEEPSEEK_API_KEY) {
            this.client = new OpenAI({
                baseURL: 'https://api.deepseek.com',
                apiKey: process.env.DEEPSEEK_API_KEY
            });
        } else {
            console.warn('[QUANT] Missing DEEPSEEK_API_KEY. Agent will run in mock mode.');
        }
    }

    async onTick(marketData) {
        if (!this.client) return;
        if (this.isThinking) return;

        // Simple cooldown or condition to decide when to think
        // For scalping, maybe every 5-15 minutes or on significant price moves?
        // For now, checks every tick but rate limiting is handled by the Manager invoking onTick

        this.isThinking = true;

        try {
            const { symbol, currentPrice, rsi, trend, ema200, bollinger, candles } = marketData;

            // Format last 50 candles for DeepSeek
            const ohlcvHistory = (candles || []).slice(-50).map(c =>
                `[${new Date(c.time).toISOString().substr(11, 5)}] O:${c.open} H:${c.high} L:${c.low} C:${c.close} V:${c.volume}`
            ).join('\n');

            const prompt = `
You are a pure mathematician and technical scalper. You DO NOT care about news. You only care about Price Action, Volume, and Probability.
Your goal is to capture small, rapid movements.

Market Data for ${symbol}:
- Price: ${currentPrice}
- Trend (200 EMA): ${trend}
- RSI (14): ${rsi.toFixed(2)}
- Volatility (BB Width): ${(bollinger.upper - bollinger.lower).toFixed(2)}
- 200 EMA Level: ${ema200.toFixed(2)}

Recent Price Action (Last 50 Candles - M5):
${ohlcvHistory}

Math/Logic:
1. Analyze the OHLCV sequence for hidden patterns (Divergence, Exhaustion, Breakouts).
2. If RSI > 70, is momentum exhausting?
3. If RSI < 30, is it oversold?
4. Are we bouncing off the 200 EMA?

Output a JSON object ONLY:
{
  "action": "BUY" | "SELL" | "HOLD",
  "confidence": number (0-100),
  "reason": "String (max 20 words)",
  "stopLoss": number,
  "takeProfit": number
}
`;

            const completion = await this.client.chat.completions.create({
                messages: [{ role: "system", content: prompt }],
                model: "deepseek-reasoner", // or deepseek-chat if reasoner invalid
            });

            const response = completion.choices[0].message.content;
            this.processDecision(response, symbol, currentPrice);

        } catch (error) {
            console.error('[QUANT] Error thinking:', error.message);
        } finally {
            this.isThinking = false;
        }
    }

    processDecision(responseText, symbol, currentPrice) {
        try {
            // Basic JSON extraction cleanup
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) return;

            const decision = JSON.parse(jsonMatch[0]);
            this.lastThought = decision.reason;
            this.lastAction = decision.action;

            if (decision.action !== 'HOLD' && decision.confidence > 75) {
                // Calculate dynamic size based on risk (simplified for now)
                const size = 0.05; // Default scalp size

                this.executeTrade(
                    symbol,
                    decision.action,
                    size,
                    currentPrice,
                    decision.stopLoss,
                    [{ id: 1, price: decision.takeProfit, percentage: 1.0, hit: false }],
                    decision.reason
                );
            }
        } catch (e) {
            console.error('[QUANT] Failed to parse decision:', e);
        }
    }
}
