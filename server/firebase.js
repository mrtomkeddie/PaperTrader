import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

let db = null;
const COLLECTION = 'pt2';
const DOC_ID = 'state';

export function initFirebase() {
    try {
        const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
        if (!serviceAccountRaw) {
            console.warn('[FIREBASE] Missing FIREBASE_SERVICE_ACCOUNT_JSON in .env');
            return false;
        }

        let serviceAccount;
        try {
            serviceAccount = JSON.parse(serviceAccountRaw);
            // Fix private key formatting if it contains literal \n characters
            if (serviceAccount.private_key && typeof serviceAccount.private_key === 'string') {
                serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
            }
        } catch (e) {
            console.error('[FIREBASE] Failed to parse service account JSON:', e.message);
            return false;
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
        }
    } catch (e) {
        console.error('[FIREBASE] Load error:', e.message);
    }
    return null;
}

export async function saveStateToCloud(state) {
    if (!db) return;
    try {
        // Ensure we don't save circular structures or excessive data
        const payload = {
            account: state.account,
            trades: state.trades,
            pushSubscriptions: state.pushSubscriptions,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        
        await db.collection(COLLECTION).doc(DOC_ID).set(payload, { merge: true });
        // console.log('[FIREBASE] State saved'); // Commented out to reduce noise
    } catch (e) {
        console.error('[FIREBASE] Save error:', e.message);
    }
}
