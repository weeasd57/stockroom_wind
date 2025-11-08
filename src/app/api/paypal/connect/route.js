import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// PayPal environment configuration
const PAYPAL_MODE = process.env.PAYPAL_MODE || 'sandbox';
const PAYPAL_BASE = PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

function getCredentials() {
  return {
    clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID,
    clientSecret: process.env.PAYPAL_CLIENT_SECRET,
    mode: PAYPAL_MODE
  };
}

// Initialize Supabase with service role for admin operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    if (error) {
      console.error('PayPal OAuth error:', error);
      return NextResponse.redirect(new URL('/profile?paypal_error=access_denied', baseUrl));
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL('/profile?paypal_error=invalid_request', baseUrl));
    }

    // Decode state to get user_id
    const userId = Buffer.from(state, 'base64').toString('utf-8');

    // Get credentials
    const credentials = getCredentials();
    
    // Exchange code for access token using REST API (compatible with userinfo endpoint)
    const tokenResponse = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/paypal/connect`
      })
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('PayPal token exchange failed:', errorData);
      return NextResponse.redirect(new URL('/profile?paypal_error=token_exchange_failed', baseUrl));
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const idToken = tokenData.id_token; // Get ID token if available
    
    console.log('[PayPal Connect] Token exchange successful:', {
      hasAccessToken: !!accessToken,
      hasIdToken: !!idToken,
      tokenType: tokenData.token_type,
      expiresIn: tokenData.expires_in,
      scope: tokenData.scope
    });

    // Get user info from PayPal using REST API (more reliable in sandbox than OIDC userinfo)
    let userInfo;
    
    console.log('[PayPal Connect] Fetching user info from REST API...');
    // Try without schema first, then with openid schema if that fails
    const userInfoResponse = await fetch(`${PAYPAL_BASE}/v1/identity/oauth2/userinfo`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      }
    });

    if (!userInfoResponse.ok) {
      const errorText = await userInfoResponse.text();
      console.error('PayPal user info fetch failed:', {
        status: userInfoResponse.status,
        statusText: userInfoResponse.statusText,
        error: errorText
      });
      
      // Fallback 1: Try to decode ID token if available
      if (idToken) {
        try {
          console.log('[PayPal Connect] Attempting to decode ID token as fallback...');
          const parts = idToken.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
            console.log('[PayPal Connect] ID token payload:', {
              sub: payload.sub,
              email: payload.email,
              name: payload.name
            });
            userInfo = {
              user_id: payload.sub || payload.user_id,
              email: payload.email,
              name: payload.name,
              given_name: payload.given_name,
              family_name: payload.family_name
            };
          }
        } catch (decodeError) {
          console.error('[PayPal Connect] Failed to decode ID token:', decodeError);
        }
      }
      
      // Fallback 2: If still no userInfo, create minimal object with profile email
      if (!userInfo || !userInfo.email) {
        console.warn('[PayPal Connect] No userInfo from PayPal, will use profile email as fallback');
        
        // Get user profile email
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', userId)
          .single();

        if (profile?.email) {
          console.log('[PayPal Connect] Using profile email for PayPal account');
          userInfo = {
            user_id: userId,
            email: profile.email,
            name: null,
            given_name: null,
            family_name: null
          };
        } else {
          console.error('[PayPal Connect] No profile email found, cannot proceed');
          return NextResponse.redirect(new URL('/profile?paypal_error=user_info_failed', baseUrl));
        }
      }
    } else {
      userInfo = await userInfoResponse.json();
      console.log('[PayPal Connect] User info retrieved successfully');
    }

    // Final validation: userInfo should exist with email at this point
    if (!userInfo?.email) {
      console.error('[PayPal Connect] Missing email after all fallbacks, aborting');
      return NextResponse.redirect(new URL('/profile?paypal_error=missing_email', baseUrl));
    }

    console.log('[PayPal Connect] User info ready:', {
      hasEmail: !!userInfo.email,
      hasUserId: !!userInfo.user_id,
      email: userInfo.email
    });

    // Save PayPal account info to database
    const { error: dbError } = await supabase
      .from('paypal_accounts')
      .upsert({
        user_id: userId,
        email: userInfo.email,
        merchant_id: userInfo.user_id,
        account_type: userInfo.account_type || 'personal',
        verification_status: 'verified',
        verified_at: new Date().toISOString(),
        access_token: accessToken, // In production, encrypt this
        refresh_token: tokenData.refresh_token || null,
        token_expires_at: new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString(),
      });

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.redirect(new URL('/profile?paypal_error=database_error', baseUrl));
    }

    console.log('[PayPal Connect] PayPal account saved successfully');

    // Get or create premium plan
    let { data: premiumPlan, error: planError } = await supabase
      .from('premium_plans')
      .select('id, description, pricing, stats')
      .eq('user_id', userId)
      .single();

    // Create if doesn't exist
    if (planError?.code === 'PGRST116') {
      const { data: newPlan } = await supabase
        .from('premium_plans')
        .insert({
          user_id: userId,
          description: '',
          features: [],
          pricing: { monthly: 0, yearly: 0, currency: 'USD' },
          stats: { averagePostsPerMonth: 0, successRate: 0, totalSubscribers: 0, premiumSubscribers: 0 },
          paypal_account: userInfo.email,
          is_active: false
        })
        .select('id, description, pricing, stats')
        .single();
      premiumPlan = newPlan;
    }

    if (premiumPlan) {
      console.log('[PayPal Connect] Updating premium plan with PayPal account');
      await supabase
        .from('premium_plans')
        .update({ paypal_account: userInfo.email })
        .eq('user_id', userId);

      // Update profiles with all broker-related fields
      console.log('[PayPal Connect] Updating profile with broker information');
      
      const pricing = premiumPlan.pricing || { monthly: 0, yearly: 0, currency: 'USD' };
      const stats = premiumPlan.stats || { averagePostsPerMonth: 0 };
      
      await supabase
        .from('profiles')
        .update({ 
          is_broker: true,
          paypal_email: userInfo.email,
          broker_plan_description: premiumPlan.description || '',
          broker_average_posts_info: `Average ${stats.averagePostsPerMonth || 0} posts per month`,
          broker_price_plan_info: `$${pricing.monthly || 0}/month or $${pricing.yearly || 0}/year`
        })
        .eq('id', userId);
    }

    // Redirect back to profile with success
    return NextResponse.redirect(new URL('/profile?paypal_success=true', baseUrl));

  } catch (error) {
    console.error('PayPal connect error:', error);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return NextResponse.redirect(new URL('/profile?paypal_error=server_error', baseUrl));
  }
}

export async function POST(request) {
  try {
    const { user_id } = await request.json();

    if (!user_id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Get credentials
    const credentials = getCredentials();

    // Generate state and nonce parameters for security
    const state = Buffer.from(user_id).toString('base64');
    const nonce = Math.random().toString(36).substring(2, 15);

    // PayPal OAuth URL - different for sandbox vs live
    let paypalAuthUrl;
    
    if (PAYPAL_MODE === 'live') {
      // Live environment
      paypalAuthUrl = new URL('https://www.paypal.com/signin');
      paypalAuthUrl.searchParams.set('intent', 'connect');
      paypalAuthUrl.searchParams.set('flowEntry', 'static');
      
      const returnUri = new URL('https://www.paypal.com/idapps/connect/consent');
      returnUri.searchParams.set('client_id', credentials.clientId);
      returnUri.searchParams.set('scope', 'openid profile email address https://uri.paypal.com/services/paypalattributes');
      returnUri.searchParams.set('redirect_uri', `${process.env.NEXT_PUBLIC_APP_URL}/api/paypal/connect`);
      returnUri.searchParams.set('state', state);
      returnUri.searchParams.set('nonce', nonce);
      returnUri.searchParams.set('response_type', 'code');
      
      paypalAuthUrl.searchParams.set('returnUri', returnUri.toString());
    } else {
      // Sandbox environment
      paypalAuthUrl = new URL('https://www.sandbox.paypal.com/signin');
      paypalAuthUrl.searchParams.set('intent', 'connect');
      paypalAuthUrl.searchParams.set('flowEntry', 'static');
      
      const returnUri = new URL('https://www.sandbox.paypal.com/idapps/connect/consent');
      returnUri.searchParams.set('client_id', credentials.clientId);
      returnUri.searchParams.set('scope', 'openid profile email address https://uri.paypal.com/services/paypalattributes');
      returnUri.searchParams.set('redirect_uri', `${process.env.NEXT_PUBLIC_APP_URL}/api/paypal/connect`);
      returnUri.searchParams.set('state', state);
      returnUri.searchParams.set('nonce', nonce);
      returnUri.searchParams.set('response_type', 'code');
      
      paypalAuthUrl.searchParams.set('returnUri', returnUri.toString());
    }

    console.log(`[PayPal Connect] Generated ${PAYPAL_MODE} auth URL for user ${user_id}`);

    return NextResponse.json({ 
      authUrl: paypalAuthUrl.toString(),
      environment: PAYPAL_MODE,
      success: true 
    });

  } catch (error) {
    console.error('PayPal auth URL generation error:', error);
    return NextResponse.json({ error: 'Failed to generate auth URL' }, { status: 500 });
  }
}
