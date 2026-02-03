import { initFirebase, saveStateToCloud, loadStateFromCloud } from './firebase.js';

async function testConnection() {
    console.log('--- Testing Firebase Connection ---');

    // 1. Init
    const success = initFirebase();
    if (!success) {
        console.error('FAILED: Could not initialize Firebase.');
        process.exit(1);
    }
    console.log('SUCCESS: Firebase Initialized.');

    // 2. Test Write
    const testState = {
        account: { balance: 999 },
        trades: [],
        timestamp: Date.now()
    };

    console.log('Attempting write to [pt2/state]...');
    try {
        await saveStateToCloud(testState);
        console.log('SUCCESS: Write operation completed without error.');
    } catch (e) {
        console.error('FAILED: Write operation failed.', e);
    }

    // 3. Test Read
    console.log('Attempting read from [pt2/state]...');
    try {
        const data = await loadStateFromCloud();
        if (data && data.account && data.account.balance === 999) {
            console.log('SUCCESS: Read verification passed. (Balance matched 999)');
        } else {
            console.warn('WARNING: Read completed but data did not match expected value.', data);
        }
    } catch (e) {
        console.error('FAILED: Read operation failed.', e);
    }
}

testConnection();
