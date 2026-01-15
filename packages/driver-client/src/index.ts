import { FirebaseApp, FirebaseOptions, initializeApp } from 'firebase/app';
import {
  Functions,
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
} from 'firebase/functions';
import {
  Firestore,
  connectFirestoreEmulator,
  collectionGroup,
  doc,
  getFirestore,
  onSnapshot,
  query,
  Unsubscribe,
  where,
  limit,
  orderBy,
} from 'firebase/firestore';
import {
  FirebaseStorage,
  connectStorageEmulator,
  getStorage,
} from 'firebase/storage';

import {
  DriverProfile,
  RideOffer,
  TripCancelPayload,
  TripRequestData,
  TripRequestResult,
  TripUpdateStatus,
  UserProfile,
  CreateTestRideData,
} from './types';

const DRIVER_CLIENT_APP_NAME = 'shiftx-driver-client';

let driverApp: FirebaseApp | null = null;
let driverFunctions: Functions | null = null;
let driverFirestore: Firestore | null = null;
let driverStorage: FirebaseStorage | null = null;

export interface DriverClientConfig {
  firebaseConfig: FirebaseOptions;
  emulator?: {
    firestoreHost: string;
    firestorePort: number;
    functionsHost: string;
    functionsPort: number;
    storageHost?: string;
    storagePort?: number;
  };
}

export interface InitializedDriverClient {
  app: FirebaseApp;
  functions: Functions;
  firestore: Firestore;
  storage: FirebaseStorage;
}

function ensureClients(): { functions: Functions; firestore: Firestore; storage: FirebaseStorage } {
  if (!driverFunctions || !driverFirestore || !driverStorage) {
    throw new Error('Driver client is not initialized. Call initDriverClient first.');
  }
  return { functions: driverFunctions, firestore: driverFirestore, storage: driverStorage };
}

export function initDriverClient(config: DriverClientConfig): InitializedDriverClient {
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

async function callFunction<TResult, TData = undefined>(
  name: string,
  data?: TData
): Promise<TResult> {
  const { functions } = ensureClients();
  const callable = httpsCallable<TData, TResult>(functions, name);
  const response = await callable(data as TData);
  return response.data;
}

export async function driverSetOnline(online: boolean): Promise<{ ok: true }> {
  return callFunction('driverSetOnline', { online });
}

export async function driverHeartbeat(location?: { lat: number; lng: number }): Promise<{ ok: true }> {
  return callFunction('driverHeartbeat', location);
}

export async function tripAccept(rideId: string): Promise<{ ok: true }> {
  return callFunction('acceptRide', { rideId });
}

export async function tripDecline(rideId: string): Promise<{ ok: true }> {
  return callFunction('declineOffer', { rideId });
}

export async function tripRequest(payload: TripRequestData): Promise<TripRequestResult> {
  return callFunction('tripRequest', payload);
}

export async function tripCancel(payload: TripCancelPayload): Promise<{ ok: true }> {
  return callFunction('cancelRide', payload);
}

export async function tripUpdateStatus(
  rideId: string,
  status: TripUpdateStatus
): Promise<{ ok: true }> {
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

export async function createTestRide(data: CreateTestRideData): Promise<{ ok: true }> {
  return callFunction('createTestRide', data);
}

export type DocumentObserver<T> = (data: T | null) => void;
export type DriverOfferObserver = (
  offers: Array<{ rideId: string; offer: RideOffer | null }>
) => void;

export function watchDriverProfile(
  driverId: string,
  onChange: DocumentObserver<DriverProfile>,
  onError?: (error: Error) => void
): Unsubscribe {
  const { firestore } = ensureClients();
  return onSnapshot(
    doc(firestore, 'drivers', driverId),
    (snapshot) => {
      onChange(snapshot.exists() ? (snapshot.data() as DriverProfile) : null);
    },
    onError
  );
}

export function watchUserProfile(
  userId: string,
  onChange: DocumentObserver<UserProfile>,
  onError?: (error: Error) => void
): Unsubscribe {
  const { firestore } = ensureClients();
  return onSnapshot(
    doc(firestore, 'users', userId),
    (snapshot) => {
      onChange(snapshot.exists() ? (snapshot.data() as UserProfile) : null);
    },
    onError
  );
}

export function watchRideOffer(
  rideId: string,
  driverId: string,
  onChange: DocumentObserver<RideOffer>,
  onError?: (error: Error) => void
): Unsubscribe {
  const { firestore } = ensureClients();
  return onSnapshot(
    doc(firestore, 'rides', rideId, 'offers', driverId),
    (snapshot) => {
      onChange(snapshot.exists() ? ({ ...(snapshot.data() as RideOffer), rideId }) : null);
    },
    onError
  );
}

export function watchRide(
  rideId: string,
  onChange: (ride: any | null) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const { firestore } = ensureClients();
  return onSnapshot(
    doc(firestore, 'rides', rideId),
    (snapshot) => {
      onChange(snapshot.exists() ? snapshot.data() : null);
    },
    onError
  );
}

export function watchDriverOffers(
  driverId: string,
  onOffers: DriverOfferObserver,
  onError?: (error: Error) => void
): Unsubscribe {
  const { firestore } = ensureClients();
  // Only watch pending offers (status == 'pending') and limit to 20 most recent
  const offersQuery = query(
    collectionGroup(firestore, 'offers'), 
    where('driverId', '==', driverId),
    where('status', '==', 'pending'),
    orderBy('createdAtMs', 'desc'),
    limit(20)
  );
  return onSnapshot(offersQuery, (snapshot) => {
    const now = Date.now();
    // Client-side filter: only include non-expired offers
    const entries = snapshot.docs
      .map((offerDoc) => ({
        rideId: offerDoc.ref.parent?.parent?.id ?? '',
        offer: { ...(offerDoc.data() as RideOffer), rideId: offerDoc.ref.parent?.parent?.id ?? '' },
      }))
      .filter((entry) => {
        const expiresAtMs = entry.offer.expiresAtMs || 0;
        return expiresAtMs > now;
      });
    onOffers(entries);
  }, onError);
}

export function getInitializedClient(): InitializedDriverClient {
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

export type {
  CreateTestRideData,
  DriverProfile,
  Ride,
  RideOffer,
  TripCancelPayload,
  TripRequestData,
  TripRequestResult,
  TripUpdateStatus,
  UserProfile,
} from './types';

