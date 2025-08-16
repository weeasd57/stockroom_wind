import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request) {
  try {
    // Check if Supabase is properly configured
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({
        error: 'Database configuration not available',
        success: false
      }, { status: 503 });
    }
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    const { userId, email, username } = await request.json();

    if (!userId || !email) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log('API create-profile: Received request for user:', userId);

    // Check if profile already exists
    const { data: existingProfile, error: checkError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (checkError && !checkError.message.includes('No rows found')) {
      console.error('API create-profile: Error checking profile:', checkError);
      return NextResponse.json(
        { error: checkError.message },
        { status: 500 }
      );
    }

    if (existingProfile) {
      console.log('API create-profile: Profile already exists');
      return NextResponse.json(
        { message: 'Profile already exists' },
        { status: 200 }
      );
    }

    // Create new profile
    console.log('API create-profile: Creating profile for user:', userId);
    const now = new Date().toISOString();
    const defaultProfile = {
      id: userId,
      username: username || email.split('@')[0],
      email: email,
      created_at: now,
      updated_at: now,
      last_sign_in: now,
      success_posts: 0,
      loss_posts: 0,
      experience_score: 0,
      followers: 0,
      following: 0,
      avatar_url: '/default-avatar.svg',
      background_url: '/profile-bg.jpg',
      bio: '',
      website: '',
      favorite_markets: [],
      full_name: username || email.split('@')[0]
    };

    const { data, error } = await supabase
      .from('profiles')
      .insert([defaultProfile])
      .select();

    if (error) {
      console.error('API create-profile: Error creating profile:', error);
      
      if (error.message.includes('violates row-level security')) {
        return NextResponse.json(
          { 
            error: "Profile creation failed due to permissions. Please contact support or try again later.",
            details: error.message
          },
          { status: 403 }
        );
      }
      
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    console.log('API create-profile: Profile created successfully');
    return NextResponse.json(
      { message: 'Profile created successfully', profile: data[0] },
      { status: 201 }
    );

  } catch (error) {
    console.error('API create-profile: Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
} 