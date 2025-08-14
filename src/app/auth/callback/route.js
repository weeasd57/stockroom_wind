import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';

export async function GET(request) {
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