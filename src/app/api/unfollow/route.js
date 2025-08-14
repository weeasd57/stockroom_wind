import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(req) {
  try {
    const { follower_id, following_id } = await req.json();
    
    // Create supabase client with the request context
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get the current user session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session?.user) {
      console.error('Authentication error:', sessionError?.message || 'No session found');
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    const user = session.user;
    
    // Verify that the authenticated user is the one making the unfollow request
    if (user.id !== follower_id) {
      console.error('Permission denied: user can only unfollow as themselves');
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }
    const { error } = await supabase
      .from('user_followings')
      .delete()
      .eq('follower_id', follower_id)
      .eq('following_id', following_id);

    if (error) {
      console.error('Error unfollowing user:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Successfully unfollowed' }, { status: 200 });
  } catch (error) {
    console.error('Unexpected error in unfollow API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
