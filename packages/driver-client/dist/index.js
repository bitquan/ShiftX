import { initializeApp } from 'firebase/app';
import { connectFunctionsEmulator, getFunctions, httpsCallable, } from 'firebase/functions';
import { connectFirestoreEmulator, collectionGroup, doc, getFirestore, onSnapshot, query, where, } from 'firebase/firestore';
const DRIVER_CLIENT_APP_NAME = 'shiftx-driver-client';
let driverApp = null;
let driverFunctions = null;
let driverFirestore = null;
function ensureClients() {
    if (!driverFunctions || !driverFirestore) {
        throw new Error('Driver client is not initialized. Call initDriverClient first.');
    }
    return { functions: driverFunctions, firestore: driverFirestore };
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
    return {
        app: driverApp,
        functions: driverFunctions,
        firestore: driverFirestore,
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
    return callFunction('driverHeartbeat', { location });
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
    const offersQuery = query(collectionGroup(firestore, 'offers'), where('driverId', '==', driverId));
    return onSnapshot(offersQuery, (snapshot) => {
        const entries = snapshot.docs.map((offerDoc) => ({
            rideId: offerDoc.ref.parent?.parent?.id ?? '',
            offer: { ...offerDoc.data(), rideId: offerDoc.ref.parent?.parent?.id ?? '' },
        }));
        onOffers(entries);
    }, onError);
}
export function getInitializedClient() {
    if (!driverApp || !driverFunctions || !driverFirestore) {
        throw new Error('Driver client not initialized');
    }
    return {
        app: driverApp,
        functions: driverFunctions,
        firestore: driverFirestore,
    };
}
export const DEFAULT_EMULATOR_CONFIG = {
    firestoreHost: 'localhost',
    firestorePort: 8081,
    functionsHost: 'localhost',
    functionsPort: 5002,
};
