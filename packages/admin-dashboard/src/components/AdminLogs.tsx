import { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

interface AdminLog {
  id: string;
  adminId: string;
  adminEmail: string;
  action: string;
  targetId: string;
  targetType: string;
  details: any;
  timestamp: any;
}

export function AdminLogs() {
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const logsQuery = query(
        collection(db, 'adminLogs'),
        orderBy('timestamp', 'desc'),
        limit(50)
      );
      
      const logsSnap = await getDocs(logsQuery);
      const logsData: AdminLog[] = logsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as AdminLog));

      setLogs(logsData);
    } catch (error) {
      console.error('Error loading logs:', error);
      alert('Failed to load admin logs');
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

  const getActionColor = (action: string) => {
    if (action.includes('approve')) return '#00cc00';
    if (action.includes('disable') || action.includes('reject')) return '#ff4444';
    return '#0088ff';
  };

  if (loading) {
    return <div className="loading">Loading logs...</div>;
  }

  return (
    <div className="logs-screen">
      <div className="screen-header">
        <h2>Admin Activity Logs</h2>
        <button onClick={loadLogs} className="refresh-btn">
          🔄 Refresh
        </button>
      </div>

      <div className="logs-list">
        {logs.length === 0 ? (
          <div className="empty-state">No admin logs found</div>
        ) : (
          logs.map(log => (
            <div key={log.id} className="log-card">
              <div className="log-header">
                <span 
                  className="log-action"
                  style={{ color: getActionColor(log.action) }}
                >
                  {log.action}
                </span>
                <span className="log-time">{formatTimestamp(log.timestamp)}</span>
              </div>
              
              <div className="log-details">
                <div className="log-row">
                  <span className="log-label">Admin:</span>
                  <span className="log-value">{log.adminEmail}</span>
                </div>
                <div className="log-row">
                  <span className="log-label">Target:</span>
                  <span className="log-value">
                    {log.targetType}: {log.targetId}
                  </span>
                </div>
                {log.details && (
                  <div className="log-row">
                    <span className="log-label">Details:</span>
                    <span className="log-value">
                      {JSON.stringify(log.details, null, 2)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
