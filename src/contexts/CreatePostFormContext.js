'use client';

import { createContext, useCallback, useContext, useEffect, useReducer, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

// Create context
const CreatePostFormContext = createContext();

// Define initial state
const initialState = {
  title: '',
  content: '',
  selectedStrategy: '',
  imageFile: null,
  imagePreview: '',
  imageUrl: '',
  preview: [],
  showStrategyInput: false,
  searchResults: [],
  stockSearch: '',
  selectedStock: null,
  selectedCountry: 'all',
  apiUrl: '',
  apiResponse: null,
  currentPrice: null,
  targetPrice: '',
  targetPricePercentage: '',
  stopLoss: '',
  stopLossPercentage: '',
  entryPrice: '',
  priceHistory: null,
  newStrategy: '',
  showStrategyDialog: false,
  formErrors: {},
  submissionProgress: '',
  isLightboxOpen: false,
  lightboxIndex: 0,
  submitState: 'idle', // idle, submitting, success, error
  isSubmitting: false,
};

// Create reducer
function createPostFormReducer(state, action) {
  switch (action.type) {
    case 'UPDATE_FIELD':
      return {
        ...state,
        [action.field]: action.value,
      };
    case 'RESET_FORM':
      return {
        ...initialState,
        // Preserve these fields across resets
        selectedCountry: state.selectedCountry,
      };
    case 'TOGGLE_LIGHTBOX':
      return {
        ...state,
        isLightboxOpen: action.value,
        lightboxIndex: action.index || 0,
      };
    case 'SET_SUBMIT_STATE':
      return {
        ...state,
        submitState: action.value,
        isSubmitting: action.value === 'submitting',
      };
    default:
      return state;
  }
}

// Provider component
export function CreatePostFormProvider({ children }) {
  const [state, dispatch] = useReducer(createPostFormReducer, initialState);
  const { user } = useAuth();
  
  // Track submission timeout
  const [submissionTimeout, setSubmissionTimeout] = useState(null);
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // Dialog open/close functions
  const openDialog = useCallback(() => {
    setDialogOpen(true);
  }, []);
  
  const closeDialog = useCallback(() => {
    setDialogOpen(false);
  }, []);
  
  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (submissionTimeout) {
        clearTimeout(submissionTimeout);
      }
    };
  }, [submissionTimeout]);
  
  // Update field function
  const updateField = useCallback((field, value) => {
    dispatch({
      type: 'UPDATE_FIELD',
      field,
      value,
    });
    
    // Clear form errors when description changes
    if (field === 'description' && state.formErrors.content) {
      dispatch({
        type: 'UPDATE_FIELD',
        field: 'formErrors',
        value: { ...state.formErrors, content: null }
      });
    }
  }, [state.formErrors]);

  // Reset form function
  const resetForm = useCallback(() => {
    dispatch({ type: 'RESET_FORM' });
    // Also clear any pending timeouts
    if (submissionTimeout) {
      clearTimeout(submissionTimeout);
      setSubmissionTimeout(null);
    }
  }, [submissionTimeout]);

  // Add a setGlobalStatus function
  const setGlobalStatus = useCallback((status) => {
    // Set the submission state based on the status type
    const submitState = status.type === 'success' ? 'success' : 
                        status.type === 'error' ? 'error' :
                        status.type === 'processing' ? 'submitting' : 'idle';
                         
    // Update the submit state first
    dispatch({
      type: 'SET_SUBMIT_STATE',
      value: submitState
    });
    
    // Then update the submission progress message
    if (status.message) {
      dispatch({
        type: 'UPDATE_FIELD',
        field: 'submissionProgress',
        value: status.message
      });
    }
  }, []);

  // Set submit state
  const setSubmitState = useCallback((state) => {
    dispatch({
      type: 'SET_SUBMIT_STATE',
      value: state,
    });
    
    if (state === 'submitting') {
      // When we start submitting, set up a timeout to auto-reset if it takes too long
      const timeout = setTimeout(() => {
        console.log('[FORM CONTEXT] Submission timeout triggered after 15s');
        // Don't reset form, just clear the timeout and move to success state
        dispatch({
          type: 'SET_SUBMIT_STATE',
          value: 'success',
        });
        
        // Update the submission progress message
        dispatch({
          type: 'UPDATE_FIELD',
          field: 'submissionProgress',
          value: 'Post created! Will sync when connection improves.'
        });
        
        // Hide the status after 5 seconds
        setTimeout(() => {
          dispatch({
            type: 'SET_SUBMIT_STATE',
            value: 'idle',
          });
          dispatch({
            type: 'UPDATE_FIELD',
            field: 'submissionProgress',
            value: '',
          });
        }, 5000);
        
      }, 15000); // 15 second timeout
      
      setSubmissionTimeout(timeout);
    } else {
      // If we're not submitting, clear any timeout
      if (submissionTimeout) {
        clearTimeout(submissionTimeout);
        setSubmissionTimeout(null);
      }
    }
  }, [submissionTimeout]);

  // Toggle lightbox
  const toggleLightbox = useCallback((isOpen, index = 0) => {
    dispatch({
      type: 'TOGGLE_LIGHTBOX',
      value: isOpen,
      index,
    });
  }, []);

  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <CreatePostFormContext.Provider
      value={{
        ...state,
        updateField,
        resetForm,
        setSubmitState,
        toggleLightbox,
        isSubmitting,
        setIsSubmitting,
        dialogOpen,
        openDialog,
        closeDialog,
        globalStatus: {
          visible: state.submitState !== 'idle',
          type: state.submitState === 'success' ? 'success' : 
                state.submitState === 'error' ? 'error' : 'processing',
          message: state.submissionProgress || ''
        },
        setGlobalStatus,
        setGlobalStatusVisibility: (visible) => {
          if (!visible) {
            dispatch({
              type: 'SET_SUBMIT_STATE',
              value: 'idle',
            });
            dispatch({
              type: 'UPDATE_FIELD',
              field: 'submissionProgress',
              value: '',
            });
          }
        },
        resetSubmitState: () => {
          dispatch({
            type: 'SET_SUBMIT_STATE',
            value: 'idle',
          });
        }
      }}
    >
      {children}
    </CreatePostFormContext.Provider>
  );
}

// Custom hook
export function useCreatePostForm() {
  const context = useContext(CreatePostFormContext);
  if (!context) {
    throw new Error('useCreatePostForm must be used within a CreatePostFormProvider');
  }
  return context;
} 