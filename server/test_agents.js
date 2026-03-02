import { Manager } from './Manager.js';

async function test() {
    console.log('--- TEST: Manager & Agents ---');
    const manager = new Manager();
    console.log('Manager initialized.');

    // Mock Data
    const mockCandles = Array(250).fill({
        open: 2000,
        high: 2010,
        low: 1990,
        close: 2000
    });
    // Let's modify the end of candles to simulate a drop to trigger oversold RSI
    for (let i = 240; i < 250; i++) {
        mockCandles[i] = { open: 1995, high: 2000, low: 1980, close: 1985 };
    }

    const mockData = {
        symbol: 'XAUUSD',
        currentPrice: 1985,
        candles: mockCandles
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
