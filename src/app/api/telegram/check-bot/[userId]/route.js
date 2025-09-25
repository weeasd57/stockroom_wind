import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET(request, { params }) {
  try {
    const { userId } = params;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // البحث عن بوت Telegram نشط للمستخدم
    const { data: botData, error: botError } = await supabase
      .from('telegram_bots')
      .select('id, bot_username, bot_name, is_active')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    if (botError) {
      console.error('Error checking bot:', botError);
      return NextResponse.json({
        hasTelegramBot: false,
        botInfo: null,
        error: botError.message
      });
    }

    // إذا لم يكن هناك بوت نشط
    if (!botData) {
      return NextResponse.json({
        hasTelegramBot: false,
        botInfo: null
      });
    }

    // حساب عدد المشتركين (اختياري)
    let subscriberCount = 0;
    try {
      const { count } = await supabase
        .from('telegram_subscribers')
        .select('id', { count: 'exact', head: true })
        .eq('bot_id', botData.id)
        .eq('is_subscribed', true);
      
      subscriberCount = count || 0;
    } catch (countError) {
      console.log('Could not fetch subscriber count:', countError);
    }

    return NextResponse.json({
      hasTelegramBot: true,
      botInfo: {
        id: botData.id,
        username: botData.bot_username,
        name: botData.bot_name,
        subscriberCount: subscriberCount,
        subscribeLink: `https://t.me/${botData.bot_username}?start=subscribe_${userId}`
      }
    });

  } catch (error) {
    console.error('Error in telegram check-bot API:', error);
    return NextResponse.json({
      hasTelegramBot: false,
      botInfo: null,
      error: error.message
    });
  }
}
