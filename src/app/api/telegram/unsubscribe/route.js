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

    // Fallback: Authorization Bearer token
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

    const { botId, brokerId } = await request.json();

    if (!botId) {
      return NextResponse.json(
        { error: 'Bot ID is required' },
        { status: 400 }
      );
    }

    // Use admin client to update subscription (avoid RLS issues)
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    const { error: unsubscribeError } = await admin
      .from('telegram_subscribers')
      .update({ 
        is_subscribed: false,
        last_interaction: new Date().toISOString()
      })
      .eq('bot_id', botId)
      .eq('platform_user_id', userId);

    if (unsubscribeError) {
      console.error('Error unsubscribing:', unsubscribeError);
      return NextResponse.json(
        { error: 'Failed to unsubscribe' },
        { status: 500 }
      );
    }

    // Optional: Send notification to Telegram bot about unsubscription
    try {
      const { data: botData } = await admin
        .from('telegram_bots')
        .select('bot_token')
        .eq('id', botId)
        .single();

      if (botData?.bot_token) {
        // Get telegram subscriber info
        const { data: telegramSubscriber } = await admin
          .from('telegram_subscribers')
          .select('telegram_user_id')
          .eq('bot_id', botId)
          .eq('platform_user_id', userId)
          .single();

        if (telegramSubscriber?.telegram_user_id) {
          // Send unsubscribe confirmation to Telegram
          await fetch(`https://api.telegram.org/bot${botData.bot_token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: telegramSubscriber.telegram_user_id,
              text: '🛑 تم إلغاء اشتراكك بنجاح من خلال الموقع.\n\nيمكنك الاشتراك مرة أخرى في أي وقت من خلال الموقع.',
              parse_mode: 'Markdown'
            })
          });
        }
      }
    } catch (notificationError) {
      // Don't fail the unsubscribe if notification fails
      console.log('Failed to send unsubscribe notification:', notificationError);
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully unsubscribed'
    });

  } catch (error) {
    console.error('Unsubscribe error:', error);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}
