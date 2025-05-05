import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    // Get Supabase URL and token from environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    
    // Construct the URL to disable email confirmation
    const settingsUrl = `${supabaseUrl}/rest/v1/rpc/disable_email_confirmation`;
    
    // Make sure we found the URL
    if (!supabaseUrl) {
      return NextResponse.json(
        { error: 'Supabase URL not configured' },
        { status: 500 }
      );
    }
    
    // Provide instructions since we can't directly make this change
    return NextResponse.json({
      message: "Cannot automatically disable email confirmation",
      instructions: [
        "1. Go to Supabase Dashboard > Authentication > Email Templates",
        "2. Turn OFF 'Enable email confirmations'",
        "3. For existing users, run this SQL in the SQL Editor:",
        "UPDATE auth.users SET email_confirmed_at = NOW() WHERE email_confirmed_at IS NULL;"
      ]
    });
    
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 