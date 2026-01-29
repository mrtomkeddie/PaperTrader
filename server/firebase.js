import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

let db = null;
const COLLECTION = 'pt2';
const DOC_ID = 'state';

export function initFirebase() {
    try {
        let serviceAccount;

        // Option 1: Full JSON in one variable
        if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
            try {
                serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
            } catch (e) {
                console.error('[FIREBASE] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', e.message);
            }
        }

        // Option 2: Individual variables (Fallback)
        if (!serviceAccount && process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
            serviceAccount = {
                project_id: process.env.FIREBASE_PROJECT_ID,
                client_email: process.env.FIREBASE_CLIENT_EMAIL,
                private_key: process.env.FIREBASE_PRIVATE_KEY
            };
        }

        if (!serviceAccount) {
            console.warn('[FIREBASE] Missing Firebase credentials. Set FIREBASE_SERVICE_ACCOUNT_JSON or (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)');
            return false;
        }

        // Fix private key formatting if it contains literal \n characters
        if (serviceAccount.private_key && typeof serviceAccount.private_key === 'string') {
            serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
        }

        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
        }

        db = admin.firestore();
        console.log('[FIREBASE] Firestore initialized successfully');
        return true;
    } catch (e) {
        console.error('[FIREBASE] Initialization error:', e.message);
        return false;
    }
}

export async function loadStateFromCloud() {
    if (!db) return null;
    try {
        const doc = await db.collection(COLLECTION).doc(DOC_ID).get();
        if (doc.exists) {
            console.log('[FIREBASE] Cloud state loaded');
            return doc.data();
        } else {
            console.warn('[FIREBASE] Cloud document missing: pt2/state');
        }
    } catch (e) {
        console.error('[FIREBASE] Load error:', e.message);
    }
    return null;
}

export async function saveStateToCloud(state) {
    if (!db) return;
    try {
        const ref = db.collection(COLLECTION).doc(DOC_ID);
        const snap = await ref.get();
        const existing = snap.exists ? snap.data() : {};
        const prevTrades = Array.isArray(existing?.trades) ? existing.trades : [];
        const newTrades = Array.isArray(state?.trades) ? state.trades : [];

        const keyForTrade = (t) => {
            if (!t) return '';
            if (t.id) return t.id;
            const parts = [t.symbol, t.entryPrice, t.openTime || t.open_time || t.openTimestamp, t.initialSize];
            return parts.filter(Boolean).join('|');
        };

        const mergedByKey = new Map();
        for (const t of prevTrades) mergedByKey.set(keyForTrade(t), t);
        for (const t of newTrades) {
            const k = keyForTrade(t);
            if (!k) continue;
            const existingT = mergedByKey.get(k);
            if (!existingT) mergedByKey.set(k, t);
            else {
                const preferNew = (existingT.status !== 'CLOSED' && t.status === 'CLOSED') ||
                    (typeof t.closeTime === 'number' && typeof existingT.closeTime === 'number' && t.closeTime > existingT.closeTime);
                if (preferNew) mergedByKey.set(k, t);
            }
        }

        const prevSubs = Array.isArray(existing?.pushSubscriptions) ? existing.pushSubscriptions : [];
        const newSubs = Array.isArray(state?.pushSubscriptions) ? state.pushSubscriptions : [];
        const subsByEndpoint = new Map();
        for (const s of prevSubs) if (s && s.endpoint) subsByEndpoint.set(s.endpoint, s);
        for (const s of newSubs) if (s && s.endpoint) subsByEndpoint.set(s.endpoint, s);

        const payload = {
            account: state.account, // Legacy/Global support
            accounts: state.accounts, // New Multi-Agent support
            trades: Array.from(mergedByKey.values()),
            pushSubscriptions: Array.from(subsByEndpoint.values()),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        await ref.set(payload, { merge: true });
    } catch (e) {
        console.error('[FIREBASE] Save error:', e.message);
    }
}

export async function clearCloudState(account) {
    if (!db) return false;
    try {
        const ref = db.collection(COLLECTION).doc(DOC_ID);
        const base = account && typeof account.balance === 'number' ? account : { balance: 500, equity: 500, dayPnL: 0, totalPnL: 0 };
        await ref.set({ account: base, trades: [], pushSubscriptions: [], updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: false });
        return true;
    } catch (e) {
        console.error('[FIREBASE] Clear error:', e.message);
        return false;
    }
}
