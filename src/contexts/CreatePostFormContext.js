'use client';

import { createContext, useState, useContext, useCallback, useEffect } from 'react';

// Create the context
const CreatePostFormContext = createContext(null);

// Initial form state
const initialFormState = {
  description: '',
  imageFile: null,
  imagePreview: '',
  imageUrl: '',
  stockSearch: '',
  searchResults: [],
  selectedStock: null,
  currentPrice: null,
  targetPrice: '',
  stopLossPrice: '',
  selectedStrategy: '',
  targetPercentage: 5,
  stopLossPercentage: 5,
  isSubmitting: false,
  submissionProgress: ''
};

// Provider component
export function CreatePostFormProvider({ children }) {
  const [formState, setFormState] = useState(initialFormState);
  const [dialogOpen, setDialogOpen] = useState(false);
  // New state for global status indicator that persists even when dialog is closed
  const [globalStatus, setGlobalStatus] = useState({
    visible: false,
    type: 'processing', // 'processing', 'success', or 'error'
    message: '',
  });

  // Update a single field in the form state
  const updateField = useCallback((field, value) => {
    setFormState(prev => ({
      ...prev,
      [field]: value
    }));

    // Special handling for submission status - update the global status too
    if (field === 'isSubmitting') {
      if (value === true) {
        setGlobalStatus(prev => ({
          ...prev,
          visible: true,
          type: 'processing'
        }));
      }
    }

    if (field === 'submissionProgress') {
      setGlobalStatus(prev => ({
        ...prev,
        message: value,
        type: value.includes('success') ? 'success' : 
              value.includes('Error') ? 'error' : 'processing'
      }));
    }
  }, []);

  // Update multiple fields at once
  const updateFields = useCallback((updates) => {
    setFormState(prev => ({
      ...prev,
      ...updates
    }));
  }, []);

  // Reset the form state
  const resetForm = useCallback(() => {
    setFormState(initialFormState);
  }, []);

  // Show/hide the global status indicator
  const setGlobalStatusVisibility = useCallback((visible, message = '', type = 'processing') => {
    // If we're explicitly hiding the status, do it immediately without conditions
    if (visible === false) {
      setGlobalStatus({
        visible: false,
        message: '',
        type: 'processing'
      });
      return;
    }
    
    // Only show indicator for post fetching, not for post creation success
    if (type === 'success' && message.includes('Post')) {
      setGlobalStatus({
        visible: false,
        message: '',
        type: 'processing'
      });
      return;
    }
    
    // Only show the processing indicator if it's about fetching posts
    if (type === 'processing' && !message.includes('fetch') && !message.includes('Fetching')) {
      // Don't show processing indicator for other operations
      return;
    }
    
    setGlobalStatus({
      visible,
      message,
      type
    });
  }, []);

  // Handle dialog open/close
  const openDialog = useCallback(() => {
    setDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    // Only close if not submitting
    if (!formState.isSubmitting) {
      setDialogOpen(false);
    }
  }, [formState.isSubmitting]);

  const forceCloseDialog = useCallback(() => {
    // Close the dialog but keep the global status indicator visible
    setDialogOpen(false);
    // Only update form's submission state - don't affect the global indicator
    setFormState(prev => ({
      ...prev,
      isSubmitting: false,
    }));
  }, []);

  // Manage body scroll when dialog is open
  useEffect(() => {
    if (dialogOpen) {
      // Get current scroll position
      const scrollY = window.scrollY;
      
      // Prevent scrolling when dialog is open by fixing body position
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
      
      // Restore scrolling when dialog is closed
      return () => {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        
        // Restore scroll position
        window.scrollTo(0, scrollY);
      };
    }
  }, [dialogOpen]);

  // Reset submission state to re-enable buttons after cancellation
  const resetSubmitState = useCallback(() => {
    console.log('Resetting submit state to prepare for future operations');
    
    // Reset form state completely
    setFormState(prev => ({
      ...prev,
      isSubmitting: false,
      submissionProgress: '',
      // Reset search-related values to start clean
      searchResults: [],
      stockSearch: '',
      // Keep other values intact
    }));
    
    // Ensure the global status is completely reset
    setGlobalStatus({
      visible: false,
      type: 'processing',
      message: ''
    });
    
    // Add a small delay to allow React state updates to propagate
    setTimeout(() => {
      console.log('Submit state reset complete');
    }, 100);
  }, []);

  // Context value
  const value = {
    formState,
    updateField,
    updateFields,
    resetForm,
    dialogOpen,
    openDialog,
    closeDialog,
    forceCloseDialog,
    globalStatus,
    setGlobalStatusVisibility,
    resetSubmitState
  };

  return (
    <CreatePostFormContext.Provider value={value}>
      {children}
    </CreatePostFormContext.Provider>
  );
}

// Custom hook for using the context
export function useCreatePostForm() {
  const context = useContext(CreatePostFormContext);
  if (!context) {
    throw new Error('useCreatePostForm must be used within a CreatePostFormProvider');
  }
  return context;
} 