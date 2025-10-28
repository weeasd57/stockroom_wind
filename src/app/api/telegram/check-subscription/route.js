import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const cookieStore = cookies();
    const supabaseCookieClient = createRouteHandlerClient({ cookies: () => cookieStore });
    
    // Try cookies first
    let userId = null;
    try {
      const { data: { user }, error: authError } = await supabaseCookieClient.auth.getUser();
      if (!authError && user?.id) {
        userId = user.id;
      }
    } catch {}

    // Fallback: Authorization Bearer token from client header
    if (!userId) {
      const authHeader = request.headers.get('authorization') || request.headers.get('Authorization') || '';
      const m = authHeader.match(/^Bearer\s+(.+)$/i);
      const token = m ? m[1] : null;
      if (token) {
        const supabaseAuthClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          { global: { headers: { Authorization: `Bearer ${token}` } } }
        );
        const { data: { user }, error } = await supabaseAuthClient.auth.getUser();
        if (!error && user?.id) {
          userId = user.id;
        }
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { botId } = await request.json();

    if (!botId) {
      return NextResponse.json(
        { error: 'Bot ID is required' },
        { status: 400 }
      );
    }

    // Use an admin client to read precise subscription row (avoid RLS issues across environments)
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    const { data: subscription, error: subscriptionError } = await admin
      .from('telegram_subscribers')
      .select('is_subscribed')
      .eq('bot_id', botId)
      .eq('platform_user_id', userId)
      .maybeSingle();

    if (subscriptionError && subscriptionError.code !== 'PGRST116') {
      console.error('Error checking subscription:', subscriptionError);
      return NextResponse.json(
        { error: 'Failed to check subscription status' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      isSubscribed: subscription?.is_subscribed || false
    });

  } catch (error) {
    console.error('Check subscription error:', error);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}
