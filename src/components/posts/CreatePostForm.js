'use client';

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/contexts/ProfileContext';
import { generateEodLastCloseUrl, countries, BASE_URL, API_KEY } from '@/utils/stockApi';
import { getCountrySymbolCounts, searchStocks, COUNTRY_ISO_CODES } from '@/utils/symbolSearch';
import { formatSymbolForApi, getExchangeCodeFromData, getSymbolPriceFromLocalData, getEodApiUrlParams } from '@/utils/symbolUtils';
import { uploadPostImage } from '@/utils/supabase';
import { useCreatePostForm } from '@/contexts/CreatePostFormContext';
import useProfileStore from '@/store/profileStore'; // Import profile store
import { createClient } from '@supabase/supabase-js';
import 'flag-icons/css/flag-icons.min.css';
import '@/styles/create-post-page.css';
import '@/styles/animation.css';

// Create reusable Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// Near the top of the file
const COUNTRY_CODE_TO_NAME = {
  'eg': 'Egypt',
  'us': 'USA',
  'gb': 'UK',
  'ca': 'Canada',
  'de': 'Germany',
  'lu': 'Luxembourg',
  'at': 'Austria',
  'fr': 'France',
  'be': 'Belgium',
  'es': 'Spain',
  'ch': 'Switzerland',
  'pt': 'Portugal',
  'nl': 'Netherlands',
  'is': 'Iceland',
  'ie': 'Ireland',
  'fi': 'Finland',
  'no': 'Norway',
  'dk': 'Denmark',
  'se': 'Sweden',
  'zw': 'Zimbabwe',
  'zm': 'Zambia',
  'ug': 'Uganda',
  'tz': 'Tanzania',
  'cz': 'Czech Republic',
  'rw': 'Rwanda',
  'bw': 'Botswana',
  'ng': 'Nigeria',
  'gh': 'Ghana',
  'mw': 'Malawi',
  'ci': 'Ivory Coast',
  'ke': 'Kenya',
  'ma': 'Morocco',
  'mu': 'Mauritius',
  'kr': 'Korea',
  'hu': 'Hungary',
  'pl': 'Poland',
  'ph': 'Philippines',
  'id': 'Indonesia',
  'au': 'Australia',
  'cn': 'China',
  'in': 'India',
  'za': 'South Africa',
  'pk': 'Pakistan',
  'my': 'Malaysia',
  'vn': 'Vietnam',
  'lk': 'Sri Lanka',
  'th': 'Thailand',
  'cl': 'Chile',
  'gr': 'Greece',
  'ar': 'Argentina',
  'br': 'Brazil',
  'ro': 'Romania',
  'tr': 'Turkey',
  'pe': 'Peru',
  'tw': 'Taiwan',
  'hr': 'Croatia',
  'mx': 'Mexico',
  'ae': 'United Arab Emirates',
  'hk': 'Hong Kong',
  'it': 'Italy',
  'jp': 'Japan',
  'jo': 'Jordan',
  'kw': 'Kuwait',
  'lb': 'Lebanon',
  'nz': 'New Zealand',
  'om': 'Oman',
  'qa': 'Qatar',
  'ru': 'Russia',
  'sa': 'Saudi Arabia',
  'sg': 'Singapore'
};

// إضافة قاموس لرموز العملات للبلدان المختلفة
const COUNTRY_CURRENCY_SYMBOLS = {
  // العملات الأساسية
  'eg': 'EGP',  // مصر
  'us': '$',    // الولايات المتحدة
  'gb': '£',    // المملكة المتحدة
  'ca': 'CA$',  // كندا
  'au': 'A$',   // أستراليا
  'de': '€ ',    // ألمانيا
  'fr': '€ ',    // فرنسا
  'es': '€ ',    // إسبانيا
  'it': '€ ',    // إيطاليا
  'jp': '¥ ',    // اليابان
  'cn': '¥ ',    // الصين
  'hk': 'HK$ ',  // هونج كونج
  'in': '₹ ',    // الهند
  'sa': 'SAR ',  // السعودية
  'ae': 'AED ',  // الإمارات
  'za': 'R ',    // جنوب أفريقيا
  'br': 'R$ ',   // البرازيل
  'ru': '₽ ',    // روسيا
  'ch': 'CHF ',  // سويسرا
  'kr': '₩ ',    // كوريا الجنوبية
  'sg': 'S$ ',   // سنغافورة
  'nl': '€ ',    // هولندا
  'be': '€',    // بلجيكا
  'gr': '€',    // اليونان
  'pt': '€',    // البرتغال
  'ie': '€',    // أيرلندا
  'at': '€',    // النمسا
  'fi': '€',    // فنلندا
  'no': 'kr',   // النرويج
  'se': 'kr',   // السويد
  'dk': 'kr',   // الدنمارك
  'pl': 'zł',   // بولندا
  'hu': 'Ft',   // المجر
  'cz': 'Kč',   // جمهورية التشيك
  'tr': '₺',    // تركيا
  'mx': 'MX$',  // المكسيك
  'nz': 'NZ$',  // نيوزيلندا
  'th': '฿',    // تايلاند
  'my': 'RM',   // ماليزيا
  'id': 'Rp',   // إندونيسيا
  'ph': '₱',    // الفلبين
  'vn': '₫',    // فيتنام
  'ar': '$',    // الأرجنتين
  'cl': 'CLP',  // تشيلي
  'co': 'COP',  // كولومبيا
  'pe': 'S/',   // بيرو
  'lu': '€',    // لوكسمبورغ
  
  // عملات إفريقية
  'ng': '₦',    // نيجيريا
  'ke': 'KES',  // كينيا
  'ma': 'MAD',  // المغرب
  'gh': 'GHS',  // غانا
  'mu': 'MUR',  // موريشيوس
  'tz': 'TZS',  // تنزانيا
  'bw': 'P',    // بوتسوانا
  'zw': 'Z$',   // زيمبابوي
  'zm': 'ZMW',  // زامبيا
  'ug': 'UGX',  // أوغندا
  'rw': 'RWF',  // رواندا
  'mw': 'MWK',  // ملاوي
  'ci': 'CFA',  // ساحل العاج
  
  // الشرق الأوسط والخليج
  'jo': 'JOD',  // الأردن
  'kw': 'KWD',  // الكويت
  'qa': 'QAR',  // قطر
  'bh': 'BHD',  // البحرين
  'om': 'OMR',  // عمان
  'lb': 'L£',   // لبنان
  
  // آسيا
  'tw': 'NT$',  // تايوان
  'pk': '₨',    // باكستان
  'lk': 'LKR',  // سريلانكا
  'bd': '৳',    // بنغلاديش
  
  // أوروبا الشرقية
  'ro': 'RON',  // رومانيا
  'bg': 'BGN',  // بلغاريا
  'hr': 'HRK',  // كرواتيا
  'rs': 'RSD',  // صربيا
  'ua': '₴',    // أوكرانيا
  'ee': '€',    // إستونيا
  'lt': '€',    // ليتوانيا
  'lv': '€',    // لاتفيا
  'si': '€',    // سلوفينيا
  'sk': '€',    // سلوفاكيا
  'mt': '€',    // مالطا
  'cy': '€',    // قبرص
  'is': 'kr',   // أيسلندا
  
  // أمريكا اللاتينية
  'pa': 'B/.',  // بنما
  'uy': '$U',   // أوروغواي
  'cr': '₡',    // كوستاريكا
  'jm': 'J$',   // جامايكا
  
  // دول أخرى
  'az': '₼',    // أذربيجان
  'by': 'Br',   // بيلاروسيا
  'kz': '₸',    // كازاخستان
};

// دالة مساعدة للحصول على رمز العملة المناسب
const getCurrencySymbol = (country) => {
  if (!country) return '$'; // افتراضي

  // التحقق أولاً مما إذا كان رمز البلد ثنائي الحروف
  if (country.length === 2) {
    return COUNTRY_CURRENCY_SYMBOLS[country.toLowerCase()] || '$';
  }
  
  // البحث عن رمز البلد من الاسم
  const countryCode = Object.entries(COUNTRY_ISO_CODES).find(
    ([countryName]) => countryName.toLowerCase() === country.toLowerCase()
  )?.[1]?.toLowerCase();
  
  return countryCode ? (COUNTRY_CURRENCY_SYMBOLS[countryCode] || '$') : '$';
};

export default function CreatePostForm() {
  const { user } = useAuth();
  const { profile, getEffectiveAvatarUrl } = useProfile();
  
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

  // Get the addPost function from profile store
  const addPost = useProfileStore(state => state.addPost);

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
  const [formErrors, setFormErrors] = useState({});
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
        // Get counts directly from the getCountrySymbolCounts function
        const counts = getCountrySymbolCounts();
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
          // Save to user_strategies table
          const { data, error } = await supabase
            .from('user_strategies')
            .insert({
              user_id: user.id,
              name: strategyName,
              created_at: new Date().toISOString()
            })
            .select()
            .single();
            
          if (error) {
            console.error('Error saving strategy to database:', error);
            // Already added locally, so continue silently
          } else {
            console.log('Strategy saved to database:', data);
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
        // Clear search results to indicate error to user
        updateField('searchResults', []);
      } finally {
        setIsSearching(false);
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
    setSelectedCountry(value === 'all' ? 'all' : value);
    
    // Update API URL if a stock is selected
    if (stockSearch) {
      setApiUrl(generateEodLastCloseUrl(stockSearch, value === 'all' ? '' : value));
    }
    
    // When a country is selected, load all symbols for that country
    if (value !== 'all') {
      setIsSearching(true);
      
      // Convert ISO country code to country name if needed
      let searchCountry = value;
      if (searchCountry && COUNTRY_CODE_TO_NAME[searchCountry]) {
        searchCountry = COUNTRY_CODE_TO_NAME[searchCountry];
        console.log(`Loading all symbols for country: ${searchCountry}`);
      }
      
      // Use our local symbol search with empty query to get all symbols
      // We pass an empty string to get all symbols, and limit to 250 to show a good amount
      searchStocks('', searchCountry, 250)
        .then(results => {
          if (results && results.length > 0) {
            console.log(`Loaded ${results.length} symbols for ${searchCountry}`);
            
            // Format the results to match the expected structure
            const formattedResults = results.map(item => ({
              symbol: item.Symbol,
              name: item.Name,
              country: item.Country,
              exchange: item.Exchange,
              uniqueId: item.uniqueId
            }));
            
            updateField('searchResults', formattedResults);
          } else {
            // If no results are returned from the search, attempt to directly import the symbols file
            console.log(`No symbols returned from search for ${searchCountry}, attempting direct file import`);

            // Create a placeholder loading result
            updateField('searchResults', [{
              symbol: `Loading symbols for ${searchCountry}...`,
              name: "Please wait while we load the symbols",
              country: searchCountry,
              exchange: "",
              uniqueId: "loading-message"
            }]);
          }
        })
        .catch(error => {
          console.error('Error loading symbols:', error);
          // Handle error
        });
    } else {
      // If 'All Countries' is selected, clear results until user types search
      updateField('searchResults', []);
    }
  };

  // Update API URL when stock search changes
  useEffect(() => {
    if (stockSearch) {
      setApiUrl(generateEodLastCloseUrl(stockSearch, selectedCountry === 'all' ? '' : selectedCountry));
    }
  }, [stockSearch, selectedCountry]);

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
      
      // First, let's properly format the symbol for consistent API use
      const formattedSymbol = formatSymbolForApi(stock.symbol, stock.country);
      console.log(`Formatted symbol for API: ${formattedSymbol}`);
      
      // Get the full country name if needed
      let countryName = stock.country;
      if (countryName.length === 2 && COUNTRY_CODE_TO_NAME[countryName.toLowerCase()]) {
        countryName = COUNTRY_CODE_TO_NAME[countryName.toLowerCase()];
      }
      
      // Try to get price data from local symbol file first
      try {
        console.log(`Trying to get price data for ${stock.symbol} from local ${countryName} file`);
        const localPriceData = await getSymbolPriceFromLocalData(stock.symbol, countryName);
        
        if (localPriceData && localPriceData.price) {
          console.log(`Found local price data: ${JSON.stringify(localPriceData)}`);
          const price = localPriceData.price;
          updateField('currentPrice', price);
          
          // Set default target prices based on the fetched price
          updateField('targetPrice', (price * 1.05).toFixed(2));
          updateField('stopLossPrice', (price * 0.95).toFixed(2));
          
          setApiResponse({
            source: 'local',
            data: localPriceData,
            processed: priceHistoryData
          });
          
          // Store the properly formatted API URL for display - using our consistent formatted symbol
          const apiUrlForDisplay = generateEodLastCloseUrl(stock.symbol, countryName);
          setApiUrl(apiUrlForDisplay);
          setFormattedApiUrl(apiUrlForDisplay);
          
          console.log(`Successfully loaded local price for ${stock.symbol}: $${price}`);
          
          // Wait a short time to ensure state updates before scrolling
          setTimeout(() => {
            scrollToStockInfo();
          }, 100);
          
          // Skip API call since we have local data
          setIsSearching(false);
          return;
        }
      } catch (localError) {
        console.error(`Error getting local price data: ${localError}`);
        // Continue to API fallback if local data fails
      }
      
      // Fallback to API if local files don't have the data
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
      
      // Scroll to the stock info container after a short delay to ensure it's rendered
      setTimeout(() => {
        scrollToStockInfo();
      }, 300); // 300ms delay to ensure the component is fully rendered

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

  // Helper function to scroll to stock info
  const scrollToStockInfo = () => {
    const stockInfoElement = document.querySelector('.stock-info-container');
    if (stockInfoElement) {
      // First scroll the form to the top
      if (formWrapperRef.current) {
        formWrapperRef.current.scrollTop = 0;
      }
      
      // Then scroll the stock info element into view
      stockInfoElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      
      // Add highlight effect
      stockInfoElement.classList.add('highlight-selection');
      setTimeout(() => {
        stockInfoElement.classList.remove('highlight-selection');
      }, 1000);
      
      // Force focus on price value to ensure it's visible
      const priceElement = document.querySelector('.stock-price-value');
      if (priceElement) {
        priceElement.focus();
      }
      
      // Force focus on API response when available
      if (apiResponse) {
        // Try to focus on response URL if available
        const responseUrlElement = document.querySelector('.response-url');
        if (responseUrlElement) {
          setTimeout(() => {
            responseUrlElement.focus();
          }, 300);
        }
        
        // Highlight the API response section
        const apiResponseElement = document.querySelector('.stock-price-api-response');
        if (apiResponseElement) {
          apiResponseElement.classList.add('highlight-selection');
          setTimeout(() => {
            apiResponseElement.classList.remove('highlight-selection');
          }, 1500);
        }
      } else {
        // If no API response, focus on API URL element
        const apiUrlElement = document.querySelector('.api-url-code');
        if (apiUrlElement) {
          apiUrlElement.focus();
        }
      }
    }
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

  /**
   * Upload and process images for post
   */
  const uploadPostImages = async (images) => {
    if (!images || images.length === 0) return null;
    
    console.log(`Processing ${images.length} images for post`);
    try {
      const imageUrls = await Promise.all(
        images.map(async (img) => {
          // Skip upload for already uploaded images (URLs)
          if (typeof img === 'string' && img.startsWith('http')) {
            return img;
          }
          return await uploadPostImage(img, user?.id);
        })
      );
      
      console.log(`Successfully processed ${imageUrls.length} images`);
      return imageUrls[0]; // Return the first image URL
    } catch (error) {
      console.error(`Error uploading images: ${error.message}`);
      throw error;
    }
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
    if (!contextDescription && !imageFile) {
      setErrors({ description: 'Please add a description or upload an image' });
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
                  className="stock-info-bg-flag"
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
                      <div className="stock-symbol">{selectedStock.symbol}</div>
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
                        {getCurrencySymbol(selectedStock?.country)} {typeof currentPrice === 'number' ? currentPrice.toFixed(2) : parseFloat(currentPrice).toFixed(2)}
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
                                title={`${day.date}: $${day.close}`}
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
                          <div className="currency-symbol-prefix">
                            {getCurrencySymbol(selectedStock?.country)}
                          </div>
                          <input
                            type="number"
                            className="form-control with-currency-symbol"
                            id="targetPrice"
                            value={targetPrice}
                            onChange={(e) => {
                              updateField('targetPrice', e.target.value);
                              // Calculate new percentage
                              if (currentPrice && !isNaN(currentPrice) && !isNaN(e.target.value)) {
                                const newPercentage = (((parseFloat(e.target.value) / currentPrice) - 1) * 100).toFixed(1);
                                updateField('targetPercentage', parseFloat(newPercentage));
                              }
                            }}
                            placeholder="Target Price"
                          />
                          <div className="price-percentage-edit">
                            <input 
                              type="number" 
                              className="percentage-input target-input" 
                              value={targetPercentage}
                              onChange={(e) => {
                                const newPercentage = parseFloat(e.target.value);
                                updateField('targetPercentage', newPercentage);
                                // تحديث سعر الهدف بناءً على النسبة الجديدة
                                if (currentPrice && !isNaN(currentPrice) && !isNaN(newPercentage)) {
                                  const newTargetPrice = (currentPrice * (1 + newPercentage/100)).toFixed(2);
                                  updateField('targetPrice', newTargetPrice);
                                }
                              }}
                              step="0.1"
                              aria-label="Target percentage"
                            />
                            <span className="percentage-symbol">%</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="form-group col-md-6 stop-loss-price-group">
                        <label htmlFor="stopLossPrice">Stop Loss</label>
                        <div className="price-input-with-percentage">
                          <div className="currency-symbol-prefix">
                            {getCurrencySymbol(selectedStock?.country)}
                          </div>
                          <input
                            type="number"
                            className="form-control with-currency-symbol"
                            id="stopLossPrice"
                            value={stopLossPrice}
                            onChange={(e) => {
                              updateField('stopLossPrice', e.target.value);
                              // Calculate new percentage
                              if (currentPrice && !isNaN(currentPrice) && !isNaN(e.target.value)) {
                                const newPercentage = ((1 - (parseFloat(e.target.value) / currentPrice)) * 100).toFixed(1);
                                updateField('stopLossPercentage', parseFloat(newPercentage));
                              }
                            }}
                            placeholder="Stop Loss Price"
                          />
                          <div className="price-percentage-edit">
                            <input 
                              type="number" 
                              className="percentage-input stop-loss-input" 
                              value={stopLossPercentage}
                              onChange={(e) => {
                                const newPercentage = parseFloat(e.target.value);
                                updateField('stopLossPercentage', newPercentage);
                                // تحديث سعر إيقاف الخسارة بناءً على النسبة الجديدة
                                if (currentPrice && !isNaN(currentPrice) && !isNaN(newPercentage)) {
                                  const newStopLossPrice = (currentPrice * (1 - newPercentage/100)).toFixed(2);
                                  updateField('stopLossPrice', newStopLossPrice);
                                }
                              }}
                              step="0.1"
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
                <img src={avatarUrl} alt="User avatar" />
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
            <label className="form-label">Search for a stock</label>
            
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
                          // Special handling for no-data messages
                          if (stock.uniqueId === "no-symbols-message" || stock.uniqueId === "error-message") {
                            return (
                              <div 
                                key={stock.uniqueId}
                                className="category-option message-item"
                              >
                                <div className="stock-flag">
                                  <span 
                                    className={`fi fi-${stock.country.toLowerCase()}`} 
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
                                <div className="category-option-name">{stock.symbol}</div>
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
              disabled={!contextDescription.trim()}
              className="btn btn-primary"
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
