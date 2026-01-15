import { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';

interface Report {
  id: string;
  reporterUid: string;
  reporterEmail: string;
  targetUid: string;
  targetEmail: string;
  targetRole: 'customer' | 'driver';
  rideId: string | null;
  reason: string;
  category: string;
  status: string;
  createdAtMs: number;
}

export function Reports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'reviewed'>('all');

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      setLoading(true);
      const reportsRef = collection(db, 'reports');
      const q = query(reportsRef, orderBy('createdAtMs', 'desc'), limit(100));
      const snapshot = await getDocs(q);
      
      const reportsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Report[];
      
      setReports(reportsData);
    } catch (error) {
      console.error('Error loading reports:', error);
      alert('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const filteredReports = reports.filter(report => {
    if (filter === 'pending') return report.status === 'pending';
    if (filter === 'reviewed') return report.status !== 'pending';
    return true;
  });

  const formatDate = (ms: number) => {
    return new Date(ms).toLocaleString();
  };

  if (loading) {
    return <div className="loading">Loading reports...</div>;
  }

  return (
    <div className="reports-screen">
      <div className="screen-header">
        <h2>User Reports</h2>
        <div className="filter-buttons">
          <button
            className={filter === 'all' ? 'active' : ''}
            onClick={() => setFilter('all')}
          >
            All ({reports.length})
          </button>
          <button
            className={filter === 'pending' ? 'active' : ''}
            onClick={() => setFilter('pending')}
          >
            Pending ({reports.filter(r => r.status === 'pending').length})
          </button>
          <button
            className={filter === 'reviewed' ? 'active' : ''}
            onClick={() => setFilter('reviewed')}
          >
            Reviewed ({reports.filter(r => r.status !== 'pending').length})
          </button>
        </div>
      </div>

      <div className="reports-list">
        {filteredReports.length === 0 ? (
          <div className="empty-state">No reports found</div>
        ) : (
          filteredReports.map(report => (
            <div key={report.id} className="report-card">
              <div className="report-header">
                <span className={`status-badge ${report.status}`}>
                  {report.status === 'pending' ? '⏳ Pending' : '✓ Reviewed'}
                </span>
                <span className="report-date">{formatDate(report.createdAtMs)}</span>
              </div>

              <div className="report-body">
                <div className="report-parties">
                  <div className="party">
                    <strong>Reporter:</strong>
                    <div>{report.reporterEmail}</div>
                    <div className="uid-muted">{report.reporterUid}</div>
                  </div>
                  <div className="party">
                    <strong>Reported {report.targetRole}:</strong>
                    <div>{report.targetEmail}</div>
                    <div className="uid-muted">{report.targetUid}</div>
                  </div>
                </div>

                <div className="report-details">
                  <div className="detail-row">
                    <strong>Category:</strong>
                    <span>{report.category}</span>
                  </div>
                  {report.rideId && (
                    <div className="detail-row">
                      <strong>Ride ID:</strong>
                      <span className="mono">{report.rideId}</span>
                    </div>
                  )}
                  <div className="detail-row reason">
                    <strong>Reason:</strong>
                    <p>{report.reason}</p>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
