import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getHeaderInsensitive(headers, name) {
  return headers.get(name) || headers.get(name.toLowerCase()) || headers.get(name.toUpperCase()) || null;
}

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url) throw new Error('Supabase URL missing');
  if (!key) throw new Error('Supabase key missing');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function tryDecodeUuidB64url(s) {
  try {
    if (!s) return null;
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    const bin = Buffer.from(b64, 'base64');
    if (bin.length !== 16) return null;
    const hex = bin.toString('hex');
    return (
      hex.substring(0,8) + '-' +
      hex.substring(8,12) + '-' +
      hex.substring(12,16) + '-' +
      hex.substring(16,20) + '-' +
      hex.substring(20)
    );
  } catch { return null; }
}

async function sendTelegramMessage(chatId, text, options = {}) {
  const token = process.env.TELEGRAMBOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, error: 'Bot token missing' };
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown', ...options })
  });
  return res.json();
}

export async function POST(request) {
  console.log('[webhook] POST received at', new Date().toISOString());
  try {
    // Validate secret header
    const received = getHeaderInsensitive(request.headers, 'X-Telegram-Bot-Api-Secret-Token');
    const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
    console.log('[webhook] Secret check:', { hasExpected: !!expected, hasReceived: !!received, match: received === expected });
    if (!expected || received !== expected) {
      console.warn('[webhook] Unauthorized: secret mismatch');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let update;
    try {
      update = await request.json();
    } catch (parseError) {
      console.error('[webhook] JSON parse error:', parseError.message);
      return NextResponse.json({ ok: true }); // Telegram expects 200 even for bad requests
    }
    
    console.log('[webhook] Update received:', JSON.stringify(update, null, 2));
    
    if (!update || typeof update !== 'object') {
      console.warn('[webhook] Invalid update structure');
      return NextResponse.json({ ok: true });
    }
    
    const supabase = getSupabaseClient();

    if (update.message) {
      console.log('[webhook] Processing message from user', update.message.from?.id);
      await handleMessage(supabase, update.message);
    } else if (update.callback_query) {
      console.log('[webhook] Callback query received (ignored)');
      // no-op for now
    } else {
      console.log('[webhook] Unknown update type');
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Webhook error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function handleMessage(supabase, message) {
  const chatId = message.chat.id;
  const text = (message.text || '').trim();
  console.log('[webhook/handleMessage] chatId:', chatId, 'text:', text);

  // /start <param>
  if (text.startsWith('/start')) {
    const parts = text.split(/\s+/);
    const raw = parts[1] || '';
    let brokerId = raw;
    let platformUserId = null;
    // Support: subscribe_<brokerId>
    if (raw.startsWith('subscribe_')) {
      brokerId = raw.slice('subscribe_'.length);
    }
    // Support compact format: s_<brokerB64>_<platformB64>
    if (raw.startsWith('s_')) {
      const segs = raw.split('_');
      if (segs.length >= 3) {
        const b = tryDecodeUuidB64url(segs[1]);
        const p = tryDecodeUuidB64url(segs[2]);
        if (b) brokerId = b;
        if (p) platformUserId = p;
      }
    }
    if (!brokerId) {
      await sendTelegramMessage(chatId, 'Please open the bot using the link from our website so we can associate you with a broker.');
      return;
    }
    const bot = await findPlatformBotForBroker(supabase, brokerId);
    if (!bot) {
      await sendTelegramMessage(chatId, 'Broker not found or bot not configured.');
      return;
    }
    console.log('[webhook/handleMessage] Upserting subscription:', { botId: bot.id, telegramUserId: message.from.id, platformUserId, brokerId });
    await upsertSubscription(supabase, bot.id, message.from, platformUserId);
    console.log('[webhook/handleMessage] Subscription upserted successfully');
    await sendTelegramMessage(chatId, `✅ Subscribed to ${bot.bot_name}. You can /unsubscribe ${brokerId} anytime.`);
    return;
  }

  // /subscribe <param>
  if (text.startsWith('/subscribe')) {
    const parts = text.split(/\s+/);
    const raw = parts[1] || '';
    let brokerId = raw;
    let platformUserId = null;
    if (raw.startsWith('subscribe_')) {
      brokerId = raw.slice('subscribe_'.length);
    }
    if (raw.startsWith('s_')) {
      const segs = raw.split('_');
      if (segs.length >= 3) {
        const b = tryDecodeUuidB64url(segs[1]);
        const p = tryDecodeUuidB64url(segs[2]);
        if (b) brokerId = b;
        if (p) platformUserId = p;
      }
    }
    if (!brokerId) {
      await sendTelegramMessage(chatId, 'Usage: /subscribe <brokerId> (open link from the website).');
      return;
    }
    const bot = await findPlatformBotForBroker(supabase, brokerId);
    if (!bot) {
      await sendTelegramMessage(chatId, 'Broker not found or bot not configured.');
      return;
    }
    await upsertSubscription(supabase, bot.id, message.from, platformUserId);
    await sendTelegramMessage(chatId, `✅ Subscribed to ${bot.bot_name}.`);
    return;
  }

  // /unsubscribe <brokerId>
  if (text.startsWith('/unsubscribe')) {
    const parts = text.split(/\s+/);
    const brokerId = parts[1];
    if (!brokerId) {
      await sendTelegramMessage(chatId, 'Usage: /unsubscribe <brokerId>');
      return;
    }
    const bot = await findPlatformBotForBroker(supabase, brokerId);
    if (!bot) {
      await sendTelegramMessage(chatId, 'Broker not found.');
      return;
    }
    await setSubscription(supabase, bot.id, message.from.id, false);
    await sendTelegramMessage(chatId, `🛑 Unsubscribed from ${bot.bot_name}.`);
    return;
  }

  await sendTelegramMessage(chatId, 'Welcome! Please start from our website link to subscribe to a broker.');
}

async function findPlatformBotForBroker(supabase, brokerUserId) {
  const { data } = await supabase
    .from('telegram_bots')
    .select('id, bot_name')
    .eq('user_id', brokerUserId)
    .eq('is_active', true)
    .maybeSingle();
  return data || null;
}

async function upsertSubscription(supabase, botId, from, platformUserId = null) {
  const now = new Date().toISOString();
  const payload = {
    bot_id: botId,
    telegram_user_id: from.id,
    telegram_username: from.username || null,
    telegram_first_name: from.first_name || null,
    telegram_last_name: from.last_name || null,
    is_subscribed: true,
    subscribed_at: now,
    last_interaction: now
  };
  if (platformUserId) {
    payload.platform_user_id = platformUserId;
  }
  await supabase
    .from('telegram_subscribers')
    .upsert(payload, { onConflict: 'bot_id,telegram_user_id' });
}

async function setSubscription(supabase, botId, telegramUserId, isSubscribed) {
  await supabase
    .from('telegram_subscribers')
    .update({ is_subscribed: isSubscribed, last_interaction: new Date().toISOString() })
    .eq('bot_id', botId)
    .eq('telegram_user_id', telegramUserId);
}
