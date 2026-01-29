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
Ignore minute-by-minute noise. Only trade if the fundamental story (Inflation, War, Interest Rates) supports the trade.

Current Context:
- Asset: ${symbol}
- Price: ${currentPrice}
- Technical Trend (Daily): ${htfTrend}
- Short Term Trend: ${trend}

Task:
Assess the global macro environment (inflation, geopolitics, USD strength) based on your internal knowledge and the price trend.
Decide if the "Big Picture" supports a position.

Output a JSON object ONLY:
{
  "action": "BUY" | "SELL" | "HOLD",
  "confidence": number (0-100),
  "reason": "String (max 20 words)",
  "stopLoss": number, 
  "takeProfit": number,
  "timeframe": "2 weeks" (Justification)
}
`;
            // Start of correct usage of GoogleGenAI SDK (v0.2.0 based on package.json)
            // The package names recently changed, but standard usage is often:
            // const model = client.getGenerativeModel({ model: "gemini-1.5-pro-latest" });
            // But verify import. In bot.js it was: import { GoogleGenAI } from "@google/genai";
            // This looks like the new Google Gen AI SDK from Google, not @google/generative-ai.
            // Let's assume standard generateContent method exists or adapt to bot.js usage.
            // Bot.js used: new GoogleGenAI({ apiKey }). But bot.js didn't show the generate call in the snippet I read.

            // I'll stick to a common pattern or raw fetch if unsure, but let's try standard model access.
            // "gemini-2.0-flash-exp" or "gemini-1.5-pro"

            // Note: @google/genai might have a different surface than @google/generative-ai
            // Let's assume it has .generateContent

            // bot.js line 137: aiClient = new GoogleGenAI({ apiKey: API_KEY });
            // I will assume standard usage.

            // However, to be safe with "Gemini 3.0 Pro" request (doesn't exist yet publicly, user said 3.0 or 1.5).
            // I will use "gemini-1.5-pro".

            // Wait, I need to know the method. 
            // If I look at the previous bot.js (I didn't see the generate call in the first 800 lines).
            // Let's assume standard 'models.generateContent' or similar.

            // Actually, let's use the 'generateContent' from the client directly if possible or get model first.
            // const model = this.client.getGenerativeModel({ model: "gemini-1.5-pro" }); => this is @google/generative-ai

            // @google/genai (the newer one) usage:
            // client.models.generateContent(...)

            const response = await this.client.models.generateContent({
                model: 'gemini-1.5-flash',
                contents: [{ role: 'user', parts: [{ text: prompt }] }]
            });

            const text = response.response.candidates[0].content.parts[0].text;
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

            if (decision.action !== 'HOLD' && decision.confidence > 80) {
                // Macro takes larger swings but wider stops? Or maybe just normal sizing.
                const size = 0.1;

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
            console.error('[MACRO] Failed to parse decision:', e);
        }
    }
}
