'use client';

import { useState, useRef, useCallback } from 'react';
import { uploadPostImageEnhanced, validateImageFile, getImageDimensions, createImagePreview, cleanupImagePreview } from '@/utils/imageUpload';
import styles from '@/styles/ImageUpload.module.css';

export default function ImageUploadEnhanced({ 
  onImageUploaded, 
  onImageRemoved, 
  userId, 
  disabled = false,
  maxSizeMB = 5,
  allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
}) {
  const [uploadState, setUploadState] = useState('idle'); // idle, uploading, success, error
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [imageMetadata, setImageMetadata] = useState(null);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  
  const fileInputRef = useRef(null);
  const uploadAbortController = useRef(null);

  // Handle file selection
  const handleFileSelect = useCallback(async (file) => {
    if (!file || !userId) return;

    // Reset previous state
    setError(null);
    setUploadProgress(0);

    // Validate file
    const validation = validateImageFile(file, { maxSizeMB, allowedTypes });
    if (!validation.isValid) {
      setError(validation.errors.join(', '));
      return;
    }

    try {
      // Get image dimensions
      const dimensions = await getImageDimensions(file);
      
      // Create preview
      const preview = createImagePreview(file);
      setPreviewUrl(preview);
      
      // Set metadata
      setImageMetadata({
        ...validation.fileInfo,
        ...dimensions
      });

      // Start upload
      setUploadState('uploading');
      uploadAbortController.current = new AbortController();

      const uploadResult = await uploadPostImageEnhanced(file, userId, {
        maxSizeMB,
        onProgress: (progress) => {
          setUploadProgress(progress);
        }
      });

      if (uploadResult.error) {
        throw new Error(uploadResult.error);
      }

      // Upload successful
      setUploadState('success');
      setUploadProgress(100);
      
      // Notify parent component
      if (onImageUploaded) {
        onImageUploaded({
          url: uploadResult.publicUrl,
          metadata: {
            ...imageMetadata,
            ...uploadResult.metadata
          }
        });
      }

    } catch (error) {
      console.error('Image upload error:', error);
      setError(error.message || 'Upload failed');
      setUploadState('error');
      
      // Clean up preview on error
      if (previewUrl) {
        cleanupImagePreview(previewUrl);
        setPreviewUrl(null);
      }
    }
  }, [userId, maxSizeMB, allowedTypes, onImageUploaded, imageMetadata, previewUrl]);

  // Handle file input change
  const handleInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // Handle drag and drop
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  };

  // Remove image
  const handleRemoveImage = () => {
    // Cancel upload if in progress
    if (uploadAbortController.current) {
      uploadAbortController.current.abort();
    }

    // Clean up preview
    if (previewUrl) {
      cleanupImagePreview(previewUrl);
    }

    // Reset state
    setPreviewUrl(null);
    setImageMetadata(null);
    setUploadState('idle');
    setUploadProgress(0);
    setError(null);

    // Clear file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    // Notify parent
    if (onImageRemoved) {
      onImageRemoved();
    }
  };

  // Trigger file input
  const triggerFileInput = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className={styles.imageUploadContainer}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={allowedTypes.join(',')}
        onChange={handleInputChange}
        style={{ display: 'none' }}
        disabled={disabled}
      />

      {/* Upload area */}
      {!previewUrl && (
        <div
          className={`${styles.uploadArea} ${dragActive ? styles.dragActive : ''} ${disabled ? styles.disabled : ''}`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={triggerFileInput}
        >
          <div className={styles.uploadContent}>
            {uploadState === 'uploading' ? (
              <div className={styles.uploadingState}>
                <div className={styles.spinner}></div>
                <p>Uploading... {uploadProgress}%</p>
                <div className={styles.progressBar}>
                  <div 
                    className={styles.progressFill} 
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              </div>
            ) : (
              <div className={styles.idleState}>
                <div className={styles.uploadIcon}>📷</div>
                <p className={styles.uploadText}>
                  <strong>Click to upload</strong> or drag and drop
                </p>
                <p className={styles.uploadHint}>
                  {allowedTypes.map(type => type.split('/')[1]).join(', ').toUpperCase()} up to {maxSizeMB}MB
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Preview area */}
      {previewUrl && (
        <div className={styles.previewArea}>
          <div className={styles.imagePreview}>
            <img src={previewUrl} alt="Upload preview" />
            <button
              className={styles.removeButton}
              onClick={handleRemoveImage}
              disabled={uploadState === 'uploading'}
            >
              ✕
            </button>
          </div>
          
          {/* Image metadata */}
          {imageMetadata && (
            <div className={styles.imageMetadata}>
              <div className={styles.metadataItem}>
                <span>Size:</span>
                <span>{imageMetadata.sizeMB}MB</span>
              </div>
              <div className={styles.metadataItem}>
                <span>Dimensions:</span>
                <span>{imageMetadata.width} × {imageMetadata.height}</span>
              </div>
              <div className={styles.metadataItem}>
                <span>Type:</span>
                <span>{imageMetadata.type.split('/')[1].toUpperCase()}</span>
              </div>
            </div>
          )}

          {/* Upload status */}
          {uploadState === 'uploading' && (
            <div className={styles.uploadStatus}>
              <div className={styles.progressBar}>
                <div 
                  className={styles.progressFill} 
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              <p>Uploading... {uploadProgress}%</p>
            </div>
          )}

          {uploadState === 'success' && (
            <div className={styles.successStatus}>
              <span className={styles.successIcon}>✓</span>
              <span>Upload successful!</span>
            </div>
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className={styles.errorMessage}>
          <span className={styles.errorIcon}>⚠️</span>
          <span>{error}</span>
          <button 
            className={styles.retryButton}
            onClick={() => setError(null)}
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}