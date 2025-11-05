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

    if (error) {
      console.error('PayPal OAuth error:', error);
      return NextResponse.redirect(new URL('/profile?paypal_error=access_denied', request.url));
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL('/profile?paypal_error=invalid_request', request.url));
    }

    // Decode state to get user_id
    const userId = Buffer.from(state, 'base64').toString('utf-8');

    // Get credentials
    const credentials = getCredentials();
    
    // Exchange code for access token
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
      return NextResponse.redirect(new URL('/profile?paypal_error=token_exchange_failed', request.url));
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Get user info from PayPal
    const userInfoResponse = await fetch(`${PAYPAL_BASE}/v1/identity/oauth2/userinfo?schema=paypalv1.1`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      }
    });

    if (!userInfoResponse.ok) {
      console.error('PayPal user info fetch failed');
      return NextResponse.redirect(new URL('/profile?paypal_error=user_info_failed', request.url));
    }

    const userInfo = await userInfoResponse.json();

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
        refresh_token: tokenData.refresh_token,
        token_expires_at: new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString(),
        environment: PAYPAL_MODE,
      });

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.redirect(new URL('/profile?paypal_error=database_error', request.url));
    }

    // Redirect back to profile with success
    return NextResponse.redirect(new URL('/profile?paypal_success=true', request.url));

  } catch (error) {
    console.error('PayPal connect error:', error);
    return NextResponse.redirect(new URL('/profile?paypal_error=server_error', request.url));
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

    // Generate state parameter for security
    const state = Buffer.from(user_id).toString('base64');

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
