import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(request) {
  try {
    // Auth via cookies first
    const cookieStore = cookies();
    let supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    let user = null;
    let authError = null;

    const cookieAuth = await supabase.auth.getUser();
    user = cookieAuth.data?.user;
    authError = cookieAuth.error;

    // Fallback to Authorization: Bearer token
    if (authError || !user) {
      const authHeader = request.headers.get('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const { createClient } = await import('@supabase/supabase-js');
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (supabaseUrl && supabaseAnonKey) {
          const tokenSupabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: `Bearer ${token}` } }
          });
          const tokenAuth = await tokenSupabase.auth.getUser();
          if (tokenAuth.data?.user && !tokenAuth.error) {
            user = tokenAuth.data.user;
            authError = null;
            supabase = tokenSupabase;
          }
        }
      }
    }

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the broker's bot row (Plan A still stores row per user)
    const { data: bot } = await supabase
      .from('telegram_bots')
      .select('id, bot_username, bot_name, is_active')
      .eq('user_id', user.id)
      .maybeSingle();

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    const expectedUrl = appUrl ? `${appUrl}/api/telegram/webhook` : null;

    const token = process.env.TELEGRAMBOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
    let tgInfo = null;
    let fetchError = null;

    if (token) {
      try {
        const r = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
        tgInfo = await r.json();
      } catch (e) {
        fetchError = e.message;
      }
    }

    const info = tgInfo?.ok ? tgInfo.result : null;
    const url = info?.url || null;
    const hasUrlMatches = !!(url && expectedUrl && url === expectedUrl);
    const lastError = info?.last_error_message || null;

    const payload = {
      ok: true,
      bot: bot ? { id: bot.id, username: bot.bot_username, name: bot.bot_name, isActive: bot.is_active } : null,
      webhook: {
        expectedUrl,
        actualUrl: url,
        hasUrlMatches,
        pendingUpdate: info?.pending_update_count ?? null,
        lastError,
        ipAddress: info?.ip_address || null,
        maxConnections: info?.max_connections || null,
      },
      secretSet: !!(process.env.TELEGRAM_WEBHOOK_SECRET),
      tokenPresent: !!token,
      inviteLink: bot?.bot_username ? `https://t.me/${bot.bot_username}?start=${user.id}` : null,
      fetchError
    };

    return NextResponse.json(payload);
  } catch (e) {
    console.error('Webhook status error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
