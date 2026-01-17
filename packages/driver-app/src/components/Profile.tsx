import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { doc, updateDoc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { getInitializedClient } from '@shiftx/driver-client';
import { useToast } from './Toast';
import { centsToDollars, parseDollarsToCents } from '../utils/money';
import { ProfilePhotoUpload } from './ProfilePhotoUpload';
import { StripeConnect } from './StripeConnect';
import { RuntimeFlags } from '../utils/runtimeFlags';

interface ProfileProps {
  driverId: string;
  onboardingStatus: string;
  runtimeFlags: RuntimeFlags | null;
}

export function Profile({ driverId, onboardingStatus, runtimeFlags }: ProfileProps) {
  const { show } = useToast();
  
  // Vehicle class and rates state (strings for UI, cents for storage)
  const [vehicleClass, setVehicleClass] = useState<'shiftx' | 'shift_lx' | 'shift_black'>('shiftx');
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>('');
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [vehicleInfo, setVehicleInfo] = useState({
    make: '',
    model: '',
    color: '',
    plate: '',
  });
  const [ratesInput, setRatesInput] = useState({
    shiftx: { baseFare: '3.00', perMile: '2.00', perMinute: '0.50', minFare: '5.00' },
    shift_lx: { baseFare: '5.00', perMile: '2.80', perMinute: '0.70', minFare: '7.50' },
    shift_black: { baseFare: '9.00', perMile: '4.00', perMinute: '1.00', minFare: '12.00' },
  });
  const [saving, setSaving] = useState(false);
  
  // Subscribe to driver profile for photoURL updates
  useEffect(() => {
    const { firestore } = getInitializedClient();
    const docRef = doc(firestore, 'drivers', driverId);
    
    const unsubscribe = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setPhotoURL(data.photoURL || null);
      }
    });

    return () => unsubscribe();
  }, [driverId]);
  
  // Subscribe to user profile for displayName
  useEffect(() => {
    const { firestore } = getInitializedClient();
    const userDocRef = doc(firestore, 'users', driverId);
    
    const unsubscribe = onSnapshot(userDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setDisplayName(data.displayName || '');
      }
    });

    return () => unsubscribe();
  }, [driverId]);
  
  const handleSaveDisplayName = async () => {
    if (!displayName.trim()) return;
    
    setSavingName(true);
    try {
      const { firestore } = getInitializedClient();
      await updateDoc(doc(firestore, 'users', driverId), {
        displayName: displayName.trim(),
      });
      setEditingName(false);
      show('Name updated successfully', 'success');
    } catch (error) {
      console.error('[Profile] Error saving display name:', error);
      show('Failed to save name', 'error');
    } finally {
      setSavingName(false);
    }
  };
  
  // Load existing profile data
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { firestore } = getInitializedClient();
        const docRef = doc(firestore, 'drivers', driverId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.vehicleClass) setVehicleClass(data.vehicleClass);
          if (data.vehicleInfo) {
            setVehicleInfo({
              make: data.vehicleInfo.make || '',
              model: data.vehicleInfo.model || '',
              color: data.vehicleInfo.color || '',
              plate: data.vehicleInfo.plate || '',
            });
          }
          if (data.rates) {
            // Convert cents to dollars for display
            const newRatesInput: any = {};
            for (const [serviceClass, rate] of Object.entries(data.rates)) {
              const r = rate as any;
              // Support both old format (baseCents) and new format (baseFareCents)
              newRatesInput[serviceClass] = {
                baseFare: centsToDollars(r.baseFareCents || r.baseCents || 0),
                perMile: centsToDollars(r.perMileCents || 0),
                perMinute: centsToDollars(r.perMinuteCents || 0),
                minFare: centsToDollars(r.minimumFareCents || r.minFareCents || 0),
              };
            }
            setRatesInput(prev => ({ ...prev, ...newRatesInput }));
          }
        } else {
          // Create default profile
          await setDoc(docRef, { createdAtMs: Date.now() }, { merge: true });
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      }
    };
    loadProfile();
  }, [driverId]);
  
  // Save vehicle class and rates
  const handleSaveRates = async () => {
    setSaving(true);
    try {
      const { firestore } = getInitializedClient();
      const docRef = doc(firestore, 'drivers', driverId);
      
      // Validate vehicle info (all fields required)
      if (!vehicleInfo.make || !vehicleInfo.model || !vehicleInfo.color || !vehicleInfo.plate) {
        show('Please fill in all vehicle information fields', 'error');
        setSaving(false);
        return;
      }
      
      // Convert dollar strings to cents and validate
      const rates: any = {};
      for (const serviceClass of allowedClasses) {
        const input = ratesInput[serviceClass as 'shiftx' | 'shift_lx' | 'shift_black'];
        const baseFareCents = parseDollarsToCents(input.baseFare);
        const perMileCents = parseDollarsToCents(input.perMile);
        const perMinuteCents = parseDollarsToCents(input.perMinute);
        const minimumFareCents = parseDollarsToCents(input.minFare);
        
        if ([baseFareCents, perMileCents, perMinuteCents, minimumFareCents].some(v => v === null)) {
          show('Invalid rate values. Please enter valid dollar amounts.', 'error');
          setSaving(false);
          return;
        }
        
        // Use customer-expected field names
        rates[serviceClass] = { baseFareCents, perMileCents, perMinuteCents, minimumFareCents };
      }
      
      await setDoc(docRef, {
        vehicleClass,
        vehicleInfo: {
          make: vehicleInfo.make,
          model: vehicleInfo.model,
          color: vehicleInfo.color,
          plate: vehicleInfo.plate,
        },
        rates,
        updatedAtMs: Date.now(),
      }, { merge: true });
      
      show('Vehicle and rates updated successfully', 'success');
    } catch (error) {
      console.error('Error saving rates:', error);
      show('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };
  
  // Update rate value (keep as string for UI)
  const updateRateInput = (service: 'shiftx' | 'shift_lx' | 'shift_black', field: string, value: string) => {
    setRatesInput(prev => ({
      ...prev,
      [service]: { ...prev[service], [field]: value }
    }));
  };
  
  // Determine which service classes this driver can configure
  const allowedClasses = vehicleClass === 'shift_black' 
    ? ['shiftx', 'shift_lx', 'shift_black']
    : vehicleClass === 'shift_lx'
    ? ['shiftx', 'shift_lx']
    : ['shiftx'];
  
  // Driver invite URL points to customer app
  const customerAppUrl = import.meta.env.DEV 
    ? 'http://localhost:5173'
    : 'https://shiftx-95c4b-customer.web.app';
  const inviteUrl = `${customerAppUrl}?driverId=${driverId}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    show('Invite link copied to clipboard', 'success');
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Become my preferred customer',
          text: 'Set me as your preferred driver',
          url: inviteUrl,
        });
        show('Shared successfully', 'success');
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          show('Share failed', 'error');
        }
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <div className="driver-home" style={{ 
      paddingTop: 'calc(16px + var(--sat))',
      paddingBottom: 'calc(80px + var(--sab))',
      paddingLeft: 'calc(16px + var(--sal))',
      paddingRight: 'calc(16px + var(--sar))',
    }}>
      <h2>👤 Driver Profile</h2>
      
      {/* Profile Photo Upload */}
      <div className="test-section">
        <h3>📸 Profile Photo</h3>
        <ProfilePhotoUpload
          currentPhotoURL={photoURL || undefined}
          userId={driverId}
          onPhotoUploaded={(url) => setPhotoURL(url)}
        />
        <p style={{ 
          marginTop: '1rem', 
          fontSize: '0.85rem', 
          color: 'rgba(255,255,255,0.6)',
          textAlign: 'center'
        }}>
          {photoURL ? '✅ Photo uploaded - You can go online' : '⚠️ Photo required to go online'}
        </p>
      </div>
      
      {/* Vehicle & Rates Settings */}
      <div className="test-section">
        <h3>🚗 Vehicle & Rates</h3>
        
        {/* Vehicle Class Selector */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'rgba(255,255,255,0.8)' }}>
            Vehicle Class
          </label>
          <select
            value={vehicleClass}
            onChange={(e) => setVehicleClass(e.target.value as any)}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '0.95rem',
            }}
          >
            <option value="shiftx">🚗 ShiftX (Standard)</option>
            <option value="shift_lx">🚙 Shift LX (SUV/Premium)</option>
            <option value="shift_black">🚕 Shift Black (Luxury)</option>
          </select>
          <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.5rem' }}>
            {vehicleClass === 'shift_black' && 'Can offer all three service levels'}
            {vehicleClass === 'shift_lx' && 'Can offer ShiftX and Shift LX'}
            {vehicleClass === 'shiftx' && 'Can offer ShiftX only'}
          </p>
        </div>

        {/* Vehicle Information */}
        <div style={{
          marginBottom: '1.5rem',
          padding: '1rem',
          backgroundColor: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px',
        }}>
          <h4 style={{ marginBottom: '1rem', color: 'rgba(255,255,255,0.9)' }}>Vehicle Details</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: '4px' }}>
                Make *
              </label>
              <input
                type="text"
                value={vehicleInfo.make}
                onChange={(e) => setVehicleInfo(prev => ({ ...prev, make: e.target.value }))}
                placeholder="e.g. Toyota"
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '0.9rem',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: '4px' }}>
                Model *
              </label>
              <input
                type="text"
                value={vehicleInfo.model}
                onChange={(e) => setVehicleInfo(prev => ({ ...prev, model: e.target.value }))}
                placeholder="e.g. Camry"
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '0.9rem',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: '4px' }}>
                Color *
              </label>
              <input
                type="text"
                value={vehicleInfo.color}
                onChange={(e) => setVehicleInfo(prev => ({ ...prev, color: e.target.value }))}
                placeholder="e.g. Silver"
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '0.9rem',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: '4px' }}>
                License Plate *
              </label>
              <input
                type="text"
                value={vehicleInfo.plate}
                onChange={(e) => setVehicleInfo(prev => ({ ...prev, plate: e.target.value.toUpperCase() }))}
                placeholder="e.g. ABC1234"
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '0.9rem',
                  textTransform: 'uppercase',
                }}
              />
            </div>
          </div>
        </div>

        {/* Rate Cards */}
        {allowedClasses.map((serviceClass) => (
          <div
            key={serviceClass}
            style={{
              marginBottom: '1.5rem',
              padding: '1rem',
              backgroundColor: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
            }}
          >
            <h4 style={{ marginBottom: '1rem', color: 'rgba(255,255,255,0.9)' }}>
              {serviceClass === 'shiftx' && '🚗 ShiftX Rates'}
              {serviceClass === 'shift_lx' && '🚙 Shift LX Rates'}
              {serviceClass === 'shift_black' && '🚕 Shift Black Rates'}
            </h4>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: '4px' }}>
                  Base Fare ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={ratesInput[serviceClass as 'shiftx' | 'shift_lx' | 'shift_black'].baseFare}
                  onChange={(e) => updateRateInput(serviceClass as 'shiftx' | 'shift_lx' | 'shift_black', 'baseFare', e.target.value)}
                  placeholder="0.00"
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '4px',
                    color: '#fff',
                  }}
                />
              </div>
              
              <div>
                <label style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: '4px' }}>
                  Per Mile ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={ratesInput[serviceClass as 'shiftx' | 'shift_lx' | 'shift_black'].perMile}
                  onChange={(e) => updateRateInput(serviceClass as 'shiftx' | 'shift_lx' | 'shift_black', 'perMile', e.target.value)}
                  placeholder="0.00"
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '4px',
                    color: '#fff',
                  }}
                />
              </div>
              
              <div>
                <label style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: '4px' }}>
                  Per Minute ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={ratesInput[serviceClass as 'shiftx' | 'shift_lx' | 'shift_black'].perMinute}
                  onChange={(e) => updateRateInput(serviceClass as 'shiftx' | 'shift_lx' | 'shift_black', 'perMinute', e.target.value)}
                  placeholder="0.00"
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '4px',
                    color: '#fff',
                  }}
                />
              </div>
              
              <div>
                <label style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: '4px' }}>
                  Min Fare ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={ratesInput[serviceClass as 'shiftx' | 'shift_lx' | 'shift_black'].minFare}
                  onChange={(e) => updateRateInput(serviceClass as 'shiftx' | 'shift_lx' | 'shift_black', 'minFare', e.target.value)}
                  placeholder="0.00"
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '4px',
                    color: '#fff',
                  }}
                />
              </div>
            </div>
            
            <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: '8px' }}>
              ${ratesInput[serviceClass as 'shiftx' | 'shift_lx' | 'shift_black'].baseFare} base + 
              ${ratesInput[serviceClass as 'shiftx' | 'shift_lx' | 'shift_black'].perMile}/mi + 
              ${ratesInput[serviceClass as 'shiftx' | 'shift_lx' | 'shift_black'].perMinute}/min 
              (min ${ratesInput[serviceClass as 'shiftx' | 'shift_lx' | 'shift_black'].minFare})
            </p>
          </div>
        ))}

        <button
          onClick={handleSaveRates}
          disabled={saving}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: saving ? '#666' : 'rgba(0,255,140,0.9)',
            color: '#000',
            border: 'none',
            borderRadius: '8px',
            fontSize: '1rem',
            fontWeight: '600',
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? 'Saving...' : '💾 Save Vehicle & Rates'}
        </button>
      </div>
      
      <div className="test-section">
        <h3>Account Info</h3>
        <div style={{ marginTop: '0.75rem' }}>
          <div style={{ marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <strong>Display Name:</strong>
              {!editingName && (
                <button
                  onClick={() => setEditingName(true)}
                  style={{
                    padding: '4px 10px',
                    backgroundColor: 'rgba(96,165,250,0.2)',
                    color: '#60a5fa',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                  }}
                >
                  {displayName ? 'Edit' : 'Add Name'}
                </button>
              )}
            </div>
            
            {editingName ? (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter your full name"
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '0.9rem',
                  }}
                  autoFocus
                />
                <button
                  onClick={handleSaveDisplayName}
                  disabled={savingName || !displayName.trim()}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: savingName || !displayName.trim() ? 'rgba(96,165,250,0.1)' : 'rgba(96,165,250,0.3)',
                    color: savingName || !displayName.trim() ? 'rgba(96,165,250,0.5)' : '#60a5fa',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    cursor: savingName || !displayName.trim() ? 'not-allowed' : 'pointer',
                  }}
                >
                  {savingName ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    // Reset to original value from Firebase
                    setEditingName(false);
                  }}
                  disabled={savingName}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    color: 'rgba(255,255,255,0.7)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    cursor: savingName ? 'not-allowed' : 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div style={{ color: displayName ? '#fff' : 'rgba(255,255,255,0.4)', fontStyle: displayName ? 'normal' : 'italic' }}>
                {displayName || 'Not set'}
              </div>
            )}
          </div>
          
          <p style={{ marginBottom: '0.5rem' }}>
            <strong>Driver ID:</strong> <code>{driverId}</code>
          </p>
          <p>
            <strong>Status:</strong> <span style={{ 
              color: onboardingStatus === 'active' ? '#10b981' : '#fbbf24',
              fontWeight: '600'
            }}>{onboardingStatus}</span>
          </p>
        </div>
      </div>

      <div className="test-section">
        <h3>🔗 Invite Preferred Customers</h3>
        <p className="text-muted">Share this QR code or link with customers to become their preferred driver</p>
        
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          gap: '12px', 
          marginTop: '12px' 
        }}>
          <QRCodeSVG value={inviteUrl} size={180} />
          
          <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
            <button
              onClick={handleCopyLink}
              className="secondary-button"
              style={{ flex: 1 }}
            >
              📋 Copy Link
            </button>
            <button
              onClick={handleShare}
              className="primary-button"
              style={{ flex: 1 }}
            >
              📤 Share
            </button>
          </div>
        </div>
      </div>

      {/* Stripe Connect Section */}
      <StripeConnect runtimeFlags={runtimeFlags} />
    </div>
  );
}
