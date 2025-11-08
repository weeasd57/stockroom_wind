/**
 * Cron Job: Renew Monthly Subscriptions & Expire Yearly Subscriptions
 * 
 * This endpoint should be called daily by a cron service (e.g., Vercel Cron, GitHub Actions)
 * 
 * What it does:
 * 1. Renews monthly subscriptions that are about to expire (auto-renewal)
 * 2. Expires yearly subscriptions that have passed their expiry date
 * 
 * Security: 
 * - Protected by CRON_SECRET environment variable
 * - Only runs when proper authorization header is provided
 */

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Initialize Supabase admin client
function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      db: { schema: 'public' }
    }
  );
}

export async function GET(request) {
  try {
    // Security: Check cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'your-secret-key-here';
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const admin = createAdminClient();
    
    // Step 1: Renew monthly subscriptions
    console.log('[Cron] Starting monthly subscription renewal...');
    const { data: renewedData, error: renewError } = await admin.rpc('renew_monthly_subscriptions');
    
    const renewedCount = renewedData?.[0]?.renewed_count || 0;
    
    if (renewError) {
      console.error('[Cron] Error renewing monthly subscriptions:', renewError);
    } else {
      console.log(`[Cron] Renewed ${renewedCount} monthly subscriptions`);
    }

    // Step 2: Expire yearly subscriptions
    console.log('[Cron] Starting yearly subscription expiry...');
    const { data: expiredData, error: expireError } = await admin.rpc('expire_yearly_subscriptions');
    
    const expiredCount = expiredData?.[0]?.expired_count || 0;
    
    if (expireError) {
      console.error('[Cron] Error expiring yearly subscriptions:', expireError);
    } else {
      console.log(`[Cron] Expired ${expiredCount} yearly subscriptions`);
    }

    // Step 3: Get subscription statistics
    const { data: stats, error: statsError } = await admin
      .from('subscription_stats')
      .select('*');

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results: {
        monthly_renewed: renewedCount,
        yearly_expired: expiredCount,
        errors: {
          renew: renewError?.message || null,
          expire: expireError?.message || null,
          stats: statsError?.message || null
        }
      },
      statistics: stats || []
    });

  } catch (error) {
    console.error('[Cron] Unexpected error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        message: error.message 
      },
      { status: 500 }
    );
  }
}

// POST method for manual trigger (development/testing)
export async function POST(request) {
  try {
    // Security: Check admin authorization
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'your-secret-key-here';
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[Cron] Manual trigger via POST request');
    
    // Reuse GET logic
    return GET(request);

  } catch (error) {
    console.error('[Cron] POST error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        message: error.message 
      },
      { status: 500 }
    );
  }
}
