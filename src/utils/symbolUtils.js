import { COUNTRY_ISO_CODES } from './symbolSearch';
import countrySummary from '../symbols_data/country_summary_20250304_171206.json';

// Exchange code mapping for countries (2-letter country codes to exchange codes)
const EXCHANGE_MAP = {
  'eg': 'EGX', // Egypt
  'us': 'US',  // USA
  'gb': 'LSE', // UK (London Stock Exchange)
  'ca': 'TO',  // Toronto
  'au': 'AX',  // Australia
  'de': 'DE',  // Germany
  'fr': 'PA',  // Paris
  'es': 'MC',  // Madrid
  'cn': 'SS',  // Shanghai
  'hk': 'HK',  // Hong Kong
  'in': 'NS',  // NSE India
  'jp': 'T',   // Tokyo
  'br': 'SA',  // Sao Paulo
  'mx': 'MX',  // Mexico
  'za': 'JO',  // Johannesburg
  'ch': 'SW',  // Switzerland
  'nl': 'AS',  // Netherlands (Amsterdam)
  'pt': 'LS',  // Portugal (Lisbon)
  'ie': 'IR',  // Ireland
  'fi': 'HE',  // Finland (Helsinki)
  'no': 'OL',  // Norway (Oslo)
  'dk': 'CO',  // Denmark (Copenhagen)
  'se': 'ST',  // Sweden (Stockholm)
  'at': 'VI',  // Austria (Vienna)
  'be': 'BR',  // Belgium
  'it': 'MI',  // Italy (Milan)
  'pl': 'WAR', // Poland
  'hu': 'BUD', // Hungary
  'cz': 'PR',  // Czech Republic
  'ru': 'ME',  // Russia
  'gr': 'AT',  // Greece (Athens)
  'tr': 'IS',  // Turkey (Istanbul)
  'kr': 'KO',  // Korea
  'id': 'JK',  // Indonesia
  'ph': 'PSE', // Philippines
  'th': 'BK',  // Thailand
  'sg': 'SI',  // Singapore
  'my': 'KL',  // Malaysia
  'ng': 'XNSA', // Nigeria
  'ke': 'XNAI', // Kenya
  'ma': 'BC',   // Morocco
  'gh': 'GSE',  // Ghana
  'zm': 'LUSE', // Zambia
  'ug': 'USE',  // Uganda
  'tz': 'DSE',  // Tanzania
  'rw': 'RSE',  // Rwanda
  'bw': 'XBOT', // Botswana
  'zw': 'XZIM', // Zimbabwe
  'is': 'IC',   // Iceland
  'lu': 'LU',   // Luxembourg
  'mu': 'SEM',  // Mauritius
  'mw': 'MSE'   // Malawi
};

/**
 * Helper function to format symbol for API calls
 * @param {string} symbol - The stock symbol
 * @param {string} country - The country name
 * @returns {string} Formatted symbol with exchange code
 */
const formatSymbolForApi = (symbol, country) => {
  // Return if symbol already has exchange code
  if (symbol.includes('.')) return symbol;
  
  // Handle specific country cases
  if (country === 'Egypt' || country.toLowerCase() === 'eg') {
    return `${symbol}.EGX`;
  }
  
  if (country === 'USA' || country === 'US' || country.toLowerCase() === 'us') {
    return `${symbol}.US`;
  }
  
  // Try to get exchange code from country summary or exchange map
  const exchangeCode = getExchangeCodeFromData(country);
  if (exchangeCode) {
    return `${symbol}.${exchangeCode}`;
  }
  
  // If we get here, try to lookup by 2-letter country code 
  if (country.length === 2) {
    const countryCode = country.toLowerCase();
    if (EXCHANGE_MAP[countryCode]) {
      return `${symbol}.${EXCHANGE_MAP[countryCode]}`;
    }
  }
  
  // For other countries, try to get exchange code from country name
  const countryCode = Object.entries(COUNTRY_ISO_CODES).find(
    ([countryName]) => countryName.toLowerCase() === country.toLowerCase()
  )?.[1]?.toLowerCase();
  
  // If we have an exchange code for this country, use it
  if (countryCode && EXCHANGE_MAP[countryCode]) {
    return `${symbol}.${EXCHANGE_MAP[countryCode]}`;
  }
  
  // If no specific exchange code, return symbol as is
  console.warn(`No exchange code found for country ${country}, returning symbol without exchange code`);
  return symbol;
};

/**
 * Gets the exchange code for a given country from the symbols_data files
 * @param {string} countryName - The country name
 * @returns {string|null} The exchange code or null if not found
 */
const getExchangeCodeFromData = (countryName) => {
  try {
    // Check if country exists in the country summary
    if (countrySummary[countryName]) {
      // Get the exchange code directly from the country summary
      const exchanges = countrySummary[countryName].Exchanges;
      if (exchanges && Object.keys(exchanges).length > 0) {
        // Find the exchange with the most symbols (likely the primary exchange)
        let primaryExchange = null;
        let maxSymbols = 0;
        
        Object.entries(exchanges).forEach(([exchange, count]) => {
          if (count > maxSymbols) {
            maxSymbols = count;
            primaryExchange = exchange;
          }
        });
        
        console.log(`Found primary exchange ${primaryExchange} for ${countryName} from country summary`);
        return primaryExchange;
      }
    }
    
    // If not found in country summary, use our known mapping
    const countryCode = Object.entries(COUNTRY_ISO_CODES).find(
      ([name]) => name.toLowerCase() === countryName.toLowerCase()
    )?.[1]?.toLowerCase();
    
    if (countryCode && EXCHANGE_MAP[countryCode]) {
      console.log(`Found exchange ${EXCHANGE_MAP[countryCode]} for ${countryName} from exchange map`);
      return EXCHANGE_MAP[countryCode];
    }
    
    console.warn(`No exchange code found for ${countryName}`);
    return null;
  } catch (error) {
    console.error('Error getting exchange code:', error);
    return null;
  }
};

/**
 * Asynchronously loads symbol data from local files for price information
 * @param {string} symbol - Symbol to look up
 * @param {string} country - Country name
 * @returns {Promise<Object|null>} Symbol data with price if available
 */
const getSymbolPriceFromLocalData = async (symbol, country) => {
  try {
    // Format the country name to match file naming
    const formattedCountry = country.replace(/\s/g, '_');
    const fileName = `${formattedCountry}_all_symbols_20250304_171206.json`;
    
    console.log(`Looking for ${symbol} price in ${fileName}`);
    
    // Import the symbols file for this country
    const module = await import(`../symbols_data/${fileName}`).catch(() => null);
    if (!module) {
      console.error(`No symbols file found for ${country}`);
      return null;
    }
    
    const symbols = module.default || [];
    const symbolData = symbols.find(s => s.Symbol === symbol || s.symbol === symbol);
    
    if (symbolData) {
      // Check if we have price data
      if (symbolData.close || symbolData.Close || symbolData.price || symbolData.Price) {
        return {
          symbol,
          country,
          price: symbolData.close || symbolData.Close || symbolData.price || symbolData.Price,
          date: symbolData.date || symbolData.Date || new Date().toISOString().split('T')[0],
          source: 'local',
          // Include other data if available
          high: symbolData.high || symbolData.High,
          low: symbolData.low || symbolData.Low,
          open: symbolData.open || symbolData.Open,
          volume: symbolData.volume || symbolData.Volume
        };
      }
    }
    
    console.log(`Symbol ${symbol} found but no price data available`);
    return null;
  } catch (error) {
    console.error(`Error getting price for ${symbol} from local data:`, error);
    return null;
  }
};

/**
 * Get URL parameters for EOD API based on country and exchange data
 * @param {string} symbol - The stock symbol
 * @param {string} country - The country name
 * @returns {string} The URL parameters
 */
const getEodApiUrlParams = (symbol, country) => {
  const formattedSymbol = formatSymbolForApi(symbol, country);
  const exchangeCode = getExchangeCodeFromData(country);
  
  // If we have an exchange code, construct the URL params
  if (exchangeCode) {
    return `symbol=${symbol}.${exchangeCode}`;
  }
  
  // Otherwise use the formatted symbol
  return `symbol=${formattedSymbol}`;
};

/**
 * Gets the main exchange code for a country from the country summary data
 * @param {string} countryName - The full country name
 * @returns {string|null} The primary exchange code or null if not found
 */
const getPrimaryExchangeCode = (countryName) => {
  try {
    // Check if country exists in the summary data
    if (countrySummary[countryName]) {
      const exchanges = countrySummary[countryName].Exchanges;
      if (exchanges && Object.keys(exchanges).length > 0) {
        // Find the exchange with the most symbols
        let primaryExchange = null;
        let maxSymbols = 0;
        
        Object.entries(exchanges).forEach(([exchange, count]) => {
          if (count > maxSymbols) {
            maxSymbols = count;
            primaryExchange = exchange;
          }
        });
        
        return primaryExchange;
      }
    }
    
    // If not found in country summary, fall back to the exchange map
    const countryCode = Object.entries(COUNTRY_ISO_CODES).find(
      ([name]) => name.toLowerCase() === countryName.toLowerCase()
    )?.[1]?.toLowerCase();
    
    return countryCode && EXCHANGE_MAP[countryCode] ? EXCHANGE_MAP[countryCode] : null;
  } catch (error) {
    console.error(`Error getting primary exchange code for ${countryName}:`, error);
    return null;
  }
};

export { 
  formatSymbolForApi, 
  getExchangeCodeFromData, 
  getSymbolPriceFromLocalData,
  getEodApiUrlParams,
  getPrimaryExchangeCode,
  EXCHANGE_MAP
}; 