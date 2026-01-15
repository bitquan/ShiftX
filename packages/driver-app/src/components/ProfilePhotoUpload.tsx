import { useState, useRef } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import { getInitializedClient } from '@shiftx/driver-client';

interface ProfilePhotoUploadProps {
  currentPhotoURL?: string;
  userId: string;
  onPhotoUploaded?: (photoURL: string) => void;
}

// Helper function to compress image
async function compressImage(file: File, maxSizeKB: number = 500, maxDimension: number = 512): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Calculate new dimensions
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = (height * maxDimension) / width;
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = (width * maxDimension) / height;
            height = maxDimension;
          }
        }

        // Create canvas and draw resized image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to blob with quality adjustment
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Could not create blob'));
              return;
            }
            
            // Check size and adjust quality if needed
            const sizeKB = blob.size / 1024;
            if (sizeKB > maxSizeKB) {
              // Try again with lower quality
              canvas.toBlob(
                (lowerQualityBlob) => {
                  resolve(lowerQualityBlob || blob);
                },
                'image/jpeg',
                0.7
              );
            } else {
              resolve(blob);
            }
          },
          'image/jpeg',
          0.85
        );
      };
      img.onerror = () => reject(new Error('Could not load image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

export function ProfilePhotoUpload({ currentPhotoURL, userId, onPhotoUploaded }: ProfilePhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [previewURL, setPreviewURL] = useState<string | null>(currentPhotoURL || null);
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
      const compressedBlob = await compressImage(file, 500, 512);
      
      // Create preview
      const previewUrl = URL.createObjectURL(compressedBlob);
      setPreviewURL(previewUrl);

      // Get Firebase clients
      const { storage, firestore } = getInitializedClient();

      // Upload to Firebase Storage
      const storageRef = ref(storage, `profile-photos/${userId}/profile.jpg`);
      await uploadBytes(storageRef, compressedBlob);

      // Get download URL
      const downloadURL = await getDownloadURL(storageRef);

      // Update Firestore driver profile
      const driverRef = doc(firestore, 'drivers', userId);
      await updateDoc(driverRef, {
        photoURL: downloadURL,
        updatedAtMs: Date.now(),
      });

      console.log('[ProfilePhotoUpload] Photo uploaded successfully:', downloadURL);
      
      if (onPhotoUploaded) {
        onPhotoUploaded(downloadURL);
      }
    } catch (err: any) {
      console.error('[ProfilePhotoUpload] Upload error:', err);
      setError(`Upload failed: ${err.message}`);
      // Revert preview on error
      setPreviewURL(currentPhotoURL || null);
    } finally {
      setUploading(false);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '1rem',
      padding: '1.5rem',
      backgroundColor: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '12px',
    }}>
      {/* Photo Preview */}
      <div style={{
        position: 'relative',
        width: '120px',
        height: '120px',
        borderRadius: '50%',
        overflow: 'hidden',
        backgroundColor: 'rgba(255,255,255,0.1)',
        border: '3px solid rgba(34,197,94,0.3)',
      }}>
        {previewURL ? (
          <img
            src={previewURL}
            alt="Profile"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '3rem',
            color: 'rgba(255,255,255,0.3)',
          }}>
            👤
          </div>
        )}
        {uploading && (
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <div className="spinner" style={{ borderColor: '#22c55e', borderTopColor: 'transparent' }} />
          </div>
        )}
      </div>

      {/* Upload Button */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
      <button
        onClick={handleClick}
        disabled={uploading}
        style={{
          padding: '12px 24px',
          backgroundColor: uploading ? 'rgba(34,197,94,0.3)' : 'rgba(34,197,94,0.95)',
          color: uploading ? 'rgba(255,255,255,0.5)' : '#000',
          border: 'none',
          borderRadius: '8px',
          fontSize: '0.95rem',
          fontWeight: '600',
          cursor: uploading ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        {uploading ? (
          <>
            <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
            Uploading...
          </>
        ) : (
          <>
            📸 {previewURL ? 'Change Photo' : 'Upload Photo'}
          </>
        )}
      </button>

      {error && (
        <p style={{
          margin: 0,
          padding: '8px 12px',
          backgroundColor: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: '6px',
          color: '#ef4444',
          fontSize: '0.85rem',
        }}>
          {error}
        </p>
      )}

      <p style={{ 
        fontSize: '0.8rem', 
        color: 'rgba(255,255,255,0.5)', 
        textAlign: 'center',
        margin: 0,
      }}>
        Upload a profile photo to go online<br />
        <span style={{ fontSize: '0.75rem' }}>Max 10MB • Auto-compressed to 500KB</span>
      </p>
    </div>
  );
}
