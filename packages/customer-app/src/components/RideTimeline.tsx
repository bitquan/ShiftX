import { useState, useEffect } from 'react';
import { functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import './RideTimeline.css';

interface RideEvent {
  id: string;
  type: string;
  atMs: number;
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
  'ride_completed': '🏁 Ride Completed',
  'ride_cancelled': '🚫 Ride Cancelled',
  'search_timeout': '⏰ Search Timed Out',
  'driver_online_triggered_match': '🔔 Driver Came Online',
};

export function RideTimeline({ rideId }: RideTimelineProps) {
  const [events, setEvents] = useState<RideEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        const getRideEvents = httpsCallable<{ rideId: string }, { events: RideEvent[] }>(
          functions,
          'getRideEvents'
        );
        const result = await getRideEvents({ rideId });
        setEvents(result.data.events);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch ride events:', err);
        setError('Failed to load timeline');
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
    
    // Refresh every 2 seconds while viewing
    const interval = setInterval(fetchEvents, 2000);
    return () => clearInterval(interval);
  }, [rideId]);

  if (loading && events.length === 0) {
    return <div className="timeline-loading">Loading timeline...</div>;
  }

  if (error) {
    return <div className="timeline-error">{error}</div>;
  }

  return (
    <div className="ride-timeline">
      <h3>📊 Ride Timeline</h3>
      <div className="timeline-events">
        {events.map((event, index) => (
          <div key={event.id || index} className="timeline-event">
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
    </div>
  );
}
