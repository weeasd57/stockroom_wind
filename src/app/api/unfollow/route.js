import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(req) {
  const { follower_id, following_id } = await req.json();
  const supabase = createRouteHandlerClient({ cookies });

  try {
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
