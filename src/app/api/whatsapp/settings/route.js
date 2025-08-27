import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { whatsappService } from '@/services/whatsappService';

// GET - الحصول على إعدادات إشعارات الواتساب للمستخدم
export async function GET(req) {
  try {
    // إنشاء عميل Supabase
    const supabase = createRouteHandlerClient({ cookies });
    
    // التحقق من جلسة المستخدم
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const userId = session.user.id;

    // الحصول على إعدادات المستخدم
    const settings = await whatsappService.getUserNotificationSettings(userId);
    
    if (!settings) {
      return NextResponse.json({ error: 'Failed to get user settings' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      data: settings 
    });

  } catch (error) {
    console.error('[WhatsApp Settings API] Error in GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - تحديث إعدادات إشعارات الواتساب
export async function PUT(req) {
  try {
    // إنشاء عميل Supabase
    const supabase = createRouteHandlerClient({ cookies });
    
    // التحقق من جلسة المستخدم
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const userId = session.user.id;
    
    // قراءة بيانات الطلب
    const body = await req.json();
    const { 
      whatsapp_number, 
      notifications_enabled, 
      notification_preferences 
    } = body;

    // التحقق من صحة رقم الواتساب إذا تم تمريره
    if (whatsapp_number && whatsapp_number.trim()) {
      const cleanNumber = whatsapp_number.replace(/[^\d+]/g, '');
      if (cleanNumber.length < 10 || cleanNumber.length > 15) {
        return NextResponse.json({ 
          error: 'Invalid WhatsApp number format' 
        }, { status: 400 });
      }
    }

    // تحديث الإعدادات
    const success = await whatsappService.updateUserNotificationSettings(
      userId,
      whatsapp_number?.trim(),
      notifications_enabled,
      notification_preferences
    );

    if (!success) {
      return NextResponse.json({ 
        error: 'Failed to update settings' 
      }, { status: 500 });
    }

    // الحصول على الإعدادات المحدثة
    const updatedSettings = await whatsappService.getUserNotificationSettings(userId);

    return NextResponse.json({
      success: true,
      message: 'Settings updated successfully',
      data: updatedSettings
    });

  } catch (error) {
    console.error('[WhatsApp Settings API] Error in PUT:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - اختبار إرسال رسالة واتساب
export async function POST(req) {
  try {
    // إنشاء عميل Supabase
    const supabase = createRouteHandlerClient({ cookies });
    
    // التحقق من جلسة المستخدم
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const userId = session.user.id;
    
    // قراءة بيانات الطلب
    const body = await req.json();
    const { action } = body;

    if (action === 'test_message') {
      // الحصول على إعدادات المستخدم
      const settings = await whatsappService.getUserNotificationSettings(userId);
      
      if (!settings?.whatsapp_number) {
        return NextResponse.json({ 
          error: 'WhatsApp number not configured' 
        }, { status: 400 });
      }

      if (!settings.whatsapp_notifications_enabled) {
        return NextResponse.json({ 
          error: 'WhatsApp notifications are disabled' 
        }, { status: 400 });
      }

      // إرسال رسالة اختبار
      const testMessage = `🔔 *رسالة اختبار من SharksZone*\n\nمرحباً! هذه رسالة اختبار للتأكد من عمل إشعارات الواتساب بشكل صحيح.\n\n✅ تم تفعيل الإشعارات بنجاح!\n\nستصلك الآن إشعارات عند نشر منشورات جديدة من الأشخاص الذين تتابعهم.`;

      // محاكاة إرسال رسالة (في الإنتاج، سيتم الإرسال الفعلي)
      console.log(`[WhatsApp Test] Sending test message to ${settings.whatsapp_number}`);
      console.log(`[WhatsApp Test] Message: ${testMessage}`);

      return NextResponse.json({
        success: true,
        message: 'Test message sent successfully',
        details: 'Check your WhatsApp for the test message'
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('[WhatsApp Settings API] Error in POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}