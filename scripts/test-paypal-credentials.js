/**
 * PayPal Credentials Diagnostic Script
 * Tests if PayPal credentials are valid and can authenticate
 */

const fs = require('fs');
const path = require('path');

// Load .env.local manually
try {
  const envPath = path.join(__dirname, '..', '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
} catch (err) {
  console.error('Could not load .env.local:', err.message);
}

const PAYPAL_MODE = ((process.env.PAYPAL_MODE || process.env.NEXT_PUBLIC_PAYPAL_MODE || 'sandbox').toLowerCase() === 'live') ? 'live' : 'sandbox';
const PAYPAL_BASE = PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

function getCredentials() {
  const isLive = PAYPAL_MODE === 'live';
  const clientId = isLive
    ? (process.env.PAYPAL_LIVE_CLIENT_ID || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID_LIVE || process.env.PAYPAL_CLIENT_ID || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID)
    : (process.env.PAYPAL_SANDBOX_CLIENT_ID || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID_SANDBOX || process.env.PAYPAL_CLIENT_ID || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID);
  const clientSecret = isLive
    ? (process.env.PAYPAL_LIVE_CLIENT_SECRET || process.env.PAYPAL_CLIENT_SECRET)
    : (process.env.PAYPAL_SANDBOX_CLIENT_SECRET || process.env.PAYPAL_CLIENT_SECRET);
  return { clientId, clientSecret };
}

async function testPayPalAuth() {
  console.log('🔍 Testing PayPal Credentials...\n');
  
  const { clientId, clientSecret } = getCredentials();
  
  console.log('📋 Configuration:');
  console.log(`   Mode: ${PAYPAL_MODE}`);
  console.log(`   Base URL: ${PAYPAL_BASE}`);
  console.log(`   Client ID: ${clientId ? `${clientId.substring(0, 20)}...` : '❌ MISSING'}`);
  console.log(`   Client Secret: ${clientSecret ? `${clientSecret.substring(0, 10)}...` : '❌ MISSING'}\n`);
  
  if (!clientId || !clientSecret) {
    console.error('❌ ERROR: Missing credentials!');
    console.log('\n📝 Please set the following in .env.local:');
    console.log('   NEXT_PUBLIC_PAYPAL_CLIENT_ID=<your-client-id>');
    console.log('   PAYPAL_CLIENT_SECRET=<your-client-secret>');
    console.log('   PAYPAL_MODE=sandbox\n');
    process.exit(1);
  }
  
  console.log('🔐 Attempting to authenticate with PayPal...\n');
  
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  
  try {
    const response = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    
    const responseText = await response.text();
    
    if (!response.ok) {
      console.error('❌ AUTHENTICATION FAILED!\n');
      console.log('HTTP Status:', response.status, response.statusText);
      
      try {
        const errorData = JSON.parse(responseText);
        console.log('Error Response:', JSON.stringify(errorData, null, 2));
        
        if (response.status === 401) {
          console.log('\n💡 Solution:');
          console.log('   1. Your Client ID or Secret is incorrect');
          console.log('   2. Get new credentials from PayPal Dashboard:');
          console.log('      👉 https://developer.paypal.com/dashboard/');
          console.log('   3. Make sure you are in Sandbox mode');
          console.log('   4. Copy both Client ID and Secret from the SAME app');
          console.log('   5. Update .env.local with the new credentials');
          console.log('   6. Restart your dev server\n');
          
          console.log('📖 Full guide: PAYPAL_CREDENTIALS_SETUP.md\n');
        }
      } catch (e) {
        console.log('Raw Error:', responseText);
      }
      
      process.exit(1);
    }
    
    const data = JSON.parse(responseText);
    
    console.log('✅ AUTHENTICATION SUCCESSFUL!\n');
    console.log('Access Token:', data.access_token.substring(0, 30) + '...');
    console.log('Token Type:', data.token_type);
    console.log('Expires In:', data.expires_in, 'seconds');
    console.log('App ID:', data.app_id || 'N/A');
    console.log('\n🎉 Your PayPal credentials are working correctly!');
    console.log('✅ You can now use PayPal checkout in your app.\n');
    
  } catch (error) {
    console.error('❌ NETWORK ERROR:', error.message);
    console.log('\n💡 Possible causes:');
    console.log('   - No internet connection');
    console.log('   - PayPal API is down');
    console.log('   - Firewall blocking the request\n');
    process.exit(1);
  }
}

// Run the test
testPayPalAuth().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
