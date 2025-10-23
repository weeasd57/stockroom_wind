import { createClient } from '@supabase/supabase-js';

// Use anon key for API routes
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Simple in-memory rate limiter per user (window resets per server instance)
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_COUNT = 10; // max requests per window
const rateLimit = new Map(); // userId -> { count, windowStart }

export async function POST(request) {
  try {
    // Validate environment configuration
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return Response.json({ success: false, error: 'Supabase env vars are not configured' }, { status: 500 });
    }
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      return Response.json({ success: false, error: 'TELEGRAM_BOT_TOKEN is not configured' }, { status: 500 });
    }

    // Authenticate request via Supabase Bearer token
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return Response.json({ success: false, error: 'Unauthorized: missing Bearer token' }, { status: 401 });
    }

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return Response.json({ success: false, error: 'Unauthorized: invalid token' }, { status: 401 });
    }
    const userId = userData.user.id;

    // Basic rate limiting per user
    const now = Date.now();
    const entry = rateLimit.get(userId) || { count: 0, windowStart: now };
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
      entry.count = 0;
      entry.windowStart = now;
    }
    entry.count += 1;
    rateLimit.set(userId, entry);
    if (entry.count > RATE_LIMIT_COUNT) {
      return Response.json({ success: false, error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const data = await request.json();

    // Never trust body.user_id; always use derived userId
    console.log(`[Telegram Historical API] Processing notification for user ${userId}, type: ${data?.type}`);

    // Get user's Telegram subscription info
    const { data: subscription, error: subError } = await supabase
      .from('telegram_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (subError || !subscription) {
      console.log(`[Telegram Historical API] No active Telegram subscription found for user ${userId}`);
      return Response.json({ 
        error: 'No active Telegram subscription found', 
        success: false 
      }, { status: 404 });
    }

    // Format message based on activity type
    let message = '';
    let messageType = 'historical_activity';

    switch (data.type) {
      case 'action':
        message = `🔔 *Trading Signal Alert*\n\n`;
        message += `${data.action_type === 'buy' ? '💰 BUY' : '📈 SELL'} Signal for *${data.symbol}*\n`;
        message += `Company: ${data.company_name}\n`;
        message += `Current Price: $${data.current_price}\n`;
        if (data.target_price) message += `Target: $${data.target_price}\n`;
        if (data.stop_loss_price) message += `Stop Loss: $${data.stop_loss_price}\n`;
        message += `\nTime: ${new Date(data.timestamp).toLocaleString()}`;
        messageType = 'trading_signal';
        break;

      case 'comment':
        message = `💬 *New Comment Alert*\n\n`;
        message += `Comment on *${data.symbol}* (${data.company_name})\n\n`;
        message += `"${data.content}"\n\n`;
        message += `Time: ${new Date(data.timestamp).toLocaleString()}`;
        messageType = 'comment_alert';
        break;

      case 'closed-post':
        message = `📋 *Position Closed*\n\n`;
        message += `*${data.symbol}* - ${data.company_name}\n`;
        if (data.target_reached) {
          message += `🎯 *TARGET HIT!*\n`;
          message += `Target Price: $${data.target_price}\n`;
        } else if (data.stop_loss_triggered) {
          message += `🛑 *STOP LOSS TRIGGERED*\n`;
          message += `Stop Loss: $${data.stop_loss_price}\n`;
        } else {
          message += `📋 *Manual Close*\n`;
        }
        message += `Final Price: $${data.current_price}\n`;
        message += `\nTime: ${new Date(data.timestamp).toLocaleString()}`;
        messageType = 'position_closed';
        break;

      case 'price-check':
        message = `💹 *Price Update*\n\n`;
        message += `*${data.symbol}* - ${data.company_name}\n`;
        message += `Current Price: $${data.current_price}\n`;
        if (data.target_price) message += `Target: $${data.target_price}\n`;
        if (data.stop_loss_price) message += `Stop Loss: $${data.stop_loss_price}\n`;
        if (data.status_message) message += `Status: ${data.status_message}\n`;
        
        if (data.target_reached) {
          message += `\n🎯 *TARGET REACHED!*`;
        } else if (data.stop_loss_triggered) {
          message += `\n🛑 *STOP LOSS TRIGGERED!*`;
        }
        
        message += `\nLast Check: ${new Date(data.timestamp).toLocaleString()}`;
        messageType = 'price_update';
        break;

      default:
        // For price_check_group and other complex types
        message = `📊 *Price Check Results*\n\n`;
        if (data.posts && data.posts.length > 0) {
          message += `Checked ${data.posts.length} position(s):\n\n`;
          data.posts.forEach((post, index) => {
            message += `${index + 1}. *${post.symbol}* - $${post.current_price}`;
            if (post.target_reached) message += ` 🎯`;
            if (post.stop_loss_triggered) message += ` 🛑`;
            message += `\n`;
          });
        } else {
          message += data.message || 'Price check completed';
        }
        message += `\nTime: ${new Date(data.timestamp).toLocaleString()}`;
        messageType = 'price_check_results';
    }

    // Send to Telegram bot
    const telegramResponse = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: subscription.chat_id,
        text: message,
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      })
    });

    const telegramResult = await telegramResponse.json();

    if (!telegramResult.ok) {
      throw new Error(`Telegram API error: ${telegramResult.description}`);
    }

    // Log the notification
    const { error: logError } = await supabase
      .from('telegram_notifications')
      .insert({
        user_id: userId,
        chat_id: subscription.chat_id,
        message_type: messageType,
        message_content: message,
        telegram_message_id: telegramResult.result.message_id,
        status: 'sent',
        metadata: {
          activity_type: data.type,
          symbol: data.symbol,
          historical: true,
          sent_at: new Date().toISOString()
        }
      });

    if (logError) {
      console.warn('[Telegram Historical API] Failed to log notification:', logError);
    }

    console.log(`[Telegram Historical API] ✅ Historical notification sent successfully for ${data.type}: ${data.symbol}`);

    return Response.json({
      success: true,
      message: 'Historical notification sent successfully',
      telegram_message_id: telegramResult.result.message_id,
      activity_type: data.type,
      symbol: data.symbol
    });

  } catch (error) {
    console.error('[Telegram Historical API] ❌ Error sending notification:', error);
    
    return Response.json({
      success: false,
      error: error.message || 'Failed to send Telegram notification',
      details: error.stack
    }, { status: 500 });
  }
}
