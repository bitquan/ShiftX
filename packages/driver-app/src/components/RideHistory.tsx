import { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { useToast } from './Toast';

interface RideHistoryItem {
  rideId: string;
  customerId: string;
  customerEmail?: string;
  status: string;
  pickup: { lat: number; lng: number; address?: string };
  dropoff: { lat: number; lng: number; address?: string };
  priceCents: number;
  createdAtMs: number;
  completedAtMs?: number;
}

interface RideHistoryProps {
  driverId: string;
}

export function RideHistory({ driverId }: RideHistoryProps) {
  const [rides, setRides] = useState<RideHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [customerProfiles, setCustomerProfiles] = useState<Map<string, any>>(new Map());
  const { show } = useToast();

  useEffect(() => {
    loadHistory();
  }, [driverId]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      
      // Get rides where this driver was assigned
      const ridesRef = collection(db, 'rides');
      const q = query(
        ridesRef,
        where('driverId', '==', driverId),
        orderBy('createdAtMs', 'desc'),
        limit(50)
      );
      
      const snapshot = await getDocs(q);
      const ridesData = snapshot.docs.map(doc => ({
        rideId: doc.id,
        ...doc.data(),
      })) as RideHistoryItem[];
      
      setRides(ridesData);

      // Load customer profiles
      const customerIds = [...new Set(ridesData.map(r => r.customerId))];
      const profiles = new Map();
      
      for (const customerId of customerIds) {
        try {
          const userSnap = await getDocs(
            query(collection(db, 'users'), where('__name__', '==', customerId), limit(1))
          );
          if (!userSnap.empty) {
            profiles.set(customerId, userSnap.docs[0].data());
          }
        } catch (err) {
          console.error('Error loading customer profile:', err);
        }
      }
      
      setCustomerProfiles(profiles);
    } catch (error) {
      console.error('Error loading ride history:', error);
      show('Failed to load ride history', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleBlockCustomer = async (customerId: string, customerEmail: string) => {
    const reason = prompt(`Block ${customerEmail}? (Optional reason)`);
    if (reason === null) return;

    try {
      const blockFn = httpsCallable(functions, 'driverBlockCustomer');
      await blockFn({ customerId, reason: reason || '' });
      show('Customer blocked successfully', 'success');
      
      // Refresh to update UI
      await loadHistory();
    } catch (error) {
      show(`Failed to block: ${(error as Error).message}`, 'error');
    }
  };

  const handleReportCustomer = async (customerId: string, rideId: string, customerEmail: string) => {
    const reason = prompt(`Report ${customerEmail}? (Required reason)`);
    if (!reason || reason.trim().length === 0) {
      show('Report cancelled', 'info');
      return;
    }

    try {
      const reportFn = httpsCallable(functions, 'createReport');
      await reportFn({
        targetUid: customerId,
        targetRole: 'customer',
        rideId,
        reason: reason.trim(),
        category: 'post-ride',
      });
      show('Report submitted to admin', 'success');
    } catch (error) {
      show(`Failed to report: ${(error as Error).message}`, 'error');
    }
  };

  const formatDate = (ms: number) => {
    return new Date(ms).toLocaleString();
  };

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  if (loading) {
    return (
      <div style={{ padding: '1rem', textAlign: 'center' }}>
        <p>Loading ride history...</p>
      </div>
    );
  }

  if (rides.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(255,255,255,0.6)' }}>
        <p>No ride history yet</p>
        <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
          Completed rides will appear here
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 1rem 1rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {rides.map(ride => {
          const customer = customerProfiles.get(ride.customerId);
          const customerEmail = customer?.email || ride.customerEmail || 'Unknown';
          const customerName = customer?.displayName || customerEmail.split('@')[0];

          return (
            <div
              key={ride.rideId}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '8px',
                padding: '1rem',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                    {formatPrice(ride.priceCents || 0)}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>
                    {formatDate(ride.createdAtMs)}
                  </div>
                </div>
                <div
                  style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '12px',
                    fontSize: '0.85rem',
                    background: ride.status === 'completed' ? '#10b981' : '#6b7280',
                    color: 'white',
                  }}
                >
                  {ride.status}
                </div>
              </div>

              {/* Customer */}
              <div style={{ marginBottom: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)', marginBottom: '0.25rem' }}>
                  👤 Customer
                </div>
                <div style={{ fontWeight: '500' }}>{customerName}</div>
                <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>{customerEmail}</div>
              </div>

              {/* Locations */}
              <div style={{ marginBottom: '0.75rem', fontSize: '0.9rem' }}>
                <div style={{ marginBottom: '0.5rem' }}>
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>📍 Pickup: </span>
                  {ride.pickup.address || `${ride.pickup.lat.toFixed(4)}, ${ride.pickup.lng.toFixed(4)}`}
                </div>
                <div>
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>🏁 Dropoff: </span>
                  {ride.dropoff.address || `${ride.dropoff.lat.toFixed(4)}, ${ride.dropoff.lng.toFixed(4)}`}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button
                  onClick={() => handleBlockCustomer(ride.customerId, customerEmail)}
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                  }}
                >
                  🚫 Block Rider
                </button>
                <button
                  onClick={() => handleReportCustomer(ride.customerId, ride.rideId, customerEmail)}
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    background: '#f59e0b',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                  }}
                >
                  ⚠️ Report
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
