import { supabase } from './supabase';
import imageCompression from 'browser-image-compression';

/**
 * Enhanced image upload utility with better error handling and validation
 * @param {File} file - Image file to upload
 * @param {string} userId - User ID
 * @param {object} options - Upload options
 * @returns {Promise<object>} - Upload result with publicUrl and metadata
 */
export async function uploadPostImageEnhanced(file, userId, options = {}) {
  const uploadStart = performance.now();
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
  const signal = options.signal;
  let progressTimer = null;
  let aborted = false;
  const cleanup = () => {
    if (progressTimer) {
      clearInterval(progressTimer);
      progressTimer = null;
    }
    if (signal && abortHandler) {
      try { signal.removeEventListener('abort', abortHandler); } catch {}
    }
  };
  const abortHandler = () => {
    aborted = true;
  };
  if (signal) {
    if (signal.aborted) {
      return { publicUrl: null, error: 'Upload aborted', metadata: null };
    }
    try { signal.addEventListener('abort', abortHandler, { once: true }); } catch {}
  }
  
  // Validation
  if (!file || !userId) {
    return { 
      publicUrl: null, 
      error: 'Missing required parameters: file and userId are required',
      metadata: null 
    };
  }

  // File type validation
  if (!file.type.startsWith('image/')) {
    return { 
      publicUrl: null, 
      error: 'Invalid file type. Only image files are allowed.',
      metadata: null 
    };
  }

  // File size validation (max 10MB)
  const maxSize = options.maxSizeMB || 10;
  if (file.size > maxSize * 1024 * 1024) {
    return { 
      publicUrl: null, 
      error: `File size too large. Maximum size is ${maxSize}MB.`,
      metadata: null 
    };
  }

  try {
    let compressedFile = file;
    let compressionApplied = false;

    // Image compression for better performance
    if (file.type.startsWith('image/') && file.size > 500 * 1024) { // Compress if > 500KB
      try {
        const originalSizeKB = Math.round(file.size / 1024);
        console.log(`[uploadPostImageEnhanced] Compressing image. Original: ${originalSizeKB}KB`);
        
        const compressionOptions = {
          maxSizeMB: options.maxCompressedSizeMB || 1,
          maxWidthOrHeight: options.maxDimension || 1920,
          useWebWorker: true,
          initialQuality: options.quality || 0.8,
          maxIteration: 10,
        };
        
        compressedFile = await imageCompression(file, compressionOptions);
        const compressedSizeKB = Math.round(compressedFile.size / 1024);
        compressionApplied = true;
        
        console.log(`[uploadPostImageEnhanced] Compression complete. New: ${compressedSizeKB}KB`);
      } catch (compressionError) {
        console.warn('[uploadPostImageEnhanced] Compression failed, using original:', compressionError);
        // Continue with original file
      }
    }

    // Generate unique filename with better naming
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    const fileExt = compressedFile.name.split('.').pop().toLowerCase();
    const fileName = `${timestamp}-${randomId}.${fileExt}`;

    // Try multiple bucket strategies with proper paths
    const bucketStrategies = [
      { bucket: 'post_images', path: `${userId}/${fileName}` },
      { bucket: 'post_images', path: fileName },
      { bucket: 'avatars', path: `posts/${fileName}` },
      { bucket: 'public', path: `posts/${fileName}` }
    ];

    let uploadResult = null;
    let lastError = null;

    for (const strategy of bucketStrategies) {
      try {
        console.log(`[uploadPostImageEnhanced] Trying bucket: ${strategy.bucket}, path: ${strategy.path}`);
        if (aborted) throw new DOMException('Aborted', 'AbortError');
        // Simulated progress during upload
        if (onProgress) {
          let simulated = 5; // start after compression
          try { onProgress(simulated); } catch {}
          progressTimer = setInterval(() => {
            if (aborted) return; // Don't update if aborted flag set
            simulated = Math.min(90, simulated + Math.random() * 6 + 2);
            try { onProgress(Math.round(simulated)); } catch {}
          }, 250);
        }

        const { data, error } = await supabase.storage
          .from(strategy.bucket)
          .upload(strategy.path, compressedFile, {
            cacheControl: '3600',
            upsert: true,
            ...options.uploadOptions
          });

        if (error) {
          lastError = error;
          console.warn(`[uploadPostImageEnhanced] Bucket ${strategy.bucket} failed:`, error.message);
          continue;
        }

        // Get public URL
        const publicUrl = supabase.storage
          .from(strategy.bucket)
          .getPublicUrl(strategy.path).data.publicUrl;

        console.log('[uploadPostImageEnhanced] Upload successful:', {
          bucket: strategy.bucket,
          filePath: strategy.path,
          publicUrl,
          hasUrl: !!publicUrl
        });

        uploadResult = {
          publicUrl,
          bucket: strategy.bucket,
          path: strategy.path,
          data
        };
        break;
      } catch (strategyError) {
        lastError = strategyError;
        console.warn(`[uploadPostImageEnhanced] Strategy ${strategy.bucket} error:`, strategyError);
        continue;
      } finally {
        cleanup();
      }
    }

    if (!uploadResult) {
      return { 
        publicUrl: null, 
        error: lastError || 'All upload strategies failed',
        metadata: null 
      };
    }

    const uploadDuration = performance.now() - uploadStart;
    
    // Create metadata object
    const metadata = {
      originalFileName: file.name,
      originalSize: file.size,
      compressedSize: compressedFile.size,
      compressionApplied,
      compressionRatio: compressionApplied ? (file.size / compressedFile.size).toFixed(2) : 1,
      fileType: file.type,
      uploadDuration: Math.round(uploadDuration),
      bucket: uploadResult.bucket,
      path: uploadResult.path,
      timestamp: new Date().toISOString()
    };

    console.log('[uploadPostImageEnhanced] Upload successful:', {
      publicUrl: uploadResult.publicUrl,
      metadata
    });

    return { 
      publicUrl: uploadResult.publicUrl, 
      error: null,
      metadata 
    };

  } catch (error) {
    console.error('[uploadPostImageEnhanced] Unexpected error:', error);
    return { 
      publicUrl: null, 
      error: error?.name === 'AbortError' ? 'Upload aborted' : (error.message || 'Unexpected upload error'),
      metadata: null 
    };
  }
}

/**
 * Validate image file before upload
 * @param {File} file - File to validate
 * @param {object} options - Validation options
 * @returns {object} - Validation result
 */
export function validateImageFile(file, options = {}) {
  const errors = [];
  
  if (!file) {
    errors.push('No file provided');
    return { isValid: false, errors };
  }

  // File type validation
  const allowedTypes = options.allowedTypes || ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(file.type)) {
    errors.push(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`);
  }

  // File size validation
  const maxSize = (options.maxSizeMB || 10) * 1024 * 1024;
  if (file.size > maxSize) {
    errors.push(`File too large. Maximum size: ${options.maxSizeMB || 10}MB`);
  }

  const minSize = (options.minSizeKB || 1) * 1024;
  if (file.size < minSize) {
    errors.push(`File too small. Minimum size: ${options.minSizeKB || 1}KB`);
  }

  // File name validation
  if (file.name.length > 255) {
    errors.push('File name too long (max 255 characters)');
  }

  return {
    isValid: errors.length === 0,
    errors,
    fileInfo: {
      name: file.name,
      size: file.size,
      type: file.type,
      sizeKB: Math.round(file.size / 1024),
      sizeMB: (file.size / (1024 * 1024)).toFixed(2)
    }
  };
}

/**
 * Get image dimensions from file
 * @param {File} file - Image file
 * @returns {Promise<object>} - Image dimensions
 */
export function getImageDimensions(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('File is not an image'));
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
        aspectRatio: (img.naturalWidth / img.naturalHeight).toFixed(2)
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

/**
 * Create image preview URL
 * @param {File} file - Image file
 * @returns {string} - Preview URL
 */
export function createImagePreview(file) {
  if (!file || !file.type.startsWith('image/')) {
    return null;
  }
  return URL.createObjectURL(file);
}

/**
 * Clean up image preview URL
 * @param {string} previewUrl - Preview URL to clean up
 */
export function cleanupImagePreview(previewUrl) {
  if (previewUrl && previewUrl.startsWith('blob:')) {
    URL.revokeObjectURL(previewUrl);
  }
}

/**
 * Delete image from storage
 * @param {string} imageUrl - Image URL to delete
 * @param {string} userId - User ID (for security)
 * @returns {Promise<object>} - Deletion result
 */
export async function deletePostImage(imageUrl, userId) {
  if (!imageUrl || !userId) {
    return { success: false, error: 'Missing required parameters' };
  }

  try {
    // Extract bucket and path from URL
    const url = new URL(imageUrl);
    const pathParts = url.pathname.split('/');
    const bucket = pathParts[pathParts.length - 2]; // Assuming bucket is second to last
    const fileName = pathParts[pathParts.length - 1];

    // Security check: ensure the file belongs to the user
    if (!fileName.startsWith(userId)) {
      return { success: false, error: 'Unauthorized: File does not belong to user' };
    }

    const { data, error } = await supabase.storage
      .from(bucket)
      .remove([fileName]);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}