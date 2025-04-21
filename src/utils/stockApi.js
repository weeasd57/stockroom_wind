import { COUNTRY_ISO_CODES } from '@/models/CurrencyData.js';
import { BASE_URL, API_KEY } from '@/models/StockApiConfig';
import { getExchangeForCountry } from '@/models/ExchangeData';

/**
 * Generate URL for EOD API call with last_close filter
 * 
 * Example: https://eodhd.com/api/eod/esrs.egx?filter=last_close&api_token=API_KEY&fmt=json
 */
export function generateEodLastCloseUrl(symbol, country) {
  if (!symbol) return '';
  
  // Check if symbol already includes an exchange code (e.g., AFMC.EGX)
  const parts = symbol.split('.');
  if (parts.length > 1) {
    // Symbol already has exchange code, use it as is
    return `${BASE_URL}/eod/${symbol}?filter=last_close&api_token=${API_KEY}&fmt=json`;
  }
  
  // Get the exchange code for the country
  let exchangeCode = '';
  
  if (country) {
    // Try to get the exchange from our mapping
    const exchange = getExchangeForCountry(country);
    if (exchange) {
      exchangeCode = exchange.toLowerCase();
    } else {
      // Fallback to country ISO code if exchange not found
      exchangeCode = COUNTRY_ISO_CODES[country] || country.toLowerCase();
    }
  }
  
  // Format the symbol with exchange
  let formattedSymbol;
  if (exchangeCode) {
    // For Egypt stocks like ESRS on EGX: esrs.egx
    formattedSymbol = `${symbol}.${exchangeCode}`;
  } else {
    // For US stocks (default): aapl
    formattedSymbol = symbol;
  }
  
  // Generate URL with API key and last_close filter
  return `${BASE_URL}/eod/${formattedSymbol}?filter=last_close&api_token=${API_KEY}&fmt=json`;
}

/**
 * Get exchange code for a symbol and country
 */
export function getExchangeCode(symbol, country) {
  if (!country) return null;
  return getExchangeForCountry(country);
}
