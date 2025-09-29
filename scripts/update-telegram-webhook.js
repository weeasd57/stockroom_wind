// Script to update Telegram webhook to new domain
// Usage: node scripts/update-telegram-webhook.js

// ⚠️ IMPORTANT: Update these values when they change
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAMBOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '8209141381:AAGrzcLQ2297PL0Fv9u_NXfTEiPnuwGepVw';
const NEW_WEBHOOK_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://7db363997b9b.ngrok-free.app') + '/api/telegram/webhook';
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || 'NXfTEiPnuwGepVwzzAAGrzcLQ2297PL0Fv9u';

console.log('🔑 Configuration:');
console.log('   Bot Token:', TELEGRAM_BOT_TOKEN ? `${TELEGRAM_BOT_TOKEN.substring(0, 20)}...` : 'NOT SET');
console.log('   Webhook Secret:', WEBHOOK_SECRET ? '***SET***' : 'NOT SET');
console.log('');

async function updateWebhook() {
  console.log('🔄 Updating Telegram webhook...');
  console.log('📡 New URL:', NEW_WEBHOOK_URL);
  
  try {
    // Test if webhook endpoint is accessible
    console.log('\n🔍 Testing webhook endpoint accessibility...');
    try {
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
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`,
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
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`
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
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook`,
    { method: 'POST' }
  );
  const result = await response.json();
  console.log('Result:', JSON.stringify(result, null, 2));
}

// Run
updateWebhook();

// Uncomment to delete webhook instead:
// deleteWebhook();
