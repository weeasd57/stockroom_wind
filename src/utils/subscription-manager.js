/**
 * Unified Subscription Management Utility
 * يوحد منطق إلغاء الاشتراكات في مكان واحد
 */

// Use the shared, lazily-initialized Supabase client to avoid build-time env errors
import { supabase as sharedSupabase } from '@/utils/supabase';
// Internal client reference (can be overridden by server routes)
let _supabase = sharedSupabase;
export function setSupabaseClient(client) {
  if (client) _supabase = client;
}

// Optional event logging helper. If the `subscription_events` table doesn't exist
// we silently skip logging to avoid breaking cancellation flows.
async function safeLogSubscriptionEvent(payload) {
  try {
    const { error } = await _supabase
      .from('subscription_events')
      .insert(payload);
    if (error) {
      const msg = String(error.message || '');
      const code = String(error.code || '');
      // 42P01: relation does not exist (Postgres)
      if (code === '42P01' || /relation .* does not exist/i.test(msg) || /does not exist/i.test(msg)) {
        // Table missing – ignore silently
        return;
      }
      console.warn('[Subscription] Event log failed:', { code, msg });
    }
  } catch (e) {
    // Swallow any unexpected errors to keep the primary flow intact
  }
}

// PayPal API Configuration
const PAYPAL_MODE = (process.env.PAYPAL_MODE || 'sandbox').toLowerCase();
const PAYPAL_BASE_URL = PAYPAL_MODE === 'live' 
  ? 'https://api-m.paypal.com' 
  : 'https://api-m.sandbox.paypal.com';

function getPayPalBasicAuth() {
  const id = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || '';
  const secret = process.env.PAYPAL_CLIENT_SECRET || '';
  const raw = `${id}:${secret}`;
  try {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(raw).toString('base64');
    }
  } catch (_) {}
  try {
    if (typeof btoa !== 'undefined') {
      return btoa(raw);
    }
  } catch (_) {}
  return '';
}

/**
 * الحصول على Access Token من PayPal
 */
async function getPayPalAccessToken() {
  try {
    const basic = getPayPalBasicAuth();
    const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        ...(basic ? { 'Authorization': `Basic ${basic}` } : {}),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      throw new Error(`PayPal token request failed: ${response.status}`);
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('Error getting PayPal access token:', error);
    throw error;
  }
}

/**
 * إلغاء اشتراك PayPal
 */
async function cancelPayPalSubscription(subscriptionId, reason = 'User requested cancellation') {
  try {
    const accessToken = await getPayPalAccessToken();
    
    const response = await fetch(`${PAYPAL_BASE_URL}/v1/billing/subscriptions/${subscriptionId}/cancel`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reason: reason
      }),
    });

    if (!response.ok) {
      const errorData = await response.text().catch(() => '');
      throw new Error(`PayPal cancellation failed: ${response.status} ${errorData}`);
    }

    console.log(`PayPal subscription ${subscriptionId} cancelled successfully`);
    return true;
  } catch (error) {
    console.error('Error cancelling PayPal subscription:', error);
    // لا نفشل العملية إذا فشل إلغاء PayPal - المهم إلغاء قاعدة البيانات
    return false;
  }
}

/**
 * الدالة الرئيسية لإلغاء الاشتراك
 * تدمج جميع العمليات في مكان واحد
 */
export async function cancelSubscription({
  userId,
  reason = 'User cancelled',
  source = 'user', // 'user', 'paypal_webhook', 'admin'
  paypalSubscriptionId = null,
  shouldCancelPayPal = true,
  metadata = {}
}) {
  try {
    console.log(`[Subscription] Starting cancellation for user ${userId}`, {
      reason,
      source,
      paypalSubscriptionId,
      shouldCancelPayPal
    });

    // 1. الحصول على الاشتراك الحالي من جدول user_subscriptions (الصف النشط فقط)
    const { data: currentSub, error: fetchError } = await _supabase
      .from('user_subscriptions')
      .select(`*, subscription_plans(name, display_name)`) // requires FK plan_id -> subscription_plans.id
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (fetchError || !currentSub) {
      return {
        success: true,
        message: 'User is already on free plan',
        alreadyFree: true
      };
    }

    const currentPlanName = currentSub?.subscription_plans?.name || null;
    if (currentPlanName === 'free') {
      return {
        success: true,
        message: 'User is already on free plan',
        alreadyFree: true
      };
    }

    // 2. إلغاء PayPal subscription إذا كان مطلوب
    let paypalCancelled = false;
    const paypalSubId = paypalSubscriptionId || currentSub.paypal_subscription_id;
    if (shouldCancelPayPal && paypalSubId && source !== 'paypal_webhook') {
      console.log(`[Subscription] Attempting to cancel PayPal subscription: ${paypalSubId}`);
      paypalCancelled = await cancelPayPalSubscription(paypalSubId, reason);
    }

    // 3. تحديث قاعدة البيانات: استهدف الصف النشط فقط، واستخدم أعمدة صحيحة
    console.log(`[Subscription] Updating subscription for user ${userId}...`);
    const { data: existingCancelledRows, error: existingCancelledError } = await _supabase
      .from('user_subscriptions')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'cancelled')
      .limit(1);

    if (!existingCancelledError && Array.isArray(existingCancelledRows) && existingCancelledRows.length > 0) {
      const existingCancelledId = existingCancelledRows[0]?.id;
      if (existingCancelledId) {
        await _supabase
          .from('user_subscriptions')
          .update({
            status: 'expired',
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingCancelledId);
      }
    }
    const { data: updateData, error: updateError } = await _supabase
      .from('user_subscriptions')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('status', 'active')
      .select();

    console.log(`[Subscription] Update result:`, { updateData, updateError });

    if (updateError) {
      console.error('Error updating subscription:', updateError);
      console.error('Update error details:', {
        code: updateError.code,
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint
      });
      throw new Error(`Failed to update subscription: ${updateError.message}`);
    }

    if (!updateData || updateData.length === 0) {
      console.warn('No rows were updated. User may not have an active subscription.');
      return {
        success: true,
        message: 'User is already on free plan (no active subscription found)',
        alreadyFree: true
      };
    }
    // 4. تسجيل الحدث (اختياري وآمن)
    await safeLogSubscriptionEvent({
      user_id: userId,
      event_type: 'subscription_cancelled',
      event_data: {
        previous_plan: currentSub?.subscription_plans?.name || 'pro',
        new_plan: 'free',
        reason,
        source,
        paypal_cancelled: paypalCancelled,
        paypal_subscription_id: paypalSubId,
        ...metadata
      },
      created_at: new Date().toISOString()
    });

    // Logging errors (if any) are swallowed inside safeLogSubscriptionEvent

    console.log(`[Subscription] Successfully cancelled subscription for user ${userId}`);

    return {
      success: true,
      message: 'Subscription cancelled successfully',
      data: {
        previous_plan: currentPlanName || 'pro',
        new_plan: 'free',
        cancelled_at: new Date().toISOString(),
        paypal_cancelled: paypalCancelled,
        source
      }
    };

  } catch (error) {
    console.error(`[Subscription] Error cancelling subscription for user ${userId}:`, error);
    return {
      success: false,
      error: error.message,
      message: 'Failed to cancel subscription'
    };
  }
}

/**
 * تحقق من صحة اشتراك PayPal
 */
export async function validatePayPalSubscription(subscriptionId) {
  try {
    const accessToken = await getPayPalAccessToken();
    
    const response = await fetch(`${PAYPAL_BASE_URL}/v1/billing/subscriptions/${subscriptionId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return { valid: false, status: 'not_found' };
    }

    const subscription = await response.json();
    return {
      valid: true,
      status: subscription.status,
      data: subscription
    };
  } catch (error) {
    console.error('Error validating PayPal subscription:', error);
    return { valid: false, status: 'error', error: error.message };
  }
}

/**
 * مزامنة حالة اشتراك مع PayPal
 */
export async function syncSubscriptionWithPayPal(userId) {
  try {
    const { data: userSub } = await _supabase
      .from('user_subscription_info')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!userSub?.paypal_subscription_id) {
      return { synced: false, reason: 'No PayPal subscription ID' };
    }

    const validation = await validatePayPalSubscription(userSub.paypal_subscription_id);
    
    if (!validation.valid) {
      return { synced: false, reason: 'PayPal subscription not found' };
    }

    // تحديث الحالة إذا كانت مختلفة
    const paypalStatus = validation.status.toLowerCase();
    const dbStatus = userSub.subscription_status?.toLowerCase();

    if (paypalStatus !== dbStatus) {
      console.log(`[Subscription] Syncing status: ${dbStatus} -> ${paypalStatus}`);
      
      let updateData = {
        subscription_status: paypalStatus,
        updated_at: new Date().toISOString()
      };

      if (paypalStatus === 'cancelled' || paypalStatus === 'expired') {
        updateData = {
          ...updateData,
          plan_type: 'free',
          plan_name: 'free',
          status: paypalStatus,
          cancelled_at: new Date().toISOString(),
          cancellation_source: 'paypal_sync'
        };
      }

      await _supabase
        .from('user_subscriptions')
        .update(updateData)
        .eq('user_id', userId);

      return { 
        synced: true, 
        changed: true, 
        from: dbStatus, 
        to: paypalStatus 
      };
    }

    return { synced: true, changed: false };
  } catch (error) {
    console.error('Error syncing subscription:', error);
    return { synced: false, error: error.message };
  }
}
