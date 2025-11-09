import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getUserFromRequest(request) {
  // Try Authorization header first
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (bearerToken) {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${bearerToken}` } } }
    );
    const { data, error } = await supabase.auth.getUser(bearerToken);
    if (!error && data?.user) return data.user;
  }

  // Fallback to cookie session
  const { createRouteHandlerClient } = await import('@supabase/auth-helpers-nextjs');
  const supabase = createRouteHandlerClient({ cookies });
  const { data } = await supabase.auth.getSession();
  return data?.session?.user || null;
}

function createAdminClient() {
  const { createClient } = require('@supabase/supabase-js');
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      db: { schema: 'public' },
      global: { headers: { 'Cache-Control': 'no-cache' } }
    }
  );
  return admin;
}

function extractSubscriptionId(rpcData) {
  // Accept string UUID, object with id, or array
  if (!rpcData) return null;
  if (typeof rpcData === 'string') return rpcData;
  if (Array.isArray(rpcData)) {
    const first = rpcData[0];
    if (!first) return null;
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object' && first.id) return first.id;
    return null;
  }
  if (rpcData && typeof rpcData === 'object' && rpcData.id) return rpcData.id;
  return null;
}

export async function POST(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user?.id) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const orderId = body?.orderId || body?.paypalOrderId || body?.p_paypal_order_id;
    const captureId = body?.captureId || body?.paypalCaptureId || null;
    const amount = Number(body?.amount ?? 0) || null;
    const currency = body?.currency || null;
    const billingPeriod = body?.billingPeriod || body?.billing_period || 'monthly';
    
    // Validate billing period
    const validBillingPeriod = billingPeriod === 'yearly' ? 'yearly' : 'monthly';

    if (!orderId) {
      return NextResponse.json({ success: false, message: 'orderId is required' }, { status: 400 });
    }

    const admin = createAdminClient();

    // 1) Create/Upsert Pro subscription via RPC (idempotent on server)
    let subscriptionId = null;
    const { data: rpcData, error: rpcError } = await admin.rpc('create_pro_subscription', {
      p_user_id: user.id,
      p_paypal_order_id: orderId,
    });

    if (rpcError) {
      // If duplicate/unique conflict, attempt a best-effort fix then retry once
      const isDuplicate = (rpcError?.code === '23505') || /duplicate key/i.test(rpcError?.message || '');
      if (!isDuplicate) {
        return NextResponse.json({ success: false, message: 'RPC failed', error: rpcError.message }, { status: 500 });
      }
      try {
        // Convert existing 'cancelled' rows to 'expired' to avoid UNIQUE(user_id,status) conflicts
        await admin
          .from('user_subscriptions')
          .update({ status: 'expired' })
          .eq('user_id', user.id)
          .eq('status', 'cancelled');

        // Retry RPC once
        const { data: retryData, error: retryErr } = await admin.rpc('create_pro_subscription', {
          p_user_id: user.id,
          p_paypal_order_id: orderId,
        });
        if (!retryErr) {
          subscriptionId = extractSubscriptionId(retryData);
        } else {
          console.warn('[subscription/upgrade] RPC retry failed:', retryErr.message);
        }
      } catch (e) {
        console.warn('[subscription/upgrade] duplicate fix attempt failed:', e?.message || e);
      }
    } else {
      subscriptionId = extractSubscriptionId(rpcData);
    }

    // 2) Fallback: fetch active subscription id if not provided by RPC
    if (!subscriptionId) {
      const { data: subs, error: subErr } = await admin
        .from('user_subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('started_at', { ascending: false })
        .limit(1);
      if (subErr) {
        return NextResponse.json({ success: false, message: 'Failed to fetch active subscription', error: subErr.message }, { status: 500 });
      }
      subscriptionId = subs?.[0]?.id || null;
    }

    if (!subscriptionId) {
      return NextResponse.json({ success: false, message: 'Subscription ID not found after RPC' }, { status: 500 });
    }

    // 2.5) Reliably convert the current active row to Pro plan (no status fanout)
    const nowIso = new Date().toISOString();
    
    // Calculate expiry based on billing period
    const expiryMs = validBillingPeriod === 'yearly' 
      ? 365 * 24 * 60 * 60 * 1000  // 1 year
      : 30 * 24 * 60 * 60 * 1000;   // 1 month
    const expIso = new Date(Date.now() + expiryMs).toISOString();
    
    const resetMs = validBillingPeriod === 'yearly'
      ? 365 * 24 * 60 * 60 * 1000
      : 30 * 24 * 60 * 60 * 1000;
    const resetIso = new Date(Date.now() + resetMs).toISOString();

    // Fetch Pro plan id
    const { data: proPlan, error: proErr } = await admin
      .from('subscription_plans')
      .select('id')
      .eq('name', 'pro')
      .single();
    if (proErr || !proPlan?.id) {
      return NextResponse.json({ success: false, message: 'Pro plan not found', error: proErr?.message }, { status: 500 });
    }

    // Update the currently active subscription for this user to Pro
    console.log('[subscription/upgrade] Updating subscription with:', {
      user_id: user.id,
      started_at: nowIso,
      expires_at: expIso,
      billing_period: validBillingPeriod,
      current_time: new Date().toISOString()
    });
    
    const { data: updateResult, error: convErr } = await admin
      .from('user_subscriptions')
      .update({
        plan_id: proPlan.id,
        status: 'active',
        billing_period: validBillingPeriod,
        started_at: nowIso,
        expires_at: expIso,
        price_checks_reset_at: resetIso,
        posts_reset_at: resetIso,
        price_checks_used: 0,
        posts_created: 0,
        paypal_order_id: orderId,
        updated_at: nowIso, // Force update timestamp
      })
      .eq('user_id', user.id)
      .eq('status', 'active')
      .select(); // Return updated rows for verification
      
    if (convErr) {
      console.error('[subscription/upgrade] Update failed:', convErr);
      return NextResponse.json({ success: false, message: 'Failed to activate Pro subscription', error: convErr.message }, { status: 500 });
    }
    
    console.log('[subscription/upgrade] Update successful:', updateResult);

    // Update profile to mark user as broker when they subscribe to Pro
    const { error: profileErr } = await admin
      .from('profiles')
      .update({ 
        is_broker: true,
        updated_at: nowIso
      })
      .eq('id', user.id);
    
    if (profileErr) {
      console.warn('[subscription/upgrade] Failed to update profile.is_broker:', profileErr.message);
      // Don't fail the entire request if profile update fails
    } else {
      console.log('[subscription/upgrade] Profile updated: is_broker = true');
    }

    // Refresh subscriptionId from the active row (guaranteed single by DB constraint)
    const { data: activeRow, error: actErr } = await admin
      .from('user_subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();
    if (!actErr && activeRow?.id) {
      subscriptionId = activeRow.id;
    }

    // 3) Idempotent payment transaction insert
    // Check existing by order or capture id
    const { data: existing, error: existErr } = await admin
      .from('payment_transactions')
      .select('id')
      .or([
        orderId ? `paypal_order_id.eq.${orderId}` : null,
        captureId ? `paypal_capture_id.eq.${captureId}` : null,
      ].filter(Boolean).join(','))
      .limit(1);

    if (existErr) {
      // Don't fail hard; continue to try insert
      console.warn('[upgrade] existing check failed:', existErr.message);
    }

    let transactionId = existing?.[0]?.id || null;

    if (!transactionId) {
      const insertPayload = {
        user_id: user.id,
        subscription_id: subscriptionId,
        amount: amount ?? 0,
        currency: currency ?? 'USD',
        paypal_order_id: orderId,
        paypal_capture_id: captureId,
        status: 'completed',
        transaction_type: 'payment',
        metadata: {
          paypal_order_id: orderId,
          paypal_capture_id: captureId,
          source: 'api/subscription/upgrade',
        },
      };

      const { data: ins, error: insErr } = await admin
        .from('payment_transactions')
        .insert(insertPayload)
        .select('id')
        .single();

      if (insErr) {
        // If duplicate, accept success; otherwise surface error
        const isDuplicate = (insErr?.code === '23505') || /duplicate key/i.test(insErr?.message || '');
        if (!isDuplicate) {
          return NextResponse.json({ success: false, message: 'Failed to record payment', error: insErr.message }, { status: 500 });
        }
      } else {
        transactionId = ins?.id || null;
      }
    }

    // 4) Return fresh subscription info from DB
    let subscriptionInfo = null;
    try {
      const { data: infoData } = await admin.rpc('get_subscription_info', { p_user_id: user.id });
      subscriptionInfo = infoData || null;
      if (subscriptionInfo && subscriptionInfo.plan_name !== 'pro') {
        // Auto-correct once
        await admin
          .from('user_subscriptions')
          .update({ plan_id: proPlan.id })
          .eq('id', subscriptionId);
      }
    } catch (_) {}

    return NextResponse.json({
      success: true,
      data: {
        subscriptionId,
        transactionId,
        paypal: { orderId, captureId },
        subscription: subscriptionInfo
      }
    });
  } catch (error) {
    console.error('[subscription/upgrade] error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error', error: error.message }, { status: 500 });
  }
}
