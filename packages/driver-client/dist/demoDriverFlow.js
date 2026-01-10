import { connectAuthEmulator, getAuth, signInWithCustomToken } from 'firebase/auth';
import { initializeApp as initAdminApp, getApps as getAdminApps } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { DEFAULT_EMULATOR_CONFIG, driverHeartbeat, driverSetOnline, initDriverClient, tripAccept, tripRequest, tripUpdateStatus, watchDriverOffers, watchDriverProfile, watchRideOffer, } from './index';
const DRIVER_ID = process.env.DEMO_DRIVER_ID || 'demo-driver';
const PROJECT_ID = process.env.GCLOUD_PROJECT || 'demo-no-project';
const AUTH_EMULATOR_PORT = process.env.FIREBASE_AUTH_EMULATOR_PORT || '9099';
function initAdminAppOnce(projectId) {
    if (getAdminApps().length) {
        return getAdminApps()[0];
    }
    return initAdminApp({ projectId });
}
async function createDriverSeed(adminFirestore, driverId) {
    await adminFirestore
        .collection('drivers')
        .doc(driverId)
        .set({
        isOnline: false,
        isBusy: false,
        currentRideId: null,
        onboardingStatus: 'active',
        updatedAtMs: Date.now(),
        lastSeenAtMs: Date.now(),
    }, { merge: true });
    await adminFirestore.collection('users').doc(driverId).set({
        role: 'driver',
        displayName: 'Demo Driver',
        createdAtMs: Date.now(),
    }, { merge: true });
}
async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function runDemo() {
    console.log('Initializing driver client against emulator...');
    process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || `${DEFAULT_EMULATOR_CONFIG.firestoreHost}:${DEFAULT_EMULATOR_CONFIG.firestorePort}`;
    process.env.FUNCTIONS_EMULATOR_HOST = process.env.FUNCTIONS_EMULATOR_HOST || `${DEFAULT_EMULATOR_CONFIG.functionsHost}:${DEFAULT_EMULATOR_CONFIG.functionsPort}`;
    process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || `${DEFAULT_EMULATOR_CONFIG.functionsHost}:${AUTH_EMULATOR_PORT}`;
    const { app } = initDriverClient({
        firebaseConfig: {
            projectId: PROJECT_ID,
            apiKey: 'demo',
            authDomain: `${PROJECT_ID}.firebaseapp.com`,
        },
        emulator: DEFAULT_EMULATOR_CONFIG,
    });
    const auth = getAuth(app);
    connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`);
    const adminApp = initAdminAppOnce(PROJECT_ID);
    const adminFirestore = getAdminFirestore(adminApp);
    const adminAuth = getAdminAuth(adminApp);
    await createDriverSeed(adminFirestore, DRIVER_ID);
    const customToken = await adminAuth.createCustomToken(DRIVER_ID);
    await signInWithCustomToken(auth, customToken);
    const driverProfileUnsubscribe = watchDriverProfile(DRIVER_ID, (doc) => {
        console.log('Driver profile update', doc);
    });
    const driverOffersUnsubscribe = watchDriverOffers(DRIVER_ID, (offers) => {
        console.log('Driver offers summary', offers);
    });
    try {
        await driverSetOnline(true);
        await driverHeartbeat();
        const { rideId } = await tripRequest({
            pickup: { lat: 37.78, lng: -122.41 },
            dropoff: { lat: 37.79, lng: -122.43 },
            priceCents: 950,
        });
        console.log('Driver test ride created', rideId);
        const rideOfferUnsubscribe = watchRideOffer(rideId, DRIVER_ID, (offer) => {
            console.log(`Offer snapshot for ${rideId}`, offer);
        });
        await sleep(500);
        await tripAccept(rideId);
        await tripUpdateStatus(rideId, 'started');
        await sleep(200);
        await tripUpdateStatus(rideId, 'in_progress');
        await sleep(200);
        await tripUpdateStatus(rideId, 'completed');
        rideOfferUnsubscribe();
        await driverSetOnline(false);
        console.log('Driver demo flow complete');
    }
    finally {
        driverProfileUnsubscribe();
        driverOffersUnsubscribe();
    }
}
runDemo().catch((error) => {
    console.error('Demo driver flow failed', error);
    process.exitCode = 1;
});
