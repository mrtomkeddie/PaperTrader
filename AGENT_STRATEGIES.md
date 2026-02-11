# AI Trading Agents & Strategies Overview

Paper Trader utilizes a multi-agent artificial intelligence architecture. Each agent acts as a specialized trader with a unique role, model, and decision-making logic. 

## 1. Core Agents

The system features three distinct agents coordinated by a Central Manager.

### 🎯 The Sniper (SMC Agent)
*   **Model:** `Gemini 2.0 Flash`
*   **Role:** Price Action Specialist & Market Structure Hunter.
*   **Strategy:** "Institutional Flow" Analysis. It ignores news and looks for patterns created by big money.
*   **Execution Logic:**
    *   **Market Context:** Uses `analyzeMarketStructure` to identify Premium vs. Discount zones.
    *   **Pattern 1 (Liquidity Sweeps):** Trades reversals when price pierces the Previous Day High/Low (PDH/PDL) and rejects.
    *   **Pattern 2 (Order Blocks):** Enters at institutional supply/demand zones (Bullish/Bearish OB).
    *   **Pattern 3 (Fair Value Gaps):** Targets rebalances when price logic dictates a gap fill.
    *   **Trigger:** Operates on a 5-minute cycle (high-sensitivity).
    *   **Confidence Threshold:** Requires **>80%** confidence to execute.
*   **Why it trades:** When a high-conviction geometric setup (Sweep or OB) aligns with a Discount (for BUY) or Premium (for SELL) zone.

### 🔢 The Quant (Quant Agent)
*   **Model:** `DeepSeek R1`
*   **Role:** Technical Scalper & Trend Follower.
*   **Strategy:** Trend-Aligned Mean Reversion.
*   **Execution Logic:**
    *   **Guardrails (Critical):**
        *   **Trend Consensus:** STRICTLY respects the **200 EMA**. It never buys below the 200 EMA (Bear Market) and never sells above it (Bull Market).
        *   **Squeeze Filter:** Avoids trading during low-volatility "squeezes" (tight Bollinger Bands), waiting for expansion instead.
    *   **Technical Input:** Analyzes M5 Price Action, RSI, 200 EMA, and Bollinger Bands.
    *   **Trigger:** Operates on a 60-second cycle.
    *   **Confidence Threshold:** Requires **>70%** confidence.
*   **Why it trades:** when a mathematical setup occurs **in the direction of the dominant trend**.
    *   **Bull Mode (>200 EMA):** Buys dips when RSI < **40**.
    *   **Bear Mode (<200 EMA):** Sells rallies when RSI > **70** (tightened from 60 to reduce sell-side bias).

### 🤨 The Skeptic (Risk Agent)
*   **Model:** `Gemini 2.0 Flash`
*   **Role:** Contrarian and Risk Manager.
*   **Strategy:** Crowd Psychology. It looks for flaws and extremes in the market.
*   **Execution Logic:**
    *   **Sentiment Input:** Combines technical data (RSI) with the Global Sentiment Score provided by the Macro Agent.
    *   **Contrarian Filters:**
        *   **Bubble Check:** If RSI > 80 AND Sentiment is extremely bullish (+8), it looks for a SHORT.
        *   **Panic Check:** If RSI < 20 AND Sentiment is extremely bearish (-8), it looks for a LONG.
    *   **Trigger:** Operates on a 60-second cycle.
    *   **Confidence Threshold:** Requires **>85%** confidence.
*   **Why it trades:** When the "crowd" is over-extended in one direction, creating a high-probability reversal opportunity based on mania or panic.

---

## 2. Unified Risk Management

Regardless of which agent triggers a trade, all execution is governed by a strict, hard-coded safety layer in the base `Agent` class.

| Feature | Specification |
| :--- | :--- |
| **Risk Per Trade** | Exactly **1%** of the agent's equity. |
| **Lot Sizing** | Calculated dynamically based on the distance between Entry and Stop Loss. |
| **Trade Cooldown** | 5 minutes between trades (hard limit). |
| **Max Positions** | 2 open trades per agent. |
| **Profit Ladder** | 3-tier scaling (40% at TP1, 40% at TP2, 20% "runner" at TP3). |
| **Auto-Breakeven** | SL is moved to entry price at **+0.1% profit** (to protect capital early). |
| **Trailing Stop** | Activated after **TP1 (0.25%)** with a tight **0.1%** trail distance. |
| **Curfew** | **No new trades** between **10:30 and 12:00 UTC** (Danger Zone). |

---

## 3. The AI Guardian

An active safety feature that monitors all open positions. If any agent (typically the Macro or Risk agent) detects a high-confidence shift in sentiment that opposes an existing trade, the **AI Guardian** will immediately "panic-close" the trade to prevent a potential reversal loss.

> [!NOTE]
> Legacy strategies like "London Sweep" and manual "Trend Following" mentioned in older documentation have been superseded by this Multi-Agent architecture to provide more robust, AI-driven decision-making.
