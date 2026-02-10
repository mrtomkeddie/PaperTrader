import { GoogleGenAI } from "@google/genai";
import { Agent } from './Agent.js';
import { detectFairValueGap, detectOrderBlock, analyzeMarketStructure, getPreviousDayLevels } from '../utils/technicalAnalysis.js';

/**
 * SniperAgent (The Sniper)
 * Specialist in Smart Money Concepts (SMC) and Price Action.
 * Looks for Liquidity Sweeps, Order Blocks, and FVG rebalances.
 */
export class SniperAgent extends Agent {
    constructor() {
        super('sniper', 'The Sniper', 'SMC Specialist (Gemini)', 1000);

        if (process.env.API_KEY || process.env.GOOGLE_API_KEY) {
            const key = process.env.API_KEY || process.env.GOOGLE_API_KEY;
            this.client = new GoogleGenAI({ apiKey: key });
        } else {
            console.warn('[SNIPER] Missing GOOGLE_API_KEY for Gemini.');
        }

        this.cooldownMinutes = 5; // Aggressive but safe
        this.lastActionTime = 0;
    }

    async onTick(snapshot) {
        const now = Date.now();
        const { symbol, currentPrice, candlesM5, candlesM15 } = snapshot;

        // 1. Technical Scanning (Hard-coded logic before AI)
        const fvg = detectFairValueGap(candlesM5);
        const ob = detectOrderBlock(candlesM5);
        const structure = analyzeMarketStructure(candlesM5);
        const dayLevels = getPreviousDayLevels(candlesM15);

        // Calculate distances to key levels
        const distPDH = currentPrice - dayLevels.pdh;
        const distPDL = currentPrice - dayLevels.pdl;

        // Detection Flags
        const isSweepHigh = distPDH > 0 && distPDH < (currentPrice * 0.0005); // Pierced PDH slightly
        const isSweepLow = distPDL < 0 && Math.abs(distPDL) < (currentPrice * 0.0005); // Pierced PDL slightly

        const insights = {
            fvg: fvg.isDetected ? `${fvg.type} FVG at ${fvg.gapBottom.toFixed(2)}-${fvg.gapTop.toFixed(2)}` : 'None',
            ob: ob.isDetected ? `${ob.type} OB at ${ob.bottom.toFixed(2)}-${ob.top.toFixed(2)}` : 'None',
            zone: structure.zone,
            pdh: dayLevels.pdh,
            pdl: dayLevels.pdl,
            isSweepHigh,
            isSweepLow
        };

        // 2. Cooldown check
        if (now - this.lastActionTime < this.cooldownMinutes * 60 * 1000) return;

        // 3. Consult the Sniper (Gemini)
        await this.consultSniper(snapshot, insights);
    }

    async consultSniper(snapshot, insights) {
        if (!this.client) return;

        const { symbol, currentPrice } = snapshot;
        this.isThinking = true;

        const prompt = `
You are "The Sniper", a specialist in Smart Money Concepts (SMC) and Price Action trading Gold (XAUUSD).
Your goal is to find high-probability "Institutional" setups.

CURRENT MARKET DATA:
- Symbol: ${symbol}
- Current Price: ${currentPrice}
- Market Zone: ${insights.zone} (Premium = Sell Zone, Discount = Buy Zone)
- FVG Status: ${insights.fvg}
- Order Block Status: ${insights.ob}
- Previous Day High (PDH): ${insights.pdh}
- Previous Day Low (PDL): ${insights.pdl}
- Sweep High Detect: ${insights.isSweepHigh} (Price pierced yesterday's high)
- Sweep Low Detect: ${insights.isSweepLow} (Price pierced yesterday's low)

STRATEGY GUIDELINES:
1. **Liquidity Sweep**: If price sweeps PDH/PDL and shows a reversal candle (rejection), look for a trade back to Equilibrium.
2. **Order Block Retest**: If price returns to a Bullish OB in a Discount zone, or Bearish OB in a Premium zone, look for entry.
3. **FVG Rebalance**: If there is a large FVG, price often gravitates toward it.
4. **Directional Bias**: Align with the Market Structure zone where possible.

RISK RULES:
- If no clear SMC structure exists, HOLD.
- Confidence must be > 80% to act.

Output a JSON object ONLY:
{
  "action": "BUY" | "SELL" | "HOLD",
  "confidence": 0-100,
  "reason": "Clear explanation of the SMC setup",
  "stopLoss": number,
  "takeProfit": number
}
`;

        try {
            const text = await this.client.generateContent(prompt, "gemini-2.0-flash");

            this.processDecision(text, symbol, currentPrice, snapshot);
            this.lastActionTime = Date.now();
        } catch (e) {
            console.error('[SNIPER] AI Error:', e);
        } finally {
            this.isThinking = false;
        }
    }

    processDecision(responseText, symbol, currentPrice, snapshot) {
        try {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) return;

            const decision = JSON.parse(jsonMatch[0]);
            this.lastThought = decision.reason;
            this.lastAction = decision.action;
            this.latestDecision = decision;

            if (decision.action !== 'HOLD' && decision.confidence > 80) {
                // Execute trade via base class
                this.executeTrade(
                    symbol,
                    decision.action,
                    0, // Size calculated by Agent.js
                    currentPrice,
                    decision.stopLoss,
                    [decision.takeProfit, decision.takeProfit * 1.002, decision.takeProfit * 1.005], // Ladder
                    decision.reason,
                    snapshot
                );
            }
        } catch (e) {
            console.error('[SNIPER] Failed to parse decision:', e);
        }
    }
}

