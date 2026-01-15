import * as admin from 'firebase-admin';

export type RideEventType =
  | 'ride_created'
  | 'matching_started'
  | 'offer_created'
  | 'offer_expired'
  | 'offer_declined'
  | 'offer_accepted'
  | 'ride_accepted'
  | 'ride_started'
  | 'ride_in_progress'
  | 'ride_completed'
  | 'ride_cancelled'
  | 'search_timeout'
  | 'driver_online_triggered_match'
  | 'ride_scheduled'
  | 'scheduled_ride_activated'
  | 'payment_intent_created'
  | 'payment_authorized'
  | 'payment_captured'
  | 'payment_cancelled';

export interface RideEvent {
  type: RideEventType;
  atMs: number;
  meta?: Record<string, any>;
}

/**
 * Log an event to the ride's event subcollection
 * This creates an audit trail for debugging and observability
 */
export async function logRideEvent(
  rideId: string,
  type: RideEventType,
  meta?: Record<string, any>,
  firestoreDb: FirebaseFirestore.Firestore = admin.firestore()
): Promise<void> {
  const eventRef = firestoreDb
    .collection('rides')
    .doc(rideId)
    .collection('events')
    .doc();

  await eventRef.set({
    type,
    atMs: Date.now(),
    meta: meta || {},
  });

  console.log(`[Event] ${rideId} - ${type}`, meta || {});
}

/**
 * Get all events for a ride, sorted by time
 */
export async function getRideEvents(
  rideId: string,
  firestoreDb: FirebaseFirestore.Firestore = admin.firestore()
): Promise<RideEvent[]> {
  const eventsSnap = await firestoreDb
    .collection('rides')
    .doc(rideId)
    .collection('events')
    .orderBy('atMs', 'asc')
    .get();

  return eventsSnap.docs.map(doc => doc.data() as RideEvent);
}
