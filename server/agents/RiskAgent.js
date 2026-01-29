import { Agent } from './Agent.js';
import Anthropic from '@anthropic-ai/sdk';

export class RiskAgent extends Agent {
    constructor() {
        super('risk', 'The Skeptic', 'Risk Manager (Claude)', 1000);

        if (process.env.ANTHROPIC_API_KEY) {
            this.client = new Anthropic({
                apiKey: process.env.ANTHROPIC_API_KEY,
            });
        } else {
            console.warn('[RISK] Missing ANTHROPIC_API_KEY.');
        }
    }

    async onTick(marketData) {
        if (!this.client) return;
        if (this.isThinking) return;

        this.isThinking = true;

        try {
            const { symbol, currentPrice, rsi, trend, sentiment, globalSentiment } = marketData;

            const prompt = `
You are a Contrarian and Risk Manager. Your job is to find the flaw.
If the market feels euphoric, you sell. If the market is panic-selling, you buy.

Market Data for ${symbol}:
- Price: ${currentPrice}
- RSI: ${rsi}
- Market Trend: ${trend}
- General Sentiment: ${sentiment || 'Unknown'}
- global_macro_sentiment_score: ${globalSentiment !== null ? globalSentiment : 'Unknown'} (-10 to +10)

Risk Logic:
1. "Bubble Check": If RSI > 80 AND global_macro_sentiment_score > 8, the crowd is manic. SHORT.
2. "Panic Check": If RSI < 20 AND global_macro_sentiment_score < -8, the crowd is panicking. LONG.
3. "Trend Confirmation": If RSI is neutral but Sentiment is Extreme, simple profit taking?

Output a JSON object ONLY:
{
  "action": "BUY" | "SELL" | "HOLD",
  "confidence": number (0-100),
  "reason": "String (max 20 words)",
  "stopLoss": number,
  "takeProfit": number
}
`;

            const message = await this.client.messages.create({
                max_tokens: 1024,
                messages: [{ role: 'user', content: prompt }],
                model: 'claude-sonnet-4-20250514',
            });

            // Anthropic response structure: message.content[0].text
            const text = message.content[0].text;
            this.processDecision(text, symbol, currentPrice);

        } catch (error) {
            console.error('[RISK] Error thinking:', error.message);
        } finally {
            this.isThinking = false;
        }
    }

    processDecision(responseText, symbol, currentPrice) {
        try {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) return;

            const decision = JSON.parse(jsonMatch[0]);
            this.lastThought = decision.reason;
            this.lastAction = decision.action;

            // Risk agent ONLY trades if high confidence "Contrarian" signal
            if (decision.action !== 'HOLD' && decision.confidence > 85) {
                // Hedge size?
                // Size is now calculated dynamically by the base Agent class based on Risk/StopLoss

                this.executeTrade(
                    symbol,
                    decision.action,
                    0, // Size ignored (calculated dynamically)
                    currentPrice,
                    decision.stopLoss,
                    [{ id: 1, price: decision.takeProfit, percentage: 1.0, hit: false }],
                    decision.reason
                );
            }
        } catch (e) {
            console.error('[RISK] Failed to parse decision:', e);
        }
    }
}
