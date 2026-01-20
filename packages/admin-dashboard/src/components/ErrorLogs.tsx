import { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';

interface ErrorLog {
  id: string;
  error: string;
  message: string;
  stack?: string;
  componentStack?: string;
  userAgent?: string;
  url?: string;
  userId?: string;
  userEmail?: string;
  appVersion?: string;
  environment?: string;
  timestamp: Timestamp;
  timestampMs: number;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  source?: 'driver-app' | 'customer-app' | 'admin-dashboard';
}

type SeverityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low';
type SourceFilter = 'all' | 'driver-app' | 'customer-app' | 'admin-dashboard';

export function ErrorLogs() {
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedError, setExpandedError] = useState<string | null>(null);

  useEffect(() => {
    loadErrors();
  }, []);

  const loadErrors = async () => {
    try {
      setLoading(true);
      const errorsRef = collection(db, 'errorLogs');
      const q = query(errorsRef, orderBy('timestampMs', 'desc'), limit(100));
      const snapshot = await getDocs(q);
      
      const errorsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ErrorLog));
      
      setErrors(errorsData);
    } catch (error) {
      console.error('Error loading error logs:', error);
      alert('Failed to load error logs');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'critical': return '#ef4444';
      case 'high': return '#f59e0b';
      case 'medium': return '#eab308';
      case 'low': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const getSeverityIcon = (severity?: string) => {
    switch (severity) {
      case 'critical': return '🔴';
      case 'high': return '🟠';
      case 'medium': return '🟡';
      case 'low': return '🔵';
      default: return '⚪';
    }
  };

  const filteredErrors = errors
    .filter(error => {
      if (severityFilter !== 'all' && error.severity !== severityFilter) return false;
      if (sourceFilter !== 'all' && error.source !== sourceFilter) return false;
      if (searchTerm && !error.message.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !error.error.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      return true;
    });

  if (loading) {
    return <div className="loading">Loading error logs...</div>;
  }

  return (
    <div className="error-logs-screen">
      <div className="screen-header">
        <h2>Error Logs</h2>
        <button onClick={loadErrors} style={{ padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>
          🔄 Refresh
        </button>
      </div>

      {/* Stats Summary */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem',
      }}>
        <div style={{
          padding: '1rem',
          backgroundColor: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: '8px',
        }}>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ef4444' }}>
            {errors.filter(e => e.severity === 'critical').length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>Critical</div>
        </div>
        <div style={{
          padding: '1rem',
          backgroundColor: 'rgba(245,158,11,0.1)',
          border: '1px solid rgba(245,158,11,0.3)',
          borderRadius: '8px',
        }}>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#f59e0b' }}>
            {errors.filter(e => e.severity === 'high').length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>High</div>
        </div>
        <div style={{
          padding: '1rem',
          backgroundColor: 'rgba(234,179,8,0.1)',
          border: '1px solid rgba(234,179,8,0.3)',
          borderRadius: '8px',
        }}>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#eab308' }}>
            {errors.filter(e => e.severity === 'medium').length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>Medium</div>
        </div>
        <div style={{
          padding: '1rem',
          backgroundColor: 'rgba(107,114,128,0.1)',
          border: '1px solid rgba(107,114,128,0.3)',
          borderRadius: '8px',
        }}>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#6b7280' }}>
            {errors.filter(e => e.severity === 'low' || !e.severity).length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>Low/Unknown</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.85rem', marginBottom: '0.5rem', color: 'rgba(255,255,255,0.7)' }}>
            Severity
          </div>
          <div className="filter-buttons">
            {(['all', 'critical', 'high', 'medium', 'low'] as SeverityFilter[]).map(severity => (
              <button
                key={severity}
                className={severityFilter === severity ? 'active' : ''}
                onClick={() => setSeverityFilter(severity)}
              >
                {severity === 'all' ? 'All' : severity.charAt(0).toUpperCase() + severity.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.85rem', marginBottom: '0.5rem', color: 'rgba(255,255,255,0.7)' }}>
            Source
          </div>
          <div className="filter-buttons">
            <button
              className={sourceFilter === 'all' ? 'active' : ''}
              onClick={() => setSourceFilter('all')}
            >
              All Apps
            </button>
            <button
              className={sourceFilter === 'driver-app' ? 'active' : ''}
              onClick={() => setSourceFilter('driver-app')}
            >
              🚗 Driver
            </button>
            <button
              className={sourceFilter === 'customer-app' ? 'active' : ''}
              onClick={() => setSourceFilter('customer-app')}
            >
              👤 Customer
            </button>
            <button
              className={sourceFilter === 'admin-dashboard' ? 'active' : ''}
              onClick={() => setSourceFilter('admin-dashboard')}
            >
              ⚙️ Admin
            </button>
          </div>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search error messages..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 16px',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.2)',
            backgroundColor: 'rgba(255,255,255,0.05)',
            color: 'white',
            fontSize: '14px',
          }}
        />
      </div>

      {/* Errors List */}
      <div className="errors-list">
        {filteredErrors.length === 0 ? (
          <div className="empty-state">
            {errors.length === 0 ? '✅ No errors logged' : 'No errors match your filters'}
          </div>
        ) : (
          filteredErrors.map(error => (
            <div
              key={error.id}
              className="error-card"
              style={{
                padding: '1rem',
                marginBottom: '0.75rem',
                backgroundColor: 'rgba(0,0,0,0.3)',
                border: `1px solid ${getSeverityColor(error.severity)}40`,
                borderRadius: '8px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.2rem' }}>
                    {getSeverityIcon(error.severity)}
                  </span>
                  <div style={{
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    color: getSeverityColor(error.severity),
                  }}>
                    {error.severity?.toUpperCase() || 'UNKNOWN'}
                  </div>
                  {error.source && (
                    <div style={{
                      fontSize: '0.7rem',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(255,255,255,0.1)',
                      color: 'rgba(255,255,255,0.6)',
                    }}>
                      {error.source}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                  {new Date(error.timestampMs).toLocaleString()}
                </div>
              </div>

              <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.9)', marginBottom: '0.5rem', fontWeight: '500' }}>
                {error.error}
              </div>

              <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', marginBottom: '0.5rem' }}>
                {error.message}
              </div>

              {error.userEmail && (
                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.5rem' }}>
                  👤 User: {error.userEmail}
                </div>
              )}

              {error.url && (
                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: '0.5rem', wordBreak: 'break-all' }}>
                  🔗 {error.url}
                </div>
              )}

              {(error.stack || error.componentStack) && (
                <button
                  onClick={() => setExpandedError(expandedError === error.id ? null : error.id)}
                  style={{
                    marginTop: '0.5rem',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: 'white',
                  }}
                >
                  {expandedError === error.id ? '📋 Hide Stack' : '📋 View Stack Trace'}
                </button>
              )}

              {expandedError === error.id && (
                <div style={{
                  marginTop: '0.75rem',
                  padding: '1rem',
                  backgroundColor: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                  color: 'rgba(255,255,255,0.8)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  maxHeight: '300px',
                  overflow: 'auto',
                }}>
                  {error.stack || error.componentStack}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>
        Showing {filteredErrors.length} of {errors.length} errors (last 100)
      </div>
    </div>
  );
}
