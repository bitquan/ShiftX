import { useState } from 'react';
import React from 'react';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getInitializedClient } from '@shiftx/driver-client';
import { useToast } from './Toast';
import { 
  getEvents, 
  clearEvents, 
  exportEventsAsJSON,
  subscribeToEvents,
  EventCategory,
  EventLogEntry 
} from '../utils/eventLog';

interface DiagnosticsPanelProps {
  user: any;
  gpsData?: {
    currentLocation: { lat: number; lng: number } | null;
    gpsError: string | null;
    lastFixAtMs: number | null;
    hasGpsFix: boolean;
  };
}

export function DiagnosticsPanel({ user, gpsData }: DiagnosticsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [events, setEvents] = useState<EventLogEntry[]>([]);
  const [filterCategory, setFilterCategory] = useState<EventCategory | 'all'>('all');
  
  // Load saved position from localStorage or use default
  const savedPosition = localStorage.getItem('diagnostics-button-position');
  const initialPosition = savedPosition ? JSON.parse(savedPosition) : { x: 16, y: 80 };
  
  const [position, setPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const { show } = useToast();

  // Subscribe to event log changes
  React.useEffect(() => {
    const unsubscribe = subscribeToEvents(() => {
      setEvents(getEvents());
    });
    setEvents(getEvents()); // Initial load
    return unsubscribe;
  }, []);

  // Only show in development
  if (import.meta.env.PROD) {
    return null;
  }

  const handleToggle = async () => {
    if (!isOpen && user) {
      // Fetch user role when opening
      try {
        const { firestore } = getInitializedClient();
        const userRef = doc(firestore, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        const role = userSnap.exists() ? userSnap.data()?.role : 'unknown';
        setUserRole(role);
      } catch (error) {
        console.error('[Diagnostics] Failed to fetch user role:', error);
        setUserRole('error');
      }
    }
    setIsOpen(!isOpen);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    show(`Copied ${label}`, 'info');
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isOpen) return; // Don't drag when panel is open
    setIsDragging(true);
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setDragOffset({
      x: window.innerWidth - e.clientX - rect.width,
      y: window.innerHeight - e.clientY - rect.height
    });
  };

  React.useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newPosition = {
        x: window.innerWidth - e.clientX - dragOffset.x,
        y: window.innerHeight - e.clientY - dragOffset.y
      };
      setPosition(newPosition);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      // Save position to localStorage when drag ends
      localStorage.setItem('diagnostics-button-position', JSON.stringify(position));
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, position]);

  const { app } = getInitializedClient();
  const auth = getAuth(app);
  const projectId = auth.app.options.projectId || 'unknown';
  const functionsRegion = 'us-central1';
  const functionsUrl = import.meta.env.DEV 
    ? 'http://127.0.0.1:5002'
    : `https://${functionsRegion}-${projectId}.cloudfunctions.net`;
  
  // No Stripe in driver app, but we can show Mapbox token
  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN || 'not-set';
  const mapboxPrefix = mapboxToken.substring(0, 8);

  return (
    <div style={{
      position: 'fixed',
      bottom: `${position.y}px`,
      right: `${position.x}px`,
      zIndex: 9999,
    }}>
      {/* Toggle Button */}
      <button
        onClick={handleToggle}
        onMouseDown={handleMouseDown}
        style={{
          padding: '8px 12px',
          backgroundColor: 'rgba(96,165,250,0.9)',
          color: '#000',
          border: 'none',
          borderRadius: '6px',
          fontSize: '0.85rem',
          fontWeight: '600',
          cursor: isDragging ? 'grabbing' : (isOpen ? 'pointer' : 'grab'),
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          userSelect: 'none',
        }}
      >
        {isOpen ? '✕ Close Diagnostics' : '🔧 Diagnostics'}
      </button>

      {/* Panel */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          bottom: '50px',
          right: '0',
          width: '400px',
          maxHeight: '600px',
          overflowY: 'auto',
          backgroundColor: 'rgba(18,18,18,0.98)',
          border: '1px solid rgba(96,165,250,0.3)',
          borderRadius: '8px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          padding: '16px',
        }}>
          <h3 style={{
            margin: '0 0 16px 0',
            fontSize: '1rem',
            color: 'rgba(96,165,250,0.95)',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            paddingBottom: '8px',
          }}>
            🔧 Development Diagnostics
          </h3>

          <div style={{ fontSize: '0.85rem', lineHeight: '1.6' }}>
            {/* Phase 2C-1: GPS Debug Info */}
            {gpsData && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', marginBottom: '4px' }}>
                  📍 GPS Status (Phase 2C-1)
                </div>
                <div style={{
                  padding: '8px',
                  backgroundColor: gpsData.hasGpsFix ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                  borderRadius: '4px',
                  border: `1px solid ${gpsData.hasGpsFix ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                }}>
                  <div style={{ marginBottom: '4px' }}>
                    <span style={{ color: 'rgba(255,255,255,0.6)' }}>hasGpsFix:</span>{' '}
                    <code style={{ color: gpsData.hasGpsFix ? 'rgba(16,185,129,0.95)' : 'rgba(239,68,68,0.95)' }}>
                      {gpsData.hasGpsFix ? 'true ✓' : 'false ✗'}
                    </code>
                  </div>
                  {gpsData.currentLocation && (
                    <>
                      <div style={{ marginBottom: '4px' }}>
                        <span style={{ color: 'rgba(255,255,255,0.6)' }}>lat:</span>{' '}
                        <code style={{ color: 'rgba(0,255,140,0.95)' }}>{gpsData.currentLocation.lat.toFixed(6)}</code>
                      </div>
                      <div style={{ marginBottom: '4px' }}>
                        <span style={{ color: 'rgba(255,255,255,0.6)' }}>lng:</span>{' '}
                        <code style={{ color: 'rgba(0,255,140,0.95)' }}>{gpsData.currentLocation.lng.toFixed(6)}</code>
                      </div>
                    </>
                  )}
                  {gpsData.lastFixAtMs && (
                    <div style={{ marginBottom: '4px' }}>
                      <span style={{ color: 'rgba(255,255,255,0.6)' }}>gpsAgeSeconds:</span>{' '}
                      <code style={{ color: 'rgba(147,197,253,0.95)' }}>
                        {((Date.now() - gpsData.lastFixAtMs) / 1000).toFixed(1)}s
                      </code>
                    </div>
                  )}
                  {gpsData.gpsError && !gpsData.hasGpsFix && (
                    <div style={{ color: 'rgba(239,68,68,0.95)', marginTop: '4px' }}>
                      ⚠️ Error: {gpsData.gpsError}
                    </div>
                  )}
                  {gpsData.gpsError && gpsData.hasGpsFix && (
                    <div style={{ color: 'rgba(251,191,36,0.95)', fontSize: '0.75rem', marginTop: '4px' }}>
                      Note: Using last known position (error occurred after fix)
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Firebase Project */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', marginBottom: '4px' }}>
                Firebase Project
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px',
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderRadius: '4px',
              }}>
                <code style={{ color: 'rgba(0,255,140,0.95)' }}>{projectId}</code>
                <button
                  onClick={() => copyToClipboard(projectId, 'Project ID')}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: 'rgba(96,165,250,0.2)',
                    border: '1px solid rgba(96,165,250,0.3)',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    color: 'rgba(255,255,255,0.9)',
                    cursor: 'pointer',
                  }}
                >
                  Copy
                </button>
              </div>
            </div>

            {/* Functions Region + URL */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', marginBottom: '4px' }}>
                Functions Endpoint
              </div>
              <div style={{
                padding: '8px',
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderRadius: '4px',
              }}>
                <div style={{ marginBottom: '4px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>Region:</span>{' '}
                  <code style={{ color: 'rgba(0,255,140,0.95)' }}>{functionsRegion}</code>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <code style={{
                    color: 'rgba(0,255,140,0.95)',
                    fontSize: '0.75rem',
                    wordBreak: 'break-all',
                    marginRight: '8px',
                  }}>
                    {functionsUrl}
                  </code>
                  <button
                    onClick={() => copyToClipboard(functionsUrl, 'Functions URL')}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: 'rgba(96,165,250,0.2)',
                      border: '1px solid rgba(96,165,250,0.3)',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      color: 'rgba(255,255,255,0.9)',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>

            {/* Mapbox Token */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', marginBottom: '4px' }}>
                Mapbox Access Token
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px',
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderRadius: '4px',
              }}>
                <code style={{ color: 'rgba(255,193,7,0.95)' }}>
                  {mapboxPrefix}{'•'.repeat(Math.max(0, mapboxToken.length - 8))}
                </code>
                <span style={{
                  fontSize: '0.75rem',
                  color: mapboxToken.includes('pk.') ? 'rgba(0,255,140,0.95)' : 'rgba(244,67,54,0.95)',
                  fontWeight: '600',
                }}>
                  {mapboxToken.includes('pk.') ? '✓ SET' : '⚠️ INVALID'}
                </span>
              </div>
            </div>

            {/* Current User */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', marginBottom: '4px' }}>
                Current User
              </div>
              <div style={{
                padding: '8px',
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderRadius: '4px',
              }}>
                {user ? (
                  <>
                    <div style={{ marginBottom: '4px' }}>
                      <span style={{ color: 'rgba(255,255,255,0.6)' }}>UID:</span>{' '}
                      <code style={{ color: 'rgba(0,255,140,0.95)', fontSize: '0.75rem', wordBreak: 'break-all' }}>
                        {user.uid}
                      </code>
                    </div>
                    <div style={{ marginBottom: '4px' }}>
                      <span style={{ color: 'rgba(255,255,255,0.6)' }}>Email:</span>{' '}
                      <code style={{ color: 'rgba(0,255,140,0.95)' }}>{user.email || 'Anonymous'}</code>
                    </div>
                    <div>
                      <span style={{ color: 'rgba(255,255,255,0.6)' }}>Role:</span>{' '}
                      <code style={{ color: 'rgba(96,165,250,0.95)' }}>{userRole || '...'}</code>
                    </div>
                  </>
                ) : (
                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>Not signed in</span>
                )}
              </div>
            </div>

            {/* Environment Mode */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', marginBottom: '4px' }}>
                Environment
              </div>
              <div style={{
                padding: '8px',
                backgroundColor: import.meta.env.DEV ? 'rgba(255,193,7,0.1)' : 'rgba(244,67,54,0.1)',
                border: import.meta.env.DEV ? '1px solid rgba(255,193,7,0.3)' : '1px solid rgba(244,67,54,0.3)',
                borderRadius: '4px',
              }}>
                <span style={{
                  fontWeight: '600',
                  color: import.meta.env.DEV ? 'rgba(255,193,7,0.95)' : 'rgba(244,67,54,0.95)',
                }}>
                  {import.meta.env.DEV ? '🚧 DEVELOPMENT' : '🚀 PRODUCTION'}
                </span>
                {import.meta.env.DEV && (
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>
                    Using Firebase Emulators (localhost)
                  </div>
                )}
              </div>
            </div>

            {/* Auth Config */}
            <div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', marginBottom: '4px' }}>
                Auth Domain
              </div>
              <div style={{
                padding: '8px',
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderRadius: '4px',
              }}>
                <code style={{ color: 'rgba(0,255,140,0.95)', fontSize: '0.75rem', wordBreak: 'break-all' }}>
                  {auth.app.options.authDomain || 'unknown'}
                </code>
              </div>
            </div>

            {/* Phase 3F: Event Log Breadcrumbs */}
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '8px' 
              }}>
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem' }}>
                  📝 Event Log (Phase 3F)
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    onClick={() => {
                      copyToClipboard(exportEventsAsJSON(), 'Event Log JSON');
                    }}
                    style={{
                      padding: '2px 6px',
                      backgroundColor: 'rgba(96,165,250,0.2)',
                      border: '1px solid rgba(96,165,250,0.3)',
                      borderRadius: '3px',
                      fontSize: '0.7rem',
                      color: 'rgba(255,255,255,0.9)',
                      cursor: 'pointer',
                    }}
                  >
                    Export
                  </button>
                  <button
                    onClick={() => {
                      clearEvents();
                      show('Event log cleared', 'info');
                    }}
                    style={{
                      padding: '2px 6px',
                      backgroundColor: 'rgba(239,68,68,0.2)',
                      border: '1px solid rgba(239,68,68,0.3)',
                      borderRadius: '3px',
                      fontSize: '0.7rem',
                      color: 'rgba(255,255,255,0.9)',
                      cursor: 'pointer',
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Category Filter */}
              <div style={{ marginBottom: '8px' }}>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value as any)}
                  style={{
                    width: '100%',
                    padding: '4px 8px',
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '4px',
                    color: 'rgba(255,255,255,0.9)',
                    fontSize: '0.75rem',
                  }}
                >
                  <option value="all">All Events ({events.length})</option>
                  <option value="auth">🔐 Auth</option>
                  <option value="offer">📋 Offers</option>
                  <option value="ride">🚗 Rides</option>
                  <option value="location">📍 Location</option>
                  <option value="navigation">🧭 Navigation</option>
                  <option value="error">❌ Errors</option>
                  <option value="system">⚙️ System</option>
                </select>
              </div>

              {/* Event List */}
              <div style={{
                maxHeight: '300px',
                overflowY: 'auto',
                backgroundColor: 'rgba(0,0,0,0.3)',
                borderRadius: '4px',
                border: '1px solid rgba(255,255,255,0.1)',
              }}>
                {events
                  .filter(e => filterCategory === 'all' || e.category === filterCategory)
                  .map((event) => (
                    <div
                      key={event.id}
                      style={{
                        padding: '8px',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        fontSize: '0.75rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <span style={{
                          color: getCategoryColor(event.category),
                          fontWeight: '600',
                        }}>
                          {getCategoryEmoji(event.category)} {event.category.toUpperCase()}
                        </span>
                        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem' }}>
                          {formatTimestamp(event.timestamp)}
                        </span>
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.8)' }}>
                        {event.message}
                      </div>
                      {event.details && (
                        <div style={{
                          marginTop: '4px',
                          padding: '4px',
                          backgroundColor: 'rgba(0,0,0,0.3)',
                          borderRadius: '2px',
                          fontSize: '0.7rem',
                          color: 'rgba(255,255,255,0.6)',
                          fontFamily: "'Monaco', 'Courier New', monospace",
                        }}>
                          {JSON.stringify(event.details, null, 2)}
                        </div>
                      )}
                    </div>
                  ))}
                {events.filter(e => filterCategory === 'all' || e.category === filterCategory).length === 0 && (
                  <div style={{
                    padding: '16px',
                    textAlign: 'center',
                    color: 'rgba(255,255,255,0.4)',
                    fontSize: '0.75rem',
                  }}>
                    No events logged yet
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            fontSize: '0.75rem',
            color: 'rgba(255,255,255,0.4)',
            textAlign: 'center',
          }}>
            This panel only appears in development mode
          </div>
        </div>
      )}
    </div>
  );
}

// Helper functions for event log display
function getCategoryEmoji(category: EventCategory): string {
  switch (category) {
    case 'auth': return '🔐';
    case 'offer': return '📋';
    case 'ride': return '🚗';
    case 'location': return '📍';
    case 'navigation': return '🧭';
    case 'error': return '❌';
    case 'system': return '⚙️';
    default: return '📝';
  }
}

function getCategoryColor(category: EventCategory): string {
  switch (category) {
    case 'auth': return 'rgba(59,130,246,0.95)';
    case 'offer': return 'rgba(139,92,246,0.95)';
    case 'ride': return 'rgba(16,185,129,0.95)';
    case 'location': return 'rgba(6,182,212,0.95)';
    case 'navigation': return 'rgba(245,158,11,0.95)';
    case 'error': return 'rgba(239,68,68,0.95)';
    case 'system': return 'rgba(107,114,128,0.95)';
    default: return 'rgba(100,116,139,0.95)';
  }
}

function formatTimestamp(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 1000) return 'just now';
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
}
