// Stock API utilities for EODHD API
const API_KEY = process.env.EODHD_API_KEY;
const BASE_URL = "https://eodhd.com/api";
import countrySummary from '../symbols_data/country_summary_20250304_171206.json';

// Get countries from our country summary data
const countries = Object.keys(countrySummary);

// Get exchange code for a country - using country summary data
const getExchangeCodeForCountry = (country) => {
  if (!country || country === 'all') return null;
  
  const countryData = countrySummary[country];
  if (!countryData || !countryData.Exchanges) return null;
  
  // Get the first exchange code for the country
  const exchangeCodes = Object.keys(countryData.Exchanges);
  return exchangeCodes.length > 0 ? exchangeCodes[0] : null;
};

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
    // Filter out any Israeli stocks
    return data
      .filter(stock => !stock.Name?.includes('Israel') && !stock.Description?.includes('Israel'))
      .map(stock => ({
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
 * Get the stock price using local data instead of API calls
 * @param {string} symbol - The stock symbol
 * @param {string} country - The country name
 * @returns {Promise<Object>} - Object with close price
 */
async function getStockPrice(symbol, country) {
  try {
    console.log(`Getting mock price for ${symbol} (${country})`);
    
    // Instead of making API calls, return a realistic mock price
    // Generate a price between $10 and $500
    const basePrice = Math.floor(Math.random() * 490) + 10;
    const cents = Math.floor(Math.random() * 100);
    const mockPrice = basePrice + (cents / 100);
    
    console.log(`Generated mock price: $${mockPrice.toFixed(2)}`);
    
    // Return the price in the expected format
    return { close: mockPrice };
  } catch (error) {
    console.error('Error generating mock price:', error);
    // Return a fallback price
    return { close: 100.00 };
  }
}

/**
 * Get logo URL for a stock - uses placeholder instead of API call
 * @param {string} symbol - The stock symbol
 * @param {string} country - The country name
 * @returns {Promise<string>} - The logo URL
 */
async function getStockLogo(symbol, country) {
  try {
    console.log(`Getting placeholder logo for ${symbol}`);
    
    // Return a placeholder logo based on the first letter of the symbol
    const firstLetter = symbol.charAt(0).toUpperCase();
    const logoColor = getColorFromSymbol(symbol);
    
    // Return a placeholder logo URL that generates an SVG with the symbol's first letter
    return `https://ui-avatars.com/api/?name=${firstLetter}&background=${logoColor}&color=fff&size=128`;
  } catch (error) {
    console.error('Error getting stock logo:', error);
    // Return a default placeholder
    return 'https://ui-avatars.com/api/?name=S&background=0D8ABC&color=fff';
  }
}

/**
 * Generate a consistent color based on a symbol
 * @param {string} symbol - The stock symbol
 * @returns {string} - Hex color code without the #
 */
function getColorFromSymbol(symbol) {
  // Generate a consistent hash from the symbol
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Convert to a hex color (without the #)
  let color = Math.abs(hash).toString(16).substring(0, 6);
  while (color.length < 6) {
    color = '0' + color;
  }
  
  return color;
}

export { searchStocks, getStockPrice, getStockLogo, generateEodUrl, countries };
