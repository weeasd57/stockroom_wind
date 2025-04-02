export const COUNTRY_ISO_CODES: { [key: string]: string } = {
  'USA': 'us',
  'UK': 'gb',
  'Canada': 'ca',
  'Germany': 'de',
  'France': 'fr',
  'Italy': 'it',
  'Spain': 'es',
  'Netherlands': 'nl',
  'Switzerland': 'ch',
  'Australia': 'au',
  'Japan': 'jp',
  'China': 'cn',
  'Hong Kong': 'hk',
  'Singapore': 'sg',
  'India': 'in',
  'Brazil': 'br',
  'South Africa': 'za',
  'Russia': 'ru',
  'Mexico': 'mx',
  'Argentina': 'ar',
  'Chile': 'cl',
  'Egypt': 'eg',
  'Saudi Arabia': 'sa',
  'United Arab Emirates': 'ae',
  'Turkey': 'tr',
  'Greece': 'gr',
  'Poland': 'pl',
  'Czech Republic': 'cz',
  'Hungary': 'hu',
  'Romania': 'ro',
  'Croatia': 'hr',
  'Bulgaria': 'bg',
  'Norway': 'no',
  'Sweden': 'se',
  'Denmark': 'dk',
  'Finland': 'fi',
  'Ireland': 'ie',
  'Portugal': 'pt',
  'Austria': 'at',
  'Belgium': 'be',
  'Luxembourg': 'lu',
  'New Zealand': 'nz',
  'Indonesia': 'id',
  'Malaysia': 'my',
  'Thailand': 'th',
  'Philippines': 'ph',
  'Vietnam': 'vn',
  'Pakistan': 'pk',
  'Bangladesh': 'bd',
  'Sri Lanka': 'lk',
  'Kenya': 'ke',
  'Nigeria': 'ng',
  'Ghana': 'gh',
  'Morocco': 'ma',
  'Qatar': 'qa',
  'Kuwait': 'kw',
  'Oman': 'om',
  'Jordan': 'jo',
  'Lebanon': 'lb',
  'Botswana': 'bw',
  'Mauritius': 'mu',
  'Zimbabwe': 'zw',
  'Tanzania': 'tz',
  'Uganda': 'ug',
  'Rwanda': 'rw',
  'Ivory Coast': 'ci',
  'Malawi': 'mw',
  'Korea': 'kr',
  'Taiwan': 'tw'
};

export const CURRENCY_SYMBOLS: { [key: string]: string } = {
  'us': '$', // USD - United States Dollar
  'gb': '£', // GBP - British Pound
  'eu': '€', // EUR - Euro (for EU countries)
  'jp': '¥', // JPY - Japanese Yen
  'kr': '₩', // KRW - South Korean Won
  'in': '₹', // INR - Indian Rupee
  'ru': '₽', // RUB - Russian Ruble
  'tr': '₺', // TRY - Turkish Lira
  'br': 'R$', // BRL - Brazilian Real
  'ca': 'C$', // CAD - Canadian Dollar
  'au': 'A$', // AUD - Australian Dollar
  'nz': 'NZ$', // NZD - New Zealand Dollar
  'cn': '¥', // CNY - Chinese Yuan
  'hk': 'HK$', // HKD - Hong Kong Dollar
  'sg': 'S$', // SGD - Singapore Dollar
  'ch': 'CHF', // CHF - Swiss Franc
  'za': 'R', // ZAR - South African Rand
  'mx': 'Mex$', // MXN - Mexican Peso
  'ar': 'ARS$', // ARS - Argentine Peso
  'cl': 'CLP$', // CLP - Chilean Peso
  'eg': 'E£', // EGP - Egyptian Pound
  'sa': 'SR', // SAR - Saudi Riyal
  'ae': 'د.إ', // AED - UAE Dirham
  'pl': 'zł', // PLN - Polish Złoty
  'cz': 'Kč', // CZK - Czech Koruna
  'hu': 'Ft', // HUF - Hungarian Forint
  'ro': 'lei', // RON - Romanian Leu
  'hr': 'kn', // HRK - Croatian Kuna
  'no': 'kr', // NOK - Norwegian Krone
  'se': 'kr', // SEK - Swedish Krona
  'dk': 'kr', // DKK - Danish Krone
  'fi': '€', // EUR - Finland uses Euro
  'ie': '€', // EUR - Ireland uses Euro
  'pt': '€', // EUR - Portugal uses Euro
  'at': '€', // EUR - Austria uses Euro
  'be': '€', // EUR - Belgium uses Euro
  'lu': '€', // EUR - Luxembourg uses Euro
  'id': 'Rp', // IDR - Indonesian Rupiah
  'my': 'RM', // MYR - Malaysian Ringgit
  'th': '฿', // THB - Thai Baht
  'ph': '₱', // PHP - Philippine Peso
  'vn': '₫', // VND - Vietnamese Dong
  'pk': '₨', // PKR - Pakistani Rupee
  'bd': '৳', // BDT - Bangladeshi Taka
  'lk': 'Rs', // LKR - Sri Lankan Rupee
  'ke': 'KSh', // KES - Kenyan Shilling
  'ng': '₦', // NGN - Nigerian Naira
  'gh': 'GH₵', // GHS - Ghanaian Cedi
  'ma': 'د.م.', // MAD - Moroccan Dirham
  'qa': 'QR', // QAR - Qatari Riyal
  'kw': 'KD', // KWD - Kuwaiti Dinar
  'om': 'ر.ع.', // OMR - Omani Rial
  'jo': 'JD', // JOD - Jordanian Dinar
  'lb': 'L£', // LBP - Lebanese Pound
  'bw': 'P', // BWP - Botswana Pula
  'mu': 'Rs', // MUR - Mauritian Rupee
  'zw': 'Z$', // ZWL - Zimbabwean Dollar
  'tz': 'TSh', // TZS - Tanzanian Shilling
  'ug': 'USh', // UGX - Ugandan Shilling
  'rw': 'FRw', // RWF - Rwandan Franc
  'ci': 'CFA', // XOF - West African CFA Franc
  'mw': 'MK', // MWK - Malawian Kwacha
  'tw': 'NT$', // TWD - New Taiwan Dollar
  'default': '$'  // Default fallback currency symbol
};

// Special handling for Euro zone countries and other currency checks
export function getCurrencySymbol(country?: string): string {
  if (!country) return CURRENCY_SYMBOLS.default;
  const countryLower = country.toLowerCase();
  
  // Special handling for Euro zone countries
  const euroCountries = ['de', 'fr', 'it', 'es', 'nl', 'pt', 'gr', 'ie', 'at', 'be', 'lu', 'fi'];
  if (euroCountries.includes(countryLower)) {
    return CURRENCY_SYMBOLS.eu;
  }
  
  return CURRENCY_SYMBOLS[countryLower] || CURRENCY_SYMBOLS.default;
}