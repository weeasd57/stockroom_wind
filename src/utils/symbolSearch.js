import { COUNTRY_ISO_CODES } from '@/models/CurrencyData.js';
import { COUNTRY_CODE_TO_NAME } from '@/models/CountryData';
import countrySummaryData from '@/symbols_data/country_summary_20250304_171206.json';

// Cache object for symbol data
const symbolDataCache = new Map();
const countrySymbolsCache = new Map();

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
 * Helper function to get standardized country file name format
 * with correct date suffix pattern
 */
const getCountryFilenameSafe = (countryName) => {
  // Date suffix pattern from the actual files
  const dateSuffix = '_20250304_171206';
  
  // First try to find direct mapping in countrySummaryData
  if (countrySummaryData[countryName]) {
    return `${countryName.toLowerCase().replace(/\s+/g, '_')}_all_symbols${dateSuffix}`;
  }
  
  // Look for a case-insensitive match in countrySummaryData
  const matchingKey = Object.keys(countrySummaryData).find(
    key => key.toLowerCase() === countryName.toLowerCase()
  );
  
  if (matchingKey) {
    return `${matchingKey.toLowerCase().replace(/\s+/g, '_')}_all_symbols${dateSuffix}`;
  }
  
  // If we have a country code, try to find its name in COUNTRY_ISO_CODES
  if (countryName.length === 2) {
    // Convert from code to country name
    for (const [name, code] of Object.entries(COUNTRY_ISO_CODES)) {
      if (code.toLowerCase() === countryName.toLowerCase()) {
        // Found a matching country name for this code
        return `${name.toLowerCase().replace(/\s+/g, '_')}_all_symbols${dateSuffix}`;
      }
    }
  }
  
  // If we have a country name, try to find matching code in COUNTRY_CODE_TO_NAME
  for (const [code, name] of Object.entries(COUNTRY_CODE_TO_NAME)) {
    if (name.toLowerCase() === countryName.toLowerCase()) {
      const matchedName = Object.keys(countrySummaryData).find(
        key => key.toLowerCase() === name.toLowerCase()
      );
      if (matchedName) {
        return `${matchedName.toLowerCase().replace(/\s+/g, '_')}_all_symbols${dateSuffix}`;
      }
    }
  }
  
  // Fallback: just use the input as is
  return `${countryName.toLowerCase().replace(/\s+/g, '_')}_all_symbols${dateSuffix}`;
};

/**
 * Search for stock symbols in local data files
 */
export async function searchStocks(query, country = null, limit = 50) {
  try {
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
              stock.Symbol.toLowerCase().includes(normalizedQuery) || 
              stock.Name.toLowerCase().includes(normalizedQuery)
            )
            .slice(0, limit);
        }
        
        // Not in cache, try to load from file
        try {
          // Convert country name to format used in file names
          const fileCountryName = getCountryFilenameSafe(countrySummaryKey);
          const response = await fetch(`/symbols_data/${fileCountryName}.json`);
          
          if (!response.ok) {
            throw new Error(`Failed to load symbols for ${countrySummaryKey} (${response.status})`);
          }
          
          const symbolsData = await response.json();
          
          // Process symbols data and add unique IDs
          const processedSymbols = symbolsData.map((item, index) => ({
            ...item,
            Country: countrySummaryKey,
            uniqueId: `${item.Symbol}-${countrySummaryKey}-${index}`
          }));
          
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
              stock.Symbol.toLowerCase().includes(normalizedQuery) || 
              stock.Name.toLowerCase().includes(normalizedQuery)
            )
            .slice(0, limit);
        } catch (fileError) {
          console.error(`Error loading country symbols file: ${fileError.message}`);
          
          // Try to load from all_symbols_by_country file
          console.log(`Attempting to load ${countryName} symbols from all_symbols_by_country file`);
          try {
            const allSymbolsResponse = await fetch(`/symbols_data/all_symbols_by_country_20250304_171206.json`);
            
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
            const processedSymbols = countrySymbols.map((item, index) => ({
              ...item,
              Country: countryName,
              uniqueId: `${item.Symbol || item.symbol}-${countryName}-${index}`
            }));
            
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
                stock.Symbol.toLowerCase().includes(normalizedQuery) || 
                stock.Name.toLowerCase().includes(normalizedQuery)
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
    for (const countryKey of Object.keys(countrySummaryData)) {
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
                const response = await fetch(`/symbols_data/${fileCountryName}.json`);
                
                if (!response.ok) {
                  throw new Error(`Failed to load symbols for ${countryKey} (${response.status})`);
                }
                
                const symbolsData = await response.json();
                
                // Process symbols data and add unique IDs
                const processedSymbols = symbolsData.map((item, index) => ({
                  ...item,
                  Country: countryKey,
                  uniqueId: `${item.Symbol}-${countryKey}-${index}`
                }));
                
                // Cache the processed symbols
                countrySymbolsCache.set(countryKey, processedSymbols);
                console.log(`Loaded ${processedSymbols.length} symbols for ${countryKey}`);
                
                // Filter by query
                const countryResults = processedSymbols
                  .filter(stock => 
                    stock.Symbol.toLowerCase().includes(normalizedQuery) || 
                    stock.Name.toLowerCase().includes(normalizedQuery)
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
                  stock.Symbol.toLowerCase().includes(normalizedQuery) || 
                  stock.Name.toLowerCase().includes(normalizedQuery)
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

  try {
    // Use the safe filename helper to get the proper filename format
    const fileCountryName = getCountryFilenameSafe(country);
    let response = await fetch(`/symbols_data/${fileCountryName}.json`);
    
    // If country-specific file not found, try to extract from all_symbols_by_country file
    if (!response.ok) {
      console.log(`Country file not found for ${country}, trying to extract from all_symbols_by_country file`);
      
      // Get the all_symbols_by_country file
      const allSymbolsResponse = await fetch(`/symbols_data/all_symbols_by_country_20250304_171206.json`);
      
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
      
      // Process data to ensure consistent format
      const processedData = countrySymbols.map((item, index) => ({
        ...item,
        Country: country,
        uniqueId: `${item.Symbol || item.symbol}-${country}-${index}`
      }));
      
      // Cache the processed data
      countrySymbolsCache.set(country, processedData);
      
      return processedData;
    }

    // If we got here, the country-specific file was found
    const data = await response.json();
    
    // Process data to ensure consistent format
    const processedData = data.map((item, index) => ({
      ...item,
      Country: country,
      uniqueId: `${item.Symbol || item.symbol}-${country}-${index}`
    }));
    
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
    const response = await fetch('/symbols_data/country_summary.json');
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
export function getCountrySymbolCounts() {
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
  
  counts.total = total;
  return counts;
}