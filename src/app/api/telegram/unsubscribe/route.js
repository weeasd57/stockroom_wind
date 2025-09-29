import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url) throw new Error('Supabase URL missing');
  if (!key) throw new Error('Supabase key missing');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// Unsubscribe current user from broker's Telegram bot
export async function POST(request) {
  try {
    const { brokerId, currentUserId } = await request.json();
    
    if (!brokerId || !currentUserId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // Get broker's bot
    const { data: bot } = await supabase
      .from('telegram_bots')
      .select('id')
      .eq('user_id', brokerId)
      .eq('is_active', true)
      .maybeSingle();

    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    // Update subscription status using platform_user_id
    const { error: updateError } = await supabase
      .from('telegram_subscribers')
      .update({ 
        is_subscribed: false,
        last_interaction: new Date().toISOString()
      })
      .eq('bot_id', bot.id)
      .eq('platform_user_id', currentUserId);

    if (updateError) {
      console.error('[Telegram Unsubscribe] Error:', updateError);
      return NextResponse.json({ error: 'Failed to unsubscribe' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully unsubscribed from Telegram notifications'
    });

  } catch (error) {
    console.error('[Telegram Unsubscribe] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
