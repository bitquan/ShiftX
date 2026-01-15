import { initializeApp } from 'firebase/app';
import { connectFunctionsEmulator, getFunctions, httpsCallable, } from 'firebase/functions';
import { connectFirestoreEmulator, collectionGroup, doc, getFirestore, onSnapshot, query, where, limit, orderBy, } from 'firebase/firestore';
import { connectStorageEmulator, getStorage, } from 'firebase/storage';
const DRIVER_CLIENT_APP_NAME = 'shiftx-driver-client';
let driverApp = null;
let driverFunctions = null;
let driverFirestore = null;
let driverStorage = null;
function ensureClients() {
    if (!driverFunctions || !driverFirestore || !driverStorage) {
        throw new Error('Driver client is not initialized. Call initDriverClient first.');
    }
    return { functions: driverFunctions, firestore: driverFirestore, storage: driverStorage };
}
export function initDriverClient(config) {
    if (!driverApp) {
        driverApp = initializeApp(config.firebaseConfig, DRIVER_CLIENT_APP_NAME);
    }
    // Get Firestore and connect to emulator immediately
    if (!driverFirestore) {
        driverFirestore = getFirestore(driverApp);
        if (config.emulator) {
            connectFirestoreEmulator(driverFirestore, config.emulator.firestoreHost, config.emulator.firestorePort);
        }
    }
    // Get Functions and connect to emulator immediately
    if (!driverFunctions) {
        driverFunctions = getFunctions(driverApp);
        if (config.emulator) {
            connectFunctionsEmulator(driverFunctions, config.emulator.functionsHost, config.emulator.functionsPort);
        }
    }
    // Get Storage and connect to emulator immediately
    if (!driverStorage) {
        driverStorage = getStorage(driverApp);
        if (config.emulator?.storageHost && config.emulator?.storagePort) {
            connectStorageEmulator(driverStorage, config.emulator.storageHost, config.emulator.storagePort);
        }
    }
    return {
        app: driverApp,
        functions: driverFunctions,
        firestore: driverFirestore,
        storage: driverStorage,
    };
}
async function callFunction(name, data) {
    const { functions } = ensureClients();
    const callable = httpsCallable(functions, name);
    const response = await callable(data);
    return response.data;
}
export async function driverSetOnline(online) {
    return callFunction('driverSetOnline', { online });
}
export async function driverHeartbeat(location) {
    return callFunction('driverHeartbeat', location);
}
export async function tripAccept(rideId) {
    return callFunction('acceptRide', { rideId });
}
export async function tripDecline(rideId) {
    return callFunction('declineOffer', { rideId });
}
export async function tripRequest(payload) {
    return callFunction('tripRequest', payload);
}
export async function tripCancel(payload) {
    return callFunction('cancelRide', payload);
}
export async function tripUpdateStatus(rideId, status) {
    switch (status) {
        case 'started':
            return callFunction('startRide', { rideId });
        case 'in_progress':
            return callFunction('progressRide', { rideId });
        case 'completed':
            return callFunction('completeRide', { rideId });
        default:
            throw new Error(`Unsupported status: ${status}`);
    }
}
export async function createTestRide(data) {
    return callFunction('createTestRide', data);
}
export function watchDriverProfile(driverId, onChange, onError) {
    const { firestore } = ensureClients();
    return onSnapshot(doc(firestore, 'drivers', driverId), (snapshot) => {
        onChange(snapshot.exists() ? snapshot.data() : null);
    }, onError);
}
export function watchUserProfile(userId, onChange, onError) {
    const { firestore } = ensureClients();
    return onSnapshot(doc(firestore, 'users', userId), (snapshot) => {
        onChange(snapshot.exists() ? snapshot.data() : null);
    }, onError);
}
export function watchRideOffer(rideId, driverId, onChange, onError) {
    const { firestore } = ensureClients();
    return onSnapshot(doc(firestore, 'rides', rideId, 'offers', driverId), (snapshot) => {
        onChange(snapshot.exists() ? ({ ...snapshot.data(), rideId }) : null);
    }, onError);
}
export function watchRide(rideId, onChange, onError) {
    const { firestore } = ensureClients();
    return onSnapshot(doc(firestore, 'rides', rideId), (snapshot) => {
        onChange(snapshot.exists() ? snapshot.data() : null);
    }, onError);
}
export function watchDriverOffers(driverId, onOffers, onError) {
    const { firestore } = ensureClients();
    // Only watch pending offers (status == 'pending') and limit to 20 most recent
    const offersQuery = query(collectionGroup(firestore, 'offers'), where('driverId', '==', driverId), where('status', '==', 'pending'), orderBy('createdAtMs', 'desc'), limit(20));
    return onSnapshot(offersQuery, (snapshot) => {
        const now = Date.now();
        // Client-side filter: only include non-expired offers
        const entries = snapshot.docs
            .map((offerDoc) => ({
            rideId: offerDoc.ref.parent?.parent?.id ?? '',
            offer: { ...offerDoc.data(), rideId: offerDoc.ref.parent?.parent?.id ?? '' },
        }))
            .filter((entry) => {
            const expiresAtMs = entry.offer.expiresAtMs || 0;
            return expiresAtMs > now;
        });
        onOffers(entries);
    }, onError);
}
export function getInitializedClient() {
    if (!driverApp || !driverFunctions || !driverFirestore || !driverStorage) {
        throw new Error('Driver client not initialized');
    }
    return {
        app: driverApp,
        functions: driverFunctions,
        firestore: driverFirestore,
        storage: driverStorage,
    };
}
export const DEFAULT_EMULATOR_CONFIG = {
    firestoreHost: 'localhost',
    firestorePort: 8081,
    functionsHost: 'localhost',
    functionsPort: 5002,
    storageHost: 'localhost',
    storagePort: 9199,
};
