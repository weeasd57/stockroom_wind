// Utility for searching through local symbol data files

// Import country summary file - this will help us know which files to search
import countrySummary from '../symbols_data/country_summary_20250304_171206.json';

// Cache for storing loaded symbol data
const symbolDataCache = {};

/**
 * Load symbols data for a specific country
 * @param {string} country - Country name
 * @returns {Promise<Array>} - Array of symbols for that country
 */
const loadSymbolsForCountry = async (country) => {
  // If we've already loaded this country's data, return from cache
  if (symbolDataCache[country]) {
    console.log(`Using cached data for ${country}`);
    return symbolDataCache[country];
  }

  try {
    // Format country name for file path (handle spaces correctly)
    const formattedCountry = country.replace(/\s+/g, '_');
    
    // Log which country we're trying to load
    console.log(`Attempting to load symbols for ${country}`);
    
    // Try both possible file formats with better error handling
    const fileUrls = [
      `/symbols_data/${country}_all_symbols_20250304_171206.json`,
      `/symbols_data/${formattedCountry}_all_symbols_20250304_171206.json`
    ];
    
    let symbols = [];
    let lastError = null;
    
    for (const url of fileUrls) {
      try {
        console.log(`Trying to fetch from: ${url}`);
        const response = await fetch(url);
        
        if (!response.ok) {
          console.warn(`Failed to fetch from ${url}: ${response.status} ${response.statusText}`);
          continue; // Try the next URL format
        }
        
        symbols = await response.json();
        console.log(`Successfully loaded ${symbols.length} symbols for ${country}`);
        
        // Cache the data
        symbolDataCache[country] = symbols;
        return symbols;
      } catch (error) {
        console.warn(`Error fetching ${url}: ${error.message}`);
        lastError = error;
      }
    }
    
    // If we reach here, all fetch attempts failed
    throw lastError || new Error(`Failed to fetch symbols for ${country}`);
  } catch (error) {
    console.error(`Error loading symbols for ${country}:`, error);
    return [];
  }
};

/**
 * Get a list of all available countries that we've confirmed have data files
 * @returns {Array<string>} - Array of country names
 */
const getAvailableCountries = () => {
  // Return only countries we're certain have data files
  // This list can be updated based on confirmed files
  return [
    'UK', 'Canada', 'China', 'Germany', 'France', 
    'India', 'Australia', 'Egypt', 'Turkey', 'Peru',
    'Taiwan', 'Croatia', 'Mexico', 'Argentina', 'Brazil',
    'Thailand', 'Chile', 'Greece', 'South Africa', 'Pakistan',
    'Indonesia', 'Philippines', 'Poland', 'Hungary', 'Korea',
    'Kenya', 'Ghana', 'Nigeria', 'Tanzania', 'Sweden',
    'Denmark', 'Norway', 'Ireland', 'Netherlands', 'Portugal',
    'Switzerland', 'Spain', 'Belgium'
  ];
};

/**
 * Detect which countries actually have data files available in the public directory
 * @returns {Promise<string[]>} - Array of country names with available data
 */
const detectAvailableCountries = async () => {
  // Get the full list of potential countries from the summary file
  const potentialCountries = Object.keys(countrySummary);
  const availableCountries = [];
  
  console.log(`Checking data availability for ${potentialCountries.length} countries...`);
  
  // Check each country one by one
  for (const country of potentialCountries) {
    try {
      // Try to load it to see if it works
      const symbols = await loadSymbolsForCountry(country);
      if (symbols && symbols.length > 0) {
        availableCountries.push(country);
        console.log(`✓ Confirmed data for ${country} (${symbols.length} symbols)`);
      } else {
        console.log(`× No data found for ${country}`);
      }
    } catch (error) {
      console.log(`× Failed to load data for ${country}`);
    }
  }
  
  console.log(`Found data for ${availableCountries.length} out of ${potentialCountries.length} countries`);
  return availableCountries;
};

/**
 * Get the count of symbols for each available country
 * @returns {Promise<Object>} - Object with country names as keys and symbol counts as values
 */
const getCountrySymbolCounts = async () => {
  const availableCountries = getAvailableCountries();
  const countryCounts = {};
  
  // Add "All Countries" with total count
  let totalCount = 0;
  
  // For each available country, load symbols and count them
  for (const country of availableCountries) {
    try {
      const symbols = await loadSymbolsForCountry(country);
      if (symbols && symbols.length > 0) {
        countryCounts[country] = symbols.length;
        totalCount += symbols.length;
      } else {
        countryCounts[country] = 0;
      }
    } catch (error) {
      console.error(`Error getting symbol count for ${country}:`, error);
      countryCounts[country] = 0;
    }
  }
  
  // Add the total count for "All Countries"
  countryCounts['all'] = totalCount;
  
  return countryCounts;
};

/**
 * Search for symbols across all countries or specific countries
 * @param {string} query - Search query (symbol, name, etc.)
 * @param {string|null} country - Specific country to search in, or null for all
 * @param {number} limit - Maximum number of results to return
 * @returns {Promise<Array>} - Array of matching symbols
 */
const searchStocks = async (query, country = null, limit = 50) => {
  if (!query || query.length < 2) {
    return [];
  }

  const queryLower = query.toLowerCase();
  let results = [];
  
  // Only search in confirmed available countries
  const availableCountries = getAvailableCountries();
  const countries = country ? 
    (availableCountries.includes(country) ? [country] : []) : 
    availableCountries;

  // For each country we want to search in
  for (const countryName of countries) {
    try {
      // Load symbols for this country
      const countrySymbols = await loadSymbolsForCountry(countryName);
      
      // Skip if no symbols were found
      if (!countrySymbols || countrySymbols.length === 0) {
        continue;
      }
      
      // Filter symbols that match the query
      const matchingSymbols = countrySymbols.filter(symbol => {
        return (
          symbol.Symbol.toLowerCase().includes(queryLower) ||
          (symbol.Name && symbol.Name.toLowerCase().includes(queryLower))
        );
      });
      
      // Add matching symbols to results
      results = [...results, ...matchingSymbols];
      
      // Stop if we've reached the limit
      if (results.length >= limit) {
        break;
      }
    } catch (error) {
      console.error(`Error searching in ${countryName}:`, error);
      // Continue with next country instead of failing the whole search
    }
  }

  // Ensure each result has a unique identifier
  return results.slice(0, limit).map((item, index) => ({
    ...item,
    Code: item.Symbol,
    uniqueId: `${item.Symbol}-${item.Country}-${index}`
  }));
};

/**
 * Get symbol details by symbol code and country
 * @param {string} symbolCode - Symbol code
 * @param {string} country - Country name
 * @returns {Promise<Object|null>} - Symbol details or null if not found
 */
const getSymbolDetails = async (symbolCode, country) => {
  try {
    // Check if the country is in our confirmed list
    const availableCountries = getAvailableCountries();
    if (!availableCountries.includes(country)) {
      console.warn(`No data available for country: ${country}`);
      return null;
    }
    
    const countrySymbols = await loadSymbolsForCountry(country);
    return countrySymbols.find(symbol => symbol.Symbol === symbolCode) || null;
  } catch (error) {
    console.error(`Error getting symbol details for ${symbolCode} in ${country}:`, error);
    return null;
  }
};

/**
 * Preload symbol data for popular/common markets for faster searching
 * @returns {Promise<void>}
 */
const preloadPopularCountries = async () => {
  // Use only countries from our confirmed list
  const popularCountries = [
    'UK', 'Canada', 'China', 'Germany', 'France', 
    'India', 'Australia', 'Egypt'
  ].filter(country => getAvailableCountries().includes(country));
  
  console.log(`Preloading data for ${popularCountries.length} popular markets...`);
  
  if (popularCountries.length === 0) {
    console.log('No popular markets available for preloading. Skipping.');
    return;
  }
  
  // Load data for each country one at a time (instead of in parallel)
  // This might be more reliable than parallel loading
  for (const country of popularCountries) {
    try {
      console.log(`Loading ${country} symbols...`);
      const symbols = await loadSymbolsForCountry(country);
      console.log(`✓ Loaded ${symbols.length} ${country} symbols`);
    } catch (error) {
      console.error(`× Failed to load ${country} symbols:`, error);
    }
  }
  
  console.log('Preloading complete');
};

export {
  searchStocks,
  getAvailableCountries,
  getSymbolDetails,
  getCountrySymbolCounts,
  preloadPopularCountries,
  detectAvailableCountries
};