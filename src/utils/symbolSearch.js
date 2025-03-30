// Utility for searching through local symbol data files

// Import country summary file - this will help us know which files to search
import countrySummary from '../symbols_data/country_summary_20250304_171206.json';
// import logger from '@/utils/logger';

// Cache for storing loaded symbol data
const symbolDataCache = {};

/**
 * Dynamically generates a map of country names to ISO codes from the country summary file
 * @returns {Object} - Map of country names to ISO codes
 */
const generateCountryISOCodes = () => {
  // Base ISO codes for known countries
  const baseISOCodes = {
    'USA': 'us',
    'UK': 'gb',
    'Canada': 'ca',
    'Germany': 'de',
    'Luxembourg': 'lu',
    'Austria': 'at',
    'France': 'fr',
    'Belgium': 'be',
    'Spain': 'es',
    'Switzerland': 'ch',
    'Portugal': 'pt',
    'Netherlands': 'nl',
    'Iceland': 'is',
    'Ireland': 'ie',
    'Finland': 'fi',
    'Norway': 'no',
    'Denmark': 'dk',
    'Sweden': 'se',
    'Zimbabwe': 'zw',
    'Zambia': 'zm',
    'Uganda': 'ug',
    'Tanzania': 'tz',
    'Czech Republic': 'cz',
    'Rwanda': 'rw',
    'Botswana': 'bw',
    'Egypt': 'eg',
    'Nigeria': 'ng',
    'Ghana': 'gh',
    'Malawi': 'mw',
    'Ivory Coast': 'ci',
    'Kenya': 'ke',
    'Morocco': 'ma',
    'Mauritius': 'mu',
    'Korea': 'kr',
    'Hungary': 'hu',
    'Poland': 'pl',
    'Philippines': 'ph',
    'Indonesia': 'id',
    'Australia': 'au',
    'China': 'cn',
    'India': 'in',
    'South Africa': 'za',
    'Pakistan': 'pk',
    'Malaysia': 'my',
    'Vietnam': 'vn',
    'Sri Lanka': 'lk',
    'Thailand': 'th',
    'Chile': 'cl',
    'Greece': 'gr',
    'Argentina': 'ar',
    'Brazil': 'br',
    'Romania': 'ro',
    'Turkey': 'tr',
    'Peru': 'pe',
    'Taiwan': 'tw',
    'Croatia': 'hr',
    'Mexico': 'mx',
    // Additional mappings for UI display
    'United Arab Emirates': 'ae',
    'Hong Kong': 'hk',
    'Italy': 'it',
    'Japan': 'jp',
    'Jordan': 'jo',
    'Kuwait': 'kw',
    'Lebanon': 'lb',
    'New Zealand': 'nz',
    'Oman': 'om',
    'Qatar': 'qa',
    'Russia': 'ru',
    'Saudi Arabia': 'sa',
    'Singapore': 'sg',
    'South Korea': 'kr'
  };

  // Get all country names from the summary file
  const countryNames = Object.keys(countrySummary);
  
  // Create new ISO codes map with all countries from summary file
  const isoCodes = { ...baseISOCodes };
  
  // Add any missing countries from summary file with generic ISO mapping
  countryNames.forEach(country => {
    if (!isoCodes[country]) {
      // Generate a simple lowercase ISO code for unknown countries
      // This is a fallback for countries not in our base list
      const simpleCode = country.toLowerCase().substring(0, 2);
      console.debug(`Adding missing country ISO code: ${country} -> ${simpleCode}`);
      isoCodes[country] = simpleCode;
    }
  });
  
  return isoCodes;
};

// Generate the full COUNTRY_ISO_CODES map when the module loads
const COUNTRY_ISO_CODES = generateCountryISOCodes();

/**
 * Load symbols data for a specific country
 * @param {string} country - Country name
 * @returns {Promise<Array>} - Array of symbols for that country
 */
const loadSymbolsForCountry = async (country) => {
  // If we've already loaded symbols for this country, return them from cache
  if (symbolDataCache[country]) {
    console.debug(`Using cached symbols for ${country}`);
    return symbolDataCache[country];
  }

  console.debug(`Loading symbols for country: ${country}`);
  
  try {
    // Look for exact file pattern: "{CountryName}_all_symbols_20250304_171206.json"
    let symbols = [];
    const fileDateVersion = "_20250304_171206"; // Common timestamp pattern in files
    
    try {
      // Try direct import with exact file name format first
      const fileName = `${country}_all_symbols${fileDateVersion}`;
      console.debug(`Trying to load: ${fileName}`);
      const dataModule = await import(`../symbols_data/${fileName}.json`).catch(() => null);
      symbols = dataModule?.default || [];
      console.debug(`Successfully imported symbols for ${country} using exact filename`);
    } catch (importErr) {
      console.debug(`Could not import with exact filename pattern: ${importErr.message}`);
      
      try {
        // If that fails, try with different formats of country name
        const formattedCountry = country.replace(/\s+/g, '_');
        const fileName = `${formattedCountry}_all_symbols${fileDateVersion}`;
        console.debug(`Trying with formatted country name: ${fileName}`);
        const dataModule = await import(`../symbols_data/${fileName}.json`).catch(() => null);
        symbols = dataModule?.default || [];
        console.debug(`Successfully imported symbols for ${country} using formatted name`);
      } catch (err) {
        console.debug(`Could not import with formatted filename: ${err.message}`);
        console.error(`No matching files found for ${country}`);
        return [];
      }
    }
    
    if (symbols && symbols.length > 0) {
      console.debug(`Loaded ${symbols.length} symbols for ${country}`);
      // Cache the symbols to avoid redundant loading
      symbolDataCache[country] = symbols;
      return symbols;
    } else {
      console.warn(`No symbols found for ${country}`);
      return [];
    }
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
  
  console.debug(`Checking data availability for ${potentialCountries.length} countries...`);
  
  // Check each country one by one
  for (const country of potentialCountries) {
    try {
      // Try to load it to see if it works
      const symbols = await loadSymbolsForCountry(country);
      if (symbols && symbols.length > 0) {
        availableCountries.push(country);
        console.debug(`✓ Confirmed data for ${country} (${symbols.length} symbols)`);
      } else {
        console.debug(`× No data found for ${country}`);
      }
    } catch (error) {
      console.debug(`× Failed to load data for ${country}`);
    }
  }
  
  console.debug(`Found data for ${availableCountries.length} out of ${potentialCountries.length} countries`);
  return availableCountries;
};

/**
 * Get the count of symbols for each available country
 * @returns {Object} - Object with country codes as keys and symbol counts as values
 */
const getCountrySymbolCounts = () => {
  const countryData = {};
  let totalCount = 0;
  
  // Extract symbol counts directly from the summary file
  Object.entries(countrySummary).forEach(([countryName, data]) => {
    // Convert country name to ISO code
    const countryCode = getCountryCode(countryName);
    if (countryCode) {
      // Store the count using the lowercase ISO code as the key
      countryData[countryCode.toLowerCase()] = data.TotalSymbols;
      totalCount += data.TotalSymbols;
    }
  });
  
  // Add total count
  countryData['all'] = totalCount;
  
  return countryData;
};

/**
 * Convert a country name to its ISO code
 * @param {string} countryName - Name of the country
 * @returns {string|null} - ISO code or null if not found
 */
const getCountryCode = (countryName) => {
  return COUNTRY_ISO_CODES[countryName] || null;
};

/**
 * Search for symbols across all countries or specific countries
 * @param {string} query - Search query (symbol, name, etc.)
 * @param {string|null} country - Specific country to search in, or null for all
 * @param {number} limit - Maximum number of results to return
 * @returns {Promise<Array>} - Array of matching symbols
 */
const searchStocks = async (query, country = null, limit = 50) => {
  console.debug(`Searching for "${query || 'all symbols'}" in country: ${country || 'all'}`);
  
  // If query is empty and country is not null, return all symbols for that country
  // Otherwise, require at least 2 characters for search
  if (query.length < 2 && !(!query && country)) {
    return [];
  }
  
  try {
    let allSymbols = [];
    
    if (country) {
      // If a specific country is selected, load symbols for that country
      const countrySymbols = await loadSymbolsForCountry(country);
      allSymbols = [...countrySymbols];
      console.debug(`Loaded ${countrySymbols.length} symbols for ${country}`);
    } else {
      // If no country is selected, load symbols for all available countries
      const countries = getAvailableCountries();
      console.debug(`Loading symbols for all countries: ${countries.join(', ')}`);
      
      for (const c of countries) {
        try {
          const countrySymbols = await loadSymbolsForCountry(c);
          allSymbols = [...allSymbols, ...countrySymbols];
        } catch (error) {
          console.error(`Error loading symbols for ${c}:`, error);
        }
      }
    }
    
    console.debug(`Total symbols loaded: ${allSymbols.length}`);
    
    // If query is empty, return all symbols without filtering (for country-specific views)
    if (!query) {
      console.debug(`Returning all ${Math.min(allSymbols.length, limit)} symbols without filtering`);
      return allSymbols.slice(0, limit).map((symbol, index) => ({
        ...symbol,
        uniqueId: `${symbol.Symbol}-${symbol.Country || 'unknown'}-${index}`
      }));
    }
    
    // Filter symbols based on the query (case insensitive)
    const normalizedQuery = query.toLowerCase();
    
    const filteredSymbols = allSymbols.filter(symbol => {
      const symbolMatch = symbol.Symbol && symbol.Symbol.toLowerCase().includes(normalizedQuery);
      const nameMatch = symbol.Name && symbol.Name.toLowerCase().includes(normalizedQuery);
      return symbolMatch || nameMatch;
    });
    
    console.debug(`Found ${filteredSymbols.length} matching symbols for query "${query}"`);
    
    // Return limited results with unique identifiers
    return filteredSymbols.slice(0, limit).map((symbol, index) => ({
      ...symbol,
      uniqueId: `${symbol.Symbol}-${symbol.Country || 'unknown'}-${index}`
    }));
  } catch (error) {
    console.error('Error searching stocks:', error);
    return [];
  }
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
  
  console.debug(`Preloading data for ${popularCountries.length} popular markets...`);
  
  if (popularCountries.length === 0) {
    console.debug('No popular markets available for preloading. Skipping.');
    return;
  }
  
  // Load data for each country one at a time (instead of in parallel)
  // This might be more reliable than parallel loading
  for (const country of popularCountries) {
    try {
      console.debug(`Loading ${country} symbols...`);
      const symbols = await loadSymbolsForCountry(country);
      console.debug(`✓ Loaded ${symbols.length} ${country} symbols`);
    } catch (error) {
      console.error(`× Failed to load ${country} symbols:`, error);
    }
  }
  
  console.debug('Preloading complete');
};

export {
  searchStocks,
  getAvailableCountries,
  getSymbolDetails,
  getCountrySymbolCounts,
  preloadPopularCountries,
  detectAvailableCountries,
  COUNTRY_ISO_CODES
};