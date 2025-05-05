#!/usr/bin/env node

/**
 * Standalone Post Generator for Stockroom
 * 
 * This script generates realistic trading posts using country data
 * from the country_summary file.
 * 
 * Usage:
 *   node generate.js [options]
 * 
 * Options:
 *   --user <user_id>   : Required. The user ID to assign posts to
 *   --count <number>   : Optional. Number of posts to generate (default: 30)
 *   --output <file>    : Optional. Output file (default: generated_posts.json)
 *   --country <code>   : Optional. Restrict to specific country
 *   --help             : Show this help message
 */

const fs = require('fs');
const path = require('path');

// Configuration
const DEFAULT_POST_COUNT = 30;
const DEFAULT_OUTPUT_FILE = 'generated_posts.json';

// Strategy options defined in the app
const STRATEGIES = [
  'Long Term Investment',
  'Swing Trading',
  'Day Trading',
  'Value Investing',
  'Growth Investing',
  'Fundamental Analysis',
  'Technical Analysis',
  'Momentum Trading',
  'Breakout Trading',
  'Position Trading',
  'Scalping',
  'News Trading',
  'Trend Following'
];

// Sample description templates
const DESCRIPTION_TEMPLATES = [
  "Looking at {company}'s recent performance, I expect a rise to {target} based on strong {indicator} patterns. Setting my stop loss at {stop_loss} as a precaution.",
  "Following {strategy} principles, I'm entering a position in {company} with a target price of {target}. Stop loss set at {stop_loss} to limit downside risk.",
  "{company} looks undervalued at current prices. Expect a potential move to {target} in the next few months. Setting a protective stop at {stop_loss}.",
  "After analyzing {company}'s technical indicators, I see a good entry point with upside potential to {target}. Conservative stop loss at {stop_loss}."
];

// Technical indicators for descriptions
const INDICATORS = [
  "RSI", "MACD", "moving average", "volume", "Bollinger band", "support", "resistance", 
  "earnings", "dividend", "cash flow", "revenue growth", "profit margin", "chart pattern"
];

// Name templates for various exchanges
const COMPANY_NAME_TEMPLATES = [
  "{industry} {type}",
  "{industry} {type} of {country}",
  "{country} {industry} {type}",
  "{name} {type}",
  "{name} {industry}",
  "{name} {industry} {type}"
];

const COMPANY_TYPES = [
  "Corp", "Inc", "Corporation", "Ltd", "Limited", "Group", "Holdings", "Enterprises",
  "Industries", "Technologies", "Solutions", "Systems", "Partners", "Ventures", "Brands"
];

const COMPANY_INDUSTRIES = [
  "Technology", "Finance", "Healthcare", "Energy", "Retail", "Manufacturing",
  "Telecom", "Automotive", "Aerospace", "Pharmaceuticals", "Insurance", "Real Estate",
  "Media", "Food", "Mining", "Agriculture", "Construction", "Transportation"
];

const COMPANY_NAMES = [
  "Alpha", "Beta", "Delta", "Gamma", "Horizon", "Nova", "Pinnacle", "Summit", "Vertex",
  "Zenith", "Quantum", "Nexus", "Phoenix", "Orion", "Meridian", "Atlas", "Vector",
  "Apex", "Elite", "Prime", "Global", "Metro", "United", "Advanced", "Strategic"
];

/**
 * Loads and parses the country summary data
 */
function loadCountrySummaryData() {
  try {
    // Try multiple possible locations for the country data file
    const possiblePaths = [
      path.resolve(__dirname, './data/country_summary_20250304_171206.json'),
      path.resolve(__dirname, '../../src/symbols_data/country_summary_20250304_171206.json')
    ];
    
    let data = null;
    let loadedPath = null;
    
    // Try each path until we find a file
    for (const filePath of possiblePaths) {
      try {
        if (fs.existsSync(filePath)) {
          data = fs.readFileSync(filePath, 'utf8');
          loadedPath = filePath;
          break;
        }
      } catch (err) {
        // Continue to next path
      }
    }
    
    if (!data) {
      throw new Error('Country data file not found in any of the expected locations');
    }
    
    console.log(`\x1b[32m✅ Loaded country data from: ${loadedPath}\x1b[0m`);
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading country data:', error.message);
    return null;
  }
}

/**
 * Generates a realistic company name for a given exchange
 */
function generateCompanyName(country) {
  const template = getRandomItem(COMPANY_NAME_TEMPLATES);
  return template
    .replace('{industry}', getRandomItem(COMPANY_INDUSTRIES))
    .replace('{type}', getRandomItem(COMPANY_TYPES))
    .replace('{name}', getRandomItem(COMPANY_NAMES))
    .replace('{country}', country);
}

/**
 * Generates a random stock symbol for a given exchange
 */
function generateStockSymbol(exchange) {
  const length = Math.random() > 0.7 ? 4 : (Math.random() > 0.3 ? 3 : 2);
  let symbol = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  
  for (let i = 0; i < length; i++) {
    symbol += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return symbol;
}

/**
 * Generate a random number between min and max (inclusive)
 */
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Pick a random item from an array
 */
function getRandomItem(array) {
  return array[getRandomInt(0, array.length - 1)];
}

/**
 * Generate a random date within the past 90 days
 */
function getRandomRecentDate() {
  const now = new Date();
  const pastDate = new Date(now.getTime() - getRandomInt(1, 90) * 24 * 60 * 60 * 1000);
  return pastDate.toISOString();
}

/**
 * Calculate target and stop loss prices based on current price
 */
function calculatePrices(currentPrice, strategy) {
  // Different strategies have different risk/reward profiles
  let targetPercent, stopLossPercent;
  
  switch(strategy) {
    case 'Day Trading':
    case 'Scalping':
      // Short-term strategies with tighter ranges
      targetPercent = getRandomInt(2, 5) / 100;
      stopLossPercent = getRandomInt(1, 3) / 100;
      break;
    case 'Swing Trading':
    case 'Momentum Trading':
    case 'Breakout Trading':
      // Medium-term strategies with moderate ranges
      targetPercent = getRandomInt(5, 15) / 100;
      stopLossPercent = getRandomInt(3, 8) / 100;
      break;
    case 'Long Term Investment':
    case 'Value Investing':
    case 'Growth Investing':
      // Long-term strategies with wider ranges
      targetPercent = getRandomInt(15, 30) / 100;
      stopLossPercent = getRandomInt(8, 15) / 100;
      break;
    default:
      // Default moderate range
      targetPercent = getRandomInt(5, 20) / 100;
      stopLossPercent = getRandomInt(3, 10) / 100;
  }
  
  // Calculate target price (always higher than current)
  const targetPrice = (currentPrice * (1 + targetPercent)).toFixed(2);
  
  // Calculate stop loss (always lower than current)
  const stopLossPrice = (currentPrice * (1 - stopLossPercent)).toFixed(2);
  
  return {
    targetPrice: parseFloat(targetPrice),
    stopLossPrice: parseFloat(stopLossPrice)
  };
}

/**
 * Generate a description for the post using templates
 */
function generateDescription(template, data) {
  let description = template;
  
  // Replace placeholders with actual data
  Object.keys(data).forEach(key => {
    description = description.replace(`{${key}}`, data[key]);
  });
  
  return description;
}

/**
 * Generate sample posts for a specified user
 */
function generatePostsForUser(userId, count = DEFAULT_POST_COUNT, countryFilter = null) {
  // Load country data
  const countryData = loadCountrySummaryData();
  if (!countryData) {
    console.error('Country data not available. Using default data.');
    return generateDefaultPosts(userId, count);
  }
  
  const posts = [];
  const countries = Object.keys(countryData);
  
  // Filter countries if specified
  const validCountries = countryFilter ? 
    countries.filter(c => c.toLowerCase() === countryFilter.toLowerCase()) : 
    countries;
  
  if (validCountries.length === 0) {
    console.error(`No data found for country: ${countryFilter}`);
    return [];
  }
  
  // Generate the specified number of posts
  for (let i = 0; i < count; i++) {
    // Select a random country
    const country = getRandomItem(validCountries);
    const countryInfo = countryData[country];
    
    // Select a random exchange for this country
    const exchanges = Object.keys(countryInfo.Exchanges);
    const exchange = getRandomItem(exchanges);
    
    // Generate symbol and company name
    const symbol = generateStockSymbol(exchange);
    const companyName = generateCompanyName(country);
    
    // Generate a random current price between $5 and $300
    const currentPrice = parseFloat((Math.random() * 295 + 5).toFixed(2));
    
    // Select a random strategy
    const strategy = getRandomItem(STRATEGIES);
    
    // Calculate target and stop loss prices
    const { targetPrice, stopLossPrice } = calculatePrices(currentPrice, strategy);
    
    // Select a random description template
    const template = getRandomItem(DESCRIPTION_TEMPLATES);
    
    // Generate the post description
    const description = generateDescription(template, {
      company: companyName,
      target: targetPrice,
      stop_loss: stopLossPrice,
      strategy: strategy,
      indicator: getRandomItem(INDICATORS)
    });
    
    // Create the post object
    const post = {
      user_id: userId,
      symbol: `${symbol}:${exchange}`,
      company_name: companyName,
      country: country,
      exchange: exchange,
      current_price: currentPrice,
      initial_price: currentPrice, // Set initial price same as current at creation
      target_price: targetPrice,
      stop_loss_price: stopLossPrice,
      strategy: strategy,
      description: description,
      content: description, // Use same content for description and content
      created_at: getRandomRecentDate(),
      updated_at: new Date().toISOString(),
      target_reached: false,
      stop_loss_triggered: false,
      closed: null,
      high_price: currentPrice, // Initially set to current price
      postDateAfterPriceDate: false,
      postAfterMarketClose: false,
      noDataAvailable: false
    };
    
    posts.push(post);
  }
  
  return posts;
}

/**
 * Generate default posts if country data is not available
 */
function generateDefaultPosts(userId, count) {
  // Default stock data to use as fallback
  const DEFAULT_STOCKS = [
    { Symbol: "AAPL", Name: "Apple Inc.", Exchange: "NASDAQ", Country: "USA" },
    { Symbol: "MSFT", Name: "Microsoft Corporation", Exchange: "NASDAQ", Country: "USA" },
    { Symbol: "AMZN", Name: "Amazon.com Inc.", Exchange: "NASDAQ", Country: "USA" },
    { Symbol: "GOOGL", Name: "Alphabet Inc.", Exchange: "NASDAQ", Country: "USA" },
    { Symbol: "META", Name: "Meta Platforms Inc.", Exchange: "NASDAQ", Country: "USA" },
    { Symbol: "TSLA", Name: "Tesla Inc.", Exchange: "NASDAQ", Country: "USA" },
    { Symbol: "JPM", Name: "JPMorgan Chase & Co.", Exchange: "NYSE", Country: "USA" },
    { Symbol: "V", Name: "Visa Inc.", Exchange: "NYSE", Country: "USA" },
    { Symbol: "JNJ", Name: "Johnson & Johnson", Exchange: "NYSE", Country: "USA" },
    { Symbol: "UNH", Name: "UnitedHealth Group Incorporated", Exchange: "NYSE", Country: "USA" }
  ];
  
  const posts = [];
  
  // Generate the specified number of posts
  for (let i = 0; i < count; i++) {
    // Select a random stock
    const stock = getRandomItem(DEFAULT_STOCKS);
    
    // Generate a random current price between $10 and $300
    const currentPrice = parseFloat((Math.random() * 290 + 10).toFixed(2));
    
    // Select a random strategy
    const strategy = getRandomItem(STRATEGIES);
    
    // Calculate target and stop loss prices
    const { targetPrice, stopLossPrice } = calculatePrices(currentPrice, strategy);
    
    // Select a random description template
    const template = getRandomItem(DESCRIPTION_TEMPLATES);
    
    // Generate the post description
    const description = generateDescription(template, {
      company: stock.Name,
      target: targetPrice,
      stop_loss: stopLossPrice,
      strategy: strategy,
      indicator: getRandomItem(INDICATORS)
    });
    
    // Create the post object
    const post = {
      user_id: userId,
      symbol: stock.Symbol,
      company_name: stock.Name,
      country: stock.Country,
      exchange: stock.Exchange,
      current_price: currentPrice,
      initial_price: currentPrice, // Set initial price same as current at creation
      target_price: targetPrice,
      stop_loss_price: stopLossPrice,
      strategy: strategy,
      description: description,
      content: description, // Use same content for description and content
      created_at: getRandomRecentDate(),
      updated_at: new Date().toISOString(),
      target_reached: false,
      stop_loss_triggered: false,
      closed: null,
      high_price: currentPrice, // Initially set to current price
      postDateAfterPriceDate: false,
      postAfterMarketClose: false,
      noDataAvailable: false
    };
    
    posts.push(post);
  }
  
  return posts;
}

/**
 * Save generated posts to a JSON file for import
 */
function savePostsToFile(posts, filename) {
  try {
    const outputPath = path.resolve(process.cwd(), filename);
    fs.writeFileSync(outputPath, JSON.stringify(posts, null, 2));
    console.log(`\x1b[32m✅ Successfully saved ${posts.length} posts to ${outputPath}\x1b[0m`);
    return true;
  } catch (error) {
    console.error('Error saving posts to file:', error);
    return false;
  }
}

/**
 * Display help information
 */
function showHelp() {
  console.log(`
\x1b[1mStockroom Post Generator\x1b[0m
Generate realistic trading posts with country-specific exchange data

\x1b[1mUsage:\x1b[0m
  node generate.js [options]

\x1b[1mOptions:\x1b[0m
  --user <user_id>     Required. The user ID to assign posts to
  --count <number>     Optional. Number of posts to generate (default: ${DEFAULT_POST_COUNT})
  --output <file>      Optional. Output file (default: ${DEFAULT_OUTPUT_FILE})
  --country <code>     Optional. Restrict to specific country
  --help               Show this help message

\x1b[1mExamples:\x1b[0m
  # Generate 20 posts for user abc123
  node generate.js --user abc123 --count 20

  # Generate 10 posts for specific country
  node generate.js --user abc123 --count 10 --country USA

  # Save to custom file
  node generate.js --user abc123 --output my_posts.json
`);
}

/**
 * Main execution function
 */
function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  let userId = null;
  let count = DEFAULT_POST_COUNT;
  let outputFile = DEFAULT_OUTPUT_FILE;
  let countryFilter = null;
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i].toLowerCase();
    
    if ((arg === '--help' || arg === '-h')) {
      showHelp();
      return;
    } else if (arg === '--user' && args[i + 1]) {
      userId = args[i + 1];
      i++;
    } else if (arg === '--count' && args[i + 1]) {
      count = parseInt(args[i + 1], 10);
      i++;
    } else if (arg === '--output' && args[i + 1]) {
      outputFile = args[i + 1];
      i++;
    } else if (arg === '--country' && args[i + 1]) {
      countryFilter = args[i + 1];
      i++;
    }
  }
  
  if (!userId) {
    console.error('\x1b[31m❌ Error: User ID is required. Use --user <user_id>\x1b[0m');
    showHelp();
    process.exit(1);
  }
  
  console.log(`\x1b[36m🔍 Checking country data...\x1b[0m`);
  const countryData = loadCountrySummaryData();
  
  if (countryData) {
    console.log(`\x1b[32m✅ Found data for ${Object.keys(countryData).length} countries\x1b[0m`);
    
    if (countryFilter) {
      const matchedCountry = Object.keys(countryData).find(
        c => c.toLowerCase() === countryFilter.toLowerCase()
      );
      
      if (matchedCountry) {
        const country = countryData[matchedCountry];
        const exchanges = Object.keys(country.Exchanges);
        console.log(`\x1b[36m🌎 Using country: ${matchedCountry} with ${exchanges.length} exchanges\x1b[0m`);
      } else {
        console.error(`\x1b[31m❌ Country not found: ${countryFilter}\x1b[0m`);
        process.exit(1);
      }
    }
  } else {
    console.warn('\x1b[33m⚠️ Country data not found. Using default stock data.\x1b[0m');
  }
  
  console.log(`\x1b[36m📊 Generating ${count} sample posts for user ${userId}...\x1b[0m`);
  
  // Generate posts
  const posts = generatePostsForUser(userId, count, countryFilter);
  
  if (posts.length === 0) {
    console.error('\x1b[31m❌ No posts were generated\x1b[0m');
    process.exit(1);
  }
  
  // Sample distribution of countries
  const countryCounts = {};
  posts.forEach(post => {
    countryCounts[post.country] = (countryCounts[post.country] || 0) + 1;
  });
  
  console.log('\x1b[36m📈 Country distribution:\x1b[0m');
  Object.keys(countryCounts).forEach(country => {
    const count = countryCounts[country];
    const percent = Math.round((count / posts.length) * 100);
    console.log(`  ${country}: ${count} posts (${percent}%)`);
  });
  
  // Save posts
  console.log(`\x1b[36m💾 Saving posts to ${outputFile}...\x1b[0m`);
  savePostsToFile(posts, outputFile);
  
  console.log('\x1b[32m✅ Generation complete!\x1b[0m');
  console.log('\x1b[33mTo import these posts into Supabase:\x1b[0m');
  console.log('1. Go to your Supabase dashboard → Table editor → "posts" table');
  console.log('2. Click "Import" button and select the JSON file');
  console.log('3. Ensure "Upsert" and "Import References" options are enabled');
}

// Execute the main function
if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('\x1b[31m❌ Unhandled error:\x1b[0m', error);
    process.exit(1);
  }
} 