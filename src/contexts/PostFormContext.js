'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// Create the context
const PostFormContext = createContext();

// Post form provider component
export const PostFormProvider = ({ children }) => {
  // Initialize state from localStorage if available
  const initialState = {
    isSubmitting: false,
    submissionProgress: '',
    backgroundSubmission: false,
    isCancelled: false,
    description: '',
    imagePreview: '',
    imageUrl: '',
    selectedStock: null,
    currentPrice: null,
    targetPrice: '',
    stopLossPrice: '',
    selectedStrategy: '',
    targetPercentage: 5,
    stopLossPercentage: 5,
    postData: null,
    imageFile: null,
  };

  const [formState, setFormState] = useState(initialState);

  // Save state to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && formState) {
      // Create a copy without the imageFile which can't be serialized
      const stateToSave = {
        ...formState,
        imageFile: null, // Don't try to serialize File objects
      };
      
      localStorage.setItem('postFormState', JSON.stringify(stateToSave));
    }
  }, [formState]);

  // Update form state
  const updateFormState = useCallback((newState) => {
    setFormState(prevState => ({ ...prevState, ...newState }));
  }, []);

  // Explicitly set background submission state
  const setBackgroundSubmission = useCallback((isBackground) => {
    setFormState(prevState => ({ ...prevState, backgroundSubmission: isBackground }));
  }, []);

  // Function to request cancellation
  const requestCancellation = useCallback((cancel = true) => {
    console.log(`Cancellation requested: ${cancel}`);
    setFormState(prevState => ({
      ...prevState,
      isCancelled: cancel,
      isSubmitting: false,
      submissionProgress: cancel ? 'Cancelling submission...' : prevState.submissionProgress
    }));
    
    // Set a timeout to reset all states after cancellation
    if (cancel) {
      setTimeout(() => {
        setFormState(prevState => ({
          ...prevState,
          backgroundSubmission: false,
          isCancelled: false,
          isSubmitting: false,
          submissionProgress: '',
        }));
      }, 1000); // Short delay to show cancellation message
    }
  }, []);

  // Function to handle dialog cancellation during submission
  const handleDialogCancel = useCallback(() => {
    console.log('Dialog cancel requested');
    if (formState.isSubmitting) {
      // If currently submitting, set background submission and request cancellation
      setFormState(prevState => ({
        ...prevState,
        backgroundSubmission: true,
        isCancelled: true,
        submissionProgress: 'Cancelling in background...'
      }));
      return true; // Indicate submission is ongoing
    }
    // If not submitting, just clear the form
    clearFormState();
    return false; // Indicate no ongoing submission
  }, [formState.isSubmitting]);

  // Updated clearFormState to reset cancellation flag
  const clearFormState = useCallback(() => {
    console.log('Clearing form state');
    setFormState(initialState);
  }, [initialState]);

  // Context value
  const value = {
    formState,
    updateFormState,
    clearFormState,
    handleDialogCancel,
    setBackgroundSubmission,
    requestCancellation,
  };

  return (
    <PostFormContext.Provider value={value}>
      {children}
    </PostFormContext.Provider>
  );
};

// Hook for using the post form context
export const usePostForm = () => useContext(PostFormContext); 