# AI Trading Agents & Strategies Overview

Paper Trader utilizes a multi-agent artificial intelligence architecture. Each agent acts as a specialized trader with a unique role, model, and decision-making logic. 

## 1. Core Agents

The system features three distinct agents coordinated by a Central Manager.

### 🧠 The Strategist (Macro Agent)
*   **Model:** `Gemini 2.0 Flash` (with Real-Time Google Search)
*   **Role:** Global Macro Investor specializing in fundamental analysis.
*   **Strategy:** "Why" Analysis. It focuses on the underlying drivers of price movement.
*   **Execution Logic:**
    *   **Search Input:** Performs real-time searches for the US Dollar Index (DXY), FOMC meeting probabilities, geopolitical tensions (Middle East, Russia, Ukraine), and Gold news.
    *   **Decision Process:** Weighs Bull vs. Bear cases neutrally before assessing the price chart.
    *   **Trigger:** Operates on a 15-minute cycle.
    *   **Confidence Threshold:** Requires **>80%** confidence to execute a trade.
*   **Why it trades:** When global sentiment and fundamental data (e.g., a weakening Dollar or rising geopolitical risk) strongly support a move that aligns with the price trend.

### 🔢 The Quant (Quant Agent)
*   **Model:** `DeepSeek R1`
*   **Role:** Technical Scalper focusing on pure mathematical probability.
*   **Strategy:** Mathematical Price Action. It ignores news and sentiment entirely.
*   **Execution Logic:**
    *   **Technical Input:** Analyzes the last 50 candles (M5), RSI, 200 EMA, and Bollinger Band width.
    *   **Pattern Recognition:** Looks for technical signatures like divergence, momentum exhaustion, and breakouts.
    *   **Trigger:** Operates on a 60-second cycle.
    *   **Confidence Threshold:** Requires **>70%** confidence.
*   **Why it trades:** When the mathematical metrics align (e.g., price bouncing off a major EMA level while RSI shows oversold conditions), suggesting a high-probability technical move.

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
| **Auto-Breakeven** | SL is moved to entry price as soon as **TP1 (0.6%)** is hit. |
| **Trailing Stop** | Activated after **TP2 (1.0%)** to lock in gains on the runner. |

---

## 3. The AI Guardian

An active safety feature that monitors all open positions. If any agent (typically the Macro or Risk agent) detects a high-confidence shift in sentiment that opposes an existing trade, the **AI Guardian** will immediately "panic-close" the trade to prevent a potential reversal loss.

> [!NOTE]
> Legacy strategies like "London Sweep" and manual "Trend Following" mentioned in older documentation have been superseded by this Multi-Agent architecture to provide more robust, AI-driven decision-making.
