/**
 * Exchange data mapping for countries and their stock exchanges
 * Generated from country_summary_20250304_171206.json
 */

// Map of country names to their exchange codes
export const COUNTRY_EXCHANGES = {
  "USA": ["US"],
  "UK": ["LSE", "IL"],
  "Canada": ["TO", "V", "NEO"],
  "Germany": ["BE", "HM", "XETRA", "DU", "HA", "MU", "STU", "F"],
  "Luxembourg": ["LU"],
  "Austria": ["VI"],
  "France": ["PA"],
  "Netherlands": ["AS"],
  "Switzerland": ["SW", "VX"],
  "Italy": ["MI", "IM"],
  "Spain": ["MC", "BC"],
  "Belgium": ["BR"],
  "Portugal": ["LS"],
  "Ireland": ["IR"],
  "Norway": ["OL"],
  "Sweden": ["ST"],
  "Finland": ["HE"],
  "Denmark": ["CO"],
  "Iceland": ["IC"],
  "Russia": ["MCX"],
  "Turkey": ["IS"],
  "Poland": ["WAR"],
  "Czech Republic": ["PR"],
  "Hungary": ["BD"],
  "Greece": ["AT"],
  "Romania": ["BX"],
  "Bulgaria": ["SO"],
  "Croatia": ["ZSE"],
  "Slovenia": ["LJE"],
  "Serbia": ["BELEX"],
  "Cyprus": ["CY"],
  "Estonia": ["TL"],
  "Latvia": ["RG"],
  "Lithuania": ["VSE"],
  "Ukraine": ["UX"],
  "Japan": ["T", "OSA", "NSE", "SAP", "FSE"],
  "China": ["SHG", "SHE", "SZE"],
  "Hong Kong": ["HK"],
  "Taiwan": ["TW", "TWO"],
  "South Korea": ["KO", "KQ"],
  "Singapore": ["SI"],
  "Malaysia": ["KLSE"],
  "Indonesia": ["JK"],
  "Thailand": ["BK"],
  "Philippines": ["PSE"],
  "Vietnam": ["HOSE", "HNX"],
  "India": ["BSE", "NSE"],
  "Pakistan": ["KAR"],
  "Sri Lanka": ["CSE"],
  "Bangladesh": ["DSE"],
  "Australia": ["AU"],
  "New Zealand": ["NZ"],
  "South Africa": ["JSE"],
  "Nigeria": ["NGSE"],
  "Kenya": ["XNAI"],
  "Morocco": ["CASA"],
  "Tunisia": ["BVMT"],
  "Egypt": ["EGX"],
  "Botswana": ["XBOT"],
  "Rwanda": ["RSE"],
  "Brazil": ["BVMF"],
  "Mexico": ["MX"],
  "Argentina": ["BA"],
  "Chile": ["SN"],
  "Colombia": ["BVC"],
  "Peru": ["LIM"],
  "Venezuela": ["CCS"],
  "Saudi Arabia": ["SR"],
  "Qatar": ["QA"],
  "United Arab Emirates": ["ADX", "DFM"],
  "Kuwait": ["KW"],
  "Bahrain": ["BAX"],
  "Oman": ["MSM"],
  "Jordan": ["AMMAN"],
};

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
