import { createClient } from '@supabase/supabase-js';
import { BASE_URL, API_KEY } from '@/models/StockApiConfig';
import { NextResponse } from 'next/server';

// إنشاء عميل Supabase مباشرة في ملف API
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// إنشاء عميل Supabase باستخدام المتغيرات البيئية
const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

const MAX_DAILY_CHECKS = 2;

export async function POST(request) {
  try {
    // محاولة الحصول على بيانات الجلسة من الطلب
    const body = await request.json().catch(() => ({}));
    const cookieHeader = request.headers.get('cookie');

    // استخدام معرف المستخدم من الطلب إذا كان متاحًا
    let userId = body.userId;

    // إذا لم يكن هناك معرف مستخدم في الطلب، حاول الحصول عليه من الجلسة
    if (!userId) {
      console.log('محاولة الحصول على معرف المستخدم من الجلسة...');
      const { data: { session }, error: authError } = await supabase.auth.getSession({
        cookieHeader
      });
      
      if (authError) {
        console.error('خطأ في التحقق من المصادقة:', authError.message);
        return NextResponse.json(
          { success: false, message: 'خطأ في المصادقة', details: authError.message },
          { status: 401 }
        );
      }
      
      if (!session || !session.user) {
        console.error('لم يتم العثور على جلسة مستخدم نشطة');
        return NextResponse.json(
          { success: false, message: 'غير مصرح به', details: 'لا توجد جلسة نشطة' },
          { status: 401 }
        );
      }
      
      userId = session.user.id;
    }
    
    console.log('معرف المستخدم:', userId);
    
    // التحقق من أن معرف المستخدم متاح
    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'معرف المستخدم غير متاح' },
        { status: 401 }
      );
    }
    
    // التحقق من عدد مرات الاستخدام اليوم
    const today = new Date().toISOString().split('T')[0]; // تنسيق YYYY-MM-DD
    
    const { data: usageData, error: usageError } = await supabase
      .from('price_check_usage')
      .select('count')
      .eq('user_id', userId)
      .eq('check_date', today)
      .single();
    
    // إذا كان هناك استخدام سابق اليوم
    if (!usageError && usageData) {
      // التحقق من تجاوز الحد اليومي
      if (usageData.count >= MAX_DAILY_CHECKS) {
        return NextResponse.json(
          { 
            success: false, 
            message: 'لقد وصلت إلى الحد الأقصى للتحقق اليوم (مرتين). حاول مرة أخرى غدًا.', 
            remainingChecks: 0,
            usageCount: usageData.count
          },
          { status: 429 }
        );
      }
      
      // زيادة العداد
      const { error: updateError } = await supabase
        .from('price_check_usage')
        .update({ 
          count: usageData.count + 1,
          last_check: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('check_date', today);
      
      if (updateError) {
        console.error('خطأ في تحديث عدد مرات الاستخدام:', updateError);
      }
    } else {
      // إنشاء سجل جديد لليوم
      const { error: insertError } = await supabase
        .from('price_check_usage')
        .insert([
          { user_id: userId, check_date: today, count: 1 }
        ]);
      
      if (insertError) {
        console.error('خطأ في إنشاء سجل استخدام جديد:', insertError);
      }
    }
    
    // تأكد من وجود الأعمدة المطلوبة في جدول المنشورات
    await ensurePostTableColumns();
    
    // الحصول على منشورات المستخدم غير المغلقة
    const { data: posts, error: postsError } = await supabase
      .from('posts')
      .select(`
        id, 
        company_name,
        symbol,
        target_price, 
        stop_loss_price, 
        current_price,
        exchange,
        target_reached,
        stop_loss_triggered,
        created_at,
        target_reached_date,
        stop_loss_triggered_date,
        closed
      `)
      .eq('user_id', userId)
      .is('closed', null); // جلب المنشورات غير المغلقة فقط
    
    if (postsError) {
      throw postsError;
    }
    
    const results = [];
    const updatedPosts = [];
    
    // معالجة كل منشور
    for (const post of posts) {
      try {
        // تجاهل المنشورات بدون رمز سهم أو سعر هدف أو سعر وقف خسارة
        if (!post.symbol || !post.target_price || !post.stop_loss_price) {
          continue;
        }
        
        // تحضير الرمز مع البورصة إذا كانت متوفرة
        const symbol = post.exchange ? `${post.symbol}.${post.exchange}` : post.symbol;
        
        // تاريخ إنشاء المنشور وتاريخ اليوم
        const createdAt = new Date(post.created_at);
        const todayDate = new Date();
        
        // تنسيق التواريخ بتنسيق YYYY-MM-DD
        const fromDate = createdAt.toISOString().split('T')[0];
        const toDate = todayDate.toISOString().split('T')[0];
        
        // بناء URL للحصول على البيانات التاريخية
        const historicalUrl = `${BASE_URL}/eod/${symbol}?from=${fromDate}&to=${toDate}&period=d&api_token=${API_KEY}&fmt=json`;
        
        console.log(`جلب البيانات التاريخية للسهم ${symbol} من ${fromDate} إلى ${toDate}`);
        
        const response = await fetch(historicalUrl);
        
        if (!response.ok) {
          console.error(`خطأ في الحصول على بيانات السهم ${symbol}:`, response.statusText);
          continue;
        }
        
        const historicalData = await response.json();
        
        if (!Array.isArray(historicalData) || historicalData.length === 0) {
          console.warn(`لم يتم العثور على بيانات تاريخية للسهم ${symbol}`);
          continue;
        }
        
        // ترتيب البيانات من الأقدم إلى الأحدث
        historicalData.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // تحويل الأسعار إلى أرقام
        const targetPrice = parseFloat(post.target_price);
        const stopLossPrice = parseFloat(post.stop_loss_price);
        
        // البحث عن أول تاريخ تم فيه الوصول إلى السعر المستهدف أو كسر وقف الخسارة
        let targetReachedDate = null;
        let stopLossTriggeredDate = null;
        let targetReached = false;
        let stopLossTriggered = false;
        
        for (const dayData of historicalData) {
          const date = dayData.date;
          const high = parseFloat(dayData.high);
          const low = parseFloat(dayData.low);
          const close = parseFloat(dayData.close);
          
          // التحقق من الوصول إلى السعر المستهدف (إذا كان السعر الأعلى أكبر من أو يساوي السعر المستهدف)
          if (!targetReached && high >= targetPrice) {
            targetReached = true;
            targetReachedDate = date;
            console.log(`تم الوصول إلى السعر المستهدف ${targetPrice} في ${date} (الأعلى: ${high})`);
          }
          
          // التحقق من كسر وقف الخسارة (إذا كان السعر الأدنى أقل من أو يساوي سعر وقف الخسارة)
          if (!stopLossTriggered && low <= stopLossPrice) {
            stopLossTriggered = true;
            stopLossTriggeredDate = date;
            console.log(`تم كسر سعر وقف الخسارة ${stopLossPrice} في ${date} (الأدنى: ${low})`);
          }
        }
        
        // الحصول على آخر سعر إغلاق
        const lastPrice = historicalData.length > 0 
          ? parseFloat(historicalData[historicalData.length - 1].close) 
          : null;
        
        if (!lastPrice) {
          console.warn(`لم يتم العثور على سعر إغلاق حديث للسهم ${symbol}`);
          continue;
        }
        
        // تحديد ما إذا كان المنشور يجب إغلاقه (إذا تم الوصول إلى الهدف أو كسر وقف الخسارة)
        const shouldClosePost = targetReached || stopLossTriggered;
        
        // إضافة المنشور إلى قائمة التحديثات إذا تغيرت الحالة
        updatedPosts.push({
          id: post.id,
          target_reached: targetReached,
          stop_loss_triggered: stopLossTriggered,
          target_reached_date: targetReachedDate,
          stop_loss_triggered_date: stopLossTriggeredDate,
          last_price_check: new Date().toISOString(),
          last_price: lastPrice,
          closed: shouldClosePost ? true : null
        });
        
        // إضافة المنشور إلى النتائج
        results.push({
          id: post.id,
          symbol: post.symbol,
          companyName: post.company_name,
          currentPrice: lastPrice,
          targetPrice,
          stopLossPrice,
          targetReached,
          stopLossTriggered,
          targetReachedDate,
          stopLossTriggeredDate,
          closed: shouldClosePost,
          percentToTarget: !targetReached && targetPrice > lastPrice 
            ? ((targetPrice - lastPrice) / lastPrice * 100).toFixed(2)
            : ((lastPrice - targetPrice) / targetPrice * 100).toFixed(2),
          percentToStopLoss: !stopLossTriggered && stopLossPrice < lastPrice
            ? ((lastPrice - stopLossPrice) / lastPrice * 100).toFixed(2)
            : 0
        });
      } catch (postError) {
        console.error(`خطأ في معالجة المنشور ${post.id}:`, postError);
      }
    }
    
    // تحديث المنشورات في قاعدة البيانات إذا كانت هناك تغييرات
    if (updatedPosts.length > 0) {
      const { error: updateError } = await supabase
        .from('posts')
        .upsert(updatedPosts);
      
      if (updateError) {
        console.error('خطأ في تحديث حالات المنشورات:', updateError);
      }
    }
    
    // الحصول على عدد مرات الاستخدام المتبقية
    const { data: currentUsage, error: currentUsageError } = await supabase
      .from('price_check_usage')
      .select('count')
      .eq('user_id', userId)
      .eq('check_date', today)
      .single();
    
    const usageCount = currentUsage ? currentUsage.count : 1;
    const remainingChecks = MAX_DAILY_CHECKS - usageCount;
    
    return NextResponse.json({
      success: true,
      message: 'تم التحقق من أسعار منشوراتك بنجاح',
      remainingChecks,
      usageCount,
      checkedPosts: results.length,
      updatedPosts: updatedPosts.length,
      results
    });
  } catch (error) {
    console.error('خطأ في التحقق من أسعار المنشورات:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'حدث خطأ أثناء التحقق من أسعار المنشورات',
        error: error.message
      },
      { status: 500 }
    );
  }
}

// وظيفة للتأكد من وجود الأعمدة المطلوبة في جدول المنشورات
async function ensurePostTableColumns() {
  try {
    // التحقق مما إذا كانت الأعمدة موجودة بالفعل عن طريق استعلام وصفي
    const { data: columns, error } = await supabase
      .rpc('get_table_columns', { table_name: 'posts' });
    
    if (error) {
      console.error('خطأ في الحصول على أعمدة الجدول:', error);
      return;
    }
    
    // تحويل البيانات إلى مصفوفة من أسماء الأعمدة
    const columnNames = columns.map(col => col.column_name);
    
    // قائمة الأعمدة التي نحتاج إلى التحقق منها
    const requiredColumns = [
      { name: 'target_reached', type: 'boolean', default: null },
      { name: 'stop_loss_triggered', type: 'boolean', default: null },
      { name: 'target_reached_date', type: 'timestamptz', default: null },
      { name: 'stop_loss_triggered_date', type: 'timestamptz', default: null },
      { name: 'last_price_check', type: 'timestamptz', default: null },
      { name: 'last_price', type: 'decimal(15,4)', default: null },
      { name: 'closed', type: 'boolean', default: null }
    ];
    
    // إضافة الأعمدة المفقودة إذا لزم الأمر
    for (const column of requiredColumns) {
      if (!columnNames.includes(column.name)) {
        console.log(`إضافة العمود المفقود: ${column.name}`);
        const { error: alterError } = await supabase
          .rpc('add_column_if_not_exists', { 
            p_table_name: 'posts',
            p_column_name: column.name,
            p_data_type: column.type,
            p_default_value: column.default
          });
        
        if (alterError) {
          console.error(`خطأ في إضافة العمود ${column.name}:`, alterError);
        }
      }
    }
    
    console.log('تم التحقق من جميع الأعمدة المطلوبة في جدول المنشورات');
  } catch (error) {
    console.error('خطأ في التحقق من أعمدة الجدول:', error);
  }
}
