import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import crypto from 'crypto';

// Validate bot token with Telegram getMe
async function validateTelegramBot(botToken) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const json = await res.json();
    return json;
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// Setup webhook if https URL is provided
async function setupTelegramWebhook(botToken, webhookUrl, secretToken) {
  try {
    if (!webhookUrl || !/^https:\/\//i.test(webhookUrl)) {
      // Telegram requires https; skip if not provided
      return { ok: true, skipped: true };
    }
    const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl, secret_token: secretToken })
    });
    const json = await res.json();
    return json;
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// Optionally set default bot commands (best-effort)
async function setupBotCommands(_supabase, _botId, botToken) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commands: [
          { command: 'start', description: 'Welcome message and setup instructions' },
          { command: 'help', description: 'Show available commands and help' }
        ]
      })
    });
    const json = await res.json();
    return json;
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export async function POST(request) {
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

    // Plan A: read bot token from environment (single platform bot)
    const botToken = process.env.TELEGRAMBOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return NextResponse.json(
        { error: 'Server misconfiguration', message: 'TELEGRAMBOT_TOKEN (or TELEGRAM_BOT_TOKEN) is not set' },
        { status: 500 }
      );
    }

    // Validate bot token
    const botInfo = await validateTelegramBot(botToken);
    if (!botInfo?.ok || !botInfo?.result) {
      return NextResponse.json(
        { error: 'Invalid bot token', message: botInfo?.error || 'getMe failed' },
        { status: 400 }
      );
    }

    const botName = botInfo.result.first_name || botInfo.result.username || 'TelegramBot';

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    const staticWebhookUrl = appUrl ? `${appUrl}/api/telegram/webhook` : null;

    // Upsert platform bot row
    const insertPayload = {
      user_id: user.id,
      bot_token: botToken,
      bot_username: botInfo.result.username || null,
      bot_name: botName,
      is_active: true,
      webhook_url: staticWebhookUrl
    };

    let { data, error } = await supabase
      .from('telegram_bots')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      // If duplicate (unique violation), return existing row for this user
      const msg = String(error?.message || '').toLowerCase();
      if (msg.includes('duplicate') || error?.code === '23505') {
        const { data: existing } = await supabase
          .from('telegram_bots')
          .select('*')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();
        if (existing) {
          data = existing;
        } else {
          return NextResponse.json(
            { error: 'Database error', message: 'Failed to create or fetch bot' },
            { status: 500 }
          );
        }
      } else {
        console.error('Error creating bot:', error);
        return NextResponse.json(
          { error: 'Database error', message: 'Failed to create bot' },
          { status: 500 }
        );
      }
    }

    const botData = data;

    // Setup static webhook (best-effort) with secret_token from env
    if (staticWebhookUrl) {
      const secret = process.env.TELEGRAM_WEBHOOK_SECRET || process.env.TELEGRAM_WEBHOOK_MASTER_SECRET || '';
      const webhookSetup = await setupTelegramWebhook(botToken, staticWebhookUrl, secret);
      if (!webhookSetup?.ok) {
        console.error('Webhook setup failed:', webhookSetup?.error || webhookSetup);
      }
    }

    // Setup commands (best-effort)
    await setupBotCommands(supabase, botData.id, botToken);

    return NextResponse.json({
      success: true,
      message: 'Bot setup completed successfully',
      bot: {
        id: botData.id,
        username: botData.bot_username,
        name: botData.bot_name,
        isActive: botData.is_active
      }
    });
  } catch (e) {
    console.error('Bot setup route error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

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

    const { data: bot } = await supabase
      .from('telegram_bots')
      .select('id, bot_username, bot_name, is_active')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!bot) {
      return NextResponse.json({ bot: null });
    }

    return NextResponse.json({
      bot: {
        id: bot.id,
        username: bot.bot_username,
        name: bot.bot_name,
        isActive: bot.is_active
      }
    });
  } catch (e) {
    console.error('Bot info GET error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
