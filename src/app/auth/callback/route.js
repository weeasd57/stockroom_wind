import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const error = requestUrl.searchParams.get('error');
  const errorDescription = requestUrl.searchParams.get('error_description');
  
  // Handle any explicit errors
  if (error) {
    console.error('Auth callback error:', error, errorDescription);
    // Redirect to login with error message
    return NextResponse.redirect(`${requestUrl.origin}/login?error=${encodeURIComponent(errorDescription || error)}`);
  }

  // Process auth code if present
  if (code) {
    try {
      const cookieStore = cookies();
      const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
      
      // Exchange the code for a session
      const { data } = await supabase.auth.exchangeCodeForSession(code);
      
      if (data && data.session && data.session.user) {
        // Check if profile exists for this user
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', data.session.user.id)
          .single();
        
        // If no profile exists, create one
        if (!existingProfile) {
          const { error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: data.session.user.id,
              username: data.session.user.email?.split('@')[0] || `user_${Date.now().toString().slice(-6)}`,
              avatar_url: data.session.user.user_metadata?.avatar_url || null,
              created_at: new Date().toISOString(),
            });
            
          if (insertError) {
            console.error('Error creating user profile:', insertError);
          }
        }
      }
      
      // URL to redirect to after sign in process completes
      return NextResponse.redirect(`${requestUrl.origin}/profile`);
    } catch (err) {
      console.error('Error exchanging code for session:', err);
      return NextResponse.redirect(
        `${requestUrl.origin}/login?error=${encodeURIComponent('Failed to complete authentication')}`
      );
    }
  }

  // If no code and no error, just redirect to home
  return NextResponse.redirect(`${requestUrl.origin}/`);
}
