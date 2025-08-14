import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(req) {
  try {
    const { follower_id, following_id } = await req.json();
    
    console.log('[FOLLOW API] Request received for:', { follower_id, following_id });
    
    // Create supabase client with the request context
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get the current user session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    console.log('[FOLLOW API] Session check result:', { 
      hasSession: !!session, 
      userId: session?.user?.id,
      error: sessionError?.message 
    });
    
    if (sessionError || !session?.user) {
      console.error('Authentication error:', sessionError?.message || 'No session found');
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    const user = session.user;
    
    // Verify that the authenticated user is the one making the follow request
    if (user.id !== follower_id) {
      console.error('Permission denied: user can only follow as themselves');
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    // Check if the follow relationship already exists
    const { data: existingFollow, error: existingError } = await supabase
      .from('user_followings')
      .select('id')
      .eq('follower_id', follower_id)
      .eq('following_id', following_id)
      .single();

    if (existingError && existingError.code !== 'PGRST116') { // PGRST116 is no rows found
      console.error('Error checking existing follow relationship:', existingError);
      return NextResponse.json({ error: 'Failed to check existing follow' }, { status: 500 });
    }

    if (existingFollow) {
      console.log('Follow relationship already exists.');
      return NextResponse.json({ message: 'Already following' }, { status: 200 });
    }

    // Insert the new follow relationship
    const { data, error } = await supabase
      .from('user_followings')
      .insert([
        { follower_id, following_id }
      ])
      .select(); // Select the inserted data to return it

    if (error) {
      console.error('Error inserting follow relationship:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Successfully followed', data }, { status: 200 });
  } catch (error) {
    console.error('Unexpected error in follow API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
