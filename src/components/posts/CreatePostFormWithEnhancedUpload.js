'use client';

import { useState, useCallback } from 'react';
import { useSupabase } from '@/providers/SupabaseProvider';
import { useCreatePostForm } from '@/providers/CreatePostFormProvider';
import { useImageUpload } from '@/hooks/useImageUpload';
import ImageUploadEnhanced from './ImageUploadEnhanced';
import RTLTextArea from './RTLTextArea';
import { toast } from 'sonner';

/**
 * Enhanced CreatePostForm with improved image upload and RTL support
 * This is an example of how to integrate the enhanced image upload system
 */
export default function CreatePostFormWithEnhancedUpload() {
  const { user } = useSupabase();
  const { 
    updateField, 
    resetForm, 
    closeDialog,
    title = '',
    description = '',
    selectedStock = null,
    currentPrice = null,
    targetPrice = '',
    stopLossPrice = '',
    selectedStrategy = '',
    isSubmitting = false
  } = useCreatePostForm() || {};

  const [isFormSubmitting, setIsFormSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  // Enhanced image upload hook
  const imageUpload = useImageUpload({
    userId: user?.id,
    maxSizeMB: 5,
    allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
    autoUpload: true, // Upload immediately when file is selected
    onUploadSuccess: (result) => {
      toast.success('Image uploaded successfully!');
      console.log('Image uploaded:', result);
    },
    onUploadError: (error) => {
      toast.error(`Upload failed: ${error.message}`);
      console.error('Upload error:', error);
    }
  });

  // Handle form submission
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    if (isFormSubmitting || isSubmitting) return;

    // Reset errors
    setFormErrors({});

    // Basic validation
    const errors = {};
    if (!selectedStock?.symbol) {
      errors.stock = 'Please select a stock symbol';
    }
    if (!description?.trim()) {
      errors.description = 'Please enter a description';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      setIsFormSubmitting(true);

      // Wait for image upload to complete if still uploading
      if (imageUpload.isUploading) {
        toast.info('Waiting for image upload to complete...');
        // You could implement a polling mechanism here or use a promise
        // For now, we'll just wait a bit
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Prepare post data
      const postData = {
        user_id: user.id,
        symbol: selectedStock.symbol,
        country: selectedStock.country,
        content: description.trim().slice(0, 255), // Short summary for content field
        description: description.trim(), // Full description
        current_price: currentPrice || 0,
        initial_price: currentPrice || 0,
        target_price: parseFloat(targetPrice) || currentPrice || 0,
        stop_loss_price: parseFloat(stopLossPrice) || currentPrice || 0,
        company_name: selectedStock.name || selectedStock.symbol,
        exchange: selectedStock.exchange || '',
        image_url: imageUpload.uploadedImageUrl || null, // Use uploaded image URL
        strategy: selectedStrategy || null,
        is_public: true,
        status: 'open',
        status_message: 'open'
      };

      console.log('Submitting post with data:', postData);

      // Here you would call your createPost function
      // const result = await createPost(postData);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      toast.success('Post created successfully!');
      
      // Reset form and close dialog
      resetForm();
      imageUpload.removeImage();
      if (closeDialog) closeDialog();

    } catch (error) {
      console.error('Error creating post:', error);
      toast.error(`Failed to create post: ${error.message}`);
      setFormErrors({ general: error.message });
    } finally {
      setIsFormSubmitting(false);
    }
  }, [
    isFormSubmitting, 
    isSubmitting, 
    selectedStock, 
    description, 
    user, 
    currentPrice, 
    targetPrice, 
    stopLossPrice, 
    selectedStrategy, 
    imageUpload, 
    resetForm, 
    closeDialog
  ]);

  return (
    <div className="create-post-form-enhanced">
      <form onSubmit={handleSubmit} className="form-container">
        
        {/* Stock Selection Section */}
        {selectedStock && (
          <div className="form-section">
            <h3>Selected Stock</h3>
            <div className="stock-display">
              <div className="stock-info">
                <span className="stock-symbol">{selectedStock.symbol}</span>
                <span className="stock-name">{selectedStock.name}</span>
                <span className="stock-country">{selectedStock.country}</span>
              </div>
              {currentPrice && (
                <div className="price-info">
                  <span className="current-price">${currentPrice}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Description Section with RTL Support */}
        <div className="form-section">
          <label htmlFor="description" className="form-label">
            What's your analysis? <span className="required">*</span>
          </label>
          <RTLTextArea
            id="description"
            value={description}
            onChange={(e) => updateField('description', e.target.value)}
            placeholder="Share your stock analysis, trading strategy, or market insights..."
            rows={4}
            maxLength={1000}
            className={formErrors.description ? 'error' : ''}
          />
          {formErrors.description && (
            <div className="error-message">{formErrors.description}</div>
          )}
        </div>

        {/* Enhanced Image Upload Section */}
        <div className="form-section">
          <label className="form-label">
            Chart or Analysis Image
            <span className="optional">(Optional)</span>
          </label>
          <ImageUploadEnhanced
            onImageUploaded={(result) => {
              console.log('Image uploaded in form:', result);
              // The hook already handles this, but you can add additional logic here
            }}
            onImageRemoved={() => {
              console.log('Image removed in form');
            }}
            userId={user?.id}
            disabled={isFormSubmitting}
            maxSizeMB={5}
            allowedTypes={['image/jpeg', 'image/jpg', 'image/png', 'image/webp']}
          />
          
          {/* Upload Status Display */}
          {imageUpload.isUploading && (
            <div className="upload-status">
              <div className="upload-progress">
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${imageUpload.uploadProgress}%` }}
                  ></div>
                </div>
                <span>Uploading... {imageUpload.uploadProgress}%</span>
              </div>
            </div>
          )}

          {imageUpload.isSuccess && imageUpload.uploadedImageUrl && (
            <div className="upload-success">
              <span className="success-icon">✓</span>
              <span>Image ready for post!</span>
              <a 
                href={imageUpload.uploadedImageUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="view-link"
              >
                View
              </a>
            </div>
          )}

          {imageUpload.error && (
            <div className="upload-error">
              <span className="error-icon">⚠️</span>
              <span>{imageUpload.error}</span>
              <button 
                type="button"
                onClick={imageUpload.retryUpload}
                className="retry-button"
              >
                Retry
              </button>
            </div>
          )}
        </div>

        {/* Price Analysis Section */}
        {currentPrice && (
          <div className="form-section">
            <h3>Price Analysis</h3>
            <div className="price-inputs">
              <div className="input-group">
                <label htmlFor="targetPrice">Target Price</label>
                <input
                  id="targetPrice"
                  type="number"
                  step="0.01"
                  value={targetPrice}
                  onChange={(e) => updateField('targetPrice', e.target.value)}
                  placeholder="Enter target price"
                />
              </div>
              <div className="input-group">
                <label htmlFor="stopLossPrice">Stop Loss Price</label>
                <input
                  id="stopLossPrice"
                  type="number"
                  step="0.01"
                  value={stopLossPrice}
                  onChange={(e) => updateField('stopLossPrice', e.target.value)}
                  placeholder="Enter stop loss price"
                />
              </div>
            </div>
          </div>
        )}

        {/* Strategy Section */}
        <div className="form-section">
          <label htmlFor="strategy" className="form-label">
            Trading Strategy
            <span className="optional">(Optional)</span>
          </label>
          <select
            id="strategy"
            value={selectedStrategy}
            onChange={(e) => updateField('selectedStrategy', e.target.value)}
            className="form-select"
          >
            <option value="">Select a strategy</option>
            <option value="Long Term Investment">Long Term Investment</option>
            <option value="Swing Trading">Swing Trading</option>
            <option value="Day Trading">Day Trading</option>
            <option value="Value Investing">Value Investing</option>
            <option value="Growth Investing">Growth Investing</option>
            <option value="Technical Analysis">Technical Analysis</option>
            <option value="Fundamental Analysis">Fundamental Analysis</option>
          </select>
        </div>

        {/* Form Actions */}
        <div className="form-actions">
          <button
            type="button"
            onClick={() => {
              resetForm();
              imageUpload.removeImage();
              if (closeDialog) closeDialog();
            }}
            className="cancel-button"
            disabled={isFormSubmitting}
          >
            Cancel
          </button>
          
          <button
            type="submit"
            className="submit-button"
            disabled={
              isFormSubmitting || 
              imageUpload.isUploading || 
              !selectedStock?.symbol || 
              !description?.trim()
            }
          >
            {isFormSubmitting ? 'Creating Post...' : 'Create Post'}
          </button>
        </div>

        {/* General Error */}
        {formErrors.general && (
          <div className="general-error">
            <span className="error-icon">⚠️</span>
            <span>{formErrors.general}</span>
          </div>
        )}

        {/* Debug Info (remove in production) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="debug-info">
            <h4>Debug Info:</h4>
            <pre>{JSON.stringify({
              hasStock: !!selectedStock,
              hasDescription: !!description?.trim(),
              imageState: imageUpload.uploadState,
              imageUrl: imageUpload.uploadedImageUrl,
              isSubmitting: isFormSubmitting
            }, null, 2)}</pre>
          </div>
        )}
      </form>
    </div>
  );
}