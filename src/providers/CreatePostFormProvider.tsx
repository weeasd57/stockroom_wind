"use client";

import React, { createContext, useContext, useState, useReducer, useCallback, useEffect } from 'react';
import { useSupabase } from '@/providers/SupabaseProvider';

interface CreatePostFormState {
  title: string;
  content: string;
  selectedStrategy: string;
  imageFile: File | null;
  imagePreview: string;
  imageUrl: string;
  preview: any[];
  showStrategyInput: boolean;
  searchResults: any[];
  stockSearch: string;
  selectedStock: any | null;
  selectedCountry: string;
  apiUrl: string;
  apiResponse: any | null;
  currentPrice: number | null;
  targetPrice: string;
  targetPricePercentage: string;
  stopLoss: string;
  stopLossPercentage: string;
  entryPrice: string;
  priceHistory: any | null;
  priceError: string | null; // Added priceError
  newStrategy: string;
  showStrategyDialog: boolean;
  formErrors: Record<string, string>;
  submissionProgress: string;
  isLightboxOpen: boolean;
  lightboxIndex: number;
  submitState: 'idle' | 'submitting' | 'success' | 'error';
  isSubmitting: boolean;
  dialogOpen: boolean;
  selectedImageFile: File | null; // Added selectedImageFile
}

interface CreatePostFormContextType extends CreatePostFormState {
  updateField: (field: keyof CreatePostFormState, value: any) => void;
  resetForm: () => void;
  setSubmitState: (state: CreatePostFormState['submitState']) => void;
  toggleLightbox: (isOpen: boolean, index?: number) => void;
  setIsSubmitting: (value: boolean) => void;
  openDialog: () => void;
  closeDialog: () => void;
  globalStatus: {
    visible: boolean;
    type: string;
    message: string;
  };
  setGlobalStatus: (status: { type: string; message?: string }) => void;
  setGlobalStatusVisibility: (visible: boolean) => void;
  resetSubmitState: () => void;
  setPriceError: (error: string | null) => void; // Added setPriceError
  setSelectedImageFile: (file: File | null) => void; // Added setSelectedImageFile
  isOpen: boolean;
}

const initialState: CreatePostFormState = {
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
  priceError: null,
  newStrategy: '',
  showStrategyDialog: false,
  formErrors: {},
  submissionProgress: '',
  isLightboxOpen: false,
  lightboxIndex: 0,
  submitState: 'idle',
  isSubmitting: false,
  dialogOpen: false,
  selectedImageFile: null,
};

const CreatePostFormContext = createContext<CreatePostFormContextType | undefined>(undefined);

function createPostFormReducer(state: CreatePostFormState, action: any): CreatePostFormState {
  switch (action.type) {
    case 'UPDATE_FIELD':
      return {
        ...state,
        [action.field]: action.value
      };
    case 'RESET_FORM':
      return {
        ...initialState,
        searchResults: state.searchResults,
        dialogOpen: state.dialogOpen
      } as CreatePostFormState;
    case 'SET_SUBMIT_STATE':
      return {
        ...state,
        submitState: action.value
      };
    case 'TOGGLE_LIGHTBOX':
      return {
        ...state,
        isLightboxOpen: action.value,
        lightboxIndex: action.index
      };
    case 'OPEN_DIALOG':
      return {
        ...state,
        dialogOpen: true
      };
    case 'CLOSE_DIALOG':
      return {
        ...state,
        dialogOpen: false
      };
    default:
      return state;
  }
}

export function CreatePostFormProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(createPostFormReducer, initialState);
  const { user } = useSupabase();
  const [submissionTimeout, setSubmissionTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  
  const openDialog = useCallback(() => {
    dispatch({
      type: 'OPEN_DIALOG',
      value: true
    });
  }, []);
  
  const closeDialog = useCallback(() => {
    dispatch({
      type: 'CLOSE_DIALOG',
      value: false
    });
  }, []);
  
  useEffect(() => {
    return () => {
      if (submissionTimeout) {
        clearTimeout(submissionTimeout);
      }
    };
  }, [submissionTimeout]);
  
  const updateField = useCallback((field: keyof CreatePostFormState, value: any) => {
    dispatch({
      type: 'UPDATE_FIELD',
      field,
      value,
    });
  }, []);

  const resetForm = useCallback(() => {
    dispatch({ type: 'RESET_FORM' });
    if (submissionTimeout) {
      clearTimeout(submissionTimeout);
      setSubmissionTimeout(null);
    }
  }, [submissionTimeout]);

  const setGlobalStatus = useCallback((status: { type: string; message?: string } | null) => {
    if (!status) {
      setSubmitState('idle');
      return;
    }
    const submitState = status.type === 'success' ? 'success' : 
                       status.type === 'error' ? 'error' :
                       status.type === 'processing' ? 'submitting' : 'idle';
                         
    dispatch({
      type: 'SET_SUBMIT_STATE',
      value: submitState
    });
    
    if (status.message) {
      dispatch({
        type: 'UPDATE_FIELD',
        field: 'submissionProgress',
        value: status.message
      });
    }
  }, []);

  const setSubmitState = useCallback((state: CreatePostFormState['submitState']) => {
    dispatch({
      type: 'SET_SUBMIT_STATE',
      value: state,
    });
  }, []);

  const toggleLightbox = useCallback((isOpen: boolean, index: number = 0) => {
    dispatch({
      type: 'TOGGLE_LIGHTBOX',
      value: isOpen,
      index,
    });
  }, []);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null); // Added
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null); // Added

  const value: CreatePostFormContextType = {
    ...state,
    updateField,
    resetForm,
    setSubmitState,
    toggleLightbox,
    isSubmitting,
    setIsSubmitting,
    openDialog,
    closeDialog,
    isOpen: state.dialogOpen,
    globalStatus: {
      visible: state.submitState !== 'idle',
      type: state.submitState === 'success' ? 'success' : 
            state.submitState === 'error' ? 'error' : 'processing',
      message: state.submissionProgress || ''
    },
    setGlobalStatus,
    setGlobalStatusVisibility: (visible: boolean) => {
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
    },
    setPriceError,
    setSelectedImageFile,
  };

  return (
    <CreatePostFormContext.Provider value={value}>
      {children}
    </CreatePostFormContext.Provider>
  );
}

export function useCreatePostForm() {
  const context = useContext(CreatePostFormContext);
  if (!context) {
    throw new Error('useCreatePostForm must be used within a CreatePostFormProvider');
  }
  return context;
}