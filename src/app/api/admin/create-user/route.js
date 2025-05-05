import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with SERVICE ROLE key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request) {
  try {
    // Get user data from request
    const { email, password, username } = await request.json();
    
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }
    
    console.log('Admin API: Creating user with email:', email);
    
    // Create user with admin privileges
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm the email
      user_metadata: { username }
    });
    
    if (userError) {
      console.error('Admin API: Error creating user:', userError);
      return NextResponse.json(
        { error: userError.message },
        { status: 500 }
      );
    }
    
    console.log('Admin API: User created successfully');
    
    // Create a profile for the user
    if (userData?.user?.id) {
      const userId = userData.user.id;
      const now = new Date().toISOString();
      
      console.log('Admin API: Creating profile for user:', userId);
      
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          username: username || email.split('@')[0],
          email: email,
          created_at: now,
          last_sign_in: now,
          success_posts: 0,
          loss_posts: 0,
          background_url: null,
          avatar_url: null,
          bio: null,
          website: null,
          favorite_markets: null,
          updated_at: now,
          experience_Score: 0,
          followers: 0,
          following: 0
        });
        
      if (profileError) {
        console.error('Admin API: Error creating profile:', profileError);
        // Don't fail the user creation if profile creation fails
      }
    }
    
    return NextResponse.json({ 
      success: true,
      user: userData.user
    });
    
  } catch (error) {
    console.error('Admin API: Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
} 