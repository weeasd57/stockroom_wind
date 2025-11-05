import { NextResponse } from 'next/server';

/**
 * Test endpoint to verify PayPal configuration
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  
  return NextResponse.json({
    message: 'PayPal test endpoint working',
    timestamp: new Date().toISOString(),
    env: {
      hasClientId: !!process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID,
      hasClientSecret: !!process.env.PAYPAL_CLIENT_SECRET,
      mode: process.env.PAYPAL_MODE || 'sandbox',
      appUrl: process.env.NEXT_PUBLIC_APP_URL
    },
    receivedParams: Object.fromEntries(searchParams)
  });
}

export async function POST(request) {
  try {
    const body = await request.json();
    
    return NextResponse.json({
      message: 'PayPal test POST endpoint working',
      timestamp: new Date().toISOString(),
      receivedBody: body
    });
  } catch (error) {
    return NextResponse.json({
      error: error.message
    }, { status: 400 });
  }
}
