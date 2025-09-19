import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    // التحقق من الـ secret token
    const telegramSecret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

    if (expectedSecret && telegramSecret !== expectedSecret) {
      console.log('Invalid webhook secret');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // الحصول على البيانات من التليجرام
    const body = await request.json();
    console.log('Telegram webhook received:', body);

    if (body.message) {
      await handleTelegramMessage(supabase, body.message);
    } else if (body.callback_query) {
      await handleCallbackQuery(supabase, body.callback_query);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Telegram webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// التعامل مع الرسائل
async function handleTelegramMessage(supabase, message) {
  const telegramUserId = message.from.id;
  const telegramUsername = message.from.username;
  const firstName = message.from.first_name;
  const lastName = message.from.last_name;
  const text = message.text;

  console.log(`Message from ${firstName} (@${telegramUsername}): ${text}`);

  // التعامل مع أمر /start
  if (text === '/start') {
    await handleStartCommand(supabase, message);
    return;
  }

  // التعامل مع أمر /subscribe
  if (text === '/subscribe') {
    await handleSubscribeCommand(supabase, message);
    return;
  }

  // التعامل مع أمر /unsubscribe
  if (text === '/unsubscribe') {
    await handleUnsubscribeCommand(supabase, message);
    return;
  }

  // التعامل مع أمر /settings
  if (text === '/settings') {
    await handleSettingsCommand(supabase, message);
    return;
  }

  // رسالة افتراضية
  await sendTelegramMessage(telegramUserId, 
    'مرحباً! استخدم الأوامر التالية:\n' +
    '/start - البدء\n' +
    '/subscribe - الاشتراك في الإشعارات\n' +
    '/unsubscribe - إلغاء الاشتراك\n' +
    '/settings - إعدادات الإشعارات'
  );
}

// التعامل مع callback queries (الأزرار)
async function handleCallbackQuery(supabase, callbackQuery) {
  const telegramUserId = callbackQuery.from.id;
  const data = callbackQuery.data;

  console.log(`Callback query from ${telegramUserId}: ${data}`);

  // إجابة على callback query
  await answerCallbackQuery(callbackQuery.id);

  if (data.startsWith('subscribe_')) {
    const botId = data.replace('subscribe_', '');
    await subscribeToBot(supabase, telegramUserId, botId, callbackQuery.from);
  } else if (data.startsWith('unsubscribe_')) {
    const botId = data.replace('unsubscribe_', '');
    await unsubscribeFromBot(supabase, telegramUserId, botId);
  }
}

// أمر /start
async function handleStartCommand(supabase, message) {
  const telegramUserId = message.from.id;
  
  // البحث عن البوتات المتاحة
  const { data: bots, error } = await supabase
    .from('telegram_bots')
    .select('id, bot_name, bot_username, user_id, profiles(username, full_name)')
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching bots:', error);
    await sendTelegramMessage(telegramUserId, 'حدث خطأ، حاول مرة أخرى لاحقاً.');
    return;
  }

  if (!bots || bots.length === 0) {
    await sendTelegramMessage(telegramUserId, 'لا توجد بوتات متاحة حالياً.');
    return;
  }

  // إرسال قائمة البوتات المتاحة
  let messageText = 'مرحباً! اختر البوت الذي تريد الاشتراك به:\n\n';
  const keyboard = [];

  for (const bot of bots) {
    messageText += `📊 ${bot.bot_name}\n`;
    messageText += `👤 المُدير: ${bot.profiles?.full_name || bot.profiles?.username}\n\n`;
    
    keyboard.push([{
      text: `🔔 اشترك في ${bot.bot_name}`,
      callback_data: `subscribe_${bot.id}`
    }]);
  }

  await sendTelegramMessage(telegramUserId, messageText, {
    reply_markup: {
      inline_keyboard: keyboard
    }
  });
}

// أمر /subscribe
async function handleSubscribeCommand(supabase, message) {
  // نفس منطق /start
  await handleStartCommand(supabase, message);
}

// أمر /unsubscribe
async function handleUnsubscribeCommand(supabase, message) {
  const telegramUserId = message.from.id;

  // البحث عن الاشتراكات الحالية
  const { data: subscriptions, error } = await supabase
    .from('telegram_subscribers')
    .select(`
      id,
      bot_id,
      telegram_bots(bot_name, bot_username)
    `)
    .eq('telegram_user_id', telegramUserId)
    .eq('is_subscribed', true);

  if (error) {
    console.error('Error fetching subscriptions:', error);
    await sendTelegramMessage(telegramUserId, 'حدث خطأ، حاول مرة أخرى لاحقاً.');
    return;
  }

  if (!subscriptions || subscriptions.length === 0) {
    await sendTelegramMessage(telegramUserId, 'أنت غير مشترك في أي بوت حالياً.');
    return;
  }

  let messageText = 'اختر البوت الذي تريد إلغاء الاشتراك منه:\n\n';
  const keyboard = [];

  for (const sub of subscriptions) {
    messageText += `📊 ${sub.telegram_bots.bot_name}\n`;
    
    keyboard.push([{
      text: `🔕 إلغاء الاشتراك من ${sub.telegram_bots.bot_name}`,
      callback_data: `unsubscribe_${sub.bot_id}`
    }]);
  }

  await sendTelegramMessage(telegramUserId, messageText, {
    reply_markup: {
      inline_keyboard: keyboard
    }
  });
}

// أمر /settings
async function handleSettingsCommand(supabase, message) {
  const telegramUserId = message.from.id;
  
  await sendTelegramMessage(telegramUserId, 
    '⚙️ إعدادات الإشعارات:\n\n' +
    '🔔 إشعارات البوستات الجديدة\n' +
    '📈 إشعارات تحديث الأسعار\n' +
    '🎯 إشعارات الوصول للهدف\n' +
    '🛑 إشعارات وقف الخسارة\n\n' +
    'يمكنك إدارة هذه الإعدادات من الموقع.'
  );
}

// الاشتراك في بوت
async function subscribeToBot(supabase, telegramUserId, botId, telegramUser) {
  try {
    // التحقق من وجود الاشتراك
    const { data: existingSub } = await supabase
      .from('telegram_subscribers')
      .select('id, is_subscribed')
      .eq('telegram_user_id', telegramUserId)
      .eq('bot_id', botId)
      .single();

    if (existingSub) {
      if (existingSub.is_subscribed) {
        await sendTelegramMessage(telegramUserId, '✅ أنت مشترك بالفعل في هذا البوت!');
        return;
      } else {
        // إعادة تفعيل الاشتراك
        await supabase
          .from('telegram_subscribers')
          .update({ 
            is_subscribed: true,
            last_interaction: new Date().toISOString()
          })
          .eq('id', existingSub.id);
      }
    } else {
      // إنشاء اشتراك جديد
      await supabase
        .from('telegram_subscribers')
        .insert({
          bot_id: botId,
          telegram_user_id: telegramUserId,
          telegram_username: telegramUser.username,
          telegram_first_name: telegramUser.first_name,
          telegram_last_name: telegramUser.last_name,
          is_subscribed: true
        });
    }

    // إنشاء إعدادات الإشعارات الافتراضية
    const notificationTypes = ['new_post', 'price_update', 'target_reached', 'stop_loss'];
    
    for (const type of notificationTypes) {
      await supabase
        .from('telegram_notification_settings')
        .upsert({
          subscriber_id: existingSub?.id,
          notification_type: type,
          is_enabled: true
        }, {
          onConflict: 'subscriber_id,notification_type',
          ignoreDuplicates: false
        });
    }

    await sendTelegramMessage(telegramUserId, 
      '🎉 تم الاشتراك بنجاح!\n' +
      'ستتلقى إشعارات حول:\n' +
      '• البوستات الجديدة\n' +
      '• تحديثات الأسعار\n' +
      '• الوصول للأهداف\n' +
      '• وقف الخسائر'
    );

  } catch (error) {
    console.error('Error subscribing to bot:', error);
    await sendTelegramMessage(telegramUserId, 'حدث خطأ أثناء الاشتراك، حاول مرة أخرى.');
  }
}

// إلغاء الاشتراك من بوت
async function unsubscribeFromBot(supabase, telegramUserId, botId) {
  try {
    const { error } = await supabase
      .from('telegram_subscribers')
      .update({ 
        is_subscribed: false,
        last_interaction: new Date().toISOString()
      })
      .eq('telegram_user_id', telegramUserId)
      .eq('bot_id', botId);

    if (error) {
      console.error('Error unsubscribing:', error);
      await sendTelegramMessage(telegramUserId, 'حدث خطأ أثناء إلغاء الاشتراك.');
      return;
    }

    await sendTelegramMessage(telegramUserId, '✅ تم إلغاء الاشتراك بنجاح!');

  } catch (error) {
    console.error('Error unsubscribing from bot:', error);
    await sendTelegramMessage(telegramUserId, 'حدث خطأ أثناء إلغاء الاشتراك، حاول مرة أخرى.');
  }
}

// إرسال رسالة تليجرام
async function sendTelegramMessage(chatId, text, options = {}) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.error('TELEGRAM_BOT_TOKEN not found');
      return;
    }

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const payload = {
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown',
      ...options
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    
    if (!result.ok) {
      console.error('Telegram API error:', result);
    }

    return result;
  } catch (error) {
    console.error('Error sending telegram message:', error);
  }
}

// الرد على callback query
async function answerCallbackQuery(callbackQueryId, text = '') {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const url = `https://api.telegram.org/bot${botToken}/answerCallbackQuery`;
    
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text
      })
    });
  } catch (error) {
    console.error('Error answering callback query:', error);
  }
}
