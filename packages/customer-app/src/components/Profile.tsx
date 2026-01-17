import { useState, useEffect } from 'react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { ProfilePhotoUpload } from './ProfilePhotoUpload';
import { SavedPlaces } from './SavedPlaces';

interface UserProfile {
  email?: string;
  displayName?: string;
  photoURL?: string;
  role?: string;
  createdAtMs?: number;
}

interface CustomerProfile {
  onboardingStatus?: string;
  homePlace?: { address: string; lat: number; lng: number };
  workPlace?: { address: string; lat: number; lng: number };
  ratingAvg?: number;
  ratingCount?: number;
}

interface ProfileProps {
  onClose: () => void;
}

export function Profile({ onClose }: ProfileProps) {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSavedPlaces, setShowSavedPlaces] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [savingName, setSavingName] = useState(false);

  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;

    // Subscribe to user profile
    const userUnsubscribe = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        if (snap.exists()) {
          setUserProfile(snap.data() as UserProfile);
        }
        setLoading(false);
      },
      (error) => {
        console.error('[Profile] Error loading user profile:', error);
        setLoading(false);
      }
    );

    // Subscribe to customer profile
    const customerUnsubscribe = onSnapshot(
      doc(db, 'customers', user.uid),
      (snap) => {
        if (snap.exists()) {
          setCustomerProfile(snap.data() as CustomerProfile);
        }
      },
      (error) => {
        console.error('[Profile] Error loading customer profile:', error);
      }
    );

    return () => {
      userUnsubscribe();
      customerUnsubscribe();
    };
  }, [user]);

  const handleSaveDisplayName = async () => {
    if (!user || !displayName.trim()) return;
    
    setSavingName(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: displayName.trim(),
      });
      setEditingName(false);
    } catch (error) {
      console.error('[Profile] Error saving display name:', error);
      alert('Failed to save name. Please try again.');
    } finally {
      setSavingName(false);
    }
  };

  if (!user) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: 'rgba(255,255,255,0.7)' }}>Not signed in</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', display: 'flex', justifyContent: 'center' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: '#05060a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '1rem',
      paddingTop: 'calc(1rem + env(safe-area-inset-top))',
      paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))',
      overscrollBehavior: 'none',
      overflow: 'auto',
    }}>
      <div style={{
        backgroundColor: '#1a1a1a',
        borderRadius: '16px',
        maxWidth: '500px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto',
        overscrollBehavior: 'none',
        WebkitOverflowScrolling: 'touch',
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
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '600' }}>Profile</h2>
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
          {/* Photo Upload */}
          <ProfilePhotoUpload
            currentPhotoURL={userProfile?.photoURL}
            userId={user.uid}
            onPhotoUploaded={(photoURL) => {
              setUserProfile(prev => prev ? { ...prev, photoURL } : { photoURL });
            }}
          />

          {/* Basic Info */}
          <div style={{
            padding: '1rem',
            backgroundColor: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
          }}>
            <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', fontWeight: '600' }}>Account Info</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>Email:</span>
                <span>{userProfile?.email || user.email}</span>
              </div>
              
              {/* Display Name Field */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>Display Name:</span>
                  {!editingName && (
                    <button
                      onClick={() => {
                        setDisplayName(userProfile?.displayName || '');
                        setEditingName(true);
                      }}
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
                      {userProfile?.displayName ? 'Edit' : 'Add Name'}
                    </button>
                  )}
                </div>
                
                {editingName ? (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
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
                      onClick={() => setEditingName(false)}
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
                  <span style={{ fontSize: '0.95rem' }}>
                    {userProfile?.displayName || (
                      <span style={{ color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>Not set</span>
                    )}
                  </span>
                )}
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>Status:</span>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: customerProfile?.onboardingStatus === 'active' 
                    ? 'rgba(34,197,94,0.2)' 
                    : 'rgba(250,204,21,0.2)',
                  color: customerProfile?.onboardingStatus === 'active' ? '#22c55e' : '#facc15',
                  fontSize: '0.85rem',
                }}>
                  {customerProfile?.onboardingStatus || 'pending'}
                </span>
              </div>
              {customerProfile?.ratingCount && customerProfile.ratingCount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>Rating:</span>
                  <span>
                    ⭐ {customerProfile.ratingAvg?.toFixed(1)} ({customerProfile.ratingCount} rides)
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Saved Places Section */}
          <div style={{
            padding: '1rem',
            backgroundColor: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600' }}>Saved Places</h3>
              <button
                onClick={() => setShowSavedPlaces(true)}
                style={{
                  padding: '6px 12px',
                  backgroundColor: 'rgba(96,165,250,0.2)',
                  color: '#60a5fa',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                {(customerProfile?.homePlace || customerProfile?.workPlace) ? 'Edit' : 'Add'}
              </button>
            </div>
            
            {customerProfile?.homePlace ? (
              <div style={{ 
                padding: '8px',
                backgroundColor: 'rgba(96,165,250,0.1)',
                borderRadius: '6px',
                marginBottom: '0.5rem'
              }}>
                <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>🏠 Home</div>
                <div style={{ fontSize: '0.9rem' }}>{customerProfile.homePlace.address}</div>
              </div>
            ) : null}
            {customerProfile?.workPlace ? (
              <div style={{ 
                padding: '8px',
                backgroundColor: 'rgba(96,165,250,0.1)',
                borderRadius: '6px',
              }}>
                <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>💼 Work</div>
                <div style={{ fontSize: '0.9rem' }}>{customerProfile.workPlace.address}</div>
              </div>
            ) : null}
            {!customerProfile?.homePlace && !customerProfile?.workPlace && (
              <p style={{ 
                margin: 0, 
                fontSize: '0.9rem', 
                color: 'rgba(255,255,255,0.5)',
                fontStyle: 'italic'
              }}>
                No saved places yet
              </p>
            )}
          </div>
        </div>
      </div>
      
      {/* Saved Places Modal */}
      {showSavedPlaces && <SavedPlaces onClose={() => setShowSavedPlaces(false)} />}
    </div>
  );
}
