/**
 * Telegram Webhook Diagnostic Script
 * Checks and fixes webhook configuration
 * 
 * Usage: node scripts/check-telegram-webhook.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: options.method || 'GET',
      headers: options.headers || {}
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, json: () => JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, json: () => ({}) });
        }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    req.end();
  });
}

// Load .env.local
try {
  const envPath = path.join(__dirname, '..', '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      process.env[key] = value;
    }
  });
} catch (err) {
  console.warn('⚠️  Could not load .env.local:', err.message);
}

async function checkWebhook() {
  const token = process.env.TELEGRAMBOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
  
  if (!token) {
    console.error('❌ TELEGRAMBOT_TOKEN not found in .env.local');
    return;
  }

  console.log('🔍 Checking webhook status...\n');

  try {
    // Get current webhook info
    const infoRes = await httpRequest(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    const info = await infoRes.json();
    
    console.log('📡 Current Webhook Info:');
    console.log(JSON.stringify(info.result, null, 2));
    console.log('');

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    
    if (!appUrl) {
      console.error('❌ NEXT_PUBLIC_APP_URL not set in .env.local');
      console.log('💡 Add: NEXT_PUBLIC_APP_URL=https://your-ngrok-url.ngrok-free.app\n');
      return;
    }

    if (!webhookSecret) {
      console.error('⚠️  TELEGRAM_WEBHOOK_SECRET not set in .env.local');
      console.log('💡 Add: TELEGRAM_WEBHOOK_SECRET=your-secret-token-here');
      console.log('💡 You can use: ' + require('crypto').randomBytes(32).toString('hex') + '\n');
    }

    const targetUrl = `${appUrl}/api/telegram/webhook`;
    console.log('🎯 Target webhook URL:', targetUrl);
    console.log('🔐 Secret token:', webhookSecret ? '✓ Set' : '✗ Not set');
    console.log('');

    // Check if webhook needs update
    if (info.result.url !== targetUrl) {
      console.log('⚙️  Webhook URL mismatch, updating...\n');
      
      const setRes = await httpRequest(`https://api.telegram.org/bot${token}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: targetUrl,
          secret_token: webhookSecret || '',
          allowed_updates: ['message', 'callback_query']
        })
      });
      
      const setResult = await setRes.json();
      
      if (setResult.ok) {
        console.log('✅ Webhook updated successfully!');
        console.log(JSON.stringify(setResult.result, null, 2));
      } else {
        console.error('❌ Failed to update webhook:', setResult.description);
      }
    } else {
      console.log('✅ Webhook URL is correct');
    }

    // Test webhook URL accessibility
    console.log('\n🧪 Testing webhook endpoint...');
    try {
      const testRes = await httpRequest(targetUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Telegram-Bot-Api-Secret-Token': webhookSecret || 'test'
        },
        body: JSON.stringify({ test: true })
      });
      console.log('Response status:', testRes.status);
      if (testRes.status === 401) {
        console.log('⚠️  401 Unauthorized - Secret token validation working');
      } else if (testRes.status === 200) {
        console.log('✅ Webhook endpoint accessible');
      } else {
        console.log('⚠️  Unexpected status:', testRes.status);
      }
    } catch (err) {
      console.error('❌ Cannot reach webhook endpoint:', err.message);
      console.log('💡 Make sure ngrok/tunnel is running and NEXT_PUBLIC_APP_URL is correct');
    }

    // Get bot info
    console.log('\n🤖 Bot Info:');
    const botRes = await httpRequest(`https://api.telegram.org/bot${token}/getMe`);
    const botInfo = await botRes.json();
    if (botInfo.ok) {
      console.log('  Username: @' + botInfo.result.username);
      console.log('  Name:', botInfo.result.first_name);
      console.log('  ID:', botInfo.result.id);
    }

    console.log('\n📋 Next Steps:');
    console.log('1. Open Telegram and search for @' + (botInfo.result?.username || 'your_bot'));
    console.log('2. Send /start command');
    console.log('3. Check Next.js terminal for webhook logs: [webhook] POST received');
    console.log('4. Check Supabase telegram_subscribers table for new row\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkWebhook();
