import { Agent } from './Agent.js';
import { GoogleGenAI } from "@google/genai";

export class MacroAgent extends Agent {
    constructor() {
        super('macro', 'The Strategist', 'Global Macro (Gemini)', 1000);

        if (process.env.API_KEY || process.env.GOOGLE_API_KEY) {
            const key = process.env.API_KEY || process.env.GOOGLE_API_KEY;
            this.client = new GoogleGenAI({ apiKey: key });
        } else {
            console.warn('[MACRO] Missing API_KEY for Gemini.');
        }
    }

    async onTick(marketData) {
        if (!this.client) return;
        if (this.isThinking) return;

        this.isThinking = true;

        try {
            const { symbol, currentPrice, htfTrend, trend } = marketData;

            const prompt = `
You are a Global Macro Investor. You care about the 'Why'. 

Current Context:
- Asset: ${symbol}
- Price: ${currentPrice}
- Technical Trend (Daily): ${htfTrend}
- Short Term Trend: ${trend}

BEFORE making any trading decision, you must perform a Google Search for these specific real-time data points:
1. "Current US Dollar Index (DXY) trend today" (Inverse correlation to Gold).
2. "Upcoming FOMC meeting date and interest rate probability" (Rates drive Gold).
3. "Latest geopolitical tensions Middle East Russia Ukraine" (Fear drives Gold).
4. "Gold price XAUUSD news analysis today".

Process:
1. List 3 reasons why Gold might CRASH (Bear Case).
2. List 3 reasons why Gold might RALLY (Bull Case).
3. Weigh the evidence neutrally.
4. Summarize the "Global Sentiment" as a score from -10 (Extreme Bearish) to +10 (Extreme Bullish).
5. Only THEN look at the price chart.

Task:
Assess the global macro environment based on your findings and the price trend.
Decide if the "Big Picture" supports a position.

Output a JSON object ONLY:
{
  "action": "BUY" | "SELL" | "HOLD",
  "confidence": number (0-100),
  "sentiment_score": number (-10 to +10),
  "reason": "String (max 20 words)",
  "stopLoss": number, 
  "takeProfit": number,
  "timeframe": "2 weeks"
}
`;

            const response = await this.client.models.generateContent({
                model: 'gemini-2.0-flash',
                contents: prompt,
                config: {
                    tools: [{ googleSearch: {} }]
                }
            });
            const text = response.text;
            this.processDecision(text, symbol, currentPrice);

        } catch (error) {
            console.error('[MACRO] Error thinking:', error.message);
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
            this.latestDecision = decision; // Save for Manager

            if (decision.action !== 'HOLD' && decision.confidence > 80) {
                // Calculate Profit Ladder (3-tier)
                const isBuy = decision.action === 'BUY';
                const dist = Math.abs(decision.takeProfit - currentPrice);

                // TP1: Original (40%), TP2: 1.5x dist (40%), TP3: 3x dist (20%)
                const tp2 = isBuy ? currentPrice + (dist * 1.5) : currentPrice - (dist * 1.5);
                const tp3 = isBuy ? currentPrice + (dist * 3.0) : currentPrice - (dist * 3.0);

                const tpLevels = [
                    { id: 1, price: decision.takeProfit, percentage: 0.4, hit: false },
                    { id: 2, price: tp2, percentage: 0.4, hit: false },
                    { id: 3, price: tp3, percentage: 0.2, hit: false }
                ];

                this.executeTrade(
                    symbol,
                    decision.action,
                    0,
                    currentPrice,
                    decision.stopLoss,
                    tpLevels,
                    decision.reason,
                    this.latestDecision
                );
            }
        } catch (e) {
            console.error('[MACRO] Failed to parse decision:', e);
        }
    }
}
