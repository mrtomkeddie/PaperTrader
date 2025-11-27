import fs from 'fs';
import path from 'path';
import { initFirebase, loadStateFromCloud, saveStateToCloud } from './server/firebase.js';

const STATE_PATH = path.join(process.cwd(), 'data', 'state.json');

function readJson(p) {
  try {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {}
  return null;
}

function keyForTrade(t) {
  if (!t) return '';
  if (t.id) return t.id;
  const parts = [t.symbol, t.entryPrice, t.openTime || t.open_time || t.openTimestamp, t.initialSize];
  return parts.filter(Boolean).join('|');
}

async function run() {
  const inited = initFirebase();
  if (!inited) {
    console.log('Firebase not initialized');
    return;
  }
  const local = readJson(STATE_PATH) || { account: { balance: 0, equity: 0, dayPnL: 0, totalPnL: 0 }, trades: [], pushSubscriptions: [] };
  const cloud = await loadStateFromCloud();
  const cloudTrades = Array.isArray(cloud?.trades) ? cloud.trades : [];
  const merged = new Map();
  for (const t of Array.isArray(local?.trades) ? local.trades : []) merged.set(keyForTrade(t), t);
  for (const t of cloudTrades) {
    const k = keyForTrade(t);
    if (!k) continue;
    const existing = merged.get(k);
    if (!existing) merged.set(k, t);
    else {
      const preferCloud = (existing.status !== 'CLOSED' && t.status === 'CLOSED') ||
        (typeof t.closeTime === 'number' && typeof existing.closeTime === 'number' && t.closeTime > existing.closeTime);
      if (preferCloud) merged.set(k, t);
    }
  }
  const mergedList = Array.from(merged.values());
  const updated = { account: cloud?.account || local.account, trades: mergedList, pushSubscriptions: local.pushSubscriptions };
  if ((local?.trades?.length || 0) !== mergedList.length) {
    fs.writeFileSync(STATE_PATH, JSON.stringify(updated, null, 2));
    await saveStateToCloud(updated);
  }
  console.log(`Local trades: ${local?.trades?.length || 0}`);
  console.log(`Cloud trades: ${cloudTrades.length}`);
  console.log(`Merged trades: ${mergedList.length}`);
}

run().catch(() => {});

