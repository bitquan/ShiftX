import { useState, useRef } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import { getInitializedClient } from '@shiftx/driver-client';

interface DocumentUploadProps {
  userId: string;
  documentType: 'license' | 'insurance' | 'vehicle' | 'registration';
  currentDocumentURL?: string;
  onDocumentUploaded?: (url: string) => void;
}

async function compressImage(file: File, maxWidth: number, maxSize: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to compress image'));
          }
        },
        'image/jpeg',
        0.8
      );
    };

    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

const DOCUMENT_LABELS = {
  license: "Driver's License",
  insurance: 'Insurance Card',
  vehicle: 'Vehicle Photo',
  registration: 'Vehicle Registration',
};

export function DocumentUpload({
  userId,
  documentType,
  currentDocumentURL,
  onDocumentUploaded,
}: DocumentUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [previewURL, setPreviewURL] = useState<string | null>(currentDocumentURL || null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (max 10MB before compression)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image too large. Please select an image under 10MB');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Compress image
      const compressedBlob = await compressImage(file, 1200, 1024);

      // Create preview
      const previewUrl = URL.createObjectURL(compressedBlob);
      setPreviewURL(previewUrl);

      // Get Firebase clients
      const { storage, firestore } = getInitializedClient();

      // Upload to Firebase Storage
      const storageRef = ref(storage, `driver-documents/${userId}/${documentType}.jpg`);
      await uploadBytes(storageRef, compressedBlob);

      // Get download URL
      const downloadURL = await getDownloadURL(storageRef);

      // Update Firestore driver profile
      const driverRef = doc(firestore, 'drivers', userId);
      const fieldName = `${documentType}PhotoURL`;
      await updateDoc(driverRef, {
        [fieldName]: downloadURL,
        updatedAtMs: Date.now(),
      });

      console.log(`[DocumentUpload] ${documentType} uploaded successfully:`, downloadURL);

      if (onDocumentUploaded) {
        onDocumentUploaded(downloadURL);
      }
    } catch (err: any) {
      console.error(`[DocumentUpload] Error uploading ${documentType}:`, err);
      setError(err.message || 'Failed to upload document');
      setPreviewURL(null);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div
        style={{
          fontSize: '0.9rem',
          fontWeight: '600',
          marginBottom: '0.5rem',
          color: 'rgba(255,255,255,0.9)',
        }}
      >
        {DOCUMENT_LABELS[documentType]}
      </div>

      <div
        style={{
          border: '2px dashed rgba(255,255,255,0.2)',
          borderRadius: '12px',
          padding: '1rem',
          textAlign: 'center',
          backgroundColor: 'rgba(255,255,255,0.03)',
          cursor: uploading ? 'not-allowed' : 'pointer',
        }}
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        {previewURL ? (
          <div>
            <img
              src={previewURL}
              alt={`${documentType} preview`}
              style={{
                maxWidth: '100%',
                maxHeight: '200px',
                borderRadius: '8px',
                marginBottom: '0.5rem',
              }}
            />
            <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>
              ✅ Document uploaded
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📄</div>
            <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>
              {uploading ? 'Uploading...' : `Upload ${DOCUMENT_LABELS[documentType]}`}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.25rem' }}>
              Tap to select file
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
          disabled={uploading}
        />
      </div>

      {error && (
        <div
          style={{
            marginTop: '0.5rem',
            padding: '0.75rem',
            backgroundColor: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '8px',
            fontSize: '0.85rem',
            color: '#ef4444',
          }}
        >
          {error}
        </div>
      )}

      {uploading && (
        <div
          style={{
            marginTop: '0.5rem',
            fontSize: '0.85rem',
            color: 'rgba(255,255,255,0.6)',
          }}
        >
          Compressing and uploading...
        </div>
      )}
    </div>
  );
}
