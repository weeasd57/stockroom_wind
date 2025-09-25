import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Compute HMAC-SHA256 secret derived from botId and a master secret
function deriveWebhookSecret(botId) {
  const master = process.env.TELEGRAM_WEBHOOK_MASTER_SECRET || process.env.TELEGRAM_WEBHOOK_SECRET || '';
  return crypto.createHmac('sha256', master).update(String(botId)).digest('hex');
}

function getHeaderInsensitive(headers, name) {
  // Headers in Next are case-insensitive, but to be safe
  return headers.get(name) || headers.get(name.toLowerCase()) || headers.get(name.toUpperCase()) || null;
}

async function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url) {
    throw new Error('Supabase URL missing');
  }
  if (!anonKey) {
    throw new Error('Supabase anon key missing');
  }
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function sendTelegramMessage(botToken, chatId, text, options = {}) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const payload = { chat_id: chatId, text, parse_mode: 'Markdown', ...options };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res.json();
}

export async function POST(request, { params }) {
  try {
    const { botId } = params || {};
    if (!botId) {
      return NextResponse.json({ error: 'Missing botId' }, { status: 400 });
    }

    // Validate webhook secret
    const receivedSecret = getHeaderInsensitive(request.headers, 'X-Telegram-Bot-Api-Secret-Token');
    const expectedSecret = deriveWebhookSecret(botId);
    if (!receivedSecret || receivedSecret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await getSupabaseClient();

    // Fetch bot by id
    const { data: bot, error: botErr } = await supabase
      .from('telegram_bots')
      .select('id, bot_token, bot_name, is_active')
      .eq('id', botId)
      .single();

    if (botErr || !bot || !bot.is_active) {
      return NextResponse.json({ error: 'Bot not found or inactive' }, { status: 404 });
    }

    const update = await request.json();

    if (update.message) {
      await handleMessage(supabase, bot, update.message);
    } else if (update.callback_query) {
      await handleCallbackQuery(supabase, bot, update.callback_query);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Dynamic webhook error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function handleMessage(supabase, bot, message) {
  const chatId = message.chat.id;
  const text = (message.text || '').trim();

  if (text === '/start' || text === '/subscribe') {
    await upsertSubscription(supabase, bot.id, message.from);
    await sendTelegramMessage(bot.bot_token, chatId,
      `✅ Subscribed to ${bot.bot_name}.\nUse /unsubscribe to stop notifications.`
    );
    return;
  }
  if (text === '/unsubscribe') {
    await setSubscription(supabase, bot.id, message.from.id, false);
    await sendTelegramMessage(bot.bot_token, chatId,
      `🛑 Unsubscribed from ${bot.bot_name}.`
    );
    return;
  }

  await sendTelegramMessage(bot.bot_token, chatId,
    'Commands:\n/start or /subscribe\n/unsubscribe'
  );
}

async function handleCallbackQuery(supabase, bot, callbackQuery) {
  // For now just acknowledge callbacks if added later
  const id = callbackQuery.id;
  try {
    await fetch(`https://api.telegram.org/bot${bot.bot_token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: id })
    });
  } catch {}
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
