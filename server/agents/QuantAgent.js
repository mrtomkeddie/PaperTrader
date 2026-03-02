import { Agent } from './Agent.js';
import Anthropic from '@anthropic-ai/sdk';
import { RSI, EMA, ATR } from 'technicalindicators';

export class QuantAgent extends Agent {
    constructor() {
        super('quant', 'The Quant', 'Technical Scalper (Claude 3.5 Haiku)', 1000);

        // Initialize Anthropic Client
        if (process.env.ANTHROPIC_API_KEY) {
            this.client = new Anthropic({
                apiKey: process.env.ANTHROPIC_API_KEY
            });
        } else {
            console.warn('[QUANT] Missing ANTHROPIC_API_KEY. Agent will run in mock mode.');
        }
        // Initialize state
        this.lastTickTime = 0;
    }

    async onTick(marketData) {
        // if (!this.client) return; // AI BYPASS: No client needed
        if (this.isThinking) return;

        // Scalper Cooldown: Check every 60 seconds max
        const now = Date.now();
        if (now - this.lastTickTime < 60000) return;
        this.lastTickTime = now;

        this.isThinking = true;

        try {
            const { symbol, currentPrice, candles } = marketData;

            if (!candles || candles.length < 200) {
                console.log(`[Quant] Insufficient candles for indicators: ${candles?.length || 0}`);
                return;
            }

            // 1. PREPARE THE DATA
            const closes = candles.map(c => c.close);
            const highs = candles.map(c => c.high);
            const lows = candles.map(c => c.low);

            // 2. RUN THE MATH LOCAL GATEKEEPER (Cost: $0.00, Time: 1ms)
            const rsiValues = RSI.calculate({ period: 14, values: closes });
            const emaValues = EMA.calculate({ period: 200, values: closes });
            const atrValues = ATR.calculate({ high: highs, low: lows, close: closes, period: 14 });

            const currentRSI = rsiValues[rsiValues.length - 1];
            const currentEMA = emaValues[emaValues.length - 1];
            const currentATR = atrValues[atrValues.length - 1];

            let mathSignal = 'NONE';

            // 3. CHECK ENTRY RULES (EMA 200 trend alignment + relaxed RSI bands)
            // Relaxed from 70/40 to 65/45 to avoid long inactive periods.
            if (currentPrice < currentEMA && currentRSI > 65) {
                mathSignal = 'SELL';
            } else if (currentPrice > currentEMA && currentRSI < 45) {
                mathSignal = 'BUY';
            }

            // 4. THE GATE EXITS IF NO SETUP IS FOUND
            if (mathSignal === 'NONE') {
                console.log(`[Quant] Math Gatekeeper: No setup. RSI: ${currentRSI.toFixed(2)}. Sleeping.`);
                return;
            }

            // ==========================================
            // 5. WAKE UP THE AI (Only happens ~5% of the time)
            // ==========================================
            console.log(`[Quant] Math Gatekeeper triggered ${mathSignal}! Waking up AI for confirmation...`);

            const prompt = `
            You are the Quant Agent. My mathematical algorithms have flagged a potential ${mathSignal} setup for ${symbol}.
            
            Current Market Context:
            - Price: ${currentPrice}
            - 200 EMA: ${currentEMA.toFixed(2)}
            - RSI (14): ${currentRSI.toFixed(2)}
            
            Look at the recent candlestick data (last 5 candles): 
            ${JSON.stringify(candles.slice(-5))}

            Your Job: Do you see any major red flags in the candlestick price action (like a massive rejection wick opposing the trade) that means we should cancel this trade? 
            
            - If the price action looks CLEAN and supports the ${mathSignal} move, reply with "CONFIRM".
            - If you see a major REJECTION or strong momentum AGAINST the ${mathSignal} move, reply with "CANCEL".

            IMPORTANT: Output a JSON object ONLY:
            { "decision": "CONFIRM" or "CANCEL", "confidence": number (0-100), "reason": "string" }
            `;

            // --- AI BYPASS ACTIVE ---
            // const message = await this.client.messages.create({
            //     model: "claude-3-haiku-20240307",
            //     max_tokens: 1024,
            //     messages: [{ role: "user", content: prompt }],
            // });
            //
            // const responseText = message.content[0].text;
            // console.log(`[QUANT] AI Response: ${responseText}`);
            //
            // const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            // if (!jsonMatch) {
            //     console.error('[QUANT] No JSON found in response');
            //     return;
            // }
            //
            // const aiResponse = JSON.parse(jsonMatch[0]);
            const aiResponse = {
                decision: 'CONFIRM',
                confidence: 100,
                reason: "Pure Algo Execution: Math conditions met. AI bypassed."
            };
            console.log(`[QUANT] AI BYPASS: Auto-confirming ${mathSignal} signal.`);
            // ------------------------

            if (aiResponse.decision === 'CONFIRM' && aiResponse.confidence > 70) {
                this.lastThought = aiResponse.reason;
                this.lastAction = mathSignal;

                // Calculate dynamic Stop Loss using the ATR math we just ran
                const atrMultiplier = 1.5;
                const riskDist = currentATR * atrMultiplier;
                const stopLoss = mathSignal === 'BUY' ? currentPrice - riskDist : currentPrice + riskDist;

                // Profit ladder logic
                const tp1Dist = riskDist * 1.0;
                const tp2Dist = riskDist * 2.0;
                const tp3Dist = riskDist * 4.0;

                const tp1 = mathSignal === 'BUY' ? currentPrice + tp1Dist : currentPrice - tp1Dist;
                const tp2 = mathSignal === 'BUY' ? currentPrice + tp2Dist : currentPrice - tp2Dist;
                const tp3 = mathSignal === 'BUY' ? currentPrice + tp3Dist : currentPrice - tp3Dist;

                const tpLevels = [
                    { id: 1, price: Number(tp1.toFixed(2)), percentage: 0.4, hit: false },
                    { id: 2, price: Number(tp2.toFixed(2)), percentage: 0.4, hit: false },
                    { id: 3, price: Number(tp3.toFixed(2)), percentage: 0.2, hit: false }
                ];

                this.executeTrade(
                    symbol,
                    mathSignal,
                    0, // Size calculated in Agent.js
                    currentPrice,
                    Number(stopLoss.toFixed(2)),
                    tpLevels,
                    aiResponse.reason,
                    { rsi: currentRSI, ema200: currentEMA, atr: currentATR }
                );
            } else {
                console.log(`[Quant] AI overruled the math setup. Reason: ${aiResponse.reason}`);
                this.lastThought = `Vetoed: ${aiResponse.reason}`;
                this.lastAction = "HOLD";
            }

        } catch (error) {
            console.error('[QUANT] Error thinking:', error.message);
        } finally {
            this.isThinking = false;
        }
    }
}
