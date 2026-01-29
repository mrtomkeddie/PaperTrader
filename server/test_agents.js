import { Manager } from './Manager.js';

async function test() {
    console.log('--- TEST: Manager & Agents ---');
    const manager = new Manager();
    console.log('Manager initialized.');

    // Mock Data
    const mockData = {
        currentPrice: 2000,
        rsi: 30, // Oversold
        trend: 'UP',
        ema: 1990,
        history: Array(50).fill({ close: 2000 }),
        bollinger: { upper: 2010, lower: 1990 }, // Near lower band
        macd: { macdLine: 1, signalLine: 0, histogram: 1 }
    };

    console.log('Ticking Manager...');
    // We need to set environment variables for agents to not warn about missing keys?
    // Agents have fallback mock mode if keys missing.

    manager.onTick('XAUUSD', mockData);

    const state = manager.getState();
    console.log('State after tick:', JSON.stringify(state.accounts, null, 2));

    // Check if any agent is "thinking" (async)
    // Since agents are async in real life (API calls), Manager.onTick calls agent.onTick.
    // However, in current Agent.js, onTick is sync but triggers async `think`.
    // So usually isThinking becomes true immediately if they decide to trade/think.

    const trades = manager.consumeNewTrades();
    console.log('New Trades (Immediate):', trades.length);

    // Simulate async thought completion if necessary?
    // In the current implementation, 'executeTrade' happens inside 'processDecision' or synchronously if logic is simple.
    // QuantAgent logic is largely sync technicals in the provided snippet?
    // Let's check QuantAgent.js content if I viewed it...
    // It creates a trade if RSI < 35 (oversold) and Trend UP.
    // My mock RSI is 30. So Quant should Buy.
}

test();
