'use client';

import { useState, useCallback, useRef } from 'react';
import { uploadPostImageEnhanced, validateImageFile, createImagePreview, cleanupImagePreview } from '@/utils/imageUpload';

/**
 * Custom hook for managing image upload state and operations
 * @param {object} options - Configuration options
 * @returns {object} - Upload state and methods
 */
export function useImageUpload(options = {}) {
  const {
    userId,
    maxSizeMB = 5,
    allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
    onUploadSuccess,
    onUploadError,
    autoUpload = true
  } = options;

  // State management
  const [uploadState, setUploadState] = useState('idle'); // idle, uploading, success, error
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState(null);
  const [imageMetadata, setImageMetadata] = useState(null);
  const [error, setError] = useState(null);

  // Refs
  const abortControllerRef = useRef(null);
  const previewUrlRef = useRef(null);

  // Validate and select file
  const selectFile = useCallback(async (file) => {
    if (!file) return { success: false, error: 'No file provided' };

    // Reset previous state
    setError(null);
    setUploadProgress(0);
    setUploadState('idle');

    // Clean up previous preview
    if (previewUrlRef.current) {
      cleanupImagePreview(previewUrlRef.current);
      previewUrlRef.current = null;
    }

    // Validate file
    const validation = validateImageFile(file, { maxSizeMB, allowedTypes });
    if (!validation.isValid) {
      const errorMessage = validation.errors.join(', ');
      setError(errorMessage);
      if (onUploadError) {
        onUploadError(new Error(errorMessage));
      }
      return { success: false, error: errorMessage };
    }

    try {
      // Create preview
      const preview = createImagePreview(file);
      previewUrlRef.current = preview;
      setPreviewUrl(preview);
      setSelectedFile(file);
      setImageMetadata(validation.fileInfo);

      // Auto upload if enabled
      if (autoUpload && userId) {
        await uploadFile(file);
      }

      return { success: true, file, preview };
    } catch (error) {
      const errorMessage = error.message || 'Failed to process file';
      setError(errorMessage);
      if (onUploadError) {
        onUploadError(error);
      }
      return { success: false, error: errorMessage };
    }
  }, [maxSizeMB, allowedTypes, autoUpload, userId, onUploadError]);

  // Upload file to storage
  const uploadFile = useCallback(async (file = selectedFile) => {
    if (!file || !userId) {
      const errorMessage = 'Missing file or userId';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }

    try {
      setUploadState('uploading');
      setUploadProgress(0);
      setError(null);

      // Create abort controller
      abortControllerRef.current = new AbortController();

      const uploadResult = await uploadPostImageEnhanced(file, userId, {
        maxSizeMB,
        onProgress: (progress) => {
          setUploadProgress(progress);
        },
        signal: abortControllerRef.current.signal
      });

      if (uploadResult.error) {
        throw new Error(uploadResult.error);
      }

      // Upload successful
      setUploadState('success');
      setUploadProgress(100);
      setUploadedImageUrl(uploadResult.publicUrl);
      
      // Update metadata with upload info
      setImageMetadata(prev => ({
        ...prev,
        ...uploadResult.metadata,
        uploadedAt: new Date().toISOString()
      }));

      if (onUploadSuccess) {
        onUploadSuccess({
          url: uploadResult.publicUrl,
          metadata: uploadResult.metadata,
          file
        });
      }

      return { 
        success: true, 
        url: uploadResult.publicUrl, 
        metadata: uploadResult.metadata 
      };

    } catch (error) {
      // Handle abort
      if (error.name === 'AbortError') {
        setUploadState('idle');
        setUploadProgress(0);
        return { success: false, error: 'Upload cancelled' };
      }

      const errorMessage = error.message || 'Upload failed';
      setError(errorMessage);
      setUploadState('error');
      
      if (onUploadError) {
        onUploadError(error);
      }

      return { success: false, error: errorMessage };
    }
  }, [selectedFile, userId, maxSizeMB, onUploadSuccess, onUploadError]);

  // Cancel upload
  const cancelUpload = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setUploadState('idle');
    setUploadProgress(0);
  }, []);

  // Remove/reset everything
  const removeImage = useCallback(() => {
    // Cancel any ongoing upload
    cancelUpload();

    // Clean up preview
    if (previewUrlRef.current) {
      cleanupImagePreview(previewUrlRef.current);
      previewUrlRef.current = null;
    }

    // Reset all state
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadedImageUrl(null);
    setImageMetadata(null);
    setUploadState('idle');
    setUploadProgress(0);
    setError(null);
  }, [cancelUpload]);

  // Retry upload
  const retryUpload = useCallback(() => {
    if (selectedFile) {
      return uploadFile(selectedFile);
    }
    return Promise.resolve({ success: false, error: 'No file to retry' });
  }, [selectedFile, uploadFile]);

  // Reset error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    cancelUpload();
    if (previewUrlRef.current) {
      cleanupImagePreview(previewUrlRef.current);
    }
  }, [cancelUpload]);

  return {
    // State
    uploadState,
    uploadProgress,
    selectedFile,
    previewUrl,
    uploadedImageUrl,
    imageMetadata,
    error,
    
    // Computed state
    isIdle: uploadState === 'idle',
    isUploading: uploadState === 'uploading',
    isSuccess: uploadState === 'success',
    isError: uploadState === 'error',
    hasFile: !!selectedFile,
    hasPreview: !!previewUrl,
    hasUploadedImage: !!uploadedImageUrl,
    
    // Methods
    selectFile,
    uploadFile,
    cancelUpload,
    removeImage,
    retryUpload,
    clearError,
    cleanup
  };
}

/**
 * Hook for managing multiple image uploads
 * @param {object} options - Configuration options
 * @returns {object} - Multi-upload state and methods
 */
export function useMultiImageUpload(options = {}) {
  const {
    userId,
    maxFiles = 5,
    maxSizeMB = 5,
    allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
    onUploadSuccess,
    onUploadError
  } = options;

  const [uploads, setUploads] = useState(new Map());
  const [globalState, setGlobalState] = useState('idle');

  // Add file to uploads
  const addFile = useCallback(async (file, id = null) => {
    const fileId = id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    if (uploads.size >= maxFiles) {
      const error = new Error(`Maximum ${maxFiles} files allowed`);
      if (onUploadError) onUploadError(error);
      return { success: false, error: error.message };
    }

    // Validate file
    const validation = validateImageFile(file, { maxSizeMB, allowedTypes });
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      if (onUploadError) onUploadError(error);
      return { success: false, error: error.message };
    }

    try {
      const preview = createImagePreview(file);
      
      const uploadItem = {
        id: fileId,
        file,
        preview,
        state: 'idle',
        progress: 0,
        error: null,
        uploadedUrl: null,
        metadata: validation.fileInfo
      };

      setUploads(prev => new Map(prev.set(fileId, uploadItem)));
      
      // Auto upload if userId is provided
      if (userId) {
        await uploadSingleFile(fileId);
      }

      return { success: true, id: fileId };
    } catch (error) {
      if (onUploadError) onUploadError(error);
      return { success: false, error: error.message };
    }
  }, [uploads.size, maxFiles, maxSizeMB, allowedTypes, userId, onUploadError]);

  // Upload single file by ID
  const uploadSingleFile = useCallback(async (fileId) => {
    const uploadItem = uploads.get(fileId);
    if (!uploadItem || !userId) return { success: false, error: 'File not found or no userId' };

    try {
      // Update state to uploading
      setUploads(prev => new Map(prev.set(fileId, {
        ...uploadItem,
        state: 'uploading',
        progress: 0,
        error: null
      })));

      const result = await uploadPostImageEnhanced(uploadItem.file, userId, {
        maxSizeMB,
        onProgress: (progress) => {
          setUploads(prev => {
            const current = prev.get(fileId);
            if (current) {
              return new Map(prev.set(fileId, { ...current, progress }));
            }
            return prev;
          });
        }
      });

      if (result.error) {
        throw new Error(result.error);
      }

      // Update to success
      setUploads(prev => new Map(prev.set(fileId, {
        ...uploadItem,
        state: 'success',
        progress: 100,
        uploadedUrl: result.publicUrl,
        metadata: { ...uploadItem.metadata, ...result.metadata }
      })));

      if (onUploadSuccess) {
        onUploadSuccess({
          id: fileId,
          url: result.publicUrl,
          metadata: result.metadata,
          file: uploadItem.file
        });
      }

      return { success: true, url: result.publicUrl };
    } catch (error) {
      // Update to error
      setUploads(prev => new Map(prev.set(fileId, {
        ...uploadItem,
        state: 'error',
        error: error.message
      })));

      if (onUploadError) onUploadError(error);
      return { success: false, error: error.message };
    }
  }, [uploads, userId, maxSizeMB, onUploadSuccess, onUploadError]);

  // Remove file by ID
  const removeFile = useCallback((fileId) => {
    const uploadItem = uploads.get(fileId);
    if (uploadItem?.preview) {
      cleanupImagePreview(uploadItem.preview);
    }
    
    setUploads(prev => {
      const newMap = new Map(prev);
      newMap.delete(fileId);
      return newMap;
    });
  }, [uploads]);

  // Upload all files
  const uploadAll = useCallback(async () => {
    if (!userId) return { success: false, error: 'No userId provided' };

    setGlobalState('uploading');
    const results = [];

    for (const [fileId, uploadItem] of uploads) {
      if (uploadItem.state === 'idle') {
        const result = await uploadSingleFile(fileId);
        results.push({ id: fileId, ...result });
      }
    }

    setGlobalState('idle');
    return { success: true, results };
  }, [uploads, userId, uploadSingleFile]);

  // Clear all
  const clearAll = useCallback(() => {
    uploads.forEach(uploadItem => {
      if (uploadItem.preview) {
        cleanupImagePreview(uploadItem.preview);
      }
    });
    setUploads(new Map());
    setGlobalState('idle');
  }, [uploads]);

  // Get uploaded URLs
  const getUploadedUrls = useCallback(() => {
    return Array.from(uploads.values())
      .filter(item => item.uploadedUrl)
      .map(item => ({
        id: item.id,
        url: item.uploadedUrl,
        metadata: item.metadata
      }));
  }, [uploads]);

  return {
    uploads: Array.from(uploads.values()),
    globalState,
    addFile,
    uploadSingleFile,
    removeFile,
    uploadAll,
    clearAll,
    getUploadedUrls,
    
    // Computed state
    totalFiles: uploads.size,
    canAddMore: uploads.size < maxFiles,
    hasFiles: uploads.size > 0,
    allUploaded: Array.from(uploads.values()).every(item => item.state === 'success'),
    anyUploading: Array.from(uploads.values()).some(item => item.state === 'uploading'),
    anyErrors: Array.from(uploads.values()).some(item => item.state === 'error')
  };
}