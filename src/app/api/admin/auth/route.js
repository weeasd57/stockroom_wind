import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

/**
 * POST /api/admin/auth
 * Admin login authentication
 * Body: { email, password }
 */
export async function POST(request) {
  try {
    const { email, password } = await request.json();

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );

    // Get admin credentials from database
    const { data: adminCreds, error: fetchError } = await supabase
      .from('admin_credentials')
      .select('*')
      .eq('admin_email', email.toLowerCase().trim())
      .eq('is_active', true)
      .single();

    if (fetchError || !adminCreds) {
      // Log failed attempt
      if (process.env.NODE_ENV === 'development') {
        console.log('[Admin Auth] Invalid email:', email);
      }
      
      return NextResponse.json(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, adminCreds.password_hash);

    if (!passwordMatch) {
      // Log failed attempt
      if (process.env.NODE_ENV === 'development') {
        console.log('[Admin Auth] Invalid password for:', email);
      }

      return NextResponse.json(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    await supabase
      .from('admin_credentials')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', adminCreds.id);

    // Log successful login
    const { error: logError } = await supabase.rpc('log_admin_activity', {
      p_admin_email: email,
      p_action_type: 'login',
      p_details: { success: true }
    });

    if (logError && process.env.NODE_ENV === 'development') {
      console.error('[Admin Auth] Failed to log activity:', logError);
    }

    // Return success with admin info (excluding password hash)
    return NextResponse.json({
      success: true,
      admin: {
        id: adminCreds.id,
        email: adminCreds.admin_email,
        created_at: adminCreds.created_at,
        last_login_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[Admin Auth] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Authentication failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/auth
 * Verify admin session
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email required' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );

    // Check if admin exists and is active
    const { data: adminCreds, error } = await supabase
      .from('admin_credentials')
      .select('id, admin_email, last_login_at, created_at')
      .eq('admin_email', email.toLowerCase().trim())
      .eq('is_active', true)
      .single();

    if (error || !adminCreds) {
      return NextResponse.json(
        { success: false, error: 'Invalid session' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      admin: adminCreds
    });

  } catch (error) {
    console.error('[Admin Auth] Verification error:', error);
    return NextResponse.json(
      { success: false, error: 'Verification failed' },
      { status: 500 }
    );
  }
}
