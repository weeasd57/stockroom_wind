'use client';

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/contexts/ProfileContext';
import { generateEodUrl, getStockPrice, countries } from '@/utils/stockApi';
import { getCountrySymbolCounts, searchStocks } from '@/utils/symbolSearch';
import 'flag-icons/css/flag-icons.min.css';
import '@/styles/create-post-page.css';

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
            <div className="stock-header">
              <div className="stock-symbol">
                <div className="flag-container">
                  <span className={`fi fi-${selectedStock.country.toLowerCase()} stock-flag`}></span>
                </div>
                <h3 className="stock-name">{selectedStock.symbol}</h3>
                {selectedStock.exchange && (
                  <span className="stock-exchange">
                    {selectedStock.exchange}
                  </span>
                )}
              </div>
              <button className="btn btn-icon" onClick={() => setSelectedStock(null)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <p className="stock-description">{selectedStock.name}</p>
            <div className="stock-country">
              {Object.entries(COUNTRY_ISO_CODES).find(([_, code]) => 
                code.toLowerCase() === selectedStock.country.toLowerCase()
              )?.[0] || selectedStock.country}
            </div>
          
            {currentPrice && (
              <div className="current-price-container">
                <p className="current-price">
                  Current Price: <span className="price-value">${currentPrice}</span>
                </p>
              </div>
            )}
            
            <div className="price-inputs">
              <div className="floating-label">
                <input
                  id="targetPrice"
                  type="number"
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                  placeholder=" "
                  className="form-control"
                />
                <label htmlFor="targetPrice" className="form-label">Target Price</label>
                <div className="focus-ring"></div>
              </div>
              
              <div className="floating-label">
                <input
                  id="stopLoss"
                  type="number"
                  value={stopLossPrice}
                  onChange={(e) => setStopLossPrice(e.target.value)}
                  placeholder=" "
                  className="form-control"
                />
                <label htmlFor="stopLoss" className="form-label">Stop Loss</label>
                <div className="focus-ring"></div>
              </div>
            </div>

            {/* Strategy Selection */}
            <div className="form-group">
              <label className="form-label">Trading Strategy</label>
              <div className="select-field" onClick={() => setShowStrategyInput(!showStrategyInput)}>
                <span>{selectedStrategy || "Select a strategy"}</span>
                <span className="select-field-icon">▼</span>
              </div>
              
              {showStrategyInput && (
                <div className="category-dropdown show">
                  {strategies.map((strategy) => (
                    <div 
                      key={strategy} 
                      className={`category-option ${selectedStrategy === strategy ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedStrategy(strategy);
                        setShowStrategyInput(false);
                      }}
                    >
                      <span className="category-option-check">✓</span>
                      {strategy}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="form-group">
        <div className="user-info">
          <div className="user-avatar">
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
      <div className="form-group">
        <label className="form-label">Search for a stock</label>
        
        <div className="category-select">
          <label htmlFor="countrySelect" className="form-label">Country</label>
          <div 
            className={`select-field ${searchResults.length > 0 ? 'open' : ''}`}
            onClick={() => setShowStockSearch(!showStockSearch)}
          >
            <span>
              {selectedCountry === 'all' ? (
                'All Countries'
              ) : (
                <>
                  <span className={`fi fi-${selectedCountry} country-flag`}></span>
                  {Object.entries(COUNTRY_ISO_CODES).find(([_, code]) => 
                    code.toLowerCase() === selectedCountry
                  )?.[0] || selectedCountry}
                </>
              )}
            </span>
            <span className="select-field-icon">▼</span>
          </div>
          
          {showStockSearch && (
            <div className="category-dropdown show">
              <div 
                className={`category-option ${selectedCountry === 'all' ? 'selected' : ''}`}
                onClick={() => {
                  handleCountryChange('all');
                  setShowStockSearch(false);
                }}
              >
                <span className="category-option-check">✓</span>
                All Countries
              </div>
              
              {Object.entries(COUNTRY_ISO_CODES)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([country, code]) => (
                  <div 
                    key={`country-${code.toLowerCase()}`}
                    className={`category-option ${selectedCountry === code.toLowerCase() ? 'selected' : ''}`}
                    onClick={() => {
                      handleCountryChange(code.toLowerCase());
                      setShowStockSearch(false);
                    }}
                  >
                    <span className="category-option-check">✓</span>
                    <span className={`fi fi-${code.toLowerCase()} country-flag`}></span>
                    {country} ({countrySymbolCounts[code.toLowerCase()] || 0})
                  </div>
                ))}
            </div>
          )}
        </div>
        
        <div className="form-group">
          <div className="search-container">
            <input
              id="stockSearch"
              ref={searchInputRef}
              type="text"
              value={stockSearch}
              onChange={(e) => setStockSearch(e.target.value)}
              placeholder="Enter symbol or name"
              className="form-control"
            />
            <div className="focus-ring"></div>
            {isSearching && (
              <div className="search-loader"></div>
            )}
          </div>
          
          {searchResults.length > 0 && (
            <div className="search-results" ref={stockSearchResultsRef}>
              {searchResults.map((stock) => (
                <div 
                  key={stock.uniqueId || `${stock.symbol}-${stock.country}`}
                  className="search-result-item"
                  onClick={() => handleStockSelect(stock)}
                >
                  <span className={`fi fi-${stock.country.toLowerCase()} search-flag`}></span>
                  <div className="search-result-content">
                    <div className="search-result-symbol">{stock.symbol}</div>
                    <div className="search-result-name">{stock.name}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* Submit Buttons */}
      <div className="form-actions">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !description}
          className={`btn btn-primary ${isSubmitting ? 'is-submitting' : ''}`}
        >
          {isSubmitting ? 'Posting...' : 'Post'}
        </button>
        <button className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </>
  );
}
