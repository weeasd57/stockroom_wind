import { COUNTRY_ISO_CODES } from '@/models/CurrencyData.js';
import { COUNTRY_CODE_TO_NAME } from '@/models/CountryData';
let countrySummaryData = null;

// Cache object for symbol data
const symbolDataCache = new Map();
const countrySymbolsCache = new Map();

// Lazy-load country summary JSON at runtime and cache it
let countrySummaryLoadedPromise = null;
async function ensureCountrySummaryLoaded() {
  if (countrySummaryData) return countrySummaryData;
  if (!countrySummaryLoadedPromise) {
    countrySummaryLoadedPromise = (async () => {
      const _dbgStart = Date.now();
      console.warn('[symbolSearch] load country summary -> start');
      const response = await fetch('/symbols_data/country_summary_20250304_171206.json');
      console.warn('[symbolSearch] load country summary <- end', { status: response.status, ms: Date.now() - _dbgStart });
      if (!response.ok) {
        throw new Error('Failed to load country summary');
      }
      const json = await response.json();
      countrySummaryData = json;
      return json;
    })().catch(err => {
      countrySummaryLoadedPromise = null;
      throw err;
    });
  }
  return countrySummaryLoadedPromise;
}

/**
 * Converts between country name and ISO code as needed
 */
const getCountryMapping = (countryInput) => {
  // Handle empty input
  if (!countryInput) return null;
  
  // If input is an ISO code (2 letters), convert to country name
  if (countryInput.length === 2) {
    const countryName = COUNTRY_CODE_TO_NAME[countryInput.toLowerCase()];
    return countryName || countryInput;
  }
  
  // Input is already a country name
  return countryInput;
};

/**
 * Helper to build the exact country file name as it exists under public/symbols_data
 * Keeps original casing and spaces to match real filenames, and URL-encodes when fetching.
 */
const getCountryFilenameSafe = (countryName) => {
  const dateSuffix = '_20250304_171206';
  
  // Exact match in summary (preserves original casing and spaces)
  if (countrySummaryData[countryName]) {
    return `${countryName}_all_symbols${dateSuffix}`;
  }
  
  // Case-insensitive match in summary
  const matchingKey = Object.keys(countrySummaryData).find(
    (key) => key.toLowerCase() === String(countryName).toLowerCase()
  );
  if (matchingKey) {
    return `${matchingKey}_all_symbols${dateSuffix}`;
  }
  
  // If ISO code provided, convert to country name
  if (typeof countryName === 'string' && countryName.length === 2) {
    const fromCode = COUNTRY_CODE_TO_NAME[countryName.toLowerCase()];
    if (fromCode) {
      return `${fromCode}_all_symbols${dateSuffix}`;
    }
  }
  
  // Last resort: use the input as-is
  return `${countryName}_all_symbols${dateSuffix}`;
};

/**
 * Search for stock symbols in local data files
 * @param {string} query
 * @param {string | null | undefined} [country]
 * @param {number} [limit]
 * @returns {Promise<Array<{Symbol: string, Name?: string, Exchange?: string, Country: string, uniqueId?: string}>>}
 */
export async function searchStocks(query, country = null, limit = 50) {
  try {
    // Ensure summary is loaded before using it
    await ensureCountrySummaryLoaded();
    // Convert country code to name if needed
    const countryName = getCountryMapping(country);
    console.log(`Searching for symbols in country: ${countryName || 'All Countries'}`);
    
    // If searching in a specific country, load that country's data
    if (countryName) {
      try {
        // First try to load country symbols directly from the file
        console.log(`Loading symbols for ${countryName} from file`);
        
        // Check if we have data for this country in the country summary
        const countrySummaryKey = Object.keys(countrySummaryData).find(
          key => key.toLowerCase() === countryName.toLowerCase()
        );
        
        if (!countrySummaryKey) {
          console.warn(`No symbol data available for ${countryName}`);
          return [{
            Symbol: `No symbols available for ${countryName}`,
            Name: "Please try another country",
            Country: country,
            Exchange: "",
            uniqueId: "no-symbols-message"
          }];
        }
        
        // Attempt to load country symbols from cache first
        if (countrySymbolsCache.has(countrySummaryKey)) {
          console.log(`Using cached symbols for ${countrySummaryKey}`);
          const cachedSymbols = countrySymbolsCache.get(countrySummaryKey);
          
          // If no query, return all symbols (up to limit)
          if (!query || query.length < 2) {
            return cachedSymbols.slice(0, limit);
          }
          
          // Filter by query
          const normalizedQuery = query.toLowerCase();
          return cachedSymbols
            .filter(stock => 
              (stock.Symbol || '').toLowerCase().includes(normalizedQuery) || 
              (stock.Name || '').toLowerCase().includes(normalizedQuery)
            )
            .slice(0, limit);
        }
        
        // Not in cache, try to load from file
        try {
          // Convert country name to format used in file names
          const fileCountryName = getCountryFilenameSafe(countrySummaryKey);
          const _dbgStart2 = Date.now();
          console.warn('[symbolSearch] load country symbols -> start', { file: fileCountryName });
          const response = await fetch(`/symbols_data/${encodeURIComponent(fileCountryName)}.json`);
          console.warn('[symbolSearch] load country symbols <- end', { file: fileCountryName, status: response.status, ms: Date.now() - _dbgStart2 });
          
          if (!response.ok) {
            throw new Error(`Failed to load symbols for ${countrySummaryKey} (${response.status})`);
          }
          
          const symbolsData = await response.json();
          
          // Process symbols data and add unique IDs
          const processedSymbols = symbolsData.map((item, index) => {
            const symbol = item.Symbol || item.symbol || '';
            const name = item.Name || item.name || '';
            const exchange = item.Exchange || item.exchange || '';
            const countryCode = (COUNTRY_ISO_CODES[countrySummaryKey] || (country && country.length === 2 ? country : '') || countrySummaryKey).toLowerCase();
            return {
              Symbol: symbol,
              Name: name,
              Exchange: exchange,
              Country: countryCode,
              uniqueId: `${symbol}-${countryCode}-${index}`
            };
          });
          
          // Cache the processed symbols
          countrySymbolsCache.set(countrySummaryKey, processedSymbols);
          console.log(`Loaded ${processedSymbols.length} symbols for ${countrySummaryKey}`);
          
          // If no query, return all symbols (up to limit)
          if (!query || query.length < 2) {
            return processedSymbols.slice(0, limit);
          }
          
          // Filter by query
          const normalizedQuery = query.toLowerCase();
          return processedSymbols
            .filter(stock => 
              (stock.Symbol || '').toLowerCase().includes(normalizedQuery) || 
              (stock.Name || '').toLowerCase().includes(normalizedQuery)
            )
            .slice(0, limit);
        } catch (fileError) {
          console.error(`Error loading country symbols file: ${fileError.message}`);
          
          // Try to load from all_symbols_by_country file
          console.log(`Attempting to load ${countryName} symbols from all_symbols_by_country file`);
          try {
            const _dbgStart3 = Date.now();
            console.warn('[symbolSearch] load all_symbols_by_country -> start');
            const allSymbolsResponse = await fetch(`/symbols_data/all_symbols_by_country_20250304_171206.json`);
            console.warn('[symbolSearch] load all_symbols_by_country <- end', { status: allSymbolsResponse.status, ms: Date.now() - _dbgStart3 });
            
            if (!allSymbolsResponse.ok) {
              throw new Error(`Failed to load all_symbols_by_country file (${allSymbolsResponse.status})`);
            }
            
            const allSymbolsData = await allSymbolsResponse.json();
            
            // Filter symbols for the requested country
            const countrySymbols = allSymbolsData.filter(item => 
              item.Country && item.Country.toLowerCase() === countryName.toLowerCase()
            );
            
            if (countrySymbols.length === 0) {
              console.warn(`No symbols found for ${countryName} in all_symbols_by_country file`);
              return [{
                Symbol: `No symbols found for ${countryName}`,
                Name: "Try another country or check spelling",
                Country: country,
                Exchange: "",
                uniqueId: "no-symbols-message"
              }];
            }
            
            console.log(`Found ${countrySymbols.length} symbols for ${countryName} in all_symbols_by_country file`);
            
            // Process data to ensure consistent format
            const processedSymbols = countrySymbols.map((item, index) => {
              const symbol = item.Symbol || item.symbol || '';
              const name = item.Name || item.name || '';
              const exchange = item.Exchange || item.exchange || '';
              const code = (COUNTRY_ISO_CODES[countryName] || (country && country.length === 2 ? country : '') || countryName).toLowerCase();
              return {
                Symbol: symbol,
                Name: name,
                Exchange: exchange,
                Country: code,
                uniqueId: `${symbol}-${code}-${index}`
              };
            });
            
            // Cache the processed data
            countrySymbolsCache.set(countryName, processedSymbols);
            
            // If no query, return all symbols (up to limit)
            if (!query || query.length < 2) {
              return processedSymbols.slice(0, limit);
            }
            
            // Filter by query
            const normalizedQuery = query.toLowerCase();
            return processedSymbols
              .filter(stock => 
                (stock.Symbol || '').toLowerCase().includes(normalizedQuery) || 
                (stock.Name || '').toLowerCase().includes(normalizedQuery)
              )
              .slice(0, limit);
          } catch (allSymbolsError) {
            console.error(`Error loading from all_symbols_by_country file: ${allSymbolsError.message}`);
            
            // Return friendly error message as a result
            return [{
              Symbol: `Could not load symbols for ${countryName}`,
              Name: fileError.message,
              Country: country,
              Exchange: "",
              uniqueId: "error-message"
            }];
          }
        }
      } catch (countryError) {
        console.error(`Error handling country symbols: ${countryError.message}`);
        throw countryError;
      }
    }

    // If no specific country or query is too short, return limited results
    if (!query || query.length < 2) {
      // For empty queries, return a message prompting more specific search
      return [{
        Symbol: "Please enter at least 2 characters",
        Name: "Or select a specific country",
        Country: "all",
        Exchange: "",
        uniqueId: "empty-query-message"
      }];
    }

    // Search across all countries if no specific country
    console.log(`Searching across all countries for: ${query}`);
    const results = [];
    const normalizedQuery = query.toLowerCase();
    const searchPromises = [];
    
    // Look for matching countries in the summary data
    for (const countryKey of Object.keys(countrySummaryData || {})) {
      if (results.length >= limit) break;
      
      // Skip countries with no symbols
      if (!countrySummaryData[countryKey].TotalSymbols) continue;
      
      // Create a promise to search this country's symbols
      searchPromises.push(
        (async () => {
          try {
            // Only load country data if not in cache
            if (!countrySymbolsCache.has(countryKey)) {
              try {
                // Convert country name to format used in file names
                const fileCountryName = getCountryFilenameSafe(countryKey);
                const _dbgStart4 = Date.now();
                console.warn('[symbolSearch] bulk load country -> start', { file: fileCountryName });
                const response = await fetch(`/symbols_data/${encodeURIComponent(fileCountryName)}.json`);
                console.warn('[symbolSearch] bulk load country <- end', { file: fileCountryName, status: response.status, ms: Date.now() - _dbgStart4 });
                
                if (!response.ok) {
                  throw new Error(`Failed to load symbols for ${countryKey} (${response.status})`);
                }
                
                const symbolsData = await response.json();
                
                // Process symbols data and add unique IDs with normalized fields
                const processedSymbols = symbolsData.map((item, index) => {
                  const symbol = item.Symbol || item.symbol || '';
                  const name = item.Name || item.name || '';
                  const exchange = item.Exchange || item.exchange || '';
                  const code = (COUNTRY_ISO_CODES[countryKey] || countryKey).toLowerCase();
                  return {
                    Symbol: symbol,
                    Name: name,
                    Exchange: exchange,
                    Country: code,
                    uniqueId: `${symbol}-${code}-${index}`
                  };
                });
                
                // Cache the processed symbols
                countrySymbolsCache.set(countryKey, processedSymbols);
                console.log(`Loaded ${processedSymbols.length} symbols for ${countryKey}`);
                
                // Filter by query
                const countryResults = processedSymbols
                  .filter(stock => 
                    (stock.Symbol || '').toLowerCase().includes(normalizedQuery) || 
                    (stock.Name || '').toLowerCase().includes(normalizedQuery)
                  )
                  .slice(0, Math.max(5, Math.ceil(limit / Object.keys(countrySummaryData).length)));
                
                return countryResults;
              } catch (fileError) {
                console.warn(`Could not load symbols for ${countryKey}: ${fileError.message}`);
                return [];
              }
            } else {
              // Use cached symbols
              const cachedSymbols = countrySymbolsCache.get(countryKey);
              
              // Filter by query
              const countryResults = cachedSymbols
                .filter(stock => 
                  (stock.Symbol || '').toLowerCase().includes(normalizedQuery) || 
                  (stock.Name || '').toLowerCase().includes(normalizedQuery)
                )
                .slice(0, Math.max(5, Math.ceil(limit / Object.keys(countrySummaryData).length)));
              
              return countryResults;
            }
          } catch (error) {
            console.error(`Error searching in ${countryKey}: ${error.message}`);
            return [];
          }
        })()
      );
    }
    
    // Wait for all promises to resolve
    const searchResults = await Promise.all(searchPromises);
    
    // Combine and flatten results
    const flatResults = searchResults.flat();
    
    // If no results, return a message
    if (flatResults.length === 0) {
      return [{
        Symbol: `No symbols found for "${query}"`,
        Name: "Try a different search term or select a specific country",
        Country: "all",
        Exchange: "",
        uniqueId: "no-results-message"
      }];
    }
    
    return flatResults.slice(0, limit);
  } catch (error) {
    console.error('Error searching stocks:', error);
    return [{
      Symbol: "Error searching symbols",
      Name: error.message,
      Country: "error",
      Exchange: "",
      uniqueId: "search-error-message"
    }];
  }
}

/**
 * Load symbols data for a specific country
 */
async function loadCountrySymbols(country) {
  // Check cache first
  if (countrySymbolsCache.has(country)) {
    return countrySymbolsCache.get(country);
  }

  await ensureCountrySummaryLoaded();
  try {
    // Use the safe filename helper to get the proper filename format
    const fileCountryName = getCountryFilenameSafe(country);
    let _dbgStart5 = Date.now();
    console.warn('[symbolSearch] load specific country -> start', { file: fileCountryName });
    let response = await fetch(`/symbols_data/${encodeURIComponent(fileCountryName)}.json`);
    console.warn('[symbolSearch] load specific country <- end', { file: fileCountryName, status: response.status, ms: Date.now() - _dbgStart5 });
    
    // If country-specific file not found, try to extract from all_symbols_by_country file
    if (!response.ok) {
      console.log(`Country file not found for ${country}, trying to extract from all_symbols_by_country file`);
      
      // Get the all_symbols_by_country file
      const _dbgStart6 = Date.now();
      console.warn('[symbolSearch] fallback load all_symbols_by_country -> start');
      const allSymbolsResponse = await fetch(`/symbols_data/all_symbols_by_country_20250304_171206.json`);
      console.warn('[symbolSearch] fallback load all_symbols_by_country <- end', { status: allSymbolsResponse.status, ms: Date.now() - _dbgStart6 });
      
      if (!allSymbolsResponse.ok) {
        throw new Error(`Failed to load all_symbols_by_country file (${allSymbolsResponse.status})`);
      }
      
      const allSymbolsData = await allSymbolsResponse.json();
      
      // Filter symbols for the requested country
      const countrySymbols = allSymbolsData.filter(item => 
        item.Country && item.Country.toLowerCase() === country.toLowerCase()
      );
      
      if (countrySymbols.length === 0) {
        console.warn(`No symbols found for ${country} in all_symbols_by_country file`);
        return null;
      }
      
      console.log(`Found ${countrySymbols.length} symbols for ${country} in all_symbols_by_country file`);
      
      // Process data to ensure consistent format and ISO country code (lowercase)
      const processedData = countrySymbols.map((item, index) => {
        const symbol = item.Symbol || item.symbol || '';
        const name = item.Name || item.name || '';
        const exchange = item.Exchange || item.exchange || '';
        const code = (COUNTRY_ISO_CODES[country] || (typeof country === 'string' && country.length === 2 ? country : country)).toLowerCase();
        return {
          Symbol: symbol,
          Name: name,
          Exchange: exchange,
          Country: code,
          uniqueId: `${symbol}-${code}-${index}`
        };
      });
      
      // Cache the processed data
      countrySymbolsCache.set(country, processedData);
      
      return processedData;
    }

    // If we got here, the country-specific file was found
    const data = await response.json();
    
    // Process data to ensure consistent format and ISO country code (lowercase)
    const processedData = data.map((item, index) => {
      const symbol = item.Symbol || item.symbol || '';
      const name = item.Name || item.name || '';
      const exchange = item.Exchange || item.exchange || '';
      const code = (COUNTRY_ISO_CODES[country] || (typeof country === 'string' && country.length === 2 ? country : country)).toLowerCase();
      return {
        Symbol: symbol,
        Name: name,
        Exchange: exchange,
        Country: code,
        uniqueId: `${symbol}-${code}-${index}`
      };
    });
    
    // Cache the processed data
    countrySymbolsCache.set(country, processedData);
    console.log(`Loaded ${processedData.length} symbols for ${country}`);
    
    return processedData;
  } catch (error) {
    console.error(`Error loading symbols for ${country}:`, error);
    return null;
  }
}

/**
 * Load country summary data
 */
async function loadCountrySummary() {
  try {
    const _dbgStart7 = Date.now();
    console.warn('[symbolSearch] getCountrySymbolCounts -> load summary start');
    const response = await fetch('/symbols_data/country_summary_20250304_171206.json');
    console.warn('[symbolSearch] getCountrySymbolCounts <- load summary end', { status: response.status, ms: Date.now() - _dbgStart7 });
    if (!response.ok) {
      throw new Error('Failed to load country summary');
    }
    return await response.json();
  } catch (error) {
    console.error('Error loading country summary:', error);
    return null;
  }
}
/**
 * Get symbol counts by country from local data
 */
export async function getCountrySymbolCounts() {
  await ensureCountrySummaryLoaded();
  const counts = {};
  let total = 0;
  
  // Process the country summary data
  Object.keys(countrySummaryData || {}).forEach(country => {
    // Convert country names to ISO codes
    const countryData = countrySummaryData[country];
    const isoCode = COUNTRY_ISO_CODES[country] || country.toLowerCase();
    
    if (countryData && countryData.TotalSymbols) {
      counts[isoCode] = countryData.TotalSymbols;
      total += countryData.TotalSymbols;
    }
  });
  
  counts.total = total;
  // Add 'all' alias so UIs expecting it (e.g., CreatePostForm) render totals correctly
  counts.all = total;
  return counts;
}