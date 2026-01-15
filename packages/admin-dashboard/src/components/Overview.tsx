import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

interface Stats {
  onlineDrivers: number;
  activeRides: number;
  pendingApprovals: number;
  totalDrivers: number;
  totalCustomers: number;
  totalRides: number;
}

export function Overview() {
  const [stats, setStats] = useState<Stats>({
    onlineDrivers: 0,
    activeRides: 0,
    pendingApprovals: 0,
    totalDrivers: 0,
    totalCustomers: 0,
    totalRides: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();

    // Set up real-time listeners for dynamic stats
    const driversQuery = query(collection(db, 'drivers'), where('isOnline', '==', true));
    const unsubDrivers = onSnapshot(driversQuery, (snapshot) => {
      setStats(prev => ({ ...prev, onlineDrivers: snapshot.size }));
    });

    const ridesQuery = query(collection(db, 'rides'), where('status', 'in', ['accepted', 'started', 'in_progress']));
    const unsubRides = onSnapshot(ridesQuery, (snapshot) => {
      setStats(prev => ({ ...prev, activeRides: snapshot.size }));
    });

    return () => {
      unsubDrivers();
      unsubRides();
    };
  }, []);

  const loadStats = async () => {
    try {
      // Count total drivers
      const driversSnap = await getDocs(collection(db, 'drivers'));
      const totalDrivers = driversSnap.size;
      const pendingApprovals = driversSnap.docs.filter(doc => !doc.data().approved).length;

      // Count total customers
      const customersSnap = await getDocs(collection(db, 'customers'));
      const totalCustomers = customersSnap.size;

      // Count total rides
      const ridesSnap = await getDocs(collection(db, 'rides'));
      const totalRides = ridesSnap.size;

      setStats(prev => ({
        ...prev,
        totalDrivers,
        pendingApprovals,
        totalCustomers,
        totalRides,
      }));
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading stats...</div>;
  }

  return (
    <div className="overview">
      <h2>Dashboard Overview</h2>
      
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">🟢</div>
          <div className="stat-content">
            <div className="stat-value">{stats.onlineDrivers}</div>
            <div className="stat-label">Online Drivers</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🚗</div>
          <div className="stat-content">
            <div className="stat-value">{stats.activeRides}</div>
            <div className="stat-label">Active Rides</div>
          </div>
        </div>

        <div className="stat-card pending">
          <div className="stat-icon">⏳</div>
          <div className="stat-content">
            <div className="stat-value">{stats.pendingApprovals}</div>
            <div className="stat-label">Pending Approvals</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <div className="stat-value">{stats.totalDrivers}</div>
            <div className="stat-label">Total Drivers</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">👤</div>
          <div className="stat-content">
            <div className="stat-value">{stats.totalCustomers}</div>
            <div className="stat-label">Total Customers</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <div className="stat-value">{stats.totalRides}</div>
            <div className="stat-label">Total Rides</div>
          </div>
        </div>
      </div>
    </div>
  );
}
