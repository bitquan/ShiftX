import { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions, auth } from '../firebase';
import { featureFlags } from '../config/featureFlags';

interface DebugInfo {
  userId: string;
  rideId?: string;
  lastEvents: Array<{
    type: string;
    timestamp: string;
    data: any;
  }>;
  environment: {
    isDev: boolean;
    isEmulator: boolean;
    stripeMode: 'test' | 'live' | 'unknown';
    stripeKey: string;
    timestamp: string;
  };
}

export function DebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Only show in dev mode or if debug panel enabled
  if (!featureFlags.enableDebugPanel) {
    return null;
  }

  const fetchDebugInfo = async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';
      const stripeMode = stripeKey.startsWith('pk_test_') 
        ? 'test' 
        : stripeKey.startsWith('pk_live_') 
          ? 'live' 
          : 'unknown';
      
      if (!user) {
        setDebugInfo({
          userId: 'Not authenticated',
          lastEvents: [],
          environment: {
            isDev: import.meta.env.DEV,
            isEmulator: !!import.meta.env.DEV,
            stripeMode,
            stripeKey: stripeKey ? `${stripeKey.substring(0, 15)}...` : 'Not set',
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      // Get recent events for this user
      const getRideEvents = httpsCallable(functions, 'getRideEvents');
      
      // Try to get events for current ride (if any)
      const localRideId = localStorage.getItem('currentRideId');
      let events: any[] = [];
      
      if (localRideId) {
        try {
          const result = await getRideEvents({ rideId: localRideId });
          events = (result.data as any).events || [];
        } catch (err) {
          console.error('Failed to fetch events:', err);
        }
      }

      setDebugInfo({
        userId: user.uid,
        rideId: localRideId || undefined,
        lastEvents: events.slice(-10).map((e: any) => ({
          type: e.type,
          timestamp: new Date(e.timestamp).toLocaleString(),
          data: e.data,
        })),
        environment: {
          isDev: import.meta.env.DEV,
          isEmulator: !!import.meta.env.DEV,
          stripeMode,
          stripeKey: stripeKey ? `${stripeKey.substring(0, 15)}...` : 'Not set',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      console.error('[DebugPanel] Failed to fetch debug info:', {
        code: error?.code,
        message: error?.message,
        details: error?.details,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDebugInfo();
    }
  }, [isOpen]);

  const copyToClipboard = () => {
    const text = JSON.stringify(debugInfo, null, 2);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {/* Debug toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          padding: '8px 16px',
          borderRadius: '8px',
          border: '1px solid rgba(255,255,255,0.3)',
          background: 'rgba(255,255,255,0.05)',
          color: '#e1e6ef',
          cursor: 'pointer',
          fontSize: '14px',
        }}
        title="Debug Panel"
      >
        🐛 Debug
      </button>

      {/* Debug panel */}
      {isOpen && (
        <div className="fixed top-20 right-4 z-50 w-96 max-h-96 bg-gray-900 text-white rounded-lg shadow-2xl overflow-hidden">
          <div className="bg-purple-600 px-4 py-2 flex items-center justify-between">
            <h3 className="font-bold">Debug Info</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white hover:text-gray-200"
            >
              ✕
            </button>
          </div>

          <div className="p-4 overflow-y-auto max-h-80 text-xs">
            {loading ? (
              <p className="text-gray-400">Loading...</p>
            ) : debugInfo ? (
              <>
                <div className="mb-4">
                  <h4 className="font-bold text-purple-400 mb-2">User</h4>
                  <p className="text-gray-300 font-mono break-all">{debugInfo.userId}</p>
                </div>

                {debugInfo.rideId && (
                  <div className="mb-4">
                    <h4 className="font-bold text-purple-400 mb-2">Current Ride</h4>
                    <p className="text-gray-300 font-mono break-all">{debugInfo.rideId}</p>
                  </div>
                )}

                <div className="mb-4">
                  <h4 className="font-bold text-purple-400 mb-2">Environment</h4>
                  <div className="text-gray-300 space-y-1">
                    <p>Mode: {debugInfo.environment.isDev ? 'Development' : 'Production'}</p>
                    <p>Emulator: {debugInfo.environment.isEmulator ? 'Yes' : 'No'}</p>
                    <p className="text-xs text-gray-400">{debugInfo.environment.timestamp}</p>
                  </div>
                </div>

                {debugInfo.lastEvents.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-bold text-purple-400 mb-2">Last Events ({debugInfo.lastEvents.length})</h4>
                    <div className="space-y-2">
                      {debugInfo.lastEvents.map((event, idx) => (
                        <div key={idx} className="bg-gray-800 p-2 rounded">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-green-400 font-bold">{event.type}</span>
                            <span className="text-gray-500 text-xs">{event.timestamp}</span>
                          </div>
                          {event.data && (
                            <pre className="text-gray-400 text-xs overflow-x-auto">
                              {JSON.stringify(event.data, null, 2)}
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={copyToClipboard}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded text-sm font-bold"
                >
                  {copied ? '✓ Copied!' : '📋 Copy to Clipboard'}
                </button>
              </>
            ) : (
              <p className="text-gray-400">No debug info available</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
