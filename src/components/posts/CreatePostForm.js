'use client';

import { useState, useEffect, useRef, useCallback } from "react";
import { useSupabase } from '@/providers/SupabaseProvider'; // Updated from useAuth
import { useProfile } from '@/providers/ProfileProvider'; // Updated from contexts/ProfileContext
import { generateEodLastCloseUrl, countries, BASE_URL, API_KEY } from '@/utils/stockApi';
import { getCountrySymbolCounts, searchStocks } from '@/utils/symbolSearch';
import { uploadPostImage } from '@/utils/supabase';
import { useCreatePostForm } from '@/providers/CreatePostFormProvider'; // Updated from contexts/CreatePostFormContext
import { createClient } from '@supabase/supabase-js';
import { COUNTRY_CODE_TO_NAME } from '@/models/CountryData'; // Import from models
import { CURRENCY_SYMBOLS, getCurrencySymbol, COUNTRY_ISO_CODES } from '@/models/CurrencyData'; // Import from models
import 'flag-icons/css/flag-icons.min.css';
import '@/styles/create-post-page.css';
import '@/styles/animation.css';
import countrySummaryData from '@/symbols_data/country_summary_20250304_171206.json';

// Create reusable Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// Add a function to load country symbol counts from the JSON file
const loadCountrySymbolCounts = () => {
  const counts = {};
  let total = 0;
  
  // Process the country summary data
  Object.keys(countrySummaryData).forEach(country => {
    // Convert country names to ISO codes
    const countryData = countrySummaryData[country];
    const isoCode = COUNTRY_ISO_CODES[country] || country.toLowerCase();
    
    if (countryData && countryData.TotalSymbols) {
      counts[isoCode] = countryData.TotalSymbols;
      total += countryData.TotalSymbols;
    }
  });
  
  // Set the total count for all countries
  counts.total = total;
  
  // Also set 'all' as an alias for total to fix the 'All Countries' display
  counts.all = total;
  
  return counts;
};

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

export default function CreatePostForm() {
  const { user } = useSupabase();
  const { profile, getEffectiveAvatarUrl, addPost } = useProfile();
  
  // Since there's no formState, directly destructure values from context with defaults
  const { 
    updateField, 
    resetForm,
    closeDialog,
    title = '',
    content = '',
    description: contextDescription = '',
    imageFile = null,
    imagePreview = '',
    imageUrl = '',
    preview = [],
    stockSearch = '',
    searchResults = [],
    selectedStock = null,
    selectedCountry: contextSelectedCountry = 'all',
    currentPrice = null,
    targetPrice = '',
    stopLossPrice = '',
    selectedStrategy = '',
    targetPercentage = '',
    stopLossPercentage = '',
    isSubmitting: contextIsSubmitting = false,
    submissionProgress = '',
    setGlobalStatus,
    setSubmitState
  } = useCreatePostForm() || {};

  // addPost function is imported from ProfileProvider

  const [strategies, setStrategies] = useState([]);
  const [newStrategy, setNewStrategy] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showStockSearch, setShowStockSearch] = useState(false);
  const [showImageUrlInput, setShowImageUrlInput] = useState(false);
  const [showStrategyInput, setShowStrategyInput] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('/default-avatar.svg');
  const [selectedCountry, setSelectedCountry] = useState('all');
  const [apiUrl, setApiUrl] = useState('');
  const [formattedApiUrl, setFormattedApiUrl] = useState('');
  const [countrySymbolCounts, setCountrySymbolCounts] = useState({});
  const [priceHistory, setPriceHistory] = useState([]);
  const [apiResponse, setApiResponse] = useState(null);
  const [formErrors, setFormErrors] = useState({
    targetPrice: null,
    stopLossPrice: null
  });
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
  const [isSubmitting, setIsSubmitting] = useState(contextIsSubmitting);
  
  const fileInputRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const searchInputRef = useRef(null);
  const stockSearchResultsRef = useRef(null);
  const strategySelectRef = useRef(null);
  const formWrapperRef = useRef(null);
  const [showStrategyDialog, setShowStrategyDialog] = useState(false);

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
    // Load popular countries data
    const loadPopularCountriesData = () => {
      try {
        // Get counts directly from our JSON file
        const counts = loadCountrySymbolCounts();
        setCountrySymbolCounts(counts);
        console.log("Loaded country symbol counts:", counts);
      } catch (error) {
        console.error("Error loading country symbol counts:", error);
      }
    };
    
    loadPopularCountriesData();
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
            console.error('Error fetching strategies from database:', error);
            // Keep using default strategies
          } else if (data && data.length > 0) {
            console.log('Retrieved user strategies from database:', data);
            // Combine user strategies with default ones
            const userStrategyNames = data.map(s => s.name);
            const combinedStrategies = [...userStrategyNames, ...DEFAULT_STRATEGIES.filter(s => !userStrategyNames.includes(s))];
            setStrategies(combinedStrategies);
          } else {
            console.log('No user strategies found, using default strategies');
            // Already set to default strategies above
          }
        } catch (dbError) {
          console.error('Database error fetching strategies:', dbError);
          // Keep using default strategies
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
                name: strategyName,
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
      setShowStrategyInput(false);
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
    if (stockSearch.length < 2) {
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
          console.log(`Searching in country: ${searchCountry}`);
        }
        
        // Use our local symbol search instead of API
        const results = await searchStocks(stockSearch, searchCountry);
        
        // If stockSearch has changed while we were searching, discard results
        if (stockSearch.length < 2) {
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
        console.error('Error searching stocks:', error);
        
        // When search fails, load popular stocks from the current country
        if (selectedCountry !== 'all') {
          // Don't show loading state as requested
          setIsSearching(false);
          
          // Convert ISO country code to country name
          let countryName = selectedCountry;
          if (countryName.length === 2 && COUNTRY_CODE_TO_NAME[countryName.toLowerCase()]) {
            countryName = COUNTRY_CODE_TO_NAME[countryName.toLowerCase()];
          }
          
          // Load up to 250 popular stocks from the selected country
          try {
            const popularStocks = await searchStocks('', countryName, 250);
            if (popularStocks && popularStocks.length > 0) {
              console.log(`Loaded ${popularStocks.length} popular stocks for ${countryName}`);
              
              // Format the results to match the expected structure
              const formattedResults = popularStocks.map(item => ({
                symbol: item.Symbol || item.symbol,
                name: item.Name || item.name,
                country: item.Country || item.country,
                exchange: item.Exchange || item.exchange,
                uniqueId: item.uniqueId || `${item.symbol || item.Symbol}-${item.country || item.Country}-${Math.random().toString(36).substring(7)}`
              }));
              
              updateField('searchResults', formattedResults);
            } else {
              updateField('searchResults', [{
                symbol: `No stocks available for ${countryName}`,
                name: "Please try another country",
                country: selectedCountry,
                exchange: "",
                uniqueId: "no-stocks-available"
              }]);
            }
          } catch (popularStocksError) {
            console.error('Error loading popular stocks:', popularStocksError);
            updateField('searchResults', [{
              symbol: `Could not load stocks from ${countryName}`,
              name: "Please try again later",
              country: selectedCountry,
              exchange: "",
              uniqueId: "popular-stocks-error"
            }]);
          } finally {
            setIsSearching(false);
          }
        } else {
          // For 'All Countries', just clear the results
          updateField('searchResults', []);
          setIsSearching(false);
        }
      }
    }, 500);

    // Cleanup function
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
        setIsSearching(false); // Ensure loading state is cleared on cleanup
      }
    };
  }, [stockSearch, selectedCountry, searchResults, updateField]);

  // Handle country selection change
  const handleCountryChange = (value) => {
    // Store the selected country
    setSelectedCountry(value);
    
    // Update API URL if a stock is selected
    if (stockSearch) {
      setApiUrl(generateEodLastCloseUrl(stockSearch, value === 'all' ? '' : value));
    }
    
    // When a country is selected, load all symbols for that country
    if (value !== 'all') {
      // Set loading state to true
      setIsSearching(true);
      
      // Show loading state in search results
      updateField('searchResults', [{
        symbol: "Loading...",
        name: "Fetching symbols, please wait",
        country: value,
        exchange: "",
        uniqueId: "loading-symbols"
      }]);
      
      // Convert ISO country code to country name
      let countryName = value;
      if (countryName.length === 2 && COUNTRY_CODE_TO_NAME[countryName.toLowerCase()]) {
        countryName = COUNTRY_CODE_TO_NAME[countryName.toLowerCase()];
      }
      
      console.log(`Loading all symbols for country: ${countryName}`);
      
      // Use empty query to load all symbols for the country
      searchStocks('', countryName, 250)
        .then(results => {
          if (results && results.length > 0) {
            console.log(`Loaded ${results.length} symbols for ${countryName}`);
            
            // Check if the first result is an error message
            if (results[0].uniqueId && (
                results[0].uniqueId.includes('error') || 
                results[0].uniqueId.includes('unavailable') || 
                results[0].uniqueId.includes('no-symbols'))) {
              console.warn("Received error message in results:", results[0]);
              // Still show these as regular results for better UX
            }
            
            // Format the results to match the expected structure
            const formattedResults = results.map(item => ({
              symbol: item.Symbol || item.symbol,
              name: item.Name || item.name,
              country: item.Country || item.country,
              exchange: item.Exchange || item.exchange,
              uniqueId: item.uniqueId || `${item.symbol || item.Symbol}-${item.country || item.Country}-${Math.random().toString(36).substring(7)}`
            }));
            
            updateField('searchResults', formattedResults);
          } else {
            console.warn(`No symbols returned for ${countryName}`);
            // Show a friendly message within the search results if no symbols are found
            updateField('searchResults', [{
              symbol: `${countryName} - No symbols available`,
              name: "Please try another country",
              country: value,
              exchange: "",
              uniqueId: "no-symbols-message"
            }]);
          }
        })
        .catch(error => {
          console.error('Error loading symbols:', error);
          // Show error message in search results instead of form error
          updateField('searchResults', [{
            symbol: `${countryName} - Temporarily unavailable`,
            name: "Please try again later or select another country",
            country: value,
            exchange: "",
            uniqueId: "error-message"
          }]);
        })
        .finally(() => {
          setIsSearching(false);
        });
    } else {
      // If 'All Countries' is selected, clear results until user types search
      updateField('searchResults', []);
      setIsSearching(false);
    }
  };

  // Update API URL when stock search changes
  useEffect(() => {
    if (stockSearch) {
      setApiUrl(generateEodLastCloseUrl(stockSearch, selectedCountry === 'all' ? '' : selectedCountry));
    }
  }, [stockSearch, selectedCountry]);

  // scrollToStockInfo is defined at line 736
  
  // Handle stock selection
  const handleStockSelect = async (stock) => {
    try {
      // Set selected stock immediately for better UX
      updateField('selectedStock', stock);
      // Clear stock search to close dropdown
      updateField('stockSearch', '');
      updateField('searchResults', []);
      // Show loading state
      setIsSearching(true);
      // Scroll to the stock info section
      scrollToStockInfo();
      
      // First, let's properly format the symbol for consistent API use
      const formattedSymbol = formatSymbolForApi(stock.symbol, stock.country);
      console.log(`Formatted symbol for API: ${formattedSymbol}`);
      
      // Get the full country name if needed
      let countryName = stock.country;
      if (countryName.length === 2 && COUNTRY_CODE_TO_NAME[countryName.toLowerCase()]) {
        countryName = COUNTRY_CODE_TO_NAME[countryName.toLowerCase()];
      }
      
      // Always use the API directly
      console.log(`Fetching price directly from API for ${stock.symbol} (${countryName})`);
      
      // No local data available, proceed directly to API call
      
      // Generate the API URL using the utility function
      const currentApiUrl = generateEodLastCloseUrl(stock.symbol, countryName);
      
      // Store the properly formatted API URL for display
      setApiUrl(currentApiUrl);
      setFormattedApiUrl(currentApiUrl);
      console.log(`Fetching price from API URL: ${currentApiUrl}`);
      
      // For exchanges, don't try to get price data
      if (stock.exchange) {
        updateField('currentPrice', null);
        updateField('targetPrice', '');
        updateField('stopLossPrice', '');
        setPriceHistory([]);
        setApiResponse(null);
        
        // Even without price data, scroll to stock info
        setTimeout(() => {
          scrollToStockInfo();
        }, 100);
      } else {
        // Fetch price data using the generated URL
        try {
          console.log(`Fetching price data from API: ${currentApiUrl}`);
          // Always fetch the data from the API for the most up-to-date price
          
          // Track fetch start time
          const fetchStartTime = new Date();
          
          const response = await fetch(currentApiUrl);
          
          // Calculate fetch duration
          const fetchEndTime = new Date();
          const fetchDuration = fetchEndTime - fetchStartTime;
          
          if (!response.ok) {
            throw new Error(`API returned status: ${response.status}`);
          }
          
          const priceData = await response.json();
          console.log(`API response:`, priceData);
          
          // Store the full response
          setApiResponse({
            source: 'api',
            url: currentApiUrl,
            data: priceData,
            fetched: true,
            fetchTime: `${fetchDuration}ms`
          });
          
          if (Array.isArray(priceData) && priceData.length > 0 && priceData[0] && typeof priceData[0].close === 'number') {
            const price = priceData[0].close;
            console.log(`Successfully parsed price from API: $${price}`);
            
            updateField('currentPrice', price);
            
            // Set default target prices based on the fetched price
            updateField('targetPrice', (price * 1.05).toFixed(2));
            updateField('stopLossPrice', (price * 0.95).toFixed(2));
            
            // Create a simple price history with just the current data point
            setPriceHistory([{
              date: priceData[0].date || new Date().toISOString().split('T')[0],
              open: priceData[0].open || price,
              high: priceData[0].high || price,
              low: priceData[0].low || price,
              close: price,
              volume: priceData[0].volume || 0
            }]);
          } else {
            console.warn(`Invalid API response structure for ${stock.symbol}:`, priceData);
            throw new Error('Invalid price data structure in API response');
          }
        } catch (error) {
          console.error(`Error fetching stock price from API: ${error.message}`);
          // Set default values in case of error
          updateField('currentPrice', null);
          updateField('targetPrice', '');
          updateField('stopLossPrice', '');
          setPriceHistory([]);
          
          // Try to fetch directly from the URL as a fallback
          try {
            console.log(`Attempting direct fetch from: ${currentApiUrl}`);
            
            // Create a new AbortController to limit fetch time
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            // Track fetch start time
            const fetchStartTime = new Date();
            
            const directResponse = await fetch(currentApiUrl, {
              signal: controller.signal,
              headers: {
                'Accept': 'application/json'
              }
            });
            
            clearTimeout(timeoutId);
            
            // Calculate fetch duration
            const fetchEndTime = new Date();
            const fetchDuration = fetchEndTime - fetchStartTime;
            
            if (!directResponse.ok) {
              throw new Error(`Direct API call returned status: ${directResponse.status}`);
            }
            
            const directData = await directResponse.json();
            console.log('Direct API response:', directData);
            
            setApiResponse({
              source: 'direct_api',
              url: currentApiUrl,
              data: directData,
              fetched: true,
              fetchTime: `${fetchDuration}ms`
            });
            
            // Try to parse price data from the direct response
            if (Array.isArray(directData) && directData.length > 0 && directData[0]?.close) {
              const directPrice = directData[0].close;
              updateField('currentPrice', directPrice);
              updateField('targetPrice', (directPrice * 1.05).toFixed(2));
              updateField('stopLossPrice', (directPrice * 0.95).toFixed(2));
              
              console.log(`Successfully parsed price from direct API: $${directPrice}`);
            }
          } catch (directError) {
            console.error(`Direct fetch failed: ${directError.message}`);
            setApiResponse({
              source: 'api',
              url: currentApiUrl,
              error: `${error.message} (Direct fetch also failed: ${directError.message})`,
              fetched: true
            });
          }
        }
      }
      
      // Scroll to the stock info container with a slightly longer delay to ensure it's fully rendered
      // This is especially important when API data is being loaded
      setTimeout(() => {
        scrollToStockInfo();
        // If the first attempt doesn't work well, try again after a short delay
        setTimeout(() => {
          scrollToStockInfo();
        }, 500);
      }, 500); // 500ms delay to ensure the component is fully rendered with data

    } catch (error) {
      console.error('Error selecting stock/exchange:', error);
      // Don't show static data - set all price-related values to null or empty
      updateField('currentPrice', null);
      updateField('targetPrice', '');
      updateField('stopLossPrice', '');
      setPriceHistory([]);
    } finally {
      // Always clear loading state
      setIsSearching(false);
    }
  };

  // Helper function to scroll to stock info with improved reliability
  const scrollToStockInfo = () => {
    console.log('scrollToStockInfo called');
    
    // Force scroll to top immediately for all possible containers
    const scrollContainers = [
      formWrapperRef.current,
      document.querySelector('.form-wrapper'),
      document.querySelector('.create-post-form-container'),
      document.querySelector('.dialog-content'),
      document.querySelector('.modal-content')
    ];
    
    // Try to scroll all possible containers to top
    scrollContainers.forEach(container => {
      if (container) {
        try {
          // Try both methods
          container.scrollTo(0, 0);
          container.scrollTop = 0;
          console.log('Scrolled container to top');
        } catch (e) {
          console.error('Error scrolling container:', e);
        }
      }
    });
    
    // Schedule multiple scroll attempts with increasing delays
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        // Try to find the stock info container
        const stockInfoContainer = document.querySelector('.stock-info-container');
        const stockItem = document.querySelector('.stock-item');
        const targetElement = stockInfoContainer || stockItem || document.querySelector('.form-group');
        
        if (targetElement) {
          console.log(`Found target element on attempt ${i+1}`);
          
          // Get all possible scroll containers again
          scrollContainers.forEach(container => {
            if (container) {
              try {
                // Get the position of the element
                const offsetTop = targetElement.offsetTop;
                
                // Scroll to the element
                container.scrollTo({
                  top: offsetTop - 20,
                  behavior: 'smooth'
                });
                
                // Also try direct assignment
                setTimeout(() => {
                  container.scrollTop = offsetTop - 20;
                }, 50);
                
                console.log(`Scrolled container to element at ${offsetTop}px`);
              } catch (e) {
                console.error('Error scrolling to element:', e);
              }
            }
          });
          
          // Add highlight effect
          targetElement.classList.add('highlight-selection');
          setTimeout(() => {
            targetElement.classList.remove('highlight-selection');
          }, 1000);
        }
      }, i * 300); // Increasing delays: 0ms, 300ms, 600ms, 900ms, 1200ms
    }
    
    // Add additional focus attempts with delay
    setTimeout(() => {
      // Force focus on price value to ensure it's visible
      const priceElement = document.querySelector('.stock-price-value');
      if (priceElement) {
        setTimeout(() => {
          priceElement.focus();
          console.log('Focused on price element');
        }, 300);
      }
    }, 1500);
  };
  
  // Handle image selection
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      updateField('imageFile', file);
      // Create a URL for the preview
      const objectUrl = URL.createObjectURL(file);
      updateField('imagePreview', objectUrl);
      // Clean up the old URL to prevent memory leaks
      return () => URL.revokeObjectURL(objectUrl);
    }
  };

  // Handle image URL input
  const handleImageUrlChange = (e) => {
    updateField('imageUrl', e.target.value);
    updateField('imageFile', null);
    updateField('imagePreview', '');
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
          setShowStrategyInput(false);
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
      
      // If inside a dialog or modal, scroll that to top as well
      const dialogElement = document.querySelector('.dialog-content');
      if (dialogElement) {
        dialogElement.scrollTop = 0;
      }
    }
  };

  // تعديل الدالة لجلب السعر الحالي مباشرة من API
  const fetchCurrentPrice = async (symbol, country) => {
    try {
      // استخدام API مباشرة بدون محاولة الحصول على البيانات من الملفات المحلية
      const apiUrl = generateEodLastCloseUrl(symbol, country);
      console.log(`Fetching price directly from API: ${apiUrl}`);
      
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch price data: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("API Data received:", data);
      
      // تحديث السعر الحالي استنادًا إلى شكل البيانات المستلمة
      let price = null;
      
      if (Array.isArray(data) && data.length > 0 && data[0] && typeof data[0].close === 'number') {
        price = parseFloat(data[0].close);
      } else if (data && (data.close || data.price)) {
        price = parseFloat(data.close || data.price);
      } else if (typeof data === 'number') {
        price = parseFloat(data);
      }
      
      if (price !== null && !isNaN(price)) {
        console.log(`Successfully parsed price from API: $${price}`);
        updateField('currentPrice', price);
        
        // نسبة الهدف 5% فوق سعر السهم الحالي
        const targetPercentage = 5;
        // نسبة إيقاف الخسارة 5% تحت سعر السهم الحالي
        const stopLossPercentage = 5;
        
        // تعيين أسعار الهدف ووقف الخسارة مع النسب المئوية
        const targetValue = (price * (1 + targetPercentage/100)).toFixed(2);
        const stopLossValue = (price * (1 - stopLossPercentage/100)).toFixed(2);
        
        updateField('targetPrice', targetValue);
        updateField('stopLossPrice', stopLossValue);
        // تخزين النسب المئوية لاستخدامها في العرض
        updateField('targetPercentage', targetPercentage);
        updateField('stopLossPercentage', stopLossPercentage);
      } else {
        console.warn(`Invalid API response structure for ${symbol}:`, data);
        throw new Error('Invalid price data structure in API response');
      }
    } catch (error) {
      console.error('Error fetching current price from API:', error);
      updateField('currentPrice', null);
    }
  };

  // Call the new function when the stock or country changes
  useEffect(() => {
    if (selectedStock && selectedStock.symbol && selectedStock.country) {
      fetchCurrentPrice(selectedStock.symbol, selectedStock.country);
    }
  }, [selectedStock]);

  // إضافة دالة للتمرير إلى الأعلى عند فتح ديالوج الاستراتيجية
  const openStrategyDialog = () => {
    // First, make sure the strategies are loaded
    if (strategies.length === 0) {
      setStrategies(DEFAULT_STRATEGIES);
    }
    
    // Show the dialog
    setShowStrategyDialog(true);
    
    // Set the body overflow to hidden to prevent background scrolling
    document.body.style.overflow = 'hidden';
    
    // Small delay to allow the dialog to render
    setTimeout(() => {
      const formButtons = document.querySelector('.form-actions-bottom');
      const dialogElement = document.querySelector('.strategy-dialog');
      
      if (dialogElement && formButtons) {
        // Measure distance to bottom for better positioning
        const viewportHeight = window.innerHeight;
        const formButtonsHeight = formButtons.offsetHeight;
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
    setShowStrategyDialog(false);
    
    // Restore normal scrolling
    document.body.style.overflow = '';
    
    // Reset new strategy state
    setShowStrategyInput(false);
    setNewStrategy('');
    
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
  }, [showStrategyDialog]);

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
  }, [showStrategyDialog]);

  // Function to update global status - declare once here
  const updateGlobalStatus = (message, type = 'processing') => {
    // This would connect to your global status context or state
    console.log(`Status: ${type} - ${message}`);
    // If you have a global status component, update it here
    if (setGlobalStatus) {
      setGlobalStatus({
        visible: !!message,
        type,
        message
      });
    }
  };

  // New improved handleSubmit function with better timeout handling
  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrors({}); // Reset errors

    // Simple validation checks
    if (!selectedStock || !selectedStock.symbol) {
      setErrors({ stock: 'Please select a stock symbol' });
      return;
    }

    try {
      // Start the submission process
      setStatus('uploading');
      setIsSubmitting(true); // Set submitting state
      if (setSubmitState) {
        setSubmitState('submitting');
      }
      updateGlobalStatus('Uploading post content...', 'processing');

      // Prepare post data with all required fields matching Supabase posts table
      const postData = {
        // Required fields
        user_id: user?.id,
        content: contextDescription,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        
        // Optional fields matching posts table columns exactly
        description: contextDescription, // For backwards compatibility
        image_url: undefined, // Will be set after upload if needed
        symbol: selectedStock?.symbol || undefined,
        company_name: selectedStock?.name || undefined,
        country: selectedStock?.country || undefined,
        exchange: selectedStock?.exchange || undefined,
        current_price: currentPrice || undefined,
        initial_price: currentPrice || undefined, // Set initial price once during creation
        target_price: targetPrice ? parseFloat(targetPrice) : undefined,
        stop_loss_price: stopLossPrice ? parseFloat(stopLossPrice) : undefined,
        strategy: selectedStrategy || undefined
      };

      // Process image uploads
      if (imageFile) {
        try {
          updateGlobalStatus('Uploading image...', 'processing');
          const uploadedUrl = await uploadPostImage(imageFile, user?.id);
          if (uploadedUrl) {
            postData.image_url = uploadedUrl;
          }
        } catch (error) {
          console.error('Error uploading image:', error);
          updateGlobalStatus(`Error uploading image: ${error.message}`, 'error');
          setIsSubmitting(false); // Reset submitting state on error
          if (setSubmitState) {
            setSubmitState('error');
          }
          throw error;
        }
      } else if (imageUrl) {
        postData.image_url = imageUrl;
      }

      // Save post directly to Supabase
      updateGlobalStatus('Creating your post...', 'processing');
      console.log('Creating post with data:', postData);
      
      // Check if we have Supabase client initialized
      if (!supabase) {
        setIsSubmitting(false); // Reset submitting state on error
        if (setSubmitState) {
          setSubmitState('error');
        }
        throw new Error('Supabase client not initialized. Check your environment variables.');
      }
      
      // Insert post into 'posts' table
      const { data: post, error } = await supabase
        .from('posts')
        .insert(postData)
        .select()
        .single();
      
      if (error) {
        setIsSubmitting(false); // Reset submitting state on error
        if (setSubmitState) {
          setSubmitState('error');
        }
        throw new Error(`Failed to save post to database: ${error.message}`);
      }
      
      console.log('Post saved successfully:', post);
      
      // Add post to profile store for immediate UI update
      if (post && addPost) {
        console.log('Adding post to profile store for immediate display');
        
        // Ensure the post has all the required fields for display
        const enrichedPost = {
          ...post,
          user: {
            id: user?.id,
            email: user?.email,
            avatar_url: avatarUrl
          },
          created_at_formatted: new Date().toLocaleString()
        };
        
        // Add the post to the store to immediately display it in the profile
        addPost(enrichedPost);
      }
      
      // Reset form after successful submission
      updateField('description', '');
      
      // Reset all form fields
      updateField('imageFile', null);
      updateField('imagePreview', '');
      updateField('imageUrl', '');
      updateField('selectedStock', null);
      updateField('selectedStrategy', '');
      updateField('targetPrice', '');
      updateField('stopLossPrice', '');
      
      setStatus('idle');
      setIsSubmitting(false); // Reset submitting state after success
      if (setSubmitState) {
        setSubmitState('success');
      }
      updateGlobalStatus('Post created successfully! It is now visible on your profile.', 'success');

      // Auto-close status after 3 seconds
      setTimeout(() => {
        updateGlobalStatus(null);
      }, 3000);
      
      // Close form if in dialog
      setTimeout(() => {
        if (closeDialog) {
          closeDialog();
        }
      }, 1500);
    } catch (error) {
      console.error('Error creating post:', error);
      setStatus('error');
      setIsSubmitting(false); // Reset submitting state on error
      if (setSubmitState) {
        setSubmitState('error');
      }
      updateGlobalStatus(`Error creating post: ${error.message}`, 'error');
    }
  };

  // Cancel ongoing post submission
  const cancelPosting = () => {
    if (isSubmitting) {
      updateGlobalStatus('Posting cancelled', 'info');
      setIsSubmitting(false);
      setStatus('idle');
      
      // Also update the context state if available
      if (setSubmitState) {
        setSubmitState('idle');
      }
      
      // Close dialog if in dialog mode
      if (closeDialog) {
        closeDialog();
      }
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

  const handleRemoveImage = () => {
    updateField('imageFile', null);
    updateField('imagePreview', '');
    updateField('imageUrl', '');
    // Clear the file input value
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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

  // Update the country selection rendering to ensure dropdown visibility
  const renderCountrySelect = () => {
    return (
      <div className="category-select" style={{ position: 'relative', zIndex: 3000 }}>
        <div
          className="select-field"
          onClick={() => {
            document.querySelector('.category-dropdown').classList.toggle('show');
          }}
        >
          <span className="select-field-text">
            {selectedCountry === 'all' 
              ? 'All Countries' 
              : COUNTRY_CODE_TO_NAME[selectedCountry] || selectedCountry}
            {selectedCountry !== 'all' && CURRENCY_SYMBOLS[selectedCountry] && 
              <span className="currency-symbol-indicator"> ({CURRENCY_SYMBOLS[selectedCountry]})</span>}
          </span>
          <div className="select-field-icon">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path
                fill="currentColor"
                d="M7 10l5 5 5-5z"
              />
            </svg>
          </div>
        </div>
        
        <div className="category-dropdown" style={{ zIndex: 3000, maxHeight: '400px', overflowY: 'auto' }}>
          <div className="category-option" onClick={() => handleCountryChange('all')}>
            <div className="category-option-content">
              <span className="category-option-name">All Countries</span>
              <span className="category-option-count">
                {countrySymbolCounts.total || ''}
              </span>
            </div>
          </div>
          
          {/* Map through country ISO codes to display all countries with their currency symbols */}
          {Object.entries(COUNTRY_ISO_CODES).map(([countryName, isoCode]) => (
            <div
              key={isoCode}
              className={`category-option ${selectedCountry === isoCode ? 'selected' : ''}`}
              onClick={() => handleCountryChange(isoCode)}
            >
              <div className="category-option-content">
                <span className="category-option-name">
                  <span className={`fi fi-${isoCode.toLowerCase()}`}></span>
                  {countryName}
                  {getCurrencySymbol(isoCode) && 
                    <span className="currency-symbol"> ({getCurrencySymbol(isoCode)})</span>}
                </span>
                <span className="category-option-count">
                  {countrySymbolCounts[isoCode] || '0'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Update the stock search section to display currency symbols with stock search results
  const renderStockSearch = () => (
    <div className="search-field-container">
      <label htmlFor="stockSearch" className="form-label">Symbol or Name</label>
      <div className="search-container">
        <input
          id="stockSearch"
          ref={searchInputRef}
          type="text"
          value={stockSearch}
          onChange={(e) => updateField('stockSearch', e.target.value)}
          placeholder="Enter symbol or name"
          className="form-control visible-input"
        />
        <div className="focus-ring"></div>
        {stockSearch && (
          <button 
            className="clear-search-button" 
            onClick={handleCancelSearch}
            aria-label="Clear search"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        )}
        {isSearching && (
          <div className="search-loader"></div>
        )}
      </div>
      
      {searchResults.length > 0 && (
        <div className="search-results-wrapper">
          <div className="search-results" ref={stockSearchResultsRef}>
            <div className="search-results-header">
              <span className="search-results-count-wrapper">
                <span className="search-results-count">{searchResults.length} symbols found</span>
              </span>
              <button 
                className="btn btn-sm btn-cancel"
                onClick={handleCancelSearch}
                aria-label="Cancel search"
              >
                Cancel
              </button>
            </div>
            <div className="search-results-list">
              {searchResults.map((stock) => {
                // Special handling for loading state
                if (stock.uniqueId === 'loading-symbols') {
                  return (
                    <div 
                      key="loading-symbols"
                      className="category-option message-item loading-item"
                    >
                      <div className="stock-flag loading-pulse">
                        <span 
                          className={`fi fi-${stock.country?.toLowerCase() || 'xx'}`} 
                          title={stock.country}
                        ></span>
                      </div>
                      <div className="category-option-content">
                        <div className="category-option-name loading-pulse">{stock.symbol}</div>
                        <div className="stock-name loading-pulse">
                          <div className="loading-spinner"></div>
                          {stock.name}
                        </div>
                      </div>
                    </div>
                  );
                }
                
                // Special handling for no-data messages or error messages
                const isMessageItem = stock.uniqueId && (
                  stock.uniqueId.includes('error') || 
                  stock.uniqueId.includes('unavailable') || 
                  stock.uniqueId.includes('no-') ||
                  stock.uniqueId.includes('message')
                );

                if (isMessageItem) {
                  return (
                    <div 
                      key={stock.uniqueId}
                      className="category-option message-item"
                      data-uniqueid={stock.uniqueId}
                      data-error={stock.uniqueId.includes('error')}
                    >
                      <div className="stock-flag">
                        <span 
                          className={`fi fi-${stock.country?.toLowerCase() || 'xx'}`} 
                          title={stock.country}
                        ></span>
                      </div>
                      <div className="category-option-content">
                        <div className="category-option-name">{stock.symbol}</div>
                        <div className="stock-name">{stock.name}</div>
                      </div>
                    </div>
                  );
                }
                
                // Regular stock item rendering
                const countryCode = Object.entries(COUNTRY_ISO_CODES).find(
                  ([countryName]) => countryName.toLowerCase() === stock.country.toLowerCase()
                )?.[1]?.toLowerCase() || stock.country.toLowerCase();
                
                // Get currency symbol for this country
                const currencySymbol = CURRENCY_SYMBOLS[countryCode] || '$';
                
                return (
                  <div 
                    key={stock.uniqueId || `${stock.symbol}-${stock.country}`}
                    className={`category-option ${selectedStock && selectedStock.symbol === stock.symbol ? 'selected' : ''}`}
                    onClick={() => handleStockSelect(stock)}
                    tabIndex="0"
                  >
                    <div className="stock-flag">
                      <span 
                        className={`fi fi-${countryCode}`} 
                        title={stock.country}
                      ></span>
                    </div>
                    <div className="category-option-content">
                      <div className="category-option-name">
                        {stock.symbol}
                      </div>
                      <div className="stock-name">{stock.name}</div>
                      <div className="category-option-count">
                        {Object.entries(COUNTRY_ISO_CODES).find(([_, code]) => 
                          code.toLowerCase() === countryCode
                        )?.[0] || stock.country}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Update the Stock Info Container to show currency symbols
  const updateSelectedStockDisplay = () => {
    // When updating selected stock UI in the return JSX:
    if (selectedStock) {
      const countryCode = selectedStock.country.toLowerCase();
      const currencySymbol = CURRENCY_SYMBOLS[countryCode] || '$';
      
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

  return (
    <>
      <div className="create-post-form-container" ref={formWrapperRef}>
        {/* Form content starts here */}
        <div className="form-wrapper">
          {/* Image Preview */}
          {imagePreview && (
            <div className="form-group">
              <div className="file-preview-item">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="file-preview-item img"
                />
                <button
                  className="file-remove"
                  onClick={handleRemoveImage}
                  aria-label="Remove image"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
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
                        {getCurrencySymbol(selectedStock.country) && (
                          <span className="currency-badge">{getCurrencySymbol(selectedStock.country)}</span>
                        )}
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
                    {isSearching ? (
                      <div className="stock-price-loading">
                        Loading...
                      </div>
                    ) : currentPrice !== null && !isNaN(currentPrice) ? (
                      <div className="stock-price stock-price-value">
                        {getCurrencySymbol(selectedStock.country) || '$'} {typeof currentPrice === 'number' ? currentPrice.toFixed(2) : parseFloat(currentPrice).toFixed(2)}
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
                        {CURRENCY_SYMBOLS[selectedStock.country.toLowerCase()] && (
                          <span className="currency-info"> • Currency: {CURRENCY_SYMBOLS[selectedStock.country.toLowerCase()]}</span>
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
                                title={`${day.date}: ${CURRENCY_SYMBOLS[selectedStock.country.toLowerCase()] || '$'}${day.close}`}
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
                            className="form-control"
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
                                  setFormErrors(prev => ({
                                    ...prev,
                                    targetPrice: 'Target price must be greater than current price'
                                  }));
                                  // Show error message
                                  updateGlobalStatus('Target price must be greater than current price', 'error');
                                } else {
                                  // Clear error if valid
                                  setFormErrors(prev => ({
                                    ...prev,
                                    targetPrice: null
                                  }));
                                }
                                
                                // Calculate new percentage
                                const newPercentage = (((parseFloat(e.target.value) / currentPrice) - 1) * 100).toFixed(1);
                                updateField('targetPercentage', parseFloat(newPercentage));
                              }
                            }}
                            placeholder="Target Price"
                          />
                          <div className="price-percentage-edit">
                            <input 
                              type="text" 
                              className="percentage-input target-input" 
                              value={targetPercentage}
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
                                  updateField('targetPercentage', limitedPercentage);
                                  
                                  if (currentPrice && !isNaN(currentPrice)) {
                                    const newTargetPrice = (currentPrice * (1 + limitedPercentage/100)).toFixed(2);
                                    updateField('targetPrice', newTargetPrice);
                                    
                                    // Validate the new target price
                                    if (parseFloat(newTargetPrice) <= currentPrice) {
                                      // Set validation error
                                      setFormErrors(prev => ({
                                        ...prev,
                                        targetPrice: 'Target price must be greater than current price'
                                      }));
                                      // Show error message
                                      updateGlobalStatus('Target price must be greater than current price', 'error');
                                    } else {
                                      // Clear error if valid
                                      setFormErrors(prev => ({
                                        ...prev,
                                        targetPrice: null
                                      }));
                                    }
                                  }
                                } else {
                                  // If input is empty or invalid, just update the field value
                                  updateField('targetPercentage', value === '' ? '' : 0);
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
                        <label htmlFor="stopLossPrice">Stop Loss</label>
                        <div className="price-input-with-percentage">

                          <input
                            type="number"
                            className="form-control"
                            id="stopLossPrice"
                            value={stopLossPrice}
                            onChange={(e) => {
                              const newStopLossPrice = parseFloat(e.target.value);
                              
                              // Always update the field to allow editing
                              updateField('stopLossPrice', e.target.value);
                              
                              // Validate if we have a valid stop loss price and current price
                              if (!isNaN(newStopLossPrice) && !isNaN(currentPrice)) {
                                // Check if stop loss price is bigger than or equal to current price
                                if (newStopLossPrice >= currentPrice) {
                                  // Set validation error
                                  setFormErrors(prev => ({
                                    ...prev,
                                    stopLossPrice: 'Stop loss price must be less than current price'
                                  }));
                                  // Show error message
                                  updateGlobalStatus('Stop loss price must be less than current price', 'error');
                                } else {
                                  // Clear error if valid
                                  setFormErrors(prev => ({
                                    ...prev,
                                    stopLossPrice: null
                                  }));
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
                                    updateField('stopLossPrice', newStopLossPrice);
                                    
                                    // Validate the new stop loss price
                                    if (parseFloat(newStopLossPrice) >= currentPrice) {
                                      // Set validation error
                                      setFormErrors(prev => ({
                                        ...prev,
                                        stopLossPrice: 'Stop loss price must be less than current price'
                                      }));
                                      // Show error message
                                      updateGlobalStatus('Stop loss price must be less than current price', 'error');
                                    } else {
                                      // Clear error if valid
                                      setFormErrors(prev => ({
                                        ...prev,
                                        stopLossPrice: null
                                      }));
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
                  fetchpriority="high"
                  decoding="sync"
                />
              </div>
              <span className="user-email">{user?.email}</span>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="description" className="form-label">What's on your mind?</label>
            <textarea
              id="description"
              value={contextDescription}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="Share your thoughts..."
              className={`form-control ${formErrors.content ? 'is-invalid' : ''}`}
              autoFocus
            ></textarea>
            <div className="focus-ring"></div>
            {formErrors.content && (
              <div className="invalid-feedback">{formErrors.content}</div>
            )}
            {contextDescription && (
              <div className={`char-counter ${contextDescription.length > 500 ? 'warning' : ''} ${contextDescription.length > 1000 ? 'danger' : ''}`}>
                {contextDescription.length} / 1000
              </div>
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
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="Enter image URL"
                  className="form-control"
                />
                <div className="focus-ring"></div>
              </div>
            )}
          </div>
                
          {/* Stock Search Section */}
          <div className="form-group stock-search-container">
            
            <div className="stock-search-wrapper">
              <div className="category-select">
                <label htmlFor="countrySelect" className="form-label">Country</label>
                <div 
                  className={`select-field ${searchResults.length > 0 ? 'open' : ''}`}
                  onClick={() => {
                    setShowStockSearch(!showStockSearch);
                  }}
                >
                  <span>
                    {selectedCountry === 'all' ? (
                      'All Countries'
                    ) : (
                      <>
                        <div className="country-flag-wrapper">
                          <span className={`fi fi-${selectedCountry} country-flag`}></span>
                        </div>
                        {Object.entries(COUNTRY_ISO_CODES).find(([_, code]) => 
                          code.toLowerCase() === selectedCountry
                        )?.[0] || selectedCountry}
                      </>
                    )}
                  </span>
                  <span className="select-field-icon">▼</span>
                </div>
                
                {showStockSearch && (
                  <div className="category-dropdown show category-dropdown-z">
                    <div className="search-results-header country-dropdown-header">
                      <span className="search-results-count">Select a country</span>
                      <button 
                        className="btn btn-sm btn-cancel"
                        onClick={() => setShowStockSearch(false)}
                        aria-label="Cancel country selection"
                      >
                        Cancel
                      </button>
                    </div>
                    <div 
                      className={`category-option ${selectedCountry === 'all' ? 'selected' : ''}`}
                      onClick={() => {
                        handleCountryChange('all');
                        setShowStockSearch(false);
                      }}
                    >
                      <div className="category-option-content">
                        <div className="category-option-name">All Countries</div>
                        <div className="category-option-count">{countrySymbolCounts['all'] || 0} symbols</div>
                      </div>
                    </div>
                    
                    {Object.entries(COUNTRY_ISO_CODES)
                      .filter(([_, code]) => {
                        const countCode = code.toLowerCase();
                        const count = countrySymbolCounts[countCode] || 0;
                        return count > 0; // Only show countries with at least one stock
                      })
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([country, code]) => {
                        const countCode = code.toLowerCase();
                        const count = countrySymbolCounts[countCode] || 0;
                        
                        return (
                          <div 
                            key={`country-${countCode}`}
                            className={`category-option ${selectedCountry === countCode ? 'selected' : ''}`}
                            onClick={() => {
                              handleCountryChange(countCode);
                              setShowStockSearch(false);
                            }}
                          >
                            <div className="country-flag-wrapper">
                              <span className={`fi fi-${countCode} country-flag`}></span>
                            </div>
                            <div className="category-option-content">
                              <div className="category-option-name">{country}</div>
                              <div className="category-option-count">{count} symbols</div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
              
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
                    onChange={(e) => setNewStrategy(e.target.value)}
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
          {!isSubmitting ? (
            <button
              onClick={handleSubmit}
              disabled={!selectedStock || !selectedStock.symbol || 
                formErrors.targetPrice || formErrors.stopLossPrice || 
                (currentPrice && targetPrice && parseFloat(targetPrice) <= parseFloat(currentPrice)) || 
                (currentPrice && stopLossPrice && parseFloat(stopLossPrice) >= parseFloat(currentPrice))}
              className="btn btn-primary"
              title={
                formErrors.targetPrice || formErrors.stopLossPrice ? 'Please fix validation errors before posting' : 
                (currentPrice && targetPrice && parseFloat(targetPrice) <= parseFloat(currentPrice)) ? 'Target price must be greater than current price' : 
                (currentPrice && stopLossPrice && parseFloat(stopLossPrice) >= parseFloat(currentPrice)) ? 'Stop loss price must be less than current price' : 
                ''}
            >
              Post
            </button>
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
          <button 
            className="btn btn-secondary" 
            onClick={(e) => {
              // If posting is in progress, confirm cancellation
              if (isSubmitting) {
                if (window.confirm('Posting in progress. Are you sure you want to cancel?')) {
                  cancelPosting();
                }
                return;
              }
              // Otherwise just close the dialog
              closeDialog();
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}

// Add a named export to support both default and named imports
export { CreatePostForm };