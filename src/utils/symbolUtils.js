import { COUNTRY_ISO_CODES } from '@/models/CurrencyData';
import { COUNTRY_CODE_TO_NAME } from '@/models/CountryData';

export function formatSymbolForApi(symbol, country) {
  if (!symbol) return '';
  
  // Add country code if provided
  const countryCode = country ? `${COUNTRY_ISO_CODES[country] || country.toLowerCase()}.` : '';
  return `${countryCode}${symbol}`.toUpperCase();
}

export function getExchangeCodeFromData(symbol, country) {
  // Convert country name to ISO code if needed
  let countryCode = country;
  if (country in COUNTRY_CODE_TO_NAME) {
    countryCode = country;
  } else {
    // Find ISO code by country name
    const found = Object.entries(COUNTRY_CODE_TO_NAME).find(
      ([_, name]) => name.toLowerCase() === country.toLowerCase()
    );
    if (found) {
      countryCode = found[0];
    }
  }
  
  return countryCode ? `${countryCode.toLowerCase()}.${symbol}` : symbol;
}

export async function getSymbolPriceFromLocalData(symbol, countryName) {
  try {
    // Handle country name conversion
    const countryCode = Object.entries(COUNTRY_ISO_CODES).find(
      ([name, _]) => name.toLowerCase() === countryName.toLowerCase()
    )?.[1];

    if (!countryCode) {
      console.warn(`No country code found for ${countryName}`);
      return null;
    }

    // Try to fetch from local data file
    const response = await fetch(`/symbols_data/${countryName}_all_symbols.json`);
    if (!response.ok) {
      throw new Error(`Failed to load symbol data for ${countryName}`);
    }

    const data = await response.json();
    const symbolData = data.find(item => 
      item.Symbol.toLowerCase() === symbol.toLowerCase()
    );

    if (!symbolData) {
      console.warn(`No data found for symbol ${symbol} in ${countryName}`);
      return null;
    }

    return {
      symbol: symbolData.Symbol,
      name: symbolData.Name,
      price: symbolData.Price || null,
      currency: symbolData.Currency,
      exchange: symbolData.Exchange
    };
  } catch (error) {
    console.error('Error getting symbol price from local data:', error);
    return null;
  }
}

export function getEodApiUrlParams(symbol, country) {
  const countryCode = country ? `${COUNTRY_ISO_CODES[country] || country.toLowerCase()}.` : '';
  const formattedSymbol = `${countryCode}${symbol}`.toUpperCase();
  
  return {
    symbol: formattedSymbol,
    countryCode: country?.toLowerCase() || '',
    exchange: countryCode ? countryCode.slice(0, -1) : ''
  };
}