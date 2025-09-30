// Script to update Telegram webhook to new domain
// Usage: node scripts/update-telegram-webhook.js

// ⚠️ IMPORTANT: Update these values when they change

// npm run telegram:update-webhook
// Minimal .env.local loader (no external deps)
(() => {
  try {
    if (!process.env.TELEGRAMBOT_TOKEN || !process.env.NEXT_PUBLIC_APP_URL || !process.env.TELEGRAM_WEBHOOK_SECRET) {
      const fs = require('fs');
      const path = require('path');
      const envPath = path.resolve(__dirname, '../.env.local');
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        content.split(/\r?\n/).forEach((line) => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) return;
          const eqIndex = trimmed.indexOf('=');
          if (eqIndex === -1) return;
          const key = trimmed.slice(0, eqIndex).trim();
          const value = trimmed.slice(eqIndex + 1).trim();
          if (!process.env[key]) process.env[key] = value;
        });
      }
    }
  } catch {}
})();

const TELEGRAMBOT_TOKEN = process.env.TELEGRAMBOT_TOKEN;
const NEW_WEBHOOK_URL = (process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')}` : undefined) + '/api/telegram/webhook';
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

console.log('🔑 Configuration:');
console.log('   Bot Token:', TELEGRAMBOT_TOKEN ? `${TELEGRAMBOT_TOKEN.substring(0, 20)}...` : 'NOT SET');
console.log('   Webhook Secret:', WEBHOOK_SECRET ? '***SET***' : 'NOT SET');
console.log('');

async function updateWebhook() {
  console.log('🔄 Updating Telegram webhook...');
  console.log('📡 New URL:', NEW_WEBHOOK_URL);
  
  try {
    // Test if webhook endpoint is accessible
    console.log('\n🔍 Testing webhook endpoint accessibility...');
    try {
      if (!NEW_WEBHOOK_URL || !/^https:\/\/\S+/.test(NEW_WEBHOOK_URL)) throw new Error('Invalid or missing NEXT_PUBLIC_APP_URL');
      const testResponse = await fetch(NEW_WEBHOOK_URL, { method: 'GET' });
      const testResult = await testResponse.json();
      console.log('✅ Webhook endpoint is accessible:', testResult);
    } catch (testError) {
      console.log('⚠️  Warning: Could not test webhook endpoint:', testError.message);
      console.log('💡 Make sure your dev server is running and ngrok is active');
    }
    
    // Set new webhook
    console.log('\n🔄 Setting webhook URL...');
    const setResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAMBOT_TOKEN}/setWebhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: NEW_WEBHOOK_URL,
          secret_token: WEBHOOK_SECRET,
          allowed_updates: ['message', 'callback_query']
        })
      }
    );
    
    const setResult = await setResponse.json();
    console.log('\n✅ Webhook set result:', JSON.stringify(setResult, null, 2));
    
    // Get webhook info to verify
    console.log('\n📊 Getting webhook info...');
    const infoResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAMBOT_TOKEN}/getWebhookInfo`
    );
    
    const infoResult = await infoResponse.json();
    console.log('Current webhook info:', JSON.stringify(infoResult, null, 2));
    
    if (infoResult.result?.pending_update_count > 0) {
      console.log(`\n⚠️  Warning: ${infoResult.result.pending_update_count} pending updates`);
      console.log('💡 These will be processed when the webhook receives them');
    }
    
    if (infoResult.result?.last_error_message) {
      console.log('\n❌ Last error:', infoResult.result.last_error_message);
      console.log('💡 Check your .env.local file:');
      console.log('   - TELEGRAM_WEBHOOK_SECRET must match the secret used here');
      console.log('   - Make sure Next.js dev server is running');
      console.log('   - Verify ngrok is forwarding to your local port');
    } else {
      console.log('\n✅ No errors! Webhook is configured correctly');
      console.log('💡 Test by sending /start to your bot');
    }
    
  } catch (error) {
    console.error('\n❌ Error updating webhook:', error);
  }
}

// Optional: Delete webhook (uncomment to use)
async function deleteWebhook() {
  console.log('🗑️  Deleting webhook...');
  const response = await fetch(
    `https://api.telegram.org/bot${TELEGRAMBOT_TOKEN}/deleteWebhook`,
    { method: 'POST' }
  );
  const result = await response.json();
  console.log('Result:', JSON.stringify(result, null, 2));
}

// Run
updateWebhook();

// Uncomment to delete webhook instead:
// deleteWebhook();
