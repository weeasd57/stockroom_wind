'use client';

import { useState, useEffect, useRef, useCallback } from "react";
import { useSupabase } from '@/providers/SupabaseProvider'; // Updated from useAuth
import { useProfile } from '@/providers/ProfileProvider'; // Updated from contexts/ProfileContext
import { getCountrySymbolCounts, searchStocks } from '@/utils/symbolSearch';
// Background post creation handles image compression/upload and post insert
import { useBackgroundPostCreation } from '@/providers/BackgroundPostCreationProvider';
import { uploadPostImage } from '@/utils/supabase';
import RTLTextArea from '@/components/posts/RTLTextArea';
import { toast } from 'sonner';

import { useCreatePostForm } from '@/providers/CreatePostFormProvider'; // Updated from contexts/CreatePostFormContext
// createPost is invoked internally by BackgroundPostCreationProvider via PostProvider

import styles from '@/styles/create-post-page.css'; // Assuming you have a CSS module for this page
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { COUNTRY_ISO_CODES, CURRENCY_SYMBOLS } from '@/models/CurrencyData.js';
import CountrySelectDialog from '@/components/ui/CountrySelectDialog';
import SymbolSearchDialog from '@/components/ui/SymbolSearchDialog';
import { COUNTRY_CODE_TO_NAME } from '@/models/CountryData';

// Format symbol for API use
const formatSymbolForApi = (symbol, country) => {
  if (!symbol) return '';
  
  // Remove any exchange suffix if present (e.g., AAPL.US -> AAPL)
  let formattedSymbol = symbol.split('.')[0];
  
  // For some countries, we need to add specific formatting
  if (country && typeof country === 'string') {
    const countryCode = country.length === 2 ? country.toUpperCase() : 
                       (COUNTRY_ISO_CODES[country] ? COUNTRY_ISO_CODES[country].toUpperCase() : '');
    
    // Add country code for certain markets if not already present
    if (countryCode && !symbol.includes('.')) {
      formattedSymbol = `${formattedSymbol}.${countryCode}`;
    }
  }
  
  return formattedSymbol;
};

// Case-insensitive lookup for currency symbol from CURRENCY_SYMBOLS.
// Accepts either a country name or ISO code and returns the matching symbol or '$' as default.
const currencySymbolFor = (countryOrCode) => {
  if (!countryOrCode) return '$';
  const countryName = COUNTRY_CODE_TO_NAME[countryOrCode] || countryOrCode;
  const key = Object.keys(CURRENCY_SYMBOLS).find(
    (k) => k.toLowerCase() === String(countryName).toLowerCase()
  );
  return key ? CURRENCY_SYMBOLS[key] : '$';
};

export default function CreatePostForm() {
  const { user, supabase } = useSupabase(); // Get the supabase client from the provider
  const { profile, getEffectiveAvatarUrl } = useProfile();
  const router = useRouter();
  const { tasks, startBackgroundPostCreation, cancelTask } = useBackgroundPostCreation();
  const [initialPrice, setInitialPrice] = useState(null); // Added initialPrice state
  
  // Since there's no formState, directly destructure values from context with defaults
  const {
    title,
    content,
    description, // Add description field
    selectedStrategy,
    imageFile,
    imagePreview,
    imageUrl,
    preview,
    showStrategyInput,
    searchResults,
    stockSearch,
    selectedStock,
    selectedCountry,
    apiUrl,
    apiResponse,
    currentPrice,
    targetPrice, // Added
    targetPricePercentage,
    stopLoss, // Added
    stopLossPercentage,
    entryPrice, // Added
    priceHistory,
    priceError,
    newStrategy,
    showStrategyDialog,
    formErrors,
    submissionProgress,
    isLightboxOpen,
    lightboxIndex,
    submitState,
    isSubmitting: contextIsSubmitting,
    updateField,
    resetForm,
    setSubmitState,
    toggleLightbox,
    openDialog,
    closeDialog,
    isOpen,
    setGlobalStatus,
    setGlobalStatusVisibility,
    resetSubmitState,
    setPriceError,
    setSelectedImageFile,
    selectedImageFile, // Add this missing variable
    setShowStrategyDialog,
  } = useCreatePostForm() || {};

  // Create alias for contextDescription to maintain compatibility
  const contextDescription = description || content || '';

  // addPost function is imported from ProfileProvider

  const [strategies, setStrategies] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showStockSearch, setShowStockSearch] = useState(false);
  const [showImageUrlInput, setShowImageUrlInput] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('/default-avatar.svg');
  const [formattedApiUrl, setFormattedApiUrl] = useState('');
  const [countrySymbolCounts, setCountrySymbolCounts] = useState({});
  const [images, setImages] = useState([]);
  const [capturedImage, setCapturedImage] = useState(null);
  const [categoryId, setCategoryId] = useState(null);
  const [errors, setErrors] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [stockSymbol, setStockSymbol] = useState('');
  const [status, setStatus] = useState('idle'); // 'idle', 'uploading', 'success', 'error'
  const [currentAvatar, setCurrentAvatar] = useState(null);
  const [previewAvatar, setPreviewAvatar] = useState(null);
  const [isAddingStrategy, setIsAddingStrategy] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(contextIsSubmitting); // New state for submission status
  // Whether the post is public (visible to others) — default to true
  const [isPublic, setIsPublic] = useState(true);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageUploadError, setImageUploadError] = useState('');
  const [priceLoading, setPriceLoading] = useState(false);
  const [debugLogs, setDebugLogs] = useState([]);
  // Abort controller for price fetch to avoid race conditions on rapid symbol changes
  const priceAbortRef = useRef(null);
  const pushDebug = useCallback((msg) => {
    try {
      console.debug('[CreatePostForm DEBUG]', msg);
    } catch (e) {}
    setDebugLogs((prev) => {
      const next = [...prev, `${new Date().toISOString()} - ${msg}`];
      // keep last 50 logs
      return next.slice(-50);
    });
  }, []);
  const [activeTab, setActiveTab] = useState('stocks');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSearchInputFocused, setIsSearchInputFocused] = useState(false);
  const [hasUserSearched, setHasUserSearched] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [symbolSearchQuery, setSymbolSearchQuery] = useState('');
  const [countrySearchQuery, setCountrySearchQuery] = useState('');
  const [imagePreviews, setImagePreviews] = useState([]);
  const [imageFiles, setImageFiles] = useState([]);
  const [strategiesLoading, setStrategiesLoading] = useState(true);
  const [isCountrySelectOpen, setIsCountrySelectOpen] = useState(false);
  const [isSymbolSearchOpen, setIsSymbolSearchOpen] = useState(false); // State to control SymbolSearchDialog
  // Track current background creation task for in-form cancel/progress UI
  const [currentTaskId, setCurrentTaskId] = useState(null);
  // Find current background task
  const currentTask = (tasks || []).find((t) => t.id === currentTaskId) || null;

  const handleOpenCountrySelect = () => {
    setIsCountrySelectOpen(true);
  };

  const handleCloseCountrySelect = () => {
    setIsCountrySelectOpen(false);
  };

  const handleSelectCountry = useCallback((countryCode) => {
    // Update selected country and open symbol search dialog automatically
    updateField('selectedCountry', countryCode);
    setIsSymbolSearchOpen(true);
  }, [updateField]);

  const handleOpenSymbolSearch = () => {
    setIsSymbolSearchOpen(true);
  };

  const handleCloseSymbolSearch = () => {
    setIsSymbolSearchOpen(false);
  };

  const handleSelectStock = useCallback((stock) => {
    // Normalize shape from dialog (Symbol/Name/Country) or internal (symbol/name/country)
    const normalized = {
      symbol: stock.symbol || stock.Symbol,
      name: stock.name || stock.Name,
      country: stock.country || stock.Country,
      exchange: stock.exchange || stock.Exchange || '',
      uniqueId: stock.uniqueId || `${(stock.symbol || stock.Symbol || 'sym')}-${(stock.country || stock.Country || 'ctry')}`
    };
    // Update form state; price fetch will be triggered by useEffect on selectedStock
    updateField('selectedStock', normalized);
    updateField('stockSearch', normalized.symbol);
  }, [updateField]);

  // الاستراتيجيات الافتراضية
  const DEFAULT_STRATEGIES = [
    'Long Term Investment',
    'Swing Trading',
    'Day Trading',
    'Value Investing',
    'Growth Investing',
    'Fundamental Analysis',
    'Technical Analysis',
    'Momentum Trading',
    'Breakout Trading',
    'Position Trading',
    'Scalping',
    'News Trading'
  ];

  // Preload popular country data on component mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const counts = await getCountrySymbolCounts();
        if (mounted) {
          setCountrySymbolCounts(counts);
          console.log("Loaded country symbol counts:", counts);
        }
      } catch (error) {
        console.error("Error loading country symbol counts:", error);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Load avatar URL on component mount
  useEffect(() => {
    const loadAvatarUrl = async () => {
      if (user) {
        try {
          const url = await getEffectiveAvatarUrl();
          setAvatarUrl(url);
        } catch (error) {
          console.error('Error loading avatar URL:', error);
        }
      }
    };
    
    // Use context avatar URL if available, otherwise load it
    if (profile?.avatarUrl) {
      setAvatarUrl(profile.avatarUrl);
    } else {
      loadAvatarUrl();
    }
  }, [user, getEffectiveAvatarUrl, profile]);

  // Fetch user strategies on component mount
  useEffect(() => {
    if (user) {
      fetchStrategies();
    }
  }, [user]);

  // Keep local isSubmitting state in sync with context
  useEffect(() => {
    setIsSubmitting(contextIsSubmitting);
  }, [contextIsSubmitting]);

  // Fetch user's strategies
  const fetchStrategies = async () => {
    if (!user?.id) return;
    
    try {
      // First set default strategies to ensure UI is responsive
      if (strategies.length === 0) {
        setStrategies(DEFAULT_STRATEGIES);
      }
      
      // Then try to load from database if supabase is available
      if (supabase) {
        try {
          // Fetch from user_strategies table
          const { data, error } = await supabase
            .from('user_strategies')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
            
          if (error) {
            // If there's an error, check if it's because the table doesn't exist
            if (error.code === '42P01') { // PostgreSQL error code for undefined_table
              // Attempt to create the table - this might not work due to permissions or if it's a server-side only operation
              try {
                await setupDatabase(); // Assuming this function handles table creation
                const { data: newData, error: newError } = await getUserStrategies(user.id); // Retry fetching
                if (newError) {
                  // console.error('Table user_strategies does not exist. Please run the migration script.');
                } else {
                  setUserStrategies(newData || []);
                }
              } catch (setupError) {
                // console.error('Database error fetching strategies:', setupError);
              }
            }
            // For other errors, set default strategies
            setDefaultStrategies();
          } else if (data && data.length > 0) {
            // console.log('Retrieved user strategies from database:', data);
            setUserStrategies(data);
          } else {
            // console.log('No user strategies found, using default strategies');
            setDefaultStrategies();
          }
        } catch (error) {
          // console.error('Error fetching strategies:', error);
          setDefaultStrategies();
        } finally {
          setStrategiesLoading(false);
        }
      } else {
        console.log('Supabase client not available, using default strategies');
      }
    } catch (error) {
      console.error('Error fetching strategies:', error);
      // Fallback to default strategies on error
      setStrategies(DEFAULT_STRATEGIES);
    }
  };

  // Create a new strategy
  const handleAddStrategy = async () => {
    if (!newStrategy.trim() || !user) return;
    
    try {
      setIsAddingStrategy(true);
      
      // Add strategy locally first (for immediate UI feedback)
      const strategyName = newStrategy.trim();
      setStrategies(prev => [...prev, strategyName]);
      updateField('selectedStrategy', strategyName);
      
      // Then try to save it to database if supabase is available
      if (supabase) {
        try {
          // Check if user_strategies table exists by attempting a query
          const { data: checkData, error: checkError } = await supabase
            .from('user_strategies')
            .select('id')
            .limit(1);
          
          // If table doesn't exist or there's an error, create it
          if (checkError && checkError.code === '42P01') { // PostgreSQL error code for "relation does not exist"
            console.log('user_strategies table does not exist, creating it...');
            
            // We can't create tables directly from the client, so we'll just log this
            console.error('Table user_strategies does not exist. Please run the migration script.');
          } else {
            // Table exists, proceed with insert
            const { data, error } = await supabase
              .from('user_strategies')
              .insert({
                user_id: user.id,
                strategy_name: strategyName,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .select()
              .single();
              
            if (error) {
              console.error('Error saving strategy to database:', error);
              // Already added locally, so continue silently
            } else {
              console.log('Strategy saved to database:', data);
            }
          }
        } catch (dbError) {
          console.error('Database error saving strategy:', dbError);
          // Already added locally, so continue silently
        }
      }
      
      // Reset the input field
      setNewStrategy('');
      updateField('showStrategyInput', false);
    } catch (error) {
      console.error('Error creating strategy:', error);
      // Still add strategy locally in case of error
      setStrategies(prev => [...prev, newStrategy.trim()]);
      updateField('selectedStrategy', newStrategy.trim());
    } finally {
      setIsAddingStrategy(false);
    }
  };

  // Search effect that handles filtering and loading stocks
  useEffect(() => {
    // Clear any pending search timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // If search was explicitly canceled, don't re-show results
    if (stockSearch === '' && searchResults.length === 0) {
      setIsSearching(false);
      return;
    }

    // Case 1: If we have loaded symbols for a country and user is typing, filter locally
    if (selectedCountry !== 'all' && searchResults.length > 0 && stockSearch.length > 0) {
      const normalizedQuery = stockSearch.toLowerCase();
      const filteredResults = searchResults.filter(stock => 
        stock.symbol.toLowerCase().includes(normalizedQuery) || 
        stock.name.toLowerCase().includes(normalizedQuery)
      );
      
      // Only update if there's a change to prevent unnecessary re-renders
      if (JSON.stringify(filteredResults) !== JSON.stringify(searchResults)) {
        updateField('searchResults', filteredResults);
      }
      setIsSearching(false);
      return;
    }

    // Case 2: If search is empty and country is selected, keep showing all symbols
    if (stockSearch.length === 0 && selectedCountry !== 'all' && searchResults.length > 0) {
      // Keep existing results
      setIsSearching(false);
      return;
    }

    // Case 3: For all countries search or empty search with no results yet
    if (stockSearch.length < 1) {
      // Only clear results if we're in all countries mode
      if (selectedCountry === 'all') {
        updateField('searchResults', []);
      }
      setIsSearching(false);
      return;
    }

    // Case 4: Perform a search via API
    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        // Convert ISO country code to country name if needed
        let searchCountry = selectedCountry === 'all' ? null : selectedCountry;
        if (searchCountry && COUNTRY_CODE_TO_NAME[searchCountry]) {
          searchCountry = COUNTRY_CODE_TO_NAME[searchCountry];
          // console.log(`Searching in country: ${searchCountry}`);
        }
        
        // Use our local symbol search instead of API
        const results = await searchStocks(stockSearch, searchCountry);
        
        // If stockSearch has changed while we were searching, discard results
        if (stockSearch.length < 1) {
          setIsSearching(false);
          return;
        }
        
        // Format the results to match the expected structure
        const formattedResults = results.map(item => ({
          symbol: item.Symbol,
          name: item.Name,
          country: item.Country,
          exchange: item.Exchange,
          uniqueId: item.uniqueId
        }));
        
        updateField('searchResults', formattedResults);
      } catch (error) {
        // console.error('Error searching stocks:', error);
        updateField('searchResults', []);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    // Cleanup function
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [stockSearch, selectedCountry, searchResults]);

  // Helper function to scroll to stock info with improved reliability
  const scrollToStockInfo = useCallback(() => {
    // console.log('scrollToStockInfo called');
    if (stockInfoRef.current) {
      const stockInfoElement = stockInfoRef.current;
      const container = document.querySelector('.create-post-form-container'); // Adjust this selector if needed

      if (container) {
        // Try to scroll the container to the top first, then to the element
        try {
          container.scrollTo({
            top: 0,
            behavior: 'smooth',
          });
          // console.log('Scrolled container to top');
        } catch (e) {
          // console.error('Error scrolling container:', e);
        }

        // Use a small delay to allow the first scroll to complete
        setTimeout(() => {
          const elementRect = stockInfoElement.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          const offsetTop = elementRect.top - containerRect.top + container.scrollTop;

          // Only scroll if the element is not fully visible
          if (elementRect.top < containerRect.top || elementRect.bottom > containerRect.bottom) {
            container.scrollTo({
              top: offsetTop,
              behavior: 'smooth',
            });
            // console.log(`Scrolled container to element at ${offsetTop}px`);
          } else {
            // console.log(`Found target element on attempt ${i+1}`);
          }
        }, 100); // Small delay
      } else {
        // console.error('Error scrolling to element:', e);
      }
    }
  }, []);

  // Handle image selection with improved feedback
  const handleImageChange = (e) => {
    console.log('=== IMAGE CHANGE EVENT TRIGGERED ===');
    const file = e.target.files[0];
    
    if (!file) {
      console.log('No file selected');
      return;
    }

    console.log('File details:', {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
    });
    
    try {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        console.error('Invalid file type:', file.type);
        const errorMsg = 'Please select a valid image file';
        toast.error(errorMsg);
        setImageUploadError(errorMsg);
        return;
      }
      
      // Validate file size (less than 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        console.error('File too large:', file.size, 'bytes');
        const errorMsg = 'Image size is too large. Please select an image smaller than 5MB';
        toast.error(errorMsg);
        setImageUploadError(errorMsg);
        return;
      }
      
      // Clear any previous errors and URL image
      setImageUploadError('');
      console.log('File validation passed!');
      
      // Clear URL image when uploading file
      updateField('imageUrl', '');
      
      // Show success message
      const successMsg = `Image selected: ${file.name}`;
      console.log('Success:', successMsg);
      toast.success(successMsg);
      
      // Update form fields
      console.log('Updating form fields...');
      updateField('imageFile', file);
      
      // Also set the provider-level selectedImageFile if available (some code paths use this)
      if (typeof setSelectedImageFile === 'function') {
        try { 
          setSelectedImageFile(file); 
          console.log('Provider-level selectedImageFile updated');
        } catch (err) { 
          console.error('setSelectedImageFile failed:', err);
        }
      }
      
      pushDebug(`Selected file: ${file.name} (${Math.round(file.size/1024)} KB) type=${file.type}`);
      
      // Create a URL for the preview
      const objectUrl = URL.createObjectURL(file);
      console.log('Created object URL:', objectUrl);
      updateField('imagePreview', objectUrl);
      
      // Set status to show preview is ready
      setStatus('preview_ready');
      console.log('Status set to preview_ready');
      
      // Clean up function
      const cleanup = () => {
        URL.revokeObjectURL(objectUrl);
        console.log('Object URL cleaned up');
      };
      
      // Clean up after a delay or component unmount
      setTimeout(cleanup, 300000); // 5 minutes
      
      console.log('=== IMAGE CHANGE COMPLETED SUCCESSFULLY ===');
      
    } catch (error) {
      console.error('Error in handleImageChange:', error);
      setImageUploadError('Error processing image: ' + error.message);
    }
  };

  // Helper to clear selected image and reset file input so the same file can be re-selected
  const clearSelectedImage = () => {
    try {
      updateField('imagePreview', '');
      updateField('imageFile', null);
      if (typeof setSelectedImageFile === 'function') {
        try { setSelectedImageFile(null); } catch (err) { console.debug('setSelectedImageFile cleanup failed', err); }
      }
      // Reset the native file input so selecting the same file again will fire change
      if (fileInputRef && fileInputRef.current) {
        try { fileInputRef.current.value = ''; } catch (e) { /* ignore */ }
      }
      setStatus('idle');
    } catch (err) {
      console.debug('clearSelectedImage failed', err);
    }
  };

  // Enhanced image URL handler with validation and metadata extraction
  const handleImageUrlChange = async (e) => {
    const url = e.target.value;
    updateField('imageUrl', url);
    
    // Clear uploaded file when URL is set
    updateField('imageFile', null);
    if (typeof setSelectedImageFile === 'function') {
      try { setSelectedImageFile(null); } catch (err) { console.debug('setSelectedImageFile failed', err); }
    }
    
    // Set URL as preview if it's a valid image URL
    if (url && url.trim()) {
      try {
        // Validate URL format
        const urlObj = new URL(url);
        
        // Check if it's likely an image URL by extension
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
        const hasImageExtension = imageExtensions.some(ext => 
          url.toLowerCase().includes(ext.toLowerCase())
        );
        
        if (hasImageExtension) {
          // Create a virtual image object to get metadata
          const img = new window.Image();
          img.crossOrigin = 'anonymous'; // Try to handle CORS
          
          const imageLoadPromise = new Promise((resolve, reject) => {
            img.onload = () => {
              // Extract filename from URL
              const filename = url.split('/').pop().split('?')[0] || 'image-from-url';
              
              // Create a virtual file object for consistency
              const virtualFile = {
                name: filename,
                size: null, // We can't get actual file size from URL without fetching
                type: `image/${filename.split('.').pop() || 'unknown'}`,
                lastModified: Date.now(),
                width: img.naturalWidth,
                height: img.naturalHeight,
                isFromUrl: true
              };
              
              // Set the virtual file for display consistency
              if (typeof setSelectedImageFile === 'function') {
                try { 
                  setSelectedImageFile(virtualFile); 
                  console.log('Virtual file object created for URL image:', virtualFile);
                } catch (err) { 
                  console.debug('setSelectedImageFile failed for virtual file', err); 
                }
              }
              
              resolve(virtualFile);
            };
            
            img.onerror = () => {
              reject(new Error('Failed to load image from URL'));
            };
          });
          
          img.src = url;
          
          // Set preview immediately (don't wait for metadata)
          updateField('imagePreview', url);
          setStatus('preview_ready');
          toast.success('Image URL set successfully!');
          
          // Try to get metadata (non-blocking)
          try {
            await imageLoadPromise;
            console.log('Image metadata loaded successfully');
          } catch (metaError) {
            console.warn('Could not load image metadata:', metaError.message);
            // Still create a basic virtual file
            const filename = url.split('/').pop().split('?')[0] || 'image-from-url';
            const basicVirtualFile = {
              name: filename,
              size: null,
              type: `image/${filename.split('.').pop() || 'unknown'}`,
              lastModified: Date.now(),
              isFromUrl: true
            };
            
            if (typeof setSelectedImageFile === 'function') {
              try { 
                setSelectedImageFile(basicVirtualFile);
              } catch (err) { 
                console.debug('setSelectedImageFile failed for basic virtual file', err); 
              }
            }
          }
        } else {
          // Set preview anyway but warn user
          updateField('imagePreview', url);
          setStatus('preview_ready');
          toast.warning('URL might not be an image. Preview may not work.');
        }
        
      } catch (urlError) {
        console.error('Invalid URL format:', urlError);
        toast.error('Please enter a valid URL');
        updateField('imagePreview', '');
        setStatus('idle');
      }
    } else {
      // Use centralized clear helper to ensure file input reset
      clearSelectedImage();
    }
    
    pushDebug(`Image URL set: ${url}`);
  };

  /**
   * Handle avatar drop to update profile image
   */
  const handleAvatarDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const file = e.dataTransfer.files[0];
      if (!file || !file.type.startsWith('image/')) {
        updateGlobalStatus('Please drop an image file', 'error');
        return;
      }
      
      // Create a preview URL for instant feedback
      const previewUrl = URL.createObjectURL(file);
      setPreviewAvatar(previewUrl);
      setStatus('uploading');
      updateGlobalStatus('Uploading avatar...', 'processing');
      
      try {
        // Upload the image directly to storage
        const uploadedUrl = await uploadPostImage(file, user?.id);
        
        if (uploadedUrl) {
          // Check if we have Supabase client initialized
          if (!supabase) {
            throw new Error('Supabase client not initialized. Check your environment variables.');
          }
          
          // Get the profile ID from the user ID
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('id')
            .eq('user_id', user?.id)
            .single();
            
          if (profileError) {
            throw new Error(`Failed to find profile: ${profileError.message}`);
          }
          
          // Update the profile with the new avatar URL
          const { data, error } = await supabase
            .from('profiles')
            .update({ avatarUrl: uploadedUrl })
            .eq('id', profileData.id)
            .select()
            .single();
      
      if (error) {
            throw new Error(`Failed to update profile: ${error.message}`);
          }
          
          console.log('Profile updated with new avatar:', data);
          
          // Update the avatar in the UI
          setAvatarUrl(uploadedUrl);
          
          // Update local state and global status
          setCurrentAvatar(uploadedUrl);
          setStatus('idle');
          updateGlobalStatus('Avatar updated successfully!', 'success');
          
          // Auto-close status after 3 seconds
      setTimeout(() => {
            updateGlobalStatus(null);
          }, 3000);
        }
      } catch (uploadError) {
        throw new Error(`Failed to update avatar: ${uploadError.message}`);
      }
        
        // Clean up the object URL
        URL.revokeObjectURL(previewUrl);
      } catch (error) {
        console.error('Error updating avatar:', error);
      // Revert to previous avatar
      setPreviewAvatar(currentAvatar);
      setStatus('error');
      updateGlobalStatus(`Error updating avatar: ${error.message}`, 'error');
    }
  };

  const handleAvatarDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

 
  // Handle strategy dropdown display
  useEffect(() => {
    if (showStrategyInput) {
      // Get the form elements
      const formWrapper = document.querySelector('.form-wrapper');
      const allFormElements = document.querySelectorAll('.form-group, .form-actions-bottom');
      const scrollPosition = window.scrollY || document.documentElement.scrollTop;
      
      // Lock body scrolling completely
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollPosition}px`;
      document.body.style.width = '100%';
      
      // Set all form elements to a lower z-index
      allFormElements.forEach(el => {
        if (el) el.style.zIndex = '1';
      });
      
      // Reset scroll position of dialog content
      setTimeout(() => {
        const dialogContent = document.querySelector('.strategy-dialog-content');
        if (dialogContent) {
          dialogContent.scrollTop = 0;
        }
      }, 10);
      
      // Handle escape key to close
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          updateField('showStrategyInput', false);
        }
      };
      
      window.addEventListener('keydown', handleKeyDown);
      
      return () => {
        // Restore body scrolling
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        
        // Restore scroll position
        window.scrollTo(0, scrollPosition);
        
        // Reset z-index on form elements
        allFormElements.forEach(el => {
          if (el) el.style.zIndex = '';
        });
        
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [showStrategyInput]);

  // Add this function to properly cancel search
  const handleCancelSearch = () => {
    // Clear search results
    updateField('searchResults', []);
    // Clear search input
    updateField('stockSearch', '');
    // Ensure loading state is cleared
    setIsSearching(false);
    // Clear any pending timeouts
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }
  };

  // Effect to handle body and form scrolling when strategy dialog is open
  useEffect(() => {
    if (showStrategyInput) {
      // Prevent body scrolling
      document.body.style.overflow = 'hidden';
      
      // Also prevent form wrapper scrolling
      const formWrapper = document.querySelector('.form-wrapper');
      if (formWrapper) {
        formWrapper.style.overflow = 'hidden';
      }
      
      // iOS specific fix for momentum scrolling and proper dialog height
      const dialogContent = document.querySelector('.strategy-dialog-content');
      if (dialogContent) {
        dialogContent.style.scrollBehavior = 'auto';
        
        // Force redraw to ensure proper rendering on iOS
        setTimeout(() => {
          dialogContent.style.display = 'none';
          void dialogContent.offsetHeight; // Trigger reflow
          dialogContent.style.display = 'block';
          dialogContent.scrollTop = 0;
        }, 50);
      }
      
      return () => {
        // Restore scrolling
        document.body.style.overflow = '';
        if (formWrapper) {
          formWrapper.style.overflow = '';
        }
      };
    }
  }, [showStrategyInput]);

  // Function to scroll form wrapper and page to top, but only for strategy select-field
  const scrollFormToTop = (element) => {
    // Only scroll to top for strategy select-field, not category select-field
    if (element === 'strategy') {
      // Scroll the form wrapper to top
      if (formWrapperRef.current) {
        formWrapperRef.current.scrollTop = 0;
      }
      
      // Also scroll the entire page to top
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  };

  // Fetch current price via internal Next.js API proxy to avoid CORS and hide API keys
  const fetchCurrentPrice = async (symbol, country) => {
    if (!symbol) return;
    // Abort any in-flight request
    try { priceAbortRef.current?.abort(); } catch (_) {}
    const controller = new AbortController();
    priceAbortRef.current = controller;
    setPriceLoading(true);
    try {
      const qs = new URLSearchParams({ symbol: String(symbol) });
      if (country) qs.set('country', String(country));
      const apiUrl = `/api/stocks/price?${qs.toString()}`;
      
      const response = await fetch(apiUrl, { method: 'GET', signal: controller.signal });
      if (!response.ok) {
        let errMsg = `Failed to fetch price data: ${response.status}`;
        try {
          const e = await response.json();
          if (e?.error) errMsg = `${errMsg} - ${e.error}`;
        } catch (_) {}
        throw new Error(errMsg);
      }
      
      const data = await response.json();
      const priceNum = Number(data?.price);
      if (!Number.isFinite(priceNum)) {
        throw new Error('Invalid price in API response');
      }
      
      // Ensure this response is still the latest (not aborted/replaced)
      if (priceAbortRef.current !== controller) return;
      updateField('currentPrice', priceNum);
      updateField('initialPrice', priceNum);
      
      // Default 5% target and stop-loss around current price
      const targetPercentage = 5;
      const stopLossPercentage = 5;
      const targetValue = (priceNum * (1 + targetPercentage/100)).toFixed(2);
      const stopLossValue = (priceNum * (1 - stopLossPercentage/100)).toFixed(2);
      
      updateField('targetPrice', targetValue);
      updateField('stopLoss', stopLossValue);
      updateField('targetPricePercentage', targetPercentage);
      updateField('stopLossPercentage', stopLossPercentage);
    } catch (error) {
      if (error?.name === 'AbortError') {
        // Swallow aborts silently
        return;
      }
      console.error('Error fetching current price:', error);
      updateField('currentPrice', null);
      setPriceError?.(error.message || 'Failed to fetch price');
    } finally {
      // Only clear loading if this is the latest request
      if (priceAbortRef.current === controller) {
        setPriceLoading(false);
      }
    }
  };

  // Call price fetch when selected stock changes
  useEffect(() => {
    if (selectedStock && selectedStock.symbol) {
      fetchCurrentPrice(selectedStock.symbol, selectedStock.country);
    }
  }, [selectedStock]);

  // Re-fetch price when the selected country changes (if a stock is already selected)
  useEffect(() => {
    if (selectedCountry && selectedCountry !== 'all' && selectedStock && selectedStock.symbol) {
      fetchCurrentPrice(selectedStock.symbol, selectedCountry);
    }
  }, [selectedCountry, selectedStock]);

  // Abort any pending price request on unmount
  useEffect(() => {
    return () => {
      try { priceAbortRef.current?.abort(); } catch (_) {}
    };
  }, []);

  // Function to open the strategy dialog
  const openStrategyDialog = () => {
    // First, make sure the strategies are loaded
    if (strategies.length === 0) {
      setStrategies(DEFAULT_STRATEGIES);
    }
    
    // Show the dialog
    updateField('showStrategyDialog', true);
    
    // Prevent background scrolling
    document.body.style.overflow = 'hidden';
    
    // Small delay to allow the dialog to render
    setTimeout(() => {
      const formButtons = document.querySelector('.form-actions-bottom');
      const dialogElement = document.querySelector('.strategy-dialog');
      
      if (dialogElement && formButtons) {
        // Measure distance to bottom for better positioning
        const viewportHeight = window.innerHeight;
        const formButtonsTop = formButtons.getBoundingClientRect().top;
        const availableSpace = formButtonsTop - 20; // 20px buffer
        
        // Adjust dialog height based on available space
        if (availableSpace < viewportHeight * 0.7) {
          dialogElement.style.maxHeight = `${availableSpace}px`;
        }
        
        // Ensure the dialog is visible and scrolled to the top
        dialogElement.scrollTop = 0;
      }
    }, 50);
  };

  // Function to close the strategy dialog
  const closeStrategyDialog = () => {
    console.log('Closing strategy dialog');
    
    // Hide the dialog
    updateField('showStrategyDialog', false);
    
    // Restore normal scrolling
    document.body.style.overflow = '';
    
    // Reset new strategy state
    updateField('showStrategyInput', false);
    updateField('newStrategy', '');
    
    // Focus back on the strategy field
    setTimeout(() => {
      const strategyField = document.querySelector('.strategy-field-container');
      if (strategyField) {
        strategyField.focus();
      }
    }, 100);
  };

  // 4. تحسين استجابة مفتاح Escape
  useEffect(() => {
    const handleEscapeKey = (event) => {
      if (event.key === 'Escape') {
        console.log('Escape key pressed, showStrategyDialog:', showStrategyDialog);
        if (showStrategyDialog) {
          closeStrategyDialog();
        }
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [showStrategyDialog, updateField]); // Added updateField to dependencies

  // Listen for Escape key to close strategy dialog
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showStrategyDialog) {
        closeStrategyDialog();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showStrategyDialog, updateField]); // Added updateField to dependencies

  // Function to update global status - declare once here
  const updateGlobalStatus = useCallback((message, type = 'processing') => {
    // Delegate to centralized setGlobalStatus from provider
    if (!setGlobalStatus) return;
    // If message is falsy, clear the global status
    if (!message) {
      setGlobalStatus(null);
      return;
    }
    // Set status using the provider's expected shape
    setGlobalStatus({ type, message });
    // Auto-clear after 5s for non-error statuses
    if (type !== 'error') {
      const timer = setTimeout(() => setGlobalStatus(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [setGlobalStatus]);

  // New improved handleSubmit function: delegates to BackgroundPostCreationProvider
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return; // Prevent multiple submissions
    setIsSubmitting(true); // Set submitting state to true

    setErrors({}); // Reset errors

    // Simple validation checks
    if (!selectedStock || !selectedStock.symbol) {
      setErrors({ stock: 'Please select a stock symbol' });
      setIsSubmitting(false); // Reset submitting state on error
      return;
    }

    try {
      console.debug('[handleSubmit] building post for background task, selectedStock:', selectedStock && selectedStock.symbol, 'selectedImageFile:', !!selectedImageFile);
      console.debug('[handleSubmit] formErrors:', formErrors, 'isSubmitting:', isSubmitting);
      // Use currentPrice from context that was set when stock was selected
      console.debug('[handleSubmit] currentPrice from context:', currentPrice, 'targetPrice:', targetPrice, 'stopLoss:', stopLoss);
      
      // Ensure required `content` column is populated (DB has NOT NULL on `content`)
      const contentValue = (contextDescription || selectedStock?.symbol || '').toString().trim().slice(0, 255);
      
      // Use the currentPrice that was fetched and set when stock was selected
      const numericInitial = currentPrice && !isNaN(parseFloat(currentPrice)) ? parseFloat(currentPrice) : 0;
      const numericTarget = targetPrice && !isNaN(parseFloat(targetPrice)) ? parseFloat(targetPrice) : numericInitial;
      const numericStopLoss = stopLoss && !isNaN(parseFloat(stopLoss)) ? parseFloat(stopLoss) : numericInitial;
      
      console.debug('[handleSubmit] calculated prices:', { numericInitial, numericTarget, numericStopLoss });

      // Only accept http/https URLs for image sources (avoid blob:/data:)
      const isValidHttpUrl = (u) => {
        try {
          if (!u || typeof u !== 'string') return false;
          const parsed = new URL(u);
          return parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch { return false; }
      };
      const rawUrl = typeof imageUrl === 'string' ? imageUrl.trim() : '';
      const rawPreview = typeof imagePreview === 'string' ? imagePreview.trim() : '';
      const candidateUrlDirect = isValidHttpUrl(rawUrl) ? rawUrl : null;
      const candidateUrlFromPreview = isValidHttpUrl(rawPreview) ? rawPreview : null;

      const postData = {
        user_id: user.id,
        symbol: selectedStock.symbol,
        country: selectedStock.country,
        // `content` is required by the DB schema (short summary)
        content: contentValue,
        // `description` can be longer and optional
        description: contextDescription || '',
        // Fill required numeric columns
        current_price: numericInitial,
        initial_price: numericInitial,
        target_price: numericTarget,
        stop_loss_price: numericStopLoss,
        // Stock/company metadata required by schema
        company_name: selectedStock?.name || selectedStock?.company_name || selectedStock?.symbol || '',
        exchange: selectedStock?.exchange || '',
        // Prefer valid URL input from context (http/https only)
        image_url: candidateUrlDirect || null,
        strategy: selectedStrategy || null,
        is_public: isPublic,
        status: 'open',
        // Human-readable status message required by schema
        status_message: 'open',
      };

      // Log the postData before sending to background worker for debugging
      console.log('[handleSubmit DEBUG] Post data being queued:', postData);

      // Determine image source for background task
      const isUrlBased = selectedImageFile?.isFromUrl === true;
      // Decide which file to upload: prefer selectedImageFile, fallback to context imageFile
      const fileToUpload = isUrlBased ? null : (selectedImageFile || imageFile || null);
      // Use only sanitized candidates; ignore blob:/data: previews
      const existingUrlFromFile = isUrlBased ? (candidateUrlFromPreview || candidateUrlDirect) : null;
      const existingUrlDirect = !(selectedImageFile || imageFile) ? candidateUrlDirect : null;
      const resolvedExistingUrl = existingUrlFromFile || existingUrlDirect || null;
      console.debug('[handleSubmit] image resolution', {
        isUrlBased,
        hasSelectedImageFile: !!selectedImageFile,
        hasContextImageFile: !!imageFile,
        willUploadFile: !!fileToUpload,
        candidateUrlDirect,
        candidateUrlFromPreview,
        resolvedExistingUrl,
      });

      // Start background task: it handles compression, upload, progress, cancellation, and optimistic create
      const taskId = startBackgroundPostCreation({
        postData,
        imageFile: fileToUpload,
        existingImageUrl: resolvedExistingUrl,
        title: title || selectedStock?.symbol || 'New post',
      });

      console.debug('[handleSubmit] background task started', { taskId });
      toast.success('Creating post in background...');
      // Track task in form state for cancel/progress UI
      setCurrentTaskId(taskId);
      setSubmitState('submitting');

      // No need to manually refresh - PostProvider handles real-time updates

      // Defer form reset/close until task completion (handled by useEffect on currentTask)
      return;
    } catch (error) {
      console.error("Error creating post:", error);
      setGlobalStatus({ type: 'error', message: error.message || 'Error creating post. Please try again.' });
      setIsSubmitting(false);
 // Always reset submitting state on unhandled error
    } finally {
      // Keep submitting state until background task completes; no-op here
    }
  };

  // Cancel ongoing post submission or background task
  const cancelPosting = () => {
    // Prefer canceling the background task if exists
    if (currentTaskId && typeof cancelTask === 'function') {
      try { cancelTask(currentTaskId); } catch (e) { console.debug('cancelTask failed', e); }
      updateGlobalStatus('Posting cancelled', 'info');
      setCurrentTaskId(null);
      return;
    }
    // Fallback to legacy UI state cancel
    if (isSubmitting) {
      updateGlobalStatus('Posting cancelled', 'info');
      setIsSubmitting(false);
      setStatus('idle');
      if (setSubmitState) setSubmitState('idle');
      if (closeDialog) closeDialog();
    }
  };

  // Handle scroll in stock search results to maintain focus
  const handleStockResultsScroll = useCallback((e) => {
    // Prevent the default scroll behavior
    e.stopPropagation();
  }, []);

  // Handle keyboard navigation in stock search results
  const handleStockResultsKeyDown = useCallback((e) => {
    if (!showStockSearch || searchResults.length === 0) return;
    
    const resultsElement = stockSearchResultsRef.current;
    if (!resultsElement) return;
    
    // Get all stock items
    const stockItems = resultsElement.querySelectorAll('.category-option');
    if (stockItems.length === 0) return;
    
    // Find the currently focused item
    const focusedItem = document.activeElement;
    const isFocusedItemStock = focusedItem && focusedItem.classList && focusedItem.classList.contains('category-option');
    
    // Only handle Enter key for selection, disable arrow key navigation
    if (e.key === 'Enter' && isFocusedItemStock) {
      e.preventDefault();
      
      // Simulate a click on the focused item
      focusedItem.click();
    }
    
    // Close results on Escape key
    if (e.key === 'Escape') {
      e.preventDefault();
      updateField('searchResults', []);
      updateField('stockSearch', '');
      searchInputRef.current?.focus();
    }
  }, [showStockSearch, searchResults.length, updateField]);

  // Add event listeners for the stock search results
  useEffect(() => {
    const resultsElement = stockSearchResultsRef.current;
    if (resultsElement) {
      resultsElement.addEventListener('scroll', handleStockResultsScroll);
      resultsElement.addEventListener('keydown', handleStockResultsKeyDown);
    }
    
    return () => {
      if (resultsElement) {
        resultsElement.removeEventListener('scroll', handleStockResultsScroll);
        resultsElement.removeEventListener('keydown', handleStockResultsKeyDown);
      }
    };
  }, [showStockSearch, searchResults.length, handleStockResultsScroll, handleStockResultsKeyDown]);

  const handleRemoveImage = (indexToRemove) => {
    setImagePreviews((prev) => prev.filter((_, index) => index !== indexToRemove));
    setImageFiles((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  // Add ARIA attributes and improved keyboard navigation
  useEffect(() => {
    const handleEscapeKey = (e) => {
      if (e.key === 'Escape') {
        if (searchResults.length > 0) {
          if (updateField) {
            updateField('searchResults', []);
            updateField('stockSearch', '');
          }
        }
      }
    };
    
    window.addEventListener('keydown', handleEscapeKey);
    
    return () => {
      window.removeEventListener('keydown', handleEscapeKey);
    };
  }, [searchResults.length, updateField]);

  // At the beginning of the component, after imports but before class definition

  // Add autofocus to the text area and ensure form is properly sized for dialog
  useEffect(() => {
    // Focus the description field after the component mounts
    const descriptionField = document.getElementById('description');
    if (descriptionField) {
      setTimeout(() => {
        descriptionField.focus();
      }, 100);
    }

    // Listen for dialog open/close to properly manage layout 
    const handleResize = () => {
      if (formWrapperRef.current) {
        const formHeight = formWrapperRef.current.scrollHeight;
        const viewportHeight = window.innerHeight;
        
        // If form is taller than viewport, make it scrollable
        if (formHeight > viewportHeight * 0.8) {
          formWrapperRef.current.style.maxHeight = `${viewportHeight * 0.8}px`;
          formWrapperRef.current.style.overflow = 'auto';
        } else {
          formWrapperRef.current.style.maxHeight = 'none';
        }
      }
    };

    // Call once on mount and add resize listener
    handleResize();
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Find the section handling dialog and dropdown visibility
  // Add this new effect to ensure dropdowns are visible and positioned correctly

  useEffect(() => {
    // Function to ensure dropdowns appear above other elements
    const fixDropdownPosition = () => {
      const categoryDropdown = document.querySelector('.category-dropdown');
      const searchResults = document.querySelector('.search-results');
      
      if (categoryDropdown) {
        categoryDropdown.style.zIndex = '5000';
      }
      
      if (searchResults) {
        searchResults.style.zIndex = '5000';
      }
    };
    
    // Call once immediately
    fixDropdownPosition();
    
    // Set up a mutation observer to detect when dropdown becomes visible
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && 
            (mutation.target.classList.contains('category-dropdown') || 
             mutation.target.classList.contains('search-results'))) {
          if (mutation.target.classList.contains('show')) {
            fixDropdownPosition();
          }
        }
      });
    });
    
    // Observe dropdown elements
    const categoryDropdown = document.querySelector('.category-dropdown');
    const searchResults = document.querySelector('.search-results');
    
    if (categoryDropdown) {
      observer.observe(categoryDropdown, { attributes: true });
    }
    
    if (searchResults) {
      observer.observe(searchResults, { attributes: true });
    }
    
    return () => {
      observer.disconnect();
    };
  }, []);

  // Find the stock search container or country dropdown and update with this code:

  // Render country select as a button that opens dialog
  const renderCountrySelect = () => {
    return (
      <div className="form-group">
        <label className="form-label">Country</label>
        <button
          type="button"
          className="form-control select-button"
          onClick={handleOpenCountrySelect}
        >
          <span className="select-button-text">
            {selectedCountry === 'all' 
              ? 'All Countries' 
              : COUNTRY_CODE_TO_NAME[selectedCountry] || selectedCountry}
            {selectedCountry !== 'all' && (
              <span className="currency-symbol-indicator"> ({currencySymbolFor(COUNTRY_CODE_TO_NAME[selectedCountry] || selectedCountry)})</span>
            )}
          </span>
          <div className="select-button-icon">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path
                fill="currentColor"
                d="M7 10l5 5 5-5z"
              />
            </svg>
          </div>
        </button>
      </div>
    );
  };

  // Render stock search as a button that opens dialog
  const renderStockSearch = () => (
    <div className="form-group">
      <label className="form-label">Symbol or Name</label>
      <button
        type="button"
        className="form-control select-button"
        onClick={handleOpenSymbolSearch}
      >
        <span className="select-button-text">
          {selectedStock ? 
            `${selectedStock.symbol} - ${selectedStock.name || selectedStock.Symbol}` : 
            'Select a stock symbol'
          }
        </span>
        <div className="select-button-icon">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path
              fill="currentColor"
              d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
            />
          </svg>
        </div>
      </button>
    </div>
  );

  // Update the Stock Info Container to show currency symbols
  const updateSelectedStockDisplay = () => {
    // When updating selected stock UI in the return JSX:
    if (selectedStock) {
      const currencySymbol = currencySymbolFor(selectedStock.country);
      
      // Update the display to include currency symbol
      return (
        <div className="stock-info-container">
          {/* Background flag with opacity */}
          <div
            className="stock-info-bg-flag persistent-image"
            style={{
              backgroundImage: `url(https://flagcdn.com/${Object.entries(COUNTRY_ISO_CODES).find(
                ([countryName]) => countryName.toLowerCase() === selectedStock.country.toLowerCase()
              )?.[1]?.toLowerCase() || selectedStock.country.toLowerCase()}.svg)`
            }}
          ></div>
          
          <div className="stock-info-overlay">
            {/* Stock Item */}
            <div className="stock-item selected">
              <div className="stock-info">
                <div className="stock-symbol">
                  {selectedStock.symbol}
                  <span className="currency-badge">{currencySymbol}</span>
                </div>
                <div className="stock-name">{selectedStock.name}</div>
                <div className="stock-country">
                  {Object.entries(COUNTRY_ISO_CODES).find(
                    ([countryName]) => countryName.toLowerCase() === selectedStock.country.toLowerCase()
                  )?.[0] || selectedStock.country}
                </div>
              </div>
              <button 
                className="btn btn-icon" 
                onClick={() => updateField('selectedStock', null)}
                aria-label="Remove stock"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            {/* Rest of the stock info container */}
            {/* ... */}
          </div>
        </div>
      );
    }
    return null;
  };

  // Load country symbol counts
  useEffect(() => {
    const loadCounts = async () => {
      try {
        const counts = await getCountrySymbolCounts();
        // console.log("Loaded country symbol counts:", counts);
        setCountrySymbolCounts(counts);
      } catch (error) {
        // console.error("Error loading country symbol counts:", error);
      }
    };
    loadCounts();
  }, []);

  const fetchAvatarUrl = useCallback(async () => {
    if (!user?.id) return;
    try {
      const url = await getAvatarImageUrl(user.id);
      setAvatar(url);
    } catch (error) {
      // console.error('Error loading avatar URL:', error);
    }
  }, [user?.id]);
  fetchAvatarUrl();

  const focusPriceInput = useCallback(() => {
    if (priceInputRef.current) {
      priceInputRef.current.focus();
      // console.log('Focused on price element');
    }
  }, []);

  // Refs
  const lastAvatarRefresh = useRef(Date.now());
  const unsubscribeRef = useRef(null);
  const navRef = useRef(null);
  const stockInfoRef = useRef(null);
  const formWrapperRef = useRef(null);
  const fileInputRef = useRef(null);
  const searchInputRef = useRef(null);
  const strategySelectRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const stockSearchResultsRef = useRef(null);

  // Function to set default strategies
  const setDefaultStrategies = useCallback(() => {
    setStrategies([]);
  }, []);

  // Effects
  useEffect(() => {
    if (user) {
      fetchStrategies();
    }
  }, [user]);

  useEffect(() => {
    setIsSubmitting(contextIsSubmitting);
  }, [contextIsSubmitting]);

  useEffect(() => {
    console.log("Component mounted or updated. Context state:", { title, content, selectedStrategy, stockSearch, selectedStock, selectedCountry, apiUrl, currentPrice, targetPrice, stopLoss, priceError, newStrategy, showStrategyDialog, formErrors, submissionProgress, submitState, isSubmitting, isOpen, selectedImageFile });
  }, [title, content, selectedStrategy, stockSearch, selectedStock, selectedCountry, apiUrl, currentPrice, targetPrice, stopLoss, priceError, newStrategy, showStrategyDialog, formErrors, submissionProgress, submitState, isSubmitting, isOpen, selectedImageFile]);

  return (
    <>
      <div className="create-post-form-container" ref={formWrapperRef}>
        {/* Form content starts here */}
        <div className="form-wrapper">
          {/* Loading Overlay */}
          {isSubmitting && (
            <div className="form-loading-overlay" style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              borderRadius: '16px'
            }}>
              <div className="loading-spinner" style={{
                width: '48px',
                height: '48px',
                border: '4px solid #e2e8f0',
                borderTop: '4px solid #3b82f6',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                marginBottom: '16px'
              }}></div>
              <div className="loading-text" style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#374151',
                textAlign: 'center'
              }}>
                Creating your post...
              </div>
              <div className="loading-subtext" style={{
                fontSize: '14px',
                color: '#6b7280',
                textAlign: 'center',
                marginTop: '8px'
              }}>
                You can continue browsing while this runs in the background
              </div>
            </div>
          )}
          {/* Modern Image Preview Section */}
          {(imagePreview || selectedImageFile || imageFile) && (
            <div className="form-group image-preview-section">
              <div className="image-preview-container" style={{
                background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                borderRadius: '16px',
                padding: '20px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
                position: 'relative',
                overflow: 'hidden'
              }}>
                {/* Background Pattern */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  opacity: 0.05,
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                  pointerEvents: 'none'
                }} />
                
                {imagePreview && (
                  <div className="image-preview-wrapper" style={{
                    position: 'relative',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginBottom: '16px'
                  }}>
                    <div style={{
                      position: 'relative',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                      background: 'white',
                      padding: '4px'
                    }}>
                      <img 
                        src={imagePreview} 
                        alt="Image preview" 
                        style={{
                          maxWidth: '300px',
                          maxHeight: '200px',
                          objectFit: 'contain',
                          borderRadius: '8px',
                          display: 'block'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          console.log('Removing image preview...');
                          // Use centralized helper to ensure file input is fully reset
                          clearSelectedImage();
                          toast.success('Image removed successfully!');
                        }}
                        style={{
                          position: 'absolute',
                          top: '8px',
                          right: '8px',
                          background: 'rgba(239, 68, 68, 0.9)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '50%',
                          width: '28px',
                          height: '28px',
                          cursor: 'pointer',
                          fontSize: '16px',
                          fontWeight: 'bold',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backdropFilter: 'blur(4px)',
                          transition: 'all 0.2s ease',
                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.background = 'rgba(239, 68, 68, 1)';
                          e.target.style.transform = 'scale(1.1)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.background = 'rgba(239, 68, 68, 0.9)';
                          e.target.style.transform = 'scale(1)';
                        }}
                        title="Remove image"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Modern File Info Cards - Enhanced for both uploaded files and URLs */}
                {selectedImageFile && (
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.8)',
                      backdropFilter: 'blur(4px)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      border: '1px solid rgba(226, 232, 240, 0.6)',
                      fontSize: '12px',
                      fontWeight: '500',
                      color: '#475569',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14,2 14,8 20,8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10,9 9,9 8,9"></polyline>
                      </svg>
                      {selectedImageFile.name}
                    </div>
                    
                    {/* Show file size only if available (not from URL) */}
                    {selectedImageFile.size && (
                      <div style={{
                        background: 'rgba(255, 255, 255, 0.8)',
                        backdropFilter: 'blur(4px)',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        border: '1px solid rgba(226, 232, 240, 0.6)',
                        fontSize: '12px',
                        fontWeight: '500',
                        color: '#475569',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"></circle>
                          <polyline points="12,6 12,12 16,14"></polyline>
                        </svg>
                        {Math.round(selectedImageFile.size / 1024)} KB
                      </div>
                    )}
                    
                    {/* Show image dimensions if available (from URL metadata) */}
                    {selectedImageFile.width && selectedImageFile.height && (
                      <div style={{
                        background: 'rgba(255, 255, 255, 0.8)',
                        backdropFilter: 'blur(4px)',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        border: '1px solid rgba(226, 232, 240, 0.6)',
                        fontSize: '12px',
                        fontWeight: '500',
                        color: '#475569',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 16V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z"></path>
                          <path d="M14.5 8.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"></path>
                          <path d="M21 15l-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path>
                        </svg>
                        {selectedImageFile.width} × {selectedImageFile.height}px
                      </div>
                    )}
                    
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.8)',
                      backdropFilter: 'blur(4px)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      border: '1px solid rgba(226, 232, 240, 0.6)',
                      fontSize: '12px',
                      fontWeight: '500',
                      color: '#475569',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                        <polyline points="21,15 16,10 5,21"></polyline>
                      </svg>
                      {selectedImageFile.type ? selectedImageFile.type.split('/')[1].toUpperCase() : 'IMG'}
                    </div>
                    
                    {/* Show URL source indicator if image is from URL */}
                    {selectedImageFile.isFromUrl && (
                      <div style={{
                        background: 'rgba(59, 130, 246, 0.1)',
                        backdropFilter: 'blur(4px)',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        fontSize: '12px',
                        fontWeight: '500',
                        color: '#1d4ed8',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                        </svg>
                        من URL
                      </div>
                    )}
                  </div>
                )}
                
                {/* Success Status */}
                {status === 'preview_ready' && (
                  <div style={{ 
                    background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
                    color: '#166534',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    marginTop: '16px',
                    border: '1px solid #bbf7d0',
                    fontSize: '14px',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M9 12l2 2 4-4"></path>
                      <circle cx="12" cy="12" r="10"></circle>
                    </svg>
                    Image ready for upload! You can now create your post.
                  </div>
                )}
                
                {/* Ready Indicator */}
                {selectedImageFile && (
                  <div style={{
                    background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                    color: '#1e40af',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    marginTop: '16px',
                    border: '1px solid #bfdbfe',
                    fontSize: '14px',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M7 10l5 5 5-5"></path>
                      <path d="M12 19V5"></path>
                    </svg>
                    Image selected and ready to post
                  </div>
                )}
              </div>
            </div>
          )}
          

          {/* Selected Stock Info */}
          {selectedStock && (
            <div className="form-group">
              <div className="stock-info-container">
                {/* Background flag with opacity */}
                <div
                  className="stock-info-bg-flag persistent-image"
                  style={{
                    backgroundImage: `url(https://flagcdn.com/${Object.entries(COUNTRY_ISO_CODES).find(
                      ([countryName]) => countryName.toLowerCase() === selectedStock.country.toLowerCase()
                    )?.[1]?.toLowerCase() || selectedStock.country.toLowerCase()}.svg)`
                  }}
                ></div>
                
                {/* Gray layer between flag and content */}
                <div className="stock-info-gray-layer"></div>
                
                <div className="stock-info-overlay">
                  {/* Stock Item */}
                  <div className="stock-item selected">
                    <div className="stock-info">
                      <div className="stock-symbol">
                        {selectedStock.symbol}
                        <span className="currency-badge">{currencySymbolFor(selectedStock.country)}</span>
                      </div>
                      <div className="stock-name">{selectedStock.name}</div>
                      <div className="stock-country">
                        {Object.entries(COUNTRY_ISO_CODES).find(
                          ([countryName]) => countryName.toLowerCase() === selectedStock.country.toLowerCase()
                        )?.[0] || selectedStock.country}
                      </div>
                    </div>
                    <button 
                      className="btn btn-icon" 
                      onClick={() => updateField('selectedStock', null)}
                      aria-label="Remove stock"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  </div>

                  {/* Big Price Banner - Always visible even when loading */}
                  <div className="stock-price-banner">
                    <div className="stock-price-label">
                      Current Price {selectedStock?.country && <span className="stock-country-code">({selectedStock.country})</span>}
                    </div>
                    {(isSearching || priceLoading) ? (
                    <div className="stock-price-loading">
                    {priceLoading ? 'Fetching latest price...' : 'Loading...'}
                    </div>
                    ) : currentPrice !== null && !isNaN(currentPrice) ? (
                      <div className="stock-price stock-price-value">
                        {currencySymbolFor(selectedStock.country)} {typeof currentPrice === 'number' ? currentPrice.toFixed(2) : parseFloat(currentPrice).toFixed(2)}
                      </div>
                    ) : (
                      <div className="stock-price-unavailable">
                        {apiResponse && apiResponse.error ? (
                          <div className="error-message">{apiResponse.error}</div>
                        ) : (
                          <div className="api-url-display-inline">
                            <div className="url-label">No price available</div>
                          </div>
                        )}
                      </div>
                    )}

                    {selectedStock && !isSearching && (
                      <div className="stock-price-info">
                        Symbol: {selectedStock.symbol} • Exchange: {selectedStock.exchange || 'N/A'}
                        {selectedStock.country && (
                          <span className="currency-info"> • Currency: {currencySymbolFor(selectedStock.country)}</span>
                        )}
                      </div>
                    )}
                    
                    {/* Display API response summary in the price banner */}
                    {apiResponse && !isSearching && (
                      <div>
                        <div className="response-source">
                          Data Source: <span className="response-source-value">{apiResponse.source || 'API'}</span>
                        </div>
                        {apiResponse.source === 'api' && apiResponse.url && (
                          <div className="response-url" title={apiResponse.url}>
                            <span className="url-label">Response:</span> 
                            <span className="url-value">
                              {typeof apiResponse.data === 'object' ? 
                                JSON.stringify(apiResponse.data, null, 2).substring(0, 150) + 
                                (JSON.stringify(apiResponse.data, null, 2).length > 150 ? '...' : '') 
                                : apiResponse.data || 'No data available'}
                            </span>
                          </div>
                        )}
                        {apiResponse.error ? (
                          <div className="response-error">Error: {apiResponse.error}</div>
                        ) : apiResponse.data ? (
                          <div className="response-summary">
                            {typeof apiResponse.data === 'object' ? (
                              <span className="response-summary-text">
                                {Array.isArray(apiResponse.data) 
                                  ? `Received ${apiResponse.data.length} data points` 
                                  : 'Response received successfully'}
                              </span>
                            ) : (
                              <span className="response-summary-text">Data received</span>
                            )}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>

                  {/* Price History Display */}
                  {priceHistory && priceHistory.length > 0 && (
                    <div className="price-history-container">
                      <h4 className="price-history-title">7-Day Price History</h4>
                      <div className="price-chart">
                        {priceHistory.map((day, index) => {
                          const maxPrice = Math.max(...priceHistory.map(d => d.high));
                          const minPrice = Math.min(...priceHistory.map(d => d.low));
                          const priceRange = maxPrice - minPrice;
                          const heightPercent = priceRange > 0 
                            ? ((day.close - minPrice) / priceRange) * 100 
                            : 50;
                          
                          // Calculate bar color based on price change from previous day
                          const prevDay = index > 0 ? priceHistory[index - 1] : null;
                          const priceChange = prevDay ? day.close - prevDay.close : 0;
                          const barColor = priceChange > 0 ? '#4ade80' : priceChange < 0 ? '#f87171' : '#94a3b8';
                          
                          return (
                            <div key={day.date} className="price-bar-wrapper">
                              <div 
                                className="price-bar" 
                                style={{ 
                                  height: `${Math.max(heightPercent, 5)}%`,
                                  backgroundColor: barColor
                                }}
                                title={`${day.date}: ${currencySymbolFor(selectedStock.country)}${day.close}`}
                              ></div>
                              <div className="price-date">{day.date.split('-')[2]}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="price-inputs">
                    <div className="form-row price-inputs-container">
                      <div className="form-group col-md-6 target-price-group">
                        <label htmlFor="targetPrice">Target Price</label>
                        <div className="price-input-with-percentage">
                          

                          <input
                            type="number"
                            className={`form-control ${selectedStock ? 'with-currency-symbol' : ''}`}
                            id="targetPrice"
                            value={targetPrice}
                            onChange={(e) => {
                              const newTargetPrice = parseFloat(e.target.value);
                              
                              // Always update the field to allow editing
                              updateField('targetPrice', e.target.value);
                              
                              // Validate if we have a valid target price and current price
                              if (!isNaN(newTargetPrice) && !isNaN(currentPrice)) {
                                // Check if target price is smaller than or equal to current price
                                if (newTargetPrice <= currentPrice) {
                                  // Set validation error
                                  updateField('formErrors', {
                                    ...(formErrors || {}),
                                    targetPrice: 'Target price must be greater than current price'
                                  });
                                  // Show error message
                                  setGlobalStatus({ type: 'error', message: 'Target price must be greater than current price' });
                                } else {
                                  // Clear error if valid
                                  updateField('formErrors', {
                                    ...(formErrors || {}),
                                    targetPrice: null
                                  });
                                }
                                
                                // Calculate new percentage
                                const newPercentage = (((parseFloat(e.target.value) / currentPrice) - 1) * 100).toFixed(1);
                                updateField('targetPricePercentage', parseFloat(newPercentage));
                              }
                            }}
                            placeholder="Target Price"
                          />
                          <div className="price-percentage-edit">
                            <input 
                              type="text" 
                              className="percentage-input target-input" 
                              value={targetPricePercentage}
                              onChange={(e) => {
                                // Only allow numbers and decimal point
                                const value = e.target.value.replace(/[^0-9.]/g, '');
                                
                                // Limit to one decimal point
                                const parts = value.split('.');
                                const formattedValue = parts[0] + (parts.length > 1 ? '.' + parts[1] : '');
                                
                                const newPercentage = parseFloat(formattedValue);
                                
                                // Limit percentage between 0 and 100
                                if (!isNaN(newPercentage)) {
                                  const limitedPercentage = Math.min(Math.max(newPercentage, 0), 100);
                                  updateField('targetPricePercentage', limitedPercentage);
                                  
                                  if (currentPrice && !isNaN(currentPrice)) {
                                    const newTargetPrice = (currentPrice * (1 + limitedPercentage/100)).toFixed(2);
                                    updateField('targetPrice', newTargetPrice);
                                    
                                    // Validate the new target price
                                    if (parseFloat(newTargetPrice) <= currentPrice) {
                                      // Set validation error
                                      updateField('formErrors', {
                                        ...(formErrors || {}),
                                        targetPrice: 'Target price must be greater than current price'
                                      });
                                      // Show error message
                                      setGlobalStatus({ type: 'error', message: 'Target price must be greater than current price' });
                                    } else {
                                      // Clear error if valid
                                      updateField('formErrors', {
                                        ...(formErrors || {}),
                                        targetPrice: null
                                      });
                                    }
                                  }
                                } else {
                                  // If input is empty or invalid, just update the field value
                                  updateField('targetPricePercentage', value === '' ? '' : 0);
                                }
                              }}
                              pattern="[0-9]+(\.[0-9]+)?"
                              aria-label="Target percentage"
                            />
                            <span className="percentage-symbol">%</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="form-group col-md-6 stop-loss-price-group">
                        <label htmlFor="stopLoss">Stop Loss</label>
                        <div className="price-input-with-percentage">
                          

                          <input
                            type="number"
                            className={`form-control ${selectedStock ? 'with-currency-symbol' : ''}`}
                            id="stopLoss"
                            value={stopLoss}
                            onChange={(e) => {
                              const newStopLossPrice = parseFloat(e.target.value);
                              
                              // Always update the field to allow editing
                              updateField('stopLoss', e.target.value);
                              
                              // Validate if we have a valid stop loss price and current price
                              if (!isNaN(newStopLossPrice) && !isNaN(currentPrice)) {
                                // Check if stop loss price is bigger than or equal to current price
                                if (newStopLossPrice >= currentPrice) {
                                  // Set validation error
                                  updateField('formErrors', {
                                    ...(formErrors || {}),
                                    stopLoss: 'Stop loss price must be less than current price'
                                  });
                                  // Show error message
                                  setGlobalStatus({ type: 'error', message: 'Stop loss price must be less than current price' });
                                } else {
                                  // Clear error if valid
                                  updateField('formErrors', {
                                    ...(formErrors || {}),
                                    stopLoss: null
                                  });
                                }
                                
                                // Calculate new percentage
                                const newPercentage = ((1 - (parseFloat(e.target.value) / currentPrice)) * 100).toFixed(1);
                                updateField('stopLossPercentage', parseFloat(newPercentage));
                              }
                            }}
                            placeholder="Stop Loss Price"
                          />
                          <div className="price-percentage-edit">
                            <input 
                              type="text" 
                              className="percentage-input stop-loss-input" 
                              value={stopLossPercentage}
                              onChange={(e) => {
                                // Only allow numbers and decimal point
                                const value = e.target.value.replace(/[^0-9.]/g, '');
                                
                                // Limit to one decimal point
                                const parts = value.split('.');
                                const formattedValue = parts[0] + (parts.length > 1 ? '.' + parts[1] : '');
                                
                                const newPercentage = parseFloat(formattedValue);
                                
                                // Limit percentage between 0 and 100
                                if (!isNaN(newPercentage)) {
                                  const limitedPercentage = Math.min(Math.max(newPercentage, 0), 100);
                                  updateField('stopLossPercentage', limitedPercentage);
                                  
                                  // Update stop loss price based on the new percentage
                                  if (currentPrice && !isNaN(currentPrice)) {
                                    const newStopLossPrice = (currentPrice * (1 - limitedPercentage/100)).toFixed(2);
                                    updateField('stopLoss', newStopLossPrice);
                                    
                                    // Validate the new stop loss price
                                    if (parseFloat(newStopLossPrice) >= currentPrice) {
                                      // Set validation error
                                      updateField('formErrors', {
                                        ...(formErrors || {}),
                                        stopLoss: 'Stop loss price must be less than current price'
                                      });
                                      // Show error message
                                      setGlobalStatus({ type: 'error', message: 'Stop loss price must be less than current price' });
                                    } else {
                                      // Clear error if valid
                                      updateField('formErrors', {
                                        ...(formErrors || {}),
                                        stopLoss: null
                                      });
                                    }
                                  }
                                } else {
                                  // If input is empty or invalid, just update the field value
                                  updateField('stopLossPercentage', value === '' ? '' : 0);
                                }
                              }}
                              pattern="[0-9]+(\.[0-9]+)?"
                              aria-label="Stop loss percentage"
                            />
                            <span className="percentage-symbol">%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* حقل اختيار استراتيجية التداول */}
                  <div className="form-group strategy-form-group">
                    <label htmlFor="strategy" className="form-label">Trading Strategy</label>
                    
                    <div 
                      className="strategy-field-container"
                      onClick={openStrategyDialog}
                      role="button"
                      tabIndex="0"
                      aria-haspopup="dialog"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          openStrategyDialog();
                          e.preventDefault();
                        }
                      }}
                    >
                      <div className="select-field">
                        {selectedStrategy ? (
                          <div className="selected-strategy">
                            <span className="strategy-name">{selectedStrategy}</span>
                            <button 
                              type="button" 
                              className="clear-strategy-button"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateField('selectedStrategy', '');
                              }}
                              aria-label="Clear selected strategy"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <span className="placeholder">Select a trading strategy</span>
                        )}
                        <div className="select-field-icon">
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="form-group">
            <div className="user-info">
              <div 
                className="user-avatar user-avatar-cursor"
                onDrop={handleAvatarDrop}
                onDragOver={handleAvatarDragOver}
                title="Drop new avatar image here"
              >
                <img 
                  src={avatarUrl} 
                  alt="User avatar" 
                  className="persistent-image" 
                  loading="eager"
                  fetchPriority="high"
                  decoding="sync"
                />
              </div>
              <span className="user-email">{user?.email}</span>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="description" className="form-label">What's on your mind?</label>
            <RTLTextArea
              id="description"
              value={contextDescription}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="Share your thoughts..."
              className={`form-control ${formErrors.content ? 'is-invalid' : ''}`}
              rows={4}
              maxLength={1000}
            />
            <div className="focus-ring"></div>
            {formErrors.content && (
              <div className="invalid-feedback">{formErrors.content}</div>
            )}
          </div>

          {/* Image Upload */}
          <div className="form-group">
            <label className="form-label">Add Image</label>
            <div className="file-upload">
              <input
                type="file"
                ref={fileInputRef}
                className="file-upload-input"
                accept="image/*"
                onChange={handleImageChange}
              />
              <div className="file-upload-label" onClick={() => fileInputRef.current?.click()}>
                <span className="file-upload-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                  </svg>
                </span>
                <span className="file-upload-text">Click to upload an image or drag and drop</span>
              </div>
            </div>
            
            <div className="form-actions">
              <button className="btn btn-outline" onClick={() => setShowImageUrlInput(!showImageUrlInput)}>
                {showImageUrlInput ? 'Hide URL input' : 'Use Image URL'}
              </button>
            </div>
            
            {showImageUrlInput && (
              <div className="form-group">
                <label htmlFor="imageUrl" className="form-label">Image URL</label>
                <input
                  id="imageUrl"
                  type="url"
                  value={imageUrl}
                  onChange={handleImageUrlChange}
                  placeholder="Enter image URL"
                  className="form-control"
                />
                <div className="focus-ring"></div>
                {imageUploadError && (
                  <div className="invalid-feedback">{imageUploadError}</div>
                )}
                {/* Debug logs for image actions (visible in form) */}
                {debugLogs.length > 0 && (
                  <div className="debug-logs">
                    <strong>Image debug:</strong>
                    <ul>
                      {debugLogs.map((d, i) => (
                        <li key={`dbg-${i}`}>{d}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
                
          {/* Stock Search Section */}
          <div className="form-group stock-search-container">
            
            <div className="stock-search-wrapper">
              
              
              {/* Country Selection Dialog Button */}
              {renderCountrySelect()}
              
              {/* Stock Symbol Search Dialog Button */}
              {renderStockSearch()}
            </div>
          </div>
        </div>

        {/* نافذة اختيار الاستراتيجية */}
        <div 
          className={`strategy-dialog-backdrop ${showStrategyDialog ? 'show' : ''}`}
          onClick={(e) => {
            // إغلاق الديالوج عند النقر على الخلفية فقط
            if (e.target.className && e.target.className.includes('strategy-dialog-backdrop')) {
              closeStrategyDialog();
            }
          }}
        >
          <div 
            className="strategy-dialog"
            ref={strategySelectRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="strategy-dialog-title"
          >
            <div className="strategy-dialog-header">
              <h3 className="strategy-dialog-title" id="strategy-dialog-title">
                Select a strategy
              </h3>
              <button 
                type="button"
                className="dialog-close-button" 
                onClick={closeStrategyDialog}
                aria-label="Close dialog"
              >
                Close
              </button>
            </div>
            
            <div className="strategy-dialog-content">
              {/* عرض الاستراتيجيات الافتراضية */}
              {DEFAULT_STRATEGIES.map((strategy, index) => (
                <div 
                  key={`strategy-${index}`}
                  className={`strategy-option ${selectedStrategy === strategy ? 'selected' : ''}`}
                  onClick={() => {
                    updateField('selectedStrategy', strategy);
                    closeStrategyDialog();
                  }}
                  tabIndex="0"
                  role="option"
                  aria-selected={selectedStrategy === strategy}
                >
                  <div className="strategy-option-name">{strategy}</div>
                  <div className="strategy-option-desc">Trading strategy</div>
                </div>
              ))}
              
              {/* Add strategy section */}
              <div className="add-strategy-container">
                <div className="add-strategy-header">Add New Strategy</div>
                <div className="add-strategy-form">
                  <input
                    type="text"
                    value={newStrategy}
                    onChange={(e) => updateField('newStrategy', e.target.value)}
                    placeholder="Enter a new strategy name"
                    className="form-control"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newStrategy.trim()) {
                        handleAddStrategy();
                        closeStrategyDialog();
                      } else if (e.key === 'Escape') {
                        closeStrategyDialog();
                      }
                    }}
                  />
                  <button 
                    type="button"
                    className="btn btn-primary btn-sm" 
                    onClick={() => {
                      if (newStrategy.trim()) {
                        handleAddStrategy();
                        closeStrategyDialog();
                      }
                    }}
                    disabled={!newStrategy.trim()}
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Buttons - Fixed at bottom */}
        <div className="form-actions form-actions-bottom">
        {/* Price loading hint */}
        {priceLoading && selectedStock && (
        <div className="price-loading-hint" style={{
        fontSize: '12px',
        color: '#6b7280',
        textAlign: 'center',
        marginBottom: '8px',
        padding: '4px 8px',
        backgroundColor: '#f3f4f6',
        borderRadius: '4px',
        border: '1px solid #e5e7eb'
        }}>
        ⏳ Fetching latest price...
        </div>
        )}
        
        {!isSubmitting ? (
          <>
            <button
              onClick={handleSubmit}
              disabled={!selectedStock || !selectedStock.symbol ||
              formErrors.targetPrice || formErrors.stopLoss ||
              // Gate until price fetch resolves or fails
              priceLoading ||
              (selectedStock && (currentPrice == null && !priceError)) ||
              // Keep existing validations when price is present
              (currentPrice && targetPrice && parseFloat(targetPrice) <= parseFloat(currentPrice)) ||
              (currentPrice && stopLoss && parseFloat(stopLoss) >= parseFloat(currentPrice)) ||
              !!currentTask}
              className="btn btn-primary"
              title={
                formErrors.targetPrice || formErrors.stopLoss ? 'Please fix validation errors before posting' :
                (currentPrice && targetPrice && parseFloat(targetPrice) <= parseFloat(currentPrice)) ? 'Target price must be greater than current price' :
                (currentPrice && stopLoss && parseFloat(stopLoss) >= parseFloat(currentPrice)) ? 'Stop loss price must be less than current price' :
                priceLoading ? 'Fetching latest price...' :
                (selectedStock && (currentPrice == null && !priceError)) ? 'Waiting for latest price' :
                ''
              }
            >
              {currentTask ? 'Posting...' : 'Post'}
            </button>
            {currentTask && (
              <div className="bg-task-status" style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="bg-task-progress" style={{ flex: '0 0 120px', height: 6, background: '#eee', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${currentTask.progress || 0}%`, height: '100%', background: '#3b82f6', transition: 'width 150ms ease' }} />
                </div>
                <span className="bg-task-text" style={{ fontSize: 12, color: '#6b7280' }}>
                  {currentTask.status === 'uploading' ? 'Uploading image' : currentTask.status === 'creating' ? 'Creating post' : currentTask.status}
                </span>
                {currentTask.canCancel && (
                  <button className="btn btn-cancel" onClick={cancelPosting} style={{ fontSize: 12 }}>
                    Cancel
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="posting-status">
            <div className="posting-spinner"></div>
            <span className="posting-text">Posting...</span>
            <button 
              className="btn btn-cancel" 
              onClick={cancelPosting}
            >
              Cancel
            </button>
          </div>
        )}
        
        </div>
      </div>

      {/* Country Selection Dialog */}
      <CountrySelectDialog
        isOpen={isCountrySelectOpen}
        onClose={handleCloseCountrySelect}
        onSelectCountry={handleSelectCountry}
        selectedCountry={selectedCountry}
        countryCounts={countrySymbolCounts}
      />

      {/* Symbol Search Dialog */}
      <SymbolSearchDialog
        isOpen={isSymbolSearchOpen}
        onClose={handleCloseSymbolSearch}
        onSelectStock={handleSelectStock}
        initialStockSearch={stockSearch}
        selectedCountry={selectedCountry}
      />
    </>
  );
}

// Add a named export to support both default and named imports
export { CreatePostForm };