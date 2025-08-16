import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request) {
  // Check if Supabase is properly configured
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    // Redirect to login with error if database is not configured
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent('Database configuration not available')}`, request.url));
  }
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') || '/';

  if (code) {
    try {
      // Exchange the code for a session
      await supabase.auth.exchangeCodeForSession(code);
      
      // Redirect to the requested page or home
      return NextResponse.redirect(new URL(next, request.url));
    } catch (error) {
      console.error('Auth callback error:', error);
      // On error, redirect to login with error parameter
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent('Authentication failed')}`, request.url));
    }
  }

  // If no code is provided, redirect to home
  return NextResponse.redirect(new URL('/', request.url));
} 