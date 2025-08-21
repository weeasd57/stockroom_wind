'use client';

import { useState, useCallback } from 'react';
import { useSupabase } from '@/providers/SupabaseProvider';
import { useCreatePostForm } from '@/providers/CreatePostFormProvider';
import ImageUploadEnhanced from './ImageUploadEnhanced';
import RTLTextArea from './RTLTextArea';
import { toast } from 'sonner';
import { useBackgroundPostCreation } from '@/providers/BackgroundPostCreationProvider';

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
  // Background post creation
  const { startBackgroundPostCreation } = useBackgroundPostCreation();

  // Local image selection state for deferred/background upload
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState(null);

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
        // image_url will be set by the background provider if upload completes
        strategy: selectedStrategy || null,
        is_public: true,
        status: 'open',
        status_message: 'open'
      };

      // Start background task (imageFile or existingImageUrl)
      const taskId = startBackgroundPostCreation({
        postData,
        imageFile: selectedImageFile || null,
        existingImageUrl: uploadedImageUrl || null,
        title: `Posting ${selectedStock.symbol}`
      });

      console.log('Background post creation started with taskId:', taskId);
      toast.success('Creating post in background. You can continue browsing.');

      // Reset form and close dialog immediately
      resetForm();
      setSelectedImageFile(null);
      setUploadedImageUrl(null);
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
            autoUpload={false}
            onFileSelected={(payload) => {
              setSelectedImageFile(payload?.file || null);
              // Clear any previously uploaded URL if user changed the file
              if (payload?.file) setUploadedImageUrl(null);
            }}
            onImageUploaded={(result) => {
              // In case autoUpload is enabled in future, capture the URL
              setUploadedImageUrl(result?.url || null);
            }}
            onImageRemoved={() => {
              setSelectedImageFile(null);
              setUploadedImageUrl(null);
            }}
            userId={user?.id}
            disabled={isFormSubmitting}
            maxSizeMB={5}
            allowedTypes={['image/jpeg', 'image/jpg', 'image/png', 'image/webp']}
          />
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
              setSelectedImageFile(null);
              setUploadedImageUrl(null);
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
              hasSelectedImageFile: !!selectedImageFile,
              uploadedImageUrl,
              isSubmitting: isFormSubmitting
            }, null, 2)}</pre>
          </div>
        )}
      </form>
    </div>
  );
}