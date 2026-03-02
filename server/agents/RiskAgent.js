import { Agent } from './Agent.js';
import { GoogleGenAI } from "@google/genai";
import { RSI, ATR } from 'technicalindicators';

export class RiskAgent extends Agent {
    constructor() {
        super('risk', 'The Skeptic', 'Risk Manager (Gemini)', 1000);

        if (process.env.API_KEY || process.env.GOOGLE_API_KEY) {
            const key = process.env.API_KEY || process.env.GOOGLE_API_KEY;
            this.client = new GoogleGenAI({ apiKey: key });
        } else {
            console.warn('[RISK] Missing GOOGLE_API_KEY for Gemini.');
        }
        this.lastTickTime = 0;
    }

    async onTick(marketData) {
        // if (!this.client) return; // AI BYPASS: No client needed
        if (this.isThinking) return;

        // Risk Cooldown: Check every 60 seconds
        const now = Date.now();
        if (now - this.lastTickTime < 60000) return;
        this.lastTickTime = now;

        this.isThinking = true;

        try {
            const { symbol, currentPrice, candles, globalSentiment } = marketData;

            if (!candles || candles.length < 14) {
                console.log(`[Risk] Insufficient candles for RSI: ${candles?.length || 0}`);
                return;
            }

            // 1. SILENT GATEKEEPER (Free Math)
            const closes = candles.map(c => c.close);
            const highs = candles.map(c => c.high);
            const lows = candles.map(c => c.low);
            const rsiValues = RSI.calculate({ period: 14, values: closes });
            const atrValues = ATR.calculate({ high: highs, low: lows, close: closes, period: 14 });
            const currentRSI = rsiValues[rsiValues.length - 1];
            const currentATR = atrValues[atrValues.length - 1];

            let mathSignal = 'NONE';
            if (currentRSI < 20) mathSignal = 'BUY';  // Potential Panic
            if (currentRSI > 80) mathSignal = 'SELL'; // Potential Bubble

            // Exit immediately if no extreme RSI is found
            if (mathSignal === 'NONE') {
                console.log(`[Risk] RSI at ${currentRSI.toFixed(2)}. No extremes. Sleeping.`);
                return;
            }

            // 2. FETCH SENTIMENT (Only if RSI is extreme)
            const sentimentScore = globalSentiment; // -10 to +10

            // Ensure the sentiment matches the extreme RSI
            // If sentiment is null, we can't fully validate the "crowd behavior" rule, 
            // but we'll proceed if we want to be safe or block if we want to be strict.
            // Following the user's logic:
            if (sentimentScore !== null) {
                if (mathSignal === 'BUY' && sentimentScore > -8) {
                    console.log(`[Risk] RSI is low (${currentRSI.toFixed(2)}), but crowd isn't panicking (Score: ${sentimentScore}). Cancel.`);
                    return;
                }
                if (mathSignal === 'SELL' && sentimentScore < 8) {
                    console.log(`[Risk] RSI is high (${currentRSI.toFixed(2)}), but crowd isn't euphoric (Score: ${sentimentScore}). Cancel.`);
                    return;
                }
            }

            // ==========================================
            // 3. WAKE UP GEMINI (Only for true, rare extremes)
            // ==========================================
            console.log(`[Risk] Extreme Panic/Bubble detected! Waking up Gemini 2.0 Flash...`);

            const prompt = `
            You are The Skeptic, a contrarian Risk Agent.
            Mathematical conditions for a massive reversal have been met:
            - Signal Direction: ${mathSignal}
            - RSI: ${currentRSI.toFixed(2)}
            - Global Sentiment Score: ${sentimentScore !== null ? sentimentScore : 'Unknown'} (Extreme)
            
            Look at the recent candlestick data (last 5 candles): 
            ${JSON.stringify(candles.slice(-5))}

            Your Job: We are trying to catch a falling knife (BUY) or short a rocket (SELL). Do the candlestick patterns show exhaustion (like long rejection wicks) confirming the reversal, or is momentum still too strong?
            
            IMPORTANT: Output a JSON object ONLY:
            { "decision": "CONFIRM" or "CANCEL", "confidence": number, "reason": "string", "stopLoss": number, "takeProfit": number }
            `;

            // --- AI BYPASS ACTIVE ---
            // const response = await this.client.models.generateContent({
            //     model: 'gemini-2.0-flash',
            //     contents: prompt
            // });
            // const text = response.text;
            const aiResponse = {
                decision: 'CONFIRM',
                confidence: 100,
                reason: "Pure Algo Execution: Math conditions met. AI bypassed."
            };
            const text = JSON.stringify(aiResponse);
            console.log(`[RISK] AI BYPASS: Auto-confirming ${mathSignal} signal.`);
            // ------------------------

            this.processDecision(text, symbol, currentPrice, mathSignal, currentATR);

        } catch (error) {
            console.error('[RISK] Error thinking:', error.message);
        } finally {
            this.isThinking = false;
        }
    }

    processDecision(responseText, symbol, currentPrice, mathSignal, currentATR = 0) {
        try {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) return;

            const decision = JSON.parse(jsonMatch[0]);
            this.lastThought = decision.reason;
            this.lastAction = decision.action || mathSignal;
            this.latestDecision = decision;

            // Risk agent ONLY trades if high confidence "Contrarian" signal (85%+)
            if (decision.decision === 'CONFIRM' && decision.confidence >= 85) {
                // Calculate Profit Ladder (3-tier)
                // We'll use the TP provided by the AI if available, or fall back to a 2x ATR dist
                // Note: The user's code snippet didn't include TP/SL logic in the confirm block, 
                // but the existing RiskAgent had it. I'll maintain the robust TP ladder.

                const isBuy = mathSignal === 'BUY';
                // Fallback TP/SL if AI doesn't provide valid numbers.
                // ATR-based fallback avoids oversized stops that force lot size < 0.01 and reject the trade.
                const atrDist = Number.isFinite(currentATR) && currentATR > 0
                    ? currentATR
                    : currentPrice * 0.0015;
                const fallbackRiskDist = Math.max(atrDist * 1.2, currentPrice * 0.0005);
                const fallbackTpDist = fallbackRiskDist * 2;
                const targetTP = Number.isFinite(decision.takeProfit)
                    ? decision.takeProfit
                    : (isBuy ? currentPrice + fallbackTpDist : currentPrice - fallbackTpDist);
                const dist = Math.abs(targetTP - currentPrice);

                // TP1: Original (40%), TP2: 1.5x dist (40%), TP3: 3x dist (20%)
                const tp2 = isBuy ? currentPrice + (dist * 1.5) : currentPrice - (dist * 1.5);
                const tp3 = isBuy ? currentPrice + (dist * 3.0) : currentPrice - (dist * 3.0);

                const tpLevels = [
                    { id: 1, price: targetTP, percentage: 0.4, hit: false },
                    { id: 2, price: tp2, percentage: 0.4, hit: false },
                    { id: 3, price: tp3, percentage: 0.2, hit: false }
                ];

                this.executeTrade(
                    symbol,
                    mathSignal,
                    0, // Size ignored (calculated dynamically)
                    currentPrice,
                    Number.isFinite(decision.stopLoss)
                        ? decision.stopLoss
                        : (isBuy ? currentPrice - fallbackRiskDist : currentPrice + fallbackRiskDist),
                    tpLevels,
                    decision.reason
                );
            } else {
                console.log(`[Risk] Gemini vetoed or low confidence (${decision.confidence}%). Reason: ${decision.reason}`);
                this.lastThought = `Vetoed: ${decision.reason}`;
                this.lastAction = "HOLD";
            }
        } catch (e) {
            console.error('[RISK] Failed to parse decision:', e);
        }
    }
}
