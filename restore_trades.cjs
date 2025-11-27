const fs = require('fs');
const path = require('path');

const STATE_PATH = path.join(__dirname, 'data', 'state.json');
const TMP_STATE_PATH = path.join(__dirname, '.trae_tmp_state.json');
const CSV_PATH = path.join(__dirname, 'public', 'trades (3).csv');
const TEST_CSV_PATH = path.join(__dirname, 'test_trades.csv');

function readJson(p) {
    try {
        if (fs.existsSync(p)) {
            return JSON.parse(fs.readFileSync(p, 'utf8'));
        }
    } catch (e) {
        console.error(`Error reading ${p}:`, e.message);
    }
    return null;
}

function readCsv(p) {
    try {
        if (fs.existsSync(p)) {
            const content = fs.readFileSync(p, 'utf8');
            const lines = content.split('\n').filter(l => l.trim());
            if (lines.length < 2) return [];
            
            const headers = lines[0].split(',').map(h => h.trim());
            const trades = [];
            
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',').map(v => v.trim());
                if (values.length !== headers.length) continue;
                
                const trade = {};
                headers.forEach((h, idx) => {
                    let val = values[idx];
                    if (['entryPrice', 'initialSize', 'currentSize', 'stopLoss', 'pnl', 'floatingPnl', 'closePrice'].includes(h)) {
                        val = parseFloat(val);
                    }
                    if (['openTime', 'closeTime'].includes(h)) {
                        val = parseInt(val);
                    }
                    trade[h] = val;
                });
                trades.push(trade);
            }
            return trades;
        }
    } catch (e) {
        console.error(`Error reading ${p}:`, e.message);
    }
    return [];
}

const state = readJson(STATE_PATH);
const tmpState = readJson(TMP_STATE_PATH);
const csvTrades = readCsv(CSV_PATH);
const testCsvTrades = readCsv(TEST_CSV_PATH);

console.log('--- Analysis ---');
console.log(`state.json: ${state ? state.trades.length : 0} trades`);
console.log(`tmp_state.json: ${tmpState ? tmpState.trades.length : 0} trades`);
console.log(`public/trades (3).csv: ${csvTrades.length} trades`);
console.log(`test_trades.csv: ${testCsvTrades.length} trades`);

const allTrades = new Map();

function addTrades(sourceName, trades) {
    if (!trades) return;
    let newCount = 0;
    trades.forEach(t => {
        if (!allTrades.has(t.id)) {
            allTrades.set(t.id, t);
            newCount++;
        } else {
            // Merge logic if needed, e.g. prefer CLOSED over OPEN
            const existing = allTrades.get(t.id);
            if (existing.status !== 'CLOSED' && t.status === 'CLOSED') {
                 allTrades.set(t.id, t);
            }
        }
    });
    console.log(`Added ${newCount} new unique trades from ${sourceName}`);
}

addTrades('state.json', state ? state.trades : []);
addTrades('tmp_state.json', tmpState ? tmpState.trades : []);
addTrades('public/trades (3).csv', csvTrades);
addTrades('test_trades.csv', testCsvTrades);

console.log(`Total unique trades found: ${allTrades.size}`);

const sortedTrades = Array.from(allTrades.values()).sort((a, b) => b.openTime - a.openTime);

if (state && allTrades.size > state.trades.length) {
    console.log('Found missing trades! Merging...');
    // Uncomment to save
    // state.trades = sortedTrades;
    // fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
    // console.log('Saved merged state to state.json');
} else {
    console.log('No extra trades found in backups.');
}
