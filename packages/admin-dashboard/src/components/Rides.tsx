import { useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface Ride {
  id: string;
  customerId: string;
  customerEmail: string;
  driverId?: string;
  driverEmail?: string;
  status: string;
  pickupAddress: string;
  dropoffAddress: string;
  vehicleClass: string;
  estimatedFare: number;
  actualFare?: number;
  createdAt: any;
  acceptedAt?: any;
  completedAt?: any;
  cancelledAt?: any;
}

export function Rides() {
  const [rideId, setRideId] = useState('');
  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const searchRide = async () => {
    if (!rideId.trim()) {
      setError('Please enter a ride ID');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setRide(null);

      const rideDoc = await getDoc(doc(db, 'rides', rideId.trim()));
      
      if (!rideDoc.exists()) {
        setError('Ride not found');
        return;
      }

      const rideData = rideDoc.data();
      
      // Get customer info
      const customerDoc = await getDoc(doc(db, 'users', rideData.customerId));
      const customerEmail = customerDoc.exists() ? customerDoc.data().email : 'Unknown';

      // Get driver info if available
      let driverEmail = '';
      if (rideData.driverId) {
        const driverDoc = await getDoc(doc(db, 'users', rideData.driverId));
        driverEmail = driverDoc.exists() ? driverDoc.data().email : 'Unknown';
      }

      setRide({
        id: rideDoc.id,
        ...rideData,
        customerEmail,
        driverEmail,
      } as Ride);
    } catch (error) {
      console.error('Error searching ride:', error);
      setError('Failed to load ride');
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    try {
      const date = timestamp.toDate();
      return date.toLocaleString();
    } catch {
      return 'N/A';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#ffa500';
      case 'accepted': return '#0088ff';
      case 'started': return '#00cc00';
      case 'in_progress': return '#00cc00';
      case 'completed': return '#666666';
      case 'cancelled': return '#ff4444';
      default: return '#666666';
    }
  };

  return (
    <div className="rides-screen">
      <div className="screen-header">
        <h2>Ride Search</h2>
      </div>

      <div className="search-section">
        <input
          type="text"
          placeholder="Enter ride ID..."
          value={rideId}
          onChange={(e) => setRideId(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && searchRide()}
          className="search-input"
        />
        <button onClick={searchRide} disabled={loading} className="search-btn">
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {ride && (
        <div className="ride-details">
          <div className="detail-section">
            <h3>Ride Information</h3>
            <div className="detail-row">
              <span className="detail-label">Ride ID:</span>
              <span className="detail-value">{ride.id}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Status:</span>
              <span 
                className="detail-value status-badge" 
                style={{ backgroundColor: getStatusColor(ride.status), color: 'white' }}
              >
                {ride.status}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Vehicle Class:</span>
              <span className="detail-value">{ride.vehicleClass}</span>
            </div>
            {ride.estimatedFare != null && (
              <div className="detail-row">
                <span className="detail-label">Estimated Fare:</span>
                <span className="detail-value">${ride.estimatedFare.toFixed(2)}</span>
              </div>
            )}
            {ride.actualFare != null && (
              <div className="detail-row">
                <span className="detail-label">Actual Fare:</span>
                <span className="detail-value">${ride.actualFare.toFixed(2)}</span>
              </div>
            )}
          </div>

          <div className="detail-section">
            <h3>Customer</h3>
            <div className="detail-row">
              <span className="detail-label">Customer ID:</span>
              <span className="detail-value">{ride.customerId}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Email:</span>
              <span className="detail-value">{ride.customerEmail}</span>
            </div>
          </div>

          {ride.driverId && (
            <div className="detail-section">
              <h3>Driver</h3>
              <div className="detail-row">
                <span className="detail-label">Driver ID:</span>
                <span className="detail-value">{ride.driverId}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Email:</span>
                <span className="detail-value">{ride.driverEmail}</span>
              </div>
            </div>
          )}

          <div className="detail-section">
            <h3>Route</h3>
            <div className="detail-row">
              <span className="detail-label">Pickup:</span>
              <span className="detail-value">{ride.pickupAddress}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Dropoff:</span>
              <span className="detail-value">{ride.dropoffAddress}</span>
            </div>
          </div>

          <div className="detail-section">
            <h3>Timeline</h3>
            <div className="detail-row">
              <span className="detail-label">Created:</span>
              <span className="detail-value">{formatTimestamp(ride.createdAt)}</span>
            </div>
            {ride.acceptedAt && (
              <div className="detail-row">
                <span className="detail-label">Accepted:</span>
                <span className="detail-value">{formatTimestamp(ride.acceptedAt)}</span>
              </div>
            )}
            {ride.completedAt && (
              <div className="detail-row">
                <span className="detail-label">Completed:</span>
                <span className="detail-value">{formatTimestamp(ride.completedAt)}</span>
              </div>
            )}
            {ride.cancelledAt && (
              <div className="detail-row">
                <span className="detail-label">Cancelled:</span>
                <span className="detail-value">{formatTimestamp(ride.cancelledAt)}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
