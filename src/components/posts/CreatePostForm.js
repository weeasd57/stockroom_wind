'use client';

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/contexts/ProfileContext';
import { generateEodUrl, getStockPrice, countries } from '@/utils/stockApi';
import { getCountrySymbolCounts, searchStocks } from '@/utils/symbolSearch';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar.jsx";
import 'flag-icons/css/flag-icons.min.css';

// Map of country names to their ISO codes for flags
const COUNTRY_ISO_CODES = {
  'Egypt': 'eg',
  'United Arab Emirates': 'ae',
  'USA': 'us',
  'Uganda': 'ug',
  'UK': 'gb',
  'Argentina': 'ar',
  'Australia': 'au',
  'Austria': 'at',
  'Bahrain': 'bh',
  'Belgium': 'be',
  'Botswana': 'bw',
  'Brazil': 'br',
  'Canada': 'ca',
  'Chile': 'cl',
  'China': 'cn',
  'Colombia': 'co',
  'Denmark': 'dk',
  'Finland': 'fi',
  'France': 'fr',
  'Germany': 'de',
  'Ghana': 'gh',
  'Greece': 'gr',
  'Hong Kong': 'hk',
  'India': 'in',
  'Indonesia': 'id',
  'Ireland': 'ie',
  'Italy': 'it',
  'Japan': 'jp',
  'Jordan': 'jo',
  'Kenya': 'ke',
  'Kuwait': 'kw',
  'Lebanon': 'lb',
  'Malawi': 'mw',
  'Malaysia': 'my',
  'Mauritius': 'mu',
  'Mexico': 'mx',
  'Morocco': 'ma',
  'Netherlands': 'nl',
  'New Zealand': 'nz',
  'Nigeria': 'ng',
  'Norway': 'no',
  'Oman': 'om',
  'Peru': 'pe',
  'Philippines': 'ph',
  'Poland': 'pl',
  'Portugal': 'pt',
  'Qatar': 'qa',
  'Russia': 'ru',
  'Saudi Arabia': 'sa',
  'Singapore': 'sg',
  'South Africa': 'za',
  'South Korea': 'kr',
  'Spain': 'es',
  'Sweden': 'se',
  'Switzerland': 'ch',
  'Taiwan': 'tw',
  'Tanzania': 'tz',
  'Thailand': 'th',
  'Turkey': 'tr',
  'Vietnam': 'vn',
  'Zambia': 'zm',
  'Zimbabwe': 'zw'
};

export default function CreatePostForm({ onPostCreated, onCancel }) {
  const { user } = useAuth();
  const { profile, getEffectiveAvatarUrl } = useProfile();
  const [isSubmitting, setIsSubmitting] = useState(false);
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
  const [countrySymbolCounts, setCountrySymbolCounts] = useState({});
  const fileInputRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const searchInputRef = useRef(null);
  const stockSearchResultsRef = useRef(null);

  // Preload popular country data on component mount
  useEffect(() => {
    // Load popular countries data
    const loadPopularCountriesData = async () => {
      try {
        // Get counts for all countries by converting object to array of codes
        const countryCodes = Object.values(COUNTRY_ISO_CODES);
        const counts = await getCountrySymbolCounts(countryCodes);
        setCountrySymbolCounts(counts);
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
      fetchUserStrategies();
    }
  }, [user]);

  // Fetch user strategies
  const fetchUserStrategies = async () => {
    try {
      const defaultStrategies = [
        'Long Term Investment',
        'Swing Trading',
        'Day Trading',
        'Value Investing',
        'Growth Investing'
      ];
      setStrategies(defaultStrategies);
    } catch (error) {
      console.error('Error fetching strategies:', error);
    }
  };

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (stockSearch.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        // Use our local symbol search instead of API
        const results = await searchStocks(stockSearch, selectedCountry === 'all' ? null : selectedCountry);
        
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
        // toast.error('Failed to search stocks');
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [stockSearch, selectedCountry]);

  // Handle country selection change
  const handleCountryChange = (value) => {
    setSelectedCountry(value === 'all' ? 'all' : value);
    
    // Update API URL if a stock is selected
    if (stockSearch) {
      setApiUrl(generateEodUrl(stockSearch, value === 'all' ? '' : value));
    }
    
    // Reset search results when country changes
    if (stockSearch.length >= 2) {
      setIsSearching(true);
      
      // Use our local symbol search
      searchStocks(stockSearch, value === 'all' ? null : value)
        .then(results => {
          // Format the results to match the expected structure
          const formattedResults = results.map(item => ({
            symbol: item.Symbol,
            name: item.Name,
            country: item.Country,
            exchange: item.Exchange,
            uniqueId: item.uniqueId
          }));
          
          setSearchResults(formattedResults);
          setIsSearching(false);
        })
        .catch(error => {
          console.error('Error searching after country change:', error);
          setIsSearching(false);
        });
    }
  };

  // Update API URL when stock search changes
  useEffect(() => {
    if (stockSearch) {
      setApiUrl(generateEodUrl(stockSearch, selectedCountry === 'all' ? '' : selectedCountry));
    }
  }, [stockSearch, selectedCountry]);

  // Handle stock selection
  const handleStockSelect = async (stock) => {
    try {
      // Check if already selected
      if (selectedStock && selectedStock.symbol === stock.symbol) {
        return;
      }
      
      // Set the selected stock
      setSelectedStock(stock);
      
      // Add the symbol to description
      const symbolTag = stock.exchange ? `#${stock.symbol}` : `$${stock.symbol}`;
      setDescription(prev => {
        if (prev.includes(symbolTag)) {
          return prev;
        }
        return prev + (prev ? ' ' : '') + symbolTag;
      });
      
      // Reset search field
      setStockSearch('');
      setSearchResults([]);

      // If it's a regular stock (not an exchange), fetch its price
      if (!stock.exchange) {
        try {
          const priceData = await getStockPrice(stock.symbol);
          const price = priceData?.close;
          setCurrentPrice(price);
          
          // Set default target price and stop loss based on current price
          if (price) {
            // Default target price 10% above current price
            setTargetPrice((price * 1.1).toFixed(2));
            // Default stop loss 5% below current price
            setStopLossPrice((price * 0.95).toFixed(2));
          }
        } catch (error) {
          console.error('Error fetching stock price:', error);
          // toast.error('Failed to fetch current price');
        }
      } else {
        // For exchanges, don't try to get price data
        setCurrentPrice(null);
        setTargetPrice('');
        setStopLossPrice('');
      }
    } catch (error) {
      console.error('Error selecting stock/exchange:', error);
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
      await createPost({ user_id: user.id, strategy_name: newStrategy.trim() });
      setStrategies([...strategies, newStrategy.trim()]);
      setSelectedStrategy(newStrategy.trim());
      setNewStrategy('');
      // toast.success('Strategy added');
    } catch (error) {
      console.error('Error adding strategy:', error);
      // toast.error('Failed to add strategy');
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    
    if (!description.trim()) {
      // toast.error('Please enter a description');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      let uploadedImageUrl = imageUrl;
      
      // Upload image if file is selected
      if (imageFile) {
        uploadedImageUrl = await createPost({ user_id: user.id, image: imageFile });
      }
      
      // Create post data object
      const postData = {
        user_id: user.id,
        description: description.trim(),
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
      const newPost = await createPost(postData);
      
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
      
      // toast.success('Post created successfully');
    } catch (error) {
      console.error('Error creating post:', error);
      // toast.error('Failed to create post');
    } finally {
      setIsSubmitting(false);
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
    const stockItems = resultsElement.querySelectorAll('.stock-item');
    if (stockItems.length === 0) return;
    
    // Find the currently focused item
    const focusedItem = document.activeElement;
    const isFocusedItemStock = focusedItem && focusedItem.classList && focusedItem.classList.contains('stock-item');
    
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

  // Create post helper function
  const createPost = async (postData) => {
    // Implementation will be added later
    console.log('Creating post:', postData);
    return true;
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

  return (
    <>
      {/* Image Preview */}
      {imagePreview && (
        <div className="image-preview-container">
          <div className="relative">
            <img
              src={imagePreview}
              alt="Preview"
              className="image-preview"
            />
            <Button
              variant="destructive"
              size="sm"
              className="absolute top-2 right-2"
              onClick={handleRemoveImage}
            >
              Remove
            </Button>
          </div>
        </div>
      )}

      {/* Selected Stock Info - Moved here from sidebar */}
      {selectedStock && (
        <div className="stock-info-section mb-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="flag-container">
                  <span className={`fi fi-${selectedStock.country.toLowerCase()} stock-flag`}></span>
                </div>
                <h3 className="font-medium">{selectedStock.symbol}</h3>
                {selectedStock.exchange && (
                  <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-full">
                    EXCHANGE
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{selectedStock.name}</p>
              <div className="text-xs opacity-60 mt-0.5">
                {Object.entries(COUNTRY_ISO_CODES).find(([_, code]) => 
                  code.toLowerCase() === selectedStock.country.toLowerCase()
                )?.[0] || selectedStock.country}
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelectedStock(null)}>
              Remove
            </Button>
          </div>
          {currentPrice && (
            <div className="mt-2">
              <p className="text-sm bg-gray-50 dark:bg-gray-900 py-2 px-3 rounded border">
                Current Price: <span className="font-semibold">${currentPrice}</span>
              </p>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            <div className="form-field">
              <Label htmlFor="targetPrice" className="text-sm mb-1 block">Target Price</Label>
              <Input
                id="targetPrice"
                type="number"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                placeholder="Enter target price"
                className="w-full"
              />
            </div>
            <div className="form-field">
              <Label htmlFor="stopLoss" className="text-sm mb-1 block">Stop Loss</Label>
              <Input
                id="stopLoss"
                type="number"
                value={stopLossPrice}
                onChange={(e) => setStopLossPrice(e.target.value)}
                placeholder="Enter stop loss"
                className="w-full"
              />
            </div>
          </div>

          {/* Strategy Selection */}
          <div className="mt-4 form-field">
            <Label className="text-sm mb-1 block">Trading Strategy</Label>
            <Select value={selectedStrategy} onValueChange={setSelectedStrategy}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a strategy" />
              </SelectTrigger>
              <SelectContent>
                {strategies.map((strategy) => (
                  <SelectItem key={strategy} value={strategy}>
                    {strategy}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="create-post-grid">
        {/* Main Content */}
        <div>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Avatar className="w-8 h-8">
                <AvatarImage src={avatarUrl} alt="User avatar" />
                <AvatarFallback>U</AvatarFallback>
              </Avatar>
              <span className="text-sm md:text-base">{user?.email}</span>
            </div>

            <div className="form-field">
              <Label htmlFor="description" className="form-field-label">What's on your mind?</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Share your thoughts..."
                className="mt-2 min-h-[120px] w-full"
              />
            </div>

            {/* Image Upload */}
            <div className="form-field">
              <Label className="form-field-label">Add Image</Label>
              <div className="flex gap-2 mt-2 button-group">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1"
                >
                  Upload Image
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowImageUrlInput(!showImageUrlInput)}
                  className="flex-1"
                >
                  Image URL
                </Button>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleImageChange}
              />
              {showImageUrlInput && (
                <Input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="Enter image URL"
                  className="mt-2 w-full"
                />
              )}
            </div>
            
            {/* Submit Buttons */}
            <div className="flex justify-end gap-2 button-group mt-4">
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !description}
                className={`flex-1 md:flex-initial ${isSubmitting ? 'is-submitting' : ''}`}
              >
                {isSubmitting ? 'Posting...' : 'Post'}
              </Button>
              <Button variant="outline" onClick={onCancel} className="flex-1 md:flex-initial">
                Cancel
              </Button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Stock Search Section */}
          <div className="stock-search-section">
            <div className="stock-search-container">
              {/* Country Selection */}
              <div className="country-select">
                <Label htmlFor="countrySelect" className="block text-sm mb-1">Country</Label>
                <Select value={selectedCountry} onValueChange={handleCountryChange}>
                  <SelectTrigger id="countrySelect" className="country-select-trigger w-full">
                    <SelectValue>
                      {selectedCountry === 'all' ? (
                        'All Countries'
                      ) : (
                        <>
                          <span className={`fi fi-${selectedCountry} mr-2`}></span>
                          {Object.entries(COUNTRY_ISO_CODES).find(([_, code]) => 
                            code.toLowerCase() === selectedCountry
                          )?.[0] || selectedCountry}
                        </>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="country-select-content">
                    <SelectItem value="all">All Countries</SelectItem>
                    {Object.entries(COUNTRY_ISO_CODES)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([country, code]) => (
                        <SelectItem 
                          key={`country-${code.toLowerCase()}`} 
                          value={code.toLowerCase()}
                        >
                          <span className={`fi fi-${code.toLowerCase()} mr-2`}></span>
                          {country} ({countrySymbolCounts[code.toLowerCase()] || 0})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Search Input */}
              <div className="search-input-container relative">
                <Label htmlFor="stockSearch" className="block text-sm mb-1">Search for a stock</Label>
                <Input
                  id="stockSearch"
                  ref={searchInputRef}
                  type="text"
                  value={stockSearch}
                  onChange={(e) => setStockSearch(e.target.value)}
                  placeholder="Enter symbol or name"
                  className="w-full"
                  aria-expanded={searchResults.length > 0}
                  aria-controls={searchResults.length > 0 ? "search-results-list" : undefined}
                  aria-autocomplete="list"
                />
                {isSearching && (
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="h-4 w-16 loading-skeleton rounded"></div>
                  </span>
                )}

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div 
                    className="search-results" 
                    ref={stockSearchResultsRef}
                    id="search-results-list"
                    role="listbox"
                    aria-label="Stock search results"
                  >
                    <div className="text-xs text-center py-1 text-muted-foreground mb-1">
                      {searchResults.length} {searchResults.length === 1 ? 'result' : 'results'} found
                    </div>
                    {searchResults.map((stock, index) => (
                      <div
                        key={`${stock.symbol}-${stock.country}-${stock.exchange || ''}-${index}`}
                        className={`search-result-item stock-item flag-${stock.country.toLowerCase()}`}
                        onClick={() => handleStockSelect(stock)}
                        tabIndex={0}
                        role="option"
                        aria-selected={false}
                        id={`stock-result-${index}`}
                      >
                        <div className="flag-container">
                          <span 
                            className={`fi fi-${stock.country.toLowerCase()} stock-flag`}
                            title={Object.entries(COUNTRY_ISO_CODES).find(([_, code]) => 
                              code.toLowerCase() === stock.country.toLowerCase()
                            )?.[0] || stock.country}
                          ></span>
                        </div>
                        <div className="flex-1">
                          <div className="font-medium flex items-center">
                            {stock.symbol}
                            {stock.exchange && (
                              <span className="ml-2 text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-full">
                                EXCHANGE
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {stock.name}
                            {stock.exchange && <span className="ml-1 text-xs opacity-70">({stock.exchange})</span>}
                          </div>
                          <div className="text-xs opacity-60 mt-0.5">
                            {Object.entries(COUNTRY_ISO_CODES).find(([_, code]) => 
                              code.toLowerCase() === stock.country.toLowerCase()
                            )?.[0] || stock.country}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
