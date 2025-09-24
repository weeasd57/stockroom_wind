import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    // التحقق من المصادقة
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'You must be logged in' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { botName } = body;

    if (!botName) {
      return NextResponse.json(
        { error: 'Missing required fields', message: 'Bot name is required' },
        { status: 400 }
      );
    }

    // Read token from environment only (do not accept from client)
    const envToken = process.env.TELEGRAMBOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
    if (!envToken) {
      return NextResponse.json(
        { error: 'Server misconfiguration', message: 'Telegram bot token not configured in environment' },
        { status: 500 }
      );
    }

    // التحقق من صحة البوت
    const botInfo = await validateTelegramBot(envToken);
    if (!botInfo.ok) {
      return NextResponse.json(
        { error: 'Invalid bot token', message: botInfo.error },
        { status: 400 }
      );
    }

    // التحقق من وجود بوت للمستخدم
    const { data: existingBot } = await supabase
      .from('telegram_bots')
      .select('id')
      .eq('user_id', user.id)
      .single();

    let botData;
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/telegram/webhook`;

    if (existingBot) {
      // تحديث البوت الموجود
      const { data, error } = await supabase
        .from('telegram_bots')
        .update({
          bot_token: envToken,
          bot_username: botInfo.result.username,
          bot_name: botName,
          is_active: true,
          webhook_url: webhookUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingBot.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating bot:', error);
        return NextResponse.json(
          { error: 'Database error', message: 'Failed to update bot' },
          { status: 500 }
        );
      }
      botData = data;
    } else {
      // إنشاء بوت جديد
      const { data, error } = await supabase
        .from('telegram_bots')
        .insert({
          user_id: user.id,
          bot_token: envToken,
          bot_username: botInfo.result.username,
          bot_name: botName,
          is_active: true,
          webhook_url: webhookUrl
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating bot:', error);
        return NextResponse.json(
          { error: 'Database error', message: 'Failed to create bot' },
          { status: 500 }
        );
      }
      botData = data;
    }

    // إعداد webhook مع تليجرام
    const webhookSetup = await setupTelegramWebhook(envToken, webhookUrl);
    if (!webhookSetup.ok) {
      console.error('Webhook setup failed:', webhookSetup.error);
      // لا نتوقف هنا، يمكن إعداد الـ webhook لاحقاً
    }

    // إعداد أوامر البوت
    await setupBotCommands(supabase, botData.id, envToken);

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

  } catch (error) {
    console.error('Bot setup error:', error);
    return NextResponse.json(
      { error: 'Server error', message: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

export async function GET(request) {
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

    // الحصول على معلومات البوت
    const { data: bot, error } = await supabase
      .rpc('get_user_telegram_bot', { p_user_id: user.id });

    if (error) {
      console.error('Error fetching bot info:', error);
      return NextResponse.json({ bot: null });
    }

    return NextResponse.json({
      bot: bot?.[0] || null
    });

  } catch (error) {
    console.error('Error getting bot info:', error);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
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

    // حذف البوت
    const { error } = await supabase
      .from('telegram_bots')
      .update({ is_active: false })
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deactivating bot:', error);
      return NextResponse.json(
        { error: 'Failed to deactivate bot' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Bot deactivated successfully'
    });

  } catch (error) {
    console.error('Error deleting bot:', error);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}

// التحقق من صحة البوت
async function validateTelegramBot(botToken) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const result = await response.json();
    
    if (!result.ok) {
      return { ok: false, error: 'Invalid bot token' };
    }

    return { ok: true, result: result.result };
  } catch (error) {
    console.error('Bot validation error:', error);
    return { ok: false, error: 'Failed to validate bot token' };
  }
}

// إعداد webhook
async function setupTelegramWebhook(botToken, webhookUrl) {
  try {
    const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;
    
    const response = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: secretToken,
        max_connections: 40,
        allowed_updates: ["message", "callback_query"]
      })
    });

    const result = await response.json();
    
    if (!result.ok) {
      return { ok: false, error: result.description };
    }

    return { ok: true };
  } catch (error) {
    console.error('Webhook setup error:', error);
    return { ok: false, error: 'Failed to setup webhook' };
  }
}

// إعداد أوامر البوت
async function setupBotCommands(supabase, botId, botToken) {
  try {
    const commands = [
      { command: 'start', description: 'البدء واختيار البوت للاشتراك' },
      { command: 'subscribe', description: 'الاشتراك في الإشعارات' },
      { command: 'unsubscribe', description: 'إلغاء الاشتراك من الإشعارات' },
      { command: 'settings', description: 'إعدادات الإشعارات' }
    ];

    // إعداد الأوامر في تليجرام
    await fetch(`https://api.telegram.org/bot${botToken}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commands })
    });

    // حفظ الأوامر في قاعدة البيانات
    for (const cmd of commands) {
      await supabase
        .from('telegram_bot_commands')
        .upsert({
          bot_id: botId,
          command: cmd.command,
          description: cmd.description,
          is_active: true
        }, {
          onConflict: 'bot_id,command'
        });
    }
  } catch (error) {
    console.error('Error setting up bot commands:', error);
  }
}
