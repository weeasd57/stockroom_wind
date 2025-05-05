import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(request) {
  try {
    const { email, password, username } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    console.log('Signup API: Signing up user with email:', email);

    // Create user without requiring email confirmation
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
        emailRedirectTo: `${request.headers.get('origin')}/auth/callback`,
      }
    });

    if (error) {
      console.error('Signup API: Error creating user:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // If user was created, auto-sign them in
    if (data?.user) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (signInError) {
        console.error('Signup API: Error signing in user:', signInError);
      }
    }

    return NextResponse.json({ 
      success: true,
      user: data?.user,
      session: data?.session
    });

  } catch (error) {
    console.error('Signup API: Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
} 