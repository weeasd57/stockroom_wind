import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { whatsappService } from '@/services/whatsappService';

// GET - الحصول على إحصائيات إشعارات الواتساب
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
    const { searchParams } = new URL(req.url);
    
    // قراءة المعاملات
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const includeGlobal = searchParams.get('include_global') === 'true';

    // الحصول على إحصائيات المستخدم
    const userStats = await whatsappService.getNotificationStats(userId, dateFrom, dateTo);
    
    let globalStats = null;
    
    // التحقق من صلاحيات المستخدم للإحصائيات العامة (للمشرفين فقط)
    if (includeGlobal) {
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', userId)
        .single();
        
      // يمكن إضافة منطق للتحقق من كون المستخدم مشرفاً
      const isAdmin = userProfile?.username === 'admin' || false; // منطق مبسط
      
      if (isAdmin) {
        globalStats = await whatsappService.getNotificationStats(null, dateFrom, dateTo);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        user_stats: userStats,
        global_stats: globalStats
      }
    });

  } catch (error) {
    console.error('[WhatsApp Stats API] Error in GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}