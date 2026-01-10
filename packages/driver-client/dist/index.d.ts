import { FirebaseApp, FirebaseOptions } from 'firebase/app';
import { Functions } from 'firebase/functions';
import { Firestore, Unsubscribe } from 'firebase/firestore';
import { DriverProfile, RideOffer, TripCancelPayload, TripRequestData, TripRequestResult, TripUpdateStatus, UserProfile, CreateTestRideData } from './types';
export interface DriverClientConfig {
    firebaseConfig: FirebaseOptions;
    emulator?: {
        firestoreHost: string;
        firestorePort: number;
        functionsHost: string;
        functionsPort: number;
    };
}
export interface InitializedDriverClient {
    app: FirebaseApp;
    functions: Functions;
    firestore: Firestore;
}
export declare function initDriverClient(config: DriverClientConfig): InitializedDriverClient;
export declare function driverSetOnline(online: boolean): Promise<{
    ok: true;
}>;
export declare function driverHeartbeat(location?: {
    lat: number;
    lng: number;
}): Promise<{
    ok: true;
}>;
export declare function tripAccept(rideId: string): Promise<{
    ok: true;
}>;
export declare function tripDecline(rideId: string): Promise<{
    ok: true;
}>;
export declare function tripRequest(payload: TripRequestData): Promise<TripRequestResult>;
export declare function tripCancel(payload: TripCancelPayload): Promise<{
    ok: true;
}>;
export declare function tripUpdateStatus(rideId: string, status: TripUpdateStatus): Promise<{
    ok: true;
}>;
export declare function createTestRide(data: CreateTestRideData): Promise<{
    ok: true;
}>;
export type DocumentObserver<T> = (data: T | null) => void;
export type DriverOfferObserver = (offers: Array<{
    rideId: string;
    offer: RideOffer | null;
}>) => void;
export declare function watchDriverProfile(driverId: string, onChange: DocumentObserver<DriverProfile>, onError?: (error: Error) => void): Unsubscribe;
export declare function watchUserProfile(userId: string, onChange: DocumentObserver<UserProfile>, onError?: (error: Error) => void): Unsubscribe;
export declare function watchRideOffer(rideId: string, driverId: string, onChange: DocumentObserver<RideOffer>, onError?: (error: Error) => void): Unsubscribe;
export declare function watchRide(rideId: string, onChange: (ride: any | null) => void, onError?: (error: Error) => void): Unsubscribe;
export declare function watchDriverOffers(driverId: string, onOffers: DriverOfferObserver, onError?: (error: Error) => void): Unsubscribe;
export declare function getInitializedClient(): InitializedDriverClient;
export declare const DEFAULT_EMULATOR_CONFIG: {
    firestoreHost: string;
    firestorePort: number;
    functionsHost: string;
    functionsPort: number;
};
export type { CreateTestRideData, DriverProfile, Ride, RideOffer, TripCancelPayload, TripRequestData, TripRequestResult, TripUpdateStatus, UserProfile, } from './types';
//# sourceMappingURL=index.d.ts.map