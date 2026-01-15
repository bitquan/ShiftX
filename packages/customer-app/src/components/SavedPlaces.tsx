import { useState, useEffect } from 'react';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useToast } from './Toast';
import { AddressAutocomplete } from './AddressAutocomplete';

interface SavedPlace {
  address: string;
  lat: number;
  lng: number;
}

interface SavedPlacesProps {
  onClose: () => void;
}

export function SavedPlaces({ onClose }: SavedPlacesProps) {
  const { show } = useToast();
  const [homePlace, setHomePlace] = useState<SavedPlace | null>(null);
  const [workPlace, setWorkPlace] = useState<SavedPlace | null>(null);
  const [editingHome, setEditingHome] = useState(false);
  const [editingWork, setEditingWork] = useState(false);
  const [saving, setSaving] = useState(false);

  const user = auth.currentUser;

  // Load saved places from Firestore
  useEffect(() => {
    if (!user) return;

    const customerRef = doc(db, 'customers', user.uid);
    const unsubscribe = onSnapshot(customerRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setHomePlace(data.homePlace || null);
        setWorkPlace(data.workPlace || null);
      }
    });

    return () => unsubscribe();
  }, [user]);

  const handleSaveHome = async (address: string, lat: number, lng: number) => {
    if (!user) return;
    
    setSaving(true);
    try {
      const customerRef = doc(db, 'customers', user.uid);
      await updateDoc(customerRef, {
        homePlace: { address, lat, lng },
        updatedAtMs: Date.now(),
      });
      setHomePlace({ address, lat, lng });
      setEditingHome(false);
      show('Home address saved', 'success');
    } catch (error: any) {
      console.error('[SavedPlaces] Error saving home:', error);
      show(`Failed to save: ${error.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWork = async (address: string, lat: number, lng: number) => {
    if (!user) return;
    
    setSaving(true);
    try {
      const customerRef = doc(db, 'customers', user.uid);
      await updateDoc(customerRef, {
        workPlace: { address, lat, lng },
        updatedAtMs: Date.now(),
      });
      setWorkPlace({ address, lat, lng });
      setEditingWork(false);
      show('Work address saved', 'success');
    } catch (error: any) {
      console.error('[SavedPlaces] Error saving work:', error);
      show(`Failed to save: ${error.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveHome = async () => {
    if (!user) return;
    
    try {
      const customerRef = doc(db, 'customers', user.uid);
      await updateDoc(customerRef, {
        homePlace: null,
        updatedAtMs: Date.now(),
      });
      setHomePlace(null);
      show('Home address removed', 'success');
    } catch (error: any) {
      console.error('[SavedPlaces] Error removing home:', error);
      show(`Failed to remove: ${error.message}`, 'error');
    }
  };

  const handleRemoveWork = async () => {
    if (!user) return;
    
    try {
      const customerRef = doc(db, 'customers', user.uid);
      await updateDoc(customerRef, {
        workPlace: null,
        updatedAtMs: Date.now(),
      });
      setWorkPlace(null);
      show('Work address removed', 'success');
    } catch (error: any) {
      console.error('[SavedPlaces] Error removing work:', error);
      show(`Failed to remove: ${error.message}`, 'error');
    }
  };

  if (!user) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: 'rgba(255,255,255,0.7)' }}>Not signed in</p>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0,0,0,0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem',
    }}>
      <div style={{
        backgroundColor: '#1a1a1a',
        borderRadius: '16px',
        maxWidth: '500px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto',
        border: '1px solid rgba(255,255,255,0.1)',
      }}>
        {/* Header */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '600' }}>📍 Saved Places</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: 'rgba(255,255,255,0.7)',
              padding: '0.25rem',
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Home Place */}
          <div style={{
            padding: '1rem',
            backgroundColor: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600' }}>🏠 Home</h3>
              {homePlace && !editingHome && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => setEditingHome(true)}
                    style={{
                      padding: '4px 12px',
                      backgroundColor: 'rgba(96,165,250,0.2)',
                      color: '#60a5fa',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleRemoveHome}
                    style={{
                      padding: '4px 12px',
                      backgroundColor: 'rgba(239,68,68,0.2)',
                      color: '#ef4444',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                    }}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            {editingHome || !homePlace ? (
              <div>
                <AddressAutocomplete
                  value={''}
                  onChange={() => {}}
                  onSelect={(place: { label: string; lat: number; lng: number }) => {
                    handleSaveHome(place.label, place.lat, place.lng);
                  }}
                  placeholder="Enter home address"
                />
                {editingHome && (
                  <button
                    onClick={() => setEditingHome(false)}
                    disabled={saving}
                    style={{
                      marginTop: '0.5rem',
                      padding: '8px 16px',
                      backgroundColor: 'rgba(255,255,255,0.1)',
                      color: 'rgba(255,255,255,0.7)',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                      cursor: saving ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            ) : (
              <div>
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'rgba(255,255,255,0.9)' }}>
                  {homePlace.address}
                </p>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                  {homePlace.lat.toFixed(4)}, {homePlace.lng.toFixed(4)}
                </p>
              </div>
            )}
          </div>

          {/* Work Place */}
          <div style={{
            padding: '1rem',
            backgroundColor: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600' }}>💼 Work</h3>
              {workPlace && !editingWork && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => setEditingWork(true)}
                    style={{
                      padding: '4px 12px',
                      backgroundColor: 'rgba(96,165,250,0.2)',
                      color: '#60a5fa',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleRemoveWork}
                    style={{
                      padding: '4px 12px',
                      backgroundColor: 'rgba(239,68,68,0.2)',
                      color: '#ef4444',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                    }}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            {editingWork || !workPlace ? (
              <div>
                <AddressAutocomplete
                  value={''}
                  onChange={() => {}}
                  onSelect={(place: { label: string; lat: number; lng: number }) => {
                    handleSaveWork(place.label, place.lat, place.lng);
                  }}
                  placeholder="Enter work address"
                />
                {editingWork && (
                  <button
                    onClick={() => setEditingWork(false)}
                    disabled={saving}
                    style={{
                      marginTop: '0.5rem',
                      padding: '8px 16px',
                      backgroundColor: 'rgba(255,255,255,0.1)',
                      color: 'rgba(255,255,255,0.7)',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                      cursor: saving ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            ) : (
              <div>
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'rgba(255,255,255,0.9)' }}>
                  {workPlace.address}
                </p>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                  {workPlace.lat.toFixed(4)}, {workPlace.lng.toFixed(4)}
                </p>
              </div>
            )}
          </div>

          <p style={{
            margin: 0,
            fontSize: '0.85rem',
            color: 'rgba(255,255,255,0.5)',
            textAlign: 'center',
            fontStyle: 'italic',
          }}>
            Saved places make it faster to request rides to your frequent destinations
          </p>
        </div>
      </div>
    </div>
  );
}
