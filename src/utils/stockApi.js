import { COUNTRY_ISO_CODES } from '@/models/CurrencyData';
import { BASE_URL, API_KEY } from '@/models/StockApiConfig';

/**
 * Generate URL for EOD API call
 */
export function generateEodLastCloseUrl(symbol, country) {
  if (!symbol) return '';
  
  // Add country code if provided
  const countryCode = country ? `${COUNTRY_ISO_CODES[country] || country.toLowerCase()}.` : '';
  const formattedSymbol = `${countryCode}${symbol}`.toUpperCase();
  
  // Generate URL with API key
  return `${BASE_URL}/eod/${formattedSymbol}?api_token=${API_KEY}&fmt=json&limit=1`;
}








