import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { 
      title, 
      message, 
      selectedPosts = [], 
      selectedRecipients = [],
      recipientType = 'followers' // 'followers', 'all_subscribers', 'manual'
    } = body;

    if (!title || !message) {
      return NextResponse.json(
        { error: 'Title and message are required' },
        { status: 400 }
      );
    }

    // الحصول على بوت المستخدم
    const { data: userBot, error: botError } = await supabase
      .from('telegram_bots')
      .select('id, bot_token, bot_name')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (botError || !userBot) {
      return NextResponse.json(
        { error: 'No active bot found. Please setup your bot first.' },
        { status: 400 }
      );
    }

    // إنشاء البرودكاست
    const { data: broadcast, error: broadcastError } = await supabase
      .rpc('create_telegram_broadcast', {
        p_bot_id: userBot.id,
        p_sender_id: user.id,
        p_title: title,
        p_message: message,
        p_post_ids: selectedPosts,
        p_recipient_ids: selectedRecipients,
        p_broadcast_type: 'post_selection'
      });

    if (broadcastError) {
      console.error('Error creating broadcast:', broadcastError);
      return NextResponse.json(
        { error: 'Failed to create broadcast' },
        { status: 500 }
      );
    }

    const broadcastId = broadcast;

    // بدء إرسال البرودكاست في background باستخدام توكن البوت الخاص بالمستخدم
    processBroadcast(supabase, broadcastId, userBot.bot_token);

    return NextResponse.json({
      success: true,
      message: 'Broadcast started successfully',
      broadcastId: broadcastId
    });

  } catch (error) {
    console.error('Send broadcast error:', error);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}

// معالجة البرودكاست في الخلفية
async function processBroadcast(supabase, broadcastId, botToken) {
  try {
    // تحديث حالة البرودكاست إلى "sending"
    await supabase
      .from('telegram_broadcasts')
      .update({ 
        status: 'sending',
        sent_at: new Date().toISOString()
      })
      .eq('id', broadcastId);

    // الحصول على بيانات البرودكاست
    const { data: broadcastData, error: fetchError } = await supabase
      .from('telegram_broadcasts_with_stats')
      .select('*')
      .eq('id', broadcastId)
      .single();

    if (fetchError) {
      console.error('Error fetching broadcast data:', fetchError);
      return;
    }

    // الحصول على البوستات المختارة
    const { data: broadcastPosts } = await supabase
      .from('telegram_broadcast_posts')
      .select(`
        post_id,
        posts(*)
      `)
      .eq('broadcast_id', broadcastId);

    // الحصول على المستقبلين
    const { data: recipients } = await supabase
      .from('telegram_broadcast_recipients')
      .select(`
        id,
        subscriber_id,
        telegram_subscribers(
          telegram_user_id,
          telegram_first_name,
          telegram_username
        )
      `)
      .eq('broadcast_id', broadcastId)
      .eq('status', 'pending');

    let sentCount = 0;
    let failedCount = 0;
    
    // Use bot token passed from the user's configured bot
    if (!botToken) {
      throw new Error('Telegram bot token is missing for this user bot');
    }

    // إرسال الرسائل
    for (const recipient of recipients) {
      try {
        const telegramUserId = recipient.telegram_subscribers.telegram_user_id;
        const messageText = formatBroadcastMessage(broadcastData, broadcastPosts);

        const result = await sendTelegramMessage(botToken, telegramUserId, messageText);

        if (result?.ok) {
          // تحديث حالة المستقبل إلى "sent"
          await supabase
            .from('telegram_broadcast_recipients')
            .update({ 
              status: 'sent',
              sent_at: new Date().toISOString(),
              telegram_message_id: result.result.message_id
            })
            .eq('id', recipient.id);

          // تسجيل الإشعار
          await supabase
            .from('telegram_notifications')
            .insert({
              bot_id: broadcastData.bot_id,
              subscriber_id: recipient.subscriber_id,
              notification_type: 'broadcast',
              broadcast_id: broadcastId,
              telegram_message_id: result.result.message_id,
              message_text: messageText,
              status: 'sent'
            });

          sentCount++;
        } else {
          throw new Error(result?.description || 'Failed to send message');
        }

      } catch (error) {
        console.error(`Error sending to ${recipient.telegram_subscribers.telegram_user_id}:`, error);
        
        // تحديث حالة المستقبل إلى "failed"
        await supabase
          .from('telegram_broadcast_recipients')
          .update({ 
            status: 'failed',
            error_message: error.message
          })
          .eq('id', recipient.id);

        failedCount++;
      }

      // تأخير قصير بين الرسائل لتجنب rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // تحديث إحصائيات البرودكاست
    await supabase
      .from('telegram_broadcasts')
      .update({ 
        status: 'completed',
        sent_count: sentCount,
        failed_count: failedCount,
        completed_at: new Date().toISOString()
      })
      .eq('id', broadcastId);

    console.log(`Broadcast ${broadcastId} completed: ${sentCount} sent, ${failedCount} failed`);

  } catch (error) {
    console.error('Error processing broadcast:', error);
    
    // تحديث حالة البرودكاست إلى "failed"
    await supabase
      .from('telegram_broadcasts')
      .update({ 
        status: 'failed',
        completed_at: new Date().toISOString()
      })
      .eq('id', broadcastId);
  }
}

// تنسيق رسالة البرودكاست
function formatBroadcastMessage(broadcast, posts) {
  let message = `📢 *${broadcast.title}*\n\n`;
  
  if (broadcast.message) {
    message += `${broadcast.message}\n\n`;
  }

  if (posts && posts.length > 0) {
    message += `📊 *Selected posts:*\n\n`;
    
    posts.forEach((postData, index) => {
      const post = postData.posts;
      message += `${index + 1}. *${post.symbol}* - ${post.company_name}\n`;
      message += `💰 Current price: ${post.current_price}\n`;
      message += `🎯 Target: ${post.target_price}\n`;
      message += `🛑 Stop loss: ${post.stop_loss_price}\n`;
      
      if (post.strategy) {
        message += `📈 Strategy: ${post.strategy}\n`;
      }
      
      message += `\n`;
    });
  }

  message += `\n👤 From: *${broadcast.sender_name}*`;
  message += `\n🕒 ${new Date().toLocaleString('en-US')}`;

  return message;
}

// إرسال رسالة تليجرام
async function sendTelegramMessage(botToken, chatId, text, options = {}) {
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const payload = {
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
      ...options
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error sending telegram message:', error);
    return { ok: false, error: error.message };
  }
}
