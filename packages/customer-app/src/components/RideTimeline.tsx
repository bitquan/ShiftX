import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import './RideTimeline.css';

interface RideEvent {
  id: string;
  type: string;
  atMs: number;
  createdAtMs?: number;
  meta?: Record<string, any>;
}

interface RideTimelineProps {
  rideId: string;
}

const eventTypeLabels: Record<string, string> = {
  'ride_created': '🎯 Ride Created',
  'matching_started': '🔍 Searching for Driver',
  'offer_created': '📤 Offer Sent to Driver',
  'offer_declined': '❌ Driver Declined',
  'offer_expired': '⏱️ Offer Expired',
  'offer_accepted': '✅ Offer Accepted',
  'ride_accepted': '🤝 Driver Accepted',
  'ride_started': '🚗 Ride Started',
  'ride_in_progress': '🛣️ In Progress',
  'ride_completed': '🏁 Ride Completed',
  'ride_cancelled': '🚫 Ride Cancelled',
  'search_timeout': '⏰ Search Timed Out',
  'driver_online_triggered_match': '🔔 Driver Came Online',
  'payment_authorized': '💳 Payment Authorized',
  'payment_captured': '💰 Payment Captured',
};

export function RideTimeline({ rideId }: RideTimelineProps) {
  const [events, setEvents] = useState<RideEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Keep reference to last events to prevent UI flicker
  const lastEventsRef = useRef<RideEvent[]>([]);
  // Track if we've loaded at least once
  const hasLoadedOnceRef = useRef(false);

  useEffect(() => {
    console.log('[RideTimeline] Setting up subscription for rideId:', rideId);
    
    // Reset state for new rideId
    setLoading(true);
    setError(null);
    hasLoadedOnceRef.current = false;

    if (!rideId) {
      console.warn('[RideTimeline] No rideId provided');
      setLoading(false);
      setError('No ride ID');
      return;
    }

    // Real-time listener on events subcollection
    const eventsQuery = query(
      collection(db, 'rides', rideId, 'events'),
      orderBy('atMs', 'asc'),
      limit(200)
    );

    const unsubscribe = onSnapshot(
      eventsQuery,
      (snapshot) => {
        console.log('[RideTimeline] Snapshot received:', snapshot.size, 'events');
        
        const newEvents: RideEvent[] = [];
        const seenIds = new Set<string>();
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          const eventId = doc.id;
          
          // Deduplicate by ID
          if (seenIds.has(eventId)) return;
          seenIds.add(eventId);
          
          newEvents.push({
            id: eventId,
            type: data.type || 'unknown',
            atMs: data.atMs || data.createdAtMs || 0,
            createdAtMs: data.createdAtMs || data.atMs || 0,
            meta: data.meta || {},
          });
        });

        // Sort by timestamp
        newEvents.sort((a, b) => (a.atMs || 0) - (b.atMs || 0));

        // CRITICAL: Only update if we have events OR this is the first load
        // Never clear existing events on subsequent empty snapshots
        if (newEvents.length > 0) {
          console.log('[RideTimeline] Updating with', newEvents.length, 'events');
          setEvents(newEvents);
          lastEventsRef.current = newEvents;
        } else if (!hasLoadedOnceRef.current) {
          console.log('[RideTimeline] First load: empty timeline');
          setEvents([]);
          lastEventsRef.current = [];
        } else {
          console.log('[RideTimeline] Ignoring empty snapshot, keeping', lastEventsRef.current.length, 'events');
          // Keep showing last known events
        }
        
        hasLoadedOnceRef.current = true;
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('[RideTimeline] Listener error:', err);
        const errorMessage = err.code === 'permission-denied' 
          ? 'Permission denied - unable to load timeline' 
          : 'Failed to load timeline';
        
        // Only set error if we haven't loaded events yet
        if (!hasLoadedOnceRef.current) {
          setError(errorMessage);
        }
        setLoading(false);
      }
    );

    return () => {
      console.log('[RideTimeline] Cleaning up subscription for rideId:', rideId);
      unsubscribe();
    };
  }, [rideId]);

  // Always render timeline container for stability
  return (
    <div className="ride-timeline">
      <h3>📊 Ride Timeline</h3>
      
      {loading && !hasLoadedOnceRef.current ? (
        <div className="timeline-loading">Loading timeline...</div>
      ) : error && events.length === 0 ? (
        <div className="timeline-error">
          {error}
          <div style={{ fontSize: '0.8rem', marginTop: '8px', opacity: 0.7 }}>
            Timeline events may not be available yet
          </div>
        </div>
      ) : events.length === 0 ? (
        <div className="timeline-empty" style={{ 
          padding: '20px', 
          textAlign: 'center', 
          color: '#888',
          fontSize: '0.9rem' 
        }}>
          No timeline events yet
        </div>
      ) : (
        <div className="timeline-events">
          {events.map((event, index) => (
            <div key={event.id || `${event.type}-${event.atMs}-${index}`} className="timeline-event">
              <div className="event-marker"></div>
              <div className="event-content">
                <div className="event-type">
                  {eventTypeLabels[event.type] || event.type}
                </div>
                <div className="event-time">
                  {new Date(event.atMs).toLocaleTimeString()}
                </div>
                {event.meta && Object.keys(event.meta).length > 0 && (
                  <div className="event-meta">
                    {event.type === 'offer_created' && event.meta.driverId && (
                      <span className="meta-detail">
                        Driver: {event.meta.driverId.substring(0, 8)}...
                      </span>
                    )}
                    {event.type === 'matching_started' && (
                      <span className="meta-detail">
                        Attempt {event.meta.dispatchAttempt || 1}
                      </span>
                    )}
                    {event.type === 'search_timeout' && (
                      <span className="meta-detail">
                        After {Math.round((event.meta.searchDurationMs || 0) / 1000)}s
                      </span>
                    )}
                    {event.type === 'driver_online_triggered_match' && event.meta.driverId && (
                      <span className="meta-detail">
                        {event.meta.driverId.substring(0, 8)}... came online
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
