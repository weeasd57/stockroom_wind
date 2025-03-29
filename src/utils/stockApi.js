// Stock API utilities for EODHD API
const API_KEY = process.env.NEXT_PUBLIC_EOD_API_KEY ; // استخدام القيمة الاحتياطية إذا لم يتم تعيين المتغير البيئي
const BASE_URL = "https://eodhd.com/api";
import countrySummary from '../symbols_data/country_summary_20250304_171206.json';
import { EXCHANGE_MAP, formatSymbolForApi, getExchangeCodeFromData } from './symbolUtils';

// Get countries from our country summary data
const countries = Object.keys(countrySummary);

// Get exchange code for a country - using country summary data
const getExchangeCodeForCountry = (country) => {
  if (!country || country === 'all') return null;
  
  // First try to get from countrySummary
  const countryData = countrySummary[country];
  if (countryData && countryData.Exchanges) {
    // Get the exchange with the most symbols
    let primaryExchange = null;
    let maxSymbols = 0;
    
    Object.entries(countryData.Exchanges).forEach(([exchange, count]) => {
      if (count > maxSymbols) {
        maxSymbols = count;
        primaryExchange = exchange;
      }
    });
    
    if (primaryExchange) return primaryExchange;
  }
  
  // If not found in summary, check if it's a country code in our exchange map
  if (country.length === 2 && EXCHANGE_MAP[country.toLowerCase()]) {
    return EXCHANGE_MAP[country.toLowerCase()];
  }
  
  return null;
};

/**
 * Generate EOD API URL for a stock with last_close filter
 * @param {string} symbol - The stock symbol
 * @param {string} country - The country name
 * @returns {string} - The API URL using last_close filter
 */
export function generateEodLastCloseUrl(symbol, country) {
  let formattedSymbol = symbol;
  
  // Check if the symbol already contains an exchange code (has a period)
  if (!symbol.includes('.') && country) {
    formattedSymbol = formatSymbolForApi(symbol, country);
    console.log(`Stock API: Formatted ${symbol} with country ${country} to ${formattedSymbol}`);
  } else {
    console.log(`Stock API: Using symbol as-is: ${symbol}`);
  }
  
  // تعديل استخدام مفتاح API لاستخدام المتغير المعرف في أعلى الملف
  const url = `${BASE_URL}/eod/${formattedSymbol}?filter=last_close&api_token=${API_KEY}&fmt=json`;
  console.log(`Generated API URL: ${url}`);
  return url;
}

export {
  countries,
  BASE_URL,
  API_KEY,
  getExchangeCodeForCountry
};







