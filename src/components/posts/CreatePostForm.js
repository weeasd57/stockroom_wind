'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/contexts/ProfileContext';
import { searchStocks, getStockPrice, generateEodUrl, countries } from '@/utils/stockApi';
import { createPost, uploadPostImage, getUserStrategies, createUserStrategy } from '@/utils/supabase';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from '@/components/ui/button';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import 'flag-icons/css/flag-icons.min.css';
import '@/styles/create-post.css';

// Map of country names to their ISO codes for flags
const COUNTRY_ISO_CODES = {
  'USA': 'us',
  'United Kingdom': 'gb',
  'Germany': 'de',
  'France': 'fr',
  'Japan': 'jp',
  'China': 'cn',
  'Hong Kong': 'hk',
  'Canada': 'ca',
  'Australia': 'au',
  'India': 'in',
  'Brazil': 'br',
  'South Korea': 'kr',
  'Singapore': 'sg',
  'Switzerland': 'ch',
  'Netherlands': 'nl',
  'Spain': 'es',
  'Sweden': 'se',
  'Italy': 'it',
  'Belgium': 'be',
  'Denmark': 'dk',
  'Finland': 'fi',
  'Norway': 'no',
  'New Zealand': 'nz',
  'Ireland': 'ie',
  'Austria': 'at',
  'Portugal': 'pt',
  'Greece': 'gr',
  'Poland': 'pl',
  'Mexico': 'mx',
  'Russia': 'ru',
  'South Africa': 'za',
  'Thailand': 'th',
  'Malaysia': 'my',
  'Indonesia': 'id',
  'Philippines': 'ph',
  'Turkey': 'tr',
  'Saudi Arabia': 'sa',
  'United Arab Emirates': 'ae',
  'Israel': 'il',
  'Egypt': 'eg'
};

export default function CreatePostForm({ onPostCreated, onCancel }) {
  const { user } = useAuth();
  const { profile, getEffectiveAvatarUrl } = useProfile();
  const [isExpanded, setIsExpanded] = useState(false);
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
  const fileInputRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const searchInputRef = useRef(null);

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

  // Handle stock search with debounce
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
        const results = await searchStocks(stockSearch);
        
        // Filter results by selected country if one is selected
        const filteredResults = selectedCountry !== 'all'
          ? results.filter(stock => stock.Country === selectedCountry)
          : results;
        
        // Ensure each result has a unique identifier
        const processedResults = filteredResults.slice(0, 10).map((stock, index) => ({
          ...stock,
          uniqueId: `${stock.Code}-${stock.Country}-${index}`
        }));
        
        setSearchResults(processedResults);
      } catch (error) {
        console.error('Error searching stocks:', error);
        toast.error('Failed to search stocks');
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
      searchStocks(stockSearch).then(results => {
        const filteredResults = value && value !== 'all'
          ? results.filter(stock => stock.Country === value)
          : results;
        
        setSearchResults(filteredResults.slice(0, 10));
        setIsSearching(false);
      }).catch(error => {
        console.error('Error searching stocks after country change:', error);
        setIsSearching(false);
      });
    }
  };

  // Update API URL when stock search changes
  useEffect(() => {
    if (stockSearch) {
      setApiUrl(generateEodUrl(stockSearch, selectedCountry));
    }
  }, [stockSearch, selectedCountry]);

  // Fetch user strategies
  const fetchUserStrategies = async () => {
    try {
      const userStrategies = await getUserStrategies(user.id);
      setStrategies(userStrategies.map(s => s.strategy_name));
    } catch (error) {
      console.error('Error fetching strategies:', error);
    }
  };

  // Handle stock selection
  const handleSelectStock = async (stock) => {
    setSelectedStock(stock);
    setStockSearch(stock.Code);
    setSearchResults([]);
    setShowStockSearch(false);

    try {
      const priceData = await getStockPrice(stock.Code);
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
      toast.error('Failed to fetch current price');
    }
  };

  // Handle image selection
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
      setImageUrl('');
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
      await createUserStrategy(user.id, newStrategy.trim());
      setStrategies([...strategies, newStrategy.trim()]);
      setSelectedStrategy(newStrategy.trim());
      setNewStrategy('');
      toast.success('Strategy added');
    } catch (error) {
      console.error('Error adding strategy:', error);
      toast.error('Failed to add strategy');
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!description.trim()) {
      toast.error('Please enter a description');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      let uploadedImageUrl = imageUrl;
      
      // Upload image if file is selected
      if (imageFile) {
        uploadedImageUrl = await uploadPostImage(imageFile, user.id);
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
        postData.symbol = selectedStock.Code;
        postData.company_name = selectedStock.Name;
        postData.country = selectedStock.Country;
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
      setIsExpanded(false);
      
      // Notify parent component
      if (onPostCreated) {
        onPostCreated(newPost);
      }
      
      toast.success('Post created successfully');
    } catch (error) {
      console.error('Error creating post:', error);
      toast.error('Failed to create post');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onCancel}>
      <DialogContent className="create-post-container">
        <div className="create-post-header">
          <Avatar className="w-10 h-10">
            <AvatarImage src={avatarUrl} alt="User avatar" />
            <AvatarFallback>
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="font-medium">{user?.email}</div>
            <div className="text-sm text-muted-foreground">
              Creating a new stock post
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="create-post-form">
          <div className="space-y-4">
            <div>
              <Label htmlFor="description">What's on your mind about the market?</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Share your stock analysis, market insights, or trading ideas..."
                className="create-post-textarea"
              />
            </div>

            {/* Stock Search Section */}
            <div className="stock-search-container">
              <Label htmlFor="country-select">Select Market</Label>
              <Select
                value={selectedCountry}
                onValueChange={handleCountryChange}
                className="country-select-container"
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a country">
                    {selectedCountry !== 'all' && COUNTRY_ISO_CODES[selectedCountry] && (
                      <div className="country-option">
                        <span className={`fi fi-${COUNTRY_ISO_CODES[selectedCountry]} country-flag`} />
                        <span className="country-name">{selectedCountry}</span>
                      </div>
                    )}
                    {selectedCountry === 'all' && "All Countries"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="font-medium">All Countries</SelectItem>
                  {countries.map((country) => {
                    const isoCode = COUNTRY_ISO_CODES[country];
                    return (
                      <SelectItem 
                        key={country} 
                        value={country}
                        className="country-option"
                      >
                        {isoCode && (
                          <span className={`fi fi-${isoCode} country-flag`} />
                        )}
                        <span className="country-name">{country}</span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              <div className="mt-2">
                <Label htmlFor="stock-search">Search for a Stock</Label>
                <Input
                  id="stock-search"
                  type="text"
                  value={stockSearch}
                  onChange={(e) => setStockSearch(e.target.value)}
                  placeholder="Enter stock symbol or company name..."
                  ref={searchInputRef}
                />
              </div>

              {/* Stock Search Results */}
              {isSearching ? (
                <div className="flex justify-center p-4">
                  <div className="loading-spinner" />
                </div>
              ) : searchResults.length > 0 ? (
                <div className="stock-search-results">
                  {searchResults.map((stock) => (
                    <div
                      key={stock.uniqueId || `${stock.Code}-${stock.Country}`}
                      className="stock-item"
                      onClick={() => handleSelectStock(stock)}
                    >
                      <div className="stock-info">
                        <div className="stock-symbol">
                          {stock.Code}
                          <span className="text-xs ml-2 text-muted-foreground">
                            ({stock.Code.toLowerCase()}.{stock.Exchange?.toLowerCase()})
                          </span>
                        </div>
                        <div className="stock-name">{stock.Name}</div>
                        <div className="stock-exchange">{stock.Exchange || stock.Country}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : stockSearch.length >= 2 ? (
                <div className="p-4 text-center text-muted-foreground">
                  No stocks found
                </div>
              ) : null}
            </div>

            {/* Selected Stock Display */}
            {selectedStock && (
              <div className="selected-stock">
                <div className="font-medium">{selectedStock.Name}</div>
                <div className="text-sm text-muted-foreground">
                  {selectedStock.Code} • {selectedStock.Exchange || selectedStock.Country}
                </div>
                {currentPrice !== null && (
                  <div className="mt-2">
                    <div className="text-sm font-medium">Current Price</div>
                    <div className="text-lg font-bold">${currentPrice.toFixed(2)}</div>
                  </div>
                )}
                <div className="price-inputs">
                  <div>
                    <Label htmlFor="target-price">Target Price</Label>
                    <Input
                      id="target-price"
                      type="number"
                      step="0.01"
                      value={targetPrice}
                      onChange={(e) => setTargetPrice(e.target.value)}
                      placeholder="Enter target price..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="stop-loss">Stop Loss</Label>
                    <Input
                      id="stop-loss"
                      type="number"
                      step="0.01"
                      value={stopLossPrice}
                      onChange={(e) => setStopLossPrice(e.target.value)}
                      placeholder="Enter stop loss..."
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Strategy Section */}
            <div className="strategy-section">
              <Label>Trading Strategy</Label>
              <Select
                value={selectedStrategy}
                onValueChange={(value) => {
                  if (value === 'new') {
                    setShowStrategyInput(true);
                  } else {
                    setSelectedStrategy(value);
                    setShowStrategyInput(false);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a strategy" />
                </SelectTrigger>
                <SelectContent>
                  {strategies.map((strategy) => (
                    <SelectItem key={strategy.id} value={strategy.name}>
                      {strategy.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="new">+ Add New Strategy</SelectItem>
                </SelectContent>
              </Select>

              {showStrategyInput && (
                <div className="mt-2">
                  <Input
                    type="text"
                    value={newStrategy}
                    onChange={(e) => setNewStrategy(e.target.value)}
                    placeholder="Enter new strategy name..."
                  />
                </div>
              )}
            </div>

            {/* Image Upload Section */}
            <div>
              <Label>Add Image</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Upload Image
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowImageUrlInput(!showImageUrlInput)}
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
                  placeholder="Enter image URL..."
                  className="mt-2"
                />
              )}
              {imagePreview && (
                <div className="image-preview">
                  <img src={imagePreview} alt="Preview" />
                </div>
              )}
            </div>

            {/* Form Actions */}
            <div className="create-post-actions">
              <Button
                type="submit"
                disabled={isSubmitting || !description}
                className="flex-1"
              >
                {isSubmitting ? (
                  <div className="loading-spinner" />
                ) : (
                  'Post'
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
