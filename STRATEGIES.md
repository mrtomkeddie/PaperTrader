# Trading Strategies & Execution Logic

This document details the algorithmic strategies, execution triggers, and risk management protocols used in the Paper Trader system.

## 1. Risk Management (Global)

All strategies share a unified risk management engine that handles Stop Losses, Take Profits, and Trailing Stops.

### Initial Risk Parameters
- **Stop Loss (SL):** Set at **0.15%** distance from the entry price (unless strategy specifies a custom SL).
- **Risk Per Trade:** Calculated dynamically to risk **1%** of the account balance based on the SL distance.

### Take Profit (TP) Levels
Trades are scaled out at three distinct levels to lock in profits:
1.  **TP1:** **0.6% Profit**. Closes **40%** of the position. **SL moved to Breakeven.**
2.  **TP2:** **1.0% Profit**. Closes **40%** of the position.
3.  **TP3:** **3.0% Profit**. Closes remaining **20%** of the position.

### Trailing Stop Logic
The system employs an active trailing stop to protect gains:
- **Activation:** Triggered when floating profit exceeds **0.2%**.
- **Trailing Distance:** Trails price at approximately **0.1%** distance.
    - *Longs:* New SL = `Bid Price * 0.999`
    - *Shorts:* New SL = `Ask Price * 1.001`
- **Update Rule:** The Stop Loss is only moved *forward* (closer to price), never backward.

### AI Guardian
The "AI Guardian" feature actively monitors open trades:
- **Trigger:** If the Gemini AI returns a high-confidence signal (>80%) that opposes the current position.
- **Action:** Immediately panic-closes the trade to prevent losses from a reversal.
    - *Example:* Closing a Long position if AI sentiment shifts to "BEARISH" with >80% confidence.

---

## 2. Active Strategies



### A. London Sweep
*Target Asset: XAUUSD (Gold)*

A mean-reversion strategy targeting liquidity sweeps during the London session.

- **Time Window:** **07:45 - 10:30** (London Time / UTC).
- **Trigger Conditions:**
    1.  **Liquidity Sweep:** Current M5 candle low drops below the lowest low of the previous 10 candles.
    2.  **Reclaim:** Price bounces back up (reclaims) at least **$0.50** above that lowest low level.
- **Direction:** **Long (Buy)** (Buying the dip/sweep).
- **Risk Profile:** Conservative.

### B. Trend Follow
*Target Asset: XAUUSD (Gold)*

A classic trend-following strategy that enters on pullbacks.

- **Trend Definition:**
    - **Uptrend:** Price is above the **200 EMA**.
    - **Downtrend:** Price is below the **200 EMA**.
- **Time Restrictions:**
    - **XAUUSD (Gold):** **Restricted to AFTER 12:00 UTC** to avoid conflict with the *London Sweep* strategy.
- **Trigger Conditions (Buy):**
    1.  Asset is in an **Uptrend**.
    2.  **Pullback:** Price dips to or below the **20 EMA**.
    3.  **Momentum:** Price Slope (10-period) is positive (> 0.1).
- **Trigger Conditions (Sell):**
    1.  Asset is in a **Downtrend**.
    2.  **Pullback:** Price rallies to or above the **20 EMA**.
    3.  **Momentum:** Price Slope is negative (< -0.1).
- **Risk Profile:** Aggressive.

### C. Gemini AI Agent
*Target Asset: Connects to configurable assets (Default: XAUUSD)*

Uses Google's Gemini AI to analyze market structure and sentiment.

- **Input Data:** The AI analyzes Price vs 200 EMA, M15 Trend, RSI, Slope, and Volatility.
- **Time Restrictions:**
    - **XAUUSD (Gold):** **Restricted to AFTER 12:00 UTC** to avoid conflict with the *London Sweep* strategy.
- **Filters:**
    - **Volatility:** **ADX (14)** must be **>= 20** to avoid chop.
- **Execution Rules:**
    - **Buy:** AI Sentiment is **BULLISH** AND Asset is in an **Uptrend** (Price > 200 EMA).
    - **Sell:** AI Sentiment is **BEARISH** AND Asset is in a **Downtrend** (Price < 200 EMA).
- **Confidence Thresholds:**
    - **XAUUSD:** Requires **>65%** confidence.

---

## 3. Technical Indicators Used

- **EMA (Exponential Moving Average):**
    - **20 EMA:** Short-term trend/pullback level.
    - **200 EMA:** Long-term trend bias filter.
- **Bollinger Bands:** Standard (20 SMA, 2 Std Dev). Used for volatility measuring in NY ORB.
- **RSI (Relative Strength Index):** 14-period. Used by AI for momentum context.
- **Slope:** Calculated over the last 10 closed M5 candles to determine immediate direction.
- **ADX (Average Directional Index):** 14-period. Used to filter out low-volatility/choppy markets.
