/**
 * Image optimization and compression utilities
 */

/**
 * Compresses an image file to reduce size while maintaining reasonable quality
 * @param {File} file - The image file to compress
 * @param {Object} options - Compression options
 * @param {number} options.maxSizeMB - Maximum size in MB (default: 1)
 * @param {number} options.maxWidthOrHeight - Maximum dimension (default: 1920)
 * @param {boolean} options.useWebWorker - Whether to use web worker (default: true)
 * @returns {Promise<File>} - Compressed image file
 */
export async function compressImage(file, options = {}) {
  // Default options
  const defaultOptions = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true
  };

  // Merge options
  const settings = { ...defaultOptions, ...options };

  // Early return if file is already small
  if (file.size <= settings.maxSizeMB * 1024 * 1024) {
    console.log('Image already under size limit, skipping compression');
    return file;
  }

  try {
    // Load compression library dynamically
    const imageCompression = await import('browser-image-compression');
    
    // Compress the image
    const compressedFile = await imageCompression.default(file, settings);
    
    // If compressed file is larger than original (rare), return original
    if (compressedFile.size >= file.size) {
      console.log('Compression resulted in larger file size, using original');
      return file;
    }
    
    return compressedFile;
  } catch (error) {
    console.error('Image compression failed:', error);
    // Return original file if compression fails
    return file;
  }
}

/**
 * Resizes an image using canvas for more control
 * @param {File} file - Image file to resize
 * @param {number} maxWidth - Maximum width
 * @param {number} maxHeight - Maximum height
 * @param {number} quality - JPEG quality (0-1)
 * @returns {Promise<File>} - Resized image as a File
 */
export async function resizeImage(file, maxWidth = 1920, maxHeight = 1080, quality = 0.8) {
  return new Promise((resolve, reject) => {
    try {
      // Create file reader to read the file as data URL
      const reader = new FileReader();
      
      reader.onload = (readerEvent) => {
        // Create an image element to load the file
        const img = new Image();
        
        img.onload = () => {
          // Calculate new dimensions maintaining aspect ratio
          let width = img.width;
          let height = img.height;
          
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.floor(width * ratio);
            height = Math.floor(height * ratio);
          }
          
          // No need to resize if dimensions are already within limits
          if (width === img.width && height === img.height && file.type === 'image/jpeg') {
            resolve(file);
            return;
          }
          
          // Create canvas and context for resizing
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          
          // Draw the image on the canvas
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          // Convert canvas to blob (file)
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('Canvas to Blob conversion failed'));
              return;
            }
            
            // Create a new File from the blob
            const resizedFile = new File(
              [blob],
              file.name,
              { type: 'image/jpeg', lastModified: Date.now() }
            );
            
            resolve(resizedFile);
          }, 'image/jpeg', quality);
        };
        
        img.onerror = () => {
          reject(new Error('Error loading image'));
        };
        
        // Set image source from reader result
        img.src = readerEvent.target.result;
      };
      
      reader.onerror = () => {
        reject(new Error('Error reading file'));
      };
      
      // Read the file
      reader.readAsDataURL(file);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Updates CSS styles to add the necessary styles for image compression UI elements
 */
export function injectImageCompressionStyles() {
  // Only inject if in browser environment
  if (typeof document === 'undefined') return;
  
  // Check if already injected
  if (document.getElementById('image-compression-styles')) return;
  
  // Create style element
  const style = document.createElement('style');
  style.id = 'image-compression-styles';
  
  // Add compression-related styles
  style.innerHTML = `
    .image-compression-badge {
      position: absolute;
      top: 10px;
      left: 10px;
      background-color: rgba(0, 0, 0, 0.7);
      color: white;
      border-radius: 4px;
      padding: 4px 8px;
      font-size: 12px;
      font-weight: 500;
      animation: pulse 1.5s infinite;
    }
    
    .compression-info {
      margin-top: 8px;
      font-size: 12px;
      color: var(--success-color, green);
      background-color: var(--success-background, rgba(0, 128, 0, 0.1));
      padding: 6px 10px;
      border-radius: 4px;
      text-align: center;
    }
    
    @keyframes pulse {
      0% { opacity: 0.7; }
      50% { opacity: 1; }
      100% { opacity: 0.7; }
    }
  `;
  
  // Append to document head
  document.head.appendChild(style);
}

// Auto-inject styles when module loads in browser
if (typeof window !== 'undefined') {
  // Use setTimeout to ensure DOM is ready
  setTimeout(injectImageCompressionStyles, 0);
} 