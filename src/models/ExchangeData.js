/**
 * Exchange data mapping for countries and their stock exchanges
 * Dynamically generated from country_summary_20250304_171206.json
 */

import countrySummaryData from '@/symbols_data/country_summary_20250304_171206.json';

// Dynamically generate map of country names to their exchange codes
const generateCountryExchanges = () => {
  const exchanges = {};
  
  // Process each country in the summary data
  Object.entries(countrySummaryData).forEach(([country, data]) => {
    if (data && data.Exchanges) {
      // Extract exchange codes for each country
      exchanges[country] = Object.keys(data.Exchanges);
    }
  });
  
  return exchanges;
};

// Map of country names to their exchange codes
export const COUNTRY_EXCHANGES = generateCountryExchanges();

// Map of exchange codes to their country names (reverse mapping)
export const EXCHANGE_COUNTRIES = Object.entries(COUNTRY_EXCHANGES).reduce((acc, [country, exchanges]) => {
  exchanges.forEach(exchange => {
    acc[exchange] = country;
  });
  return acc;
}, {});

// Function to get exchange code from country name
export function getExchangeForCountry(country) {
  if (!country) return null;
  const exchanges = COUNTRY_EXCHANGES[country];
  return exchanges ? exchanges[0] : null; // Return the first/primary exchange for the country
}

// Function to get country name from exchange code
export function getCountryForExchange(exchange) {
  if (!exchange) return null;
  return EXCHANGE_COUNTRIES[exchange] || null;
}
