// Stock API utilities for EODHD API
const API_KEY = " 67d3b2c25148e7.65584806";
const BASE_URL = "https://eodhd.com/api";
import exchangesData from '../exchanges.json';

// Get unique countries from exchanges data
const getUniqueCountries = () => {
  const countries = new Set();
  exchangesData.forEach(exchange => {
    if (exchange.Country) {
      countries.add(exchange.Country);
    }
  });
  return Array.from(countries).sort();
};

// Get exchange code for a country
const getExchangeCodeForCountry = (country) => {
  const exchange = exchangesData.find(ex => ex.Country === country);
  return exchange ? exchange.Code : null;
};

// Get list of countries
const countries = getUniqueCountries();

/**
 * Search for stocks by name or symbol
 * @param {string} query - The search query
 * @returns {Promise<Array>} - Array of matching stocks
 */
async function searchStocks(query) {
  if (!query || query.length < 2) {
    return [];
  }

  try {
    // Use the search endpoint to get actual stock results
    const url = `${BASE_URL}/search/${query}?api_token=${API_KEY}&fmt=json`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to search stocks: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Transform the API response to match our expected format
    return data.map(stock => ({
      Code: stock.Code || stock.Symbol,
      Name: stock.Name || stock.Description,
      Country: stock.Country || 'Unknown',
      Exchange: stock.Exchange || stock.ExchangeCode
    }));
  } catch (error) {
    console.error('Error searching stocks:', error);
    return [];
  }
}

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayDate() {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

/**
 * Generate EOD API URL for a stock
 * @param {string} symbol - The stock symbol
 * @param {string} country - The country name
 * @returns {string} - The API URL
 */
function generateEodUrl(symbol, country) {
  const exchangeCode = country ? getExchangeCodeForCountry(country) : null;
  const fullSymbol = exchangeCode 
    ? `${symbol}.${exchangeCode}`
    : symbol;
  const today = getTodayDate();
  return `${BASE_URL}/eod/${fullSymbol}?from=${today}&to=${today}&period=d&api_token=${API_KEY}&fmt=json`;
}

/**
 * Get the stock price using EOD endpoint
 * @param {string} symbol - The stock symbol
 * @param {string} country - The country name
 * @returns {Promise<number>} - The current price
 */
async function getStockPrice(symbol, country) {
  try {
    const url = generateEodUrl(symbol, country);
    console.log(`Fetching stock price for ${symbol}`);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch price: ${response.statusText}`);
    }
    
    const data = await response.json();
    // Return the latest price from the EOD data
    if (Array.isArray(data) && data.length > 0) {
      const latestData = data[data.length - 1];
      return latestData.close;
    }
    
    // If no data available for today, try getting real-time price
    const realtimeUrl = `${BASE_URL}/real-time/${symbol}?api_token=${API_KEY}&fmt=json`;
    const realtimeResponse = await fetch(realtimeUrl);
    
    if (!realtimeResponse.ok) {
      throw new Error(`Failed to fetch realtime price: ${realtimeResponse.statusText}`);
    }
    
    const realtimeData = await realtimeResponse.json();
    return realtimeData.close;
  } catch (error) {
    console.error('Error fetching stock price:', error);
    return null;
  }
}

/**
 * Get logo URL for a stock
 * @param {string} symbol - The stock symbol
 * @param {string} country - The country name
 * @returns {Promise<string>} - The logo URL
 */
async function getStockLogo(symbol, country) {
  try {
    const fullSymbol = country ? `${symbol}.${getExchangeCodeForCountry(country)}` : symbol;
      
    const url = `${BASE_URL}/fundamentals/${fullSymbol}?api_token=${API_KEY}&fmt=json`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch logo: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.General?.LogoURL || null;
  } catch (error) {
    console.error('Error fetching stock logo:', error);
    return null;
  }
}

export { searchStocks, getStockPrice, getStockLogo, generateEodUrl, countries };
