#!/usr/bin/env node

/**
 * Telegram Domain Setup Script
 * npm run telegram:setup
 * Sets up Telegram bot webhook with domain configuration
 */

const https = require('https');
const { URL } = require('url');
const path = require('path');
const fs = require('fs');

// Load environment variables from .env.local
function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    
    lines.forEach(line => {
      line = line.trim();
      if (line && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=');
          process.env[key] = value;
        }
      }
    });
    console.log('✅ Loaded environment variables from .env.local');
  } else {
    console.log('⚠️ No .env.local file found');
  }
}

// Load env file first
loadEnvFile();

// Configuration
const config = {
  botToken: process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAMBOT_TOKEN,
  domain: process.env.NEXT_PUBLIC_APP_URL || process.argv[2],
  webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET,
};

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

// Validate inputs
function validateConfig() {
  if (!config.botToken) {
    log('❌ Bot Token is required', colors.red);
    log('Set TELEGRAM_BOT_TOKEN or TELEGRAMBOT_TOKEN in .env.local', colors.yellow);
    process.exit(1);
  }

  if (!config.domain) {
    log('❌ Domain is required', colors.red);
    log('Usage: node setup-telegram-domain.js https://yourdomain.com', colors.yellow);
    log('Or set NEXT_PUBLIC_APP_URL in .env.local', colors.yellow);
    process.exit(1);
  }

  // Ensure domain has https://
  if (!config.domain.startsWith('http')) {
    config.domain = `https://${config.domain}`;
  }

  try {
    new URL(config.domain);
  } catch (error) {
    log('❌ Invalid domain URL', colors.red);
    process.exit(1);
  }

  log('✅ Configuration validated', colors.green);
}

// Make HTTPS request
function makeRequest(url, data = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: data ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Telegram-Domain-Setup-Script'
      }
    };

    if (data) {
      const postData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          resolve(parsedData);
        } catch (error) {
          reject(new Error(`Invalid JSON response: ${responseData}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// Test bot token
async function testBotToken() {
  log('🤖 Testing bot token...', colors.blue);
  
  try {
    const response = await makeRequest(`https://api.telegram.org/bot${config.botToken}/getMe`);
    
    if (response.ok) {
      log(`✅ Bot token is valid!`, colors.green);
      log(`🤖 Bot name: ${response.result.first_name}`, colors.blue);
      log(`📝 Bot username: @${response.result.username}`, colors.blue);
      return true;
    } else {
      log('❌ Invalid bot token', colors.red);
      log(`Error: ${response.description}`, colors.red);
      return false;
    }
  } catch (error) {
    log('❌ Failed to test bot token', colors.red);
    log(`Error: ${error.message}`, colors.red);
    return false;
  }
}

// Set webhook
async function setWebhook() {
  const webhookUrl = `${config.domain}/api/webhooks/telegram`;
  log(`🔗 Setting webhook: ${webhookUrl}`, colors.blue);

  const webhookData = {
    url: webhookUrl,
    allowed_updates: ['message', 'callback_query', 'inline_query'],
    drop_pending_updates: true
  };

  if (config.webhookSecret) {
    webhookData.secret_token = config.webhookSecret;
  }

  try {
    const response = await makeRequest(
      `https://api.telegram.org/bot${config.botToken}/setWebhook`,
      webhookData
    );

    if (response.ok) {
      log('✅ Webhook set successfully!', colors.green);
      log(`Description: ${response.description}`, colors.blue);
      return true;
    } else {
      log('❌ Failed to set webhook', colors.red);
      log(`Error: ${response.description}`, colors.red);
      return false;
    }
  } catch (error) {
    log('❌ Failed to set webhook', colors.red);
    log(`Error: ${error.message}`, colors.red);
    return false;
  }
}

// Verify webhook
async function verifyWebhook() {
  log('🔍 Verifying webhook...', colors.blue);

  try {
    const response = await makeRequest(`https://api.telegram.org/bot${config.botToken}/getWebhookInfo`);

    if (response.ok) {
      const info = response.result;
      log('✅ Webhook info retrieved:', colors.green);
      log(`📍 URL: ${info.url}`, colors.blue);
      log(`📊 Pending updates: ${info.pending_update_count}`, colors.blue);
      log(`🕒 Last error date: ${info.last_error_date ? new Date(info.last_error_date * 1000).toISOString() : 'None'}`, colors.blue);
      
      if (info.last_error_message) {
        log(`⚠️ Last error: ${info.last_error_message}`, colors.yellow);
      }

      const expectedUrl = `${config.domain}/api/webhooks/telegram`;
      if (info.url === expectedUrl) {
        log('✅ Webhook URL matches expected URL', colors.green);
        return true;
      } else {
        log('⚠️ Webhook URL mismatch!', colors.yellow);
        log(`Expected: ${expectedUrl}`, colors.yellow);
        log(`Actual: ${info.url}`, colors.yellow);
        return false;
      }
    } else {
      log('❌ Failed to get webhook info', colors.red);
      log(`Error: ${response.description}`, colors.red);
      return false;
    }
  } catch (error) {
    log('❌ Failed to verify webhook', colors.red);
    log(`Error: ${error.message}`, colors.red);
    return false;
  }
}

// Test webhook endpoint
async function testWebhookEndpoint() {
  const webhookUrl = `${config.domain}/api/webhooks/telegram`;
  log(`🧪 Testing webhook endpoint: ${webhookUrl}`, colors.blue);

  try {
    const response = await makeRequest(webhookUrl);
    log('✅ Webhook endpoint is reachable', colors.green);
    return true;
  } catch (error) {
    if (error.code === 'ENOTFOUND') {
      log('❌ Domain not found - check DNS configuration', colors.red);
    } else if (error.code === 'ECONNREFUSED') {
      log('❌ Connection refused - server may be down', colors.red);
    } else {
      log(`⚠️ Endpoint test result: ${error.message}`, colors.yellow);
      log('Note: This may be normal if the endpoint expects POST requests', colors.yellow);
    }
    return false;
  }
}

// Generate environment variables
function generateEnvVars() {
  log('\n📄 Environment Variables:', colors.blue);
  console.log(`TELEGRAM_BOT_TOKEN=${config.botToken}`);
  console.log(`TELEGRAM_WEBHOOK_URL=${config.domain}/api/webhooks/telegram`);
  console.log(`NEXT_PUBLIC_APP_URL=${config.domain}`);
  
  if (config.webhookSecret) {
    console.log(`TELEGRAM_WEBHOOK_SECRET=${config.webhookSecret}`);
  }

  log('\n💡 Add these to your .env.local or deployment environment', colors.yellow);
}

// Main function
async function main() {
  log('🚀 Telegram Domain Setup Script', colors.blue);
  log('================================', colors.blue);

  // Validate configuration
  validateConfig();

  log(`\n🔧 Configuration:`, colors.blue);
  log(`Domain: ${config.domain}`, colors.blue);
  log(`Bot Token: ${config.botToken.substring(0, 10)}...`, colors.blue);
  log(`Webhook Secret: ${config.webhookSecret ? 'Set' : 'Not set'}`, colors.blue);

  // Test bot token
  const botValid = await testBotToken();
  if (!botValid) {
    process.exit(1);
  }

  // Set webhook
  const webhookSet = await setWebhook();
  if (!webhookSet) {
    process.exit(1);
  }

  // Verify webhook
  await verifyWebhook();

  // Test endpoint
  await testWebhookEndpoint();

  // Generate env vars
  generateEnvVars();

  log('\n🎉 Telegram domain setup completed!', colors.green);
  log('\n📋 Next Steps:', colors.blue);
  log('1. Deploy your application with the webhook API route', colors.yellow);
  log('2. Test the bot by sending a message', colors.yellow);
  log('3. Monitor webhook calls in your application logs', colors.yellow);
}

// Handle errors
process.on('unhandledRejection', (error) => {
  log(`❌ Unhandled error: ${error.message}`, colors.red);
  process.exit(1);
});

// Run main function
if (require.main === module) {
  main().catch((error) => {
    log(`❌ Script failed: ${error.message}`, colors.red);
    process.exit(1);
  });
}

module.exports = { main, testBotToken, setWebhook, verifyWebhook };
