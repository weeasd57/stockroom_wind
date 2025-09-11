/**
 * PayPal Webhook Debug Endpoint
 * GET /api/webhooks/paypal/debug
 */

import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const {
  NEXT_PUBLIC_PAYPAL_CLIENT_ID,
  PAYPAL_CLIENT_SECRET,
  PAYPAL_WEBHOOK_ID,
  PAYPAL_MODE,
  NODE_ENV,
} = process.env;

const mode = (PAYPAL_MODE || 'sandbox').toLowerCase() === 'live' ? 'live' : 'sandbox';

function paypalBaseUrl(mode) {
  return mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

async function getAccessToken() {
  const basic = Buffer.from(`${NEXT_PUBLIC_PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
  const base = paypalBaseUrl(mode);
  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) {
    throw new Error(`Failed to get access token: ${res.status}`);
  }
  const data = await res.json();
  return data.access_token;
}

async function listWebhooks() {
  const base = paypalBaseUrl(mode);
  const accessToken = await getAccessToken();
  const res = await fetch(`${base}/v1/notifications/webhooks`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to list webhooks: ${res.status}`);
  }
  const data = await res.json();
  return data;
}

export async function GET() {
  try {
    // Environment check
    const envStatus = {
      NEXT_PUBLIC_PAYPAL_CLIENT_ID: !!NEXT_PUBLIC_PAYPAL_CLIENT_ID,
      PAYPAL_CLIENT_SECRET: !!PAYPAL_CLIENT_SECRET,
      PAYPAL_WEBHOOK_ID: !!PAYPAL_WEBHOOK_ID,
      PAYPAL_MODE: PAYPAL_MODE || 'default(sandbox)',
      NODE_ENV,
      resolvedMode: mode,
    };

    // PayPal API connectivity test
    let tokenTest = { success: false, error: null };
    try {
      await getAccessToken();
      tokenTest.success = true;
    } catch (e) {
      tokenTest.error = e.message;
    }

    // Webhook configuration
    let webhooksData = { success: false, error: null, webhooks: [], configuredFound: false };
    try {
      const data = await listWebhooks();
      webhooksData.success = true;
      webhooksData.webhooks = data.webhooks || [];
      
      // Check if our configured webhook ID exists
      if (PAYPAL_WEBHOOK_ID && webhooksData.webhooks.length > 0) {
        const found = webhooksData.webhooks.find(w => w.id === PAYPAL_WEBHOOK_ID);
        webhooksData.configuredFound = !!found;
        webhooksData.configuredWebhook = found || null;
      }
    } catch (e) {
      webhooksData.error = e.message;
    }

    // Database connectivity
    let dbTest = { success: false, error: null };
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('id, name')
        .limit(1);
      if (error) throw error;
      dbTest.success = true;
      dbTest.plans = data;
    } catch (e) {
      dbTest.error = e.message;
    }

    // Recent webhook events (if any)
    let recentEvents = { success: false, error: null, events: [] };
    try {
      const { data, error } = await supabase
        .from('payment_transactions')
        .select('id, paypal_event_id, paypal_order_id, status, created_at')
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      recentEvents.success = true;
      recentEvents.events = data || [];
    } catch (e) {
      recentEvents.error = e.message;
    }

    const diagnostics = {
      timestamp: new Date().toISOString(),
      environment: envStatus,
      paypalApiTest: tokenTest,
      webhookConfig: webhooksData,
      databaseTest: dbTest,
      recentWebhookEvents: recentEvents,
      recommendations: []
    };

    // Generate recommendations
    if (!tokenTest.success) {
      diagnostics.recommendations.push('❌ PayPal API authentication failed. Check CLIENT_ID and CLIENT_SECRET.');
    }
    
    if (!webhooksData.success) {
      diagnostics.recommendations.push('❌ Cannot fetch webhook list. Check PayPal credentials.');
    } else if (!webhooksData.configuredFound && PAYPAL_WEBHOOK_ID) {
      diagnostics.recommendations.push('⚠️ Configured PAYPAL_WEBHOOK_ID not found in your webhooks list.');
    } else if (webhooksData.configuredFound) {
      const webhook = webhooksData.configuredWebhook;
      diagnostics.recommendations.push(`✅ Webhook found: ${webhook.url}`);
      if (webhook.url && !webhook.url.includes('/api/webhooks/paypal')) {
        diagnostics.recommendations.push('⚠️ Webhook URL might not point to /api/webhooks/paypal');
      }
    }

    if (!dbTest.success) {
      diagnostics.recommendations.push('❌ Database connection failed. Check Supabase credentials.');
    }

    if (recentEvents.success && recentEvents.events.length === 0) {
      diagnostics.recommendations.push('ℹ️ No recent webhook events found. Try making a test payment.');
    }

    return Response.json(diagnostics, { status: 200 });

  } catch (error) {
    return Response.json({
      error: 'Debug endpoint failed',
      message: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
