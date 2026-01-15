import { useState, useEffect } from 'react';
import { featureFlags } from '../config/featureFlags';
import type { DriverProfile } from '@shiftx/driver-client';

interface DebugPanelProps {
  driverProfile: DriverProfile | null;
  currentRideId?: string | null;
  driverUid?: string;
}

interface DebugInfo {
  userId: string;
  driverProfile: {
    isOnline: boolean;
    isBusy: boolean;
    currentRideId: string | null;
  } | null;
  rideId?: string | null;
  environment: {
    isDev: boolean;
    isEmulator: boolean;
    timestamp: string;
  };
}

export function DebugPanel({ driverProfile, currentRideId, driverUid }: DebugPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [copied, setCopied] = useState(false);

  // Only show in dev mode or if debug panel enabled
  if (!featureFlags.enableDebugPanel) {
    return null;
  }

  useEffect(() => {
    if (isOpen) {
      fetchDebugInfo();
    }
  }, [isOpen, driverProfile, currentRideId]);

  const fetchDebugInfo = () => {
    setDebugInfo({
      userId: driverUid || 'Not authenticated',
      driverProfile: driverProfile ? {
        isOnline: driverProfile.isOnline || false,
        isBusy: driverProfile.isBusy || false,
        currentRideId: driverProfile.currentRideId || null,
      } : null,
      rideId: currentRideId || null,
      environment: {
        isDev: import.meta.env.DEV,
        isEmulator: !!import.meta.env.DEV,
        timestamp: new Date().toISOString(),
      },
    });
  };

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
        className="secondary-button"
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
            {debugInfo ? (
              <>
                <div className="mb-4">
                  <h4 className="font-bold text-purple-400 mb-2">Driver UID</h4>
                  <p className="text-gray-300 font-mono break-all">{debugInfo.userId}</p>
                </div>

                {debugInfo.driverProfile && (
                  <div className="mb-4">
                    <h4 className="font-bold text-purple-400 mb-2">Driver Profile</h4>
                    <div className="text-gray-300 space-y-1">
                      <p>Online: {debugInfo.driverProfile.isOnline ? 'Yes' : 'No'}</p>
                      <p>Busy: {debugInfo.driverProfile.isBusy ? 'Yes' : 'No'}</p>
                      {debugInfo.driverProfile.currentRideId && (
                        <p className="font-mono text-xs break-all">
                          Ride: {debugInfo.driverProfile.currentRideId}
                        </p>
                      )}
                    </div>
                  </div>
                )}

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
