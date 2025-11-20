# Paper Trader 2.0 - 24/7 Bot Setup

This project consists of two parts:
1. **The Scheduler (Server):** Runs 24/7 on your computer, connects to market data, and executes trades.
2. **The App (Client):** A dashboard to view your equity and history.

## How to Run

### 1. Install Dependencies
Open a terminal in this folder and run:
```bash
npm install
```

### 2. Start the Trading Bot (The Brain)
This must run in the background for trades to happen.
```bash
npm run scheduler
```
*You will see a message: "Scheduler running on http://localhost:3001"*

### 3. Start the App (The UI)
Open a **new** terminal window (keep the first one running) and run:
```bash
npm run dev
```
*This opens the local web dashboard.*

## Strategy Configuration
The bot is currently configured for:
- **Gold (XAU/USD):** London Liquidity Sweep Strategy
- **Nasdaq (NAS100):** NY Opening Range Breakout
- **Trend Follow:** EMA Pullback Logic
