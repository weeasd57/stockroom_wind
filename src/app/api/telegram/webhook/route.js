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

// Extract brokerId (traderId) from commands like:
// /start <id> OR /start subscribe_<id>
// /subscribe <id> OR /subscribe subscribe_<id>
function parseBrokerIdFromText(text) {
  try {
    const parts = String(text || '').trim().split(/\s+/);
    const payload = parts[1] || '';
    if (!payload) return null;
    const m = payload.match(/^subscribe_(.+)$/i);
    return m ? m[1] : payload;
  } catch (_) {
    return null;
  }
}

export async function POST(request) {
  try {
    console.log('[Telegram Webhook] Received POST request');
    
    // Validate secret header
    const received = getHeaderInsensitive(request.headers, 'X-Telegram-Bot-Api-Secret-Token');
    const expected = process.env.TELEGRAM_WEBHOOK_SECRET || process.env.TELEGRAM_WEBHOOK_MASTER_SECRET;
    
    if (!expected) {
      console.error('[Telegram Webhook] ERROR: TELEGRAM_WEBHOOK_SECRET not set in environment');
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }
    
    if (received !== expected) {
      console.error('[Telegram Webhook] ERROR: Invalid secret token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const update = await request.json();
    console.log('[Telegram Webhook] Update received:', JSON.stringify(update, null, 2));
    
    const supabase = getSupabaseClient();

    if (update.message) {
      console.log('[Telegram Webhook] Processing message...');
      await handleMessage(supabase, update.message);
    } else if (update.callback_query) {
      console.log('[Telegram Webhook] Callback query received (no-op for now)');
    } else {
      console.log('[Telegram Webhook] Unknown update type');
    }

    console.log('[Telegram Webhook] Success - returning ok:true');
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[Telegram Webhook] ERROR:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function handleMessage(supabase, message) {
  const chatId = message.chat.id;
  const text = (message.text || '').trim();

  // /start <brokerId>
  if (text.startsWith('/start')) {
    const brokerId = parseBrokerIdFromText(text);
    if (!brokerId) {
      // Generic welcome message when no broker ID provided
      const welcomeMsg = `🦈 **Welcome to SharksZone Bot!**

To subscribe to a trader's notifications:
1. Visit our website: [sharkszone.com](${process.env.NEXT_PUBLIC_APP_URL || 'https://sharkszone.com'})
2. Go to any trader's profile
3. Click "Subscribe to Telegram" button
4. The bot will automatically subscribe you

You'll receive instant notifications about:
📊 New trading posts
💰 Price updates
🎯 Target reached
🛑 Stop loss alerts

Happy trading! 🚀`;
      await sendTelegramMessage(chatId, welcomeMsg);
      return;
    }
    const bot = await findPlatformBotForBroker(supabase, brokerId);
    if (!bot) {
      await sendTelegramMessage(chatId, '❌ Broker not found or bot not configured.\n\nPlease make sure you\'re using the correct subscription link from the website.');
      return;
    }
    await upsertSubscription(supabase, bot.id, message.from, brokerId);
    await sendTelegramMessage(chatId, `✅ **Successfully subscribed to ${bot.bot_name}!**

You'll now receive notifications about:
📊 New trading posts
💰 Price updates  
🎯 Target prices reached
🛑 Stop loss alerts

To unsubscribe: /unsubscribe ${brokerId}

Happy trading! 🚀`);
    return;
  }

  // /subscribe <brokerId>
  if (text.startsWith('/subscribe')) {
    const brokerId = parseBrokerIdFromText(text);
    if (!brokerId) {
      await sendTelegramMessage(chatId, 'Usage: /subscribe <brokerId> (open link from the website).');
      return;
    }
    const bot = await findPlatformBotForBroker(supabase, brokerId);
    if (!bot) {
      await sendTelegramMessage(chatId, 'Broker not found or bot not configured.');
      return;
    }
    await upsertSubscription(supabase, bot.id, message.from, brokerId);
    await sendTelegramMessage(chatId, `✅ Subscribed to ${bot.bot_name}.`);
    return;
  }

  // /unsubscribe <brokerId> - DISABLED: Must unsubscribe from website
  if (text.startsWith('/unsubscribe')) {
    const unsubscribeMsg = `❌ **Unsubscribe from Website**

To unsubscribe from notifications, please:
1. Visit our website: ${process.env.NEXT_PUBLIC_APP_URL || 'https://sharkszone.com'}
2. Go to the trader's profile
3. Click the "Unsubscribe from Telegram" button

This ensures your subscription status is properly managed across all platforms.

Thank you! 🙏`;
    await sendTelegramMessage(chatId, unsubscribeMsg);
    return;
  }

  // /help or unknown command
  if (text.startsWith('/help')) {
    const helpMsg = `🦈 **SharksZone Bot - Help**

**Available Commands:**
/start - Welcome message and instructions
/help - Show this help message

**How to Subscribe:**
1. Visit our website
2. Go to a trader's profile
3. Click "Subscribe to Telegram"
4. Start receiving notifications!

**Notifications you'll receive:**
📊 New trading posts
💰 Price updates
🎯 Target reached alerts
🛑 Stop loss alerts

Need more help? Visit: ${process.env.NEXT_PUBLIC_APP_URL || 'https://sharkszone.com'}`;
    await sendTelegramMessage(chatId, helpMsg);
    return;
  }

  // Default message for unknown commands
  await sendTelegramMessage(chatId, '👋 Welcome to SharksZone Bot!\n\nTo get started:\n• Send /start for instructions\n• Send /help for available commands\n\nOr subscribe via our website to start receiving trading notifications! 🚀');
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
  await supabase
    .from('telegram_subscribers')
    .upsert({
      bot_id: botId,
      telegram_user_id: from.id,
      telegram_username: from.username || null,
      telegram_first_name: from.first_name || null,
      telegram_last_name: from.last_name || null,
      platform_user_id: platformUserId || null, // Link to platform user
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

// GET endpoint to test webhook is accessible
export async function GET() {
  const hasToken = !!(process.env.TELEGRAMBOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN);
  const hasSecret = !!(process.env.TELEGRAM_WEBHOOK_SECRET || process.env.TELEGRAM_WEBHOOK_MASTER_SECRET);
  
  return NextResponse.json({
    status: 'ok',
    message: 'Telegram webhook endpoint is running',
    config: {
      botTokenSet: hasToken,
      webhookSecretSet: hasSecret,
      appUrl: process.env.NEXT_PUBLIC_APP_URL || 'not set'
    },
    timestamp: new Date().toISOString()
  });
}
