import { useState, useEffect, useRef, useMemo } from 'react';
import { useToast } from './Toast';
import { httpsCallable } from 'firebase/functions';
import { functions, db, auth } from '../firebase';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { useMapEvents } from 'react-leaflet';
import { useRoutePolyline } from '../hooks/useRoutePolyline';
import { useReverseGeocode } from '../hooks/useReverseGeocode';
import { useNearbyDrivers, VehicleClass } from '../hooks/useNearbyDrivers';
import { useFareEstimate } from '../hooks/useFareEstimate';
import { SharedMap } from './map/SharedMap';
import { featureFlags } from '../config/featureFlags';
import { AddressAutocomplete } from './AddressAutocomplete';
import { ServiceCard } from './ServiceCard';
import { getBestEffortPosition } from '../utils/geolocation';
import { RebookPayload } from '../types/rebook';
import { RuntimeFlags } from '../utils/runtimeFlags';
import { MapShell } from '../layout/MapShell';
import 'leaflet/dist/leaflet.css';

interface LatLng {
  lat: number;
  lng: number;
}

interface SavedPlace {
  address: string;
  lat: number;
  lng: number;
}

interface RequestRideProps {
  onRideRequested: (rideId: string) => void;
  rebookPayload?: RebookPayload | null;
  onRebookConsumed?: () => void;
  userPhotoURL?: string | null;
  runtimeFlags: RuntimeFlags | null;
  onViewHistory?: () => void;
  onViewWallet?: () => void;
}

function MapClickHandler({ 
  activeField,
  onSetPickup, 
  onSetDropoff 
}: { 
  activeField: 'pickup' | 'dropoff';
  onSetPickup: (coords: LatLng) => void; 
  onSetDropoff: (coords: LatLng) => void; 
}) {
  useMapEvents({
    click: (e) => {
      const coords = { lat: e.latlng.lat, lng: e.latlng.lng };
      if (activeField === 'pickup') {
        onSetPickup(coords);
      } else {
        onSetDropoff(coords);
      }
    },
  });
  return null;
}

export function RequestRide({ onRideRequested, rebookPayload, onRebookConsumed, userPhotoURL, runtimeFlags, onViewHistory, onViewWallet }: RequestRideProps) {
  const { show } = useToast();
  const [loading, setLoading] = useState(false);
  const [pickup, setPickup] = useState<LatLng | null>(null);
  const [dropoff, setDropoff] = useState<LatLng | null>(null);
  const [pickupQuery, setPickupQuery] = useState('');
  const [dropoffQuery, setDropoffQuery] = useState('');
  const [activeField, setActiveField] = useState<'pickup' | 'dropoff'>('pickup');
  const [selectedService, setSelectedService] = useState<VehicleClass>('shiftx');
  const [metadata, setMetadata] = useState('');
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showDevTools, setShowDevTools] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locStatus, setLocStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [locMessage, setLocMessage] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<LatLng>({ lat: 38.8976, lng: -77.0369 }); // DC default
  const [homePlace, setHomePlace] = useState<SavedPlace | null>(null);
  const [workPlace, setWorkPlace] = useState<SavedPlace | null>(null);
  const [preferredDrivers, setPreferredDrivers] = useState<any[]>([]);
  const [selectedPreferredDriver, setSelectedPreferredDriver] = useState<string | null>(null);
  const [defaultPaymentSummary, setDefaultPaymentSummary] = useState<any>(null);

  // Track which coordinate updates came from map vs autocomplete
  const mapUpdateRef = useRef<'pickup' | 'dropoff' | null>(null);
  const rebookAppliedRef = useRef(false);
  const driverUnsubscribeRef = useRef<(() => void) | null>(null);

  // Load saved places and preferred drivers from Firestore
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const customerRef = doc(db, 'customers', user.uid);
    const unsubscribe = onSnapshot(customerRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setHomePlace(data.homePlace || null);
        setWorkPlace(data.workPlace || null);
        setDefaultPaymentSummary(data.defaultPaymentMethodSummary || null);
        
        // Load preferred driver if exists
        const preferredDriverId = data.preferredDriverId;
        
        // Clean up previous driver listener
        if (driverUnsubscribeRef.current) {
          driverUnsubscribeRef.current();
          driverUnsubscribeRef.current = null;
        }
        
        if (preferredDriverId) {
          try {
            // Subscribe to driver's real-time status
            const driverRef = doc(db, 'drivers', preferredDriverId);
            const driverUnsubscribe = onSnapshot(driverRef, async (driverSnap) => {
              if (driverSnap.exists()) {
                const driverData = driverSnap.data();
                
                // Get user email
                const userDoc = await getDoc(doc(db, 'users', preferredDriverId));
                const userData = userDoc.exists() ? userDoc.data() : null;
                
                setPreferredDrivers([{
                  id: preferredDriverId,
                  email: userData?.email || 'Unknown',
                  isOnline: driverData.isOnline || false,
                  vehicleClass: driverData.vehicleClass || 'shiftx',
                }]);
              } else {
                setPreferredDrivers([]);
              }
            }, (error) => {
              console.error('Failed to listen to preferred driver:', error);
              setPreferredDrivers([]);
            });
            
            driverUnsubscribeRef.current = driverUnsubscribe;
          } catch (error) {
            console.error('Failed to load preferred driver:', error);
            setPreferredDrivers([]);
          }
        } else {
          setPreferredDrivers([]);
        }
      }
    });

    return () => {
      unsubscribe();
      if (driverUnsubscribeRef.current) {
        driverUnsubscribeRef.current();
      }
    };
  }, []);

  // Route polyline (using shared hook)
  const { coords: routeLatLngs, loading: routeLoading, distanceMeters, durationSeconds, error: routeError } = useRoutePolyline(pickup, dropoff);
  
  // Reverse geocode pickup and dropoff
  const pickupGeocode = useReverseGeocode(pickup?.lat, pickup?.lng);
  const dropoffGeocode = useReverseGeocode(dropoff?.lat, dropoff?.lng);

  // Get nearby drivers and available services
  const { drivers, availableClasses, countsByClass } = useNearbyDrivers(pickup?.lat, pickup?.lng);

  // Calculate fare estimates for available services
  const shiftxEstimate = useFareEstimate('shiftx', distanceMeters, durationSeconds, drivers);
  const shiftLxEstimate = useFareEstimate('shift_lx', distanceMeters, durationSeconds, drivers);
  const shiftBlackEstimate = useFareEstimate('shift_black', distanceMeters, durationSeconds, drivers);
  
  // Sync query text from reverse geocoding when map is tapped
  useEffect(() => {
    if (mapUpdateRef.current === 'pickup' && pickupGeocode.label) {
      setPickupQuery(pickupGeocode.label);
      mapUpdateRef.current = null;
    }
  }, [pickupGeocode.label]);

  useEffect(() => {
    if (mapUpdateRef.current === 'dropoff' && dropoffGeocode.label) {
      setDropoffQuery(dropoffGeocode.label);
      mapUpdateRef.current = null;
    }
  }, [dropoffGeocode.label]);
  
  // Process rebook payload ONCE on mount
  useEffect(() => {
    if (rebookPayload && !rebookAppliedRef.current) {
      rebookAppliedRef.current = true;
      
      // Set pickup
      setPickup(rebookPayload.pickup);
      setPickupQuery(rebookPayload.pickup.label || ''); // Will be filled by reverse geocode if empty
      
      // Set dropoff
      setDropoff(rebookPayload.dropoff);
      setDropoffQuery(rebookPayload.dropoff.label || ''); // Will be filled by reverse geocode if empty
      
      // Set service class if provided
      if (rebookPayload.serviceClass) {
        setSelectedService(rebookPayload.serviceClass);
      }
      
      // Ensure immediate mode (not scheduled)
      setIsScheduled(false);
      
      // Center map to show both points
      if (rebookPayload.pickup && rebookPayload.dropoff) {
        setMapCenter(rebookPayload.pickup);
      }
      
      // Notify parent to clear the payload (prevent re-applying on next mount)
      if (onRebookConsumed) {
        onRebookConsumed();
      }
      
      // Show toast
      show('Trip loaded — confirm and request when ready.', 'info');
    }
  }, [rebookPayload, onRebookConsumed, show]);
  
  // Update input text when coords change (from rebook or map)
  // This runs when reverse geocode completes after rebook or map click
  useEffect(() => {
    if (pickup && pickupGeocode.label && (!pickupQuery || pickupQuery === '')) {
      setPickupQuery(pickupGeocode.label);
    }
  }, [pickup, pickupGeocode.label, pickupQuery]);
  
  useEffect(() => {
    if (dropoff && dropoffGeocode.label && (!dropoffQuery || dropoffQuery === '')) {
      setDropoffQuery(dropoffGeocode.label);
    }
  }, [dropoff, dropoffGeocode.label, dropoffQuery]);
  
  // Initial load: center map on cached location and try to get fresh position
  useEffect(() => {
    // Skip initial load if rebooking (rebook will set pickup)
    if (rebookPayload) {
      return;
    }
    
    // Center instantly from cache if available
    const cached = localStorage.getItem('shiftx:lastLocation');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        const coords = { lat: parsed.lat, lng: parsed.lng };
        setPickup(coords);
        setMapCenter(coords);
        mapUpdateRef.current = 'pickup';
      } catch {
        // ignore
      }
    }

    // Then try to get fresh location in background
    (async () => {
      setLocStatus('loading');
      const res = await getBestEffortPosition();

      if (res.coords) {
        // Only update if we don't have pickup already, or if this is better than cache
        if (!pickup || res.source !== 'cache') {
          setPickup(res.coords);
          setMapCenter(res.coords);
          mapUpdateRef.current = 'pickup';
        }
        setLocStatus('ok');
        setLocMessage(null);
      } else {
        setLocStatus('idle'); // Don't show error on initial load
        setLocMessage(null);
      }
    })();
  }, []);
  
  // Update map center when pickup is set (and no dropoff yet)
  useEffect(() => {
    if (pickup && !dropoff) {
      setMapCenter(pickup);
    }
  }, [pickup, dropoff]);
  
  // Compute stable route key for fitBounds
  const routeKey = useMemo(() => {
    if (!pickup || !dropoff) return '';
    return `${pickup.lat},${pickup.lng}-${dropoff.lat},${dropoff.lng}`;
  }, [pickup, dropoff]);

  // Handlers for map tap (called from MapClickHandler)
  const handleMapSetPickup = (coords: LatLng) => {
    setPickup(coords);
    mapUpdateRef.current = 'pickup';
    setActiveField('dropoff');
  };

  const handleMapSetDropoff = (coords: LatLng) => {
    setDropoff(coords);
    mapUpdateRef.current = 'dropoff';
  };

  // Handlers for autocomplete selection
  const handlePickupSelect = (place: { label: string; lat: number; lng: number }) => {
    setPickup({ lat: place.lat, lng: place.lng });
    setPickupQuery(place.label);
    setActiveField('dropoff');
  };

  const handleDropoffSelect = (place: { label: string; lat: number; lng: number }) => {
    setDropoff({ lat: place.lat, lng: place.lng });
    setDropoffQuery(place.label);
  };

  const handleUseDemoCoordinates = () => {
    // DC area coordinates (pickup: near Union Station, dropoff: near Georgetown)
    const demoPickup = { lat: 38.8976, lng: -77.0369 };
    const demoDropoff = { lat: 38.9072, lng: -77.0589 };
    setPickup(demoPickup);
    setDropoff(demoDropoff);
    setPickupQuery('Union Station, Washington, DC');
    setDropoffQuery('Georgetown, Washington, DC');
  };

  const handleUseMyLocation = async () => {
    setLocationLoading(true);
    setLocStatus('loading');
    setLocMessage('Getting your location...');
    
    const res = await getBestEffortPosition();

    if (res.coords) {
      setPickup(res.coords);
      setMapCenter(res.coords);
      setPickupQuery(''); // Clear query so reverse geocoding can populate
      setActiveField('dropoff');
      mapUpdateRef.current = 'pickup';
      setLocationLoading(false);
      setLocStatus('ok');
      setLocMessage(null);
      show('Location set! Now select your destination.', 'success');
    } else {
      setLocationLoading(false);
      setLocStatus('error');
      if (res.error?.code === 1) {
        setLocMessage('Location blocked. Enable it in browser settings to use "My Location".');
        show('Location permission denied. Please enable location access in your browser settings.', 'error');
      } else {
        setLocMessage('Couldn\'t get GPS. Using last known/default location.');
        show('Unable to get location. Please try again or select manually on the map.', 'error');
      }
    }
  };

  const handleClear = () => {
    setPickup(null);
    setDropoff(null);
    setPickupQuery('');
    setDropoffQuery('');
    setActiveField('pickup');
  };

  const handleSwap = () => {
    if (pickup && dropoff) {
      setPickup(dropoff);
      setDropoff(pickup);
      const tempQuery = pickupQuery;
      setPickupQuery(dropoffQuery);
      setDropoffQuery(tempQuery);
    }
  };

  const formatTripPreview = (distMeters?: number, durationSecs?: number): string => {
    if (!distMeters || !durationSecs) return '';
    const miles = (distMeters / 1609.34).toFixed(1);
    const minutes = Math.max(1, Math.round(durationSecs / 60));
    return `${miles} mi • ~${minutes} min`;
  };

  const handleRequestRide = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check runtime flags
    if (runtimeFlags?.disableNewRequests) {
      show('New ride requests are temporarily disabled', 'warning');
      return;
    }

    // Validation
    if (!pickup || !dropoff) {
      show('Please set pickup and dropoff locations on the map', 'error');
      return;
    }

    // Check if selected service has drivers available
    const hasDrivers = countsByClass[selectedService] > 0;
    if (!hasDrivers) {
      show(`No ${selectedService === 'shiftx' ? 'ShiftX' : selectedService === 'shift_lx' ? 'Shift LX' : 'Shift Black'} drivers available in your area`, 'error');
      return;
    }

    setLoading(true);
    try {
      // Get the appropriate estimate based on selected service
      let priceCents = 2500; // fallback
      if (selectedService === 'shiftx') {
        priceCents = shiftxEstimate.estimatedCents || 2500;
      } else if (selectedService === 'shift_lx') {
        priceCents = shiftLxEstimate.estimatedCents || 3500;
      } else if (selectedService === 'shift_black') {
        priceCents = shiftBlackEstimate.estimatedCents || 5000;
      }

      const payload: any = {
        pickup,
        dropoff,
        vehicleClass: selectedService,
        priceCents,
        ...(metadata && { metadata: JSON.parse(metadata) }),
      };

      let rideId: string;

      if (isScheduled) {
        if (!scheduledDate || !scheduledTime) {
          show('Please select a date and time for scheduled ride', 'error');
          setLoading(false);
          return;
        }

        const scheduledForMs = new Date(`${scheduledDate}T${scheduledTime}`).getTime();
        
        if (scheduledForMs < Date.now()) {
          show('Scheduled time must be in the future', 'error');
          setLoading(false);
          return;
        }

        const scheduleRideFn = httpsCallable(functions, 'scheduleRide');
        const result = await scheduleRideFn({ ...payload, scheduledForMs });
        rideId = (result.data as any).rideId;
        show(`Ride scheduled for ${new Date(scheduledForMs).toLocaleString()}`, 'success');
      } else {
        const tripRequestFn = httpsCallable(functions, 'tripRequest');
        const result = await tripRequestFn(payload);
        rideId = (result.data as any).rideId;
        show(`Ride requested! ID: ${rideId}`, 'success');
      }

      localStorage.setItem('rideId', rideId);
      onRideRequested(rideId);
    } catch (error) {
      const err = error as { message: string };
      show(`Failed to ${isScheduled ? 'schedule' : 'request'} ride: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <MapShell
      defaultSnap="mid"
      map={
        <SharedMap
          pickup={pickup}
          dropoff={dropoff}
          center={mapCenter}
          drivers={drivers.map(d => ({ id: d.id, location: d.location! })).filter(d => d.location)}
          routeCoords={routeLatLngs}
          shouldFit={true}
          fitKey={routeKey}
        >
          <MapClickHandler 
            activeField={activeField}
            onSetPickup={handleMapSetPickup}
            onSetDropoff={handleMapSetDropoff}
          />
        </SharedMap>
      }
      panel={
    <div style={{ padding: '1.5rem' }}>
      <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Request a Ride</h2>
        
        {/* Use My Location Button */}
        <button
          type="button"
          onClick={handleUseMyLocation}
          disabled={locationLoading}
          style={{
            width: '100%',
            marginBottom: '1rem',
            padding: '12px 16px',
            backgroundColor: locationLoading ? 'rgba(0, 255, 140, 0.05)' : 'rgba(0, 255, 140, 0.1)',
            border: '1px solid rgba(0, 255, 140, 0.3)',
            color: 'rgba(0,255,140,0.95)',
            borderRadius: '8px',
            fontSize: '0.95rem',
            fontWeight: '500',
            cursor: locationLoading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            opacity: locationLoading ? 0.6 : 1,
          }}
          onMouseEnter={(e) => {
            if (!locationLoading) {
              e.currentTarget.style.backgroundColor = 'rgba(0, 255, 140, 0.2)';
            }
          }}
          onMouseLeave={(e) => {
            if (!locationLoading) {
              e.currentTarget.style.backgroundColor = 'rgba(0, 255, 140, 0.1)';
            }
          }}
        >
          {locationLoading ? '⏳ Getting location...' : '📍 Use My Location'}
        </button>

        {/* Location status message */}
        {locMessage && (
          <div style={{ 
            marginTop: '-0.5rem',
            marginBottom: '1rem',
            padding: '8px 12px',
            fontSize: '0.8rem', 
            opacity: 0.85,
            color: locStatus === 'error' ? 'rgba(255,100,100,0.9)' : 'rgba(255,255,255,0.7)',
            backgroundColor: locStatus === 'error' ? 'rgba(255,100,100,0.1)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${locStatus === 'error' ? 'rgba(255,100,100,0.3)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: '6px',
          }}>
            {locMessage}
          </div>
        )}

        {/* Dev Tools Accordion */}
        {featureFlags.enableDevTools && (
          <div style={{ marginBottom: '1rem' }}>
            <button
              type="button"
              onClick={() => setShowDevTools(!showDevTools)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255,255,255,0.5)',
                cursor: 'pointer',
                fontSize: '0.8rem',
                padding: 0,
                textDecoration: 'underline',
              }}
            >
              {showDevTools ? '▼' : '▶'} Dev Tools
            </button>
            {showDevTools && (
            <button
              type="button"
              onClick={handleUseDemoCoordinates}
              style={{
                width: '100%',
                marginTop: '0.5rem',
                padding: '8px 12px',
                backgroundColor: 'rgba(100,100,150,0.2)',
                border: '1px solid rgba(100,100,150,0.3)',
                color: 'rgba(255,255,255,0.6)',
                borderRadius: '6px',
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              Use Demo Coordinates (DC Area)
            </button>
            )}
          </div>
        )}

        <form onSubmit={handleRequestRide}>
          {/* Ride Type Toggle */}
          <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="radio"
                checked={!isScheduled}
                onChange={() => setIsScheduled(false)}
                style={{ marginRight: '0.5rem' }}
              />
              Immediate
            </label>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="radio"
                checked={isScheduled}
                onChange={() => setIsScheduled(true)}
                style={{ marginRight: '0.5rem' }}
              />
              Scheduled
            </label>
          </div>

          {/* Location Inputs with Autocomplete - From/To Panel */}
          <div style={{ 
            marginBottom: '1rem', 
            padding: '1.25rem', 
            background: 'rgba(255,255,255,0.05)', 
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '10px' 
          }}>
            <div style={{ marginBottom: '0.25rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              From
            </div>
            <div style={{ marginBottom: '1.25rem' }}>
              <AddressAutocomplete
                label=""
                value={pickupQuery}
                onChange={setPickupQuery}
                onSelect={handlePickupSelect}
                onFocus={() => setActiveField('pickup')}
                placeholder="Pickup location..."
              />
              {pickup && pickupGeocode.loading && (
                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.25rem', fontStyle: 'italic' }}>
                  ✓ Resolving address...
                </div>
              )}
            </div>

            <div style={{ marginBottom: '0.25rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              To
            </div>
            <div style={{ marginBottom: '1.25rem' }}>
              <AddressAutocomplete
                label=""
                value={dropoffQuery}
                onChange={setDropoffQuery}
                onSelect={handleDropoffSelect}
                onFocus={() => setActiveField('dropoff')}
                placeholder="Dropoff location..."
              />
              {dropoff && dropoffGeocode.loading && (
                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.25rem', fontStyle: 'italic' }}>
                  ✓ Resolving address...
                </div>
              )}
            </div>

            {/* Trip Preview (Distance + ETA) */}
            {pickup && dropoff && (
              <div style={{ 
                marginBottom: '1rem',
                padding: '0.75rem',
                background: 'rgba(0,255,140,0.08)',
                borderRadius: '6px',
                fontSize: '0.85rem',
                color: 'rgba(0,255,140,0.95)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                {routeLoading ? (
                  <span>Calculating route...</span>
                ) : distanceMeters && durationSeconds ? (
                  <span>📏 {formatTripPreview(distanceMeters, durationSeconds)}</span>
                ) : (
                  <span>Route calculating...</span>
                )}
              </div>
            )}

            {/* Clear & Swap Buttons */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={handleClear}
                disabled={!pickup && !dropoff}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  fontSize: '0.8rem',
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#fff',
                  borderRadius: '6px',
                  cursor: !pickup && !dropoff ? 'not-allowed' : 'pointer',
                  opacity: !pickup && !dropoff ? 0.5 : 1,
                  transition: 'all 0.2s ease',
                }}
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleSwap}
                disabled={!pickup || !dropoff}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  fontSize: '0.8rem',
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#fff',
                  borderRadius: '6px',
                  cursor: !pickup || !dropoff ? 'not-allowed' : 'pointer',
                  opacity: !pickup || !dropoff ? 0.5 : 1,
                  transition: 'all 0.2s ease',
                }}
              >
                ⇄ Swap
              </button>
            </div>
          </div>

          {/* Quick Actions for Saved Places */}
          {(homePlace || workPlace) && (
            <div style={{
              marginBottom: '1rem',
              padding: '1rem',
              background: 'rgba(96,165,250,0.08)',
              border: '1px solid rgba(96,165,250,0.2)',
              borderRadius: '10px',
            }}>
              <div style={{ marginBottom: '0.5rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Quick Actions
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {homePlace && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setPickup({ lat: homePlace.lat, lng: homePlace.lng });
                        setPickupQuery(homePlace.address);
                        setActiveField('dropoff');
                        show('Pickup set to Home', 'success');
                      }}
                      style={{
                        padding: '8px 12px',
                        fontSize: '0.85rem',
                        backgroundColor: 'rgba(96,165,250,0.2)',
                        border: '1px solid rgba(96,165,250,0.3)',
                        color: '#60a5fa',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: '600',
                      }}
                    >
                      🏠 From Home
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDropoff({ lat: homePlace.lat, lng: homePlace.lng });
                        setDropoffQuery(homePlace.address);
                        show('Dropoff set to Home', 'success');
                      }}
                      style={{
                        padding: '8px 12px',
                        fontSize: '0.85rem',
                        backgroundColor: 'rgba(96,165,250,0.2)',
                        border: '1px solid rgba(96,165,250,0.3)',
                        color: '#60a5fa',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: '600',
                      }}
                    >
                      🏠 To Home
                    </button>
                  </>
                )}
                {workPlace && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setPickup({ lat: workPlace.lat, lng: workPlace.lng });
                        setPickupQuery(workPlace.address);
                        setActiveField('dropoff');
                        show('Pickup set to Work', 'success');
                      }}
                      style={{
                        padding: '8px 12px',
                        fontSize: '0.85rem',
                        backgroundColor: 'rgba(96,165,250,0.2)',
                        border: '1px solid rgba(96,165,250,0.3)',
                        color: '#60a5fa',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: '600',
                      }}
                    >
                      💼 From Work
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDropoff({ lat: workPlace.lat, lng: workPlace.lng });
                        setDropoffQuery(workPlace.address);
                        show('Dropoff set to Work', 'success');
                      }}
                      style={{
                        padding: '8px 12px',
                        fontSize: '0.85rem',
                        backgroundColor: 'rgba(96,165,250,0.2)',
                        border: '1px solid rgba(96,165,250,0.3)',
                        color: '#60a5fa',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: '600',
                      }}
                    >
                      💼 To Work
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Route Status */}
          {pickup && dropoff && routeLoading && (
            <div style={{ 
              fontSize: '0.85rem', 
              color: 'rgba(255,255,255,0.5)', 
              marginTop: '0.5rem',
              marginBottom: '1rem',
              textAlign: 'center'
            }}>
              Calculating route…
            </div>
          )}
          {pickup && dropoff && routeError && (
            <div style={{ 
              fontSize: '0.85rem', 
              color: 'rgba(255,100,100,0.8)', 
              marginTop: '0.5rem',
              marginBottom: '1rem',
              textAlign: 'center'
            }}>
              Route unavailable
            </div>
          )}

          {/* Service Cards */}
          {pickup && dropoff && (
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.75rem', fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>
                Choose a Service
              </label>
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                <ServiceCard
                  vehicleClass="shiftx"
                  fareEstimate={shiftxEstimate}
                  selected={selectedService === 'shiftx'}
                  available={availableClasses.includes('shiftx')}
                  onSelect={setSelectedService}
                />
                <ServiceCard
                  vehicleClass="shift_lx"
                  fareEstimate={shiftLxEstimate}
                  selected={selectedService === 'shift_lx'}
                  available={availableClasses.includes('shift_lx')}
                  onSelect={setSelectedService}
                />
                <ServiceCard
                  vehicleClass="shift_black"
                  fareEstimate={shiftBlackEstimate}
                  selected={selectedService === 'shift_black'}
                  available={availableClasses.includes('shift_black')}
                  onSelect={setSelectedService}
                />
              </div>
              {pickup && dropoff && availableClasses.length === 0 && (
                <div style={{
                  marginTop: '0.75rem',
                  padding: '12px',
                  backgroundColor: 'rgba(255,150,100,0.1)',
                  border: '1px solid rgba(255,150,100,0.3)',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  color: 'rgba(255,150,100,0.9)',
                  textAlign: 'center'
                }}>
                  No drivers available in your area. Please try again later.
                </div>
              )}
            </div>
          )}

          {/* Preferred Driver Section */}
          <div style={{ marginBottom: '1rem', marginTop: '1rem' }}>
            <h4 style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)', marginBottom: '0.75rem', fontWeight: '500' }}>
              ⭐ Preferred Drivers
            </h4>
            {preferredDrivers.length === 0 ? (
              <div style={{
                padding: '1rem',
                backgroundColor: 'rgba(255,255,255,0.03)',
                border: '1px dashed rgba(255,255,255,0.2)',
                borderRadius: '8px',
                textAlign: 'center',
                fontSize: '0.85rem',
                color: 'rgba(255,255,255,0.5)',
              }}>
                No preferred drivers yet. Complete a trip and set a driver as preferred from the receipt.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {preferredDrivers.map((driver) => (
                  <div
                    key={driver.id}
                    onClick={() => {
                      if (driver.isOnline) {
                        setSelectedPreferredDriver(selectedPreferredDriver === driver.id ? null : driver.id);
                      }
                    }}
                    style={{
                      padding: '0.75rem',
                      backgroundColor: selectedPreferredDriver === driver.id ? 'rgba(0,255,140,0.1)' : 'rgba(255,255,255,0.03)',
                      border: selectedPreferredDriver === driver.id ? '2px solid rgba(0,255,140,0.5)' : '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      cursor: driver.isOnline ? 'pointer' : 'not-allowed',
                      opacity: driver.isOnline ? 1 : 0.5,
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '0.9rem', color: '#fff', marginBottom: '4px' }}>
                          {driver.email}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                          {driver.vehicleClass.replace('_', ' ').toUpperCase()}
                        </div>
                      </div>
                      <div style={{
                        fontSize: '0.75rem',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        backgroundColor: driver.isOnline ? 'rgba(0,255,140,0.2)' : 'rgba(255,255,255,0.1)',
                        color: driver.isOnline ? 'rgba(0,255,140,0.95)' : 'rgba(255,255,255,0.5)',
                      }}>
                        {driver.isOnline ? '● Online' : '○ Offline'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {selectedPreferredDriver && (
              <div style={{
                marginTop: '0.5rem',
                padding: '8px',
                backgroundColor: 'rgba(0,255,140,0.05)',
                border: '1px solid rgba(0,255,140,0.2)',
                borderRadius: '6px',
                fontSize: '0.75rem',
                color: 'rgba(0,255,140,0.95)',
                textAlign: 'center'
              }}>
                ✓ Request will be sent to your preferred driver
              </div>
            )}
          </div>

          {/* Scheduled Ride Fields */}
          {isScheduled && (
            <>
              <div className="form-group">
                <label>Scheduled Date</label>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  required={isScheduled}
                />
              </div>
              <div className="form-group">
                <label>Scheduled Time</label>
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  required={isScheduled}
                />
              </div>
              <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginTop: '-0.5rem', marginBottom: '1rem' }}>
                Requires a preferred driver with available hours
              </p>
            </>
          )}

          {/* Advanced Section */}
          {featureFlags.enableDevTools && (
            <div style={{ marginBottom: '1rem' }}>
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255,255,255,0.6)',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  padding: 0,
                  textDecoration: 'underline',
                }}
              >
                {showAdvanced ? '▼' : '▶'} Advanced (Metadata)
              </button>
              {showAdvanced && (
                <div className="form-group" style={{ marginTop: '0.5rem' }}>
                  <label>Metadata (JSON)</label>
                  <textarea
                    placeholder='e.g., {"notes": "Handle with care"}'
                    value={metadata}
                    onChange={(e) => setMetadata(e.target.value)}
                    style={{ minHeight: '80px' }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Photo Upload Required Banner */}
          {!userPhotoURL && (
            <div style={{
              marginTop: '1.5rem',
              padding: '1rem',
              backgroundColor: 'rgba(239,68,68,0.1)',
              border: '2px solid rgba(239,68,68,0.3)',
              borderRadius: '10px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📸</div>
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#ef4444', fontSize: '1rem' }}>
                Profile Photo Required
              </h3>
              <p style={{ margin: '0', fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>
                Please upload a profile photo before requesting a ride. Click your profile icon in the top right corner.
              </p>
            </div>
          )}

          {/* Payment Method Banner */}
          {defaultPaymentSummary ? (
            <div style={{
              marginTop: '1rem',
              padding: '12px 16px',
              background: 'rgba(0,255,140,0.1)',
              border: '1px solid rgba(0,255,140,0.3)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.2rem' }}>💳</span>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#fff' }}>
                    {defaultPaymentSummary.brand?.toUpperCase()} •••• {defaultPaymentSummary.last4}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>
                    Payment ready
                  </div>
                </div>
              </div>
              <div style={{
                padding: '4px 8px',
                background: 'rgba(0,255,140,0.2)',
                borderRadius: '4px',
                fontSize: '0.7rem',
                fontWeight: '600',
                color: 'rgba(0,255,140,0.95)',
              }}>
                ✓ SAVED
              </div>
            </div>
          ) : (
            <div style={{
              marginTop: '1rem',
              padding: '12px 16px',
              background: 'rgba(255,165,0,0.1)',
              border: '1px solid rgba(255,165,0,0.3)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <span style={{ fontSize: '1.2rem' }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#fff' }}>
                  No payment method saved
                </div>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>
                  Add a card in Wallet for faster checkout
                </div>
              </div>
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading || !pickup || !dropoff || routeLoading || !availableClasses.includes(selectedService) || !userPhotoURL || runtimeFlags?.disableNewRequests}
            style={{
              width: '100%',
              padding: '16px 20px',
              marginTop: '1.5rem',
              background: (loading || !pickup || !dropoff || routeLoading || !availableClasses.includes(selectedService) || !userPhotoURL || runtimeFlags?.disableNewRequests) ? '#666' : 'linear-gradient(135deg, rgba(0,255,140,0.95) 0%, rgba(0,200,120,0.9) 100%)',
              color: '#000',
              border: 'none',
              borderRadius: '10px',
              fontSize: '1.05rem',
              fontWeight: '700',
              letterSpacing: '0.5px',
              cursor: (loading || !pickup || !dropoff || routeLoading || !availableClasses.includes(selectedService) || !userPhotoURL || runtimeFlags?.disableNewRequests) ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: (loading || !pickup || !dropoff || routeLoading || !availableClasses.includes(selectedService) || !userPhotoURL || runtimeFlags?.disableNewRequests) ? 'none' : '0 4px 12px rgba(0,255,140,0.3)',
              opacity: (loading || !pickup || !dropoff || routeLoading || !availableClasses.includes(selectedService) || !userPhotoURL || runtimeFlags?.disableNewRequests) ? 0.6 : 1,
            }}
            onMouseEnter={(e) => {
              if (!loading && pickup && dropoff && !routeLoading && availableClasses.includes(selectedService) && userPhotoURL && !runtimeFlags?.disableNewRequests) {
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,255,140,0.5)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,255,140,0.3)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {loading ? (isScheduled ? 'Scheduling...' : 'Requesting...') : routeLoading ? 'Calculating route...' : !userPhotoURL ? 'Photo Required' : runtimeFlags?.disableNewRequests ? 'Disabled' : (isScheduled ? 'Schedule Ride' : 'Request Ride')}
          </button>

          {/* Quick Actions */}
          {(onViewHistory || onViewWallet) && (
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem' }}>
              {onViewHistory && (
                <button
                  onClick={onViewHistory}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: 'white',
                    padding: '0.75rem 1rem',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                  }}
                >
                  📋 History
                </button>
              )}
              {onViewWallet && (
                <button
                  onClick={onViewWallet}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: 'white',
                    padding: '0.75rem 1rem',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                  }}
                >
                  💳 Wallet
                </button>
              )}
            </div>
          )}
        </form>
      </div>
      }
    />
  );
}
