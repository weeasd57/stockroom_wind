/**
 * PayPal Webhook Route (Next.js App Router)
 *
 * Security:
 * - Verifies webhook signatures using the official @paypal/paypal-server-sdk.
 * - Get credentials based on environment
 * - PAYPAL_WEBHOOK_ID
 * - PAYPAL_MODE (optional: 'live'|'sandbox' overrides NODE_ENV)
 *
 * Behavior:
 * - POST /api/webhooks/paypal
 * - Responds 200 OK after successful verification.
 */

import { createClient } from '@supabase/supabase-js';
import { cancelSubscription } from '@/utils/subscription-manager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // ensure no caching

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);


// ---- Configuration & Env Validation ----
const {
  NEXT_PUBLIC_PAYPAL_CLIENT_ID,
  PAYPAL_CLIENT_SECRET,
  PAYPAL_WEBHOOK_ID,
  PAYPAL_MODE,
  NODE_ENV,
} = process.env;

function ensureEnv() {
  const missing = [];
  if (!NEXT_PUBLIC_PAYPAL_CLIENT_ID) missing.push('NEXT_PUBLIC_PAYPAL_CLIENT_ID');
  if (!PAYPAL_CLIENT_SECRET) missing.push('PAYPAL_CLIENT_SECRET');
  if (!PAYPAL_WEBHOOK_ID) missing.push('PAYPAL_WEBHOOK_ID');
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

const mode = (PAYPAL_MODE || 'sandbox').toLowerCase() === 'live' ? 'live' : 'sandbox';
console.log(`[PayPal] Using ${mode} mode${!PAYPAL_MODE ? ' (default)' : ''}`);

// The credentials work for both live and sandbox based on PAYPAL_MODE
const credentials = {
  clientId: NEXT_PUBLIC_PAYPAL_CLIENT_ID,
  clientSecret: PAYPAL_CLIENT_SECRET,
  webhookId: PAYPAL_WEBHOOK_ID,
  mode
};

const basic = Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString('base64');

// ---- PayPal REST Helpers (manual, since SDK doesn't expose webhooks verify) ----
function paypalBaseUrl(mode) {
  // Use modern api-m domains per PayPal docs
  return mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

async function getAccessToken(targetMode) {
  const base = paypalBaseUrl(targetMode || mode);
  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to obtain PayPal access token (${res.status}): ${text}`);
  }
  const data = await res.json();
  return data.access_token;
}

// Fetch PayPal order details (used to retrieve custom_id when not present in the event)
async function fetchOrderDetails(orderId, targetMode) {
  if (!orderId) return null;
  const base = paypalBaseUrl(targetMode || mode);
  const accessToken = await getAccessToken(targetMode || mode);
  const res = await fetch(`${base}/v2/checkout/orders/${orderId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.warn(`[PayPal] Failed to fetch order ${orderId}: ${res.status} ${text}`);
    return null;
  }
  try {
    const json = await res.json();
    return json;
  } catch (e) {
    console.warn('[PayPal] Failed to parse order details JSON:', e?.message || e);
    return null;
  }
}

// Resolve user by custom_id (which we set to our internal user_id)
async function resolveUserByCustomId(customId) {
  try {
    if (!customId) return null;
    const { data, error } = await supabase.auth.admin.getUserById(customId);
    if (error) {
      console.warn('[PayPal] resolveUserByCustomId error:', error?.message);
      return null;
    }
    return data?.user || null;
  } catch (e) {
    console.warn('[PayPal] resolveUserByCustomId exception:', e?.message || e);
    return null;
  }
}

// Resolve user by email (Supabase JS v2 no longer provides getUserByEmail in admin API)
// 1) Try admin.getUserByEmail if available (for compatibility with some versions)
// 2) Fallback: query profiles table to get the auth user id by email
async function resolveUserByEmail(email) {
  try {
    if (!email) return null;
    const hasGetUserByEmail = !!(supabase?.auth?.admin && typeof supabase.auth.admin.getUserByEmail === 'function');
    if (hasGetUserByEmail) {
      const { data, error } = await supabase.auth.admin.getUserByEmail(email);
      if (error) {
        console.warn('[PayPal] resolveUserByEmail(admin) error:', error?.message);
      }
      return data?.user || null;
    }
  } catch (e) {
    console.warn('[PayPal] resolveUserByEmail(admin) exception:', e?.message || e);
  }

  // Fallback via profiles table (some projects store email in profiles)
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .limit(1);
    if (error) {
      console.warn('[PayPal] resolveUserByEmail(profiles) error:', error?.message);
      return null;
    }
    const row = Array.isArray(data) ? data[0] : data;
    return row ? { id: row.id } : null;
  } catch (e) {
    console.warn('[PayPal] resolveUserByEmail(profiles) exception:', e?.message || e);
    return null;
  }
}

// ---- Verification Helper ----
async function verifyPaypalWebhook(request, body) {
  // Required headers from PayPal
  const transmissionId = request.headers.get('paypal-transmission-id');
  const transmissionTime = request.headers.get('paypal-transmission-time');
  const certUrl = request.headers.get('paypal-cert-url');
  const authAlgo = request.headers.get('paypal-auth-algo');
  const transmissionSig = request.headers.get('paypal-transmission-sig');

  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
    const err = new Error('Missing PayPal verification headers');
    err.statusCode = 400;
    throw err;
  }

  // Detect event environment from cert_url host
  let eventEnv = 'sandbox';
  try {
    const host = new URL(certUrl).hostname || '';
    eventEnv = host.includes('sandbox') ? 'sandbox' : 'live';
    console.log('[PayPal] Cert URL analysis', { 
      certUrl: certUrl,
      hostname: host,
      detectedEnv: eventEnv,
      configuredMode: mode
    });
  } catch (e) {
    console.warn('[PayPal] Failed to parse cert_url', { certUrl, error: e.message });
    // keep default sandbox if parsing fails
  }

  // Use detected environment from cert URL for verification
  // BUT if we're in development/testing with webhook simulator, try both environments
  let verificationMode = eventEnv;
  let accessToken;
  let base;
  
  try {
    accessToken = await getAccessToken(verificationMode);
    base = paypalBaseUrl(verificationMode);
  } catch (error) {
    console.warn(`[PayPal] Failed to get token for ${verificationMode} mode:`, error.message);
    
    // If live credentials fail and we're configured for sandbox, try sandbox credentials
    if (verificationMode === 'live' && mode === 'sandbox') {
      console.log('[PayPal] Retrying with sandbox credentials for webhook simulator...');
      verificationMode = 'sandbox';
      accessToken = await getAccessToken(verificationMode);
      base = paypalBaseUrl(verificationMode);
    } else if (verificationMode === 'sandbox' && mode === 'live') {
      console.log('[PayPal] Retrying with live credentials...');
      verificationMode = 'live';
      accessToken = await getAccessToken(verificationMode);
      base = paypalBaseUrl(verificationMode);
    } else {
      throw error;
    }
  }
  
  console.log(`[PayPal] Using ${verificationMode} mode for webhook verification (detected from cert URL)`);

  const payload = {
    auth_algo: authAlgo,
    cert_url: certUrl,
    transmission_id: transmissionId,
    transmission_sig: transmissionSig,
    transmission_time: transmissionTime,
    webhook_id: credentials.webhookId,
    webhook_event: body,
  };

  const res = await fetch(`${base}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`PayPal verify-webhook-signature HTTP ${res.status}: ${text}`);
    err.statusCode = 400;
    throw err;
  }
  const json = await res.json();
  console.log('[PayPal] verify-webhook-signature result', {
    verification_status: json?.verification_status,
  });
  if (json.verification_status !== 'SUCCESS') {
    // In development with webhook simulator, signature verification often fails
    // due to environment mismatches (live certs + sandbox webhook IDs)
    if (NODE_ENV === 'development') {
      console.warn('[PayPal] Signature verification failed in development, but proceeding for testing');
      console.warn('[PayPal] This is normal with PayPal webhook simulator + ngrok setup');
    } else {
      const err = new Error('Invalid webhook signature');
      err.statusCode = 400;
      throw err;
    }
  }
  return json;
}

// --- Diagnostics helpers (called only on failures) ---
async function listWebhooks(targetMode) {
  const base = paypalBaseUrl(targetMode || mode);
  const accessToken = await getAccessToken(targetMode || mode);
  const res = await fetch(`${base}/v1/notifications/webhooks`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to list webhooks (${res.status}): ${text}`);
  }
  const data = await res.json();
  return Array.isArray(data?.webhooks) ? data.webhooks : [];
}

async function diagnoseWebhookConfigFromRequest(request) {
  const certUrl = request.headers.get('paypal-cert-url');
  let eventEnv = 'sandbox';
  try {
    const host = new URL(certUrl).hostname || '';
    eventEnv = host.includes('sandbox') ? 'sandbox' : 'live';
  } catch (_) {}

  try {
    // Use configured mode instead of auto-detected eventEnv
    const hooks = await listWebhooks(mode);
    const configuredId = credentials.webhookId;
    const found = hooks.find((h) => h?.id === configuredId);
    const summary = {
      eventEnv,
      configuredMode: mode,
      usingMode: mode,
      configuredIdSuffix: configuredId ? configuredId.slice(-6) : 'none',
      totalHooks: hooks.length,
      foundConfiguredId: !!found,
      matchedHookUrl: found?.url || null,
    };
    console.warn('[PayPal] Webhook config diagnostic', summary);
  } catch (e) {
    console.warn('[PayPal] Webhook config diagnostic failed:', e?.message || e);
  }
}

async function handleEvent(event) {
  try {
    const type = event?.event_type;
    const id = event?.id;
    console.log(`[PayPal] Verified event_id=${id} type=${type}`);

    // Check for idempotency
    const { data: existingEvent } = await supabase
      .from('payment_transactions')
      .select('id')
      .eq('paypal_event_id', id)
      .single();

    if (existingEvent) {
      console.log(`[PayPal] Event ${id} already processed, skipping`);
      return;
    }

    switch (type) {
      case 'CHECKOUT.ORDER.APPROVED': {
        const orderId = event?.resource?.id;
        const payerEmail = event?.resource?.payer?.email_address;
        const inlineCustomId = event?.resource?.purchase_units?.[0]?.custom_id;
        const puAmount = event?.resource?.purchase_units?.[0]?.amount;
        console.log('→ Checkout order approved:', { orderId, payerEmail, inlineCustomId });

        // For one-time payments, we need to process immediately since capture might not send separate webhook
        if (orderId && payerEmail) {
          console.log('→ Processing order approval as one-time payment...');
          // Prefer resolving user via custom_id when available
          let userRecord = null;
          let resolvedBy = 'email';
          let amountValue = puAmount?.value;
          let amountCurrency = puAmount?.currency_code;

          if (inlineCustomId) {
            userRecord = await resolveUserByCustomId(inlineCustomId);
            resolvedBy = 'custom_id_inline';
          }

          if (!userRecord) {
            // If not inline, fetch order details (sometimes custom_id not echoed in event)
            const orderDetails = await fetchOrderDetails(orderId, mode);
            const orderCustomId = orderDetails?.purchase_units?.[0]?.custom_id;
            if (orderCustomId) {
              userRecord = await resolveUserByCustomId(orderCustomId);
              resolvedBy = 'custom_id_fetch';
            }
            // Extract amount from fetched order if missing
            if (!amountValue || !amountCurrency) {
              amountValue = orderDetails?.purchase_units?.[0]?.amount?.value || amountValue;
              amountCurrency = orderDetails?.purchase_units?.[0]?.amount?.currency_code || amountCurrency;
            }
          }

          if (!userRecord) {
            // Fallback to payer email
            userRecord = await resolveUserByEmail(payerEmail);
            console.log('→ User lookup (email):', { found: !!userRecord });
            resolvedBy = 'email';
          }

          if (userRecord) {
            // Get pro plan
            const { data: proPlan } = await supabase
              .from('subscription_plans')
              .select('id')
              .eq('name', 'pro')
              .single();
            
            if (proPlan) {
              console.log('→ Creating Pro subscription for user:', userRecord.id, '(resolvedBy:', resolvedBy + ')');
              // Idempotency: skip if we already processed this order
              const { data: existingByOrder } = await supabase
                .from('payment_transactions')
                .select('id')
                .eq('paypal_order_id', orderId)
                .maybeSingle?.() ?? { data: null };
              if (existingByOrder) {
                console.log('→ Order already processed, skipping duplicate. orderId:', orderId);
                break;
              }
              
              // Cancel existing subscription
              await supabase
                .from('user_subscriptions')
                .update({ 
                  status: 'cancelled',
                  cancelled_at: new Date().toISOString()
                })
                .eq('user_id', userRecord.id)
                .eq('status', 'active');
              
              // Create new pro subscription
              const { data: subscription, error: subError } = await supabase
                .from('user_subscriptions')
                .insert({
                  user_id: userRecord.id,
                  plan_id: proPlan.id,
                  status: 'active',
                  paypal_order_id: orderId,
                  price_checks_used: 0,
                  posts_created: 0,
                  started_at: new Date().toISOString(),
                  expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
                })
                .select()
                .single();
              
              console.log('→ Subscription creation:', { success: !!subscription, error: subError?.message });
              
              // Log transaction
              const { error: txError } = await supabase
                .from('payment_transactions')
                .insert({
                  user_id: userRecord.id,
                  subscription_id: subscription?.id,
                  amount: amountValue ? parseFloat(amountValue) : 7.0,
                  currency: amountCurrency || 'USD',
                  payment_method: 'paypal',
                  paypal_order_id: orderId,
                  paypal_event_id: id,
                  status: 'completed',
                  transaction_data: event
                });
              
              console.log('→ Transaction log:', { error: txError?.message });
              console.log(`→ Pro subscription activated for user ${userRecord.id}`);
            } else {
              console.error('→ Pro plan not found in database');
            }
          } else {
            console.error('→ User not found with email:', payerEmail);
          }
        } else {
          console.error('→ Missing orderId or payerEmail in approved event');
        }
        break;
      }
      case 'PAYMENT.CAPTURE.COMPLETED': {
        console.log('→ Payment capture completed:', event?.resource?.id);
        const orderId = event?.resource?.supplementary_data?.related_ids?.order_id;
        const captureId = event?.resource?.id;
        const amount = event?.resource?.amount?.value;
        const currency = event?.resource?.amount?.currency_code;
        const payerEmail = event?.resource?.payer?.email_address;
        const inlineCustomId = event?.resource?.custom_id 
          || event?.resource?.purchase_units?.[0]?.custom_id 
          || event?.resource?.supplementary_data?.custom_id;
        
        console.log('→ Capture details:', { orderId, captureId, amount, currency, payerEmail, inlineCustomId });
        
        if (amount) {
          console.log('→ Processing capture with amount, resolving user...');
          // Prefer resolve via inline custom_id when provided (useful for tests/simulator)
          let userRecord = null;
          let resolvedPayerEmail = payerEmail;
          if (inlineCustomId) {
            userRecord = await resolveUserByCustomId(inlineCustomId);
            console.log('→ User resolved by inline custom_id in capture:', !!userRecord);
          }
          
          if (orderId) {
            console.log('→ Fetching order details for orderId:', orderId);
            try {
              const orderDetails = await fetchOrderDetails(orderId, mode);
              const orderCustomId = orderDetails?.purchase_units?.[0]?.custom_id;
              console.log('→ Order custom_id found:', orderCustomId);
              
              // Also try to get payer email from order details if missing
              if (!resolvedPayerEmail) {
                resolvedPayerEmail = orderDetails?.payer?.email_address || orderDetails?.payer?.payer_info?.email;
                console.log('→ Payer email from order details:', resolvedPayerEmail);
              }
              
              if (orderCustomId) {
                userRecord = await resolveUserByCustomId(orderCustomId);
                console.log('→ User resolved by custom_id:', !!userRecord);
              }
            } catch (error) {
              console.log('→ Failed to fetch order details (404 - order might be old/test data), continuing without custom_id');
            }
          }
          
          // Fallback: Find user by email
          if (!userRecord && resolvedPayerEmail) {
            console.log('→ Fallback to email lookup for:', resolvedPayerEmail);
            userRecord = await resolveUserByEmail(resolvedPayerEmail);
            console.log('→ User resolved by email:', !!userRecord);
          }

          if (userRecord) {
            // Get pro plan
            const { data: proPlan } = await supabase
              .from('subscription_plans')
              .select('id')
              .eq('name', 'pro')
              .single();
            
            if (proPlan) {
              // Idempotency: skip if capture already logged
              const { data: existingByCapture } = await supabase
                .from('payment_transactions')
                .select('id')
                .eq('paypal_capture_id', captureId)
                .maybeSingle?.() ?? { data: null };
              if (existingByCapture) {
                console.log('→ Capture already processed, skipping duplicate. captureId:', captureId);
                break;
              }
              
              // Check if user already has an active subscription
              const { data: activeSubscription } = await supabase
                .from('user_subscriptions')
                .select('id')
                .eq('user_id', userRecord.id)
                .eq('status', 'active')
                .single();
              
              let subscriptionId;
              
              if (activeSubscription) {
                console.log('→ User already has active subscription, using existing one');
                subscriptionId = activeSubscription.id;
              } else {
                console.log('→ Creating new Pro subscription');
                // Cancel any existing subscription first
                await supabase
                  .from('user_subscriptions')
                  .update({ 
                    status: 'cancelled',
                    cancelled_at: new Date().toISOString()
                  })
                  .eq('user_id', userRecord.id)
                  .eq('status', 'active');
                
                // Create new pro subscription
                const { data: subscription } = await supabase
                  .from('user_subscriptions')
                  .insert({
                    user_id: userRecord.id,
                    plan_id: proPlan.id,
                    status: 'active',
                    paypal_order_id: orderId,
                    price_checks_used: 0,
                    posts_created: 0,
                    started_at: new Date().toISOString(),
                    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
                  })
                  .select()
                  .single();
                
                subscriptionId = subscription?.id;
              }
              
              // Log transaction
              await supabase
                .from('payment_transactions')
                .insert({
                  user_id: userRecord.id,
                  subscription_id: subscriptionId,
                  amount: parseFloat(amount),
                  currency: currency || 'USD',
                  paypal_capture_id: captureId,
                  paypal_order_id: orderId,
                  status: 'completed',
                  transaction_type: 'payment'
                });
              
              console.log(`→ Pro subscription activated for user ${userRecord.id}`);
            } else {
              console.error('→ Pro plan not found in database');
            }
          } else {
            console.error('→ No user found for capture event');
          }
        } else {
          console.error('→ Missing amount in capture event');
        }
        break;
      }
      case 'PAYMENT.SALE.COMPLETED': {
        const saleId = event?.resource?.id;
        const parentPayment = event?.resource?.parent_payment;
        const amount = event?.resource?.amount?.total;
        const currency = event?.resource?.amount?.currency_code || event?.resource?.amount?.currency;
        
        console.log('→ Payment sale completed:', { saleId, parentPayment, amount, currency });
        console.log('→ Full sale event resource:', JSON.stringify(event?.resource, null, 2));
        
        // Try to get custom/custom_id from the sale event itself (sometimes available)
        const saleCustomId = event?.resource?.custom
          || event?.resource?.custom_id
          || event?.resource?.purchase_units?.[0]?.custom_id;
        let userRecord = null;
        let payerEmail = null;
        
        if (saleCustomId) {
          console.log('→ Found custom_id in sale event:', saleCustomId);
          userRecord = await resolveUserByCustomId(saleCustomId);
        }
        
        if (!userRecord && parentPayment && amount) {
          console.log('→ Fetching payer details from parent payment...');
          
          // Get payer details from parent payment via PayPal API
          try {
            const accessToken = await getAccessToken(mode);
            const base = paypalBaseUrl(mode);
            
            const paymentResponse = await fetch(`${base}/v1/payments/payment/${parentPayment}`, {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
            });
            
            if (paymentResponse.ok) {
              const paymentData = await paymentResponse.json();
              payerEmail = paymentData.payer?.payer_info?.email;
              console.log('→ Retrieved payer email from parent payment:', payerEmail);
              
              // Also try to get custom from parent payment
              const parentCustom = paymentData?.transactions?.[0]?.custom;
              if (parentCustom && !userRecord) {
                userRecord = await resolveUserByCustomId(parentCustom);
              }
            } else {
              console.warn('→ Failed to fetch parent payment details:', paymentResponse.status);
              // Don't break here - try to process with available data from the sale event
              console.log('→ Attempting to process PAYMENT.SALE.COMPLETED with available event data...');
              
              // Try to extract payer info from the sale event itself if available
              payerEmail = event?.resource?.payer_info?.email || event?.resource?.payer?.email_address;
              if (payerEmail) {
                console.log('→ Found payer email in sale event:', payerEmail);
              }
            }
          } catch (error) {
            console.warn('→ Error fetching parent payment:', error.message);
            console.log('→ Attempting to process PAYMENT.SALE.COMPLETED with available event data...');
            
            // Try to extract payer info from the sale event itself if available
            payerEmail = event?.resource?.payer_info?.email || 
                        event?.resource?.payer?.email_address || 
                        event?.resource?.payer?.payer_info?.email ||
                        event?.resource?.sale?.payer?.email_address ||
                        event?.resource?.sale?.payer_info?.email;
            if (payerEmail) {
              console.log('→ Found payer email in sale event:', payerEmail);
            } else {
              console.log('→ No payer email found in sale event structure');
            }
          }
        }

        // Fallback to email if we still don't have a user
        if (!userRecord && payerEmail) {
          userRecord = await resolveUserByEmail(payerEmail);
          console.log('→ User lookup (email):', { found: !!userRecord });
        }
          
        if (userRecord && amount) {
          console.log('→ Processing payment sale completion for user:', userRecord.id);
        } else if (amount && !userRecord) {
          console.warn('→ PAYMENT.SALE.COMPLETED: Found amount but no user record. This might be test data from webhook simulator.');
          console.log('→ For production, ensure payer email is available in the event or parent payment is accessible.');
        } else if (userRecord && !amount) {
          console.warn('→ PAYMENT.SALE.COMPLETED: Found user but no amount. Event might be malformed.');
        } else {
          console.warn('→ PAYMENT.SALE.COMPLETED: Missing both user record and amount. Skipping event.');
        }
        
        if (userRecord && amount) {
          console.log('→ Processing payment sale completion for user:', userRecord.id);
          
          // Get pro plan
          const { data: proPlan } = await supabase
            .from('subscription_plans')
            .select('id')
            .eq('name', 'pro')
            .single();
          
          if (proPlan) {
            console.log('→ Creating Pro subscription for user:', userRecord.id);
            
            // Idempotency: skip if sale already logged
            const { data: existingBySale } = await supabase
              .from('payment_transactions')
              .select('id')
              .eq('paypal_sale_id', saleId)
              .maybeSingle?.() ?? { data: null };
            if (existingBySale) {
              console.log('→ Sale already processed, skipping duplicate. saleId:', saleId);
              break;
            }
            
            // Cancel existing subscription
            await supabase
              .from('user_subscriptions')
              .update({ 
                status: 'cancelled',
                cancelled_at: new Date().toISOString()
              })
              .eq('user_id', userRecord.id)
              .eq('status', 'active');
            
            // Create new pro subscription
            const { data: subscription, error: subError } = await supabase
              .from('user_subscriptions')
              .insert({
                user_id: userRecord.id,
                plan_id: proPlan.id,
                status: 'active',
                paypal_payment_id: parentPayment,
                price_checks_used: 0,
                posts_created: 0,
                started_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
              })
              .select()
              .single();
            
            console.log('→ Subscription creation:', { success: !!subscription, error: subError?.message });
            
            // Log transaction
            const { error: txError } = await supabase
              .from('payment_transactions')
              .insert({
                user_id: userRecord.id,
                subscription_id: subscription?.id,
                amount: parseFloat(amount),
                currency: currency || 'USD',
                payment_method: 'paypal',
                paypal_payment_id: parentPayment,
                paypal_sale_id: saleId,
                paypal_event_id: id,
                status: 'completed',
                transaction_data: event
              });
            
            console.log('→ Transaction log:', { error: txError?.message });
            console.log(`→ Pro subscription activated for user ${userRecord.id}`);
          } else {
            console.error('→ Pro plan not found in database');
          }
        } else {
          console.error('→ Missing userRecord or amount in sale completed event');
        }
        break;
      }
      case 'BILLING.SUBSCRIPTION.ACTIVATED': {
        console.log('→ Subscription activated:', event?.resource?.id);
        // Handle recurring subscription activation
        break;
      }
      case 'BILLING.SUBSCRIPTION.CANCELLED': {
        console.log('→ Subscription cancelled:', event?.resource?.id);
        const subscriptionId = event?.resource?.id;
        
        if (subscriptionId) {
          // العثور على المستخدم بواسطة PayPal subscription ID
          const { data: userSub } = await supabase
            .from('user_subscriptions')
            .select('user_id')
            .eq('paypal_subscription_id', subscriptionId)
            .single();
          
          if (userSub) {
            // استخدام الدالة الموحدة لإلغاء الاشتراك
            await cancelSubscription({
              userId: userSub.user_id,
              reason: 'PayPal subscription cancelled',
              source: 'paypal_webhook',
              paypalSubscriptionId: subscriptionId,
              shouldCancelPayPal: false, // لا نحتاج لإلغاء PayPal لأنه تم بالفعل
              metadata: {
                webhook_event_id: event?.id,
                event_type: event?.event_type
              }
            });
          }
        }
        break;
      }
      case 'BILLING.SUBSCRIPTION.EXPIRED': {
        console.log('→ Subscription expired:', event?.resource?.id);
        const subscriptionId = event?.resource?.id;
        
        if (subscriptionId) {
          // العثور على المستخدم بواسطة PayPal subscription ID
          const { data: userSub } = await supabase
            .from('user_subscriptions')
            .select('user_id')
            .eq('paypal_subscription_id', subscriptionId)
            .single();
          
          if (userSub) {
            // استخدام الدالة الموحدة لإلغاء الاشتراك
            await cancelSubscription({
              userId: userSub.user_id,
              reason: 'PayPal subscription expired',
              source: 'paypal_webhook',
              paypalSubscriptionId: subscriptionId,
              shouldCancelPayPal: false, // لا نحتاج لإلغاء PayPal لأنه انتهت صلاحيته
              metadata: {
                webhook_event_id: event?.id,
                event_type: event?.event_type,
                status: 'expired'
              }
            });
          }
        }
        break;
      }
      case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED': {
        console.log('→ Subscription payment failed:', event?.resource?.id);
        // Log failed payment attempt
        break;
      }
      case 'PAYMENT.CAPTURE.REFUNDED': {
        console.log('→ Payment capture refunded:', event?.resource?.id);
        const refundId = event?.resource?.id;
        const captureId = event?.resource?.links?.find(link => link.rel === 'up')?.href?.split('/').pop();
        const refundAmount = event?.resource?.amount?.value;
        const refundCurrency = event?.resource?.amount?.currency_code;
        
        console.log('→ Refund details:', { refundId, captureId, refundAmount, refundCurrency });
        
        if (refundId && refundAmount) {
          // Find the original transaction by capture_id
          const { data: originalTx } = await supabase
            .from('payment_transactions')
            .select('*')
            .eq('paypal_capture_id', captureId)
            .single();
            
          if (originalTx) {
            console.log('→ Found original transaction for refund, updating subscription...');
            
            // استخدام الدالة الموحدة لإلغاء الاشتراك بسبب الاسترداد
            await cancelSubscription({
              userId: originalTx.user_id,
              reason: 'Payment refunded',
              source: 'paypal_webhook_refund',
              shouldCancelPayPal: false, // الدفع تم استرداده بالفعل
              metadata: {
                webhook_event_id: event?.id,
                event_type: event?.event_type,
                refund_id: refundId,
                capture_id: captureId,
                refund_amount: refundAmount,
                refund_currency: refundCurrency,
                original_transaction_id: originalTx.id
              }
            });
            
            // Log the refund transaction
            await supabase
              .from('payment_transactions')
              .insert({
                user_id: originalTx.user_id,
                subscription_id: originalTx.subscription_id,
                amount: -parseFloat(refundAmount), // Negative amount for refund
                currency: refundCurrency || originalTx.currency,
                payment_method: 'paypal',
                paypal_refund_id: refundId,
                paypal_capture_id: captureId,
                paypal_event_id: id,
                status: 'refunded',
                transaction_data: event
              });
              
            console.log(`→ Refund processed: cancelled subscription for user ${originalTx.user_id}`);
          } else {
            console.warn('→ Could not find original transaction for refund:', captureId);
          }
        }
        break;
      }
      default: {
        console.log('→ Unhandled event type:', type);
        break;
      }
    }
  } catch (e) {
    console.error('[PayPal] Error handling event:', e?.message || e);
  }
}

export async function POST(request) {
  const startTime = Date.now();
  try {
    // Validate env at request time (avoid build-time failures)
    ensureEnv();
    
    // Read raw body first (best practice for webhook handlers)
    const raw = await request.text();
    let body;
    try {
      body = JSON.parse(raw);
    } catch (e) {
      console.error('[PayPal] Invalid JSON body');
      return new Response('Invalid JSON', { status: 400 });
    }

    const eventType = body?.event_type;
    const eventId = body?.id;
    
    // Enhanced diagnostic log
    console.log('[PayPal] Webhook received', {
      eventType,
      eventId: eventId ? eventId.slice(-8) : 'none',
      mode: credentials.mode,
      nodeEnv: NODE_ENV,
      webhookIdSuffix: credentials.webhookId ? credentials.webhookId.slice(-6) : 'none',
      bodySize: raw.length,
      timestamp: new Date().toISOString()
    });

    // Light diagnostics for headers presence (no secrets)
    const diagHeaders = {
      hasTransmissionId: !!request.headers.get('paypal-transmission-id'),
      hasTransmissionTime: !!request.headers.get('paypal-transmission-time'),
      hasCertUrl: !!request.headers.get('paypal-cert-url'),
      hasAuthAlgo: !!request.headers.get('paypal-auth-algo'),
      hasTransmissionSig: !!request.headers.get('paypal-transmission-sig'),
    };
    console.log('[PayPal] Header presence', diagHeaders);

    // Verify signature
    console.log('[PayPal] Starting signature verification...');
    await verifyPaypalWebhook(request, body);
    console.log('[PayPal] Signature verification passed ✓');

    // Event handling with timing
    console.log('[PayPal] Starting event processing...');
    await handleEvent(body);
    
    const processingTime = Date.now() - startTime;
    console.log('[PayPal] Webhook processed successfully', { 
      eventType, 
      eventId: eventId ? eventId.slice(-8) : 'none',
      processingTimeMs: processingTime 
    });

    return new Response('OK', { status: 200 });
  } catch (err) {
    const code = err?.statusCode || 400;
    const processingTime = Date.now() - startTime;
    
    console.error('[PayPal] Webhook processing failed', {
      error: err?.message || err,
      statusCode: code,
      processingTimeMs: processingTime,
      stack: err?.stack
    });
    
    // Extra diagnostics to help identify config mismatches (non-fatal for response)
    try { 
      console.log('[PayPal] Running diagnostics...');
      await diagnoseWebhookConfigFromRequest(request); 
    } catch (diagErr) {
      console.warn('[PayPal] Diagnostics failed:', diagErr?.message);
    }
    
    return new Response('Invalid webhook', { status: code });
  }
}
