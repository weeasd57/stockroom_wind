import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getHeaderInsensitive(headers, name) {
  return headers.get(name) || headers.get(name.toLowerCase()) || headers.get(name.toUpperCase()) || null;
}

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url) throw new Error('Supabase URL missing');
  if (!key) throw new Error('Supabase anon key missing');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
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
  try {
    // Validate secret header
    const received = getHeaderInsensitive(request.headers, 'X-Telegram-Bot-Api-Secret-Token');
    const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!expected || received !== expected) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const update = await request.json();
    const supabase = getSupabaseClient();

    if (update.message) {
      await handleMessage(supabase, update.message);
    } else if (update.callback_query) {
      // no-op for now
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

  // /start <brokerId>
  if (text.startsWith('/start')) {
    const parts = text.split(/\s+/);
    const brokerId = parts[1];
    if (!brokerId) {
      await sendTelegramMessage(chatId, 'Please open the bot using the link from our website so we can associate you with a broker.');
      return;
    }
    const bot = await findPlatformBotForBroker(supabase, brokerId);
    if (!bot) {
      await sendTelegramMessage(chatId, 'Broker not found or bot not configured.');
      return;
    }
    await upsertSubscription(supabase, bot.id, message.from);
    await sendTelegramMessage(chatId, `✅ Subscribed to ${bot.bot_name}. You can /unsubscribe ${brokerId} anytime.`);
    return;
  }

  // /subscribe <brokerId>
  if (text.startsWith('/subscribe')) {
    const parts = text.split(/\s+/);
    const brokerId = parts[1];
    if (!brokerId) {
      await sendTelegramMessage(chatId, 'Usage: /subscribe <brokerId> (open link from the website).');
      return;
    }
    const bot = await findPlatformBotForBroker(supabase, brokerId);
    if (!bot) {
      await sendTelegramMessage(chatId, 'Broker not found or bot not configured.');
      return;
    }
    await upsertSubscription(supabase, bot.id, message.from);
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

async function upsertSubscription(supabase, botId, from) {
  const now = new Date().toISOString();
  await supabase
    .from('telegram_subscribers')
    .upsert({
      bot_id: botId,
      telegram_user_id: from.id,
      telegram_username: from.username || null,
      telegram_first_name: from.first_name || null,
      telegram_last_name: from.last_name || null,
      is_subscribed: true,
      subscribed_at: now,
      last_interaction: now
    }, { onConflict: 'bot_id,telegram_user_id' });
}

async function setSubscription(supabase, botId, telegramUserId, isSubscribed) {
  await supabase
    .from('telegram_subscribers')
    .update({ is_subscribed: isSubscribed, last_interaction: new Date().toISOString() })
    .eq('bot_id', botId)
    .eq('telegram_user_id', telegramUserId);
}
