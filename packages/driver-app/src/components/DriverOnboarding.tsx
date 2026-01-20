import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { getInitializedClient } from '@shiftx/driver-client';
import { DocumentUpload } from './DocumentUpload';

interface DriverOnboardingProps {
  userId: string;
  onComplete: () => void;
}

interface OnboardingData {
  licensePhotoURL?: string;
  insurancePhotoURL?: string;
  vehiclePhotoURL?: string;
  registrationPhotoURL?: string;
  approved?: boolean;
  approvalBypassByAdmin?: boolean;
}

export function DriverOnboarding({ userId, onComplete }: DriverOnboardingProps) {
  const [data, setData] = useState<OnboardingData>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { firestore } = getInitializedClient();
    const driverRef = doc(firestore, 'drivers', userId);

    const unsubscribe = onSnapshot(driverRef, (snapshot) => {
      if (snapshot.exists()) {
        const driverData = snapshot.data();
        setData({
          licensePhotoURL: driverData.licensePhotoURL,
          insurancePhotoURL: driverData.insurancePhotoURL,
          vehiclePhotoURL: driverData.vehiclePhotoURL,
          registrationPhotoURL: driverData.registrationPhotoURL,
          approved: driverData.approved,
          approvalBypassByAdmin: driverData.approvalBypassByAdmin,
        });
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  const allDocumentsUploaded =
    data.licensePhotoURL && data.insurancePhotoURL && data.vehiclePhotoURL && data.registrationPhotoURL;

  const canWork = data.approved || data.approvalBypassByAdmin;

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div className="spinner">Loading onboarding status...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '0.5rem', fontSize: '1.5rem' }}>Driver Onboarding</h2>
      <p style={{ marginBottom: '2rem', fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)' }}>
        Upload required documents to get approved
      </p>

      {/* Status Banner */}
      {data.approvalBypassByAdmin ? (
        <div
          style={{
            padding: '1rem',
            backgroundColor: 'rgba(16,185,129,0.1)',
            border: '1px solid rgba(16,185,129,0.3)',
            borderRadius: '12px',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ fontSize: '0.9rem', fontWeight: '600', color: '#10b981', marginBottom: '0.25rem' }}>
            ✅ Admin Bypass Active
          </div>
          <div style={{ fontSize: '0.85rem', color: 'rgba(16,185,129,0.8)' }}>
            You can work without documents. An admin has granted you temporary approval.
          </div>
        </div>
      ) : data.approved ? (
        <div
          style={{
            padding: '1rem',
            backgroundColor: 'rgba(16,185,129,0.1)',
            border: '1px solid rgba(16,185,129,0.3)',
            borderRadius: '12px',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ fontSize: '0.9rem', fontWeight: '600', color: '#10b981', marginBottom: '0.25rem' }}>
            ✅ Approved
          </div>
          <div style={{ fontSize: '0.85rem', color: 'rgba(16,185,129,0.8)' }}>
            Your documents have been reviewed and approved. You can now start accepting rides!
          </div>
        </div>
      ) : allDocumentsUploaded ? (
        <div
          style={{
            padding: '1rem',
            backgroundColor: 'rgba(251,139,36,0.1)',
            border: '1px solid rgba(251,139,36,0.3)',
            borderRadius: '12px',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ fontSize: '0.9rem', fontWeight: '600', color: '#fb8b24', marginBottom: '0.25rem' }}>
            ⏳ Pending Review
          </div>
          <div style={{ fontSize: '0.85rem', color: 'rgba(251,139,36,0.8)' }}>
            All documents uploaded. An admin will review your application shortly.
          </div>
        </div>
      ) : (
        <div
          style={{
            padding: '1rem',
            backgroundColor: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '12px',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ fontSize: '0.9rem', fontWeight: '600', color: '#ef4444', marginBottom: '0.25rem' }}>
            📋 Documents Required
          </div>
          <div style={{ fontSize: '0.85rem', color: 'rgba(239,68,68,0.8)' }}>
            Please upload all required documents to proceed.
          </div>
        </div>
      )}

      {/* Document Uploads */}
      <div style={{ marginBottom: '2rem' }}>
        <DocumentUpload
          userId={userId}
          documentType="license"
          currentDocumentURL={data.licensePhotoURL}
          onDocumentUploaded={(url) => setData({ ...data, licensePhotoURL: url })}
        />

        <DocumentUpload
          userId={userId}
          documentType="insurance"
          currentDocumentURL={data.insurancePhotoURL}
          onDocumentUploaded={(url) => setData({ ...data, insurancePhotoURL: url })}
        />

        <DocumentUpload
          userId={userId}
          documentType="vehicle"
          currentDocumentURL={data.vehiclePhotoURL}
          onDocumentUploaded={(url) => setData({ ...data, vehiclePhotoURL: url })}
        />

        <DocumentUpload
          userId={userId}
          documentType="registration"
          currentDocumentURL={data.registrationPhotoURL}
          onDocumentUploaded={(url) => setData({ ...data, registrationPhotoURL: url })}
        />
      </div>

      {/* Action Button */}
      {canWork && (
        <button
          onClick={onComplete}
          style={{
            width: '100%',
            padding: '1rem',
            backgroundColor: '#10b981',
            color: '#fff',
            border: 'none',
            borderRadius: '12px',
            fontSize: '1rem',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          Continue to App
        </button>
      )}

      {/* Info */}
      <div
        style={{
          marginTop: '2rem',
          padding: '1rem',
          backgroundColor: 'rgba(96,165,250,0.1)',
          border: '1px solid rgba(96,165,250,0.3)',
          borderRadius: '12px',
        }}
      >
        <div style={{ fontSize: '0.85rem', color: 'rgba(96,165,250,0.9)' }}>
          <strong>What happens next?</strong>
          <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
            <li>An admin will review your documents</li>
            <li>You'll receive notification when approved</li>
            <li>Once approved, you can start accepting rides</li>
            <li>Keep your documents up to date</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
