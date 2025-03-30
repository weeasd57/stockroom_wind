'use client';

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/contexts/ProfileContext';
import { generateEodLastCloseUrl, countries, BASE_URL, API_KEY } from '@/utils/stockApi';
import { getCountrySymbolCounts, searchStocks, COUNTRY_ISO_CODES } from '@/utils/symbolSearch';
import { formatSymbolForApi, getExchangeCodeFromData, getSymbolPriceFromLocalData, getEodApiUrlParams } from '@/utils/symbolUtils';
import { createPost as supabaseCreatePost, uploadPostImage, createUserStrategy, getUserStrategies } from '@/utils/supabase';
import 'flag-icons/css/flag-icons.min.css';
import '@/styles/create-post-page.css';
import '@/styles/animation.css';

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
  'il': '₪',    // إسرائيل
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

export default function CreatePostForm({ onPostCreated, onCancel, onSubmittingChange }) {
  const { user } = useAuth();
  const { profile, getEffectiveAvatarUrl } = useProfile();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionProgress, setSubmissionProgress] = useState('');
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [stockSearch, setStockSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedStock, setSelectedStock] = useState(null);
  const [currentPrice, setCurrentPrice] = useState(null);
  const [targetPrice, setTargetPrice] = useState('');
  const [stopLossPrice, setStopLossPrice] = useState('');
  const [strategies, setStrategies] = useState([]);
  const [selectedStrategy, setSelectedStrategy] = useState('');
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
  const fileInputRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const searchInputRef = useRef(null);
  const stockSearchResultsRef = useRef(null);
  const strategySelectRef = useRef(null);
  const formWrapperRef = useRef(null);
  const [targetPercentage, setTargetPercentage] = useState(5);
  const [stopLossPercentage, setStopLossPercentage] = useState(5);
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

  // Notify parent component about submission state changes
  useEffect(() => {
    if (onSubmittingChange) {
      onSubmittingChange(isSubmitting);
    }
  }, [isSubmitting, onSubmittingChange]);

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
    // تعيين الاستراتيجيات الافتراضية على الفور عند تحميل المكون
    setStrategies(DEFAULT_STRATEGIES);
    
    // إذا كان المستخدم مسجل الدخول، حاول أيضًا جلب الاستراتيجيات المخصصة له
    if (user) {
      fetchUserStrategies();
    }
  }, [user]);

  // Fetch user strategies
  const fetchUserStrategies = async () => {
    try {
      // دائمًا ابدأ بالاستراتيجيات الافتراضية
      let allStrategies = [...DEFAULT_STRATEGIES];
      
      if (user && user.id) {
        // حاول الحصول على استراتيجيات المستخدم من قاعدة البيانات
        const userStrategies = await getUserStrategies(user.id);
        
        if (userStrategies && userStrategies.length > 0) {
          // استخراج أسماء الاستراتيجيات من النتيجة
          const strategyNames = userStrategies.map(s => s.strategy_name);
          
          // إضافة استراتيجيات المستخدم الفريدة (غير المكررة) إلى القائمة
          strategyNames.forEach(name => {
            if (!allStrategies.includes(name)) {
              allStrategies.push(name);
            }
          });
        }
      }
      
      // تحديث قائمة الاستراتيجيات المتاحة
      setStrategies(allStrategies);
      console.log('Strategies loaded:', allStrategies);
      
    } catch (error) {
      console.error('Error fetching strategies:', error);
      // في حالة حدوث خطأ، استخدم الاستراتيجيات الافتراضية
      setStrategies(DEFAULT_STRATEGIES);
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
        setSearchResults(filteredResults);
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
        setSearchResults([]);
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
        
        setSearchResults(formattedResults);
      } catch (error) {
        console.error('Error searching stocks:', error);
        // Clear search results to indicate error to user
        setSearchResults([]);
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
  }, [stockSearch, selectedCountry, searchResults]);

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
            
            setSearchResults(formattedResults);
          } else {
            // If no results are returned from the search, attempt to directly import the symbols file
            console.log(`No symbols returned from search for ${searchCountry}, attempting direct file import`);

            // Create a placeholder loading result
            setSearchResults([{
              symbol: `Loading symbols for ${searchCountry}...`,
              name: "Please wait while we load the symbols",
              country: searchCountry,
              exchange: "",
              uniqueId: "loading-message"
            }]);
            
            // For Egyptian stocks specifically (since that seems to be a focus)
            if (searchCountry.toLowerCase() === 'egypt') {
              // Create some default Egyptian stocks if all else fails
              const egyptStocks = [
                { Symbol: "ABUK", Name: "Abou Kir Fertilizers", Country: "Egypt", Exchange: "EGX" },
                { Symbol: "COMI", Name: "Commercial International Bank", Country: "Egypt", Exchange: "EGX" },
                { Symbol: "EFIC", Name: "Egyptian Financial & Industrial", Country: "Egypt", Exchange: "EGX" },
                { Symbol: "EAST", Name: "Eastern Company", Country: "Egypt", Exchange: "EGX" },
                { Symbol: "HRHO", Name: "EFG Hermes Holding", Country: "Egypt", Exchange: "EGX" }
              ];
              
              const formattedResults = egyptStocks.map(item => ({
                symbol: item.Symbol,
                name: item.Name,
                country: item.Country,
                exchange: item.Exchange,
                uniqueId: `${item.Symbol}-${item.Country}`
              }));
              
              setSearchResults(formattedResults);
              console.log(`Loaded ${formattedResults.length} default symbols for Egypt`);
            } else {
              // Try to dynamically import the country symbols
              try {
                // Check if searchCountry is a country code, and if so, convert it to a full country name
                let countryName = searchCountry;
                if (searchCountry.length === 2 && COUNTRY_CODE_TO_NAME[searchCountry.toLowerCase()]) {
                  countryName = COUNTRY_CODE_TO_NAME[searchCountry.toLowerCase()];
                  console.log(`Converted country code ${searchCountry} to country name ${countryName}`);
                }
                
                // Format the country name to match file naming
                const formattedCountry = countryName.replace(/\s/g, '_');
                const fileName = `${formattedCountry}_all_symbols_20250304_171206.json`;
                console.log(`Attempting to import file: ${fileName}`);
                
                import(`@/symbols_data/${fileName}`)
                  .then(module => {
                    const symbols = module.default || [];
                    if (symbols.length > 0) {
                      const formattedResults = symbols.slice(0, 250).map(item => ({
                        symbol: item.Symbol || item.symbol,
                        name: item.Name || item.name,
                        country: item.Country || item.country || searchCountry,
                        exchange: item.Exchange || item.exchange || "",
                        uniqueId: `${item.Symbol || item.symbol}-${searchCountry}`
                      }));
                      
                      setSearchResults(formattedResults);
                      console.log(`Directly loaded ${formattedResults.length} symbols for ${searchCountry}`);
                    } else {
                      console.error(`Failed to load symbols for ${searchCountry}`);
                      // Show a message in the search results
                      setSearchResults([{
                        symbol: "Select another country",
                        name: `No symbols could be loaded for ${searchCountry}`,
                        country: searchCountry,
                        exchange: "",
                        uniqueId: "no-symbols-message"
                      }]);
                    }
                  })
                  .catch(err => {
                    console.error(`Error loading symbols file for ${searchCountry}:`, err);
                    // Show at least some results rather than nothing
                    setSearchResults([{
                      symbol: "Try another country",
                      name: `File not found for ${searchCountry}`,
                      country: searchCountry,
                      exchange: "",
                      uniqueId: "error-message"
                    }]);
                  });
              } catch (error) {
                console.error(`Error importing symbols for ${searchCountry}:`, error);
              }
            }
          }
          setIsSearching(false);
        })
        .catch(error => {
          console.error('Error loading symbols after country change:', error);
          // Don't clear search results on error, show a helpful message
          setSearchResults([{
            symbol: "Search for a stock",
            name: `Error loading symbols for ${searchCountry}, please try searching by name`,
            country: searchCountry,
            exchange: "",
            uniqueId: "error-message"
          }]);
          setIsSearching(false);
        })
        .finally(() => {
          // Ensure loading state is cleared regardless of success or error
          setIsSearching(false);
        });
    } else {
      // If 'All Countries' is selected, clear results until user types search
      setSearchResults([]);
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
      setSelectedStock(stock);
      // Clear stock search to close dropdown
      setStockSearch('');
      setSearchResults([]);
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
          setCurrentPrice(price);
          
          // Set default target prices based on the fetched price
          setTargetPrice((price * 1.05).toFixed(2));
          setStopLossPrice((price * 0.95).toFixed(2));
          
         
          
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
        setCurrentPrice(null);
        setTargetPrice('');
        setStopLossPrice('');
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
            
            setCurrentPrice(price);
            
            // Set default target prices based on the fetched price
            setTargetPrice((price * 1.05).toFixed(2));
            setStopLossPrice((price * 0.95).toFixed(2));
            
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
          setCurrentPrice(null);
          setTargetPrice('');
          setStopLossPrice('');
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
              setCurrentPrice(directPrice);
              setTargetPrice((directPrice * 1.05).toFixed(2));
              setStopLossPrice((directPrice * 0.95).toFixed(2));
              
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
      setCurrentPrice(null);
      setTargetPrice('');
      setStopLossPrice('');
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
      setImageFile(file);
      // Create a URL for the preview
      const objectUrl = URL.createObjectURL(file);
      setImagePreview(objectUrl);
      // Clean up the old URL to prevent memory leaks
      return () => URL.revokeObjectURL(objectUrl);
    }
  };

  // Handle image URL input
  const handleImageUrlChange = (e) => {
    setImageUrl(e.target.value);
    setImageFile(null);
    setImagePreview('');
  };

  // Handle adding a new strategy
  const handleAddStrategy = async () => {
    if (!newStrategy.trim()) return;
    
    try {
      // التحقق مما إذا كانت الاستراتيجية موجودة بالفعل
      if (strategies.includes(newStrategy.trim())) {
        // إذا كانت الاستراتيجية موجودة بالفعل، حدد فقط
        setSelectedStrategy(newStrategy.trim());
        setNewStrategy('');
        setShowStrategyInput(false);
        return;
      }
      
      // إضافة الاستراتيجية إلى القائمة المحلية أولاً للتحديث الفوري
      const updatedStrategies = [...strategies, newStrategy.trim()];
      setStrategies(updatedStrategies);
      setSelectedStrategy(newStrategy.trim());
      setNewStrategy('');
      setShowStrategyInput(false);
      
      // حفظ الاستراتيجية في Supabase إذا كان المستخدم مسجل الدخول
      if (user && user.id) {
        await createUserStrategy(user.id, newStrategy.trim());
        console.log('Strategy added to database:', newStrategy.trim());
      }
      
    } catch (error) {
      console.error('Error adding strategy:', error);
      // حتى في حالة فشل الإضافة إلى قاعدة البيانات، اترك الاستراتيجية في القائمة المحلية
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // التحقق من أن نافذة الاستراتيجية مغلقة قبل المتابعة
    if (showStrategyDialog) {
      closeStrategyDialog();
    }
    
    if (!description.trim()) {
      // toast.error('Please enter a description');
      return;
    }
    
    setIsSubmitting(true);
    setSubmissionProgress('Preparing your post...');
    
    try {
      let uploadedImageUrl = imageUrl;
      
      // Upload image if file is selected
      if (imageFile) {
        setSubmissionProgress('Uploading image...');
        uploadedImageUrl = await uploadPostImage(imageFile, user.id);
      }
      
      // Create post data object
      const postData = {
        user_id: user.id,
        content: description.trim(),
        image_url: uploadedImageUrl || null,
        strategy: selectedStrategy || null,
      };
      
      // Add stock data if selected
      if (selectedStock) {
        postData.symbol = selectedStock.symbol;
        postData.company_name = selectedStock.name;
        postData.country = selectedStock.country;
        postData.current_price = currentPrice;
        postData.target_price = targetPrice ? parseFloat(targetPrice) : null;
        postData.stop_loss_price = stopLossPrice ? parseFloat(stopLossPrice) : null;
      }
      
      // Create post in database
      setSubmissionProgress('Creating your post...');
      const { data: newPost, error } = await supabaseCreatePost(postData);
      
      if (error) {
        throw error;
      }
      
      setSubmissionProgress('Post created! Finishing up...');
      
      // Only reset the form after successful submission
      // Don't clear the form while posting to allow user to stay in context
      if (newPost) {
        // Reset form
        setDescription('');
        setImageFile(null);
        setImagePreview('');
        setImageUrl('');
        setSelectedStock(null);
        setStockSearch('');
        setCurrentPrice(null);
        setTargetPrice('');
        setStopLossPrice('');
        setSelectedStrategy('');
        
        // Notify parent component
        if (onPostCreated) {
          onPostCreated(newPost);
        }
      }
      
      // toast.success('Post created successfully');
    } catch (error) {
      console.error('Error creating post:', error);
      // toast.error('Failed to create post');
    } finally {
      setTimeout(() => {
        setSubmissionProgress('');
        setIsSubmitting(false);
      }, 1000); // Keep the status visible briefly after completion
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
      setSearchResults([]);
      setStockSearch('');
      searchInputRef.current?.focus();
    }
  }, [showStockSearch, searchResults.length]);

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

  // Format currency helper function
  const formatCurrency = (value, currency = 'USD') => {
    if (!value) return '';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(value);
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview('');
    setImageUrl('');
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
          setSearchResults([]);
          setStockSearch('');
        }
      }
    };
    
    window.addEventListener('keydown', handleEscapeKey);
    
    return () => {
      window.removeEventListener('keydown', handleEscapeKey);
    };
  }, [searchResults.length]);

  // Add drag and drop handlers for avatar
  const handleAvatarDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      try {
        // Create object URL for preview
        const previewUrl = URL.createObjectURL(file);
        setAvatarUrl(previewUrl);
        
        // Update profile context with new avatar
        await profile.updateAvatar(file);
        
        // Clean up the object URL
        URL.revokeObjectURL(previewUrl);
      } catch (error) {
        console.error('Error updating avatar:', error);
        // Revert to previous avatar if update fails
        setAvatarUrl(profile?.avatarUrl || '/default-avatar.svg');
      }
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
    setSearchResults([]);
    // Clear search input
    setStockSearch('');
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
        setCurrentPrice(price);
        
        // نسبة الهدف 5% فوق سعر السهم الحالي
        const targetPercentage = 5;
        // نسبة إيقاف الخسارة 5% تحت سعر السهم الحالي
        const stopLossPercentage = 5;
        
        // تعيين أسعار الهدف ووقف الخسارة مع النسب المئوية
        const targetValue = (price * (1 + targetPercentage/100)).toFixed(2);
        const stopLossValue = (price * (1 - stopLossPercentage/100)).toFixed(2);
        
        setTargetPrice(targetValue);
        setStopLossPrice(stopLossValue);
        // تخزين النسب المئوية لاستخدامها في العرض
        setTargetPercentage(targetPercentage);
        setStopLossPercentage(stopLossPercentage);
      } else {
        console.warn(`Invalid API response structure for ${symbol}:`, data);
        throw new Error('Invalid price data structure in API response');
      }
    } catch (error) {
      console.error('Error fetching current price from API:', error);
      setCurrentPrice(null);
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

  // إضافة استماع لمفتاح Escape
  useEffect(() => {
    const handleEscapeKeyForStrategy = (e) => {
      if (e.key === 'Escape' && showStrategyDialog) {
        closeStrategyDialog();
      }
    };
    
    document.addEventListener('keydown', handleEscapeKeyForStrategy);
    
    return () => {
      document.removeEventListener('keydown', handleEscapeKeyForStrategy);
    };
  }, [showStrategyDialog]);

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

  return (
    <div className="create-post-form-container" ref={formWrapperRef}>
      
      {/* Post submission status indicator */}
      {isSubmitting && (
        <div className="post-status-indicator">
          <div className="post-status-spinner"></div>
          <div className="post-status-content">
            <div className="post-status-title">Creating Post</div>
            <div className="post-status-message">
              {submissionProgress || 'Processing your post...'}
            </div>
          </div>
        </div>
      )}
      
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
                    onClick={() => setSelectedStock(null)}
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
                            setTargetPrice(e.target.value);
                            // حساب النسبة المئوية الجديدة
                            if (currentPrice && !isNaN(currentPrice) && !isNaN(e.target.value)) {
                              const newPercentage = (((parseFloat(e.target.value) / currentPrice) - 1) * 100).toFixed(1);
                              setTargetPercentage(parseFloat(newPercentage));
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
                              setTargetPercentage(newPercentage);
                              // تحديث سعر الهدف بناءً على النسبة الجديدة
                              if (currentPrice && !isNaN(currentPrice) && !isNaN(newPercentage)) {
                                const newTargetPrice = (currentPrice * (1 + newPercentage/100)).toFixed(2);
                                setTargetPrice(newTargetPrice);
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
                            setStopLossPrice(e.target.value);
                            // حساب النسبة المئوية الجديدة
                            if (currentPrice && !isNaN(currentPrice) && !isNaN(e.target.value)) {
                              const newPercentage = ((1 - (parseFloat(e.target.value) / currentPrice)) * 100).toFixed(1);
                              setStopLossPercentage(parseFloat(newPercentage));
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
                              setStopLossPercentage(newPercentage);
                              // تحديث سعر إيقاف الخسارة بناءً على النسبة الجديدة
                              if (currentPrice && !isNaN(currentPrice) && !isNaN(newPercentage)) {
                                const newStopLossPrice = (currentPrice * (1 - newPercentage/100)).toFixed(2);
                                setStopLossPrice(newStopLossPrice);
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
                              setSelectedStrategy('');
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
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Share your thoughts..."
            className="form-control"
          ></textarea>
          <div className="focus-ring"></div>
          {description && (
            <div className={`char-counter ${description.length > 500 ? 'warning' : ''} ${description.length > 1000 ? 'danger' : ''}`}>
              {description.length} / 1000
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
                  onChange={(e) => setStockSearch(e.target.value)}
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
                  setSelectedStrategy(strategy);
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
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !description}
          className={`btn btn-primary ${isSubmitting ? 'is-submitting' : ''}`}
        >
          {isSubmitting ? 'Posting...' : 'Post'}
        </button>
        <button 
          className="btn btn-secondary" 
          onClick={(e) => {
            if (isSubmitting) {
              // Show posting message but still allow dialog to close
              setSubmissionProgress('Posting in progress, your post will complete in the background...');
            }
            // Always call onCancel to close the dialog
            onCancel();
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
